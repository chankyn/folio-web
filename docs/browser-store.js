'use strict';
// Local workspace. Keep the database name stable so existing documents survive upgrades.
const FolioStore = (() => {
    const DB_NAME = 'folio-web-v08', VERSION = 1;
    let dbPromise;
    const open = () => dbPromise ||= new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(Error('Este navegador no permite IndexedDB.'));
            return;
        }
        const req = indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('docs'))
                db.createObjectStore('docs', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('questions'))
                db.createObjectStore('questions', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('meta'))
                db.createObjectStore('meta', { keyPath: 'key' });
            if (!db.objectStoreNames.contains('snapshots'))
                db.createObjectStore('snapshots', { keyPath: 'name' });
        };
        req.onsuccess = () => { const db = req.result; db.onversionchange = () => db.close(); resolve(db); };
        req.onerror = () => reject(req.error || Error('No se puede abrir IndexedDB'));
        req.onblocked = () => reject(Error('Cierra otras pestañas antiguas de Folio para actualizar el almacenamiento.'));
    });
    const result = req => new Promise((ok, fail) => { req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error || Error('Error de IndexedDB')); });
    const done = tx => new Promise((ok, fail) => { tx.oncomplete = () => ok(); tx.onabort = () => fail(tx.error || Error('Transacción cancelada')); tx.onerror = () => fail(tx.error || Error('Error de almacenamiento')); });
    async function load() {
        const db = await open(), tx = db.transaction(['docs', 'questions', 'meta'], 'readonly');
        const [docs, bank, meta] = await Promise.all([result(tx.objectStore('docs').getAll()), result(tx.objectStore('questions').getAll()), result(tx.objectStore('meta').get('workspace'))]);
        await done(tx);
        if (!docs.length)
            return null;
        // The in-memory signatures match the loaded data, so opening Folio does not
        // rewrite every document on its first autosave.
        lastDocDigests = new Map(docs.map(doc => [doc.id, signature(doc)]));
        lastQuestionDigests = new Map(bank.map(question => [question.id, questionSignature(question)]));
        return { docs, bank, active: meta?.active, openTabs: meta?.openTabs, savedAt: meta?.savedAt || 0 };
    }
    let lastDocDigests = new Map();
    let lastQuestionDigests = new Map();
    const signature = d => [d.id, d.title, d.html, d.path || '', JSON.stringify(d.settings || {}), d.updated || 0, d.lastOpened || 0].join('\0');
    const questionSignature = question => JSON.stringify(question);
    async function save(data) {
        if (!data || !Array.isArray(data.docs) || !data.docs.length)
            throw Error('No hay documentos válidos que guardar');
        const db = await open(), banks = Array.isArray(data.bank);
        const names = banks ? ['docs', 'questions', 'meta'] : ['docs', 'meta'];
        const tx = db.transaction(names, 'readwrite'), docs = tx.objectStore('docs');
        // Open/close/delete tracking uses IDs; documents are only written when modified.
        const next = new Map();
        for (const d of data.docs) {
            const digest = signature(d);
            next.set(d.id, digest);
            if (lastDocDigests.get(d.id) !== digest)
                docs.put(d);
        }
        for (const id of lastDocDigests.keys())
            if (!next.has(id))
                docs.delete(id);
        tx.objectStore('meta').put({ key: 'workspace', active: data.active, openTabs: data.openTabs || [], savedAt: data.savedAt || Date.now() });
        let nextQuestions;
        if (banks) {
            const questions = tx.objectStore('questions');
            nextQuestions = new Map();
            for (const question of data.bank) {
                const digest = questionSignature(question);
                nextQuestions.set(question.id, digest);
                if (lastQuestionDigests.get(question.id) !== digest)
                    questions.put(question);
            }
            for (const id of lastQuestionDigests.keys()) {
                if (!nextQuestions.has(id)) questions.delete(id);
            }
        }
        await done(tx);
        lastDocDigests = next;
        if (nextQuestions) lastQuestionDigests = nextQuestions;
    }
    async function createBackup(label = 'Manual') {
        const state = await load();
        if (!state)
            throw Error('No hay contenido para copiar');
        const db = await open(), stamp = new Date().toISOString(), name = stamp + '_' + crypto.randomUUID();
        const backup = { name, created: stamp, label, docs: state.docs, bank: state.bank, active: state.active, openTabs: state.openTabs, savedAt: state.savedAt };
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put(backup);
        await done(tx);
        const all = await listBackups();
        if (all.length > 24) {
            const trim = db.transaction('snapshots', 'readwrite');
            for (const item of all.slice(24))
                trim.objectStore('snapshots').delete(item.name);
            await done(trim);
        }
        return backup;
    }
    async function listBackups() {
        const db = await open(), tx = db.transaction('snapshots', 'readonly'), all = await result(tx.objectStore('snapshots').getAll());
        await done(tx);
        return all.sort((a, b) => b.created.localeCompare(a.created)).map(a => ({ name: a.name, created: a.created, label: a.label, size: new Blob([JSON.stringify(a)]).size }));
    }
    async function restoreBackup(name) {
        const db = await open(), tx = db.transaction('snapshots', 'readonly'), backup = await result(tx.objectStore('snapshots').get(name));
        await done(tx);
        if (!backup)
            throw Error('Copia de recuperación no encontrada');
        await createBackup('Antes de restaurar');
        const write = db.transaction(['docs', 'questions', 'meta'], 'readwrite');
        write.objectStore('docs').clear();
        write.objectStore('questions').clear();
        for (const doc of backup.docs)
            write.objectStore('docs').put(doc);
        for (const q of backup.bank)
            write.objectStore('questions').put(q);
        write.objectStore('meta').put({ key: 'workspace', active: backup.active, openTabs: backup.openTabs, savedAt: Date.now() });
        await done(write);
        lastDocDigests.clear();
        lastQuestionDigests.clear();
    }
    async function backupIfDue() {
        const db = await open(), tx = db.transaction('meta', 'readonly'), row = await result(tx.objectStore('meta').get('lastAutomaticBackup'));
        await done(tx);
        if (row?.timestamp > Date.now() - 6 * 60 * 60 * 1000)
            return;
        const data = await load();
        if (!data)
            return;
        await createBackup('Automática');
        const w = db.transaction('meta', 'readwrite');
        w.objectStore('meta').put({ key: 'lastAutomaticBackup', timestamp: Date.now() });
        await done(w);
    }
    return { load, save, createBackup, listBackups, restoreBackup, backupIfDue };
})();

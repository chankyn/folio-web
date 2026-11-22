'use strict';
(async () => {
    const byId = id => document.getElementById(id);
    const all = selector => Array.from(document.querySelectorAll(selector));
    const createId = () => globalThis.crypto?.randomUUID?.()
        ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    const defaults = { paper: 'a4', orientation: 'portrait', margin: 2.5, spacing: 1.15, font: 'serif', size: 11, pageNumbers: true };
    const newDocument = (title = FolioI18n.t('Documento sin título'), html = '') => ({ id: createId(), title, html, settings: { ...defaults }, updated: Date.now(), lastOpened: Date.now() });
    const demo = newDocument(FolioI18n.language === 'en' ? 'Welcome to Folio' : 'Documento de bienvenida', '<h1>Bienvenido a Folio</h1><p>Tu espacio para escribir, dar formato y preparar evaluaciones.</p><p>Trabaja como en un procesador de textos habitual: selecciona una palabra, aplica <b>negrita</b> o <i>cursiva</i>, cambia el estilo de un título y exporta el resultado en PDF.</p><h2>Empieza a crear</h2><ul><li>Crea un documento nuevo o continúa este ejemplo.</li><li>Inserta tablas, imágenes y saltos de página.</li><li>Organiza tus preguntas y genera exámenes personalizados.</li></ul><p>Todo el trabajo de composición se realiza automáticamente.</p>');
    if (FolioI18n.language === 'en') {
        demo.html = '<h1>Welcome to Folio</h1><p>Your space for writing documents and preparing assessments.</p>' +
            '<p>Format text, add tables, images and equations, or create questions in your question bank.</p>' +
            '<h2>Get started</h2><ul><li>Create a new document or continue editing this example.</li>' +
            '<li>Import a question bank and assign topics and difficulty levels.</li>' +
            '<li>Create an exam and download a PDF.</li></ul>' +
            '<p>All content is saved locally in your browser.</p>';
    }
    let state = { docs: [demo], active: demo.id, bank: [] };
    let saveQueue = Promise.resolve(), bankVersion = 0, bankSyncedVersion = 0;
    let storageError = null;
    try {
        const restored = await FolioStore.load();
        if (restored?.docs?.length)
            state = restored;
    }
    catch (err) {
        storageError = err;
        console.error('Folio IndexedDB', err);
    }
    let openTabs = Array.isArray(state.openTabs) ? state.openTabs.filter(id => state.docs.some(d => d.id === id)) : state.docs.map(d => d.id);
    if (!openTabs.includes(state.active))
        openTabs.push(state.active);
    state.openTabs = openTabs;
    let selection = null, currentView = 'editor', zoom = 100, questionId = null;
    let toastTimer, saveTimer, weights = {};
    function active() { return state.docs.find(x => x.id === state.active) || state.docs[0]; }
    const t = message => FolioI18n.t(message);
    const confirm = message => window.confirm(t(message));
    const prompt = (message, value) => window.prompt(t(message), value);
    function toast(msg) { byId('toast').textContent = t(msg); byId('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => byId('toast').classList.remove('show'), 4500); }
    function markBankDirty() { bankVersion++; }
    function persist() {
        clearTimeout(saveTimer);
        saveTimer = null;
        state.savedAt = Math.max(Date.now(), (state.savedAt || 0) + 1);
        const bankIncluded = bankVersion !== bankSyncedVersion, stamp = state.savedAt, bankStamp = bankVersion;
        // Copy the data when enqueueing: later edits cannot alter an in-flight transaction.
        const payload = { docs: structuredClone(state.docs), active: state.active, openTabs: [...openTabs], savedAt: stamp };
        if (bankIncluded)
            payload.bank = structuredClone(state.bank);
        byId('saveState').textContent = 'Guardando…';
        saveQueue = saveQueue.catch(() => { }).then(async () => {
            try {
                if (storageError)
                    throw storageError;
                await FolioStore.save(payload);
                if (bankIncluded)
                    bankSyncedVersion = Math.max(bankSyncedVersion, bankStamp);
                if (stamp === state.savedAt)
                    byId('saveState').textContent = 'Guardado en este navegador';
            }
            catch (err) {
                if (stamp === state.savedAt)
                    byId('saveState').textContent = 'No se pudo guardar · exporta copia';
                toast('Error al guardar: ' + err.message);
            }
        });
        return saveQueue;
    }
    async function flushWorkspace() {
        saveEditor();
        await persist();
        if (storageError || byId('saveState').textContent !== 'Guardado en este navegador')
            throw Error('No se ha confirmado el guardado en IndexedDB. Exporta una copia.');
    }
    function scheduleSave() { byId('saveState').textContent = 'Guardando…'; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 850); }
    // Se guardan solo los cambios reales. La actualización del contador y de
    // las pestañas se programa aparte para no interrumpir la escritura.
    function saveEditor() {
        clearTimeout(editorInputTimer);
        const document = active();
        if (!document)
            return;
        const html = byId('editor').innerHTML;
        const title = byId('title').value.trim() || FolioI18n.t('Documento sin título');
        if (document.html === html && document.title === title)
            return;
        const titleChanged = document.title !== title;
        document.html = html;
        document.title = title;
        document.updated = Date.now();
        scheduleSave();
        queueEditorUI(titleChanged);
    }
    function wordCount() {
        const text = byId('editor').innerText.trim();
        const count = text ? text.split(/\s+/).length : 0;
        byId('wordCount').textContent = `${count} palabras`;
    }
    let uiTimer;
    let needsTabsUpdate = false;
    function queueEditorUI(updateTabs = false) {
        needsTabsUpdate ||= updateTabs;
        clearTimeout(uiTimer);
        uiTimer = setTimeout(() => {
            wordCount();
            if (needsTabsUpdate) {
                renderDocs();
                needsTabsUpdate = false;
            }
        }, 260);
    }
    // El catálogo y los filtros funcionan también fuera de la interfaz.
    const DOC_SORT_PREF = 'folio.documents.sort.v07';
    const { normalize: docText, filename: docFileName, lastUsed: docUsed, displayDate: docDate } = FolioDocuments;
    let docsShown = 60;
    let docsFilterTimer = 0;
    function touchDocument(d) {
        if (d)
            d.lastOpened = Date.now();
    }
    function activateDocument(id) {
        const next = state.docs.find(d => d.id === id);
        if (!next)
            return;
        if (next.id !== state.active)
            saveEditor();
        state.active = next.id;
        touchDocument(next);
        loadEditor();
        showView('editor');
        persist();
    }
    function renderDocs(updateTabs = true) {
        const query = byId('docSearch').value.trim();
        const tokens = docText(query).split(/\s+/).filter(Boolean);
        const sort = byId('docSort').value;
        const docs = FolioDocuments.findAndSort(state.docs, query, sort);
        byId('docCount').textContent = tokens.length ? `${docs.length}/${state.docs.length}` : String(state.docs.length);
        const frag = document.createDocumentFragment();
        for (const d of docs.slice(0, docsShown)) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'docitem' + (d.id === state.active ? ' current' : '');
            const icon = document.createElement('span');
            icon.className = 'docitem-icon';
            icon.textContent = '▤';
            icon.setAttribute('aria-hidden', 'true');
            const info = document.createElement('span');
            info.className = 'docitem-info';
            const name = document.createElement('strong');
            name.className = 'docitem-name';
            name.textContent = d.title || 'Documento sin título';
            const sub = document.createElement('small');
            sub.className = 'docitem-meta';
            const filename = docFileName(d), date = docDate(sort === 'modified' ? d.updated : docUsed(d), new Date(), FolioI18n.language);
            // Show the actual filename when it differs from the editor title.
            sub.textContent = (filename && docText(filename.replace(/\.folio$/i, '')) !== docText(d.title) ? filename + ' · ' : '') + date;
            info.append(name, sub);
            b.append(icon, info);
            b.title = (filename || d.title) + ' · ' + (sort === 'modified' ? 'Modificado: ' : 'Usado: ') + date;
            b.setAttribute('aria-current', d.id === state.active ? 'true' : 'false');
            b.onclick = () => activateDocument(d.id);
            frag.append(b);
        }
        const list = byId('docList');
        list.replaceChildren(frag);
        const footer = byId('docListFooter');
        footer.replaceChildren();
        if (!docs.length) {
            const empty = document.createElement('p');
            empty.className = 'doc-list-empty';
            empty.textContent = state.docs.length ? 'No se encontraron documentos. Prueba con otro nombre.' : 'Todavía no hay documentos.';
            footer.append(empty);
        }
        else if (docs.length > docsShown) {
            const more = document.createElement('button');
            more.type = 'button';
            more.className = 'doc-more';
            more.textContent = `Mostrar más (${docs.length - docsShown} restantes)`;
            more.onclick = () => { docsShown += 60; renderDocs(false); };
            footer.append(more);
        }
        if (updateTabs)
            renderTabs();
    }
    try {
        const pref = localStorage.getItem(DOC_SORT_PREF);
        if (['recent', 'modified', 'name'].includes(pref))
            byId('docSort').value = pref;
    }
    catch { }
    byId('docSort').onchange = () => {
        docsShown = 60;
        try {
            localStorage.setItem(DOC_SORT_PREF, byId('docSort').value);
        }
        catch { }
        renderDocs(false);
    };
    byId('docSearch').oninput = () => { docsShown = 60; clearTimeout(docsFilterTimer); docsFilterTimer = setTimeout(() => renderDocs(false), 90); };
    byId('docSearch').onkeydown = ev => {
        if (ev.key === 'Escape') {
            byId('docSearch').value = '';
            docsShown = 60;
            renderDocs(false);
            byId('docSearch').blur();
        }
        else if (ev.key === 'Enter') {
            ev.preventDefault();
            clearTimeout(docsFilterTimer);
            renderDocs(false);
            byId('docList').querySelector('.docitem')?.click();
        }
    };
    document.addEventListener('keydown', ev => {
        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'f') {
            ev.preventDefault();
            byId('docSearch').focus();
            byId('docSearch').select();
        }
    });
    const settingControls = { paper: 'paper', orientation: 'orientation', margin: 'margin', spacing: 'spacing', baseFont: 'font', baseSize: 'size', pageNumbers: 'pageNumbers' };
    function applySettings() {
        const s = active().settings = { ...defaults, ...active().settings };
        const portrait = s.paper === 'letter' ? [816, 1056] : [794, 1123];
        const [w, h] = s.orientation === 'landscape' ? portrait.slice().reverse() : portrait;
        const sheet = byId('paperSheet'), ed = byId('editor');
        sheet.style.width = w + 'px';
        sheet.style.minHeight = h + 'px';
        sheet.style.padding = (s.margin * 37.795) + 'px';
        byId('canvas').style.setProperty('--paper-width', w + 'px');
        document.querySelector('.ruler').style.width = w + 'px';
        ed.style.minHeight = Math.max(200, h - s.margin * 75.59) + 'px';
        ed.style.lineHeight = s.spacing;
        ed.style.fontSize = s.size * 4 / 3 + 'px';
        ed.style.fontFamily = { serif: 'Georgia, serif', sans: 'Arial, sans-serif', mono: 'Courier New, monospace' }[s.font] || s.font || 'Georgia, serif';
        for (const [id, key] of Object.entries(settingControls)) {
            const x = byId(id);
            if (x.type === 'checkbox')
                x.checked = !!s[key];
            else
                x.value = String(s[key]);
        }
    }
    function loadEditor() {
        selection = null;
        const d = active();
        state.active = d.id;
        if (!openTabs.includes(d.id))
            openTabs.push(d.id);
        state.openTabs = openTabs;
        byId('title').value = d.title;
        byId('editor').innerHTML = cleanHTML(d.html);
        FolioLists.normalize(byId('editor'));
        byId('pageIndicator').textContent = 'Vista continua · ' + (d.settings?.paper === 'letter' ? 'Carta' : 'A4');
        applySettings();
        wordCount();
        renderDocs();
    }
    function showView(view) {
        currentView = view;
        for (const name of ['editor', 'bank', 'exam']) {
            byId(name + 'View').classList.toggle('hidden', name !== view);
        }
        for (const button of all('.nav')) {
            const selected = button.dataset.view === view;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        }
        for (const name of ['preview', 'download', 'saveDoc']) {
            byId(name).disabled = view !== 'editor';
        }
        if (view === 'bank')
            renderBank();
        if (view === 'exam') {
            renderWeights();
            updateExam();
        }
    }
    all('.nav').forEach(b => b.onclick = () => { saveEditor(); showView(b.dataset.view); });
    function addDoc(d) { saveEditor(); touchDocument(d); state.docs.unshift(d); state.active = d.id; loadEditor(); showView('editor'); persist(); }
    let editorInputTimer;
    function deferEditorSave() { clearTimeout(editorInputTimer); editorInputTimer = setTimeout(saveEditor, 180); }
    byId('newDoc').onclick = () => addDoc(newDocument());
    byId('title').oninput = deferEditorSave;
    byId('editor').oninput = deferEditorSave;
    byId('duplicate').onclick = () => addDoc({ ...structuredClone(active()), id: createId(), path: undefined, title: active().title + ' (copia)', updated: Date.now() });
    byId('rename').onclick = () => { byId('title').focus(); byId('title').select(); };
    byId('deleteDoc').onclick = () => {
        if (!confirm('¿Eliminar este documento?'))
            return;
        state.docs = state.docs.filter(d => d.id !== state.active);
        if (!state.docs.length)
            state.docs.push(newDocument());
        openTabs = openTabs.filter(id => state.docs.some(d => d.id === id));
        state.active = state.docs[0].id;
        touchDocument(active());
        loadEditor();
        persist();
        toast('Documento eliminado.');
    };
    all('.tab').forEach(b => b.onclick = () => {
        all('.tab').forEach(t => t.classList.toggle('active', t === b));
        for (const t of ['home', 'insert', 'layout', 'file'])
            byId(t + 'Tools').classList.toggle('hidden', b.dataset.tab !== t);
    });
    for (const [id, key] of Object.entries(settingControls))
        byId(id).onchange = () => { const x = byId(id); active().settings[key] = x.type === 'checkbox' ? x.checked : ['margin', 'spacing', 'size'].includes(key) ? Number(x.value) : x.value; applySettings(); scheduleSave(); };
    function capture() {
        const s = window.getSelection();
        if (s?.rangeCount && byId('editor').contains(s.anchorNode) && byId('editor').contains(s.focusNode))
            selection = s.getRangeAt(0).cloneRange();
    }
    function restore() {
        const ed = byId('editor');
        ed.focus();
        const s = window.getSelection();
        if (selection && ed.contains(selection.commonAncestorContainer)) {
            s.removeAllRanges();
            s.addRange(selection);
        }
        else {
            let r = document.createRange();
            r.selectNodeContents(ed);
            r.collapse(false);
            s.removeAllRanges();
            s.addRange(r);
        }
    }
    let formatFrame = 0;
    document.addEventListener('selectionchange', () => {
        capture();
        if (formatFrame)
            return;
        formatFrame = requestAnimationFrame(() => {
            formatFrame = 0;
            if (currentView !== 'editor')
                return;
            for (const b of all('[data-cmd]')) {
                try {
                    b.classList.toggle('on', document.queryCommandState(b.dataset.cmd));
                }
                catch { }
            }
            const c = FolioLists.settings(byId('editor'));
            if (c.style) {
                byId('bulletStyle').value = c.style;
                byId('customBulletWrap').classList.toggle('hidden', c.style !== 'custom');
                if (c.style === 'custom')
                    byId('customBullet').value = c.marker;
            }
        });
    });
    function command(cmd, val = null) { restore(); document.execCommand('styleWithCSS', false, false); document.execCommand(cmd, false, val); capture(); saveEditor(); }
    all('[data-cmd]').forEach(b => {
        b.onmousedown = ev => ev.preventDefault();
        b.onclick = () => {
            command(b.dataset.cmd);
            if (['insertUnorderedList', 'insertOrderedList'].includes(b.dataset.cmd)) {
                FolioLists.normalize(byId('editor'));
                saveEditor();
            }
        };
    });
    function listChange(style, marker) {
        restore();
        let list = FolioLists.currentList(byId('editor'));
        if (!list) {
            const cmd = FolioLists.numbered.has(style) ? 'insertOrderedList' : 'insertUnorderedList';
            document.execCommand(cmd, false, null);
            list = FolioLists.currentList(byId('editor'));
        }
        if (!list) {
            toast('Sitúa el cursor dentro del texto de la lista.');
            return;
        }
        FolioLists.setStyle(list, style, marker);
        FolioLists.normalize(byId('editor'));
        capture();
        saveEditor();
    }
    byId('bulletStyle').onchange = () => { const style = byId('bulletStyle').value; byId('customBulletWrap').classList.toggle('hidden', style !== 'custom'); listChange(style, byId('customBullet').value); };
    byId('customBullet').onchange = () => { const marker = FolioLists.safeMarker(byId('customBullet').value); byId('customBullet').value = marker; listChange('custom', marker); };
    function listIndent(out = false) {
        restore();
        if (!FolioLists.currentList(byId('editor')))
            return false;
        document.execCommand(out ? 'outdent' : 'indent');
        FolioLists.normalize(byId('editor'));
        capture();
        saveEditor();
        return true;
    }
    for (const [id, out] of [['listIndent', false], ['listOutdent', true]]) {
        byId(id).onmousedown = ev => ev.preventDefault();
        byId(id).onclick = () => {
            if (!listIndent(out))
                toast('Selecciona una viñeta antes de cambiar el nivel.');
        };
    }
    byId('editor').addEventListener('keydown', ev => {
        if (ev.key !== 'Tab' || ev.ctrlKey || ev.altKey || ev.metaKey || !FolioLists.currentList(byId('editor')))
            return;
        ev.preventDefault();
        listIndent(ev.shiftKey);
    });
    byId('font').onchange = () => command('fontName', byId('font').value);
    byId('fontSize').onchange = () => { restore(); document.execCommand('styleWithCSS', false, false); document.execCommand('fontSize', false, '7'); byId('editor').querySelectorAll('font[size="7"]').forEach(el => { el.removeAttribute('size'); el.style.fontSize = byId('fontSize').value + 'pt'; }); capture(); saveEditor(); };
    byId('blockStyle').onchange = () => command('formatBlock', byId('blockStyle').value);
    byId('textColor').oninput = () => command('foreColor', byId('textColor').value);
    byId('highlight').oninput = () => command('hiliteColor', byId('highlight').value);
    function cleanHTML(raw) {
        const doc = new DOMParser().parseFromString(String(raw ?? ''), 'text/html');
        const allowed = new Set('P DIV SPAN B STRONG I EM U S STRIKE DEL FONT A SUB SUP H1 H2 H3 H4 BLOCKQUOTE UL OL LI BR HR TABLE THEAD TBODY TFOOT TR TD TH IMG'.split(' '));
        const styles = new Set(['font-family', 'font-size', 'font-weight', 'font-style', 'color', 'background-color', 'text-align', 'text-decoration', 'text-decoration-line']);
        for (const el of [...doc.body.querySelectorAll('*')]) {
            if (!allowed.has(el.tagName)) {
                if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'TEMPLATE'].includes(el.tagName))
                    el.remove();
                else
                    el.replaceWith(...el.childNodes);
                continue;
            }
            for (const attr of [...el.attributes]) {
                if (!['style', 'align', 'class', 'contenteditable', 'data-pagebreak', 'data-latex', 'role', 'src', 'width', 'alt', 'color', 'face', 'size', 'data-list-style', 'data-marker'].includes(attr.name))
                    el.removeAttribute(attr.name);
            }
            if (el.hasAttribute('data-list-style')) {
                if (!['UL', 'OL'].includes(el.tagName) || !Object.hasOwn(FolioLists.styles, el.getAttribute('data-list-style')))
                    el.removeAttribute('data-list-style');
            }
            if (el.hasAttribute('data-marker')) {
                if (el.tagName !== 'LI')
                    el.removeAttribute('data-marker');
                else
                    el.setAttribute('data-marker', FolioLists.safeMarker(el.getAttribute('data-marker')));
            }
            if (el.hasAttribute('style')) {
                const vals = Array.from(el.style).filter(k => styles.has(k)).map(k => `${k}:${el.style.getPropertyValue(k)}`);
                el.setAttribute('style', vals.join(';'));
            }
            if (el.tagName === 'IMG' && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(el.getAttribute('src') || ''))
                el.remove();
            else if (el.tagName !== 'IMG')
                el.removeAttribute('src');
            if (el.tagName === 'SPAN' && el.classList.contains('folio-equation') && FolioMath.validate(el.getAttribute('data-latex') || '')) {
                const tex = el.getAttribute('data-latex');
                el.setAttribute('class', 'folio-equation');
                el.setAttribute('contenteditable', 'false');
                el.setAttribute('role', 'img');
                el.setAttribute('aria-label', 'Ecuación: ' + tex);
                el.setAttribute('data-latex', tex);
                el.innerHTML = FolioMath.render(tex);
            }
            else {
                el.removeAttribute('data-latex');
                el.removeAttribute('role');
                if (el.getAttribute('data-pagebreak') !== '1') {
                    el.removeAttribute('data-pagebreak');
                    el.removeAttribute('contenteditable');
                    el.removeAttribute('class');
                }
            }
        }
        return doc.body.innerHTML;
    }
    function insert(html) { command('insertHTML', cleanHTML(html)); }
    // Visual equation insertion/editing; preserve the editor selection while dialog is open.
    let editingEquation = null;
    function mathPreview() { const raw = byId('mathInput').value, valid = FolioMath.validate(raw); byId('mathApply').disabled = !valid; byId('mathError').textContent = valid ? '' : 'Expresión no admitida: usa los botones de estructura y símbolos habituales.'; byId('mathPreview').innerHTML = valid ? FolioMath.html(raw) : ''; }
    byId('addEquation').onclick = () => { capture(); editingEquation = null; byId('mathInput').value = '\\frac{a}{b}'; mathPreview(); byId('mathDialog').showModal(); byId('mathInput').focus(); };
    byId('editor').addEventListener('dblclick', ev => {
        const eq = ev.target.closest('.folio-equation');
        if (!eq || !byId('editor').contains(eq))
            return;
        editingEquation = eq;
        byId('mathInput').value = eq.getAttribute('data-latex') || '';
        mathPreview();
        byId('mathDialog').showModal();
        byId('mathInput').focus();
    });
    byId('mathInput').oninput = mathPreview;
    all('[data-math]').forEach(b => b.onclick = () => { const insertText = b.dataset.math; const inp = byId('mathInput'); inp.setRangeText(insertText, inp.selectionStart, inp.selectionEnd, 'end'); mathPreview(); inp.focus(); });
    byId('mathApply').onclick = () => {
        const tex = byId('mathInput').value;
        if (!FolioMath.validate(tex))
            return toast('Expresión matemática no admitida.');
        byId('mathDialog').close();
        if (editingEquation && byId('editor').contains(editingEquation)) {
            editingEquation.outerHTML = FolioMath.html(tex);
            saveEditor();
        }
        else
            insert(FolioMath.html(tex) + '&nbsp;');
        editingEquation = null;
    };
    // Read-only pagination avoids disruptive DOM rewrites and preserves undo/caret while typing.
    byId('pagePreview').onclick = () => {
        saveEditor();
        try {
            const n = FolioPages.paginate(byId('editor'), active().settings, byId('pagesContent'));
            byId('pagesSummary').textContent = n + ' ' + (n === 1 ? 'página' : 'páginas') + ' · ' + (active().settings.paper === 'letter' ? 'Carta' : 'A4') + ' · ' + (active().settings.orientation === 'landscape' ? 'horizontal' : 'vertical');
            byId('pageIndicator').textContent = n + ' ' + (n === 1 ? 'página' : 'páginas') + ' en vista paginada';
            byId('pagesDialog').showModal();
        }
        catch (err) {
            toast('No se pudo crear la vista paginada: ' + err.message);
        }
    };
    byId('pagesPrint').onclick = () => { byId('pagesDialog').close(); printDocument(); };
    byId('editor').addEventListener('paste', ev => { ev.preventDefault(); const h = ev.clipboardData.getData('text/html'); const t = ev.clipboardData.getData('text/plain'); insert(h || escapeHTML(t).replace(/\n/g, '<br>')); });
    byId('editor').addEventListener('drop', ev => { ev.preventDefault(); });
    byId('addTable').onclick = () => {
        let r = Number(prompt('Número de filas (1–30)', '3')), c = Number(prompt('Número de columnas (1–10)', '3'));
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 1 || r > 30 || c < 1 || c > 10)
            return;
        insert('<table><tbody>' + Array.from({ length: r }, () => '<tr>' + Array.from({ length: c }, () => '<td>&nbsp;</td>').join('') + '</tr>').join('') + '</tbody></table><p><br></p>');
    };
    byId('addImage').onclick = () => byId('fileImage').click();
    byId('fileImage').onchange = async (ev) => {
        const f = ev.target.files[0];
        ev.target.value = '';
        if (!f)
            return;
        if (!['image/png', 'image/jpeg'].includes(f.type) || f.size > 3 * 1024 * 1024) {
            toast('Usa una imagen PNG o JPEG de hasta 3 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => insert(`<p><img src="${reader.result}" alt="Imagen" width="500"></p><p><br></p>`);
        reader.readAsDataURL(f);
    };
    byId('pageBreak').onclick = () => insert('<div data-pagebreak="1" class="pagebreak" contenteditable="false"><br></div><p><br></p>');
    byId('rule').onclick = () => insert('<hr><p><br></p>');
    function setZoom(delta) { zoom = Math.max(50, Math.min(150, zoom + delta)); byId('paperSheet').style.zoom = zoom / 100; document.querySelector('.ruler').style.zoom = zoom / 100; byId('zoomLevel').textContent = zoom + '%'; }
    byId('zoomOut').onclick = () => setZoom(-10);
    byId('zoomIn').onclick = () => setZoom(10);
    window.addEventListener('beforeunload', () => {
        saveEditor();
        if (saveTimer)
            persist();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && saveTimer) {
            saveEditor();
            persist();
        }
    });
    // Web version: closing browser tabs is controlled by the browser, not a native host.
    byId('quit').textContent = t('Acerca de Folio Web');
    byId('quit').onclick = () => alert(FolioI18n.language === 'en'
        ? 'Folio Web 1.0 stores your documents and questions in this browser using IndexedDB. Export regular backups. There is no automatic sync between devices.'
        : 'Folio Web 1.0 guarda tus documentos y preguntas en este navegador mediante IndexedDB. Exporta copias de seguridad regularmente. No existe sincronización automática entre equipos.');
    function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    function fileName(s) { return String(s).replace(/[\\/:*?"<>|]/g, '-').trim() || 'documento'; }
    function printDocument() {
        saveEditor();
        const s = active().settings, style = document.createElement('style');
        style.id = 'printLayout';
        document.getElementById('printLayout')?.remove();
        const margin = Math.min(4, Math.max(1, Number(s.margin) || 2.5));
        style.textContent = '@page {size: ' + (s.paper === 'letter' ? 'letter' : 'A4') + ' ' + (s.orientation === 'landscape' ? 'landscape' : 'portrait') + '; margin: ' + margin + 'cm;}';
        document.head.append(style);
        window.print();
    }
    byId('printDoc').onclick = printDocument;
    byId('download').onclick = printDocument;
    byId('preview').onclick = () => byId('pagePreview').click();
    byId('pdfSave').onclick = printDocument;
    byId('exportSource').onclick = async () => {
        try {
            saveEditor();
            const d = active(), output = FolioLatex.build(cleanHTML(d.html), d.settings);
            const zip = new JSZip();
            zip.file('document.tex', output.source);
            for (const [name, b64] of Object.entries(output.assets))
                zip.file(name, b64, { base64: true });
            const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            download(blob, fileName(d.title) + '-latex.zip');
        }
        catch (err) {
            toast('No se pudo exportar LaTeX: ' + err.message);
        }
    };
    all('[data-close]').forEach(b => b.onclick = () => byId(b.dataset.close).close());
    const topics = (bank = state.bank) => [...new Set(bank.map(q => q.topic))].sort((a, b) => a.localeCompare(b, 'es'));
    let bankPage = 0;
    const pageSize = 60;
    const bankSearchCache = new WeakMap();
    let topicSignature = '';
    function searchable(q) {
        let x = bankSearchCache.get(q);
        if (x === undefined) {
            x = [q.text, q.topic, ...q.options.map(a => a.text)].join(' ').toLocaleLowerCase('es');
            bankSearchCache.set(q, x);
        }
        return x;
    }
    function renderBank() {
        const bank = state.bank, ts = topics(), filter = byId('topicFilter'), old = filter.value;
        const signature = ts.join('\u001f');
        if (signature !== topicSignature) {
            filter.innerHTML = '<option value="">Todos los temas</option>' + ts.map(topic => `<option value="${escapeHTML(topic)}" data-no-translate>${escapeHTML(topic)}</option>`).join('');
            filter.value = ts.includes(old) ? old : '';
            byId('topicList').innerHTML = ts.map(t => `<option value="${escapeHTML(t)}"></option>`).join('');
            topicSignature = signature;
        }
        byId('bankCount').textContent = bank.length;
        byId('statQuestions').textContent = bank.length;
        byId('statTopics').textContent = ts.length;
        byId('statHard').textContent = bank.filter(q => q.difficulty === 'Difícil').length;
        const search = byId('search').value.toLocaleLowerCase('es');
        const filtered = bank.filter(q => (!filter.value || q.topic === filter.value) && (!byId('difficultyFilter').value || q.difficulty === byId('difficultyFilter').value) && (!search || searchable(q).includes(search)));
        byId('questions').replaceChildren();
        if (!filtered.length) {
            byId('questions').innerHTML = `<div class="empty"><strong>${bank.length ? 'No hay coincidencias' : 'Tu banco está vacío'}</strong>${bank.length ? 'Prueba otros filtros.' : 'Añade tu primera pregunta para empezar a crear exámenes.'}</div>`;
            return;
        }
        bankPage = Math.min(bankPage, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
        for (const q of filtered.slice(bankPage * pageSize, (bankPage + 1) * pageSize)) {
            const row = document.createElement('div');
            row.className = 'question';
            row.innerHTML = `<div class="question-main"><h3>${escapeHTML(q.text)}</h3><div class="chips"><span class="chip" data-no-translate>${escapeHTML(q.topic)}</span><span class="chip">${escapeHTML(q.difficulty)}</span><span class="chip correct">${q.options.length} respuestas</span></div><div class="qanswers">${q.options.map((a, i) => `<div class="${a.id === q.correct ? 'correcttext' : ''}">${String.fromCharCode(65 + i)}. ${escapeHTML(a.text)}${a.id === q.correct ? ' ✓' : ''}</div>`).join('')}</div></div><div class="qactions"><button title="Editar pregunta">Editar</button><button title="Eliminar pregunta" class="danger">Eliminar</button></div>`;
            row.querySelectorAll('button')[0].onclick = () => openQuestion(q);
            row.querySelectorAll('button')[1].onclick = () => {
                if (confirm('¿Eliminar esta pregunta del banco?')) {
                    state.bank = state.bank.filter(x => x.id !== q.id);
                    markBankDirty();
                    persist();
                    renderBank();
                }
            };
            byId('questions').append(row);
        }
        if (filtered.length > pageSize) {
            const nav = document.createElement('div');
            nav.className = 'bankpager';
            const prev = document.createElement('button'), next = document.createElement('button'), info = document.createElement('span');
            prev.textContent = '← Anterior';
            next.textContent = 'Siguiente →';
            prev.disabled = bankPage === 0;
            next.disabled = (bankPage + 1) * pageSize >= filtered.length;
            info.textContent = `${bankPage * pageSize + 1}–${Math.min((bankPage + 1) * pageSize, filtered.length)} de ${filtered.length}`;
            prev.onclick = () => { bankPage--; renderBank(); };
            next.onclick = () => { bankPage++; renderBank(); };
            nav.append(prev, info, next);
            byId('questions').append(nav);
        }
    }
    let searchTimer;
    for (const id of ['search', 'topicFilter', 'difficultyFilter'])
        byId(id).addEventListener(id === 'search' ? 'input' : 'change', id === 'search' ? () => { bankPage = 0; clearTimeout(searchTimer); searchTimer = setTimeout(renderBank, 150); } : () => { bankPage = 0; renderBank(); });
    function optionRow(text = '', correct = false) {
        const row = document.createElement('div');
        row.className = 'optionrow';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'correctOption';
        radio.checked = correct;
        radio.setAttribute('aria-label', 'Marcar respuesta correcta');
        const answer = document.createElement('input');
        answer.type = 'text';
        answer.required = true;
        answer.placeholder = 'Respuesta';
        answer.value = text;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Eliminar respuesta');
        remove.onclick = () => {
            if (byId('qOptions').children.length <= 2) {
                toast('Se necesitan al menos dos respuestas.');
                return;
            }
            const wasCorrect = radio.checked;
            row.remove();
            if (wasCorrect) {
                byId('qOptions').querySelector('input[type=radio]').checked = true;
            }
        };
        row.append(radio, answer, remove);
        byId('qOptions').append(row);
    }
    function openQuestion(question = null) {
        questionId = question?.id || null;
        byId('questionHeading').textContent = question ? 'Editar pregunta' : 'Nueva pregunta';
        byId('qText').value = question?.text || '';
        byId('qTopic').value = question?.topic || '';
        byId('qDifficulty').value = question?.difficulty || 'Media';
        byId('qExplanation').value = question?.explanation || '';
        byId('qOptions').replaceChildren();
        if (question) {
            question.options.forEach(option => optionRow(option.text, option.id === question.correct));
        }
        else {
            for (let index = 0; index < 4; index++)
                optionRow('', index === 0);
        }
        byId('questionDialog').showModal();
    }
    byId('newQuestion').onclick = () => openQuestion();
    byId('addOption').onclick = () => {
        if (byId('qOptions').children.length < 10)
            optionRow();
        else
            toast('Máximo 10 respuestas.');
    };
    byId('questionForm').onsubmit = ev => {
        ev.preventDefault();
        const rows = [...byId('qOptions').children], options = rows.map(r => ({ id: createId(), text: r.querySelector('input[type=text]').value.trim() })), idx = rows.findIndex(r => r.querySelector('input[type=radio]').checked);
        const q = { id: questionId || createId(), text: byId('qText').value.trim(), topic: byId('qTopic').value.trim(), difficulty: byId('qDifficulty').value, options, correct: options[idx]?.id, explanation: byId('qExplanation').value.trim() };
        if (!q.text || !q.topic || !q.correct || options.some(o => !o.text)) {
            toast('Completa todos los campos y marca una respuesta correcta.');
            return;
        }
        if (new Set(options.map(o => o.text.toLowerCase())).size !== options.length) {
            toast('Las respuestas no pueden estar duplicadas.');
            return;
        }
        if (questionId)
            state.bank = state.bank.map(x => x.id === questionId ? q : x);
        else
            state.bank.unshift(q);
        markBankDirty();
        persist();
        byId('questionDialog').close();
        renderBank();
        toast('Pregunta guardada.');
    };
    const shuffle = FolioExams.shuffle;
    function questionHTML(q, i, options = q.options) { return `<p><b>${i}. ${escapeHTML(q.text).replace(/\n/g, '<br>')}</b></p><p>${options.map((o, j) => `${String.fromCharCode(65 + j)}) ${escapeHTML(o.text).replace(/\n/g, '<br>')}`).join('<br>')}</p>`; }
    byId('insertQuestion').onclick = () => {
        byId('pickList').replaceChildren();
        if (!state.bank.length)
            byId('pickList').textContent = 'Aún no hay preguntas en el banco.';
        for (const q of state.bank) {
            const b = document.createElement('button');
            b.className = 'pickrow';
            b.textContent = q.text + ' · ' + q.topic;
            b.onclick = () => { byId('pickDialog').close(); insert(questionHTML(q, 1)); };
            byId('pickList').append(b);
        }
        byId('pickDialog').showModal();
    };
    function candidates() { return state.bank.filter(q => !byId('examDifficulty').value || q.difficulty === byId('examDifficulty').value); }
    function renderWeights() {
        const ts = topics(candidates()), container = byId('weights');
        container.classList.toggle('hidden', byId('distribution').value !== 'weighted');
        container.replaceChildren();
        if (!ts.length) {
            container.textContent = 'No hay temas disponibles.';
            return;
        }
        if (ts.some(t => !(t in weights)) || Object.keys(weights).some(t => !ts.includes(t))) {
            weights = Object.fromEntries(ts.map((t, i) => [t, Math.floor(100 / ts.length) + (i < 100 % ts.length ? 1 : 0)]));
        }
        for (const t of ts) {
            const row = document.createElement('div');
            row.className = 'weightrow';
            row.innerHTML = `<span>${escapeHTML(t)}</span><input type="number" min="0" max="100" step="1" value="${weights[t]}" aria-label="Porcentaje de ${escapeHTML(t)}">`;
            row.querySelector('input').oninput = ev => { weights[t] = Number(ev.target.value); updateExam(); };
            container.append(row);
        }
    }
    function planExam() {
        return FolioExams.plan(candidates(), byId('examN').value, byId('distribution').value, weights);
    }
    function updateExam() {
        const p = planExam();
        byId('examAvailability').textContent = `${p.pool.length} preguntas disponibles con los filtros actuales.`;
        byId('examDetails').innerHTML = p.alloc ? p.alloc.map(x => `<div class="summaryline"><span>${escapeHTML(x.topic)}</span><b>${x.n} / ${x.available}</b></div>`).join('') : '';
        if (p.error)
            byId('examDetails').insertAdjacentHTML('beforeend', `<p class="error" style="color:#b33f3f">${escapeHTML(p.error)}</p>`);
        else
            byId('examDetails').insertAdjacentHTML('beforeend', `<div class="summaryline"><span>${t('Total de preguntas')}</span><b>${p.n}</b></div><div class="summaryline"><span>${t('Solucionario')}</span><b>${byId('answerKey').checked ? t('Sí') : t('No')}</b></div>`);
        byId('generateExam').disabled = !!p.error;
    }
    for (const id of ['examN', 'examDifficulty', 'distribution', 'shuffleQ', 'shuffleA', 'answerKey'])
        byId(id).addEventListener(id === 'examN' ? 'input' : 'change', () => {
            if (['examDifficulty', 'distribution'].includes(id))
                renderWeights();
            updateExam();
        });
    byId('generateExam').onclick = () => {
        const plan = planExam();
        if (plan.error)
            return toast(plan.error);
        let selected = plan.alloc ? plan.alloc.flatMap(a => shuffle(plan.pool.filter(q => q.topic === a.topic)).slice(0, a.n)) : shuffle(plan.pool).slice(0, plan.n);
        if (byId('shuffleQ').checked)
            selected = shuffle(selected);
        else {
            const order = new Map(state.bank.map((q, i) => [q.id, i]));
            selected.sort((a, b) => order.get(a.id) - order.get(b.id));
        }
        const title = byId('examTitle').value.trim() || t('Examen tipo test'), subject = byId('examSubject').value.trim(), instr = byId('examInstructions').value.trim(), items = selected.map(q => ({ q, options: byId('shuffleA').checked ? shuffle(q.options) : q.options.slice() }));
        let html = `<h1>${escapeHTML(title)}</h1>${subject ? `<p>${escapeHTML(subject)}</p>` : ''}${byId('examIdentity').checked ? `<p>${t('Nombre y apellidos:')} __________________________________</p><p>${t('Fecha:')} ____________________</p>` : ''}${instr ? `<p><i>${escapeHTML(instr).replace(/\n/g, '<br>')}</i></p>` : ''}<hr>` + items.map((x, i) => questionHTML(x.q, i + 1, x.options)).join('');
        if (byId('answerKey').checked) {
            const key = `<h1>${t('Solucionario')} · ${escapeHTML(title)}</h1>` + items.map((x, i) => { const j = x.options.findIndex(o => o.id === x.q.correct); return `<p><b>${i + 1}. ${String.fromCharCode(65 + j)})</b> ${escapeHTML(x.options[j].text)}${x.q.explanation ? `<br><i>${escapeHTML(x.q.explanation)}</i>` : ''}</p>`; }).join('');
            state.docs.unshift(newDocument(title + ' · ' + t('Solucionario'), key));
        }
        addDoc(newDocument(title, html));
        toast('Examen generado. Si cambias el orden o las respuestas manualmente, revisa el solucionario.');
    };
    function renderTabs() {
        const box = byId('documentTabs');
        box.replaceChildren();
        for (const id of openTabs) {
            const d = state.docs.find(x => x.id === id);
            if (!d)
                continue;
            const row = document.createElement('div');
            row.className = 'document-tab' + (id === state.active ? ' active' : '');
            const b = document.createElement('button');
            b.className = 'tabname';
            b.textContent = d.title;
            b.title = d.path || d.title;
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-selected', String(id === state.active));
            b.onclick = () => {
                if (state.active === id && currentView === 'editor')
                    return;
                activateDocument(id);
            };
            const c = document.createElement('button');
            c.className = 'tabclose';
            c.textContent = '×';
            c.title = 'Cerrar pestaña (el documento queda guardado en el espacio de trabajo)';
            c.onclick = () => {
                saveEditor();
                const i = openTabs.indexOf(id);
                openTabs.splice(i, 1);
                if (state.active === id) {
                    if (!openTabs.length) {
                        const n = newDocument();
                        state.docs.unshift(n);
                        openTabs.push(n.id);
                    }
                    state.active = openTabs[Math.max(0, i - 1)];
                    touchDocument(active());
                    loadEditor();
                }
                renderDocs();
                persist();
            };
            row.append(b, c);
            box.append(row);
        }
    }
    let fileBusy = false;
    const openHandles = new Map();
    async function saveFile(as = false) {
        if (fileBusy)
            return;
        fileBusy = true;
        const d = active();
        try {
            saveEditor();
            const doc = { version: 1, title: d.title, html: cleanHTML(d.html), settings: d.settings };
            const suggested = fileName(d.path || d.title).replace(/\.folio$/i, '') + '.folio';
            let handle = !as ? openHandles.get(d.id) : null;
            if (!handle && 'showSaveFilePicker' in window) {
                try {
                    handle = await window.showSaveFilePicker({ suggestedName: suggested, types: [{ description: 'Documento Folio', accept: { 'application/json': ['.folio'] } }] });
                }
                catch (err) {
                    if (err.name === 'AbortError')
                        return;
                    throw err;
                }
            }
            await flushWorkspace();
            if (handle) {
                const writable = await handle.createWritable();
                await writable.write(JSON.stringify(doc, null, 2));
                await writable.close();
                openHandles.set(d.id, handle);
                d.path = handle.name;
            }
            else {
                let name = suggested;
                if (as) {
                    const renamed = prompt('Nombre de archivo (.folio)', suggested);
                    if (renamed === null)
                        return;
                    name = fileName(renamed).replace(/\.folio$/i, '') + '.folio';
                }
                download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), name);
                d.path = name;
            }
            renderDocs();
            persist();
            toast('Documento exportado: ' + d.path);
        }
        catch (err) {
            toast(err.message);
        }
        finally {
            fileBusy = false;
        }
    }
    byId('saveDoc').onclick = async () => {
        try {
            await flushWorkspace();
            toast('Guardado en este navegador. Usa «Guardar como» para obtener un archivo.');
        }
        catch (err) {
            toast(err.message);
        }
    };
    byId('saveAs').onclick = () => saveFile(true);
    byId('openDoc').onclick = () => byId('fileDoc').click();
    byId('fileDoc').onchange = async (ev) => {
        const f = ev.target.files[0];
        ev.target.value = '';
        if (!f)
            return;
        if (f.size > 15 * 1024 * 1024) {
            toast('Documento superior a 15 MB.');
            return;
        }
        try {
            let doc;
            if (/\.folio$/i.test(f.name)) {
                doc = JSON.parse(await f.text());
                if (typeof doc.html !== 'string' || typeof doc.title !== 'string')
                    throw Error('Documento .folio no válido');
            }
            else if (/\.html?$/i.test(f.name))
                doc = { html: (await f.text()).replace(/<script[\s\S]*?<\/script>/gi, ''), title: f.name.replace(/\.html?$/i, '') };
            else if (/\.txt$/i.test(f.name))
                doc = { html: '<p>' + escapeHTML(await f.text()).replace(/\r?\n/g, '<br>') + '</p>', title: f.name.replace(/\.txt$/i, '') };
            else
                throw Error('Formato no compatible: importa .folio, .html o .txt');
            const d = { ...newDocument(doc.title, cleanHTML(doc.html)), path: f.name, settings: { ...defaults, ...doc.settings } };
            addDoc(d);
            toast('Documento abierto: ' + f.name);
        }
        catch (err) {
            toast(err.message);
        }
    };
    document.addEventListener('keydown', ev => {
        if (currentView === 'editor' && ev.ctrlKey && !ev.altKey && ev.key.toLowerCase() === 's') {
            ev.preventDefault();
            if (ev.shiftKey)
                saveFile(true);
            else
                flushWorkspace().catch(err => toast(err.message));
        }
        if (ev.ctrlKey && !ev.altKey && ev.key.toLowerCase() === 'o') {
            ev.preventDefault();
            byId('openDoc').click();
        }
    });
    function validQuestion(q) { return q && typeof q.text === 'string' && q.text.trim() && typeof q.topic === 'string' && q.topic.trim() && ['Fácil', 'Media', 'Difícil'].includes(q.difficulty) && Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 10 && q.options.every(o => o && typeof o.id === 'string' && typeof o.text === 'string' && o.text.trim()) && new Set(q.options.map(o => o.id)).size === q.options.length && q.options.some(o => o.id === q.correct); }
    function normalizeQuestion(q) { return { id: createId(), text: q.text, topic: q.topic, difficulty: q.difficulty, options: q.options.map(o => ({ id: o.id, text: o.text })), correct: q.correct, explanation: typeof q.explanation === 'string' ? q.explanation : '' }; }
    function jsonDownload(data, name) { download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name); }
    byId('exportBank').onclick = () => jsonDownload({ version: 1, questions: state.bank }, 'folio-banco.json');
    byId('importBank').onclick = () => byId('fileBank').click();
    let pendingImport = [];
    const IMPORT_PAGE_SIZE = 40;
    let importPage = 0, importWarning = '';
    const IMPORT_DIFFICULTIES = ['Fácil', 'Media', 'Difícil'];
    // Each pending question owns its own metadata. Rebuilding a paginated page
    // never destroys previously edited topic/difficulty values.
    function renderImportPage() {
        const begin = importPage * IMPORT_PAGE_SIZE, end = Math.min(pendingImport.length, begin + IMPORT_PAGE_SIZE);
        byId('importPageState').textContent = `${begin + 1}–${end} de ${pendingImport.length}`;
        byId('importPrevious').disabled = begin === 0;
        byId('importNext').disabled = end >= pendingImport.length;
        byId('importList').replaceChildren();
        for (let i = begin; i < end; i++) {
            const q = pendingImport[i], row = document.createElement('section');
            row.className = 'import-item';
            const title = document.createElement('p');
            title.className = 'questiontext';
            title.setAttribute('data-no-translate', '');
            title.textContent = `${i + 1}. ${q.text}`;
            const evidence = document.createElement('p');
            evidence.className = 'evidence' + (q.answer < 0 ? ' uncertain' : '');
            evidence.textContent = q.evidence || 'Respuesta no identificada: selecciona una opción.';
            const include = document.createElement('label'), chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = !!q.include;
            include.append(chk, ' Incluir esta pregunta');
            chk.onchange = () => q.include = chk.checked;
            row.append(title, evidence, include);
            const metadata = document.createElement('div');
            metadata.className = 'import-metadata';
            const topicLabel = document.createElement('label');
            topicLabel.textContent = 'Tema';
            const topicInput = document.createElement('input');
            topicInput.type = 'text';
            topicInput.className = 'import-question-topic';
            topicInput.setAttribute('aria-label', `Tema de la pregunta ${i + 1}`);
            topicInput.setAttribute('list', 'topicList');
            topicInput.maxLength = 180;
            topicInput.value = q.topic || '';
            topicInput.oninput = () => { q.topic = topicInput.value; topicInput.setCustomValidity(''); };
            topicLabel.append(topicInput);
            const difficultyLabel = document.createElement('label');
            difficultyLabel.textContent = 'Dificultad';
            const difficultySelect = document.createElement('select');
            difficultySelect.className = 'import-question-difficulty';
            difficultySelect.setAttribute('aria-label', `Dificultad de la pregunta ${i + 1}`);
            for (const level of IMPORT_DIFFICULTIES) {
                const opt = document.createElement('option');
                opt.value = level;
                opt.textContent = level;
                difficultySelect.append(opt);
            }
            difficultySelect.value = q.difficulty;
            difficultySelect.onchange = () => q.difficulty = difficultySelect.value;
            difficultyLabel.append(difficultySelect);
            metadata.append(topicLabel, difficultyLabel);
            row.append(metadata);
            for (const [j, o] of q.options.entries()) {
                const label = document.createElement('label'), radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'import-' + i;
                radio.checked = q.answer === j;
                radio.onchange = () => { q.answer = j; q.include = true; q.evidence = 'Respuesta confirmada manualmente'; q.confidence = 'high'; chk.checked = true; evidence.textContent = q.evidence; evidence.classList.remove('uncertain'); };
                const t = document.createElement('span');
                t.className = 'import-option';
                t.setAttribute('data-no-translate', '');
                t.textContent = String.fromCharCode(65 + j) + ') ' + o;
                label.append(radio, t);
                row.append(label);
            }
            byId('importList').append(row);
        }
    }
    function showImport(items, warning = '') {
        pendingImport = items;
        importPage = 0;
        importWarning = warning;
        const defaultTopic = byId('importTopic').value.trim() || 'Importado';
        const defaultDifficulty = byId('importDifficulty').value;
        for (const q of items) {
            q.topic = typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : defaultTopic;
            q.difficulty = IMPORT_DIFFICULTIES.includes(q.difficulty) ? q.difficulty : defaultDifficulty;
            q.include = q.answer >= 0;
        }
        const direct = items.filter(x => x.answer >= 0).length;
        byId('importSummary').textContent = `${items.length} preguntas detectadas · ${direct} con respuesta propuesta · ${items.length - direct} pendientes. ${warning}`;
        renderImportPage();
        byId('importDialog').showModal();
    }
    byId('importPrevious').onclick = () => { importPage = Math.max(0, importPage - 1); renderImportPage(); };
    byId('importNext').onclick = () => { importPage = Math.min(Math.ceil(pendingImport.length / IMPORT_PAGE_SIZE) - 1, importPage + 1); renderImportPage(); };
    byId('importApplyAll').onclick = () => {
        const topic = byId('importTopic').value.trim(), difficulty = byId('importDifficulty').value;
        if (!topic)
            return toast('Indica un tema para la asignación masiva.');
        if (!IMPORT_DIFFICULTIES.includes(difficulty))
            return toast('Dificultad no válida.');
        for (const q of pendingImport) {
            q.topic = topic;
            q.difficulty = difficulty;
        }
        renderImportPage();
        toast(`Tema y dificultad aplicados a ${pendingImport.length} preguntas. Puedes personalizarlos individualmente.`);
    };
    byId('importConfirm').onclick = () => {
        const existing = new Set(state.bank.map(q => q.text.trim().toLowerCase()));
        const invalid = pendingImport.findIndex(q => q.include && q.answer >= 0 && q.answer < q.options.length && !existing.has(q.text.trim().toLowerCase()) && (!q.topic?.trim() || !IMPORT_DIFFICULTIES.includes(q.difficulty)));
        if (invalid >= 0) {
            importPage = Math.floor(invalid / IMPORT_PAGE_SIZE);
            renderImportPage();
            byId('importList').querySelectorAll('.import-question-topic')[invalid % IMPORT_PAGE_SIZE]?.focus();
            return toast(`Revisa el tema y la dificultad de la pregunta ${invalid + 1}.`);
        }
        let n = 0, skipped = 0;
        for (const q of pendingImport) {
            if (!q.include || q.answer < 0 || q.answer >= q.options.length || existing.has(q.text.trim().toLowerCase())) {
                skipped++;
                continue;
            }
            const options = q.options.map(text => ({ id: createId(), text }));
            state.bank.push({ id: createId(), text: q.text, topic: q.topic.trim(), difficulty: q.difficulty, options, correct: options[q.answer].id, explanation: q.explanation || '' });
            existing.add(q.text.trim().toLowerCase());
            n++;
        }
        if (n)
            markBankDirty();
        persist();
        renderBank();
        byId('importDialog').close();
        toast(`${n} preguntas importadas · ${skipped} omitidas.`);
    };
    byId('fileBank').onchange = async (ev) => {
        const f = ev.target.files[0];
        ev.target.value = '';
        if (!f)
            return;
        const button = byId('importBank');
        button.disabled = true;
        button.textContent = 'Analizando…';
        try {
            if (f.size > 32 * 1024 * 1024)
                throw Error('El archivo supera 32 MB.');
            let items = [], warning = '';
            if (/\.json$/i.test(f.name)) {
                const data = JSON.parse(await f.text()), qs = Array.isArray(data) ? data : data.questions;
                if (!Array.isArray(qs) || !qs.every(validQuestion))
                    throw Error('Formato JSON de Folio no válido.');
                items = qs.map(q => ({ text: q.text, options: q.options.map(o => o.text), answer: q.options.findIndex(o => o.id === q.correct), topic: q.topic, difficulty: q.difficulty, explanation: q.explanation, evidence: 'Respuesta del archivo JSON' }));
            }
            else if (/\.(html?|txt|csv)$/i.test(f.name)) {
                items = FolioImport.parseFile(await f.text(), f.name);
            }
            else {
                const data = await FolioBinaryImport.parse(f);
                items = FolioImport.parseLines(data.lines || []);
                warning = data.warning || '';
            }
            if (!items.length)
                throw Error('No se encontraron preguntas con opciones reconocibles. ' + warning);
            showImport(items, warning);
        }
        catch (err) {
            toast(err.message);
        }
        finally {
            button.disabled = false;
            button.textContent = 'Importar banco';
        }
    };
    byId('backup').onclick = () => { saveEditor(); jsonDownload({ version: 2, exportedAt: new Date().toISOString(), ...state }, 'folio-espacio.json'); };
    byId('restore').onclick = () => byId('fileBackup').click();
    async function backupsRequest(path, method = 'GET', body) {
        if (path === '' && method === 'GET')
            return { backups: await FolioStore.listBackups() };
        if (path === '/create' && method === 'POST')
            return FolioStore.createBackup('Manual');
        if (path === '/restore' && method === 'POST')
            return FolioStore.restoreBackup(body.name);
        throw Error('Operación de recuperación no admitida');
    }
    const recoveryDialog = byId('recoveryDialog'), backupItems = byId('backupItems'), backupStatus = byId('backupStatus');
    function readableDate(s) {
        try {
            return new Date(s).toLocaleString(FolioI18n.language === 'en' ? 'en-GB' : 'es-ES');
        }
        catch {
            return s;
        }
    }
    async function listRecovery() {
        backupItems.replaceChildren();
        backupStatus.textContent = 'Cargando copias locales…';
        const { backups } = await backupsRequest('');
        backupStatus.textContent = `${backups.length} copias en IndexedDB de este navegador · se conservan hasta 24`;
        if (!backups.length) {
            backupItems.textContent = 'Todavía no hay copias. Puedes crear una ahora.';
            return;
        }
        for (const item of backups) {
            const row = document.createElement('div');
            row.className = 'recovery-item';
            const details = document.createElement('div');
            details.textContent = readableDate(item.created);
            const size = document.createElement('small');
            size.textContent = (item.size / 1024).toFixed(0) + ' KB';
            details.append(size);
            const restoreButton = document.createElement('button');
            restoreButton.className = 'outline';
            restoreButton.textContent = 'Restaurar';
            restoreButton.onclick = async () => {
                if (!confirm('¿Restaurar los documentos y preguntas de ' + readableDate(item.created) + '? Se guardará antes una copia del estado actual.'))
                    return;
                restoreButton.disabled = true;
                try {
                    await flushWorkspace();
                    await backupsRequest('/restore', 'POST', { name: item.name });
                    recoveryDialog.close();
                    location.reload();
                }
                catch (err) {
                    restoreButton.disabled = false;
                    toast(err.message);
                }
            };
            row.append(details, restoreButton);
            backupItems.append(row);
        }
    }
    byId('backupHistory').onclick = async () => {
        recoveryDialog.showModal();
        try {
            await listRecovery();
        }
        catch (err) {
            backupStatus.textContent = err.message;
        }
    };
    byId('createRecovery').onclick = async () => {
        const btn = byId('createRecovery');
        btn.disabled = true;
        try {
            await flushWorkspace();
            await backupsRequest('/create', 'POST');
            await listRecovery();
            toast('Punto de recuperación creado.');
        }
        catch (err) {
            toast(err.message);
        }
        finally {
            btn.disabled = false;
        }
    };
    byId('closeRecovery').onclick = () => recoveryDialog.close();
    byId('fileBackup').onchange = async (ev) => {
        const f = ev.target.files[0];
        ev.target.value = '';
        if (!f)
            return;
        try {
            const x = JSON.parse(await f.text());
            if (!Array.isArray(x.docs) || !x.docs.length || !x.docs.every(d => d && typeof d.title === 'string' && typeof d.html === 'string') || !Array.isArray(x.bank) || !x.bank.every(validQuestion))
                throw Error('Archivo de copia inválido.');
            if (!confirm('¿Reemplazar los documentos y preguntas actuales con esta copia?'))
                return;
            await flushWorkspace();
            await backupsRequest('/create', 'POST');
            state = { docs: x.docs.map(d => ({ id: createId(), title: d.title, html: cleanHTML(d.html), settings: { ...defaults, ...d.settings }, updated: Number(d.updated) || Date.now(), lastOpened: Number(d.lastOpened) || 0 })), bank: x.bank.map(normalizeQuestion) };
            state.active = state.docs[0].id;
            openTabs = state.docs.map(d => d.id);
            state.openTabs = openTabs;
            markBankDirty();
            loadEditor();
            renderBank();
            showView('editor');
            persist();
            toast('Copia restaurada.');
        }
        catch (err) {
            toast(err.message);
        }
    };
    document.addEventListener('folio:languagechange', () => {
        const examTitle = byId('examTitle');
        if (['Examen tipo test', 'Multiple-choice exam'].includes(examTitle.value))
            examTitle.value = t('Examen tipo test');
        const instructions = byId('examInstructions');
        if (['Seleccione una única respuesta correcta por pregunta.', 'Choose one correct answer per question.'].includes(instructions.value))
            instructions.value = t('Seleccione una única respuesta correcta por pregunta.');
        renderDocs();
        renderBank();
        wordCount();
        if (currentView === 'exam') updateExam();
        if (!byId('recoveryDialog').open) return;
        listRecovery().catch(console.warn);
    });
    touchDocument(active());
    loadEditor();
    renderBank();
    if (FolioI18n.language === 'en') {
        byId('examTitle').value = t('Examen tipo test');
        byId('examInstructions').value = t('Seleccione una única respuesta correcta por pregunta.');
    }
    persist();
    byId('download').textContent = t('Imprimir / PDF');
    byId('preview').textContent = t('Ver páginas');
    byId('engineState').textContent = t('100 % local · IndexedDB');
    if (storageError)
        toast('Almacenamiento IndexedDB no disponible: ' + storageError.message);
    else
        saveQueue.then(() => FolioStore.backupIfDue()).catch(err => console.warn('Copia automática:', err));
})();

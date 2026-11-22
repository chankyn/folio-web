'use strict';
const FolioImport = (() => {
    const normalize = s => String(s || '').replace(/\u00a0/g, ' ').trim();
    function marker(t) { const n = normalize(t); let marked = /^(?:[✓✔☑☒●◉⦿★*]|\[x\])\s*/i.test(n) || /(?:\s+[✓✔☑☒★]|\s*\[(?:correcta?|correct|x)\]|\s*\((?:correcta?|correct)\))\s*$/i.test(n); return { marked, text: n.replace(/^(?:[✓✔☑☒●◉⦿★*]|\[x\])\s*/i, '').replace(/(?:\s+[✓✔☑☒★]|\s*\[(?:correcta?|correct|x)\]|\s*\((?:correcta?|correct)\))\s*$/i, '').trim() }; }
    function parseLines(lines) {
        const out = [], raws = lines.map(x => typeof x === 'string' ? { text: x } : x);
        const keyMap = new Map();
        let inKey = false;
        for (const row of raws) {
            const t = normalize(row.text);
            if (/^(?:solucionario|plantilla de respuestas|clave de respuestas|answer key|soluciones|respuestas correctas)\b\s*[:\-]?/i.test(t))
                inKey = true;
            if (!inKey)
                continue;
            const pairs = [...t.matchAll(/(?:^|[\s,;])(?:pregunta\s*)?(\d{1,5})\s*[.)\-:]?\s*[-:=]\s*([A-J])(?=$|[\s,;])/gi)];
            for (const m of pairs)
                keyMap.set(Number(m[1]), m[2].toUpperCase());
        }
        let q = null;
        function finish() {
            if (!q)
                return;
            if (q.text && q.options.length >= 2 && q.options.length <= 10) {
                let ranking = q.marks.map((marks, i) => ({ i, score: Math.max(...marks.map(x => x.score), 0), why: marks.map(x => x.why).join(', ') })).sort((a, b) => b.score - a.score), chosen = null, conflict = !!q.conflict;
                const key = q.key || keyMap.get(q.number);
                if (key) {
                    const i = q.labels.indexOf(key);
                    if (i >= 0) {
                        if (ranking[0]?.score >= 70 && ranking[0].i !== i)
                            conflict = true;
                        else
                            chosen = { i, score: 100, why: 'Clave explícita del documento' };
                    }
                }
                else if (ranking[0]?.score >= 42 && (ranking[1]?.score || 0) < ranking[0].score - 15)
                    chosen = ranking[0];
                const confidence = conflict || !chosen ? 'review' : chosen.score >= 80 ? 'high' : 'medium';
                out.push({ text: q.text.trim(), options: q.options, answer: chosen && !conflict ? chosen.i : -1, confidence, evidence: conflict ? 'Marcas contradictorias: confirma manualmente' : chosen ? 'Propuesta (' + (confidence === 'high' ? 'alta' : 'media') + '): ' + chosen.why : 'No hay una respuesta marcada inequívocamente. Revisión necesaria.' });
            }
            q = null;
        }
        function optSignals(r, marked) {
            const signals = [];
            if (marked)
                signals.push({ score: 95, why: 'Símbolo de respuesta correcta' });
            if (r.mark)
                signals.push({ score: 90, why: typeof r.mark === 'string' ? r.mark : 'Marca gráfica' });
            if (r.color)
                signals.push({ score: 75, why: 'Color distintivo' });
            if (r.highlight)
                signals.push({ score: 75, why: 'Resaltado' });
            if (r.bold)
                signals.push({ score: 45, why: 'Negrita distintiva' });
            if (r.underline)
                signals.push({ score: 42, why: 'Subrayado distintivo' });
            return signals;
        }
        function pushOption(letter, text, signals) { if (q.labels.includes(letter)) {
            q.conflict = true;
            return;
        } q.labels.push(letter); q.options.push(text); q.marks.push(signals); }
        for (const r of raws) {
            let t = normalize(r.text);
            if (!t)
                continue;
            if (/^(?:solucionario|plantilla de respuestas|clave de respuestas|answer key|soluciones|respuestas correctas)\b/i.test(t)) {
                finish();
                break;
            }
            const initial = marker(t);
            t = initial.text;
            const key = t.match(/^(?:respuesta(?:\s+correcta)?|soluci[oó]n|correct\s+answer|answer\s+key|answer|clave)\s*[:=]\s*([A-J])\b/i);
            if (key && q) {
                q.key = key[1].toUpperCase();
                continue;
            }
            const question = t.match(/^(?:(?:pregunta|question)\s+)?(\d{1,5})\s*[).:\-]\s*(.*)$/i) || t.match(/^(?:pregunta|question)\s+(\d{1,5})\s+(.*)$/i);
            if (question) {
                finish();
                q = { number: Number(question[1]), text: question[2], options: [], labels: [], marks: [], key: null };
                continue;
            }
            // Word/PDF exports often put several labelled choices in the same paragraph.
            const matches = [...t.matchAll(/(?:^|\s)([A-J])\s*[).:]\s*/gi)];
            if (q && matches.length >= 2) {
                for (let i = 0; i < matches.length; i++) {
                    const start = matches[i].index + matches[i][0].length, end = i + 1 < matches.length ? matches[i + 1].index : t.length;
                    const m = marker(t.slice(start, end));
                    // A common line-level color is not evidence that every option is correct.
                    pushOption(matches[i][1].toUpperCase(), m.text, optSignals({}, m.marked));
                }
                continue;
            }
            const option = t.match(/^([A-J])\s*[).:\-]\s*(.+)$/i);
            if (option && q) {
                const m = marker(option[2]);
                pushOption(option[1].toUpperCase(), m.text, optSignals(r, initial.marked || m.marked));
                continue;
            }
            if (!q && /^¿|^\w.{8,}\?$/.test(t)) {
                q = { number: NaN, text: t, options: [], labels: [], marks: [], key: null };
                continue;
            }
            if (q) {
                if (q.options.length) {
                    const i = q.options.length - 1;
                    q.options[i] += ' ' + t;
                    if (r.mark)
                        q.marks[i].push({ score: 90, why: String(r.mark) });
                    if (r.color || r.highlight)
                        q.marks[i].push({ score: 75, why: 'Color o resaltado' });
                }
                else
                    q.text += (q.text ? ' ' : '') + t;
            }
        }
        finish();
        return out;
    }
    function parseCSV(text) { let sep = text.split(/\r?\n/)[0].includes(';') ? ';' : ','; let rows = [], row = [], s = '', quoted = false; for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (quoted && text[i + 1] === '"') {
                s += '"';
                i++;
            }
            else
                quoted = !quoted;
        }
        else if (!quoted && c === sep) {
            row.push(s);
            s = '';
        }
        else if (!quoted && (c === '\n' || c === '\r')) {
            if (c === '\r' && text[i + 1] === '\n')
                i++;
            row.push(s);
            rows.push(row);
            row = [];
            s = '';
        }
        else
            s += c;
    } if (s || row.length) {
        row.push(s);
        rows.push(row);
    } if (!rows.length)
        return []; const h = rows.shift().map(x => normalize(x).toLowerCase()); let qi = h.findIndex(x => /^(pregunta|enunciado|question|text)$/.test(x)), ki = h.findIndex(x => /^(correcta|respuesta correcta|correct|answer|solución)$/.test(x)), ti = h.findIndex(x => /^(tema|topic|categor[ií]a)$/.test(x)), di = h.findIndex(x => /^(dificultad|difficulty|nivel)$/.test(x)), oi = h.map((x, i) => /^(?:opci[oó]n\s*|respuesta\s*|option\s*)?[a-j1-9]$/.test(x) ? i : -1).filter(i => i >= 0); if (qi < 0 || oi.length < 2)
        throw Error('CSV: incluye columnas pregunta, A, B, C, D y correcta (letra).'); return rows.filter(r => normalize(r[qi])).map(r => { const options = oi.map(i => normalize(r[i])), k = normalize(r[ki]).toUpperCase(); let answer = /^[A-J]$/.test(k) ? k.charCodeAt(0) - 65 : options.findIndex(x => x.toUpperCase() === k); if (answer >= options.length)
        answer = -1; const rawDifficulty = di >= 0 ? normalize(r[di]) : ''; const difficulty = { 'facil': 'Fácil', 'fácil': 'Fácil', 'easy': 'Fácil', 'media': 'Media', 'medio': 'Media', 'medium': 'Media', 'difícil': 'Difícil', 'dificil': 'Difícil', 'hard': 'Difícil' }[rawDifficulty.toLowerCase()]; return { text: normalize(r[qi]), options, answer, topic: ti >= 0 ? normalize(r[ti]) : '', difficulty, evidence: answer >= 0 ? 'Clave CSV' : 'Clave no identificada' }; }).filter(q => q.options.every(Boolean)); }
    function parseHTML(html) { const d = new DOMParser().parseFromString(html, 'text/html'); d.querySelectorAll('script,style,iframe,object,svg').forEach(x => x.remove()); const lines = []; function walk(el) { if (el.nodeType !== 1)
        return; const tag = el.tagName; if (['P', 'LI', 'TD', 'H1', 'H2', 'H3', 'H4', 'DIV', 'TR'].includes(tag) && !el.querySelector('p,li,td,h1,h2,h3,h4,div,tr')) {
        const clones = [el, ...el.querySelectorAll('*')];
        let bold = clones.some(x => ['B', 'STRONG'].includes(x.tagName) || /bold|[7-9]00/.test(x.style.fontWeight)), color = clones.some(x => { let c = x.style.color || x.getAttribute('color') || ''; return c && !/^(black|#000(?:000)?|rgb\(0,\s*0,\s*0\))$/i.test(c); }), highlight = clones.some(x => x.tagName === 'MARK' || x.style.backgroundColor && x.style.backgroundColor !== 'transparent');
        const clone = el.cloneNode(true);
        clone.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
        for (const t of clone.textContent.split('\n'))
            lines.push({ text: t, bold, color, highlight });
        return;
    } for (const c of el.children)
        walk(c); } walk(d.body); if (!lines.length)
        return parseLines(d.body.textContent.split(/\r?\n/)); return parseLines(lines); }
    function parseFile(text, name) { if (/\.csv$/i.test(name))
        return parseCSV(text); if (/\.html?$/i.test(name))
        return parseHTML(text); return parseLines(text.replace(/^\ufeff/, '').split(/\r?\n/)); }
    return { parseLines, parseFile };
})();
if (typeof module !== 'undefined')
    module.exports = FolioImport;

'use strict';
// Read-only A4 paginated layout. Editing remains a continuous, contenteditable document;
// this preview measures browser layout and splits long text paragraphs preserving inline markup.
const FolioPages = (() => {
    const size = s => { let pair = s.paper === 'letter' ? [816, 1056] : [794, 1123]; return s.orientation === 'landscape' ? pair.reverse() : pair; };
    function paginate(editor, settings, container) {
        container.replaceChildren();
        const [w, h] = size(settings), pad = (Number(settings.margin) || 2.5) * 37.795, innerW = w - pad * 2, innerH = h - pad * 2;
        const baseStyle = getComputedStyle(editor), font = baseStyle.fontFamily, fs = baseStyle.fontSize, line = baseStyle.lineHeight;
        const measure = document.createElement('div');
        measure.className = 'folio-page-body page-measure';
        measure.style.cssText = `position:fixed;left:-99999px;top:0;visibility:hidden;width:${innerW}px;height:auto;box-sizing:border-box;font-family:${font};font-size:${fs};line-height:${line};`;
        document.body.append(measure);
        let page = null, content = null, pages = 0, remaining = innerH;
        function newPage() { page = document.createElement('article'); page.className = 'folio-preview-page'; page.style.cssText = `width:${w}px;height:${h}px;padding:${pad}px;`; content = document.createElement('div'); content.className = 'folio-page-body'; content.style.cssText = `height:${innerH}px;font-family:${font};font-size:${fs};line-height:${line};`; page.append(content); container.append(page); pages++; if (settings.pageNumbers !== false) {
            const footer = document.createElement('span');
            footer.className = 'folio-page-number';
            footer.textContent = String(pages);
            page.append(footer);
        } remaining = innerH; }
        function height(node) { measure.replaceChildren(node.cloneNode(true)); const children = measure.firstChild; const computed = children && children.nodeType === 1 ? getComputedStyle(children) : null; const margin = computed ? (parseFloat(computed.marginTop) || 0) + (parseFloat(computed.marginBottom) || 0) : 0; return (children?.getBoundingClientRect().height || 0) + margin + 1; }
        function add(el) { const cost = height(el); content.append(el); remaining = Math.max(0, remaining - cost); }
        function slice(el, start, end) { const clone = el.cloneNode(false), range = document.createRange(), walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let off = 0, first = null, last = null, n; while (n = walker.nextNode()) {
            const len = n.nodeValue.length;
            if (!first && off + len > start)
                first = { n, at: start - off };
            if (off + len >= end) {
                last = { n, at: end - off };
                break;
            }
            off += len;
        } if (!first || !last)
            return null; range.setStart(first.n, Math.max(0, first.at)); range.setEnd(last.n, Math.min(last.n.nodeValue.length, last.at)); clone.append(range.cloneContents()); return clone; }
        function splitText(el) { const t = el.textContent || ''; if (t.length < 2 || !el.querySelectorAll || t.length > 70000)
            return false; let pos = 0, count = 0; while (pos < t.length && count++ < 200) {
            if (remaining < 30)
                newPage();
            let lo = pos + 1, hi = t.length, fit = pos;
            while (lo <= hi) {
                let mid = (lo + hi) >> 1;
                const part = slice(el, pos, mid);
                if (part && height(part) <= remaining) {
                    fit = mid;
                    lo = mid + 1;
                }
                else
                    hi = mid - 1;
            }
            if (fit <= pos) {
                newPage();
                if (remaining >= innerH - 2) {
                    const rest = slice(el, pos, t.length);
                    if (rest)
                        add(rest);
                    return true;
                }
                continue;
            }
            if (fit < t.length) {
                let trimmed = fit;
                while (trimmed > pos + 1 && !/\s/.test(t[trimmed - 1]))
                    trimmed--;
                if (trimmed > pos + 8)
                    fit = trimmed;
            }
            const piece = slice(el, pos, fit);
            if (!piece)
                break;
            add(piece);
            pos = fit;
            if (pos < t.length)
                newPage();
        } return pos >= t.length; }
        function place(el) {
            if (el.nodeType === 3) {
                const p = document.createElement('p');
                p.textContent = el.textContent;
                el = p;
            }
            if (el.nodeType !== 1)
                return;
            if (el.getAttribute('data-pagebreak') === '1') {
                if (content.childNodes.length)
                    newPage();
                return;
            }
            const cost = height(el);
            if (cost <= remaining) {
                add(el);
                return;
            }
            if (cost <= innerH) {
                newPage();
                add(el);
                return;
            }
            if (['P', 'DIV', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4'].includes(el.tagName) && splitText(el))
                return;
            if (el.tagName === 'TABLE' && el.rows.length) {
                const table = el.cloneNode(false), tbody = document.createElement('tbody');
                table.append(tbody);
                for (const row of [...el.rows]) {
                    tbody.append(row.cloneNode(true));
                    if (height(table) > remaining) {
                        tbody.lastChild.remove();
                        if (tbody.childNodes.length) {
                            add(table.cloneNode(true));
                            tbody.replaceChildren();
                        }
                        newPage();
                        tbody.append(row.cloneNode(true));
                    }
                }
                if (tbody.childNodes.length)
                    add(table);
                return;
            }
            newPage();
            add(el);
        }
        try {
            newPage();
            for (const child of [...editor.childNodes])
                place(child.cloneNode(true));
            return pages;
        }
        finally {
            measure.remove();
        }
    }
    return { paginate };
})();
if (typeof module !== 'undefined')
    module.exports = FolioPages;

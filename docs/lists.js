'use strict';
// List formatting is attached to the list container, not to individual paragraphs.
// The underlying HTML remains standards-compliant (<ul>/<ol>/<li>) and nested lists are preserved.
const FolioLists = (() => {
    const styles = { disc: 'disc', circle: 'circle', square: 'square', dash: 'dash', arrow: 'arrow', check: 'check', star: 'star', diamond: 'diamond', decimal: 'decimal', 'lower-alpha': 'lower-alpha', 'upper-alpha': 'upper-alpha', 'lower-roman': 'lower-roman', 'upper-roman': 'upper-roman', custom: 'custom' };
    const numbered = new Set(['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman']);
    const glyphs = new Set(['•', '◦', '▪', '–', '—', '→', '➜', '➤', '✓', '✔', '★', '☆', '◆', '◇', '▸', '☑', '·', '*', '-', '+', '!', '?']);
    function safeMarker(value) { let s = Array.from(String(value || '').trim()).slice(0, 3).join(''); if (!s || /[<>{}\\\r\n\t]/u.test(s) || Array.from(s).length > 3)
        return '•'; return s; }
    function safeStyle(style) { return styles[style] || 'disc'; }
    function currentList(editor, sel = window.getSelection()) {
        const n = sel?.anchorNode;
        let el = n?.nodeType === Node.ELEMENT_NODE ? n : n?.parentElement;
        if (!el || !editor.contains(el))
            return null;
        const list = el.closest('ul,ol');
        return list && editor.contains(list) ? list : null;
    }
    function inheritedStyle(list) { const depth = (() => { let d = 0, p = list.parentElement; while (p) {
        if (p.matches?.('ul,ol'))
            d++;
        p = p.parentElement;
    } return d; })(); return list.tagName === 'OL' ? ['decimal', 'lower-alpha', 'lower-roman'][depth % 3] : ['disc', 'circle', 'square', 'dash'][depth % 4]; }
    function setStyle(list, style, custom = '•') {
        if (!list)
            return null;
        const safe = safeStyle(style), want = numbered.has(safe) ? 'OL' : 'UL';
        if (list.tagName !== want) {
            const sel = window.getSelection(), anchor = sel?.anchorNode, offset = sel?.anchorOffset || 0, retarget = !!anchor && list.contains(anchor);
            const replacement = document.createElement(want.toLowerCase());
            for (const att of [...list.attributes])
                replacement.setAttribute(att.name, att.value);
            while (list.firstChild)
                replacement.append(list.firstChild);
            list.replaceWith(replacement);
            list = replacement;
            if (retarget && anchor?.isConnected) {
                try {
                    const r = document.createRange();
                    r.setStart(anchor, Math.min(offset, anchor.length ?? anchor.childNodes.length));
                    r.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(r);
                }
                catch { }
            }
        }
        list.setAttribute('data-list-style', safe);
        list.querySelectorAll(':scope > li').forEach(li => { if (safe === 'custom')
            li.setAttribute('data-marker', safeMarker(custom));
        else
            li.removeAttribute('data-marker'); });
        return list;
    }
    function normalize(editor) {
        // Chromium's legacy 'indent' command may produce UL > UL, which HTML parsers
        // silently repair and some serializers drop. Nest it under the previous LI.
        for (const child of [...editor.querySelectorAll('ul > ul,ul > ol,ol > ul,ol > ol')]) {
            const sel = window.getSelection(), anchor = sel?.anchorNode, offset = sel?.anchorOffset || 0, retarget = anchor && child.contains(anchor);
            let parent = child.previousElementSibling;
            if (!parent || parent.tagName !== 'LI') {
                parent = document.createElement('li');
                child.before(parent);
            }
            parent.append(child);
            if (retarget && anchor?.isConnected) {
                try {
                    const r = document.createRange();
                    r.setStart(anchor, Math.min(offset, anchor.length ?? anchor.childNodes.length));
                    r.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(r);
                }
                catch { }
            }
        }
        for (const list of editor.querySelectorAll('ul,ol')) {
            const style = list.getAttribute('data-list-style');
            if (!styles[style])
                setStyle(list, inheritedStyle(list));
            else if (style === 'custom')
                list.querySelectorAll(':scope > li').forEach(li => { if (!li.hasAttribute('data-marker'))
                    li.setAttribute('data-marker', '•'); });
        }
    }
    function apply(editor, selection, style, marker = '•') {
        const list = currentList(editor, selection);
        if (!list)
            return false;
        setStyle(list, style, marker);
        normalize(editor);
        return true;
    }
    function settings(editor) { const list = currentList(editor); return { style: list?.getAttribute('data-list-style') || null, marker: list?.querySelector(':scope > li')?.getAttribute('data-marker') || '•' }; }
    return { styles, numbered, glyphs, safeStyle, safeMarker, currentList, setStyle, normalize, apply, settings };
})();
if (typeof module !== 'undefined')
    module.exports = FolioLists;

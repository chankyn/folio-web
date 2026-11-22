'use strict';
// DOM → LaTeX: only known commands are generated; user text is always escaped.
const FolioLatex = (() => {
    // pdfLaTeX (including older MiKTeX installations) cannot compile many
    // Unicode mathematical signs in ordinary text, tables or imported questions.
    // Always translate such glyphs into actual TeX commands, including when they
    // occur inside a tabularx cell. The symbol is never just removed.
    const textSpecial = Object.freeze({
        '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#',
        '%': '\\%', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
        '\u00a0': '~', '\u202f': '~', '\u200b': '', '\u2060': '', '\ufeff': '', '\r': '', '\n': ' ',
        '√': '\\ensuremath{\\surd}', '∛': '\\ensuremath{\\sqrt[3]{\\vphantom{x}}}',
        '±': '\\ensuremath{\\pm}', '∓': '\\ensuremath{\\mp}',
        '×': '\\ensuremath{\\times}', '÷': '\\ensuremath{\\div}',
        '−': '\\ensuremath{-}', '≠': '\\ensuremath{\\neq}',
        '≤': '\\ensuremath{\\leq}', '≥': '\\ensuremath{\\geq}',
        '≈': '\\ensuremath{\\approx}', '≡': '\\ensuremath{\\equiv}',
        '∞': '\\ensuremath{\\infty}', '∑': '\\ensuremath{\\sum}',
        '∏': '\\ensuremath{\\prod}', '∫': '\\ensuremath{\\int}',
        '∂': '\\ensuremath{\\partial}', '∆': '\\ensuremath{\\Delta}',
        '∇': '\\ensuremath{\\nabla}', '∈': '\\ensuremath{\\in}',
        '∉': '\\ensuremath{\\notin}', '∅': '\\ensuremath{\\varnothing}',
        '∪': '\\ensuremath{\\cup}', '∩': '\\ensuremath{\\cap}',
        '⊂': '\\ensuremath{\\subset}', '⊆': '\\ensuremath{\\subseteq}',
        '⊃': '\\ensuremath{\\supset}', '⊇': '\\ensuremath{\\supseteq}',
        '∀': '\\ensuremath{\\forall}', '∃': '\\ensuremath{\\exists}',
        '→': '\\ensuremath{\\rightarrow}', '←': '\\ensuremath{\\leftarrow}',
        '↔': '\\ensuremath{\\leftrightarrow}', '⇒': '\\ensuremath{\\Rightarrow}',
        '⇐': '\\ensuremath{\\Leftarrow}', '⇔': '\\ensuremath{\\Leftrightarrow}',
        'α': '\\ensuremath{\\alpha}', 'β': '\\ensuremath{\\beta}',
        'γ': '\\ensuremath{\\gamma}', 'δ': '\\ensuremath{\\delta}',
        'ε': '\\ensuremath{\\varepsilon}', 'θ': '\\ensuremath{\\theta}',
        'λ': '\\ensuremath{\\lambda}', 'μ': '\\ensuremath{\\mu}',
        'π': '\\ensuremath{\\pi}', 'ρ': '\\ensuremath{\\rho}',
        'σ': '\\ensuremath{\\sigma}', 'φ': '\\ensuremath{\\varphi}',
        'ω': '\\ensuremath{\\omega}', 'Γ': '\\ensuremath{\\Gamma}',
        'Δ': '\\ensuremath{\\Delta}', 'Σ': '\\ensuremath{\\Sigma}',
        'Ω': '\\ensuremath{\\Omega}', 'ℝ': '\\ensuremath{\\mathbb{R}}',
        'ℕ': '\\ensuremath{\\mathbb{N}}', 'ℤ': '\\ensuremath{\\mathbb{Z}}',
        'ℚ': '\\ensuremath{\\mathbb{Q}}', '•': '\\textbullet{}',
        '◦': '\\ensuremath{\\circ}', '▪': '\\ensuremath{\\blacksquare}',
        '✓': '\\ensuremath{\\checkmark}', '✔': '\\ensuremath{\\checkmark}',
        '★': '\\ensuremath{\\star}', '☆': '\\ensuremath{\\star}',
        '◆': '\\ensuremath{\\blacklozenge}', '◇': '\\ensuremath{\\lozenge}',
        '▸': '\\ensuremath{\\triangleright}', '☑': '\\ensuremath{\\boxtimes}',
        '€': '\\texteuro{}', '£': '\\textsterling{}', '¥': '\\textyen{}',
        '©': '\\textcopyright{}', '®': '\\textregistered{}',
        '°': '\\textdegree{}', '…': '\\ldots{}', '–': '--', '—': '---',
        '“': '``', '”': "''", '‘': '`', '’': "'", '«': '\\guillemotleft{}',
        '»': '\\guillemotright{}', '¿': '¿', '¡': '¡'
    });
    const esc = s => Array.from(String(s)).map(c => Object.hasOwn(textSpecial, c) ? textSpecial[c] : c).join('');
    const clamp = (x, d, l, h) => Number.isFinite(Number(x)) && x !== null ? Math.min(h, Math.max(l, Number(x))) : d;
    function color(s) { if (!s)
        return ''; s = s.trim().toLowerCase(); if (/^#[a-f0-9]{6}$/.test(s))
        return s.slice(1).toUpperCase(); if (/^#[a-f0-9]{3}$/.test(s))
        return [...s.slice(1)].map(x => x + x).join('').toUpperCase(); const m = s.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\s*\)$/); if (m && m.slice(1).every(x => +x <= 255))
        return m.slice(1).map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase(); return { black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '008000', yellow: 'FFFF00' }[s] || ''; }
    function build(html, settings = {}) {
        const doc = new DOMParser().parseFromString(html, 'text/html'), assets = {};
        function render(n, inline = false) {
            if (n.nodeType === 3)
                return esc(n.nodeValue);
            if (n.nodeType !== 1)
                return '';
            const t = n.tagName.toLowerCase(), a = k => n.getAttribute(k) || '', s = n.style || {}, wrap = (cmd, x) => '\\' + cmd + '{' + x + '}', kids = (x = n, i = inline) => Array.from(x.childNodes).map(c => render(c, i)).join('');
            if (['script', 'style', 'iframe', 'object', 'svg', 'template'].includes(t))
                return '';
            if (a('data-pagebreak') === '1')
                return '\n\\newpage\n';
            if (t === 'span' && n.classList.contains('folio-equation')) {
                const tex = a('data-latex');
                return typeof FolioMath !== 'undefined' && FolioMath.validate(tex) ? '\\(' + FolioMath.toLatex(tex) + '\\)' : '\\textit{[Ecuación no admitida]}';
            }
            if (t === 'br')
                return '\\newline{} ';
            if (t === 'hr')
                return '\n\\par\\noindent\\rule{\\linewidth}{0.4pt}\\par\n';
            if (t === 'img') {
                const m = a('src').match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
                if (!m || m[2].length > 4194304 || Object.keys(assets).length >= 20)
                    return '\\textit{[Imagen no compatible]}';
                const name = 'img' + (Object.keys(assets).length + 1) + (m[1] === 'png' ? '.png' : '.jpg');
                assets[name] = m[2];
                const width = /^\d+$/.test(a('width')) ? clamp(+a('width') / 650, .8, .1, 1) : .8;
                return '\n\\par\\noindent\\includegraphics[width=' + width.toFixed(2) + '\\linewidth,height=.75\\textheight,keepaspectratio]{' + name + '}\\par\n';
            }
            if (t === 'ul' || t === 'ol') {
                const env = t === 'ul' ? 'itemize' : 'enumerate', style = a('data-list-style'), label = { disc: '\\textbullet', circle: '$\\circ$', square: '$\\blacksquare$', dash: '--', arrow: '$\\rightarrow$', check: '$\\checkmark$', star: '$\\star$', diamond: '$\\blacklozenge$', decimal: '\\arabic*.', 'lower-alpha': '\\alph*.', 'upper-alpha': '\\Alph*.', 'lower-roman': '\\roman*.', 'upper-roman': '\\Roman*.' };
                const markers = { '•': '\\textbullet', '◦': '$\\circ$', '▪': '$\\blacksquare$', '–': '--', '—': '---', '→': '$\\rightarrow$', '➜': '$\\rightarrow$', '➤': '$\\triangleright$', '✓': '$\\checkmark$', '✔': '$\\checkmark$', '★': '$\\star$', '☆': '$\\star$', '◆': '$\\blacklozenge$', '◇': '$\\lozenge$', '▸': '$\\triangleright$', '☑': '$\\boxtimes$' };
                const parts = Array.from(n.children).filter(c => c.tagName === 'LI').map(c => '\\item ' + kids(c, true));
                if (!parts.length)
                    return '';
                let l = label[style] || '';
                if (style === 'custom') {
                    const marker = n.querySelector(':scope > li')?.getAttribute('data-marker') || '•';
                    l = markers[marker] || (/[A-Za-z0-9!?.+*-]{1,3}/.test(marker) ? esc(marker) : '\\textbullet');
                }
                return '\n\\begin{' + env + '}[leftmargin=*' + (l ? ',label={' + l + '}' : '') + ']\n' + parts.join('\n') + '\n\\end{' + env + '}\n';
            }
            if (t === 'table') {
                const rows = Array.from(n.rows).slice(0, 150), cols = Math.min(12, Math.max(0, ...rows.map(r => r.cells.length)));
                if (!cols)
                    return '';
                return '\n\\par\\smallskip\\noindent\\begin{tabularx}{\\linewidth}{|' + Array(cols).fill('>{\\raggedright\\arraybackslash}X').join('|') + '|}\\hline\n' + rows.map(r => { const v = Array.from(r.cells).slice(0, cols).map(c => { const x = kids(c, true).trim().replaceAll('\\newline{}', ' '); return c.tagName === 'TH' ? wrap('textbf', x) : x; }); while (v.length < cols)
                    v.push(''); return v.join(' & ') + ' \\\\ \\hline'; }).join('\n') + '\n\\end{tabularx}\\par\\smallskip\n';
            }
            let x = kids(n, inline || ['span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'font', 'a', 'sub', 'sup'].includes(t));
            if (['b', 'strong'].includes(t) || ['bold', '700', '800', '900'].includes(s.fontWeight))
                x = wrap('textbf', x);
            if (['i', 'em'].includes(t) || s.fontStyle === 'italic')
                x = wrap('textit', x);
            const dec = (s.textDecoration || '') + ' ' + (s.textDecorationLine || '');
            if (t === 'u' || dec.includes('underline'))
                x = wrap('uline', x);
            if (['s', 'strike', 'del'].includes(t) || dec.includes('line-through'))
                x = wrap('sout', x);
            if (t === 'sup')
                x = wrap('textsuperscript', x);
            if (t === 'sub')
                x = wrap('textsubscript', x);
            const fg = color(s.color || a('color')), bg = color(s.backgroundColor);
            if (fg)
                x = '\\textcolor[HTML]{' + fg + '}{' + x + '}';
            if (bg && x.trim())
                x = '\\colorbox[HTML]{' + bg + '}{' + x + '}';
            const fam = (s.fontFamily || a('face')).toLowerCase();
            if (fam)
                x = '{\\' + (/courier|mono|consolas|lucida console/.test(fam) ? 'ttfamily' : /arial|sans|calibri|aptos|verdana|segoe|tahoma|trebuchet|century gothic|comic sans/.test(fam) ? 'sffamily' : 'rmfamily') + ' ' + x + '}';
            const sz = (s.fontSize || '').match(/^(\d+(?:\.\d+)?)(pt|px)$/);
            let pts = sz ? clamp(+sz[1] * (sz[2] === 'px' ? .75 : 1), 11, 7, 48) : /^\d+$/.test(a('size')) ? [8, 10, 12, 14, 18, 24, 36][clamp(+a('size'), 3, 1, 7) - 1] : null;
            if (pts)
                x = '{\\fontsize{' + pts + '}{' + (pts * 1.25).toFixed(1) + '}\\selectfont ' + x + '}';
            if (/^h[1-4]$/.test(t))
                return '\n\\' + ({ h1: 'section', h2: 'subsection', h3: 'subsubsection', h4: 'paragraph' }[t]) + '*{' + x.trim() + '}\n';
            if (['p', 'div', 'blockquote', 'section', 'article', 'header', 'footer'].includes(t)) {
                if (inline)
                    return x + ' ';
                x = x.trim();
                if (!x || x === '\\newline{}')
                    return '\n\\par\\vspace{.6\\baselineskip}\n';
                const align = ({ center: 'centering', right: 'raggedleft', left: 'raggedright' })[s.textAlign || a('align')];
                if (align)
                    return '\n{\\' + align + ' ' + x + '\\par}\n';
                if (t === 'blockquote')
                    return '\n\\begin{quote}' + x + '\\end{quote}\n';
                return '\n' + x + '\\par\n';
            }
            return x;
        }
        let body = Array.from(doc.body.childNodes).map(n => render(n)).join(''), size = clamp(settings.size, 11, 9, 18), margin = clamp(settings.margin, 2.5, 1, 4), spacing = clamp(settings.spacing, 1.15, 1, 2);
        let paper = settings.paper === 'letter' ? 'letterpaper' : 'a4paper', orient = settings.orientation === 'landscape' ? ',landscape' : '';
        let source = String.raw `\documentclass{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[spanish,es-nodecimaldot]{babel}
\usepackage{lmodern,graphicx,xcolor,tabularx,array,enumitem,setspace,amssymb,textcomp}
\usepackage[normalem]{ulem}
\usepackage{geometry}
\geometry{${paper}${orient},margin=${margin}cm}
\setlength{\parindent}{0pt}
\setlength{\parskip}{5pt}
\setstretch{${spacing}}
\setlength{\emergencystretch}{2em}
${/sans|arial|calibri|aptos|segoe|verdana|tahoma|trebuchet/i.test(settings.font || '') ? String.raw `\renewcommand{\familydefault}{\sfdefault}` : /mono|consolas|courier/i.test(settings.font || '') ? String.raw `\renewcommand{\familydefault}{\ttdefault}` : ''}
${settings.pageNumbers === false ? String.raw `\pagestyle{empty}` : ''}
\begin{document}
\fontsize{${size}}{${(size * 1.2).toFixed(2)}}\selectfont
${body}
\end{document}
`;
        return { source, assets };
    }
    return { build, esc };
})();

'use strict';
// Deliberately small offline formula renderer. This is not full TeX/KaTeX;
// unsupported commands are rejected rather than silently mis-rendered.
const FolioMath = (() => {
    const names = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', phi: 'φ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', infty: '∞', times: '×', cdot: '·', pm: '±', neq: '≠', leq: '≤', geq: '≥', approx: '≈', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', forall: '∀', exists: '∃', in: '∈', notin: '∉', partial: '∂', nabla: '∇', sum: '∑', prod: '∏', int: '∫', lim: 'lim', sin: 'sin', cos: 'cos', tan: 'tan', log: 'log', ln: 'ln', to: '→', neq: '≠', div: '÷', quad: ' ', qquad: ' ', text: '', left: '', right: '' };
    const allowed = new Set([...Object.keys(names), 'frac', 'sqrt', 'mathrm', 'mathbf', 'mathit']);
    const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function validate(s) { if (typeof s !== 'string' || !s.trim() || s.length > 800)
        return false; if (/[\u0000-\u001f<>$%#&]/.test(s))
        return false; for (const m of s.matchAll(/\\([a-zA-Z]+)/g))
        if (!allowed.has(m[1]))
            return false; return !/\\(?![a-zA-Z{}\\,;:! ])/.test(s); }
    function render(src) {
        if (!validate(src))
            return '<span class="eq-error">Fórmula no admitida</span>';
        let pos = 0, steps = 0;
        function group() { if (src[pos] === '{') {
            pos++;
            const v = seq(true);
            if (src[pos] === '}')
                pos++;
            return v;
        } if (pos >= src.length)
            return ''; return atom(); }
        function atom() { if (++steps > 4000 || pos >= src.length)
            return ''; let ch = src[pos++]; if (ch === '\\') {
            const m = src.slice(pos).match(/^[a-zA-Z]+/);
            if (m) {
                pos += m[0].length;
                const n = m[0];
                if (n === 'frac') {
                    const a = group(), b = group();
                    return `<span class="eq-frac"><span class="eq-numerator">${a || '?'}</span><span class="eq-denominator">${b || '?'}</span></span>`;
                }
                if (n === 'sqrt')
                    return `<span class="eq-root">√<span class="eq-radicand">${group() || '?'}</span></span>`;
                if (['mathrm', 'mathbf', 'mathit', 'text'].includes(n))
                    return `<span class="eq-${n}">${group()}</span>`;
                if (n === 'left' || n === 'right')
                    return '';
                return escape(names[n] ?? n);
            }
            if (pos < src.length) {
                ch = src[pos++];
                return escape(ch);
            }
            return '';
        } if (ch === '{') {
            let s = seq(true);
            if (src[pos] === '}')
                pos++;
            return `<span class="eq-group">${s}</span>`;
        } if (ch === '}')
            return ''; if (ch === ' ' || ch === '~')
            return '&nbsp;'; return escape(ch); }
        function seq(inGroup = false) { let out = ''; while (pos < src.length && steps < 4000) {
            if (src[pos] === '}' && inGroup)
                break;
            if (src[pos] === '^' || src[pos] === '_') {
                const t = src[pos++] === '^' ? 'sup' : 'sub';
                out += `<${t}>${group()}</${t}>`;
                continue;
            }
            out += atom();
        } return out; }
        return seq();
    }
    // TeX source must not contain unsupported Unicode symbols when compiled
    // with pdfLaTeX. Keep user-facing equation text unchanged in the editor.
    const mathChars = Object.freeze({
        '√': '\\surd ', '≤': '\\leq ', '≥': '\\geq ', '≠': '\\neq ',
        '≈': '\\approx ', '±': '\\pm ', '∓': '\\mp ', '×': '\\times ',
        '÷': '\\div ', '∞': '\\infty ', '∑': '\\sum ', '∏': '\\prod ',
        '∫': '\\int ', '∂': '\\partial ', '∇': '\\nabla ',
        '→': '\\rightarrow ', '←': '\\leftarrow ', '↔': '\\leftrightarrow ',
        '⇒': '\\Rightarrow ', '⇔': '\\Leftrightarrow ', '∈': '\\in ',
        '∉': '\\notin ', '∀': '\\forall ', '∃': '\\exists ',
        'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ',
        'δ': '\\delta ', 'ε': '\\varepsilon ', 'θ': '\\theta ',
        'λ': '\\lambda ', 'μ': '\\mu ', 'π': '\\pi ',
        'ρ': '\\rho ', 'σ': '\\sigma ', 'φ': '\\varphi ',
        'ω': '\\omega ', 'Γ': '\\Gamma ', 'Δ': '\\Delta ',
        'Σ': '\\Sigma ', 'Ω': '\\Omega ', '−': '-',
        'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}',
        'ℚ': '\\mathbb{Q}'
    });
    const toLatex = s => Array.from(String(s)).map(c => Object.hasOwn(mathChars, c) ? mathChars[c] : c).join('');
    const html = s => `<span class="folio-equation" data-latex="${escape(s)}" contenteditable="false" role="img" aria-label="Ecuación: ${escape(s)}">${render(s)}</span>`;
    return { render, validate, html, toLatex };
})();
if (typeof module !== 'undefined')
    module.exports = FolioMath;

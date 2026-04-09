/**
 * ui_math.js — Math Tools UI Logic
 */
'use strict';

const MathUI = (() => {

    function init() {
        // Equation solver
        document.getElementById('solve-eq-btn')?.addEventListener('click', solveEquation);

        ['math-eq-input', 'math-guess-input'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') solveEquation();
            });
        });

        // Integral solver
        document.getElementById('solve-int-btn')?.addEventListener('click', solveIntegral);

        ['math-int-func', 'math-int-lower', 'math-int-upper', 'math-int-area'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') solveIntegral();
            });
        });

        document.getElementById('int-solve-for')?.addEventListener('change', updateIntegralFields);
        updateIntegralFields(); // init state
    }

    function updateIntegralFields() {
        const mode = document.getElementById('int-solve-for').value;
        document.getElementById('group-lower').style.display = (mode === 'lower') ? 'none' : '';
        document.getElementById('group-upper').style.display = (mode === 'upper') ? 'none' : '';
        document.getElementById('group-area').style.display = (mode === 'area') ? 'none' : '';
    }

    function solveEquation() {
        const eqInput = document.getElementById('math-eq-input');
        const guessInput = document.getElementById('math-guess-input');
        const out = document.getElementById('math-eq-output');
        out.innerHTML = '';

        const expr = eqInput.value.trim();
        const guess = parseFloat(guessInput.value);

        if (!expr) {
            showError(out, "Please enter an equation (e.g. 2*x - 4 = 0)");
            return;
        }
        if (isNaN(guess)) {
            showError(out, "Please enter a valid numeric guess.");
            return;
        }

        try {
            const f = MathParser.compile(expr);
            const roots = MathSolver.findAllRoots(f, guess);

            // Format roots
            const rootStrs = roots.map(root => Math.abs(root) < 1e-10 ? "0" : Number(root.toPrecision(7)).toString());

            let htmlContent = "";
            if (rootStrs.length === 1) {
                htmlContent = `x = <span style="font-size:24px;font-weight:700;color:var(--accent-primary)">${rootStrs[0]}</span>`;
            } else {
                let joined = rootStrs.map((r, i) => `x<sub>${i + 1}</sub> = <span style="font-size:20px;font-weight:700;color:var(--accent-primary)">${r}</span>`).join('<span style="margin:0 12px;color:var(--border-color)">|</span>');
                htmlContent = `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;row-gap:8px">${joined}</div>`;
            }

            renderResult(out, htmlContent);
            eqInput.classList.remove('error');
        } catch (err) {
            eqInput.classList.add('error');
            showError(out, err.message);
        }
    }

    function solveIntegral() {
        const funcInput = document.getElementById('math-int-func');
        const mode = document.getElementById('int-solve-for').value;
        const out = document.getElementById('math-int-output');
        out.innerHTML = '';

        const expr = funcInput.value.trim();
        if (!expr) {
            showError(out, "Please enter a function f(x)");
            return;
        }

        let f;
        try {
            f = MathParser.compile(expr);
            funcInput.classList.remove('error');
        } catch (err) {
            funcInput.classList.add('error');
            showError(out, err.message);
            return;
        }

        try {
            if (mode === 'area') {
                const aStr = document.getElementById('math-int-lower').value;
                const bStr = document.getElementById('math-int-upper').value;
                if (!aStr || !bStr) throw new Error("Enter both limits");

                let area = MathSolver.integrate(f, parseFloat(aStr), parseFloat(bStr));
                const areaStr = Number(area.toPrecision(7)).toString();
                renderResult(out, `Area = <span style="font-size:24px;font-weight:700;color:var(--accent-primary)">${areaStr}</span>`);
            }
            else if (mode === 'upper') {
                const aStr = document.getElementById('math-int-lower').value;
                const areaStr = document.getElementById('math-int-area').value;
                if (!aStr || !areaStr) throw new Error("Enter Lower limit and Area");

                let upper = MathSolver.solveLimit(f, aStr, true, areaStr);
                const upperStr = Number(upper.toPrecision(7)).toString();
                renderResult(out, `Upper limit (b) = <span style="font-size:24px;font-weight:700;color:var(--accent-primary)">${upperStr}</span>`);
            }
            else if (mode === 'lower') {
                const bStr = document.getElementById('math-int-upper').value;
                const areaStr = document.getElementById('math-int-area').value;
                if (!bStr || !areaStr) throw new Error("Enter Upper limit and Area");

                let lower = MathSolver.solveLimit(f, bStr, false, areaStr);
                const lowerStr = Number(lower.toPrecision(7)).toString();
                renderResult(out, `Lower limit (a) = <span style="font-size:24px;font-weight:700;color:var(--accent-primary)">${lowerStr}</span>`);
            }
        } catch (err) {
            showError(out, err.message);
        }
    }

    function renderResult(el, htmlContent) {
        el.innerHTML = `
        <div class="result-card" style="padding:16px;margin-top:16px;display:flex;align-items:center;justify-content:center">
          <div style="font-family:var(--font-mono);font-size:16px;text-align:center">${htmlContent}</div>
        </div>`;
    }

    function showError(el, msg) {
        el.innerHTML = `
        <div class="error-card" style="margin-top:16px">
          <span class="error-icon">⚠</span>
          <div>${String(msg).replace(/</g, '&lt;')}</div>
        </div>`;
    }

    return { init };
})();

window.MathUI = MathUI;

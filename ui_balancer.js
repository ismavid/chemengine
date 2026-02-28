/**
 * ui_balancer.js — Equation Balancer Tab UI
 */
'use strict';

const BalancerUI = (() => {

    // Examples split into [reactants, products]
    const EXAMPLES = [
        ['H2 + O2', 'H2O'],
        ['Fe + O2', 'Fe2O3'],
        ['C2H6 + O2', 'CO2 + H2O'],
        ['NaOH + H2SO4', 'Na2SO4 + H2O'],
        ['Al + HCl', 'AlCl3 + H2'],
        ['Ca(OH)2 + H3PO4', 'Ca3(PO4)2 + H2O'],
        ['C6H12O6 + O2', 'CO2 + H2O'],
        ['KMnO4 + HCl', 'MnCl2 + Cl2 + H2O + KCl'],
    ];

    function init() {
        renderExamples();

        document.getElementById('balance-btn').addEventListener('click', doBalance);
        ['reactants-input', 'products-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doBalance(); });
        });

        // Redox toggle shows/hides medium selector
        document.getElementById('redox-toggle').addEventListener('change', function () {
            document.getElementById('redox-options').style.display = this.checked ? 'flex' : 'none';
        });
    }

    function renderExamples() {
        const list = document.getElementById('balancer-examples');
        if (!list) return;
        list.innerHTML = EXAMPLES.map(([r, p]) =>
            `<button class="example-btn">${escHtml(r)} → ${escHtml(p)}</button>`
        ).join('');
        list.querySelectorAll('.example-btn').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                document.getElementById('reactants-input').value = EXAMPLES[i][0];
                document.getElementById('products-input').value = EXAMPLES[i][1];
                doBalance();
            });
        });
    }

    function doBalance() {
        const reactants = document.getElementById('reactants-input').value.trim();
        const products = document.getElementById('products-input').value.trim();
        const isRedox = document.getElementById('redox-toggle').checked;
        const medium = document.getElementById('medium-select')?.value || 'acidic';
        const out = document.getElementById('balancer-output');

        // Validate
        let hasError = false;
        ['reactants-input', 'products-input'].forEach(id => {
            const el = document.getElementById(id);
            if (!el.value.trim()) { el.classList.add('error'); hasError = true; }
            else el.classList.remove('error');
        });
        if (hasError) {
            out.innerHTML = `<div class="error-card"><span class="error-icon">⚠</span><div>Fill in both Reactants and Products.</div></div>`;
            return;
        }

        // Combine into arrow notation for the engine
        const raw = `${reactants} -> ${products}`;

        try {
            const result = EquationBalancer.balance(raw, isRedox ? 'redox' : 'standard', medium);
            renderResult(out, result);
        } catch (err) {
            out.innerHTML = `
        <div class="error-card">
          <span class="error-icon">⚠</span>
          <div>${escHtml(err.message)}</div>
        </div>`;
        }
    }

    function renderResult(el, result) {
        const fmtFormula = s => escHtml(s).replace(/(\d+)/g, '<sub>$1</sub>');

        const reactantStr = result.reactants
            .map(p => (p.coeff === 1 ? '' : `<span class="balanced-coeff">${p.coeff} </span>`) + fmtFormula(p.formula))
            .join(' + ');
        const productStr = result.products
            .map(p => (p.coeff === 1 ? '' : `<span class="balanced-coeff">${p.coeff} </span>`) + fmtFormula(p.formula))
            .join(' + ');

        el.innerHTML = `
      <div class="result-card" style="animation:fadeInUp .25s ease">
        <div class="card-title">Balanced Equation</div>
        <div class="balanced-result">
          ${reactantStr} <span style="color:var(--text-muted);margin:0 8px">→</span> ${productStr}
        </div>
        <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);margin-top:8px">
          ${escHtml(result.balanced)}
        </div>
      </div>`;
    }

    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { init };
})();

window.BalancerUI = BalancerUI;

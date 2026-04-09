/**
 * ui_molar.js — Molar Mass Tab UI
 */
'use strict';

const MolarUI = (() => {

    function init() {
        document.getElementById('molar-calc-btn').addEventListener('click', doCalc);
        document.getElementById('molar-formula-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') doCalc();
        });
        document.getElementById('molar-formula-input').addEventListener('input', () => {
            document.getElementById('molar-formula-input').classList.remove('error');
        });

        // Quick-fill example chips
        document.querySelectorAll('.formula-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.getElementById('molar-formula-input').value = chip.dataset.formula;
                doCalc();
            });
        });
    }

    function doCalc() {
        const formula = document.getElementById('molar-formula-input').value.trim();
        const resultEl = document.getElementById('molar-output');
        resultEl.innerHTML = '';

        if (!formula) {
            document.getElementById('molar-formula-input').classList.add('error');
            return;
        }

        try {
            const { total, breakdown } = MolarMass.calc(formula);

            // Render breakdown
            const itemsHtml = breakdown.map(item => `
        <li class="breakdown-item">
          <span>
            <span class="breakdown-element">${escHtml(item.symbol)}</span>
            <span class="breakdown-count" style="margin-left:6px">×${item.count}</span>
            <span style="color:var(--text-muted);font-size:11px;margin-left:8px">${escHtml(item.name)}</span>
          </span>
          <span>
            <span style="color:var(--text-secondary);font-size:11px">${item.unitMass.toFixed(4)} × ${item.count} = </span>
            <span class="breakdown-mass">${item.subTotal.toFixed(4)}</span>
          </span>
        </li>`).join('');

            resultEl.innerHTML = `
        <div style="animation:fadeInUp .3s ease">
          <div class="card" style="margin-bottom:var(--gap-md)">
            <div class="card-title">Molar Mass</div>
            <div class="formula-display">${renderFormulaSub(formula)}</div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:var(--gap-md)">
              <span class="molar-result-big">${total.toFixed(4)}</span>
              <span class="molar-unit">g/mol</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:13px;color:var(--text-muted)">
              = ${(total / 1000).toFixed(6)} kg/mol
            </div>
          </div>

          <div class="card">
            <div class="card-title">Element Breakdown</div>
            <ul class="breakdown-list">${itemsHtml}</ul>
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);
              display:flex;justify-content:space-between;align-items:center;
              font-family:var(--font-mono);font-size:14px">
              <span style="color:var(--text-secondary)">Total Molar Mass</span>
              <span style="color:var(--accent-primary);font-weight:600">${total.toFixed(4)} g/mol</span>
            </div>
          </div>
        </div>`;

        } catch (err) {
            resultEl.innerHTML = `
        <div class="error-card">
          <span class="error-icon">⚠</span>
          <div>${escHtml(err.message)}</div>
        </div>`;
            document.getElementById('molar-formula-input').classList.add('error');
        }
    }

    /** Convert formula text to HTML with subscript numbers */
    function renderFormulaSub(formula) {
        return escHtml(formula).replace(/(\d+)/g, '<sub>$1</sub>');
    }

    function escHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    return { init };
})();

window.MolarUI = MolarUI;

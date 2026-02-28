/**
 * ui_converter.js — Converter Tab UI Logic
 *
 * Bridge detection supports compound units with Molar Mass (MW) and Density (Rho):
 *   kJ/kg  ↔  kJ/mol        (MW: a = -1)
 *   mol/m³ ↔  kg/m³         (MW: a = +1)
 *   kg     ↔  L             (Rho: b = -1)
 *   mol    ↔  L             (MW: a = +1, Rho: b = -1)
 *
 * Algorithm: tgtDim = srcDim + a*MW_dim + b*Rho_dim
 *   MW_dim = M^1 N^-1    Rho_dim = M^1 L^-3
 *   => diff = tgtDim - srcDim = a(M^1 N^-1) + b(M^1 L^-3)
 *   a = -diff.N
 *   b = -diff.L / 3
 * then: result = value × srcFactor × (MW_kg_mol)^a × (Rho_kg_m3)^b / tgtFactor
 */
'use strict';

const ConverterUI = (() => {

  function init() {
    document.getElementById('convert-btn').addEventListener('click', doConvert);
    document.getElementById('swap-btn').addEventListener('click', doSwap);

    ['value-input', 'src-unit', 'tgt-unit', 'compound-input', 'density-val', 'density-unit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doConvert(); });
    });

    ['src-unit', 'tgt-unit'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        validateUnitField(id);
        updateBridgeVisibility();
      });
    });

    const compoundGroup = document.getElementById('compound-input-group');
    const densityGroup = document.getElementById('density-input-group');
    if (compoundGroup) compoundGroup.style.display = 'none';
    if (densityGroup) densityGroup.style.display = 'none';
  }

  // ── Validation ────────────────────────────────────────────────────
  function validateUnitField(id) {
    const input = document.getElementById(id);
    const val = input.value.trim();
    if (!val) { input.classList.remove('error'); return; }
    try { Engine.computeFactorAndDim(val); input.classList.remove('error'); }
    catch { input.classList.add('error'); }
  }

  // ── Detect bridging exponents ───────────────────────────────────────
  /**
   * Returns { a, b } where a=exponent for Molar Mass, b=exponent for Density.
   * Returns null if dimensions are incompatible even with bridges.
   */
  function detectBridges(srcDim, tgtDim) {
    const DIM_KEYS = ['M', 'L', 'T', 'Th', 'N', 'I', 'J'];
    const diff = {};
    for (const k of DIM_KEYS) diff[k] = (tgtDim[k] || 0) - (srcDim[k] || 0);

    // Other dimensions must remain unchanged
    for (const k of ['T', 'Th', 'I', 'J']) {
      if ((diff[k] || 0) !== 0) return null;
    }

    // Volume bridges dictate b
    const dL = diff.L || 0;
    if (dL % 3 !== 0) return null; // Can only bridge via L^3

    const a = -(diff.N || 0);
    const b = -dL / 3;

    // Mass bridges dictate a + b
    const dM = diff.M || 0;
    if (dM !== a + b) return null;

    return { a, b };
  }

  // ── Show fields when bridges detected ──────────────────────────────
  function updateBridgeVisibility() {
    const src = document.getElementById('src-unit').value.trim();
    const tgt = document.getElementById('tgt-unit').value.trim();
    const compoundGroup = document.getElementById('compound-input-group');
    const densityGroup = document.getElementById('density-input-group');

    if (!compoundGroup || !densityGroup) return;

    try {
      if (!src || !tgt) {
        compoundGroup.style.display = 'none';
        densityGroup.style.display = 'none';
        return;
      }
      const s = Engine.computeFactorAndDim(src);
      const t = Engine.computeFactorAndDim(tgt);
      const bridges = detectBridges(s.dim, t.dim);

      if (bridges) {
        compoundGroup.style.display = bridges.a !== 0 ? '' : 'none';
        densityGroup.style.display = bridges.b !== 0 ? '' : 'none';
      } else {
        compoundGroup.style.display = 'none';
        densityGroup.style.display = 'none';
      }
    } catch {
      compoundGroup.style.display = 'none';
      densityGroup.style.display = 'none';
    }
  }

  function doSwap() {
    const src = document.getElementById('src-unit');
    const tgt = document.getElementById('tgt-unit');
    [src.value, tgt.value] = [tgt.value, src.value];
    updateBridgeVisibility();
  }

  // ── Main conversion ───────────────────────────────────────────────
  function doConvert() {
    const valueStr = document.getElementById('value-input').value.trim();
    const srcExpr = document.getElementById('src-unit').value.trim();
    const tgtExpr = document.getElementById('tgt-unit').value.trim();
    const outputEl = document.getElementById('converter-output');
    outputEl.innerHTML = '';

    if (!valueStr || !srcExpr || !tgtExpr) {
      showError(outputEl, 'Please fill in Value, From Unit, and To Unit.');
      return;
    }
    const value = parseFloat(valueStr);
    if (isNaN(value)) { showError(outputEl, 'Invalid numeric value.'); return; }

    try {
      const srcInfo = Engine.computeFactorAndDim(srcExpr);
      const tgtInfo = Engine.computeFactorAndDim(tgtExpr);

      const bridges = detectBridges(srcInfo.dim, tgtInfo.dim);

      if (bridges && (bridges.a !== 0 || bridges.b !== 0)) {
        // Bridged conversion required
        const compoundField = document.getElementById('compound-input');
        const densityValField = document.getElementById('density-val');
        const densityUnitField = document.getElementById('density-unit');

        let formula = '';
        if (bridges.a !== 0) {
          document.getElementById('compound-input-group').style.display = '';
          formula = (compoundField?.value || '').trim();
          if (!formula) {
            if (compoundField) { compoundField.classList.add('error'); compoundField.focus(); }
            showError(outputEl, 'Enter the compound formula in the "Compound" field above to bridge mass and moles.');
            return;
          }
          if (compoundField) compoundField.classList.remove('error');
        }

        let density_kg_m3 = 1.0;
        let densityStr = '';
        if (bridges.b !== 0) {
          document.getElementById('density-input-group').style.display = '';
          const dValStr = (densityValField?.value || '').trim();
          const dUnitStr = (densityUnitField?.value || '').trim() || 'g/cm^3';
          if (!dValStr) {
            if (densityValField) { densityValField.classList.add('error'); densityValField.focus(); }
            showError(outputEl, 'Enter a numeric value for Density to bridge mass and volume.');
            return;
          }
          if (densityValField) densityValField.classList.remove('error');

          const dVal = parseFloat(dValStr);
          if (isNaN(dVal) || dVal <= 0) {
            showError(outputEl, 'Density must be a positive number.');
            return;
          }

          try {
            // Convert entered density to fundamental SI (kg/m³)
            const dInfo = Engine.computeFactorAndDim(dUnitStr);
            // Verify dimension is actually density (M^1 L^-3)
            if ((dInfo.dim.M || 0) !== 1 || (dInfo.dim.L || 0) !== -3) {
              showError(outputEl, `The unit '${dUnitStr}' is not a valid density unit.`);
              return;
            }
            density_kg_m3 = dVal * dInfo.factor;
            densityStr = `${dVal} ${dUnitStr}`;
          } catch (err) {
            showError(outputEl, `Invalid density unit: ${err.message}`);
            return;
          }
        }

        doBridgedConvert(value, srcExpr, tgtExpr, srcInfo.factor, tgtInfo.factor, tgtInfo.dim, bridges.a, bridges.b, formula, density_kg_m3, densityStr, outputEl);

        // Auto-scroll on mobile
        if (window.innerWidth <= 768) {
          setTimeout(() => outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
        return;
      } else if (!bridges) {
        showError(outputEl, `Incompatible dimensions between target and source.`);
        return;
      }

      // Standard conversion (same dimensions)
      const result = Engine.convert(value, srcExpr, tgtExpr);
      renderResult(outputEl, value, srcExpr, tgtExpr, result);

      // Auto-scroll on mobile
      if (window.innerWidth <= 768) {
        setTimeout(() => outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }

    } catch (err) {
      showError(outputEl, err.message);
    }
  }

  function doBridgedConvert(value, srcExpr, tgtExpr, srcFactor, tgtFactor, tgtDim, a, b, formula, density_kg_m3, densityStr, outputEl) {
    try {
      let result_SI = value * srcFactor;
      let notes = [];

      if (a !== 0) {
        const massCalc = MolarMass.calc(formula);
        const mw_kg_mol = massCalc.total * 1e-3;           // g/mol → kg/mol
        result_SI *= Math.pow(mw_kg_mol, a);
        notes.push(`MW = ${massCalc.total.toFixed(4)} g/mol (d=${a > 0 ? '+' : ''}${a})`);
      }

      if (b !== 0) {
        result_SI *= Math.pow(density_kg_m3, b);
        notes.push(`ρ = ${densityStr} (d=${b > 0 ? '+' : ''}${b})`);
      }

      const resultValue = result_SI / tgtFactor;

      const dummyResult = { value: resultValue, tgtDim: tgtDim, simplified: null };
      const note = `Bridged via: ` + notes.join(' & ');
      renderResult(outputEl, value, srcExpr, tgtExpr, dummyResult, note);
    } catch (err) {
      showError(outputEl, err.message);
    }
  }

  // ── Result rendering ──────────────────────────────────────────────
  function renderResult(el, inputValue, srcExpr, tgtExpr, result, extraNote) {
    const n = result.value;
    const std = Engine.formatStandard(n);
    const sci = Engine.formatScientific(n, 4);
    const eng = Engine.formatEngineering(n, 4);
    const dimStr = Engine.dimToString(result.tgtDim);

    let simplifiedHtml = '';
    if (result.simplified && result.simplified.symbol !== tgtExpr) {
      simplifiedHtml = `
        <div class="simplified-badge">
          ✓ Equivalent to: <strong>${result.simplified.symbol}</strong>
          <span style="opacity:.7">(${result.simplified.name})</span>
        </div>`;
    }

    let noteHtml = '';
    if (extraNote) {
      noteHtml = `<div style="font-size:12px;color:var(--accent-secondary);margin-bottom:10px;font-family:var(--font-mono)">${escHtml(extraNote)}</div>`;
    }

    const isFav = (typeof FavoritesUI !== 'undefined') && FavoritesUI.hasConversion(srcExpr, tgtExpr);

    el.innerHTML = `
      <div class="result-card">
        <div class="card-title">Result</div>
        ${noteHtml}
        ${simplifiedHtml}
        <div class="result-row">
          <span class="result-value">${std}</span>
          <span class="result-unit">${escHtml(tgtExpr)}</span>
        </div>
        <div class="result-actions">
          <button class="copy-btn" id="copy-result-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy result
          </button>
          <span class="copy-feedback" id="copy-feedback">Copied</span>
          <button class="star-btn${isFav ? ' active' : ''}" id="fav-star-btn" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
            ${isFav ? '★' : '☆'}
          </button>
        </div>
        <div class="notation-grid">
          <div class="notation-chip"><span class="label">Standard</span><span class="value">${std}</span></div>
          <div class="notation-chip"><span class="label">Scientific</span><span class="value">${sci}</span></div>
          <div class="notation-chip"><span class="label">Engineering</span><span class="value">${eng}</span></div>
        </div>
        <div class="dim-vector">
          <span class="dim-label">Dimension:</span>${escHtml(dimStr)}
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">
          ${escHtml(String(inputValue))} ${escHtml(srcExpr)} = ${std} ${escHtml(tgtExpr)}
        </div>
      </div>`;

    document.getElementById('copy-result-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(`${std} ${tgtExpr}`).then(() => {
        const btn = document.getElementById('copy-result-btn');
        const fb = document.getElementById('copy-feedback');
        btn.classList.add('copied'); fb.classList.add('visible');
        btn.textContent = 'Copied';
        setTimeout(() => {
          btn.classList.remove('copied'); fb.classList.remove('visible');
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy result`;
        }, 2000);
      }).catch(() => { });
    });

    const starBtn = document.getElementById('fav-star-btn');
    starBtn.addEventListener('click', () => {
      if (typeof FavoritesUI === 'undefined') return;
      if (FavoritesUI.hasConversion(srcExpr, tgtExpr)) {
        FavoritesUI.removeConversion(srcExpr, tgtExpr);
        starBtn.classList.remove('active'); starBtn.textContent = '☆';
        starBtn.title = 'Add to favorites';
      } else {
        FavoritesUI.addConversion(srcExpr, tgtExpr);
        starBtn.classList.add('active'); starBtn.textContent = '★';
        starBtn.title = 'Remove from favorites';
      }
    });
  }

  function showError(el, msg) {
    el.innerHTML = `
      <div class="error-card">
        <span class="error-icon">⚠</span>
        <div>${escHtml(msg).replace(/\n/g, '<br>')}</div>
      </div>`;
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { init };
})();

window.ConverterUI = ConverterUI;

/**
 * equation_balancer.js — Chemical Equation Balancer
 * Uses matrix null-space (Gaussian elimination) for standard balancing.
 * Reuses MolarMass.parseFormula() for element counting.
 */
'use strict';

const EquationBalancer = (() => {

  // ── Math helpers ──────────────────────────────────────────
  function gcd(a, b) {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    while (b) { [a, b] = [b, a % b]; }
    return a || 1;
  }

  function toIntegers(arr) {
    // To cleanly clear fractions like 0.33333 or 0.5 without float errors,
    // we find a multiplier `m` that makes all elements very close to integers.
    const maxMultiplier = 1000;

    // Normalize array by dividing everything by the smallest non-zero absolute value
    const nonZeros = arr.map(Math.abs).filter(x => x > 1e-10);
    if (!nonZeros.length) return arr.map(Math.round);
    const minVal = Math.min(...nonZeros);

    let normalized = arr.map(x => x / minVal);

    // Search for the lowest multiplier 'm'
    for (let m = 1; m <= maxMultiplier; m++) {
      let isAllInts = true;
      for (let x of normalized) {
        let val = x * m;
        // Check if value is within a small tolerance of an integer
        if (Math.abs(val - Math.round(val)) > 1e-4) {
          isAllInts = false;
          break;
        }
      }

      if (isAllInts) {
        // We found a successful multiplier. Round them out and divide by GCD.
        let ints = normalized.map(x => Math.round(x * m));
        let g = ints.reduce((acc, val) => gcd(acc, val), ints[0]);
        if (g === 0) g = 1;
        return ints.map(x => x / g);
      }
    }

    // Fallback if no exact multiplier found (should rarely happen for standard chemistry)
    return arr.map(Math.round);
  }

  // ── Parser ────────────────────────────────────────────────
  function parseEquation(raw) {
    const s = raw.trim()
      .replace(/\s+/g, '')
      .replace(/[→⇌]/g, '->')
      .replace(/(?<!\-)(=)(?!\>)/g, '->');  // lone = → arrow

    const idx = s.indexOf('->');
    if (idx < 0) throw new Error('No reaction arrow found. Use -> or →');

    const split = side => side.split('+').filter(Boolean);
    return {
      reactants: split(s.slice(0, idx)),
      products: split(s.slice(idx + 2)),
    };
  }

  /** Strip ionic charges like 2+, +, -, 2- from end of formula string */
  function stripCharge(s) {
    return s.replace(/[0-9]?[+\-]$/, '');
  }

  // ── Matrix null-space balancer ────────────────────────────
  function balance(eqStr, _mode, _medium) {
    const { reactants, products } = parseEquation(eqStr);
    const compounds = [...reactants, ...products];

    // Parse element composition of each compound
    const compositions = compounds.map(c => {
      const formula = stripCharge(c);
      try {
        return MolarMass.parseFormula(formula);
      } catch (e) {
        throw new Error(`Cannot parse "${c}": ${e.message}`);
      }
    });

    // Unique element list
    const elements = [...new Set(compositions.flatMap(ec => Object.keys(ec)))].sort();
    if (!elements.length) throw new Error('No chemical elements found.');

    const nC = compounds.length;
    const nE = elements.length;

    // Build matrix: rows = elements, cols = compounds
    // Reactant columns are +, product columns are −
    const M = elements.map(el =>
      compounds.map((_, ci) => {
        const sign = ci < reactants.length ? 1 : -1;
        return sign * (compositions[ci][el] || 0);
      })
    );

    // Gaussian elimination (row echelon form)
    const mat = M.map(r => [...r]);
    const pivotCols = [];
    let pRow = 0;

    for (let col = 0; col < nC && pRow < nE; col++) {
      // Find best pivot
      let best = -1, bestVal = 0;
      for (let r = pRow; r < nE; r++) {
        if (Math.abs(mat[r][col]) > bestVal) { bestVal = Math.abs(mat[r][col]); best = r; }
      }
      if (best < 0 || bestVal < 1e-10) continue;

      [mat[pRow], mat[best]] = [mat[best], mat[pRow]];
      pivotCols.push(col);

      const piv = mat[pRow][col];
      mat[pRow] = mat[pRow].map(v => v / piv);

      for (let r2 = 0; r2 < nE; r2++) {
        if (r2 === pRow) continue;
        const f = mat[r2][col];
        mat[r2] = mat[r2].map((v, c2) => v - f * mat[pRow][c2]);
      }
      pRow++;
    }

    // Free variables (non-pivot columns)
    const freeCols = Array.from({ length: nC }, (_, i) => i).filter(i => !pivotCols.includes(i));
    if (!freeCols.length) throw new Error('No degree of freedom found — equation may be trivial.');

    // Set first free variable = 1, back-substitute
    const x = new Array(nC).fill(0);
    x[freeCols[0]] = 1;
    for (let i = pivotCols.length - 1; i >= 0; i--) {
      const pc = pivotCols[i];
      let val = 0;
      for (let c2 = pc + 1; c2 < nC; c2++) val -= mat[i][c2] * x[c2];
      x[pc] = val;
    }

    // Verify residuals
    const bad = M.some(row => Math.abs(row.reduce((s, v, ci) => s + v * x[ci], 0)) > 1e-5);
    if (bad) throw new Error('Could not balance this equation. Check it is chemically valid.');

    // Convert to smallest positive integers
    let coeffs = toIntegers(x);
    if (coeffs.some(c => c <= 0)) {
      coeffs = coeffs.map(c => -c);
      if (coeffs.some(c => c <= 0)) throw new Error('Balancing produced invalid coefficients.');
    }

    return formatResult(compounds, coeffs, reactants.length);
  }

  // ── Formatter ─────────────────────────────────────────────
  function formatResult(compounds, coeffs, nR) {
    const side = (start, len) => {
      const parts = [];
      for (let i = start; i < start + len; i++) {
        parts.push({ coeff: coeffs[i], formula: compounds[i] });
      }
      return parts;
    };

    const reactantParts = side(0, nR);
    const productParts = side(nR, compounds.length - nR);

    const sideStr = parts =>
      parts.map(p => (p.coeff === 1 ? '' : p.coeff + ' ') + p.formula).join(' + ');

    return {
      balanced: `${sideStr(reactantParts)} → ${sideStr(productParts)}`,
      reactants: reactantParts,
      products: productParts,
      coefficients: coeffs,
    };
  }

  return { balance, parseEquation };
})();

window.EquationBalancer = EquationBalancer;

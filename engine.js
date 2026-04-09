/**
 * engine.js — ChemE Units Dimensional Analysis Engine
 * =====================================================
 * All unit conversions go through SI base units using:
 *   result = value × src_factor / tgt_factor
 *
 * Dimensions: M(mass) L(length) T(time) Th(temperature)
 *             N(amount) I(current) J(luminous intensity)
 */

'use strict';

const Engine = (() => {

  // ─── Internal state ───────────────────────────────────────────
  let _units   = {};   // symbol → { name, factor, dim }
  let _prefixes = {};  // prefix symbol → { name, factor }
  let _derived  = {};  // symbol → { name, expr, dim, factor }

  const DIM_KEYS = ['M','L','T','Th','N','I','J'];

  // ─── Init ─────────────────────────────────────────────────────
  function init(unitsData) {
    _units    = unitsData.units   || {};
    _prefixes = unitsData.prefixes|| {};
    _derived  = unitsData.derived || {};
  }

  // ─── Zero dimension vector ────────────────────────────────────
  function zeroDim() {
    return { M:0, L:0, T:0, Th:0, N:0, I:0, J:0 };
  }

  function addDim(a, b, scale=1) {
    const r = {};
    for (const k of DIM_KEYS) r[k] = (a[k]||0) + (b[k]||0) * scale;
    return r;
  }

  function scaleDim(dim, exp) {
    const r = {};
    for (const k of DIM_KEYS) r[k] = (dim[k]||0) * exp;
    return r;
  }

  function dimsEqual(a, b) {
    return DIM_KEYS.every(k => (a[k]||0) === (b[k]||0));
  }

  function isDimless(dim) {
    return DIM_KEYS.every(k => (dim[k]||0) === 0);
  }

  // ─── Unit lookup (handles SI prefixes) ───────────────────────
  function resolveUnit(symbol) {
    // Direct look-up
    if (_units[symbol]) return { ..._units[symbol] };

    // Try SI prefix stripping (longest prefix first)
    const prefixList = Object.keys(_prefixes).sort((a,b) => b.length - a.length);
    for (const pfx of prefixList) {
      if (symbol.startsWith(pfx) && symbol.length > pfx.length) {
        const rest = symbol.slice(pfx.length);
        if (_units[rest]) {
          return {
            name:   _prefixes[pfx].name + _units[rest].name,
            factor: _prefixes[pfx].factor * _units[rest].factor,
            dim:    { ..._units[rest].dim },
          };
        }
      }
    }
    return null;
  }

  // ─── Unit expression tokeniser ────────────────────────────────
  /**
   * Accepts formats:
   *   kg/m^3     kg/m3     kg m-3     kg·m-3
   *   N·m/s²     kg per m3    mol/L
   *   kJ/(mol·K)
   *
   * Returns array of { symbol:string, exp:number }
   */
  function tokenize(expr) {
    if (!expr || !expr.trim()) throw new Error('Empty unit expression.');

    // Normalise
    let s = expr.trim()
      .replace(/per\s+/gi, '/')   // "per " → "/"
      .replace(/\u00b2/g, '^2')   // ² → ^2
      .replace(/\u00b3/g, '^3')   // ³ → ^3
      .replace(/\u207b/g, '^-')   // superscript minus
      .replace(/\u00b9/g, '^1')
      .replace(/[·•*×⋅]/g, '·'); // unify multiplication separators → middle dot

    // Split into numerator / denominator parts by top-level '/'
    const parts = splitBySlash(s);
    const num = parts[0] || '1';
    const dens = parts.slice(1);

    const tokens = [];
    parseGroup(num, +1, tokens);
    for (const den of dens) parseGroup(den, -1, tokens);
    return tokens;
  }

  /** Split string by '/' respecting parentheses depth */
  function splitBySlash(s) {
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') { depth++; cur += ch; }
      else if (ch === ')') { depth--; cur += ch; }
      else if (ch === '/' && depth === 0) { parts.push(cur); cur = ''; }
      else { cur += ch; }
    }
    parts.push(cur);
    return parts;
  }

  /** Parse a group of unit symbols (numerator or denominator side) */
  function parseGroup(s, signMultiplier, tokens) {
    // Strip outer parentheses
    s = s.trim();
    if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1).trim();
    if (!s || s === '1') return;

    // Tokenise into individual units separated by spaces, dots, or explicit operator
    // Pattern: optional unit-symbol  optional ^ optional sign optional digits
    // We use a state machine to handle things like kg^2·m-3
    const re = /([A-Za-z°Ω℃%]+)(\^?[-+]?\d*\.?\d*)?/g;
    let match;
    while ((match = re.exec(s)) !== null) {
      const sym = match[1];
      let expStr = match[2] || '1';
      expStr = expStr.replace('^', '') || '1';
      const exp = parseFloat(expStr);
      if (isNaN(exp) || exp === 0) continue; // skip numeric-only tokens
      tokens.push({ symbol: sym, exp: exp * signMultiplier });
    }
  }

  // ─── Compute SI factor and dimension vector for an expression ─
  function computeFactorAndDim(expr) {
    const tokens = tokenize(expr);
    let factor = 1;
    let dim = zeroDim();

    for (const tok of tokens) {
      const unit = resolveUnit(tok.symbol);
      if (!unit) throw new Error(`Unknown unit: "${tok.symbol}"`);
      factor *= Math.pow(unit.factor, tok.exp);
      for (const k of DIM_KEYS) dim[k] = (dim[k]||0) + (unit.dim[k]||0) * tok.exp;
    }
    return { factor, dim };
  }

  // ─── Dimensional consistency check ────────────────────────────
  function checkCompatibility(dim1, dim2) {
    if (!dimsEqual(dim1, dim2)) {
      const d1 = dimToString(dim1);
      const d2 = dimToString(dim2);
      throw new Error(
        `Dimensional mismatch.\nSource: ${d1 || '1'}\nTarget: ${d2 || '1'}\n` +
        `These quantities are not physically compatible.`
      );
    }
  }

  // ─── Convert ──────────────────────────────────────────────────
  function convert(value, srcExpr, tgtExpr) {
    const src = computeFactorAndDim(srcExpr);
    const tgt = computeFactorAndDim(tgtExpr);
    checkCompatibility(src.dim, tgt.dim);
    const result = value * src.factor / tgt.factor;
    const simplified = simplifyUnit(tgt.dim);
    return {
      value:      result,
      srcDim:     src.dim,
      tgtDim:     tgt.dim,
      simplified: simplified,
    };
  }

  // ─── Try to simplify result dimension to a known derived unit ─
  function simplifyUnit(dim) {
    // Check derived units table
    for (const [sym, d] of Object.entries(_derived)) {
      if (dimsEqual(dim, d.dim)) return { symbol: sym, name: d.name };
    }
    // Check base units
    for (const [sym, u] of Object.entries(_units)) {
      if (dimsEqual(dim, u.dim)) return { symbol: sym, name: u.name };
    }
    return null;
  }

  // ─── Dimension vector as a string ─────────────────────────────
  function dimToString(dim) {
    const labels = { M:'M', L:'L', T:'T', Th:'Θ', N:'N', I:'I', J:'J' };
    const sup = n => {
      if (n === 1) return '¹';
      if (n === -1) return '⁻¹';
      const digits = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
      const neg = n < 0 ? '⁻' : '';
      return neg + String(Math.abs(n)).split('').map(d => digits[d]).join('');
    };
    return DIM_KEYS
      .filter(k => dim[k] && dim[k] !== 0)
      .map(k => labels[k] + sup(dim[k]))
      .join(' ') || '1 (dimensionless)';
  }

  // ─── Number formatting ────────────────────────────────────────
  function formatStandard(n, sigFigs=6) {
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 0.001 && abs < 1e7) {
      // Fixed notation, trim trailing zeros
      const decimals = Math.max(0, sigFigs - Math.floor(Math.log10(abs)) - 1);
      return n.toFixed(Math.min(decimals, 10));
    }
    return formatScientific(n, sigFigs);
  }

  function formatScientific(n, sigFigs=4) {
    if (n === 0) return '0';
    return n.toExponential(sigFigs - 1);
  }

  function formatEngineering(n, sigFigs=4) {
    if (n === 0) return '0';
    const exp = Math.floor(Math.log10(Math.abs(n)));
    const engExp = Math.floor(exp / 3) * 3;
    const mantissa = n / Math.pow(10, engExp);
    const decimals = Math.max(0, sigFigs - Math.floor(Math.log10(Math.abs(mantissa))) - 1);
    return `${mantissa.toFixed(decimals)}×10^${engExp}`;
  }

  // ─── Public API ───────────────────────────────────────────────
  return {
    init,
    convert,
    computeFactorAndDim,
    resolveUnit,
    tokenize,
    simplifyUnit,
    dimToString,
    dimsEqual,
    formatStandard,
    formatScientific,
    formatEngineering,
    zeroDim,
    DIM_KEYS,
  };

})();

window.Engine = Engine;

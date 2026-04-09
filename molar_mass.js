/**
 * molar_mass.js — Chemical Formula Parser & Molar Mass Calculator
 * ================================================================
 * Parses formulas: H2O, CO2, NaCl, C6H12O6, Ca(OH)2, Al2(SO4)3
 * Returns molar mass in g/mol using the periodic table dataset.
 */

'use strict';

const MolarMass = (() => {

    let _elements = {};   // symbol → { name, Z, weight }

    function init(periodicTable) {
        _elements = {};
        for (const el of periodicTable) {
            if (el.symbol && el.weight != null) {
                _elements[el.symbol] = {
                    name: el.name,
                    Z: el.Z,
                    weight: el.weight,
                    category: el.category,
                };
            }
        }
    }

    /**
     * Parse a chemical formula string into element counts.
     * Handles: H2O, CO2, Ca(OH)2, Al2(SO4)3, [Cr(NH3)6]Cl3
     *
     * @param {string} formula
     * @returns {Object} { 'H': 2, 'O': 1, ... }
     */
    function parseFormula(formula) {
        if (!formula || !formula.trim()) throw new Error('Empty formula.');
        // Normalise square brackets to parentheses
        const clean = formula.trim().replace(/\[/g, '(').replace(/\]/g, ')');
        const [counts, rest] = parseGroup(clean, 0);
        if (rest !== clean.length) {
            throw new Error(`Unexpected character in formula at position ${rest}.`);
        }
        return counts;
    }

    /**
     * Recursive group parser.
     * Returns [elementCounts, nextIndex]
     */
    function parseGroup(s, i) {
        const counts = {};

        while (i < s.length) {
            const ch = s[i];

            if (ch === '(') {
                // Parse sub-group
                const [subCounts, j] = parseGroup(s, i + 1);
                if (s[j] !== ')') throw new Error(`Expected ')' at position ${j}.`);
                // Read optional subscript after closing paren
                const [mult, k] = readNum(s, j + 1);
                for (const [el, cnt] of Object.entries(subCounts)) {
                    counts[el] = (counts[el] || 0) + cnt * mult;
                }
                i = k;
            } else if (ch === ')') {
                // End of group — return to caller
                break;
            } else if (ch >= 'A' && ch <= 'Z') {
                // Element symbol: uppercase letter followed by optional lowercase
                let sym = ch;
                let j = i + 1;
                while (j < s.length && s[j] >= 'a' && s[j] <= 'z') {
                    sym += s[j++];
                }
                // Check if it's a known element (up to 2 chars)
                // Prefer 2-char match if both are lowercase
                if (!_elements[sym] && sym.length > 1) {
                    // Try just the first uppercase letter
                    const single = sym[0];
                    if (_elements[single]) { sym = single; j = i + 1; }
                }
                if (!_elements[sym]) {
                    throw new Error(`Unknown element: "${sym}"`);
                }
                const [mult, k] = readNum(s, j);
                counts[sym] = (counts[sym] || 0) + mult;
                i = k;
            } else if (ch === ' ' || ch === '·' || ch === '•') {
                // Separator (e.g. hydrates: CuSO4·5H2O)
                i++;
            } else {
                throw new Error(`Unexpected character "${ch}" at position ${i}.`);
            }
        }

        return [counts, i];
    }

    /** Read an integer subscript starting at index i; returns [value, newIndex] */
    function readNum(s, i) {
        let numStr = '';
        while (i < s.length && s[i] >= '0' && s[i] <= '9') {
            numStr += s[i++];
        }
        return [numStr ? parseInt(numStr, 10) : 1, i];
    }

    /**
     * Calculate molar mass from a formula string.
     * @returns {{ total: number, breakdown: Array<{symbol, name, count, unitMass, subTotal}> }}
     */
    function calc(formula) {
        const counts = parseFormula(formula);
        let total = 0;
        const breakdown = [];

        for (const [sym, count] of Object.entries(counts)) {
            const el = _elements[sym];
            if (!el) throw new Error(`Element not found: "${sym}"`);
            const subTotal = el.weight * count;
            total += subTotal;
            breakdown.push({
                symbol: sym,
                name: el.name,
                count: count,
                unitMass: el.weight,
                subTotal: subTotal,
            });
        }

        // Sort by count desc, then symbol
        breakdown.sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));

        return { total, breakdown };
    }

    /**
     * Detect mol ↔ mass conversion.
     * src has dimension N (amount), tgt has dimension M (mass) or vice versa.
     */
    function isMolMassConversion(srcDim, tgtDim) {
        const isAmount = dim => dim.N === 1 && dim.M === 0 && dim.L === 0 && dim.T === 0;
        const isMass = dim => dim.M === 1 && dim.N === 0 && dim.L === 0 && dim.T === 0;
        return (isAmount(srcDim) && isMass(tgtDim)) || (isMass(srcDim) && isAmount(tgtDim));
    }

    /**
     * Convert mol → kg using molar mass.
     * molarMass in g/mol; value in mol; result in kg.
     */
    function molToKg(valueMol, molarMass_g_mol) {
        return valueMol * molarMass_g_mol * 1e-3;  // g/mol × mol → g → kg
    }

    function kgToMol(valuKg, molarMass_g_mol) {
        return valuKg / (molarMass_g_mol * 1e-3);
    }

    return { init, calc, parseFormula, isMolMassConversion, molToKg, kgToMol };

})();

window.MolarMass = MolarMass;

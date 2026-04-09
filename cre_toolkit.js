/**
 * cre_toolkit.js — Core math logic for the Reactions Engineering Toolkit.
 * Dependencies: MathParser, MathSolver
 */
'use strict';

window.CREToolkit = (() => {

    /**
     * Block 1: Limiting Reactant
     * @param {number[]} nu - Stoichiometric coefficients
     * @param {number[]} F0 - Initial molar flows/moles
     * @returns {Object} { idx_LR (1-based), ratios }
     */
    function limitingReactant(nu, F0) {
        if (!Array.isArray(nu) || !Array.isArray(F0)) throw new Error("nu and F0 must be arrays.");
        if (nu.length !== F0.length) throw new Error("nu and F0 must be the same length.");
        if (F0.some(val => val < 0)) throw new Error("F0 values must be non-negative.");

        // Find indices of reactants
        let reactantIndices = [];
        for (let i = 0; i < nu.length; i++) {
            if (nu[i] < 0) reactantIndices.push(i);
        }

        if (reactantIndices.length === 0) throw new Error("No reactants found (nu must contain negative values).");

        let ratios = [];
        let minRatio = Infinity;
        let idx_LR = -1;

        for (let i = 0; i < nu.length; i++) {
            if (nu[i] < 0) {
                let ratio = F0[i] / Math.abs(nu[i]);
                ratios[i] = ratio;
                if (ratio < minRatio) {
                    minRatio = ratio;
                    idx_LR = i + 1; // 1-based index
                }
            } else {
                ratios[i] = null; // Products don't have a ratio for this
            }
        }

        return { idx_LR, ratios };
    }

    /**
     * Block 2: Normalize Stoichiometry
     * @param {number[]} nu - Stoichiometric coefficients
     * @param {number} idx_LR - 1-based index of limiting reactant
     * @returns {Object} { nu_norm, reorder_idx }
     */
    function normalizeStoich(nu, idx_LR) {
        let n = nu.length;
        if (idx_LR < 1 || idx_LR > n) throw new Error(`idx_LR must be between 1 and ${n}.`);

        let lr_idx_0_based = idx_LR - 1;
        if (nu[lr_idx_0_based] >= 0) throw new Error("nu[idx_LR] must be negative (reactant).");

        // Scale so LR coeff is -1
        let scale = Math.abs(nu[lr_idx_0_based]);
        let nu_sc = nu.map(val => val / scale);

        // Reorder
        let others = [];
        for (let i = 0; i < n; i++) {
            if (i !== lr_idx_0_based) others.push(i + 1); // 1-based
        }
        let reorder_idx = [idx_LR, ...others]; // 1-based

        let nu_norm = reorder_idx.map(i => nu_sc[i - 1]);

        return { nu_norm, reorder_idx };
    }

    /**
     * Block 3: Stoichiometric Table
     * Builds symbolic expressions C_i(x) as strings.
     * @param {number[]} nu_norm - Normalized stoichiometric vector
     * @param {number[]} feed_frac - Feed molar fractions (LR must be first)
     * @param {number} C_LR0 - Initial concentration of limiting reactant
     * @param {string} volume_mode - 'constant' or 'variable'
     * @param {Object} opts - { P_ratio, T_ratio } for variable mode
     * @returns {string[]} Symbolic expressions for C_x
     */
    function stoichTable(nu_norm, feed_frac, C_LR0, volume_mode, opts = {}) {
        let n = nu_norm.length;
        if (feed_frac.length !== n) throw new Error("nu_norm and feed_frac must have the same length.");
        if (feed_frac.some(val => val < 0)) throw new Error("feed_frac values must be non-negative.");
        if (feed_frac[0] <= 0) throw new Error("feed_frac(1) (limiting reactant) must be > 0.");
        if (C_LR0 <= 0) throw new Error("C_LR0 must be a positive number.");
        if (nu_norm[0] >= 0) throw new Error("nu_norm(1) must be negative (limiting reactant first).");

        let theta = feed_frac.map(val => val / feed_frac[0]);
        let C_x = [];

        if (volume_mode === 'constant') {
            for (let i = 0; i < n; i++) {
                let term = `${theta[i]} ${nu_norm[i] >= 0 ? '+' : '-'} ${Math.abs(nu_norm[i])}*x`;
                C_x.push(`${C_LR0} * (${term})`);
            }
        } else if (volume_mode === 'variable') {
            let P_ratio = opts.P_ratio || 1;
            let T_ratio = opts.T_ratio || 1;
            let delta = nu_norm.reduce((a, b) => a + b, 0); // Sum of normalized stoich
            let y_A0 = feed_frac[0] / feed_frac.reduce((a, b) => a + b, 0); // Mol fraction of A
            let epsilon = y_A0 * delta;

            for (let i = 0; i < n; i++) {
                let num = `${theta[i]} ${nu_norm[i] >= 0 ? '+' : '-'} ${Math.abs(nu_norm[i])}*x`;
                let den = `1 ${epsilon >= 0 ? '+' : '-'} ${Math.abs(epsilon)}*x`;
                C_x.push(`${C_LR0} * ((${num}) / (${den})) * (${P_ratio}) * (${T_ratio})`);
            }
        } else {
            throw new Error("volume_mode must be 'constant' or 'variable'.");
        }

        return C_x;
    }

    /**
     * Block 4: Equilibrium Conversion
     * Uses MathParser to build K(x) and solves for Xeq or evaluated Kc.
     * @param {number[]} nu_norm 
     * @param {number} Kc - NaN to solve for it
     * @param {string[]} C_x - Expressions from Stoichiometric Table
     * @param {number} [Xeq_known] - Required if Kc is NaN
     * @returns {Object} { K_expr_str, result } (result is Xeq or Kc)
     */
    function equilibriumSolver(nu_norm, Kc, C_x, Xeq_known) {
        if (nu_norm.length !== C_x.length) throw new Error("nu_norm and C_x must have same length.");

        // Build K(x) expression
        let K_expr_parts = [];
        for (let i = 0; i < nu_norm.length; i++) {
            let exp = nu_norm[i];
            let C_i = `(${C_x[i]})`;
            if (exp !== 0) {
                if (exp === 1) K_expr_parts.push(C_i);
                else K_expr_parts.push(`${C_i}^(${exp})`);
            }
        }
        let K_expr_str = K_expr_parts.join(' * ');
        if (!K_expr_str) K_expr_str = "1";

        let K_func = MathParser.compile(K_expr_str);

        if (isNaN(Kc)) {
            // Mode B: Solve for Kc given Xeq
            if (Xeq_known === undefined || isNaN(Xeq_known)) throw new Error("Xeq_known is required when Kc is NaN.");
            if (Xeq_known <= 0 || Xeq_known >= 1) throw new Error("Xeq_known must be in (0,1).");

            let result = K_func(Xeq_known);
            return { K_expr_str, result, solvedFor: 'Kc' };
        } else {
            // Mode A: Solve for Xeq given Kc
            if (Kc <= 0) throw new Error("Kc must be strictly positive.");

            let objFunc = (x) => {
                let val = K_func(x);
                if (isNaN(val) || !isFinite(val)) return NaN;
                return val - Kc;
            };

            // Sweep range [0.001, 0.999]
            let roots = [];
            try {
                // Modified findAllRoots to only look in (0,1)
                let dx = 1 / 2000;
                let prevX = 0.001;
                let prevY = objFunc(prevX);

                for (let i = 1; i <= 2000; i++) {
                    let currX = 0.001 + i * dx;
                    if (currX >= 1.0) break;
                    let currY = objFunc(currX);

                    if (prevY * currY <= 0) {
                        try {
                            let root = MathSolver.findRoot(objFunc, (prevX + currX) / 2);
                            if (root > 0 && root < 1) roots.push(root);
                        } catch (e) { }
                    }
                    prevX = currX;
                    prevY = currY;
                }
            } catch (e) { }

            if (roots.length === 0) throw new Error("No equilibrium conversion found in (0,1).");

            // Remove duplicates
            let uniqueRoots = Object.keys(roots.reduce((acc, r) => {
                let key = r.toFixed(5);
                acc[key] = parseFloat(key);
                return acc;
            }, {})).map(k => parseFloat(k));

            let result = Math.min(...uniqueRoots); // lowest positive root
            return { K_expr_str, result, solvedFor: 'Xeq' };
        }
    }

    /**
     * Block 5: Rate Model
     * @param {string[]} C_x 
     * @param {number[]} k - [kd] or [kd, ki]
     * @param {number[]} order - array of orders
     * @param {string} mode - 'irreversible' or 'reversible'
     * @returns {string} Ra_x
     */
    function rateModel(C_x, k, order, mode) {
        let n = C_x.length;
        if (mode === 'irreversible') {
            if (k.length !== 1) throw new Error("irreversible mode requires 1 rate constant.");
            if (order.length !== n) throw new Error(`order must have length ${n}.`);

            let parts = [`${k[0]}`];
            for (let i = 0; i < n; i++) {
                if (order[i] !== 0) {
                    let C_i = `(${C_x[i]})`;
                    if (order[i] === 1) parts.push(C_i);
                    else parts.push(`${C_i}^(${order[i]})`);
                }
            }
            return parts.join(' * ');

        } else if (mode === 'reversible') {
            if (k.length !== 2) throw new Error("reversible mode requires k = [kd, ki].");
            if (order.length !== 2 * n) throw new Error(`reversible mode requires orders of length ${2 * n}.`);

            let kd = k[0];
            let ki = k[1];
            let ord_f = order.slice(0, n);
            let ord_r = order.slice(n);

            let fwd_parts = [`${kd}`];
            for (let i = 0; i < n; i++) {
                if (ord_f[i] !== 0) {
                    let C_i = `(${C_x[i]})`;
                    if (ord_f[i] === 1) fwd_parts.push(C_i);
                    else fwd_parts.push(`${C_i}^(${ord_f[i]})`);
                }
            }

            let rev_parts = [`${ki}`];
            for (let i = 0; i < n; i++) {
                if (ord_r[i] !== 0) {
                    let C_i = `(${C_x[i]})`;
                    if (ord_r[i] === 1) rev_parts.push(C_i);
                    else rev_parts.push(`${C_i}^(${ord_r[i]})`);
                }
            }

            return `(${fwd_parts.join(' * ')}) - (${rev_parts.join(' * ')})`;
        } else {
            throw new Error("mode must be 'irreversible' or 'reversible'.");
        }
    }

    /**
     * Determine which variable is NaN and return it.
     */
    function _findUnknown(varNames, varVals) {
        let nanCount = 0;
        let unknownName = null;
        for (let i = 0; i < varVals.length; i++) {
            if (isNaN(varVals[i])) {
                nanCount++;
                unknownName = varNames[i];
            }
        }
        if (nanCount !== 1) {
            throw new Error(`Exactly one unknown is required. Found ${nanCount}.`);
        }
        return unknownName;
    }

    /**
     * Block 6: CSTR Solver
     * V = FA0 * (x - x0) / Ra(x)
     * @returns {Object} { solvedFor, result }
     */
    function cstrSolver(Ra_x_str, x_in, V_in, FA0_in, x0_in = 0) {
        let unknown = _findUnknown(['x', 'V', 'FA0'], [x_in, V_in, FA0_in]);
        let Ra_func = MathParser.compile(Ra_x_str);

        switch (unknown) {
            case 'x':
                let obj = (x) => FA0_in * (x - x0_in) - V_in * Ra_func(x);
                let x_start = x0_in + 1e-6;
                // find bracket
                let root = null;
                try {
                    root = MathSolver.findRoot(obj, (x0_in + 0.9) / 2);
                } catch (e) {
                    // fall back
                    let dx = 1 / 500;
                    let prevX = x_start;
                    let prevY = obj(prevX);
                    for (let i = 1; i <= 500; i++) {
                        let currX = x_start + i * dx;
                        if (currX > 0.9999) break;
                        let currY = obj(currX);
                        if (prevY * currY <= 0) {
                            root = MathSolver.findRoot(obj, (prevX + currX) / 2);
                            break;
                        }
                        prevX = currX;
                        prevY = currY;
                    }
                }
                if (root === null) throw new Error("Could not converge on x.");
                return { solvedFor: 'x', result: root };

            case 'V':
                let Ra_val = Ra_func(x_in);
                if (Ra_val <= 0) throw new Error(`Ra(x) <= 0 at x = ${x_in}.`);
                return { solvedFor: 'V', result: FA0_in * (x_in - x0_in) / Ra_val };

            case 'FA0':
                let Ra_val2 = Ra_func(x_in);
                let dx = x_in - x0_in;
                if (dx === 0) throw new Error("x_in equals x0_in, cannot solve for FA0.");
                return { solvedFor: 'FA0', result: V_in * Ra_val2 / dx };
        }
    }

    /**
     * Block 7: PFR Solver
     * V = FA0 * \int_{x0}^{x} (1/Ra) dx
     * @returns {Object} { solvedFor, result }
     */
    function pfrSolver(Ra_x_str, x_in, V_in, FA0_in, x0_in = 0, n_pts = 300) {
        let unknown = _findUnknown(['x', 'V', 'FA0'], [x_in, V_in, FA0_in]);
        let Ra_func = MathParser.compile(Ra_x_str);
        let integrand = (x) => 1 / Ra_func(x);
        let full_integrand = (x) => FA0_in / Ra_func(x);

        switch (unknown) {
            case 'x':
                let result_x = MathSolver.solveLimit(full_integrand, x0_in, true, V_in);
                return { solvedFor: 'x', result: result_x };

            case 'V':
                let res_v = MathSolver.integrate(full_integrand, x0_in, x_in, n_pts);
                return { solvedFor: 'V', result: res_v };

            case 'FA0':
                let int_val = MathSolver.integrate(integrand, x0_in, x_in, n_pts);
                if (Math.abs(int_val) < 1e-15) throw new Error("Integral of 1/Ra is zero.");
                return { solvedFor: 'FA0', result: V_in / int_val };
        }
    }

    /**
     * Block 8: Batch Reactor Solver
     * t = CA0 * \int_{x0}^{x} (1/Ra) dx
     */
    function batchSolver(Ra_x_str, x_in, t_in, CA0_in, x0_in = 0, n_pts = 300) {
        let unknown = _findUnknown(['x', 't', 'CA0'], [x_in, t_in, CA0_in]);
        let Ra_func = MathParser.compile(Ra_x_str);
        let inv_Ra = (x) => 1 / Ra_func(x);

        switch (unknown) {
            case 'x':
                let target = t_in / CA0_in;
                let res_x = MathSolver.solveLimit(inv_Ra, x0_in, true, target);
                return { solvedFor: 'x', result: res_x };

            case 't':
                let int_val_t = MathSolver.integrate(inv_Ra, x0_in, x_in, n_pts);
                return { solvedFor: 't', result: CA0_in * int_val_t };

            case 'CA0':
                let int_val_c = MathSolver.integrate(inv_Ra, x0_in, x_in, n_pts);
                if (Math.abs(int_val_c) < 1e-15) throw new Error("Integral of 1/Ra is zero.");
                return { solvedFor: 'CA0', result: t_in / int_val_c };
        }
    }

    /**
     * Block 9: Simpson 3/8
     */
    function simpson38Block(f_str, a, b, n = 300, targetArea = NaN) {
        let f = MathParser.compile(f_str);

        if (!isNaN(a) && !isNaN(b)) {
            // Mode 1: Compute integral
            return { result: MathSolver.integrate(f, a, b, n), solvedFor: 'integral' };
        } else if (isNaN(b) && !isNaN(a) && !isNaN(targetArea)) {
            // Mode 2: Solve for upper limit b
            return { result: MathSolver.solveLimit(f, a, true, targetArea), solvedFor: 'b' };
        } else if (isNaN(a) && !isNaN(b) && !isNaN(targetArea)) {
            // Mode 3: Solve for lower limit a
            return { result: MathSolver.solveLimit(f, b, false, targetArea), solvedFor: 'a' };
        } else {
            throw new Error("Invalid formulation for Simpson Block.");
        }
    }

    return {
        limitingReactant,
        normalizeStoich,
        stoichTable,
        equilibriumSolver,
        rateModel,
        cstrSolver,
        pfrSolver,
        batchSolver,
        simpson38Block
    };
})();

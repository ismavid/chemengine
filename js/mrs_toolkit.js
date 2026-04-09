/**
 * mrs_toolkit.js — Multiple Reaction Systems engine for ChemEngine.
 * Handles Batch, PFR, CSTR, concentration profiles, and metrics.
 * Numerical approach: RK4 for Batch/PFR, Newton-Raphson iteration for CSTR.
 */
'use strict';

window.MRSToolkit = (() => {

    // ─── Network Parser ────────────────────────────────────────────────────────

    /**
     * Parse and validate the reaction network definition.
     * @param {string} speciesStr  "CS, CP, CR, CZ, CW"
     * @param {string} ratesStr    one rate expression per line, same order as species
     * @param {string} kValsStr    "k1=0.01, k2=0.005, k3=0.008"
     * @param {string} C0Str       "1.0, 0.0, 0.0, 0.5, 0.0"
     * @returns {Object} network: { species[], rateExprs[], kVals{}, C0[], rateFn }
     */
    function parseNetwork(speciesStr, ratesStr, kValsStr, C0Str) {
        const species = speciesStr.split(',').map(s => s.trim()).filter(Boolean);
        const rateExprs = ratesStr.split('\n').map(s => s.trim()).filter(Boolean);
        const C0 = C0Str.split(',').map(s => parseFloat(s.trim()));

        if (species.length === 0) throw new Error('No species defined.');
        if (rateExprs.length !== species.length)
            throw new Error(`Expected ${species.length} rate expressions, got ${rateExprs.length}.`);
        if (C0.length !== species.length)
            throw new Error(`Expected ${species.length} initial concentrations, got ${C0.length}.`);
        if (C0.some(isNaN)) throw new Error('Invalid initial concentration value.');

        // Parse k values: "k1=0.01, k2=0.005"
        const kVals = {};
        kValsStr.split(',').forEach(pair => {
            const [k, v] = pair.split('=').map(s => s.trim());
            if (k && v !== undefined) {
                const num = parseFloat(v);
                if (isNaN(num)) throw new Error(`Invalid value for ${k}: ${v}`);
                kVals[k] = num;
            }
        });

        // Build rate function: C[] → r[]
        const rateFn = buildRateFn(species, rateExprs, kVals);

        // Validate rate expressions at C0
        const testR = rateFn(C0);
        if (testR.some(isNaN)) throw new Error('Rate expression returned NaN at initial conditions. Check your formulas.');

        return { species, rateExprs, kVals, C0, rateFn };
    }

    function buildRateFn(species, rateExprs, kVals) {
        const kKeys = Object.keys(kVals);
        const kVals_arr = kKeys.map(k => kVals[k]);

        // Pre-compile rate functions for performance
        const fns = rateExprs.map((expr, i) => {
            try {
                return new Function(...species, ...kKeys, `return (${expr});`);
            } catch (e) {
                throw new Error(`Syntax error in rate r${i + 1}: ${expr}`);
            }
        });

        return function (C) {
            return fns.map(fn => {
                try {
                    const val = fn(...C, ...kVals_arr);
                    return typeof val === 'number' ? val : NaN;
                } catch (e) {
                    return NaN;
                }
            });
        };
    }

    // ─── RK4 ODE Solver (Batch & PFR) ─────────────────────────────────────────

    /**
     * Solve dCi/dz = rateFn(C) using RK4.
     * For Batch: z = t, rateFn returns ri directly.
     * For PFR:   z = V, rateFn returns ri/v0 (caller divides before passing).
     * @param {Function} rateFn  C[] → r[]
     * @param {number[]} C0      initial concentrations
     * @param {number[]} span    [z0, zf]
     * @param {number}   nSteps  number of integration steps
     * @returns {{ z: number[], C: number[][] }}  C[step][species]
     */
    function rk4Solve(rateFn, C0, span, nSteps) {
        const h = (span[1] - span[0]) / nSteps;
        const n = C0.length;
        const zArr = [span[0]];
        const CArr = [C0.slice()];

        let Ccur = C0.slice();
        for (let i = 0; i < nSteps; i++) {
            const k1 = rateFn(Ccur);
            const C2 = Ccur.map((c, j) => c + h / 2 * k1[j]);
            const k2 = rateFn(C2);
            const C3 = Ccur.map((c, j) => c + h / 2 * k2[j]);
            const k3 = rateFn(C3);
            const C4 = Ccur.map((c, j) => c + h * k3[j]);
            const k4 = rateFn(C4);
            Ccur = Ccur.map((c, j) => Math.max(0, c + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])));
            zArr.push(span[0] + (i + 1) * h);
            CArr.push(Ccur.slice());
        }
        return { z: zArr, C: CArr };
    }

    /**
     * Run Batch reactor simulation.
     * @param {Object} network  from parseNetwork()
     * @param {number[]} tSpan  [t0, tf]
     * @param {number} nSteps
     * @returns {{ t, C, species }}
     */
    function batchProfile(network, tSpan, nSteps) {
        const { rateFn, C0, species } = network;
        const result = rk4Solve(rateFn, C0, tSpan, nSteps);
        return { t: result.z, C: result.C, species };
    }

    /**
     * Run PFR reactor simulation.
     * @param {Object} network  from parseNetwork()
     * @param {number[]} vSpan  [0, Vf]
     * @param {number} v0       volumetric flow rate
     * @param {number} nSteps
     * @returns {{ V, C, species }}
     */
    function pfrProfile(network, vSpan, v0, nSteps) {
        const { rateFn, C0, species } = network;
        if (v0 <= 0) throw new Error('v0 must be positive.');
        const pfrRateFn = (C) => rateFn(C).map(r => r / v0);
        const result = rk4Solve(pfrRateFn, C0, vSpan, nSteps);
        return { V: result.z, C: result.C, species };
    }

    // ─── CSTR Algebraic Solver ─────────────────────────────────────────────────

    /**
     * Solve CSTR steady-state: Ci0 - Ci + ri(C)*tau = 0 for all i.
     * Uses successive substitution (fixed-point) then refines with Newton-Raphson.
     * @param {Object} network  from parseNetwork()
     * @param {number} tau      residence time
     * @returns {{ C: number[], species: string[] }}
     */
    function cstrSolve(network, tau) {
        const { rateFn, C0, species } = network;
        if (tau < 0) throw new Error('tau must be non-negative.');

        // Fixed-point iteration: Ci = Ci0 + ri(C)*tau
        let C = C0.slice();
        const maxIter = 500;
        const tol = 1e-10;

        for (let iter = 0; iter < maxIter; iter++) {
            const r = rateFn(C);
            const Cnew = C0.map((c0, i) => Math.max(0, c0 + r[i] * tau));
            const err = Math.max(...Cnew.map((c, i) => Math.abs(c - C[i])));
            C = Cnew;
            if (err < tol) break;
        }

        // Newton-Raphson refinement
        C = newtonCSTR(rateFn, C0, tau, C);
        return { C, species };
    }

    function newtonCSTR(rateFn, C0, tau, Cinit) {
        let C = Cinit.slice();
        const n = C.length;
        const tol = 1e-12;
        const maxIter = 100;
        const h = 1e-7;

        for (let iter = 0; iter < maxIter; iter++) {
            const r = rateFn(C);
            // F(C) = Ci0 - Ci + ri(C)*tau
            const F = C0.map((c0, i) => c0 - C[i] + r[i] * tau);
            const norm = Math.sqrt(F.reduce((s, f) => s + f * f, 0));
            if (norm < tol) break;

            // Jacobian: dFi/dCj = -delta_ij + tau * d(ri)/d(Cj)
            const J = Array.from({ length: n }, (_, i) =>
                Array.from({ length: n }, (_, j) => {
                    const Cp = C.slice(); Cp[j] += h;
                    const Cm = C.slice(); Cm[j] -= h;
                    const drij = (rateFn(Cp)[i] - rateFn(Cm)[i]) / (2 * h);
                    return (i === j ? -1 : 0) + tau * drij;
                })
            );

            const dC = solveLinear(J, F);
            if (!dC) break;
            C = C.map((c, i) => Math.max(0, c + dC[i]));
        }
        return C;
    }

    // Simple Gaussian elimination
    function solveLinear(A, b) {
        const n = A.length;
        const M = A.map((row, i) => [...row, b[i]]);
        for (let col = 0; col < n; col++) {
            let maxRow = col;
            for (let row = col + 1; row < n; row++)
                if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
            [M[col], M[maxRow]] = [M[maxRow], M[col]];
            if (Math.abs(M[col][col]) < 1e-14) return null;
            for (let row = col + 1; row < n; row++) {
                const f = M[row][col] / M[col][col];
                for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k];
            }
        }
        const x = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = M[i][n] / M[i][i];
            for (let j = i + 1; j < n; j++) x[i] -= M[i][j] / M[i][i] * x[j];
        }
        return x;
    }

    /**
     * Sweep tau over a range and solve CSTR at each point.
     * @param {Object} network
     * @param {number[]} tauSpan  [0, tau_max]
     * @param {number} nSteps
     * @returns {{ tau: number[], C: number[][], species: string[] }}
     */
    function cstrSweep(network, tauSpan, nSteps) {
        const tauArr = [];
        const CArr = [];
        for (let i = 0; i <= nSteps; i++) {
            const tau = tauSpan[0] + i * (tauSpan[1] - tauSpan[0]) / nSteps;
            tauArr.push(tau);
            try {
                const { C } = cstrSolve(network, tau);
                CArr.push(C);
            } catch (_) {
                CArr.push(network.C0.map(() => NaN));
            }
        }
        return { tau: tauArr, C: CArr, species: network.species };
    }

    // ─── Optimum Finder ────────────────────────────────────────────────────────

    /**
     * Find the maximum of species[targetIdx] over z array.
     * Returns { zOpt, Cmax, Copt[] } or null if no interior max.
     * @param {number[]} zArr
     * @param {number[][]} CArr  C[step][species]
     * @param {number} targetIdx
     */
    function findOptimum(zArr, CArr, targetIdx) {
        const vals = CArr.map(c => c[targetIdx]);
        let maxVal = -Infinity, maxIdx = -1;
        for (let i = 0; i < vals.length; i++) {
            if (vals[i] > maxVal) { maxVal = vals[i]; maxIdx = i; }
        }
        return { zOpt: zArr[maxIdx], Cmax: maxVal, Copt: CArr[maxIdx] };
    }

    // ─── Metrics ───────────────────────────────────────────────────────────────

    /**
     * Compute selectivity and yield metrics.
     * @param {number[]} C_ini  initial concentrations
     * @param {number[]} C_fin  final concentrations
     * @param {string[]} species
     * @param {string[]} sPairs  [['CP','CW'], ...] for S̃(D/U) = C_D_fin / C_U_fin
     * @param {string[]} yPairs  [['CP','CS'], ...] for Ỹ(D) = C_D_fin / (C_A0 - C_A_fin)
     * @returns {string[]} lines of results
     */
    function calcMetrics(C_ini, C_fin, species, sPairs, yPairs) {
        const idx = name => species.indexOf(name);
        const lines = [];

        if (sPairs && sPairs.length > 0) {
            lines.push('── Selectivity  S̃(D/U) = C_D(tf) / C_U(tf) ──');
            sPairs.forEach(([D, U]) => {
                const iD = idx(D), iU = idx(U);
                if (iD < 0 || iU < 0) { lines.push(`  [!] Species not found: ${D}/${U}`); return; }
                const Cu = C_fin[iU];
                if (Cu === 0) lines.push(`  S̃(${D}/${U}) = ∞  (C_${U}(tf) = 0)`);
                else lines.push(`  S̃(${D}/${U}) = ${(C_fin[iD] / Cu).toFixed(4)}  [C_${D}=${C_fin[iD].toFixed(4)} / C_${U}=${Cu.toFixed(4)}]`);
            });
        }

        if (yPairs && yPairs.length > 0) {
            lines.push('── Yield  Ỹ(D) = C_D(tf) / (C_A0 − C_A(tf)) ──');
            yPairs.forEach(([D, A]) => {
                const iD = idx(D), iA = idx(A);
                if (iD < 0 || iA < 0) { lines.push(`  [!] Species not found: ${D}/${A}`); return; }
                const dA = C_ini[iA] - C_fin[iA];
                if (dA <= 0) lines.push(`  Ỹ(${D}) = N/A  (${A} not consumed)`);
                else lines.push(`  Ỹ(${D}/${A}) = ${(C_fin[iD] / dA).toFixed(4)}  [C_${D}=${C_fin[iD].toFixed(4)} / ΔC_${A}=${dA.toFixed(4)}]`);
            });
        }

        return lines;
    }

    // ─── SVG Plotter ──────────────────────────────────────────────────────────

    const COLORS = [
        '#3b82f6', '#f59e0b', '#10b981', '#ef4444',
        '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'
    ];

    /**
     * Generate an inline SVG concentration profile chart.
     * @param {number[]} xArr        x-axis values (t, V, or tau)
     * @param {number[][]} CArr      CArr[step][species]
     * @param {string[]} names       species names
     * @param {string} xlabel        axis label
     * @param {string} title
     * @param {Object|null} optimum  { zOpt, Cmax, targetIdx }
     * @returns {string} SVG markup
     */
    function svgPlot(xArr, CArr, names, xlabel, title, optimum = null) {
        const W = 560, H = 300;
        const pad = { top: 28, right: 20, bottom: 48, left: 52 };
        const pw = W - pad.left - pad.right;
        const ph = H - pad.top - pad.bottom;

        const n = names.length;
        const nPts = xArr.length;

        // Data ranges
        const xMin = xArr[0], xMax = xArr[nPts - 1];
        let yMin = 0;
        let yMax = 0;
        names.forEach((_, si) => {
            CArr.forEach(c => { if (c[si] > yMax) yMax = c[si]; });
        });
        yMax = yMax * 1.1 || 1;

        const sx = v => pad.left + (v - xMin) / (xMax - xMin) * pw;
        const sy = v => pad.top + ph - (v - yMin) / (yMax - yMin) * ph;

        // Axis ticks
        function niceTicks(min, max, count = 5) {
            const range = max - min;
            const step = Math.pow(10, Math.floor(Math.log10(range / count)));
            const ticks = [];
            let t = Math.ceil(min / step) * step;
            while (t <= max + step * 0.01) { ticks.push(+t.toPrecision(4)); t += step; }
            return ticks;
        }
        const xTicks = niceTicks(xMin, xMax);
        const yTicks = niceTicks(yMin, yMax);

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="font-family:var(--font-sans,Inter,sans-serif);max-width:100%">`;

        // Background
        svg += `<rect width="${W}" height="${H}" fill="var(--bg-card,#fff)" rx="8"/>`;

        // Title
        svg += `<text x="${W / 2}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="var(--text-primary,#111)">${title}</text>`;

        // Clip region
        svg += `<defs><clipPath id="cp"><rect x="${pad.left}" y="${pad.top}" width="${pw}" height="${ph}"/></clipPath></defs>`;

        // Grid lines
        yTicks.forEach(t => {
            const y = sy(t);
            svg += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + pw}" y2="${y}" stroke="var(--border,#e5e7eb)" stroke-width="1"/>`;
        });

        // Concentration lines (clipped)
        svg += `<g clip-path="url(#cp)">`;
        names.forEach((name, si) => {
            const pts = xArr.map((x, xi) => `${sx(x).toFixed(1)},${sy(CArr[xi][si]).toFixed(1)}`).join(' ');
            svg += `<polyline points="${pts}" fill="none" stroke="${COLORS[si % COLORS.length]}" stroke-width="2.2" stroke-linejoin="round"/>`;
        });

        // Optimum marker
        if (optimum) {
            const ox = sx(optimum.zOpt), oy = sy(optimum.Cmax);
            svg += `<line x1="${ox}" y1="${pad.top}" x2="${ox}" y2="${pad.top + ph}" stroke="#111" stroke-width="1" stroke-dasharray="4,3" opacity="0.4"/>`;
            svg += `<circle cx="${ox}" cy="${oy}" r="5" fill="${COLORS[optimum.targetIdx % COLORS.length]}" stroke="#fff" stroke-width="1.5"/>`;
            const labelX = ox + 8 > pad.left + pw - 60 ? ox - 8 : ox + 8;
            const anchor = ox + 8 > pad.left + pw - 60 ? 'end' : 'start';
            svg += `<text x="${labelX}" y="${Math.max(oy - 6, pad.top + 12)}" font-size="10" fill="#111" text-anchor="${anchor}" font-weight="600">${optimum.zOpt.toFixed(1)}, ${optimum.Cmax.toFixed(3)}</text>`;
        }
        svg += `</g>`;

        // Axes
        svg += `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + ph}" stroke="var(--text-muted,#888)" stroke-width="1.5"/>`;
        svg += `<line x1="${pad.left}" y1="${pad.top + ph}" x2="${pad.left + pw}" y2="${pad.top + ph}" stroke="var(--text-muted,#888)" stroke-width="1.5"/>`;

        // X ticks & labels
        xTicks.forEach(t => {
            const x = sx(t);
            svg += `<line x1="${x}" y1="${pad.top + ph}" x2="${x}" y2="${pad.top + ph + 4}" stroke="var(--text-muted,#888)" stroke-width="1"/>`;
            svg += `<text x="${x}" y="${pad.top + ph + 16}" text-anchor="middle" font-size="10" fill="var(--text-muted,#888)">${t}</text>`;
        });

        // Y ticks & labels
        yTicks.forEach(t => {
            const y = sy(t);
            svg += `<line x1="${pad.left - 4}" y1="${y}" x2="${pad.left}" y2="${y}" stroke="var(--text-muted,#888)" stroke-width="1"/>`;
            svg += `<text x="${pad.left - 7}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="var(--text-muted,#888)">${t}</text>`;
        });

        // Axis labels
        svg += `<text x="${pad.left + pw / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="var(--text-secondary,#555)">${xlabel}</text>`;
        svg += `<text x="${14}" y="${pad.top + ph / 2}" text-anchor="middle" font-size="11" fill="var(--text-secondary,#555)" transform="rotate(-90,14,${pad.top + ph / 2})">Cᵢ (mol/L)</text>`;

        // Legend
        const legX = pad.left + 6, legY0 = pad.top + 8;
        const legRows = Math.ceil(n / 3);
        names.forEach((name, si) => {
            const col = si % 3, row = Math.floor(si / 3);
            const lx = legX + col * 80, ly = legY0 + row * 14;
            svg += `<rect x="${lx}" y="${ly - 6}" width="12" height="4" rx="2" fill="${COLORS[si % COLORS.length]}"/>`;
            svg += `<text x="${lx + 16}" y="${ly}" font-size="10" fill="var(--text-secondary,#555)">${name}</text>`;
        });

        svg += `</svg>`;
        return svg;
    }

    // ─── Public API ────────────────────────────────────────────────────────────

    return { parseNetwork, batchProfile, pfrProfile, cstrSolve, cstrSweep, findOptimum, calcMetrics, svgPlot };

})();

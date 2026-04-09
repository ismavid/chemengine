/**
 * ui_cre.js — CRE Toolkit UI wrapper
 * Generates and handles the Reactions Engineering Toolkit blocks dynamically.
 */
'use strict';

const CreUI = (() => {

    const BLOCKS = [
        {
            id: 'b1', title: '1. Limiting Reactant',
            desc: 'Identifies the limiting reactant from stoichiometry and initial molar flows.',
            latex: 'idx_{LR} = \\arg\\min_{i: \\nu_i < 0} \\left( \\frac{F_{i0}}{|\\nu_i|} \\right)',
            inputs: [
                { key: 'nu', label: 'Stoichiometric coefficients (nu)', placeholder: '-1, -1, 2' },
                { key: 'F0', label: 'Initial molar flows (F0)', placeholder: '74.9, 28, 0.9' }
            ],
            run: (inputs) => {
                const nu = inputs.nu.split(',').map(n => Number(n.trim()));
                const F0 = inputs.F0.split(',').map(n => Number(n.trim()));
                const res = CREToolkit.limitingReactant(nu, F0);
                return {
                    text: `idx_LR = ${res.idx_LR}\nRatios = [${res.ratios.map(r => r !== null ? r.toFixed(4) : '-').join(', ')}]`,
                    exports: { 'b1.idx_LR': res.idx_LR, 'b1.nu': inputs.nu }
                };
            }
        },
        {
            id: 'b2', title: '2. Normalize Stoichiometry',
            desc: 'Rescales stoichiometric vector so limiting reactant coefficient = -1 and moves it to position 1.',
            latex: '\\nu_{norm} = \\frac{\\nu}{|\\nu_{LR}|}',
            inputs: [
                { key: 'nu', label: 'Stoichiometric coefficients (nu)', placeholder: '-1, -1, 2', linkOption: { label: 'Use input from Block 1', var: 'b1.nu' } },
                { key: 'idx_LR', label: 'Index of limiting reactant (idx_LR)', placeholder: '1', linkOption: { label: 'Use output from Block 1', var: 'b1.idx_LR' } },
            ],
            run: (inputs) => {
                const nu = inputs.nu.split(',').map(n => Number(n.trim()));
                const idx = Number(inputs.idx_LR);
                const res = CREToolkit.normalizeStoich(nu, idx);
                const nu_norm_str = res.nu_norm.map(v => Number(v.toFixed(4))).join(', ');
                return {
                    text: `nu_norm = [${nu_norm_str}]\nreorder = [${res.reorder_idx.join(', ')}]`,
                    exports: { 'b2.nu_norm': nu_norm_str }
                };
            }
        },
        {
            id: 'b3', title: '3. Stoichiometric Table C(x)',
            desc: 'Generates symbolic concentration expressions C_i(x) as functions of conversion.',
            latex: 'C_i(x) = C_{A0} \\frac{\\Theta_i + \\nu_i x}{1 + \\varepsilon x} \\left( \\frac{P}{P_0} \\right) \\left( \\frac{T_0}{T} \\right)',
            inputs: [
                { key: 'nu_norm', label: 'Normalized stoich vector (nu_norm)', placeholder: '-1, -1, 2', linkOption: { label: 'Use output from Block 2', var: 'b2.nu_norm' } },
                { key: 'feed_frac', label: 'Feed molar fractions/flows (comma-sep)', placeholder: '28, 74.9, 0.9' },
                { key: 'C_LR0', label: 'Initial concentration of LR (C_LR0)', placeholder: '0.5' },
                { key: 'volume_mode', label: 'Volume Mode', isDropdown: true, options: ['constant', 'variable'] },
                { key: 'P_ratio', label: 'P/P0 (variable mode only)', placeholder: '1', default: '1' },
                { key: 'T_ratio', label: 'T0/T (variable mode only)', placeholder: '1', default: '1' }
            ],
            run: (inputs) => {
                const nu_norm = inputs.nu_norm.split(',').map(n => Number(n.trim()));
                const feed_frac = inputs.feed_frac.split(',').map(n => Number(n.trim()));
                const clro = Number(inputs.C_LR0);
                const opts = { P_ratio: Number(inputs.P_ratio), T_ratio: Number(inputs.T_ratio) };
                const cx = CREToolkit.stoichTable(nu_norm, feed_frac, clro, inputs.volume_mode, opts);
                return {
                    text: cx.map((expr, i) => `C_${i + 1}(x) = ${expr}`).join('\n'),
                    exports: { 'b3.C_x': cx.join(', ') }
                };
            }
        },
        {
            id: 'b4', title: '4. Equilibrium Conversion',
            desc: 'Solves for equilibrium conversion Xeq given Kc, or solves for Kc given Xeq.',
            latex: 'K_c = \\prod C_i(x)^{\\nu_i}',
            inputs: [
                { key: 'nu_norm', label: 'Normalized stoich vector (nu_norm)', linkOption: { label: 'Use output from Block 2', var: 'b2.nu_norm' } },
                { key: 'Kc', label: 'Equilibrium constant (Kc)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'C_x', label: 'Symbolic C(x) vector (comma-separated)', linkOption: { label: 'Use output from Block 3', var: 'b3.C_x' } },
                { key: 'Xeq_known', label: 'Known Xeq (only if Kc is NaN)', placeholder: '← solve for this', isSolveTarget: true }
            ],
            run: (inputs) => {
                const nu_norm = inputs.nu_norm.split(',').map(n => Number(n.trim()));
                const kc = inputs.Kc.trim() === '' || inputs.Kc === 'NaN' ? NaN : parseFloat(inputs.Kc);
                const cx = inputs.C_x.split(',').map(s => s.trim());
                const xeq = inputs.Xeq_known.trim() === '' || inputs.Xeq_known === 'NaN' ? NaN : parseFloat(inputs.Xeq_known);

                const res = CREToolkit.equilibriumSolver(nu_norm, kc, cx, xeq);
                return { text: `K(x) = ${res.K_expr_str}\n${res.solvedFor} = ${Number(res.result.toFixed(6))}` };
            }
        },
        {
            id: 'b5', title: '5. Reaction Rate Model',
            desc: 'Builds the rate expression Ra(x) for irreversible or reversible reactions.',
            latex: '-r_A = k_d \\prod C_i^{m_i} - k_i \\prod C_j^{m_j}',
            inputs: [
                { key: 'C_x', label: 'Symbolic C(x) vector (comma-separated)', linkOption: { label: 'Use output from Block 3', var: 'b3.C_x' } },
                { key: 'k', label: 'Rate constant(s) (kd, ki)', placeholder: '0.1 (irrev) or 0.1, 0.05 (rev)' },
                { key: 'order', label: 'Reaction orders (comma-sep)', placeholder: '1, 1, 0' },
                { key: 'mode', label: 'Reaction Mode', isDropdown: true, options: ['irreversible', 'reversible'] }
            ],
            run: (inputs) => {
                const cx = inputs.C_x.split(',').map(s => s.trim());
                const k = inputs.k.split(',').map(n => Number(n.trim()));
                const order = inputs.order.split(',').map(n => Number(n.trim()));
                const rx = CREToolkit.rateModel(cx, k, order, inputs.mode);
                return {
                    text: `Ra_x = ${rx}`,
                    exports: { 'b5.Ra_x': rx }
                };
            }
        },
        {
            id: 'b6', title: '6. CSTR Solver',
            desc: 'Solves the CSTR design equation V = FA0·(x-x0)/Ra(x) for one unknown.',
            latex: 'V = \\frac{F_{A0} (x - x_0)}{-r_A(x)}',
            inputs: [
                { key: 'Ra_x', label: 'Rate expression Ra(x)', linkOption: { label: 'Use output from Block 5', var: 'b5.Ra_x' } },
                { key: 'x', label: 'Outlet conversion (x)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'V', label: 'Reactor volume (V)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'FA0', label: 'Inlet molar flow (FA0)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'x0', label: 'Inlet conversion (x0)', placeholder: '0', default: '0' }
            ],
            run: (inputs) => {
                const rx = inputs.Ra_x;
                const x = inputs.x.trim() === '' ? NaN : parseFloat(inputs.x);
                const v = inputs.V.trim() === '' ? NaN : parseFloat(inputs.V);
                const f = inputs.FA0.trim() === '' ? NaN : parseFloat(inputs.FA0);
                const x0 = parseFloat(inputs.x0);
                const res = CREToolkit.cstrSolver(rx, x, v, f, x0);
                return { text: `${res.solvedFor} = ${Number(res.result.toFixed(6))}` };
            }
        },
        {
            id: 'b7', title: '7. PFR Solver',
            desc: 'Solves the PFR design equation V = FA0·∫(1/Ra)dx for one unknown.',
            latex: 'V = F_{A0} \\int_{x_0}^x \\frac{dx}{-r_A(x)}',
            inputs: [
                { key: 'Ra_x', label: 'Rate expression Ra(x)', linkOption: { label: 'Use output from Block 5', var: 'b5.Ra_x' } },
                { key: 'x', label: 'Outlet conversion (x)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'V', label: 'Reactor volume (V)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'FA0', label: 'Inlet molar flow (FA0)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'x0', label: 'Inlet conversion (x0)', placeholder: '0', default: '0' },
                { key: 'n', label: 'Integration subintervals (n)', placeholder: '300', default: '300' }
            ],
            run: (inputs) => {
                const rx = inputs.Ra_x;
                const x = inputs.x.trim() === '' ? NaN : parseFloat(inputs.x);
                const v = inputs.V.trim() === '' ? NaN : parseFloat(inputs.V);
                const f = inputs.FA0.trim() === '' ? NaN : parseFloat(inputs.FA0);
                const res = CREToolkit.pfrSolver(rx, x, v, f, parseFloat(inputs.x0), parseFloat(inputs.n));
                return { text: `${res.solvedFor} = ${Number(res.result.toFixed(6))}` };
            }
        },
        {
            id: 'b8', title: '8. Batch Reactor Solver',
            desc: 'Solves the batch design equation t = CA0·∫(1/Ra)dx for one unknown.',
            latex: 't = C_{A0} \\int_{x_0}^x \\frac{dx}{-r_A(x)}',
            inputs: [
                { key: 'Ra_x', label: 'Rate expression Ra(x)', linkOption: { label: 'Use output from Block 5', var: 'b5.Ra_x' } },
                { key: 'x', label: 'Conversion at time t (x)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 't', label: 'Reaction time (t)', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'CA0', label: 'Initial concentration CA0', placeholder: '← solve for this', isSolveTarget: true },
                { key: 'V', label: 'Volume V (optional)', placeholder: '' },
                { key: 'x0', label: 'Initial conversion (x0)', placeholder: '0', default: '0' },
                { key: 'n', label: 'Integration subintervals (n)', placeholder: '300', default: '300' }
            ],
            run: (inputs) => {
                const rx = inputs.Ra_x;
                const x = inputs.x.trim() === '' ? NaN : parseFloat(inputs.x);
                const t = inputs.t.trim() === '' ? NaN : parseFloat(inputs.t);
                const c = inputs.CA0.trim() === '' ? NaN : parseFloat(inputs.CA0);
                const res = CREToolkit.batchSolver(rx, x, t, c, parseFloat(inputs.x0), parseFloat(inputs.n));
                return { text: `${res.solvedFor} = ${Number(res.result.toFixed(6))}` };
            }
        },

        // ══════════════════════════════════════════════════════════════
        //  MULTIPLE REACTION SYSTEMS (MRS)
        //  Ref: Fogler Cap. 5–6, redes de reacción lineal
        // ══════════════════════════════════════════════════════════════

        {
            id: 'mrs1', title: 'MRS-1. Define Reaction Network',
            section: 'Multiple Reaction Systems',
            desc: 'Define species, net rate laws rᵢ(C), rate constants k, and initial concentrations C₀. Rate expressions use JavaScript syntax (*, **, Math.exp, etc.).',
            latex: '\\frac{dC_i}{dt} = r_i(\\mathbf{C}, \\mathbf{k})',
            inputs: [
                { key: 'species', label: 'Species names (comma-separated)', placeholder: 'CS, CP, CR, CZ, CW', default: 'CS, CP, CR, CZ, CW' },
                { key: 'rates', label: 'Net rate rᵢ per species (one per line, same order)', placeholder: '-(k1+k2)*CS\nk2*CS - (k3+k4)*CP\nk1*CS + k3*CP + k5*CZ\n-k5*CZ\nk4*CP', isTextarea: true, rows: 6, default: '-(k1+k2)*CS\nk2*CS - (k3+k4)*CP\nk1*CS + k3*CP + k5*CZ\n-k5*CZ\nk4*CP' },
                { key: 'k_vals', label: 'Rate constants (k_name=value, comma-separated)', placeholder: 'k1=0.010, k2=0.005, k3=0.008, k4=0.012, k5=0.020', default: 'k1=0.010, k2=0.005, k3=0.008, k4=0.012, k5=0.020' },
                { key: 'C0', label: 'Initial concentrations Cᵢ₀ (comma-separated, mol/L)', placeholder: '1.0, 0.0, 0.0, 0.5, 0.0', default: '1.0, 0.0, 0.0, 0.5, 0.0' }
            ],
            run: (inputs) => {
                const net = MRSToolkit.parseNetwork(inputs.species, inputs.rates, inputs.k_vals, inputs.C0);
                const specList = net.species.join(', ');
                const C0List = net.C0.map((c, i) => `${net.species[i]}₀ = ${c}`).join(', ');
                const kList = Object.entries(net.kVals).map(([k, v]) => `${k} = ${v}`).join(', ');
                return {
                    text: `Network OK — ${net.species.length} species\nSpecies: ${specList}\nC₀: ${C0List}\nk: ${kList}`,
                    exports: { 'mrs1.network': JSON.stringify({ species: net.species, rateExprs: net.rateExprs, kVals: net.kVals, C0: net.C0 }) }
                };
            }
        },

        {
            id: 'mrs2', title: 'MRS-2. Batch Reactor — Concentration Profile',
            section: 'Multiple Reaction Systems',
            desc: 'Integrates dCᵢ/dt = rᵢ(C) numerically (RK4) and plots the profile. Identifies optimum time for the target species.',
            latex: '\\frac{dC_i}{dt} = r_i(\\mathbf{C})',
            inputs: [
                { key: 'network', label: 'Reaction network (from MRS-1)', placeholder: 'Run MRS-1 first', linkOption: { label: 'Use network from MRS-1', var: 'mrs1.network' } },
                { key: 't_span', label: 'Time span [t0, tf]', placeholder: '0, 300', default: '0, 300' },
                { key: 'target', label: 'Target species (for optimum)', placeholder: 'CP', default: 'CP' },
                { key: 'n_steps', label: 'RK4 steps', placeholder: '600', default: '600' }
            ],
            run: (inputs) => {
                const net = loadNetwork(inputs.network);
                const span = inputs.t_span.split(',').map(Number);
                const nSteps = parseInt(inputs.n_steps) || 600;
                const { t, C, species } = MRSToolkit.batchProfile(net, span, nSteps);
                const tidx = species.indexOf(inputs.target.trim());
                const opt = MRSToolkit.findOptimum(t, C, tidx < 0 ? 0 : tidx);
                const finalC = C[C.length - 1];
                const svg = MRSToolkit.svgPlot(t, C, species, 't (s)', 'Batch — Cᵢ vs t', tidx >= 0 ? { zOpt: opt.zOpt, Cmax: opt.Cmax, targetIdx: tidx } : null);
                const summary = finalC.map((c, i) => `  ${species[i]}(tf) = ${c.toFixed(5)} mol/L`).join('\n');
                let optStr = tidx >= 0 ? `\nOptimum ${species[tidx]}: t_opt = ${opt.zOpt.toFixed(2)} s, C_max = ${opt.Cmax.toFixed(5)} mol/L` : '';
                return { text: `Final concentrations (t = ${span[1]}):\n${summary}${optStr}`, html: svg, exports: { 'mrs2.C_fin': JSON.stringify(finalC), 'mrs2.C_ini': JSON.stringify(C[0]) } };
            }
        },

        {
            id: 'mrs3', title: 'MRS-3. PFR — Concentration Profile',
            section: 'Multiple Reaction Systems',
            desc: 'Integrates dCᵢ/dV = rᵢ/v₀ numerically (RK4). Same structure as Batch but independent variable is reactor volume V.',
            latex: '\\frac{dC_i}{dV} = \\frac{r_i(\\mathbf{C})}{v_0}',
            inputs: [
                { key: 'network', label: 'Reaction network (from MRS-1)', placeholder: 'Run MRS-1 first', linkOption: { label: 'Use network from MRS-1', var: 'mrs1.network' } },
                { key: 'V_span', label: 'Volume span [0, Vf] (L)', placeholder: '0, 300', default: '0, 300' },
                { key: 'v0', label: 'Volumetric flow rate v₀ (L/s)', placeholder: '1.0', default: '1.0' },
                { key: 'target', label: 'Target species (for optimum)', placeholder: 'CP', default: 'CP' },
                { key: 'n_steps', label: 'RK4 steps', placeholder: '600', default: '600' }
            ],
            run: (inputs) => {
                const net = loadNetwork(inputs.network);
                const span = inputs.V_span.split(',').map(Number);
                const v0 = parseFloat(inputs.v0) || 1;
                const nSteps = parseInt(inputs.n_steps) || 600;
                const { V, C, species } = MRSToolkit.pfrProfile(net, span, v0, nSteps);
                const tidx = species.indexOf(inputs.target.trim());
                const opt = MRSToolkit.findOptimum(V, C, tidx < 0 ? 0 : tidx);
                const finalC = C[C.length - 1];
                const svg = MRSToolkit.svgPlot(V, C, species, 'V (L)', 'PFR — Cᵢ vs V', tidx >= 0 ? { zOpt: opt.zOpt, Cmax: opt.Cmax, targetIdx: tidx } : null);
                const summary = finalC.map((c, i) => `  ${species[i]}(Vf) = ${c.toFixed(5)} mol/L`).join('\n');
                let optStr = tidx >= 0 ? `\nOptimum ${species[tidx]}: V_opt = ${opt.zOpt.toFixed(2)} L, C_max = ${opt.Cmax.toFixed(5)} mol/L` : '';
                return { text: `Final concentrations (V = ${span[1]} L):\n${summary}${optStr}`, html: svg, exports: { 'mrs3.C_fin': JSON.stringify(finalC), 'mrs3.C_ini': JSON.stringify(C[0]) } };
            }
        },

        {
            id: 'mrs4', title: 'MRS-4. CSTR — Steady-State Concentrations',
            section: 'Multiple Reaction Systems',
            desc: 'Solves the CSTR steady-state balance Cᵢ₀ − Cᵢ + rᵢ(C)·τ = 0 for all species via Newton-Raphson.',
            latex: 'C_{i0} - C_i + r_i(\\mathbf{C})\\cdot\\tau = 0',
            inputs: [
                { key: 'network', label: 'Reaction network (from MRS-1)', placeholder: 'Run MRS-1 first', linkOption: { label: 'Use network from MRS-1', var: 'mrs1.network' } },
                { key: 'tau', label: 'Residence time τ = V/v₀ (s)', placeholder: '100', default: '100' }
            ],
            run: (inputs) => {
                const net = loadNetwork(inputs.network);
                const tau = parseFloat(inputs.tau);
                if (isNaN(tau) || tau < 0) throw new Error('τ must be a non-negative number.');
                const { C, species } = MRSToolkit.cstrSolve(net, tau);
                const lines = C.map((c, i) => `  ${species[i]} = ${c.toFixed(5)} mol/L`).join('\n');
                return { text: `CSTR outlet at τ = ${tau} s:\n${lines}`, exports: { 'mrs4.C_fin': JSON.stringify(C), 'mrs4.C_ini': JSON.stringify(net.C0) } };
            }
        },

        {
            id: 'mrs5', title: 'MRS-5. CSTR Parametric Sweep (Cᵢ vs τ)',
            section: 'Multiple Reaction Systems',
            desc: 'Solves CSTR steady-state for each τ in the sweep range and plots outlet concentrations vs τ. Identifies τ_opt that maximises the target species.',
            latex: 'C_i(\\tau) \\text{ s.t. } C_{i0} - C_i + r_i \\cdot \\tau = 0',
            inputs: [
                { key: 'network', label: 'Reaction network (from MRS-1)', placeholder: 'Run MRS-1 first', linkOption: { label: 'Use network from MRS-1', var: 'mrs1.network' } },
                { key: 'tau_span', label: 'τ sweep range [0, τ_max] (s)', placeholder: '0, 500', default: '0, 500' },
                { key: 'target', label: 'Target species (for optimum)', placeholder: 'CP', default: 'CP' },
                { key: 'n_steps', label: 'Sweep steps', placeholder: '200', default: '200' }
            ],
            run: (inputs) => {
                const net = loadNetwork(inputs.network);
                const span = inputs.tau_span.split(',').map(Number);
                const nSteps = parseInt(inputs.n_steps) || 200;
                const { tau, C, species } = MRSToolkit.cstrSweep(net, span, nSteps);
                const tidx = species.indexOf(inputs.target.trim());
                const opt = MRSToolkit.findOptimum(tau, C, tidx < 0 ? 0 : tidx);
                const svg = MRSToolkit.svgPlot(tau, C, species, 'τ (s)', 'CSTR Sweep — Cᵢ vs τ', tidx >= 0 ? { zOpt: opt.zOpt, Cmax: opt.Cmax, targetIdx: tidx } : null);
                let optStr = tidx >= 0 ? `Optimum ${species[tidx]}: τ_opt = ${opt.zOpt.toFixed(2)} s, C_max = ${opt.Cmax.toFixed(5)} mol/L` : 'Target species not found.';
                return { text: optStr, html: svg };
            }
        },

        {
            id: 'mrs6', title: 'MRS-6. Selectivity & Yield Metrics',
            section: 'Multiple Reaction Systems',
            desc: 'Computes overall selectivity S̃(D/U) and overall yield Ỹ(D) from any MRS solver output (Batch, PFR, or CSTR).',
            latex: '\\tilde{S}_{D/U} = \\frac{C_D(t_f)}{C_U(t_f)}, \\quad \\tilde{Y}_D = \\frac{C_D(t_f)}{C_{A0} - C_A(t_f)}',
            inputs: [
                { key: 'network', label: 'Reaction network (from MRS-1)', placeholder: 'Run MRS-1 first', linkOption: { label: 'Use network from MRS-1', var: 'mrs1.network' } },
                { key: 'C_fin', label: 'Final concentrations JSON (from MRS-2/3/4)', placeholder: 'Run a solver block first', linkOption: { label: 'Use output from MRS-2 (Batch)', var: 'mrs2.C_fin' } },
                { key: 'C_ini', label: 'Initial concentrations JSON (from solver)', placeholder: 'Auto-linked', linkOption: { label: 'Use output from MRS-2 (Batch)', var: 'mrs2.C_ini' } },
                { key: 's_pairs', label: 'Selectivity pairs S̃(D/U) — comma-separated D/U', placeholder: 'CP/CW', default: 'CP/CW' },
                { key: 'y_pairs', label: 'Yield pairs Ỹ(D/A) — comma-separated D/A', placeholder: 'CP/CS', default: 'CP/CS' }
            ],
            run: (inputs) => {
                const net = loadNetwork(inputs.network);
                const C_fin = JSON.parse(inputs.C_fin);
                const C_ini = inputs.C_ini && inputs.C_ini.trim() ? JSON.parse(inputs.C_ini) : net.C0;
                const sPairs = inputs.s_pairs.split(',').map(p => p.trim().split('/').map(s => s.trim())).filter(p => p.length === 2 && p[0] && p[1]);
                const yPairs = inputs.y_pairs.split(',').map(p => p.trim().split('/').map(s => s.trim())).filter(p => p.length === 2 && p[0] && p[1]);
                const lines = MRSToolkit.calcMetrics(C_ini, C_fin, net.species, sPairs, yPairs);
                return { text: lines.join('\n') || 'No pairs defined.' };
            }
        }
    ];

    // Helper: deserialize network JSON from globalExports
    function loadNetwork(raw) {
        if (!raw || !raw.trim()) throw new Error('No network loaded. Run MRS-1 first.');
        let parsed;
        try { parsed = JSON.parse(raw); } catch (_) { throw new Error('Invalid network JSON. Run MRS-1 first.'); }
        const { species, rateExprs, kVals, C0 } = parsed;
        return MRSToolkit.parseNetwork(species.join(', '), rateExprs.join('\n'), Object.entries(kVals).map(([k, v]) => `${k}=${v}`).join(', '), C0.join(', '));
    }

    let globalExports = {};
    let linkSubscriptions = []; // { targetInputId: '...', varName: 'b1.idx_LR' }

    function init() {
        const mount = document.getElementById('cre-toolkit-mount');
        if (!mount) return;

        // Render Blocks
        let html = '<div style="display:flex;flex-direction:column;gap:16px;text-align:left;font-family:var(--font-sans)">';

        let lastSection = null;
        BLOCKS.forEach(b => {
            // Section divider for MRS blocks
            if (b.section && b.section !== lastSection) {
                lastSection = b.section;
                html += `<div style="margin-top:24px;padding-top:20px;border-top:2px solid var(--accent-primary);display:flex;align-items:center;gap:12px">
                    <span style="font-size:14px;font-weight:700;color:var(--accent-primary);text-transform:uppercase;letter-spacing:0.5px">${b.section}</span>
                    <div style="flex:1;height:1px;background:var(--border)"></div>
                    <button onclick="document.getElementById('mrs-modal').style.display='flex'"
                        style="background:none;border:1px solid var(--accent-primary);color:var(--accent-primary);border-radius:6px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:0.3px;white-space:nowrap">
                        ? Instrucciones
                    </button>
                </div>`;
            }

            html += `
                <div class="card" id="card-${b.id}" style="border:1px solid var(--border)">
                    <!-- Collapsible Header -->
                    <div class="card-title" style="display:flex;justify-content:space-between;cursor:pointer;margin-bottom:0" onclick="const b=this.nextElementSibling; b.style.display=(b.style.display==='none'?'block':'none')">
                        <span style="font-size:16px">${b.title}</span>
                        <span style="color:var(--text-muted);font-size:12px;margin-top:2px">▼ Collapse</span>
                    </div>

                    <!-- Block Content -->
                    <div style="margin-top:12px">
                        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">${b.desc}</div>
                        <div style="font-size:16px;text-align:center;margin-bottom:16px;background:var(--bg-primary);padding:8px;border-radius:6px" class="latex-render">
                            $$${b.latex}$$
                        </div>

                        ${b.inputs.map(inp => {
                let inputHtml = '';
                const inpId = `in-${b.id}-${inp.key}`;

                // Link Selector
                let linkSelect = "";
                if (inp.linkOption) {
                    linkSelect = `
                                    <div style="margin-bottom:4px">
                                        <select class="link-select solution-select" data-target="${inpId}" data-var="${inp.linkOption.var}" style="font-size:11px;padding:2px 6px">
                                            <option value="none">Manual input</option>
                                            <option value="${inp.linkOption.var}" selected>${inp.linkOption.label}</option>
                                        </select>
                                    </div>
                                `;
                    linkSubscriptions.push({ targetInputId: inpId, varName: inp.linkOption.var });
                }

                if (inp.isDropdown) {
                    let opts = inp.options.map(o => `<option value="${o}">${o}</option>`).join('');
                    inputHtml = `<select id="${inpId}" class="solution-select">${opts}</select>`;
                } else if (inp.isTextarea) {
                    inputHtml = `<textarea id="${inpId}" class="input-field" rows="${inp.rows || 4}" placeholder="${inp.placeholder}" style="font-family:var(--font-mono);font-size:13px;resize:vertical">${inp.default || ''}</textarea>`;
                } else {
                    let styleInfo = inp.isSolveTarget ? 'background-color:#ffffff05;border:1px dashed var(--border)' : '';
                    inputHtml = `<input id="${inpId}" class="input-field" type="text" placeholder="${inp.placeholder}" value="${inp.default || ''}" style="${styleInfo}">`;
                }

                return `
                                <div class="input-group" style="margin-bottom:12px">
                                    <label class="input-label" style="display:flex;justify-content:space-between">
                                        ${inp.label}
                                    </label>
                                    ${linkSelect}
                                    ${inputHtml}
                                </div>
                            `;
            }).join('')}

                        <button class="convert-btn" onclick="CreUI.runBlock('${b.id}')" style="margin-top:12px;width:100%;font-size:15px;padding:10px;border-radius:8px">Run Block</button>
                        
                        <div id="out-${b.id}" style="margin-top:16px;white-space:pre-wrap;font-family:var(--font-mono);color:var(--accent-primary);font-size:14px;background:var(--bg-primary);padding:12px;border-radius:6px;display:none;border:1px solid var(--border)"></div>
                        <div id="err-${b.id}" style="margin-top:12px;color:var(--danger);font-size:12px;display:none"></div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        mount.innerHTML = html;

        // Render LaTeX dynamically
        function renderLatex() {
            if (window.renderMathInElement) {
                document.querySelectorAll('.latex-render').forEach(el => {
                    if (!el.dataset.katexRendered) {
                        window.renderMathInElement(el, {
                            delimiters: [
                                { left: '$$', right: '$$', display: true },
                                { left: '$', right: '$', display: false }
                            ],
                            throwOnError: false
                        });
                        el.dataset.katexRendered = 'true';
                    }
                });
            } else {
                setTimeout(renderLatex, 100);
            }
        }
        renderLatex();

        // Add event listeners to Link Selectors
        document.querySelectorAll('.link-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const targetId = e.target.dataset.target;
                const varName = e.target.dataset.var;
                const targetInp = document.getElementById(targetId);
                // If it was changed back to manual, don't overwrite the value.
                // If it was changed to link, try fetching from globalExports immediately.
                if (e.target.value === varName && globalExports[varName] !== undefined && targetInp) {
                    targetInp.value = globalExports[varName];
                }
            });
        });

        // Run All listener
        const runAllBtn = document.getElementById('cre-run-all');
        if (runAllBtn) {
            runAllBtn.addEventListener('click', runAll);
        }
    }

    function runBlock(blockId) {
        const block = BLOCKS.find(b => b.id === blockId);
        if (!block) return;

        const outBox = document.getElementById(`out-${block.id}`);
        const errBox = document.getElementById(`err-${block.id}`);
        outBox.style.display = 'none';
        errBox.style.display = 'none';

        try {
            // Collect inputs (works for both input and textarea)
            const inputs = {};
            block.inputs.forEach(inp => {
                inputs[inp.key] = document.getElementById(`in-${block.id}-${inp.key}`).value;
            });

            // Execute
            const res = block.run(inputs);

            // Output: HTML (SVG chart) followed by preformatted text
            if (res.html) {
                outBox.innerHTML = `<div style="overflow-x:auto;margin-bottom:12px">${res.html}</div>` +
                    (res.text ? `<pre style="margin:0;white-space:pre-wrap">${res.text}</pre>` : '');
            } else {
                outBox.textContent = res.text;
            }
            outBox.style.display = 'block';

            // Global Exports & Links Update
            if (res.exports) {
                for (let k in res.exports) {
                    globalExports[k] = res.exports[k];
                }

                // Propagate down immediately based on current dropdown states
                linkSubscriptions.forEach(sub => {
                    const sel = document.querySelector(`select[data-target="${sub.targetInputId}"]`);
                    // If the select currently chooses the variable, update input!
                    if (sel && sel.value === sub.varName && res.exports[sub.varName] !== undefined) {
                        const targetInp = document.getElementById(sub.targetInputId);
                        if (targetInp) {
                            targetInp.value = res.exports[sub.varName];
                        }
                    }
                });
            }

        } catch (err) {
            errBox.innerHTML = `Error: ${err.message}`;
            errBox.style.display = 'block';
        }
    }

    function runAll() {
        // Run all blocks sequentially
        BLOCKS.forEach(b => {
            runBlock(b.id);
        });
    }

    return { init, runBlock, runAll };
})();

window.CreUI = CreUI;

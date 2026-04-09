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
        }
    ];

    let globalExports = {};
    let linkSubscriptions = []; // { targetInputId: '...', varName: 'b1.idx_LR' }

    function init() {
        const mount = document.getElementById('cre-toolkit-mount');
        if (!mount) return;

        // Render Blocks
        let html = '<div style="display:flex;flex-direction:column;gap:16px;text-align:left;font-family:var(--font-sans)">';

        BLOCKS.forEach(b => {
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
        if (window.renderMathInElement) {
            document.querySelectorAll('.latex-render').forEach(el => {
                window.renderMathInElement(el, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            });
        }

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
            // Collect inputs
            const inputs = {};
            block.inputs.forEach(inp => {
                inputs[inp.key] = document.getElementById(`in-${block.id}-${inp.key}`).value;
            });

            // Execute
            const res = block.run(inputs);

            // Output text
            outBox.innerHTML = res.text;
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

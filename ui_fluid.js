/**
 * ui_fluid.js — UI Controller for Fluid Mechanics Calculator
 */
'use strict';

window.FluidUI = (() => {
    let sys = {
        fluidName: 'Agua / Water',
        tempC: 15,
        Q: 0.015,
        unitSys: 'SI',
        unknown: { type: 'hA', index: 0 },
        points: [
            { id: 1, label: 'Lower tank surface', P: 0, z: 0, v: 'auto' },
            { id: 2, label: 'Upper tank surface', P: 0, z: 10, v: 'auto' },
            { id: 3, label: 'Upper tank surface', P: 0, z: 10, v: 'auto' }
        ],
        segments: [
            { id: 1, D: 0.10226, eps: 0.000046, L: 15, has_pump: true, eta: 0.76, accessories: [{ name: "Sharp-edged entrance (re-entrant)", K: 0.5, qty: 1 }] },
            { id: 2, D: 0.0525, eps: 0.000046, L: 200, has_pump: false, eta: 0.8, accessories: [{ name: "Globe valve — fully open", K: 6.46, qty: 1 }] }
        ]
    };

    let nextPointId = 4;
    let nextSegId = 3;

    function init() {
        console.log('[FluidUI] Initializing Fluid Mechanics UI...');
        const mount = document.getElementById('fluid-ui-mount');
        if (!mount) return;
        loadExampleA(); // We start with Example 1
    }

    function loadExampleA() {
        sys = {
            fluidName: 'Agua / Water', tempC: 15, Q: 0.015, unitSys: 'SI',
            unknown: { type: 'hA', index: 0 },
            points: [
                { id: 1, label: 'Lower tank surface', P: 0, z: 0, v: 0 },
                { id: 2, label: 'Pipe Discharge', P: 0, z: 10, v: 'auto' },
                { id: 3, label: 'Upper tank surface', P: 0, z: 10, v: 0 }
            ],
            segments: [
                { id: 1, D: 0.10226, v: 'auto', eps: 0.000046, L: 15, has_pump: true, eta: 0.76, accessories: [{ name: "Sharp-edged entrance (re-entrant)", K: 0.5, qty: 1 }] },
                {
                    id: 2, D: 0.0525, v: 'auto', eps: 0.000046, L: 200, has_pump: false, eta: 0.8, accessories: [
                        { name: "Globe valve — fully open", K: 6.46, qty: 1 },
                        { name: "90° elbow — standard", K: 0.81, qty: 2 }, // Assuming Mott vals approximately, K can be edited
                        { name: "Exit — pipe to large tank (all geometries)", K: 1.0, qty: 1 }
                    ]
                }
            ]
        };
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    function loadExampleB() {
        sys = {
            fluidName: 'Aceite SAE 10 / SAE 10 Oil', tempC: 25, Q: 0.057, unitSys: 'SI',
            unknown: { type: 'Q', index: 0 },
            points: [
                { id: 1, label: 'Punto 1 — entrada', P: 120000, z: 0, v: 'auto' },
                { id: 2, label: 'Punto 2 — salida', P: 60000, z: 0, v: 'auto' }
            ],
            segments: [
                { id: 1, D: 0.1541, v: 'auto', eps: 0.000046, L: 100, has_pump: false, accessories: [] }
            ]
        };
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    function loadExampleC() {
        sys = {
            fluidName: 'Agua / Water', tempC: 25, Q: 0.0270, unitSys: 'SI',
            unknown: { type: 'Q', index: 0 },
            points: [
                { id: 1, label: 'Superficie depósito elevado', P: 0, z: 12.19, v: 0 },
                { id: 2, label: 'Canal de riego', P: 0, z: 0, v: 'auto' }
            ],
            segments: [
                {
                    id: 1, D: 0.1023, v: 'auto', eps: 0.000046, L: 91.44, has_pump: false, eta: 1, accessories: [
                        { name: "Entrada de borde vivo", K: 0.50, qty: 1 },
                        { name: "Codo 90° radio largo", K: 0.34, qty: 1 },
                        { name: "Válvula de compuerta 1/2 abierta", K: 2.72, qty: 1 },
                        { name: "Salida", K: 1.00, qty: 1 }
                    ]
                }
            ]
        };
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    function addPoint() {
        const pId = nextPointId++;
        const sId = nextSegId++;
        sys.points.push({ id: pId, label: 'New Point', P: 0, z: 0, v: 0 });
        sys.segments.push({ id: sId, D: 0.05, v: 'auto', eps: 0.000046, L: 10, has_pump: false, accessories: [] });
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    function removePoint(index) {
        if (sys.points.length <= 2) return;
        sys.points.splice(index, 1);
        sys.segments.splice(index - 1, 1); // Remove the segment preceding it
        // Check if unknown was targeting removed indices and reset
        if (sys.unknown.index >= sys.points.length) sys.unknown.index = sys.points.length - 1;
        if (sys.unknown.index >= sys.segments.length && sys.unknown.type === 'hA') sys.unknown.index = sys.segments.length - 1;
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    function render(mount) {
        let db = FluidMechanics.getDatabase();
        if (!db || !db.fluids) {
            mount.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">Waiting for fluid database...</div>`;
            return;
        }

        const fluidProps = FluidMechanics.getFluidProperties(sys.fluidName, sys.tempC);
        let evalSys = JSON.parse(JSON.stringify(sys));
        evalSys.fluidProps = fluidProps;
        let res = null;
        if (fluidProps) {
            try { res = FluidMechanics.solveSystem(evalSys, sys.unknown); } catch (e) { console.error(e); }
        }

        let html = `
            <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
                
                <!-- LEFT COLUMN: BUILDER -->
                <div style="flex:1;min-width:340px;display:flex;flex-direction:column;gap:12px">
                    <!-- Global Inputs -->
                    <div class="card" style="position:sticky;top:10px;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
                        <div class="card-title" style="display:flex;justify-content:space-between">
                            <span>Global Inputs</span>
                            <select id="fluid-load-ex" class="solution-select" style="width:140px;font-size:11px;padding:4px">
                                <option value="">-- Load Example --</option>
                                <option value="A">Example 1 (Mott 11.1)</option>
                                <option value="B">Example 2 (Mott 11.2)</option>
                                <option value="C">Example 3 (Mott 11.4)</option>
                            </select>
                        </div>
                        
                        <div class="input-group" style="margin-bottom:8px">
                            <label class="input-label">Fluid</label>
                            <select id="fluid-sel" class="input-field" style="padding:8px">
                                ${Object.keys(db.fluids).map(f => `<option value="${f}" ${f === sys.fluidName ? 'selected' : ''}>${f}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div style="display:flex;gap:12px;margin-bottom:8px">
                            <div class="input-group" style="flex:1">
                                <label class="input-label">Temp (°C)</label>
                                <input id="fluid-t" type="number" step="any" class="input-field" value="${sys.tempC}">
                            </div>
                            <div class="input-group" style="flex:1;${sys.unknown.type === 'Q' ? 'border:2px solid var(--accent-primary);border-radius:6px;padding:4px' : ''}">
                                <label class="input-label" style="display:flex;justify-content:space-between">
                                    <span>Flow Q (m³/s)</span>
                                    <input type="radio" name="chk-unknown" value="Q-0" ${sys.unknown.type === 'Q' ? 'checked' : ''} title="Solve for Q">
                                </label>
                                <input id="fluid-q" type="number" step="any" class="input-field" value="${res && sys.unknown.type === 'Q' ? res.solvedValue.toPrecision(4) : sys.Q}" ${sys.unknown.type === 'Q' ? 'readonly style="background:var(--bg-card);color:var(--accent-primary);font-weight:bold"' : ''}>
                            </div>
                        </div>
                        
                        <div style="font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-app);border-radius:6px;font-family:var(--font-mono)">
                            <span style="color:var(--accent-primary)">ρ</span> = ${fluidProps ? fluidProps.rho.toFixed(1) : '--'} kg/m³ &nbsp;|&nbsp; 
                            <span style="color:var(--accent-primary)">γ</span> = ${fluidProps ? fluidProps.gamma.toFixed(2) : '--'} kN/m³ &nbsp;|&nbsp; 
                            <span style="color:var(--accent-primary)">ν</span> = ${fluidProps ? fluidProps.nu.toExponential(3) : '--'} m²/s
                        </div>
                    </div>

                    <!-- Pipeline Chain -->
                    <div id="fluid-chain-container" style="display:flex;flex-direction:column;gap:8px;padding-left:14px;border-left:2px solid var(--border)">
                        ${renderBuilderChain(db, res)}
                    </div>
                    
                    <button id="fluid-add-pt" class="secondary-btn" style="margin-top:8px;align-self:flex-start;padding:8px 16px;font-size:13px;border:1px dashed var(--accent-primary);color:var(--accent-primary);background:transparent">+ Add Point</button>
                </div>

                <!-- RIGHT COLUMN: RESULTS -->
                <div style="flex:1;min-width:340px;display:flex;flex-direction:column;gap:12px">
                    ${renderResultsPanel(fluidProps, res)}
                </div>

            </div>
        `;

        mount.innerHTML = html;
        bindEvents(mount, db);
    }



    function renderAccessories(db, accs, segIdx) {
        let h = '<div style="display:flex;flex-direction:column;gap:4px">';
        h += `<div style="display:flex;gap:4px;padding:0 4px;font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase">
                <div style="flex:2">Accessory Type</div>
                <div style="flex:1">K-value</div>
                <div style="width:40px">Qty</div>
                <div style="width:30px"></div>
              </div>`;
        accs.forEach((a, i) => {
            h += `
            <div style="display:flex;gap:4px;align-items:center;background:var(--bg-secondary);padding:4px;border-radius:4px">
                <select class="input-field acc-n" data-seg="${segIdx}" data-acc="${i}" style="flex:2;font-size:10px;padding:4px">
                    <option value="">Custom</option>
                    ${Object.keys(db.fittings).map(f => '<option value="' + f + '" ' + (f === a.name ? 'selected' : '') + '>' + f + '</option>').join('')}
                </select>
                <input type="number" class="input-field acc-k" data-seg="${segIdx}" data-acc="${i}" value="${a.K}" step="any" placeholder="K=" style="flex:1;font-size:10px;padding:4px" title="K-value">
                <input type="number" class="input-field acc-q" data-seg="${segIdx}" data-acc="${i}" value="${a.qty}" placeholder="Qty" style="width:40px;font-size:10px;padding:4px" title="Quantity">
                <button class="secondary-btn rem-acc" data-seg="${segIdx}" data-acc="${i}" style="padding:2px 8px;font-size:10px;color:var(--danger)">x</button>
            </div>`;
        });
        h += `<button class="secondary-btn add-acc" data-seg="${segIdx}" style="align-self:flex-start;padding:4px 8px;font-size:10px;margin-top:4px">+ Add Access. (K)</button>`;
        h += '</div>';
        return h;
    }

    function formatUnknownTarget(u) {
        if (u.type === 'Q') return "System Flow (Q)";
        if (u.type === 'P') return `Pressure at Pt ${u.index + 1} (P)`;
        if (u.type === 'z') return `Elevation at Pt ${u.index + 1} (z)`;
        if (u.type === 'hA') return `Pump Head on Seg ${u.index}→${u.index + 1} (hA)`;
        return u.type;
    }

    function renderResultsPanel(fluidProps, res) {
        if (!res) return '<div class="card" style="padding:20px;text-align:center;color:var(--text-muted)">Unable to evaluate system parameters. Check inputs.</div>';

        let h = `
            <div class="card" style="background:var(--bg-app);border:1px solid var(--border)">
                <div class="card-title">Global Energy Summary (Mott Eq 11-1)</div>
                <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);line-height:1.6;padding:8px;background:var(--bg-card);border-radius:6px">
                    <div style="border-bottom:1px dashed var(--border);padding-bottom:8px;margin-bottom:8px">
                        P_1/γ + z_1 + v_1²/2g + ΣhA = P_N/γ + z_N + v_N²/2g + ΣhR + ΣhL<br>
                        ${res.E1.toFixed(3)} + ${res.total_hA.toFixed(3)} = ${res.E2.toFixed(3)} + ${res.total_hR.toFixed(3)} + ${res.total_hL.toFixed(3)}
                    </div>
                    <div style="display:flex;justify-content:space-between">
                        <span>Total head loss (ΣhL):</span> <b>${res.total_hL.toFixed(3)} m</b>
                    </div>
                    <div style="display:flex;justify-content:space-between">
                        <span>Pump head (ΣhA):</span> <b>${res.total_hA.toFixed(3)} m</b>
                    </div>
                    ${res.total_pump_kW > 0 ? `
                    <div style="display:flex;justify-content:space-between;color:var(--accent-primary);font-weight:600">
                        <span>Pump Input Power:</span> <span>${res.total_pump_kW.toFixed(2)} kW</span>
                    </div>` : ''}
                    <div style="display:flex;justify-content:space-between">
                        <span>Net head:</span> <b>${(res.E1 + res.total_hA - res.total_hL - res.total_hR).toFixed(3)} m</b>
                    </div>
                    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
                        <span style="color:var(--accent-primary);font-weight:bold">Solved: ${formatUnknownTarget(sys.unknown)} = ${res.solvedValue.toPrecision(5)}</span>
                        <br>Residual (Error) = ${res.residual.toExponential(3)} m
                    </div>
                </div>
            </div>
        `;

        res.segResults.forEach((sr, i) => {
            const bgRegime = sr.regime === 'Laminar' ? '#e8f5e9' : (sr.regime === 'Transition' ? '#fff3e0' : '#e3f2fd');
            const cRegime = sr.regime === 'Laminar' ? '#2e7d32' : (sr.regime === 'Transition' ? '#ef6c00' : '#1565c0');

            let hmA = '';
            sr.minor_losses.forEach(ml => {
                hmA += `<tr><td style="text-overflow:ellipsis;white-space:nowrap;overflow:hidden;max-width:120px">${ml.name}</td><td>${ml.K}x${ml.qty}</td><td>${ml.hm.toFixed(3)}m</td></tr>`;
            });

            h += `
            <div class="card">
                <div class="card-title" style="font-size:12px">Segment ${i} → ${i + 1} : Evaluation</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-size:11px;color:var(--text-muted)">v = ${sr.v.toFixed(3)} m/s | NR = ${sr.NR.toFixed(0)}</span>
                    <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${bgRegime};color:${cRegime};font-weight:700">${sr.regime.toUpperCase()}</span>
                </div>
                ${sr.regime === 'Transition' ? '<div style="font-size:9px;color:#ef6c00;margin-bottom:8px">⚠ Transition zone — f is interpolated</div>' : ''}
                ${sr.hasPipe ? '' : '<div style="font-size:9px;color:var(--text-secondary);margin-bottom:8px;background:var(--bg-app);padding:4px;border-radius:4px">ℹ Pipe diameter skipped (only accessories evaluated for this segment)</div>'}
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;font-family:var(--font-mono);background:var(--bg-app);padding:8px;border-radius:6px">
                    <div>f = ${sr.f.toPrecision(4)}</div>
                    <div>hf = ${sr.hf.toFixed(3)} m</div>
                    <div style="grid-column:1 / span 2;margin-top:4px">
                        <b>Σhm = ${sr.sum_hm.toFixed(3)} m</b>
                        <table style="width:100%;font-size:10px;margin-top:4px;color:var(--text-secondary)">${hmA}</table>
                    </div>
                    <div style="grid-column:1 / span 2;margin-top:4px;padding-top:4px;border-top:1px dashed var(--border);color:var(--text-primary);font-weight:bold">
                        Segment Total hL = ${sr.hL_seg.toFixed(3)} m
                    </div>
                </div>
            </div>`;
        });

        return h;
    }

    function bindEvents(mount, db) {
        // Global
        mount.querySelector('#fluid-sel')?.addEventListener('change', e => { sys.fluidName = e.target.value; render(mount); });
        mount.querySelector('#fluid-t')?.addEventListener('change', e => { sys.tempC = parseFloat(e.target.value) || 0; render(mount); });
        mount.querySelector('#fluid-q')?.addEventListener('change', e => {
            if (sys.unknown.type !== 'Q') sys.Q = parseFloat(e.target.value) || 0;
            render(mount);
        });

        mount.querySelector('#fluid-load-ex')?.addEventListener('change', e => {
            if (e.target.value === 'A') loadExampleA();
            else if (e.target.value === 'B') loadExampleB();
            else if (e.target.value === 'C') loadExampleC();
        });

        mount.querySelector('#fluid-add-pt')?.addEventListener('click', addPoint);

        // Unknown radio
        mount.querySelectorAll('input[name="chk-unk"]').forEach(r => {
            r.addEventListener('change', e => {
                if (e.target.checked) {
                    const [t, i] = e.target.value.split('-');
                    sys.unknown = { type: t, index: parseInt(i) || 0 };
                    render(mount);
                }
            });
        });

        // Points
        mount.querySelectorAll('.rem-pt').forEach(el => el.addEventListener('click', e => removePoint(parseInt(e.target.dataset.idx))));
        mount.querySelectorAll('.pt-lbl').forEach(el => el.addEventListener('change', e => { sys.points[e.target.dataset.idx].label = e.target.value; render(mount); }));
        mount.querySelectorAll('.pt-p').forEach(el => el.addEventListener('change', e => {
            if (sys.unknown.type === 'P' && sys.unknown.index === parseInt(e.target.dataset.idx)) return;
            sys.points[e.target.dataset.idx].P = parseFloat(e.target.value) || 0; render(mount);
        }));
        mount.querySelectorAll('.pt-z').forEach(el => el.addEventListener('change', e => {
            if (sys.unknown.type === 'z' && sys.unknown.index === parseInt(e.target.dataset.idx)) return;
            sys.points[e.target.dataset.idx].z = parseFloat(e.target.value) || 0; render(mount);
        }));
        mount.querySelectorAll('.pt-v').forEach(el => el.addEventListener('change', e => {
            sys.points[e.target.dataset.idx].v = e.target.value === '0' ? 0 : 'auto'; render(mount);
        }));

        // Segments
        mount.querySelectorAll('.seg-d').forEach(el => el.addEventListener('change', e => {
            const val = e.target.value === 'auto' ? 'auto' : (parseFloat(e.target.value) || 0);
            sys.segments[e.target.dataset.idx].D = val;
            if (val !== 'auto') sys.segments[e.target.dataset.idx].v = 'auto';
            render(mount);
        }));
        mount.querySelectorAll('.seg-v').forEach(el => el.addEventListener('change', e => {
            const val = e.target.value === 'auto' ? 'auto' : (parseFloat(e.target.value) || 0);
            sys.segments[e.target.dataset.idx].v = val;
            if (val !== 'auto') sys.segments[e.target.dataset.idx].D = 'auto';
            render(mount);
        }));
        mount.querySelectorAll('.seg-l').forEach(el => el.addEventListener('change', e => { sys.segments[e.target.dataset.idx].L = parseFloat(e.target.value) || 0; render(mount); }));
        mount.querySelectorAll('.seg-e').forEach(el => el.addEventListener('change', e => { sys.segments[e.target.dataset.idx].eps = parseFloat(e.target.value) || 0; render(mount); }));
        mount.querySelectorAll('.seg-pump').forEach(el => el.addEventListener('change', e => {
            sys.segments[e.target.dataset.idx].has_pump = e.target.checked;
            if (sys.unknown.type === 'hA' && sys.unknown.index === parseInt(e.target.dataset.idx)) sys.unknown = { type: 'Q', index: 0 };
            render(mount);
        }));
        mount.querySelectorAll('.seg-ha').forEach(el => el.addEventListener('change', e => {
            if (sys.unknown.type === 'hA' && sys.unknown.index === parseInt(e.target.dataset.idx)) return;
            sys.segments[e.target.dataset.idx].hA = parseFloat(e.target.value) || 0; render(mount);
        }));
        mount.querySelectorAll('.seg-eta').forEach(el => el.addEventListener('change', e => { sys.segments[e.target.dataset.idx].eta = parseFloat(e.target.value) || 1; render(mount); }));

        // Accessories
        mount.querySelectorAll('.add-acc').forEach(btn => btn.addEventListener('click', e => {
            sys.segments[e.target.dataset.seg].accessories.push({ name: 'Custom', K: 0, qty: 1 });
            render(mount);
        }));
        mount.querySelectorAll('.rem-acc').forEach(btn => btn.addEventListener('click', e => {
            sys.segments[e.target.dataset.seg].accessories.splice(e.target.dataset.acc, 1);
            render(mount);
        }));
        mount.querySelectorAll('.acc-n').forEach(sel => sel.addEventListener('change', e => {
            const segId = e.target.dataset.seg; const accId = e.target.dataset.acc; const v = e.target.value;
            sys.segments[segId].accessories[accId].name = v || 'Custom';
            if (v && db.fittings[v]) sys.segments[segId].accessories[accId].K = db.fittings[v];
            render(mount);
        }));
        mount.querySelectorAll('.acc-k').forEach(inp => inp.addEventListener('change', e => { sys.segments[e.target.dataset.seg].accessories[e.target.dataset.acc].K = parseFloat(e.target.value) || 0; render(mount); }));
        mount.querySelectorAll('.acc-q').forEach(inp => inp.addEventListener('change', e => { sys.segments[e.target.dataset.seg].accessories[e.target.dataset.acc].qty = parseInt(e.target.value) || 1; render(mount); }));
    }


    function renderBuilderChain(db, res) {
        let h = '';
        for (let i = 0; i < sys.points.length; i++) {
            const pt = sys.points[i];
            const isUnkP = sys.unknown.type === 'P' && sys.unknown.index === i;
            const isUnkZ = sys.unknown.type === 'z' && sys.unknown.index === i;

            h += `
            <div class="card" style="border-left:4px solid var(--accent-primary);padding:12px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:1px;text-transform:uppercase">Point ${i + 1}</div>
                    ${i >= 2 ? '<button class="secondary-btn rem-pt" data-idx="' + i + '" style="padding:2px 8px;font-size:12px;color:var(--danger)">x</button>' : ''}
                </div>
                <div class="input-group" style="margin-bottom:8px">
                    <input type="text" class="input-field pt-lbl" data-idx="${i}" value="${pt.label}" placeholder="Point Name">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                    <div class="input-group">
                        <label class="input-label">P (Pa) <input type="radio" name="chk-unk" value="P-${i}" ${isUnkP ? 'checked' : ''} title="Solve P"></label>
                        <input type="number" class="input-field pt-p" data-idx="${i}" value="${isUnkP ? (res ? res.solvedValue : 0) : pt.P}" ${isUnkP ? 'readonly style="color:var(--accent)"' : ''}>
                    </div>
                    <div class="input-group">
                        <label class="input-label">z (m) <input type="radio" name="chk-unk" value="z-${i}" ${isUnkZ ? 'checked' : ''} title="Solve z"></label>
                        <input type="number" class="input-field pt-z" data-idx="${i}" value="${isUnkZ ? (res ? res.solvedValue : 0) : pt.z}" ${isUnkZ ? 'readonly style="color:var(--accent)"' : ''}>
                    </div>
                    <div class="input-group">
                        <label class="input-label">Location</label>
                        <select class="input-field pt-v" data-idx="${i}" style="font-size:11px;padding:4px">
                            <option value="0" ${pt.v === 0 ? 'selected' : ''}>Tank Surface (v ≈ 0)</option>
                            <option value="auto" ${pt.v === 'auto' ? 'selected' : ''}>Pipe / Jet (v = Q/A)</option>
                        </select>
                    </div>
                </div>
            </div>`;

            if (i < sys.points.length - 1) {
                const seg = sys.segments[i];
                const isUnkHA = sys.unknown.type === 'hA' && sys.unknown.index === i;

                h += `
                <div style="margin-left:14px;padding-left:14px;border-left:2px solid var(--border);margin-bottom:8px">
                    <div class="card" style="background:var(--bg-app);box-shadow:none;border:1px solid var(--border);padding:12px">
                        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">
                            Segment ${i} → ${i + 1} : Geometry
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                            <div class="input-group"><label class="input-label">Diam D (m)</label><input type="text" class="input-field seg-d" data-idx="${i}" value="${seg.D}"></div>
                            <div class="input-group" title="${sys.unknown.type === 'Q' ? 'Velocity iterates alongside Q' : 'Auto-computes diameter'}">
                                <label class="input-label">Vel v (m/s)</label>
                                <input type="text" class="input-field seg-v" data-idx="${i}" value="${sys.unknown.type === 'Q' ? '(Depends on Q)' : (seg.v || 'auto')}" ${sys.unknown.type === 'Q' ? 'disabled style="background:var(--bg-card);color:var(--text-muted);cursor:not-allowed"' : ''}>
                            </div>
                            <div class="input-group"><label class="input-label">Length (m)</label><input type="number" step="any" class="input-field seg-l" data-idx="${i}" value="${seg.L}"></div>
                            <div class="input-group"><label class="input-label">Rough ε (m)</label>
                                <select class="input-field seg-e" data-idx="${i}" style="font-size:11px;padding:4px">
                                    <option value="${seg.eps}">Custom (${seg.eps})</option>
                                    ${Object.entries(db.roughness || {}).map(([mat, r]) => `<option value="${r}" ${r == seg.eps ? 'selected' : ''}>${mat} (${r})</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div style="display:flex;gap:12px;margin-top:8px">
                            <label class="toggle-switch"><input type="checkbox" class="seg-pump" data-idx="${i}" ${seg.has_pump ? 'checked' : ''}><span class="toggle-track"></span></label> <span class="input-label">Pump</span>
                        </div>
                        ${seg.has_pump ? `
                            <div style="display:flex;gap:6px;margin-top:6px">
                                <div class="input-group"><label class="input-label">hA <input type="radio" name="chk-unk" value="hA-${i}" ${isUnkHA ? 'checked' : ''}></label><input type="number" class="input-field seg-ha" data-idx="${i}" value="${isUnkHA ? (res ? res.solvedValue : 0) : seg.hA}"></div>
                                <div class="input-group"><label class="input-label">Eff η</label><input type="number" step="any" class="input-field seg-eta" data-idx="${i}" value="${seg.eta}"></div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="card" style="background:transparent;box-shadow:none;border:1px dashed var(--border);padding:12px;margin-top:6px">
                        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">
                            Segment ${i} → ${i + 1} : Accessories
                        </div>
                        ${renderAccessories(db, seg.accessories, i)}
                    </div>
                </div>
                `;
            }
        }
        return h;
    }

    return { init };
})();

// ui_fluid.js — Fluid Mechanics Calculator UI
// Mott "Applied Fluid Mechanics" exercises 11.2, 11.29 and Application Exercise 2

const FluidUI = (() => {
    // ─── i18n helper ──────────────────────────────────────────────────────────
    const L = (key, fb) => (window.Lang ? Lang.get(key, fb) : (fb || key));

    // ─── State ────────────────────────────────────────────────────────────────
    let sys = {};
    let nextPointId = 1;
    let nextSegId = 1;

    // ─── Example Loaders ──────────────────────────────────────────────────────

    function loadExample11_2() {
        // Exercise 11.2 — Mott: Methanol pump system, solving for hA
        // Fluid: Methanol (CH₃OH) at 25°C, Q = 54 m³/h = 0.015 m³/s
        // Suction:   4" Sch 40, L = 15m, square-edged entrance K=0.5
        // Discharge: 2" Sch 40, L = 200m, globe valve K=6.46, 2×90°elbows K=0.81, exit K=1.0
        // z₁ = 0 (lower tank surface), z₂ = 10 m (upper tank surface)
        sys = {
            exampleId: '11_2',
            fluidName: 'Metanol / Methanol (CH₃OH)',
            tempC: 25,
            Q: 0.015,
            unitSys: 'SI',
            customFluid: null,
            unknown: { type: 'hA', index: 1 },
            points: [
                { id: 1, label: 'Lower tank surface (Point 1)', P: 0, z: 0, v: 0 },
                { id: 2, label: 'Junction suction→discharge', P: 0, z: 0, v: 'auto' },
                { id: 3, label: 'Upper tank surface (Point 2)', P: 0, z: 10, v: 0 }
            ],
            segments: [
                {
                    id: 1,
                    // 4" Sch 40 suction pipe: D = 102.26 mm, L = 15 m
                    D: 0.10226, v: 'auto', eps: 0.000046, L: 15,
                    has_pump: false, eta: 0.76,
                    accessories: [
                        { name: 'Sharp-edged flush entrance', K: 0.5, qty: 1 }
                    ]
                },
                {
                    id: 2,
                    // 2" Sch 40 discharge pipe: D = 52.50 mm, L = 200 m
                    D: 0.05250, v: 'auto', eps: 0.000046, L: 200,
                    has_pump: true, eta: 0.76,
                    accessories: [
                        { name: 'Globe valve — fully open', K: 6.46, qty: 1 },
                        { name: '90° elbow — standard (screwed)', K: 0.81, qty: 2 },
                        { name: 'Exit — pipe to large tank (all geometries)', K: 1.0, qty: 1 }
                    ]
                }
            ]
        };
        nextPointId = 4;
        nextSegId = 3;
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    function loadExample11_29() {
        // Exercise 11.29 — Mott: Contaminated water pumped 80 ft (24.384 m) vertically
        // US Customary → SI conversion:
        //   γ = 64.0 lb/ft³ → 10.054 kN/m³  |  ρ = 1024.83 kg/m³
        //   μ = 4.0×10⁻⁵ lb·s/ft² → 1.915×10⁻³ Pa·s  |  ν = 1.869×10⁻⁶ m²/s
        //   Q = 0.50 ft³/s → 0.01416 m³/s
        //   L_discharge = 82 ft → 24.994 m   |  z₂ = 80 ft → 24.384 m
        //   P₁ (pump inlet) = −3.50 psi → −24132 Pa
        //   Pipe: 2½" Sch-40 D = 62.71 mm
        //   Nozzle D = 1.30 in → 33.02 mm → v₂ = Q/A = 16.534 m/s
        //   Point 1 velocity: 3" Sch-40 suction → v₁ = 2.969 m/s
        //   Expected: hA ≈ 84.8 m → Power ≈ 15.9 kW (21.3 hp)
        sys = {
            exampleId: '11_29',
            fluidName: 'Agua contaminada / Contaminated water (Ej.11.29)',
            tempC: 20,
            Q: 0.01416,
            unitSys: 'SI',
            customFluid: null,
            unknown: { type: 'hA', index: 0 },
            points: [
                {
                    // Point A — Pump inlet: measured at pump suction
                    id: 1, label: 'Pump inlet (Point A)',
                    P: -24132,   // −3.50 psi below atmospheric → Pa
                    z: 0,        // datum at pump inlet
                    v: 2.969     // Q / (π/4 × 0.07793²)  [3" Sch-40 suction pipe]
                },
                {
                    // Point 2 — Nozzle exit: atmospheric pressure, 80 ft above pump
                    id: 2, label: 'Nozzle exit (Point 2)',
                    P: 0,
                    z: 24.384,   // 80 ft × 0.3048 m/ft
                    v: 16.536    // Q / (π/4 × 0.03302²)  [1.30" nozzle diameter]
                }
            ],
            segments: [
                {
                    id: 1,
                    // 2½" Sch-40 steel discharge pipe: D = 62.71 mm, L = 82 ft = 24.994 m
                    // Accessories: 1 standard 90° elbow + nozzle (K=32.6 on pipe velocity head)
                    D: 0.06271, v: 'auto', eps: 0.000046, L: 24.994,
                    has_pump: true, eta: 0.76,
                    accessories: [
                        { name: '90° elbow — standard (screwed)', K: 0.81, qty: 1 },
                        { name: 'Nozzle meter', K: 32.6, qty: 1 }
                    ]
                }
            ]
        };
        nextPointId = 3;
        nextSegId = 2;
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    function loadExampleApp2() {
        // Application Exercise 2 — Hydraulic System Analysis
        // Water supply system: storage tank → open channel through 4" Sch 40 steel pipe
        //
        // ── US Customary → SI conversions ────────────────────────────────────────
        //   Water at 80°F:
        //     ρ = 62.22 lb/ft³ × 16.0185 = 997.1 kg/m³
        //     ν = 2.893×10⁻⁵ ft²/s × 0.0929 = 2.688×10⁻⁶ m²/s
        //     γ = 997.1 × 9.81 / 1000 = 9.777 kN/m³
        //   Pipe (4" Sch 40 commercial steel):
        //     D = 0.3355 ft × 0.3048 = 0.10226 m  |  ε = 0.00015 ft × 0.3048 = 4.572×10⁻⁵ m
        //   Pipe run: 300 ft horizontal + 30 ft vertical descent = 330 ft total
        //     L_pipe = 330 ft × 0.3048 = 100.584 m
        //   Total available head:   H = 40 ft × 0.3048 = 12.192 m
        sys = {
            exampleId: 'app2',
            fluidName: 'Agua / Water (H₂O)',
            tempC: 26.67,   // 80°F = 26.67°C (overridden by customFluid below)
            Q: 0.02,
            unitSys: 'SI',
            customFluid: {
                enabled: true,
                rho: 997.1,    // 62.22 lb/ft³ → 997.1 kg/m³
                gamma: 9.777,  // 997.1 × 9.81 / 1000 kN/m³
                nu: 2.688e-6   // 2.893×10⁻⁵ ft²/s → 2.688×10⁻⁶ m²/s
            },
            unknown: { type: 'Q', index: 0 },
            points: [
                {
                    // Point 1 — Large storage tank surface
                    // Total head = 10 ft water depth + 30 ft vertical drop = 40 ft = 12.192 m above exit
                    id: 1, label: 'Storage tank surface (Point 1)',
                    P: 0,
                    z: 12.192,  // 40 ft × 0.3048 m/ft — datum at channel exit
                    v: 0        // large tank, surface velocity ≈ 0
                },
                {
                    // Point 2 — Free discharge into open channel
                    // z = 0 (datum), P = 0 (atmospheric)
                    id: 2, label: 'Free discharge — open channel (Point 2)',
                    P: 0,
                    z: 0,
                    v: 'auto'    // KE loss evaluated naturally using Q/A
                }
            ],
            segments: [
                {
                    id: 1,
                    // 4" Sch 40 steel pipe
                    // D = 0.3355 ft = 0.10226 m  |  A = 0.08840 ft² = 0.008213 m²
                    // L_pipe = 300 ft horizontal + 30 ft vertical = 330 ft = 100.584 m
                    D: 0.10226,    // 4" Sch 40 internal diameter (m)
                    v: 'auto',
                    eps: 4.572e-5, // 0.00015 ft × 0.3048 = commercial steel (m)
                    L: 100.584,    // effective total length: pipe run (m)
                    has_pump: false,
                    eta: 1,
                    accessories: [
                        { name: '90° elbow — long-radius (flanged)', K: 0.36, qty: 1 },
                        { name: 'Gate valve — 1/2 open', K: 5.6, qty: 1 }
                    ]
                }
            ]
        };
        nextPointId = 3;
        nextSegId = 2;
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    // ─── Point / Segment Mutators ─────────────────────────────────────────────

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
        sys.segments.splice(index - 1, 1);
        if (sys.unknown.index >= sys.points.length) sys.unknown.index = sys.points.length - 1;
        if (sys.unknown.index >= sys.segments.length && sys.unknown.type === 'hA') sys.unknown.index = sys.segments.length - 1;
        const mount = document.getElementById('fluid-ui-mount');
        if (mount) render(mount);
    }

    // ─── Fluid properties resolver (DB or custom override) ────────────────────

    function resolveFluidProps(db) {
        if (sys.customFluid && sys.customFluid.enabled) {
            const cf = sys.customFluid;
            return {
                rho: cf.rho || 1000,
                gamma: cf.gamma || 9.789,  // kN/m³
                mu: cf.mu || null,
                nu: cf.nu || 1e-6,
                temp_C: sys.tempC
            };
        }
        return FluidMechanics.getFluidProperties(sys.fluidName, sys.tempC);
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    function render(mount) {
        let db = FluidMechanics.getDatabase();
        if (!db || !db.fluids) {
            mount.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">Waiting for fluid database...</div>`;
            return;
        }

        const fluidProps = resolveFluidProps(db);

        let res = null;
        if (fluidProps) {
            try {
                // FIX Bug 1: pass fluidProps inside sys and pass sys.unknown as second arg
                const sysWithProps = Object.assign({}, sys, { fluidProps });
                res = FluidMechanics.solveSystem(sysWithProps, sys.unknown);
            } catch (e) {
                console.error('[FluidUI] solveSystem error:', e);
                res = null;
            }
        }

        const html = `
            <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">

                <!-- LEFT COLUMN: INPUTS -->
                <div style="flex:1;min-width:300px;max-width:480px;display:flex;flex-direction:column;gap:12px">

                    <!-- Global Inputs Card -->
                    <div class="card" style="position:sticky;top:10px;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
                        <div class="card-title" style="display:flex;justify-content:space-between">
                            <span>${L('fluid.global', 'Global Inputs')}</span>
                            <select id="fluid-load-ex" class="solution-select" style="width:185px;font-size:11px;padding:4px">
                                <option value="">${L('fluid.load.ex', '-- Load Example --')}</option>
                                <option value="11_2" ${sys.exampleId === '11_2' ? 'selected' : ''}>Ejercicio 11.1 (Mott)</option>
                                <option value="11_29" ${sys.exampleId === '11_29' ? 'selected' : ''}>Ejercicio 11.29 (Mott)</option>
                                <option value="app2" ${sys.exampleId === 'app2' ? 'selected' : ''}>App. Exercise 2 — Hydraulic System (US)</option>
                            </select>
                        </div>

                        <!-- Custom fluid toggle -->
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 8px;background:var(--bg-app);border-radius:6px">
                            <label style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;flex:1">
                                <input type="checkbox" id="fluid-custom-toggle" ${sys.customFluid?.enabled ? 'checked' : ''}> ${L('fluid.custom.toggle', 'Use custom fluid properties')}
                            </label>
                        </div>

                        <!-- Custom fluid inputs (shown only when enabled) -->
                        ${sys.customFluid?.enabled ? `
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;padding:10px;background:rgba(var(--accent-rgb,100,150,255),0.06);border-radius:6px;border:1px solid var(--accent-primary)">
                            <div class="input-group">
                                <label class="input-label">${L('fluid.custom.rho', 'ρ (kg/m³)')}</label>
                                <input id="cf-rho" type="number" step="any" class="input-field" value="${sys.customFluid.rho || 1000}">
                            </div>
                            <div class="input-group">
                                <label class="input-label">${L('fluid.custom.gamma', 'γ (kN/m³)')}</label>
                                <input id="cf-gamma" type="number" step="any" class="input-field" value="${sys.customFluid.gamma || 9.789}">
                            </div>
                            <div class="input-group">
                                <label class="input-label">${L('fluid.custom.nu', 'ν (m²/s)')}</label>
                                <input id="cf-nu" type="number" step="any" class="input-field" value="${sys.customFluid.nu || 1e-6}">
                            </div>
                        </div>` : ''}

                        <div class="input-group" style="margin-bottom:8px;${sys.customFluid?.enabled ? 'opacity:0.45;pointer-events:none' : ''}">
                            <label class="input-label">Fluid</label>
                            <select id="fluid-sel" class="input-field" style="padding:8px">
                                ${Object.keys(db.fluids).map(f => `<option value="${f}" ${f === sys.fluidName ? 'selected' : ''}>${f}</option>`).join('')}
                            </select>
                        </div>

                        <div style="display:flex;gap:12px;margin-bottom:8px">
                            <div class="input-group" style="flex:1;${sys.customFluid?.enabled ? 'opacity:0.45;pointer-events:none' : ''}">
                                <label class="input-label">${L('fluid.temp', 'Temp (°C)')}</label>
                                <input id="fluid-t" type="number" step="any" class="input-field" value="${sys.tempC}">
                            </div>
                            <div class="input-group" style="flex:1;${sys.unknown.type === 'Q' ? 'border:2px solid var(--accent-primary);border-radius:6px;padding:4px' : ''}">
                                <label class="input-label" style="display:flex;justify-content:space-between">
                                    <span>${L('fluid.flow', 'Flow Q (m³/s)')}</span>
                                    <input type="radio" name="chk-unknown" value="Q-0" ${sys.unknown.type === 'Q' ? 'checked' : ''} title="Solve for Q">
                                </label>
                                <input id="fluid-q" type="number" step="any" class="input-field" value="${res && sys.unknown.type === 'Q' ? res.solvedValue.toPrecision(4) : sys.Q}" ${sys.unknown.type === 'Q' ? 'readonly style="background:var(--bg-card);color:var(--accent-primary);font-weight:bold"' : ''}>
                            </div>
                        </div>

                        <div style="font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-app);border-radius:6px;font-family:var(--font-mono)">
                            <span style="color:var(--accent-primary)">ρ</span> = ${fluidProps ? fluidProps.rho.toFixed(1) : '--'} kg/m³ &nbsp;|&nbsp;
                            <span style="color:var(--accent-primary)">γ</span> = ${fluidProps ? fluidProps.gamma.toFixed(3) : '--'} kN/m³ &nbsp;|&nbsp;
                            <span style="color:var(--accent-primary)">ν</span> = ${fluidProps ? fluidProps.nu.toExponential(3) : '--'} m²/s
                        </div>
                    </div>

                    <!-- Pipeline Chain -->
                    <div id="fluid-chain-container" style="display:flex;flex-direction:column;gap:8px;padding-left:14px;border-left:2px solid var(--border)">
                        ${renderBuilderChain(db, res)}
                    </div>

                    <button id="fluid-add-pt" class="secondary-btn" style="margin-top:8px;align-self:flex-start;padding:8px 16px;font-size:13px;border:1px dashed var(--accent-primary);color:var(--accent-primary);background:transparent">${L('fluid.add.pt', '+ Add Point')}</button>
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

    // ─── renderBuilderChain ────────────────────────────────────────────────────

    function renderBuilderChain(db, res) {
        let out = '';
        const N = sys.points.length;

        for (let i = 0; i < N; i++) {
            const pt = sys.points[i];
            const isUnkP = sys.unknown.type === 'P' && sys.unknown.index === i;
            const isUnkZ = sys.unknown.type === 'z' && sys.unknown.index === i;
            const isNumericV = (pt.v !== 0 && pt.v !== 'auto');

            out += `
            <div class="card" style="border-left:3px solid var(--accent-secondary);padding:12px;position:relative">
                ${N > 2 ? `<button class="pt-rm-btn" data-idx="${i}" style="position:absolute;top:8px;right:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px" title="Remove point">✕</button>` : ''}
                <div style="font-size:11px;font-weight:700;color:var(--accent-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">${L('fluid.point', 'Point')} ${i + 1}</div>
                <div class="input-group" style="margin-bottom:8px">
                    <input type="text" class="input-field pt-lbl" data-idx="${i}" value="${pt.label}" placeholder="${L('fluid.point.name.ph', 'Point Name')}">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
                    <div class="input-group">
                        <label class="input-label">P (Pa) <input type="radio" name="chk-unk" value="P-${i}" ${isUnkP ? 'checked' : ''} title="Solve P"></label>
                        <input type="number" class="input-field pt-p" data-idx="${i}" value="${isUnkP ? (res ? res.solvedValue.toFixed(1) : 0) : pt.P}" ${isUnkP ? 'readonly style="color:var(--accent)"' : ''}>
                    </div>
                    <div class="input-group">
                        <label class="input-label">z (m) <input type="radio" name="chk-unk" value="z-${i}" ${isUnkZ ? 'checked' : ''} title="Solve z"></label>
                        <input type="number" class="input-field pt-z" data-idx="${i}" value="${isUnkZ ? (res ? res.solvedValue.toFixed(3) : 0) : pt.z}" ${isUnkZ ? 'readonly style="color:var(--accent)"' : ''}>
                    </div>
                </div>
                <div class="input-group">
                    <label class="input-label">${L('fluid.v.at.pt', 'Velocity at point')}</label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <select class="input-field pt-v" data-idx="${i}" style="font-size:11px;padding:4px;flex:1">
                            <option value="0" ${pt.v === 0 ? 'selected' : ''}>${L('fluid.v.tank', 'Tank surface (v ≈ 0)')}</option>
                            <option value="auto" ${pt.v === 'auto' ? 'selected' : ''}>${L('fluid.v.pipe', 'Pipe/Jet (v = Q/A)')}</option>
                            <option value="_num_" ${isNumericV ? 'selected' : ''}>${L('fluid.v.known', 'Known value (m/s) →')}</option>
                        </select>
                        ${isNumericV ? `<input type="number" step="any" class="input-field pt-v-num" data-idx="${i}" value="${Number(pt.v).toFixed(4)}" style="width:90px;padding:4px;font-size:12px" placeholder="m/s">` : ''}
                    </div>
                </div>
            </div>`;

            if (i < N - 1) {
                const seg = sys.segments[i];
                const isUnkHA = sys.unknown.type === 'hA' && sys.unknown.index === i;
                const isUnkHR = sys.unknown.type === 'hR' && sys.unknown.index === i;
                const sRes = (res && res.segResults) ? res.segResults[i] : null;

                // Build roughness material options
                const roughness = db.roughness || {};
                const roughOpts = Object.entries(roughness).map(([mat, val_mm]) => {
                    const val_m = val_mm / 1000; // roughness in DB is in mm
                    const isSel = Math.abs(seg.eps - val_m) < 1e-9;
                    return `<option value="${val_m}" ${isSel ? 'selected' : ''}>${mat} (${val_mm} mm)</option>`;
                }).join('');

                out += `
                <div class="card" style="background:var(--bg-app);padding:12px;margin:0 8px">
                    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Segment ${i}→${i + 1}: ${L('fluid.seg.geom', 'Geometry')}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
                        <div class="input-group">
                            <label class="input-label">${L('fluid.diam', 'Diam D (m)')}</label>
                            <input type="number" step="any" class="input-field seg-d" data-idx="${i}" value="${seg.D}">
                        </div>
                        <div class="input-group">
                            <label class="input-label">${L('fluid.length', 'Length L (m)')}</label>
                            <input type="number" step="any" class="input-field seg-l" data-idx="${i}" value="${seg.L}">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
                        <div class="input-group">
                            <label class="input-label">${L('fluid.material', 'Material / Roughness')}</label>
                            <select class="input-field seg-mat" data-idx="${i}" style="font-size:11px;padding:4px">
                                <option value="custom">${L('fluid.custom.eps', 'Custom ε (m)')}</option>
                                ${roughOpts}
                            </select>
                        </div>
                        <div class="input-group">
                            <label class="input-label">${L('fluid.eps', 'ε roughness (m)')}</label>
                            <input type="number" step="any" class="input-field seg-eps" data-idx="${i}" value="${seg.eps}">
                        </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:8px;background:var(--bg-card);border-radius:6px;flex-wrap:wrap">
                        <label style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px">
                            <input type="checkbox" class="seg-pump" data-idx="${i}" ${seg.has_pump ? 'checked' : ''}> ${L('fluid.pump.on', 'Pump on this segment')}
                        </label>
                        ${seg.has_pump ? `
                        <div style="display:flex;align-items:center;gap:6px">
                            <label style="font-size:11px;color:var(--text-muted)">η =</label>
                            <input type="number" step="any" class="input-field seg-eta" data-idx="${i}" value="${seg.eta}" style="width:60px;padding:4px">
                            <label style="font-size:11px;color:var(--text-muted)">(efficiency)</label>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px">
                            <label style="font-size:11px;display:flex;align-items:center;gap:4px">
                                <input type="radio" name="chk-unk" value="hA-${i}" ${isUnkHA ? 'checked' : ''}> Solve h<sub>A</sub>
                            </label>
                        </div>` : `
                        <div style="display:flex;align-items:center;gap:8px">
                            <label style="font-size:11px;display:flex;align-items:center;gap:4px">
                                <input type="radio" name="chk-unk" value="hR-${i}" ${isUnkHR ? 'checked' : ''}> Solve h<sub>R</sub>
                            </label>
                        </div>`}
                    </div>

                    <!-- Accessories -->
                    <div style="margin-bottom:6px">
                        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px">${L('fluid.minor', 'Minor Losses (Accessories)')}</div>
                        ${seg.accessories.map((acc, ai) => `
                        <div style="display:grid;grid-template-columns:1fr 80px 50px auto;gap:6px;align-items:center;margin-bottom:4px">
                            <select class="input-field acc-name" data-si="${i}" data-ai="${ai}" style="font-size:11px;padding:4px">
                                ${getAccessoryOptions(db, acc.name)}
                            </select>
                            <input type="number" step="any" class="input-field acc-k" data-si="${i}" data-ai="${ai}" value="${acc.K}" style="font-size:12px" placeholder="K">
                            <input type="number" class="input-field acc-qty" data-si="${i}" data-ai="${ai}" value="${acc.qty}" style="font-size:12px" placeholder="Qty">
                            <button class="acc-rm" data-si="${i}" data-ai="${ai}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px">✕</button>
                        </div>`).join('')}
                        <button class="acc-add" data-si="${i}" style="background:none;border:1px dashed var(--border);color:var(--text-muted);border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;margin-top:4px">${L('fluid.add.acc', '+ Add Accessory')}</button>
                    </div>

                    ${sRes ? `<div style="font-size:11px;color:var(--accent-primary);padding:6px;background:var(--bg-card);border-radius:4px;font-family:var(--font-mono)">
                        v = ${sRes.v ? sRes.v.toFixed(3) : '--'} m/s | NR = ${sRes.NR ? Math.round(sRes.NR).toLocaleString() : '--'} | f = ${sRes.f ? sRes.f.toFixed(5) : '--'} | hf = ${sRes.hf ? sRes.hf.toFixed(3) : '--'} m | Σhm = ${sRes.sum_hm ? sRes.sum_hm.toFixed(3) : '--'} m
                    </div>` : ''}
                </div>

                <div style="width:2px;height:16px;background:var(--border);margin:0 auto"></div>`;
            }
        }
        return out;
    }

    // ─── renderResultsPanel ────────────────────────────────────────────────────

    function renderResultsPanel(fluidProps, res) {
        if (!fluidProps) {
            return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">
                <div style="font-size:32px;margin-bottom:12px">⚠️</div>
                <div style="font-weight:600;margin-bottom:8px">${L('fluid.unknown.fluid', 'Unknown fluid or temperature')}</div>
                <div style="font-size:13px">${L('fluid.select.valid', 'Select a valid fluid and temperature from the Global Inputs panel.')}</div>
            </div>`;
        }
        if (!res) {
            return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">
                <div style="font-size:32px;margin-bottom:12px">⚙️</div>
                <div style="font-weight:600;margin-bottom:8px">${L('fluid.eval.err', 'Unable to evaluate system')}</div>
                <div style="font-size:13px">${L('fluid.eval.check', 'Check your inputs and ensure at least one unknown is selected.')}</div>
            </div>`;
        }

        const gamma = fluidProps.gamma * 1000; // N/m³
        const Q = sys.Q;
        const g = 9.81;

        // FIX Bug 2 & 4: use res.segResults and correct field names (hL_seg, sum_hm)
        const segResults = res.segResults || [];

        let totalHA = res.total_hA || 0;
        let totalHR = res.total_hR || 0;
        let totalHL = res.total_hL || 0;

        // For solved hA, use solvedValue
        if (sys.unknown.type === 'hA') totalHA = res.solvedValue || 0;
        if (sys.unknown.type === 'hR') totalHR = res.solvedValue || 0;

        const pumpSeg = sys.segments.find(s => s.has_pump);
        const pumpEta = pumpSeg ? (pumpSeg.eta || 1) : 1;
        const pumpPower = totalHA > 0 ? (gamma * Q * totalHA) / pumpEta : 0;

        // Build point energy heads
        const N = sys.points.length;
        const pt1 = sys.points[0];
        const ptN = sys.points[N - 1];
        const resolveV = (pt, idx) => {
            if (pt.v === 0) return 0;
            if (pt.v === 'auto') {
                const seg = idx === 0 ? sys.segments[0] : sys.segments[idx - 1];
                if (!seg || !seg.D) return 0;
                const A = Math.PI * seg.D * seg.D / 4;
                return Q / A;
            }
            return Number(pt.v) || 0;
        };
        const v1 = resolveV(pt1, 0);
        const vN = resolveV(ptN, N - 1);

        const E1 = pt1.P / gamma + pt1.z + v1 * v1 / (2 * g);
        const EN = ptN.P / gamma + ptN.z + vN * vN / (2 * g);
        const lhs = E1 + totalHA;
        const rhs = EN + totalHR + totalHL;

        // FIX Bug 3: use residual magnitude instead of non-existent res.converged
        const converged = Math.abs(res.residual) < 0.05;

        // Build segment result cards — FIX Bug 2: use segResults and correct field names
        let segmentCards = segResults.map((s, si) => {
            const seg = sys.segments[si];
            const statusColor = s.regime === 'Laminar' ? '#4caf50' : (s.regime === 'Transition' ? '#ff9800' : '#2196f3');
            const statusLabel = s.regime || (s.NR < 2000 ? 'Laminar' : 'Turbulent');
            const hm = s.sum_hm || 0;   // FIX: was s.hm (wrong)
            const hL = s.hL_seg || 0;   // FIX: was s.hL (wrong)
            return `
            <div class="card" style="padding:14px">
                <div class="card-title" style="margin-bottom:8px">Segment ${si}→${si + 1}: ${L('fluid.seg.eval', 'Evaluation')}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-family:var(--font-mono);font-size:13px">v = ${s.v ? s.v.toFixed(3) : '--'} m/s &nbsp;|&nbsp; NR = ${s.NR ? Math.round(s.NR).toLocaleString() : '--'}</span>
                    <span style="font-size:11px;font-weight:700;color:${statusColor};background:${statusColor}22;padding:2px 8px;border-radius:10px">${statusLabel}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:var(--font-mono);font-size:12px;margin-bottom:8px">
                    <span>ε/D = ${s.eps_D ? s.eps_D.toExponential(2) : '--'}</span>
                    <span>f = ${s.f ? s.f.toFixed(5) : '--'}</span>
                    <span>hf = ${s.hf ? s.hf.toFixed(3) : '--'} m</span>
                </div>
                <div style="font-weight:600;font-size:13px;margin-bottom:6px">Σhm = ${hm.toFixed(3)} m</div>
                ${seg.accessories.map((acc, ai) => {
                const ml = s.minor_losses && s.minor_losses[ai];
                const lossVal = ml && ml.hm != null ? ml.hm : (acc.K * acc.qty * (s.v_head || 0));
                return `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);padding:2px 0">
                        <span>${acc.name}</span>
                        <span style="font-family:var(--font-mono)">K=${acc.K.toFixed(2)} × ${acc.qty} = ${lossVal.toFixed(3)} m</span>
                    </div>`;
            }).join('')}
                <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;font-weight:700">Segment Total hL = ${hL.toFixed(3)} m</div>
            </div>`;
        }).join('');

        const unknownLabel = sys.unknown.type === 'hA' ? `Pump Head — Seg ${sys.unknown.index}→${sys.unknown.index + 1} (hA)` :
            sys.unknown.type === 'hR' ? `Turbine Head — Seg ${sys.unknown.index}→${sys.unknown.index + 1} (hR)` :
                sys.unknown.type === 'Q' ? 'Flow Rate Q' :
                    sys.unknown.type === 'P' ? `Pressure at Point ${sys.unknown.index + 1}` :
                        sys.unknown.type === 'z' ? `Elevation at Point ${sys.unknown.index + 1}` : '?';

        return `
        <div class="card" style="padding:16px">
            <div class="card-title">Global Energy Balance (Mott Eq 11-1)</div>
            <div style="font-family:var(--font-mono);font-size:12px;padding:10px;background:var(--bg-app);border-radius:6px;margin-bottom:12px;line-height:1.9">
                P₁/γ + z₁ + v₁²/2g + ΣhA = Pₙ/γ + zₙ + vₙ²/2g + ΣhR + ΣhL<br>
                <span style="color:var(--accent-secondary)">${E1.toFixed(3)}</span> + <span style="color:#4caf50">${totalHA.toFixed(3)}</span> = <span style="color:var(--accent-secondary)">${EN.toFixed(3)}</span> + <span style="color:#ff9800">${totalHR.toFixed(3)}</span> + <span style="color:#f44336">${totalHL.toFixed(3)}</span><br>
                LHS = ${lhs.toFixed(3)} m &nbsp;|&nbsp; RHS = ${rhs.toFixed(3)} m
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:14px">
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                    <span>E₁ (energy at point 1):</span>
                    <span style="font-weight:700;font-family:var(--font-mono)">${E1.toFixed(3)} m</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                    <span>Eₙ (energy at last point):</span>
                    <span style="font-weight:700;font-family:var(--font-mono)">${EN.toFixed(3)} m</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                    <span>Total head loss (ΣhL):</span>
                    <span style="font-weight:700;font-family:var(--font-mono);color:#f44336">${totalHL.toFixed(3)} m</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                    <span>Pump head (ΣhA):</span>
                    <span style="font-weight:700;font-family:var(--font-mono);color:#4caf50">${totalHA.toFixed(3)} m</span>
                </div>
                ${totalHA > 0 ? `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                    <span style="font-weight:700;color:var(--accent-primary)">Pump Input Power (P = γQhA/η):</span>
                    <span style="font-weight:700;color:var(--accent-primary);font-family:var(--font-mono)">${(pumpPower / 1000).toFixed(3)} kW &nbsp;(${(pumpPower / 745.7).toFixed(2)} hp)</span>
                </div>` : ''}
            </div>

            <div style="margin-top:12px;padding:12px;background:${converged ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.1)'};border-radius:6px;border:1px solid ${converged ? '#4caf50' : '#ff9800'}">
                <div style="font-weight:700;color:${converged ? '#4caf50' : '#ff9800'};font-size:14px">
                    ✓ Solved: ${unknownLabel} = ${(res.solvedValue || 0).toFixed(4)} ${sys.unknown.type === 'Q' ? 'm³/s' : sys.unknown.type === 'P' ? 'Pa' : 'm'}
                </div>
                <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:4px">Residual (LHS−RHS) = ${(res.residual || 0).toExponential(3)} m &nbsp;|&nbsp; γ = ${(gamma).toFixed(0)} N/m³</div>
            </div>
        </div>

        ${segmentCards}`;
    }

    // ─── Accessory Options Helper ──────────────────────────────────────────────

    function getAccessoryOptions(db, selectedName) {
        const fittings = db.fittings || {};
        let opts = `<option value="custom" ${!selectedName || selectedName === 'custom' ? 'selected' : ''}>-- Custom K --</option>`;
        Object.entries(fittings).forEach(([name, Kval]) => {
            opts += `<option value="${name}" ${name === selectedName ? 'selected' : ''}>${name} (K=${Kval})</option>`;
        });
        return opts;
    }

    // ─── Event Binding ─────────────────────────────────────────────────────────

    function bindEvents(mount, db) {
        // Example loader
        mount.querySelector('#fluid-load-ex')?.addEventListener('change', e => {
            if (e.target.value === '11_2') loadExample11_2();
            else if (e.target.value === '11_29') loadExample11_29();
            else if (e.target.value === 'app2') loadExampleApp2();
        });

        // Custom fluid toggle
        mount.querySelector('#fluid-custom-toggle')?.addEventListener('change', e => {
            if (e.target.checked) {
                if (!sys.customFluid) sys.customFluid = { enabled: true, rho: 1000, gamma: 9.789, nu: 1e-6 };
                sys.customFluid.enabled = true;
            } else {
                if (sys.customFluid) sys.customFluid.enabled = false;
            }
            render(mount);
        });

        // Custom fluid ρ
        mount.querySelector('#cf-rho')?.addEventListener('change', e => {
            if (!sys.customFluid) sys.customFluid = { enabled: true };
            sys.customFluid.rho = parseFloat(e.target.value) || 1000;
            render(mount);
        });

        // Custom fluid γ
        mount.querySelector('#cf-gamma')?.addEventListener('change', e => {
            if (!sys.customFluid) sys.customFluid = { enabled: true };
            sys.customFluid.gamma = parseFloat(e.target.value) || 9.789;
            render(mount);
        });

        // Custom fluid ν
        mount.querySelector('#cf-nu')?.addEventListener('change', e => {
            if (!sys.customFluid) sys.customFluid = { enabled: true };
            sys.customFluid.nu = parseFloat(e.target.value) || 1e-6;
            render(mount);
        });

        // Fluid selection
        mount.querySelector('#fluid-sel')?.addEventListener('change', e => {
            sys.fluidName = e.target.value;
            sys.exampleId = undefined;
            render(mount);
        });

        // Temperature
        mount.querySelector('#fluid-t')?.addEventListener('change', e => {
            sys.tempC = parseFloat(e.target.value) || 20;
            render(mount);
        });

        // Flow rate
        mount.querySelector('#fluid-q')?.addEventListener('change', e => {
            sys.Q = parseFloat(e.target.value) || 0.01;
            render(mount);
        });

        // Global unknown radio (Q)
        mount.querySelectorAll('input[name="chk-unknown"]').forEach(r => r.addEventListener('change', e => {
            const [type, idx] = e.target.value.split('-');
            sys.unknown = { type, index: parseInt(idx) };
            render(mount);
        }));

        // Point/segment unknown radios
        mount.querySelectorAll('input[name="chk-unk"]').forEach(r => r.addEventListener('change', e => {
            const parts = e.target.value.split('-');
            const type = parts[0];
            const idx = parseInt(parts[1]);
            sys.unknown = { type, index: idx };
            render(mount);
        }));

        // Point labels
        mount.querySelectorAll('.pt-lbl').forEach(el => el.addEventListener('change', e => {
            sys.points[e.target.dataset.idx].label = e.target.value; render(mount);
        }));

        // Point pressures
        mount.querySelectorAll('.pt-p').forEach(el => el.addEventListener('change', e => {
            sys.points[e.target.dataset.idx].P = parseFloat(e.target.value) || 0; render(mount);
        }));

        // Point elevations
        mount.querySelectorAll('.pt-z').forEach(el => el.addEventListener('change', e => {
            sys.points[e.target.dataset.idx].z = parseFloat(e.target.value) || 0; render(mount);
        }));

        // Point velocity mode selector
        mount.querySelectorAll('.pt-v').forEach(el => el.addEventListener('change', e => {
            const val = e.target.value;
            const idx = e.target.dataset.idx;
            if (val === '0') sys.points[idx].v = 0;
            else if (val === 'auto') sys.points[idx].v = 'auto';
            else if (val === '_num_') sys.points[idx].v = 0.001; // placeholder, user will type
            render(mount);
        }));

        // Point known numeric velocity input
        mount.querySelectorAll('.pt-v-num').forEach(el => el.addEventListener('change', e => {
            sys.points[e.target.dataset.idx].v = parseFloat(e.target.value) || 0;
            render(mount);
        }));

        // Segment diameter
        mount.querySelectorAll('.seg-d').forEach(el => el.addEventListener('change', e => {
            sys.segments[e.target.dataset.idx].D = parseFloat(e.target.value) || 0.05; render(mount);
        }));

        // Segment length
        mount.querySelectorAll('.seg-l').forEach(el => el.addEventListener('change', e => {
            sys.segments[e.target.dataset.idx].L = parseFloat(e.target.value) || 0; render(mount);
        }));

        // Segment material roughness selector — auto-fills ε
        mount.querySelectorAll('.seg-mat').forEach(el => el.addEventListener('change', e => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                sys.segments[e.target.dataset.idx].eps = val;
                render(mount);
            }
        }));

        // Segment roughness (manual ε)
        mount.querySelectorAll('.seg-eps').forEach(el => el.addEventListener('change', e => {
            sys.segments[e.target.dataset.idx].eps = parseFloat(e.target.value) || 4.6e-5; render(mount);
        }));

        // Pump checkbox
        mount.querySelectorAll('.seg-pump').forEach(el => el.addEventListener('change', e => {
            sys.segments[e.target.dataset.idx].has_pump = e.target.checked;
            if (!sys.segments[e.target.dataset.idx].eta) sys.segments[e.target.dataset.idx].eta = 0.75;
            render(mount);
        }));

        // Pump efficiency
        mount.querySelectorAll('.seg-eta').forEach(el => el.addEventListener('change', e => {
            sys.segments[e.target.dataset.idx].eta = parseFloat(e.target.value) || 0.75; render(mount);
        }));

        // Accessory name
        mount.querySelectorAll('.acc-name').forEach(el => el.addEventListener('change', e => {
            const si = parseInt(e.target.dataset.si);
            const ai = parseInt(e.target.dataset.ai);
            const newName = e.target.value;
            sys.segments[si].accessories[ai].name = newName;
            const K = (db.fittings || {})[newName];
            if (K !== undefined) sys.segments[si].accessories[ai].K = K;
            render(mount);
        }));

        // Accessory K
        mount.querySelectorAll('.acc-k').forEach(el => el.addEventListener('change', e => {
            sys.segments[parseInt(e.target.dataset.si)].accessories[parseInt(e.target.dataset.ai)].K = parseFloat(e.target.value) || 0;
            render(mount);
        }));

        // Accessory qty
        mount.querySelectorAll('.acc-qty').forEach(el => el.addEventListener('change', e => {
            sys.segments[parseInt(e.target.dataset.si)].accessories[parseInt(e.target.dataset.ai)].qty = parseInt(e.target.value) || 1;
            render(mount);
        }));

        // Remove accessory
        mount.querySelectorAll('.acc-rm').forEach(el => el.addEventListener('click', e => {
            const si = parseInt(e.target.dataset.si);
            const ai = parseInt(e.target.dataset.ai);
            sys.segments[si].accessories.splice(ai, 1);
            render(mount);
        }));

        // Add accessory
        mount.querySelectorAll('.acc-add').forEach(el => el.addEventListener('click', e => {
            const si = parseInt(e.target.dataset.si);
            sys.segments[si].accessories.push({ name: 'custom', K: 0, qty: 1 });
            render(mount);
        }));

        // Add point
        mount.querySelector('#fluid-add-pt')?.addEventListener('click', addPoint);

        // Remove point
        mount.querySelectorAll('.pt-rm-btn').forEach(el => el.addEventListener('click', e => {
            removePoint(parseInt(e.target.dataset.idx));
        }));
    }

    // ─── Public API ────────────────────────────────────────────────────────────

    function init() {
        loadExample11_2();
        // Register language rerender hook so the full UI rebuilds on language switch
        if (window.Lang) {
            Lang.onRerender(() => {
                const m = document.getElementById('fluid-ui-mount');
                if (m) render(m);
            });
        }
    }

    function mount(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = `<div id="fluid-ui-mount"></div>`;
        const mountEl = document.getElementById('fluid-ui-mount');
        if (mountEl) render(mountEl);
    }

    return { init, mount, render: () => { const m = document.getElementById('fluid-ui-mount'); if (m) render(m); } };
})();

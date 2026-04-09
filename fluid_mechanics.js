/**
 * fluid_mechanics.js — Core Engine for point-based energy system
 */
'use strict';

const FluidMechanics = (() => {
    let db = {
        fluids: {},
        roughness: {},
        schedules: {},
        fittings: {}
    };

    const g = 9.81; // m/s^2

    function init(fluidData) {
        db = fluidData;
        console.log('[FluidMechanics] Initialized with', Object.keys(db.fluids).length, 'fluids.');
    }

    // Step 1: Fluid properties
    function getFluidProperties(fluidName, tempC) {
        const data = db.fluids[fluidName];
        if (!data || data.length === 0) return null;

        let sorted = [...data].sort((a, b) => a.temp_C - b.temp_C);

        if (tempC <= sorted[0].temp_C) return { ...sorted[0], temp_C: tempC };
        if (tempC >= sorted[sorted.length - 1].temp_C) return { ...sorted[sorted.length - 1], temp_C: tempC };

        for (let i = 0; i < sorted.length - 1; i++) {
            const p1 = sorted[i];
            const p2 = sorted[i + 1];
            if (tempC >= p1.temp_C && tempC <= p2.temp_C) {
                const f = (tempC - p1.temp_C) / (p2.temp_C - p1.temp_C);
                return {
                    temp_C: tempC,
                    rho: p1.rho + f * (p2.rho - p1.rho),
                    gamma: p1.gamma + f * (p2.gamma - p1.gamma),
                    mu: (p1.mu !== null && p2.mu !== null) ? p1.mu + f * (p2.mu - p1.mu) : null,
                    nu: (p1.nu !== null && p2.nu !== null) ? p1.nu + f * (p2.nu - p1.nu) : null
                };
            }
        }
        return null;
    }

    // Step 2: Per-segment hydraulics
    function calculateSegment(Q, D_m, fluidProps, eps_m, L_m, accessories) {
        let A, v;
        const hasPipe = (D_m > 0);

        if (hasPipe) {
            A = Math.PI * Math.pow(D_m, 2) / 4;
            v = Q / A;
        } else {
            // If no pipe is specified, we basically only care about accessories.
            // But we need a velocity to compute hm. We will expect the caller to pass
            // a reference velocity later or we flag this segment as purely accessory based
            // on adjacent points. For simplicity, we assume A and v are left to be defined
            // externally, or accessories compute hm=0 in isolation without v.
            A = null;
            v = null;
        }

        const NR = (hasPipe && fluidProps.nu > 0) ? (v * D_m) / fluidProps.nu : 0;
        const eps_D = hasPipe ? eps_m / D_m : 0;

        let regime = "Laminar";
        let f = 0;

        if (hasPipe) {
            if (NR === 0) {
                regime = "Laminar";
                f = 0;
            } else if (NR < 2000) {
                regime = "Laminar";
                f = 64 / NR;
            } else if (NR > 4000) {
                regime = "Turbulent";
                f = 0.25 / Math.pow(Math.log10(eps_D / 3.7 + 5.74 / Math.pow(NR, 0.9)), 2);
            } else {
                regime = "Transition";
                const f_lam = 64 / 2000;
                const f_turb = 0.25 / Math.pow(Math.log10(eps_D / 3.7 + 5.74 / Math.pow(4000, 0.9)), 2);
                const factor = (NR - 2000) / 2000;
                f = f_lam + factor * (f_turb - f_lam);
            }
        }

        const v_head = hasPipe ? (Math.pow(v, 2) / (2 * g)) : 0;
        const hf = hasPipe ? f * (L_m / D_m) * v_head : 0;

        let minor_losses = [];
        let total_hm = 0;

        if (accessories && Array.isArray(accessories)) {
            accessories.forEach(acc => {
                // To compute hm, we need a v. If hasPipe=false, we defer hm calculation
                // and compute it in evaluateSystem once a velocity is established.
                let hm_acc = hasPipe ? acc.K * acc.qty * v_head : null;
                if (hm_acc !== null) total_hm += hm_acc;
                minor_losses.push({ ...acc, hm: hm_acc });
            });
        }

        const hL_seg = hasPipe ? hf + total_hm : null; // Will be resolved fully in evaluateSystem

        return {
            hasPipe, A, v, NR, eps_D, regime, f, hf,
            minor_losses, sum_hm: total_hm, hL_seg, v_head
        };
    }

    // Full system evaluation given all knowns
    function evaluateSystem(sys) {
        // sys = { Q, fluidProps, points: [{P, z, v}], segments: [{D, eps, L, accessories, has_pump, has_turbine, hA, hR, eta}] }
        const { Q, fluidProps, points, segments } = sys;

        let total_hA = 0;
        let total_hR = 0;
        let total_hL = 0;

        let segResults = [];

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const accs = seg.accessories || [];

            // Legacy support fallback
            if (seg.sum_K && accs.length === 0) {
                accs.push({ name: 'Lumped Accessories', K: seg.sum_K, qty: 1 });
            }

            let D_m = seg.D;
            if (D_m === 'auto' && seg.v !== 'auto' && seg.v > 0) {
                D_m = Math.sqrt((4 * Q) / (Math.PI * seg.v));
            } else if (!D_m || D_m === 'auto') {
                D_m = 0;
            }

            let res = calculateSegment(Q, D_m, fluidProps, seg.eps || 0, seg.L || 0, accs);

            let seg_hA = 0;
            let seg_hR = 0;
            if (seg.has_pump) {
                seg_hA = seg.hA || 0;
                total_hA += seg_hA;
            }
            if (seg.has_turbine) {
                seg_hR = seg.hR || 0;
                total_hR += seg_hR;
            }

            segResults.push({ ...res, seg_hA, seg_hR });
        }

        // Ensure points and pipeless segments have velocities
        let ptResults = [];
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            let pt_v = pt.v;

            if (pt_v === 'auto' || pt_v === null || pt_v === undefined) {
                // Try upstream/downstream segments with pipes
                if (i < segments.length && segResults[i].hasPipe) {
                    pt_v = segResults[i].v;
                } else if (i > 0 && segResults[i - 1].hasPipe) {
                    pt_v = segResults[i - 1].v;
                } else {
                    pt_v = 0;
                }
            }
            ptResults.push({ ...pt, v: pt_v });
        }

        // Second pass: resolve pipeless segments now that we have point velocities
        for (let i = 0; i < segments.length; i++) {
            let res = segResults[i];
            if (!res.hasPipe) {
                // For a pipeless segment, we use the velocity from the upstream point
                const v_ref = ptResults[i].v;
                res.v = v_ref;
                res.v_head = Math.pow(v_ref, 2) / (2 * g);

                res.sum_hm = 0;
                res.minor_losses.forEach(ml => {
                    ml.hm = ml.K * ml.qty * res.v_head;
                    res.sum_hm += ml.hm;
                });
                res.hL_seg = res.sum_hm; // hf is 0
            }

            total_hL += res.hL_seg;
        }

        const p1 = ptResults[0];
        const pN = ptResults[ptResults.length - 1];
        const gamma = (fluidProps && fluidProps.gamma) ? fluidProps.gamma * 1000 : 9810; // default water

        const E1 = p1.P / gamma + p1.z + Math.pow(p1.v, 2) / (2 * g);
        const E2 = pN.P / gamma + pN.z + Math.pow(pN.v, 2) / (2 * g);

        const LHS = E1 + total_hA;
        const RHS = E2 + total_hR + total_hL;
        const residual = LHS - RHS; // positive means LHS > RHS (needs more hR/hL or higher E2 to balance)

        let total_pump_kW = 0;
        for (let i = 0; i < segments.length; i++) {
            if (segments[i].has_pump) {
                const hA = segments[i].hA || 0;
                if (hA > 0) {
                    const eta = segments[i].eta || 1;
                    total_pump_kW += (gamma * Q * hA) / eta / 1000;
                }
            }
        }

        return {
            residual, LHS, RHS, E1, E2, total_hA, total_hR, total_hL, segResults, ptResults, gamma, total_pump_kW
        };
    }

    // Solve for a single unknown
    function solveSystem(sysDef, unknownTarget) {
        // unknownTarget: { type: 'Q' | 'P' | 'z' | 'hA' | 'hL', index: pt_index or seg_index }
        // For linear unknowns (P, z, hA), we can evaluate with 0 and then solve analytically
        // For Q, we use a numerical root finder (bisection)

        if (unknownTarget.type !== 'Q') {
            // zero out the unknown just to calculate residual without it
            let testSys = JSON.parse(JSON.stringify(sysDef));
            testSys.fluidProps = sysDef.fluidProps; // keep ref

            if (unknownTarget.type === 'P') testSys.points[unknownTarget.index].P = 0;
            if (unknownTarget.type === 'z') testSys.points[unknownTarget.index].z = 0;
            if (unknownTarget.type === 'hA' || unknownTarget.type === 'hR') {
                // We just assume testSys segments won't have it (or we set it to 0)
                if (unknownTarget.type === 'hA') testSys.segments[unknownTarget.index].hA = 0;
            }
            // For hL as unknown, it just means "evaluate it normally, residual should be 0, return LHS vs RHS difference?"
            // But wait, hL is calculated from Q. You can't just "solve for hL" as a variable if it's derived.
            // If they mark hL as unknown, it means we probably assume hL is what's needed to balance the energy equation.

            let res0 = evaluateSystem(testSys);

            let solvedValue = 0;
            const gamma = res0.gamma;

            if (unknownTarget.type === 'P') {
                if (unknownTarget.index === 0) {
                    // E1 + hA = E2 + hR + hL -> P1/y + ... = E2 + hR + hL - hA
                    // res0.residual = (E1_0 + hA) - RHS
                    // -> LHS_0 - RHS + P1/y = 0 -> P1/y = RHS - LHS_0 -> P1 = -res0.residual * gamma
                    solvedValue = -res0.residual * gamma;
                } else if (unknownTarget.index === sysDef.points.length - 1) {
                    // LHS = E2_0 + P2/y + hR + hL -> P2/y = LHS - RHS_0
                    solvedValue = res0.residual * gamma;
                }
            } else if (unknownTarget.type === 'z') {
                if (unknownTarget.index === 0) solvedValue = -res0.residual;
                else if (unknownTarget.index === sysDef.points.length - 1) solvedValue = res0.residual;
            } else if (unknownTarget.type === 'hA') {
                solvedValue = -res0.residual; // LHS_0 + hA - RHS = 0 -> hA = -residual
            } else if (unknownTarget.type === 'hL') {
                // The head loss required to balance the system, beyond what pipes provide
                solvedValue = res0.residual;
            }

            // Re-evaluate with solved value
            let finalSys = JSON.parse(JSON.stringify(sysDef));
            finalSys.fluidProps = sysDef.fluidProps;
            if (unknownTarget.type === 'P') finalSys.points[unknownTarget.index].P = solvedValue;
            if (unknownTarget.type === 'z') finalSys.points[unknownTarget.index].z = solvedValue;
            if (unknownTarget.type === 'hA') finalSys.segments[unknownTarget.index].hA = solvedValue;
            if (unknownTarget.type === 'Q') finalSys.Q = solvedValue; // not possible here

            let finalRes = evaluateSystem(finalSys);
            finalRes.solvedValue = solvedValue;
            return finalRes;
        } else {
            // Solve for Q using bisection (0.000001 to 1000)
            let qLow = 1e-8;
            let qHigh = 1000;
            let qMid = 0;

            let testSys = JSON.parse(JSON.stringify(sysDef));
            testSys.fluidProps = sysDef.fluidProps;

            for (let i = 0; i < 60; i++) {
                qMid = (qLow + qHigh) / 2;
                testSys.Q = qMid;
                let res = evaluateSystem(testSys);
                // We know that as Q increases, hL (which is on RHS) increases.
                // residual = LHS - RHS. LHS usually decreases slightly (v1^2/2g) and RHS increases significantly (v2^2/2g + hL)
                // So residual decreases as Q increases. residual is monotonically decreasing with Q usually.
                if (res.residual > 0) {
                    qLow = qMid;
                } else {
                    qHigh = qMid;
                }
            }

            testSys.Q = qMid;
            let finalRes = evaluateSystem(testSys);
            finalRes.solvedValue = qMid;
            return finalRes;
        }
    }

    return {
        init,
        getDatabase: () => db,
        getFluidProperties,
        calculateSegment,
        evaluateSystem,
        solveSystem
    };
})();

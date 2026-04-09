/**
 * app.js — ChemE Units Application Entry Point
 */
'use strict';

(async () => {
    const loadingEl = document.getElementById('app-loading');
    const appEl = document.getElementById('app-content');

    try {
        const [unitsData, periodicData, constantsData, fluidData] = await Promise.all([
            fetch('data/units_data.json').then(r => { if (!r.ok) throw new Error('units_data.json not found'); return r.json(); }),
            fetch('data/periodic_table.json').then(r => { if (!r.ok) throw new Error('periodic_table.json not found'); return r.json(); }),
            fetch('data/constants.json').then(r => { if (!r.ok) throw new Error('constants.json not found'); return r.json(); }),
            fetch('data/fluid_transport.json').then(r => { if (!r.ok) throw new Error('fluid_transport.json not found'); return r.json(); }),
        ]);

        Engine.init(unitsData);
        MolarMass.init(periodicData);
        FluidMechanics.init(fluidData);

        ConverterUI.init();
        MolarUI.init();
        PeriodicUI.init(periodicData);
        ConstantsUI.init(constantsData);
        FavoritesUI.init();
        LibraryUI.init(unitsData);
        BalancerUI.init();
        MathUI.init();
        CreUI.init();
        FluidUI.init();

        const unitCount = Object.keys(unitsData.units || {}).length;
        const elCount = periodicData.length;
        const constCount = constantsData.length;
        const badge = document.getElementById('data-badge');
        if (badge) badge.textContent = `${unitCount} units · ${elCount} elements · ${constCount} constants`;

        if (loadingEl) loadingEl.style.display = 'none';
        if (appEl) appEl.style.display = '';

        // ── Tab switching (desktop + mobile) ──────────────────────
        function switchTab(target) {
            document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === target);
                if (b.tagName === 'BUTTON') b.setAttribute('aria-selected', b.dataset.tab === target);
            });
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`tab-${target}`)?.classList.add('active');
        }

        document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // ── Sub-Tab switching ──────────────────────
        document.querySelectorAll('.sub-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.sub;
                document.querySelectorAll('.sub-nav-btn').forEach(b => {
                    const isActive = b.dataset.sub === target;
                    b.classList.toggle('active', isActive);
                    b.style.color = isActive ? 'var(--accent-primary)' : 'var(--text-muted)';
                    b.style.borderBottom = isActive ? '2px solid var(--accent-primary)' : 'none';
                });
                document.querySelectorAll('.sub-pane').forEach(p => {
                    p.style.display = p.id === `sub-${target}` ? 'block' : 'none';
                });
            });
        });

        // Expose for favorites
        window._switchTab = switchTab;

    } catch (err) {
        if (loadingEl) {
            loadingEl.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:hsl(2,60%,45%)">
          <div style="font-size:28px;margin-bottom:16px">⚠</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px">Failed to load databases</div>
          <div style="font-size:13px;color:var(--text-muted);max-width:380px;margin:0 auto">
            ${err.message}<br><br>
            Run <code style="background:var(--bg-card);padding:2px 6px;border-radius:4px">python convert_databases.py</code>
            to generate the JSON files, and serve via a local web server (not file://).
          </div>
        </div>`;
        }
        console.error('[ChemE Units] Startup error:', err);
    }
})();

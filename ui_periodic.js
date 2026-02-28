/**
 * ui_periodic.js — Periodic Table Tab UI
 * Renders a full 18-column × 10-row grid with lanthanide/actinide rows.
 */
'use strict';

const PeriodicUI = (() => {

    let _elements = [];

    // Map category strings to CSS classes
    const CAT_MAP = {
        'Alkali metal': 'cat-alkali',
        'Alkaline earth metal': 'cat-alkaline',
        'Transition metal': 'cat-transition',
        'Post-transition metal': 'cat-post-transition',
        'Metalloid': 'cat-metalloid',
        'Reactive nonmetal': 'cat-reactive',
        'Noble gas': 'cat-noble',
        'Lanthanide': 'cat-lanthanide',
        'Actinide': 'cat-actinide',
    };

    // Standard periodic table positions [Z] => [period, group]
    // We'll build a grid from actual period/group data in the dataset.
    const PT_COLS = 18;
    const PT_ROWS = 10; // 7 main + gap row + 2 for lanthanides/actinides

    function init(elements) {
        _elements = elements;
        buildTable();
        buildLegend();
        setupSearch();
    }

    function buildTable() {
        const grid = document.getElementById('pt-grid');
        if (!grid) return;

        // Build lookup by Z
        const byZ = {};
        for (const el of _elements) byZ[el.Z] = el;

        // Place elements in grid cells (period × group)
        // Create an 10×18 matrix (rows 8,9 are lanthanides/actinides displayed separately)
        const matrix = Array.from({ length: PT_ROWS }, () => Array(PT_COLS).fill(null));

        for (const el of _elements) {
            const period = el.period;
            const group = el.group;
            if (!period || !group) continue;

            // Lanthanides (Z 57-71) and Actinides (Z 89-103) go to rows 8 and 9
            let row = period - 1;
            if (el.Z >= 57 && el.Z <= 71) row = 8;
            else if (el.Z >= 89 && el.Z <= 103) row = 9;

            const col = group - 1;
            if (row < PT_ROWS && col < PT_COLS) matrix[row][col] = el;
        }

        // Render
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${PT_COLS}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${PT_ROWS}, auto)`;

        for (let r = 0; r < PT_ROWS; r++) {
            // Add a visual gap row between main table and f-block
            if (r === 7) {
                for (let c = 0; c < PT_COLS; c++) {
                    const gap = document.createElement('div');
                    gap.style.height = '6px';
                    grid.appendChild(gap);
                }
                continue;
            }

            for (let c = 0; c < PT_COLS; c++) {
                const el = matrix[r][c];
                const cell = document.createElement('div');

                if (!el) {
                    cell.className = 'pt-cell empty';
                } else {
                    const catClass = CAT_MAP[el.category] || 'cat-unknown';
                    cell.className = `pt-cell ${catClass}`;
                    cell.dataset.z = el.Z;
                    cell.innerHTML = `
            <span class="pt-Z">${el.Z}</span>
            <span class="pt-sym">${el.symbol}</span>
            <span class="pt-name">${el.name.length > 8 ? el.name.slice(0, 7) + '…' : el.name}</span>`;
                    cell.addEventListener('click', () => showInfo(el));
                    cell.title = `${el.name} (Z=${el.Z})`;
                }
                grid.appendChild(cell);
            }
        }
    }

    function buildLegend() {
        const legend = document.getElementById('pt-legend');
        if (!legend) return;
        const entries = Object.entries(CAT_MAP);
        legend.innerHTML = entries.map(([name, cls]) =>
            `<div class="pt-legend-item">
         <div class="pt-legend-swatch ${cls}"></div>
         <span>${name}</span>
       </div>`
        ).join('');
    }

    function showInfo(el) {
        const info = document.getElementById('pt-info');
        if (!info) return;

        const fmt = v => v != null ? v : '—';
        const fmtK = v => v != null ? `${v} K` : '—';
        const fmtGs = v => v != null ? `${v} g/cm³` : '—';

        info.innerHTML = `
      <div class="pt-info-symbol">${el.symbol}</div>
      <div class="pt-info-data" style="flex:1">
        <div class="pt-info-name">${el.name}</div>
        <div class="pt-info-Z">Z = ${el.Z}  ·  ${el.category || ''}  ·  ${el.phase || ''}</div>
        <div style="font-family:var(--font-mono);font-size:15px;color:var(--accent-secondary);margin-top:6px">
          ${el.weight != null ? el.weight.toFixed(4) + ' g/mol' : '—'}
        </div>
      </div>
      <div class="pt-info-props">
        <div class="pt-prop">
          <span class="pt-prop-label">Period / Group</span>
          <span class="pt-prop-value">${fmt(el.period)} / ${fmt(el.group)}</span>
        </div>
        <div class="pt-prop">
          <span class="pt-prop-label">Block</span>
          <span class="pt-prop-value">${fmt(el.block)}</span>
        </div>
        <div class="pt-prop">
          <span class="pt-prop-label">Melting Point</span>
          <span class="pt-prop-value">${fmtK(el.melt_K)}</span>
        </div>
        <div class="pt-prop">
          <span class="pt-prop-label">Boiling Point</span>
          <span class="pt-prop-value">${fmtK(el.boil_K)}</span>
        </div>
        <div class="pt-prop">
          <span class="pt-prop-label">Density</span>
          <span class="pt-prop-value">${fmtGs(el.density)}</span>
        </div>
        <div class="pt-prop">
          <span class="pt-prop-label">Electronegativity</span>
          <span class="pt-prop-value">${fmt(el.electronegativity)}</span>
        </div>
      </div>`;
    }

    function setupSearch() {
        const input = document.getElementById('pt-search');
        if (!input) return;

        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            document.querySelectorAll('.pt-cell:not(.empty)').forEach(cell => {
                const el = _elements.find(e => String(e.Z) === cell.dataset.z);
                if (!el) return;
                const match = !q
                    || el.symbol.toLowerCase().includes(q)
                    || el.name.toLowerCase().includes(q)
                    || String(el.Z) === q
                    || (el.category || '').toLowerCase().includes(q);
                cell.style.opacity = match ? '1' : '0.15';
                cell.style.pointerEvents = match ? 'auto' : 'none';
            });
        });
    }

    return { init };
})();

window.PeriodicUI = PeriodicUI;

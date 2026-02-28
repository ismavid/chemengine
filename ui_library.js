/**
 * ui_library.js — Unit Symbol Reference Library
 * Displays a searchable list of unit symbols, names, and quantity types.
 * Built from the units_data.json already loaded by the engine.
 */
'use strict';

const LibraryUI = (() => {

    let _entries = []; // { symbol, name, quantity }

    // Map dimension vectors to human-readable quantity names
    const DIM_LABELS = {
        'M1': 'mass',
        'L1': 'length',
        'T1': 'time',
        'Th1': 'temperature',
        'N1': 'amount',
        'I1': 'current',
        'J1': 'luminosity',
        'L2': 'area',
        'L3': 'volume',
        'M1L-1T-2': 'pressure',
        'M1L1T-2': 'force',
        'M1L2T-2': 'energy',
        'M1L2T-3': 'power',
        'M1L-3': 'density',
        'M1L-1T-1': 'viscosity (dynamic)',
        'L2T-1': 'viscosity (kinematic)',
        'L3T-1': 'flow rate (volumetric)',
        'M1T-1': 'flow rate (mass)',
        'T-1': 'frequency',
        'L1T-1': 'velocity',
        'L1T-2': 'acceleration',
        'M1L2T-3I-1': 'voltage',
        'M1L2T-3I-2': 'resistance',
        'M-1L-2T4I2': 'capacitance',
        'M1L2T-2I-2': 'inductance',
        'L2T-2': 'absorbed dose / specific energy',
        'M1L2T-2N-1': 'molar energy',
        'M1L2T-2N-1Th-1': 'molar entropy',
        'M1L0T-2': 'surface tension',
        'M1L1T-3Th-1': 'thermal conductivity',
        'M1L0T-3Th-1': 'heat transfer coefficient',
        'L2T-2Th-1': 'specific heat capacity',
        'M1L-3T0': 'density',
        'L0T0': 'dimensionless',
        '': 'dimensionless',
    };

    function dimKey(dim) {
        // Build a canonical string key from non-zero dimension entries
        const keys = ['M', 'L', 'T', 'Th', 'N', 'I', 'J'];
        return keys
            .filter(k => dim[k] && dim[k] !== 0)
            .map(k => `${k}${dim[k]}`)
            .join('');
    }

    function quantityFor(dim) {
        const key = dimKey(dim);
        return DIM_LABELS[key] || (key ? 'compound unit' : 'dimensionless');
    }

    function init(unitsData) {
        const units = unitsData.units || {};
        _entries = Object.entries(units).map(([symbol, info]) => ({
            symbol,
            name: info.name,
            quantity: quantityFor(info.dim),
        })).sort((a, b) => a.symbol.localeCompare(b.symbol));

        renderList('');
        setupSearch();
    }

    function setupSearch() {
        const input = document.getElementById('library-search');
        if (!input) return;
        input.addEventListener('input', () => renderList(input.value));
    }

    function renderList(query) {
        const container = document.getElementById('library-list');
        if (!container) return;

        const q = query.trim().toLowerCase();
        const filtered = q
            ? _entries.filter(e =>
                e.symbol.toLowerCase().includes(q) ||
                e.name.toLowerCase().includes(q) ||
                e.quantity.toLowerCase().includes(q))
            : _entries;

        if (!filtered.length) {
            container.innerHTML = `<div style="padding:12px 8px;color:var(--text-muted);font-size:12px">No units found.</div>`;
            return;
        }

        container.innerHTML = filtered.slice(0, 300).map(e => `
          <div class="library-item" data-sym="${escHtml(e.symbol)}" title="${escHtml(e.name)}">
            <span class="lib-sym">${escHtml(e.symbol)}</span>
            <span class="lib-name">${escHtml(e.name)}</span>
            <span class="lib-qty">${escHtml(e.quantity)}</span>
          </div>`).join('');

        // Click to APPEND unit symbol to whichever unit field is currently focused
        container.querySelectorAll('.library-item').forEach(item => {
            item.addEventListener('click', () => {
                const sym = item.dataset.sym;
                if (!document.getElementById('tab-converter')?.classList.contains('active')) return;
                const active = document.activeElement;
                const isUnitField = active && (active.id === 'src-unit' || active.id === 'tgt-unit');
                const field = isUnitField ? active : document.getElementById('src-unit');
                if (!field) return;
                const cur = field.value.trim();
                field.value = cur ? cur + '*' + sym : sym;
                field.dispatchEvent(new Event('input')); // triggers validation + compound visibility
                field.focus();
            });
        });
    }

    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { init };
})();

window.LibraryUI = LibraryUI;

/**
 * ui_favorites.js — Favorites System
 * Persists conversions and constants to localStorage.
 */
'use strict';

const FavoritesUI = (() => {
    const STORAGE_KEY = 'cheme_favorites_v1';

    let _data = { conversions: [], constants: [] };

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) _data = JSON.parse(raw);
        } catch (_) { _data = { conversions: [], constants: [] }; }
        if (!_data.conversions) _data.conversions = [];
        if (!_data.constants) _data.constants = [];
    }

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_data)); } catch (_) { }
    }

    function init() {
        load();
        render();
    }

    // ── Conversions ───────────────────────────────────────────
    function hasConversion(src, tgt) {
        return _data.conversions.some(f => f.src === src && f.tgt === tgt);
    }

    function addConversion(src, tgt) {
        if (!hasConversion(src, tgt)) {
            _data.conversions.push({ src, tgt, label: `${src} → ${tgt}` });
            save(); render();
        }
    }

    function removeConversion(src, tgt) {
        _data.conversions = _data.conversions.filter(f => !(f.src === src && f.tgt === tgt));
        save(); render();
    }

    // ── Constants ─────────────────────────────────────────────
    function hasConstant(symbol) {
        return _data.constants.some(c => c.symbol === symbol);
    }

    function addConstant(c) {
        if (!hasConstant(c.symbol)) {
            _data.constants.push({ symbol: c.symbol, name: c.name, value: c.value, unit: c.unit });
            save(); render();
        }
    }

    function removeConstant(symbol) {
        _data.constants = _data.constants.filter(c => c.symbol !== symbol);
        save(); render();
    }

    // ── Render ────────────────────────────────────────────────
    function render() {
        const section = document.getElementById('fav-section');
        if (!section) return;

        const noItems = !_data.conversions.length && !_data.constants.length;
        section.style.display = noItems ? 'none' : '';

        const itemsEl = section.querySelector('#fav-items');
        if (!itemsEl) return;

        itemsEl.innerHTML = '';

        // Conversion chips
        _data.conversions.forEach(f => {
            const el = document.createElement('div');
            el.className = 'fav-item';
            el.title = `Load: ${f.label}`;
            el.innerHTML = `
        <span>${escHtml(f.label)}</span>
        <span class="fav-remove" title="Remove" data-src="${escHtml(f.src)}" data-tgt="${escHtml(f.tgt)}">×</span>`;

            // Click to load conversion
            el.addEventListener('click', e => {
                if (e.target.classList.contains('fav-remove')) return;
                const si = document.getElementById('src-unit');
                const ti = document.getElementById('tgt-unit');
                if (si && ti) {
                    si.value = f.src;
                    ti.value = f.tgt;
                    document.getElementById('convert-btn')?.click();
                    // Scroll to converter
                    document.getElementById('tab-btn-converter')?.click();
                }
            });

            // Remove button
            el.querySelector('.fav-remove').addEventListener('click', e => {
                e.stopPropagation();
                removeConversion(f.src, f.tgt);
            });

            itemsEl.appendChild(el);
        });

        // Constant chips
        _data.constants.forEach(c => {
            const el = document.createElement('div');
            el.className = 'fav-const-card';
            el.title = `${c.name}: ${c.value} ${c.unit}`;
            el.innerHTML = `
        <span class="fav-const-sym">${escHtml(c.symbol)}</span>
        <span class="fav-const-name">${escHtml(c.name)}</span>
        <span class="fav-remove" title="Remove" style="margin-left:auto">×</span>`;

            el.addEventListener('click', e => {
                if (e.target.classList.contains('fav-remove')) return;
                navigator.clipboard?.writeText(`${c.symbol} = ${c.value} ${c.unit}`);
            });

            el.querySelector('.fav-remove').addEventListener('click', e => {
                e.stopPropagation();
                removeConstant(c.symbol);
            });

            itemsEl.appendChild(el);
        });
    }

    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { init, addConversion, removeConversion, hasConversion, addConstant, removeConstant, hasConstant };
})();

window.FavoritesUI = FavoritesUI;

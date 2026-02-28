/**
 * ui_constants.js — Engineering Constants Tab UI
 */
'use strict';

const ConstantsUI = (() => {

    let _constants = [];
    let _activeCategory = 'All';

    function init(constants) {
        _constants = constants;
        buildCategories();
        renderCards('All', '');

        document.getElementById('constants-search').addEventListener('input', () => {
            renderCards(_activeCategory, document.getElementById('constants-search').value);
        });
    }

    function buildCategories() {
        const cats = ['All', ...new Set(_constants.map(c => c.category).filter(Boolean))];
        const container = document.getElementById('cat-filters');
        container.innerHTML = cats.map(cat =>
            `<button class="cat-chip${cat === 'All' ? ' active' : ''}" data-cat="${escHtml(cat)}">${escHtml(cat)}</button>`
        ).join('');

        container.addEventListener('click', e => {
            const btn = e.target.closest('.cat-chip');
            if (!btn) return;
            container.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _activeCategory = btn.dataset.cat;
            renderCards(_activeCategory, document.getElementById('constants-search').value);
        });
    }

    function renderCards(category, query) {
        const grid = document.getElementById('constants-grid');
        const q = (query || '').toLowerCase().trim();

        const filtered = _constants.filter(c => {
            const catMatch = category === 'All' || c.category === category;
            const qMatch = !q
                || c.symbol.toLowerCase().includes(q)
                || c.name.toLowerCase().includes(q)
                || (c.unit || '').toLowerCase().includes(q)
                || (c.category || '').toLowerCase().includes(q)
                || (c.description || '').toLowerCase().includes(q);
            return catMatch && qMatch;
        });

        if (!filtered.length) {
            grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px 0;font-size:14px">
          No constants found for "<em>${escHtml(q)}</em>".
        </div>`;
            return;
        }

        grid.innerHTML = filtered.map((c, i) => {
            const valStr = formatConstValue(c.value);
            const isFav = (typeof FavoritesUI !== 'undefined') && FavoritesUI.hasConstant(c.symbol);
            return `
        <div class="const-card" data-idx="${i}" title="Click to copy value">
          <div class="const-header">
            <div class="const-header-left">
              <span class="const-symbol">${escHtml(c.symbol)}</span>
              <span class="const-category">${escHtml(c.category || '')}</span>
            </div>
            <button class="star-btn${isFav ? ' active' : ''}" data-sym="${escHtml(c.symbol)}" title="${isFav ? 'Remove favorite' : 'Add to favorites'}" style="font-size:14px">
              ${isFav ? '★' : '☆'}
            </button>
          </div>
          <div class="const-name">${escHtml(c.name)}</div>
          <div class="const-value">${valStr}</div>
          <div class="const-unit">${escHtml(c.unit || '')}</div>
        </div>`;
        }).join('');

        // Copy on card body click
        grid.querySelectorAll('.const-card').forEach((card, i) => {
            const c = filtered[i];

            card.addEventListener('click', e => {
                if (e.target.closest('.star-btn')) return;
                navigator.clipboard.writeText(`${c.symbol} = ${c.value} ${c.unit}`).then(() => {
                    card.style.borderColor = 'var(--accent-success)';
                    setTimeout(() => card.style.borderColor = '', 1200);
                }).catch(() => { });
            });

            // Star button
            const star = card.querySelector('.star-btn');
            star.addEventListener('click', e => {
                e.stopPropagation();
                if (typeof FavoritesUI === 'undefined') return;
                if (FavoritesUI.hasConstant(c.symbol)) {
                    FavoritesUI.removeConstant(c.symbol);
                    star.classList.remove('active');
                    star.textContent = '☆';
                    star.title = 'Add to favorites';
                } else {
                    FavoritesUI.addConstant(c);
                    star.classList.add('active');
                    star.textContent = '★';
                    star.title = 'Remove favorite';
                }
            });
        });
    }

    function formatConstValue(v) {
        if (v === 0) return '0';
        const abs = Math.abs(v);
        if (abs >= 0.001 && abs < 1e6) return v.toPrecision(6);
        return v.toExponential(5);
    }

    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { init };
})();

window.ConstantsUI = ConstantsUI;

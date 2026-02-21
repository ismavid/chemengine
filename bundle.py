"""
bundle.py — Generates a single self-contained index.html
Run: python bundle.py
Output: index_bundle.html  (upload ONLY this file to GitHub Pages)
"""
import json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))

def read(path):
    with open(os.path.join(BASE, path), encoding='utf-8') as f:
        return f.read()

# ── Load data ──────────────────────────────────────────────────
print("Reading data files…")
units_data    = json.loads(read('data/units_data.json'))
periodic_data = json.loads(read('data/periodic_table.json'))
constants_data= json.loads(read('data/constants.json'))

# Compact JSON (no pretty-print)
units_js    = json.dumps(units_data,    ensure_ascii=False, separators=(',',':'))
periodic_js = json.dumps(periodic_data, ensure_ascii=False, separators=(',',':'))
constants_js= json.dumps(constants_data,ensure_ascii=False, separators=(',',':'))

# ── Load CSS ───────────────────────────────────────────────────
print("Reading CSS…")
css = read('index.css')

# ── Load JS modules in dependency order ───────────────────────
print("Reading JS modules…")
js_files = [
    'js/engine.js',
    'js/molar_mass.js',
    'js/equation_balancer.js',
    'js/ui_converter.js',
    'js/ui_molar.js',
    'js/ui_periodic.js',
    'js/ui_constants.js',
    'js/ui_favorites.js',
    'js/ui_library.js',
    'js/ui_balancer.js',
]
js_modules = '\n\n'.join(read(f) for f in js_files)

# ── Read the HTML shell ────────────────────────────────────────
print("Reading index.html…")
html = read('index.html')

# Replace the <link rel="stylesheet" href="index.css"> with inline <style>
html = re.sub(
    r'<link[^>]+href=["\']index\.css["\'][^>]*>',
    f'<style>\n{css}\n</style>',
    html
)

# Replace all <script src="js/..."> tags with a single inline block
# Find the block from first script tag to last script tag (inclusive)
html = re.sub(
    r'<!-- Scripts:.*?</script>\s*\n\s*<!-- Quick examples',
    '<!-- Quick examples',
    html, flags=re.DOTALL
)

# Also remove the final </script> closing the quick-examples inline block header comment
# Actually let's just inject before the closing </body>

# Remove all external script tags for js/ files
html = re.sub(r'\s*<script src="js/[^"]+"></script>', '', html)

# Inject the data + all modules + app.js before </body>
app_js = read('js/app.js')

inline_scripts = f"""
<script>
// ── Inlined database (eliminates fetch() dependency) ──────────
const __UNITS_DATA__    = {units_js};
const __PERIODIC_DATA__ = {periodic_js};
const __CONSTANTS_DATA__= {constants_js};
</script>

<script>
// ── All JS modules (inlined) ──────────────────────────────────
{js_modules}
</script>

<script>
// ── App entry point (modified to use inlined data) ────────────
'use strict';
(async () => {{
    const loadingEl = document.getElementById('app-loading');
    const appEl     = document.getElementById('app-content');
    try {{
        const unitsData    = __UNITS_DATA__;
        const periodicData = __PERIODIC_DATA__;
        const constantsData= __CONSTANTS_DATA__;

        Engine.init(unitsData);
        MolarMass.init(periodicData);
        ConverterUI.init();
        MolarUI.init();
        PeriodicUI.init(periodicData);
        ConstantsUI.init(constantsData);
        FavoritesUI.init();
        LibraryUI.init(unitsData);
        BalancerUI.init();

        const unitCount  = Object.keys(unitsData.units || {{}}).length;
        const elCount    = periodicData.length;
        const constCount = constantsData.length;
        const badge = document.getElementById('data-badge');
        if (badge) badge.textContent = `${{unitCount}} units · ${{elCount}} elements · ${{constCount}} constants`;

        if (loadingEl) loadingEl.style.display = 'none';
        if (appEl)     appEl.style.display = '';

        function switchTab(target) {{
            document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => {{
                b.classList.toggle('active', b.dataset.tab === target);
                if (b.tagName === 'BUTTON') b.setAttribute('aria-selected', b.dataset.tab === target);
            }});
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`tab-${{target}}`)?.classList.add('active');
        }}

        document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(btn => {{
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        }});
        window._switchTab = switchTab;

    }} catch (err) {{
        if (loadingEl) {{
            loadingEl.innerHTML = `<div style="text-align:center;padding:60px 20px;color:hsl(2,60%,45%)">
              <div style="font-size:28px;margin-bottom:16px">⚠</div>
              <div style="font-size:16px;font-weight:600;margin-bottom:8px">Startup error</div>
              <div style="font-size:13px;color:var(--text-muted)">${{err.message}}</div></div>`;
        }}
        console.error('[ChemE Units] Startup error:', err);
    }}
}})();
</script>
"""

html = html.replace('</body>', inline_scripts + '\n</body>')

# ── Write output ───────────────────────────────────────────────
out_path = os.path.join(BASE, 'index_bundle.html')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(out_path) / 1024
print(f"\n✅ Done! → index_bundle.html  ({size_kb:.0f} KB)")
print("Upload ONLY index_bundle.html to GitHub Pages (rename to index.html).")

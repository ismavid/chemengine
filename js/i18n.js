// i18n.js — Lightweight bilingual (EN / ES) engine for ChemEngine

window.Lang = (() => {
    // ─── Dictionary ─────────────────────────────────────────────────────────
    const dict = {
        // ── Header / Navigation ──────────────────────────────────────────────
        'app.subtitle': { en: 'Dimensional Analysis Calculator', es: 'Calculadora de Análisis Dimensional' },
        'nav.converter': { en: 'Converter', es: 'Conversor' },
        'nav.skills': { en: 'Skills', es: 'Habilidades' },
        'nav.constants': { en: 'Constants', es: 'Constantes' },
        'nav.math': { en: 'Math Tools', es: 'Herramientas' },
        'nav.periodic': { en: 'Periodic Table', es: 'Tabla Periódica' },
        'nav.library': { en: 'Unit Library', es: 'Biblioteca' },
        'mob.convert': { en: 'Convert', es: 'Convertir' },
        'mob.skills': { en: 'Skills', es: 'Habilidades' },
        'mob.constants': { en: 'Constants', es: 'Constantes' },
        'mob.math': { en: 'Math', es: 'Matemáticas' },
        'mob.table': { en: 'Table', es: 'Tabla' },
        'mob.library': { en: 'Library', es: 'Biblioteca' },
        'lang.toggle.en': { en: '🇺🇸 EN', es: '🇺🇸 EN' },
        'lang.toggle.es': { en: '🇪🇸 ES', es: '🇪🇸 ES' },

        // ── Converter Tab ─────────────────────────────────────────────────
        'conv.title': { en: 'Unit Converter', es: 'Conversor de Unidades' },
        'conv.sub': {
            en: 'Dimensional analysis — all conversions validated for physical consistency.',
            es: 'Análisis dimensional — todas las conversiones validadas por consistencia física.'
        },
        'conv.favorites': { en: 'Favorites', es: 'Favoritos' },
        'conv.input.card': { en: 'Input', es: 'Entrada' },
        'conv.value': { en: 'Value', es: 'Valor' },
        'conv.from': { en: 'From Unit', es: 'Unidad Origen' },
        'conv.from.hint': {
            en: 'Use * for multiplication: kg*m/s^2 · N*m · W/(m^2*K)',
            es: 'Usa * para multiplicar: kg*m/s^2 · N*m · W/(m^2*K)'
        },
        'conv.to': { en: 'To Unit', es: 'Unidad Destino' },
        'conv.to.ph': { en: 'e.g. Pa, lb/ft^3, BTU/lbmol', es: 'ej. Pa, lb/ft^3, BTU/lbmol' },
        'conv.compound': { en: 'Compound Formula', es: 'Fórmula del Compuesto' },
        'conv.compound.hint': {
            en: 'Required for mol ↔ mass conversions · supports nested groups: Ca(OH)₂',
            es: 'Requerida para conversiones mol ↔ masa · soporta grupos anidados: Ca(OH)₂'
        },
        'conv.density': { en: 'Density (ρ)', es: 'Densidad (ρ)' },
        'conv.density.hint': {
            en: 'Required for volume ↔ mass conversions',
            es: 'Requerida para conversiones volumen ↔ masa'
        },
        'conv.btn': { en: 'Convert', es: 'Convertir' },
        'conv.examples': { en: 'Quick Examples', es: 'Ejemplos Rápidos' },
        'conv.formats': { en: 'Accepted Formats', es: 'Formatos Aceptados' },
        'lib.title': { en: 'Unit Library', es: 'Biblioteca de Unidades' },
        'lib.search.ph': { en: 'Search units…', es: 'Buscar unidades…' },
        'lib.symbol': { en: 'Symbol', es: 'Símbolo' },
        'lib.name': { en: 'Name', es: 'Nombre' },
        'lib.quantity': { en: 'Quantity', es: 'Magnitud' },

        // ── Periodic Table Tab ──────────────────────────────────────────────
        'pt.title': { en: 'Periodic Table', es: 'Tabla Periódica' },
        'pt.sub': {
            en: 'Click any element to view its properties. IUPAC 2021 atomic weights.',
            es: 'Haz clic en un elemento para ver sus propiedades. Pesos atómicos IUPAC 2021.'
        },
        'pt.click.hint': {
            en: 'Click an element to see its properties.',
            es: 'Haz clic en un elemento para ver sus propiedades.'
        },
        'pt.search.ph': {
            en: 'Search by name, symbol, Z, or category…',
            es: 'Buscar por nombre, símbolo, Z o categoría…'
        },

        // ── Constants Tab ────────────────────────────────────────────────────
        'const.title': { en: 'Engineering Constants', es: 'Constantes de Ingeniería' },
        'const.sub': {
            en: 'CODATA 2018 values. Click any card to copy symbol = value unit to clipboard.',
            es: 'Valores CODATA 2018. Clic en cualquier tarjeta para copiar símbolo = valor unidad.'
        },
        'const.search.ph': {
            en: 'Search by name, symbol, unit, or description…',
            es: 'Buscar por nombre, símbolo, unidad o descripción…'
        },

        // ── Skills Tab ────────────────────────────────────────────────────────
        'skills.title': { en: 'Skills', es: 'Habilidades' },
        'skills.sub': {
            en: 'Advanced engineering modules and dynamic algorithms.',
            es: 'Módulos avanzados de ingeniería y algoritmos dinámicos.'
        },
        'skills.subnav.react': { en: 'Chemical Reactions', es: 'Reacciones Químicas' },
        'skills.subnav.fluid': { en: 'Fluid Mechanics', es: 'Mecánica de Fluidos' },

        // ── Balancer ─────────────────────────────────────────────────────────
        'bal.title': { en: 'Equation Balancer', es: 'Balanceador de Ecuaciones' },
        'bal.reactants': { en: 'Reactants', es: 'Reactivos' },
        'bal.reactants.ph': { en: 'e.g. H2 + O2', es: 'ej. H2 + O2' },
        'bal.reactants.hint': {
            en: 'Separate compounds with + · parentheses supported: Ca(OH)2',
            es: 'Separa compuestos con + · paréntesis admitidos: Ca(OH)2'
        },
        'bal.products': { en: 'Products', es: 'Productos' },
        'bal.products.ph': { en: 'e.g. H2O', es: 'ej. H2O' },
        'bal.products.hint': { en: 'Separate compounds with +', es: 'Separa compuestos con +' },
        'bal.redox': { en: 'Redox Reaction Mode', es: 'Modo Reacción Redox' },
        'bal.medium': { en: 'Solution:', es: 'Solución:' },
        'bal.acidic': { en: 'Acidic solution', es: 'Solución ácida' },
        'bal.basic': { en: 'Basic solution', es: 'Solución básica' },
        'bal.btn': { en: 'Balance', es: 'Balancear' },
        'bal.examples': { en: 'Quick Examples', es: 'Ejemplos Rápidos' },
        'bal.format': { en: 'Input Format', es: 'Formato de Entrada' },
        'bal.format.hint': {
            en: 'Subscripts written as plain numbers · parentheses supported · spaces ignored',
            es: 'Subíndices como números simples · paréntesis admitidos · espacios ignorados'
        },

        // ── Molar Mass ────────────────────────────────────────────────────────
        'molar.title': { en: 'Molar Mass Calculator', es: 'Calculadora de Masa Molar' },
        'molar.card': { en: 'Formula Input', es: 'Ingreso de Fórmula' },
        'molar.label': { en: 'Chemical Formula', es: 'Fórmula Química' },
        'molar.hint': {
            en: 'Supports: nested groups Ca(OH)₂, hydrates CuSO₄·5H₂O',
            es: 'Admite: grupos anidados Ca(OH)₂, hidratos CuSO₄·5H₂O'
        },
        'molar.btn': { en: 'Calculate', es: 'Calcular' },
        'molar.examples': { en: 'Quick Examples', es: 'Ejemplos Rápidos' },
        'molar.placeholder': {
            en: 'Enter a chemical formula and press',
            es: 'Ingresa una fórmula química y presiona'
        },

        // ── CRE Toolkit ───────────────────────────────────────────────────────
        'cre.title': { en: 'Reactions Engineering Toolkit', es: 'Toolkit de Ingeniería de Reacciones' },
        'cre.run.all': { en: 'Run All Blocks ⚡', es: 'Ejecutar Todo ⚡' },
        'cre.init': {
            en: 'Reactions Engineering Toolkit module initializing...',
            es: 'Módulo de Ingeniería de Reacciones inicializando...'
        },

        // ── Fluid Mechanics ────────────────────────────────────────────────────
        'fluid.init': {
            en: 'Fluid Mechanics module initializing...',
            es: 'Módulo de Mecánica de Fluidos inicializando...'
        },
        'fluid.global': { en: 'Global Inputs', es: 'Entradas Globales' },
        'fluid.load.ex': { en: '-- Load Example --', es: '-- Cargar Ejemplo --' },
        'fluid.custom.toggle': { en: 'Use custom fluid properties', es: 'Usar propiedades personalizadas' },
        'fluid.fluid': { en: 'Fluid', es: 'Fluido' },
        'fluid.temp': { en: 'Temp (°C)', es: 'Temp (°C)' },
        'fluid.flow': { en: 'Flow Q (m³/s)', es: 'Caudal Q (m³/s)' },
        'fluid.add.pt': { en: '+ Add Point', es: '+ Agregar Punto' },
        'fluid.point': { en: 'Point', es: 'Punto' },
        'fluid.point.name.ph': { en: 'Point Name', es: 'Nombre del Punto' },
        'fluid.pressure': { en: 'P (Pa)', es: 'P (Pa)' },
        'fluid.elevation': { en: 'z (m)', es: 'z (m)' },
        'fluid.v.at.pt': { en: 'Velocity at point', es: 'Velocidad en el punto' },
        'fluid.v.tank': { en: 'Tank surface (v ≈ 0)', es: 'Superficie depósito (v ≈ 0)' },
        'fluid.v.pipe': { en: 'Pipe/Jet (v = Q/A)', es: 'Tubería/Chorro (v = Q/A)' },
        'fluid.v.known': { en: 'Known value (m/s) →', es: 'Valor conocido (m/s) →' },
        'fluid.seg.geom': { en: 'Geometry', es: 'Geometría' },
        'fluid.diam': { en: 'Diam D (m)', es: 'Diám D (m)' },
        'fluid.length': { en: 'Length L (m)', es: 'Longitud L (m)' },
        'fluid.material': { en: 'Material / Roughness', es: 'Material / Rugosidad' },
        'fluid.eps': { en: 'ε roughness (m)', es: 'ε rugosidad (m)' },
        'fluid.pump.on': { en: 'Pump on this segment', es: 'Bomba en este segmento' },
        'fluid.efficiency': { en: '(efficiency)', es: '(eficiencia)' },
        'fluid.solve.ha': { en: 'Solve hA', es: 'Resolver hA' },
        'fluid.solve.hr': { en: 'Solve hR', es: 'Resolver hR' },
        'fluid.minor': { en: 'Minor Losses (Accessories)', es: 'Pérdidas Menores (Accesorios)' },
        'fluid.add.acc': { en: '+ Add Accessory', es: '+ Agregar Accesorio' },
        'fluid.energy.title': { en: 'Global Energy Balance (Mott Eq 11-1)', es: 'Balance de Energía Global (Mott Ec 11-1)' },
        'fluid.seg.eval': { en: 'Evaluation', es: 'Evaluación' },
        'fluid.seg.total.hl': { en: 'Segment Total hL', es: 'hL Total del Segmento' },
        'fluid.e1': { en: 'E₁ (energy at point 1):', es: 'E₁ (energía en punto 1):' },
        'fluid.en': { en: 'Eₙ (energy at last point):', es: 'Eₙ (energía en último punto):' },
        'fluid.total.hl': { en: 'Total head loss (ΣhL):', es: 'Pérdida de carga total (ΣhL):' },
        'fluid.pump.head': { en: 'Pump head (ΣhA):', es: 'Carga de bomba (ΣhA):' },
        'fluid.power': { en: 'Pump Input Power (P = γQhA/η):', es: 'Potencia de entrada bomba (P = γQhA/η):' },
        'fluid.turbine.head': { en: 'Turbine head (ΣhR):', es: 'Carga de turbina (ΣhR):' },
        'fluid.solved.prefix': { en: '✓ Solved:', es: '✓ Resuelto:' },
        'fluid.residual': { en: 'Residual (LHS−RHS)', es: 'Residual (LHI−RHD)' },
        'fluid.unknown.fluid': { en: 'Unknown fluid or temperature', es: 'Fluido o temperatura desconocidos' },
        'fluid.select.valid': {
            en: 'Select a valid fluid and temperature from the Global Inputs panel.',
            es: 'Selecciona un fluido y temperatura válidos en el panel de Entradas Globales.'
        },
        'fluid.eval.err': { en: 'Unable to evaluate system', es: 'No se puede evaluar el sistema' },
        'fluid.eval.check': {
            en: 'Check your inputs and ensure at least one unknown is selected.',
            es: 'Revisa las entradas y asegúrate de seleccionar al menos una incógnita.'
        },
        'fluid.custom.rho': { en: 'ρ (kg/m³)', es: 'ρ (kg/m³)' },
        'fluid.custom.gamma': { en: 'γ (kN/m³)', es: 'γ (kN/m³)' },
        'fluid.custom.nu': { en: 'ν (m²/s)', es: 'ν (m²/s)' },
        'fluid.remove.pt': { en: 'Remove point', es: 'Quitar punto' },
        'fluid.custom.eps': { en: 'Custom ε (m)', es: 'ε personalizada (m)' },
        'fluid.solve.for.q': { en: 'Solve for Q', es: 'Resolver para Q' },
        'fluid.solve.p': { en: 'Solve P', es: 'Resolver P' },
        'fluid.solve.z': { en: 'Solve z', es: 'Resolver z' },

        // ── Math Tools Tab ────────────────────────────────────────────────────
        'math.title': { en: 'Math Tools', es: 'Herramientas Matemáticas' },
        'math.sub': {
            en: 'Numerical root finding and definite integration.',
            es: 'Búsqueda de raíces y cálculo de integrales definidas.'
        },
        'math.solver.title': { en: 'Equation Solver', es: 'Solucionador de Ecuaciones' },
        'math.eq.label': { en: 'Equation', es: 'Ecuación' },
        'math.eq.ph': { en: 'e.g. 3*x^2 - 12 = 0', es: 'ej. 3*x^2 - 12 = 0' },
        'math.eq.hint': {
            en: 'Solves for x. You can omit "= 0". Valid functions: sin, cos, exp, ln, sqrt...',
            es: 'Resuelve para x. Puedes omitir "= 0". Funciones: sin, cos, exp, ln, sqrt...'
        },
        'math.guess': { en: 'Initial Guess', es: 'Estimación Inicial' },
        'math.solve.btn': { en: 'Solve Equation', es: 'Resolver Ecuación' },
        'math.int.title': { en: 'Definite Integral', es: 'Integral Definida' },
        'math.func.label': { en: 'Function f(x)', es: 'Función f(x)' },
        'math.solve.for': { en: 'Solve for:', es: 'Resolver para:' },
        'math.area': { en: 'Area (∫f(x)dx)', es: 'Área (∫f(x)dx)' },
        'math.upper': { en: 'Upper Limit (b)', es: 'Límite Superior (b)' },
        'math.lower': { en: 'Lower Limit (a)', es: 'Límite Inferior (a)' },
        'math.lower.lbl': { en: 'Lower (a)', es: 'Inferior (a)' },
        'math.upper.lbl': { en: 'Upper (b)', es: 'Superior (b)' },
        'math.area.target': { en: 'Area target', es: 'Objetivo de área' },
        'math.calc.btn': { en: 'Calculate', es: 'Calcular' },

        // ── Unit Library Tab (mobile) ─────────────────────────────────────────
        'ulib.title': { en: 'Unit Library', es: 'Biblioteca de Unidades' },
        'ulib.sub': {
            en: 'Reference list of all supported unit symbols. Tap a unit to pre-fill the converter.',
            es: 'Lista de referencia de todos los símbolos de unidad. Toca una unidad para pre-llenar el conversor.'
        },

        // ── Dynamic / JS-rendered strings ────────────────────────────────────
        'err.unknown.unit': { en: 'Unknown unit', es: 'Unidad desconocida' },
        'err.dim.mismatch': { en: 'Dimension mismatch', es: 'Incompatibilidad dimensional' },
        'err.parse': { en: 'Parse error', es: 'Error de análisis' },
        'result.copy': { en: 'Copy', es: 'Copiar' },
        'result.copied': { en: 'Copied!', es: '¡Copiado!' },
        'result.fav.add': { en: 'Add to favorites', es: 'Agregar a favoritos' },
        'result.fav.rem': { en: 'Remove from favorites', es: 'Quitar de favoritos' },
        'loading.databases': { en: 'Loading databases…', es: 'Cargando bases de datos…' },
    };

    // ─── State ──────────────────────────────────────────────────────────────
    let _lang = localStorage.getItem('cheme_lang') || 'en';

    // ─── Core API ───────────────────────────────────────────────────────────
    function get(key, fallback) {
        const entry = dict[key];
        if (!entry) return fallback || key;
        return entry[_lang] || entry['en'] || fallback || key;
    }

    function current() { return _lang; }

    function setLang(lang) {
        _lang = lang === 'es' ? 'es' : 'en';
        console.log('[Lang] setLang called, switching to:', _lang);
        localStorage.setItem('cheme_lang', _lang);
        document.documentElement.lang = _lang;
        apply();
        _triggerRerender();
    }

    // ─── DOM Application ─────────────────────────────────────────────────────
    function apply() {
        var els = document.querySelectorAll('[data-i18n]');
        console.log('[Lang] apply() called, lang=' + _lang + ', elements=' + els.length);
        els.forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            var text = get(key);
            if (text) el.textContent = text;
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-ph');
            var text = get(key);
            if (text) el.placeholder = text;
        });
        document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-title');
            var text = get(key);
            if (text) el.title = text;
        });
        document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-aria');
            var text = get(key);
            if (text) el.setAttribute('aria-label', text);
        });
        // Update toggle button label
        var btn = document.getElementById('lang-toggle-btn');
        if (btn) {
            btn.textContent = _lang === 'es' ? '🇺🇸 EN' : '🇪🇸 ES';
            btn.title = _lang === 'es' ? 'Switch to English' : 'Cambiar a Español';
        }
    }

    // ─── Rerender hook ────────────────────────────────────────────────────────
    // JS-rendered modules (ui_fluid, ui_converter, etc.) register themselves here
    const _rerenderHooks = [];
    function onRerender(fn) { _rerenderHooks.push(fn); }
    function _triggerRerender() {
        _rerenderHooks.forEach(fn => { try { fn(); } catch (e) { console.warn('[i18n] rerender hook failed', e); } });
    }

    // ─── Toggle button factory ────────────────────────────────────────────────
    function createToggle() {
        const btn = document.createElement('button');
        btn.id = 'lang-toggle-btn';
        btn.className = 'lang-toggle-btn';
        btn.textContent = _lang === 'es' ? '🇺🇸 EN' : '🇪🇸 ES';
        btn.title = _lang === 'es' ? 'Switch to English' : 'Cambiar a Español';
        btn.addEventListener('click', () => setLang(_lang === 'en' ? 'es' : 'en'));
        return btn;
    }

    return { get, current, setLang, apply, onRerender, createToggle };
})();

// Script is at bottom of body so DOM is ready — apply immediately
window.Lang.apply();

// Wire button click handler directly (no dependency on app.js)
(function () {
    var btn = document.getElementById('lang-toggle-btn');
    if (btn) {
        btn.addEventListener('click', function () {
            window.Lang.setLang(window.Lang.current() === 'en' ? 'es' : 'en');
        });
    }
})();

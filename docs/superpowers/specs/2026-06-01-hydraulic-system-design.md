# Spec: Hydraulic System Design Module

**Date:** 2026-06-01
**Status:** Approved
**Scope:** New "Diseño Hidráulico" sub-skill added to the Skills tab of ChemEngine

---

## 1. Overview

Add a fourth sub-tab **"Diseño Hidráulico"** to the Skills panel (alongside Chemical Reactions and Fluid Mechanics). The module simulates the hydraulic system of a 5-story residential building in Bogotá D.C., covering pipe loss analysis, pump sizing, hourly demand simulation, and cost estimation. All values are pre-loaded with project defaults so the module works out of the box without any user edits.

---

## 2. Context & Constraints

- **App**: ChemEngine — static GitHub Pages site (vanilla HTML/CSS/JS, no bundler).
- **No new external dependencies**. KaTeX (already loaded) for LaTeX formulas; inline SVG for charts.
- **UI language**: Spanish (primary). Follow the existing `data-i18n` / `Lang.get()` pattern for bilingual support where practical; static Spanish labels acceptable for new content.
- **Patterns to follow**:
  - `BLOCKS[]` array in `ui_hydraulic.js`, rendered into `#hydraulic-ui-mount`.
  - Same `globalExports{}` chaining mechanism as CRE/MRS.
  - Same card/input/Run-button structure as existing blocks.
  - CSS variables from `:root` — no new CSS classes unless necessary.

---

## 3. Files Changed / Created

| File | Change |
|------|--------|
| `js/hydraulic_engine.js` | **New** — pure calculation engine (no DOM) |
| `js/ui_hydraulic.js` | **New** — BLOCKS[] array, render, SVG charts, export |
| `index.html` | Add sub-nav button + `sub-hydraulic` pane + mount div + `<script>` tags |
| `js/app.js` | Add `HydraulicUI.init()` call in the async init function |

---

## 4. Building Defaults (pre-loaded, all editable)

```
Pisos: 5 | Aptos/piso: 3 | Personas/apto: 3 | Total: 45 personas
Altura entre pisos: 2.80 m | Sótano→P1: 3.50 m
Altura estática total (bomba→P5 más alto): 16.70 m
Consumo per cápita: 140 L/persona·día | Total: 6,300 L/día

Agua a 15°C (Bogotá):
  ρ = 999.1 kg/m³ | μ = 1.138×10⁻³ Pa·s
  P_atm = 74,660 Pa (2,640 m.s.n.m.) | P_vapor = 1,705 Pa
  g = 9.81 m/s²

Rugosidad PVC: ε = 0.0000015 m (1.5×10⁻⁶ m)
Unidades Hunter totales: 225 UH → Q_diseño = 2.30 L/s = 0.0023 m³/s
```

---

## 5. Module HYD-1: Análisis de Pérdidas Hidráulicas

### 5.1 Inputs

- **Parámetros del fluido** (editables): ρ, μ, g, ε — pre-cargados con valores Bogotá 15°C.
- **Caudal de diseño** (editable): pre-cargado = 2.30 L/s.
- **Tabla de tramos** (HTML editable, 9 filas): columns → Tramo ID, Descripción, D_interno (mm), L (m), Q (L/s), ΣK. Pre-cargada con T1–T9 del proyecto.

  Q por tramo refleja distribución real (montante pierde caudal piso a piso):
  - T1–T3: Q total (2.30 L/s)
  - T4–T5: Q pisos 3–5 (~1.38 L/s)
  - T6: Q pisos 4–5 (~0.92 L/s)
  - T7: Q piso 5 (~0.46 L/s)
  - T8: Q apto 3 (~0.15 L/s)
  - T9: Q ducha (~0.15 L/s)

### 5.2 Calculations (per tramo)

1. **Área**: A = π·D²/4
2. **Velocidad**: v = Q/A
3. **Reynolds**: Re = ρ·v·D/μ
4. **Friction factor f**:
   - Re < 2300 → f = 64/Re (laminar)
   - Re ≥ 2300 → Colebrook-White via Newton-Raphson (10 iterations):
     `F(x) = 1/√f + 2·log₁₀(ε/(3.7·D) + 2.51/(Re·√f)) = 0`
     Starting guess: `f₀ = 0.02`
5. **Darcy-Weisbach**: `hf = f·(L/D)·v²/(2g)`
6. **Minor losses**: `hm = ΣK·v²/(2g)`
7. **Total per tramo**: `ht = hf + hm`

### 5.3 Validation

- v < 0.5 m/s → warning badge "⚠ Velocidad baja"
- v > 2.5 m/s → error badge "✗ Excede NTC 1500"
- Re < 2300 → info badge "Flujo laminar (f=64/Re)"

### 5.4 Outputs

- Results table: Tramo | Q (L/s) | v (m/s) | Re | Régimen | f | hf (m) | ΣK | hm (m) | h_total (m) | Estado
- Summary row: **Σhf**, **Σhm**, **Σh_total**
- **SVG chart 1**: Horizontal bar chart — friction losses (blue) and minor losses (orange) per tramo, side-by-side bars.
- **SVG chart 2**: Hydraulic grade line — pressure head (m) vs cumulative pipe distance from pump.

### 5.5 Exports

```js
globalExports['hyd1.total_losses']   // number (m), Σht
globalExports['hyd1.pipe_results']   // JSON string of per-tramo results array
globalExports['hyd1.Q_design']       // number (m³/s)
```

---

## 6. Module HYD-2: Dimensionamiento de Bomba

### 6.1 Inputs

- Pérdidas totales (auto-link from `hyd1.total_losses`)
- Δz estático (m): pre-cargado = 16.70 m
- Presión requerida en entrega (m.c.a.): pre-cargado = 10.0 m
- Eficiencia bomba η: pre-cargado = 0.65
- Δz succión (m, positivo si tanque arriba de bomba): pre-cargado = 0.0
- Pérdidas en succión (m): pre-cargado = 0.20 m (estimado)

### 6.2 Calculations

1. `TDH = Δz + Σh_pérdidas + P_req`
   Where P_req is already in metres of water column (10.0 m).
2. `P_hyd = ρ · g · Q · TDH` [W]
3. `P_brake = P_hyd / η` [W] → convert to HP (÷745.7)
4. `NPSH_d = P_atm/(ρ·g) + Δz_succ − hf_succ − P_vapor/(ρ·g)`
   - P_atm Bogotá = 74,660 Pa → 7.61 m.c.a.
   - P_vapor 15°C = 1,705 Pa → 0.174 m.c.a.
5. Commercial pump selection: round P_brake up to nearest standard HP {0.5, 0.75, 1.0, 1.5, 2.0, 3.0}

### 6.3 Validation

- NPSH_d < 3.0 m → warning "⚠ NPSH bajo — riesgo de cavitación"
- TDH > 30 m → info "Verificar selección de bomba"

### 6.4 Outputs

- Summary cards: TDH (m), P_hyd (W), P_brake (HP), NPSH_d (m), η (%), Bomba recomendada (X HP)
- TDH breakdown percentages: % altura estática / % fricción / % menores / % presión requerida
- **SVG chart**: Donut/pie showing TDH component breakdown with legend.
- Status indicator: "✓ Bomba suficiente para Piso 5" or "✗ Revisar selección"

### 6.5 Exports

```js
globalExports['hyd2.TDH']        // number (m)
globalExports['hyd2.power_hp']   // number (HP, commercial rounded)
globalExports['hyd2.NPSH_d']     // number (m)
```

---

## 7. Module HYD-3: Simulación Horaria

### 7.1 Inputs

- TDH de bomba (auto-link from `hyd2.TDH`)
- Distribución horaria (7 franjas editables):

  | Franja | Horas | % Consumo | Duración (h) |
  |--------|-------|-----------|--------------|
  | Madrugada | 00–05 | 5% | 5 |
  | Mañana pico | 05–07 | 20% | 2 |
  | Mañana | 07–11 | 15% | 4 |
  | Mediodía pico | 11–14 | 20% | 3 |
  | Tarde | 14–19 | 10% | 5 |
  | Noche pico | 19–21 | 20% | 2 |
  | Noche | 21–24 | 10% | 3 |

- Q diario total (L/s totales por día): pre-calculado de los parámetros del edificio = 6300 L/día

### 7.2 Calculations (per franja)

1. `Q_franja = (% × Q_diario) / (duración_h × 3600)` [L/s]
2. Re-run HYD-1 losses with `Q_franja` (scale losses ∝ v²; velocity scales ∝ Q):
   `h_losses(Q) = h_losses_design × (Q/Q_design)²`
3. `P_piso5 = TDH_bomba − Δz − h_losses(Q_franja)` [m.c.a.]
4. Estado: P_piso5 ≥ 10.0 m.c.a. → "✓ OK", else "✗ Insuficiente"

### 7.3 Outputs

- **SVG chart**: Grouped — bar chart of Q (L/s) per franja + overlaid line for P_piso5 + red dashed line at 10 m.c.a.
- Slider "Hora del día" (0–23): highlights active franja, shows instantaneous Q, v montante, pérdidas, P_piso5.
- Results table: Franja | Q (L/s) | v montante (m/s) | Pérdidas (m) | P_piso5 (m.c.a.) | Estado

### 7.4 Exports

```js
globalExports['hyd3.worst_Q']    // number (L/s), peak demand fraction
```

---

## 8. Module HYD-4: Estimación de Costos

### 8.1 Inputs

- Two editable price tables (HTML tables):
  1. **Tubería y accesorios** — pre-cargada con precios Colombia 2024-2025 (COP)
  2. **Equipos y mano de obra** — bomba (seleccionada en HYD-2, auto-link), tanque, instalación/punto
- Power HP auto-link from `hyd2.power_hp`

**Price defaults (COP):**

| Ítem | Precio unitario |
|------|----------------|
| Tubería ½" /m | $4,500 |
| Tubería ¾" /m | $6,200 |
| Tubería 1" /m | $9,800 |
| Tubería 1½" /m | $18,500 |
| Tubería 2" /m | $28,000 |
| Codo 90° ½" | $1,200 |
| Codo 90° ¾" | $1,800 |
| Codo 90° 1" | $3,500 |
| Codo 90° 1½" | $6,000 |
| Codo 90° 2" | $9,500 |
| Tee ½" | $1,500 |
| Tee ¾" | $2,200 |
| Tee 1" | $4,200 |
| Tee 1½" | $7,500 |
| Tee 2" | $12,000 |
| Válvula compuerta 2" | $45,000 |
| Válvula check 2" | $85,000 |
| Válvula de paso ½" | $12,000 |
| Reducción 2"→1½" | $8,500 |
| Bomba 1 HP | $850,000 |
| Bomba 1.5 HP | $1,200,000 |
| Bomba 2 HP | $1,650,000 |
| Tanque 23 m³ | $12,500,000 |
| Instalación/punto | $65,000 |

**Quantities derived from T1–T9 and building data (hardcoded defaults, matching project):**

| Diámetro | Metros lineales | Derivado de |
|----------|----------------|-------------|
| 2" | T1+T2+T3 = 3+3.5+2.8 = 9.3 m | Tramos T1–T3 |
| 1½" | T4+T5+T6 = 2.8+2.8+2.8 = 8.4 m | Tramos T4–T6 |
| 1" | T7 = 8.0 m × 15 aptos = 120 m (all floors) | Distribución piso |
| ¾" | T8 = 4.0 m × 15 aptos = 60 m | Ramales apto |
| ½" | T9 = 2.0 m × 105 puntos = 210 m | Conexión puntos |

Accessories: auto-counted from T1–T9 table (codos, tees, válvulas per tramo × 15 aptos where applicable).
Puntos de agua: 7 × 15 = 105 puntos.

### 8.2 Calculations

1. Tubería: Σ(L_i × precio_i) per diameter
2. Accesorios: Σ(qty_j × precio_j) per accessory type
3. Bomba: price of selected HP tier
4. Tanque: fixed $12,500,000
5. Mano de obra: 105 puntos × $65,000
6. **Total**: sum of all categories
7. **Por apartamento**: Total / 15

### 8.3 Outputs

- Breakdown table: Categoría | Subtotal (COP) | % del Total
- **SVG chart**: Donut showing cost distribution by category.
- Highlight cards: **COSTO TOTAL** (large) and **COSTO POR APARTAMENTO**

---

## 9. Export Results Button

Located after HYD-4 output. Generates plain-text report string:

```
=== RESULTADOS DEL ANÁLISIS HIDRÁULICO ===
Proyecto: Sistema Hidráulico — Edificio Residencial 5 Pisos, Bogotá D.C.
Fecha: [auto ISO date]
Generado con: ChemEngine

PARÁMETROS DEL EDIFICIO
...

PÉRDIDAS POR TRAMO (HYD-1):
Tramo T1: Q = X.XX L/s, v = X.XX m/s, Re = XXXXX, f = 0.XXXX, hf = X.XX m, ΣK = X.X, hm = X.XX m, total = X.XX m
...
Pérdidas totales: Σhf = X.XX m | Σhm = X.XX m | Σh = X.XX m

DIMENSIONAMIENTO DE BOMBA (HYD-2):
TDH = X.XX m  (Δz=XX.XX + pérdidas=X.XX + P_req=10.00)
Potencia hidráulica = XXXX W
Potencia al freno = X.XX HP → Bomba recomendada: X HP centrífuga
NPSH disponible = X.XX m

SIMULACIÓN HORARIA (HYD-3):
[table of 7 rows]
Franja crítica: [name], Q = X.XX L/s, P_piso5 = X.XX m.c.a.

COSTOS ESTIMADOS (HYD-4):
Tuberías: $X,XXX,XXX COP
Accesorios: $X,XXX,XXX COP
Bomba: $X,XXX,XXX COP
Tanque: $12,500,000 COP
Mano de obra: $X,XXX,XXX COP
TOTAL: $XX,XXX,XXX COP
Por apartamento: $X,XXX,XXX COP
```

Uses `navigator.clipboard.writeText()` with toast notification "✓ Copiado al portapapeles". Fallback: `<textarea>` shown inline for manual copy.

---

## 10. Architecture Notes

### hydraulic_engine.js

Pure functions, no DOM. Exported via `window.HydraulicEngine = { ... }`.

```
colebrookWhite(Re, eps, D)    → f
darcy(f, L, D, v, g)          → hf
minorLoss(K_total, v, g)      → hm
analyzeSection(tramo, fluid)  → { v, Re, f, hf, hm, ht, regime, velOk }
analyzePipe(tramos, fluid)    → { results[], totalHf, totalHm, totalH }
pumpTDH(dz, losses, p_req)    → TDH
pumpPower(Q, rho, g, TDH, eta) → { P_hyd_W, P_brake_W, P_brake_hp }
npshAvailable(Patm, rho, g, dz_succ, hf_succ, Pvapor) → NPSH_d
hourlyQ(percent, Q_daily_Ls, duration_h) → Q_Ls
scaleLosses(losses_ref, Q, Q_ref) → losses_scaled
selectPump(P_hp)              → { hp, label, cost }
```

### ui_hydraulic.js

- `BLOCKS[]` array: HYD-1, HYD-2, HYD-3, HYD-4.
- `globalExports{}` and chaining identical to `ui_cre.js` pattern.
- `HydraulicUI.init()` renders into `#hydraulic-ui-mount`.
- SVG helpers: `svgBarChart(data, options)`, `svgDonut(slices, options)`, `svgLineBar(bars, line, threshold, options)`.
- Editable table helper: `editableTable(id, columns, rows)` → HTML string; `readEditableTable(id, columns)` → array of objects.
- Export function: `buildExportText()` → reads from globalExports, returns formatted string.

### Chaining flow

```
HYD-1 run → exports hyd1.total_losses, hyd1.Q_design
HYD-2 reads hyd1.total_losses → exports hyd2.TDH, hyd2.power_hp
HYD-3 reads hyd2.TDH → exports hyd3.worst_Q
HYD-4 reads hyd2.power_hp → no downstream exports
Export button reads all globalExports
```

---

## 11. What is NOT in scope

- Multi-floor branching network solver (Hardy-Cross method) — overkill for this project; series-path analysis is sufficient.
- Water hammer / transient analysis.
- i18n keys for all new text — Spanish hardcoded is acceptable for this module.
- Saving/loading state between sessions.
- PDF export — the plain-text copy is sufficient for the Word report.

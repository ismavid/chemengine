# ChemE Units

A fast, browser-based engineering calculator for chemical engineering students.

**Live features:**
- **Unit Converter** — dimensional analysis with validation for all compound units (e.g. `kJ/mol·K`, `lb/ft^3`, `kg*m/s^2`)
- **Molar Mass Calculator** — formula parser supporting nested groups e.g. `Ca(OH)₂`, `Al₂(SO₄)₃`
- **Periodic Table** — 118 elements with properties, IUPAC 2021 atomic weights, searchable
- **Engineering Constants** — 122 CODATA 2018 constants, fully searchable, clipboard copy
- **Equation Balancer** — matrix null-space balancing for any standard chemical equation
- **Unit Library** — searchable reference of all 485 supported unit symbols with quantity type
- **Favorites** — star conversions and constants, persist across sessions via `localStorage`

Pure vanilla HTML/CSS/JavaScript — no build step, no frameworks, no external API calls.

---

## Quick Start

The app fetches local JSON files so it needs a web server (not `file://`).

```bash
# Python (built-in, no install required)
python -m http.server 5500
```

Open [http://localhost:5500](http://localhost:5500).

Or use the **VS Code Live Server** extension: right-click `index.html` → *Open with Live Server*.

---

## Project Structure

```
.
├── index.html              # Main HTML — all tabs and layout
├── index.css               # Design system — Apple-minimal, responsive
├── js/
│   ├── engine.js           # Dimensional analysis engine (unit parsing & conversion)
│   ├── molar_mass.js       # Chemical formula parser & molar mass calculator
│   ├── equation_balancer.js# Matrix null-space equation balancer
│   ├── app.js              # Entry point — data loading & tab switching
│   ├── ui_converter.js     # Converter tab UI
│   ├── ui_molar.js         # Molar mass tab UI
│   ├── ui_periodic.js      # Periodic table tab UI
│   ├── ui_constants.js     # Constants tab UI
│   ├── ui_balancer.js      # Equation balancer tab UI
│   ├── ui_favorites.js     # Favorites system (localStorage)
│   └── ui_library.js       # Unit symbol reference library
├── data/
│   ├── units_data.json     # 485 units + SI prefixes (generated)
│   ├── periodic_table.json # 118 elements (generated)
│   └── constants.json      # 122 engineering constants (generated)
│
│   # Source spreadsheets (edit these to update the databases)
├── units_database.xlsx
├── periodic_table.xlsx
├── engineering_constants.xlsx
└── convert_databases.py    # Run once to regenerate data/ from .xlsx sources
```

---

## Regenerating the Databases

If you edit any of the `.xlsx` source files:

```bash
pip install openpyxl
python convert_databases.py
```

This regenerates the three JSON files in `data/`.

---

## Unit Input Format

| Example | Meaning |
|---|---|
| `kg*m/s^2` | kilogram·meter per second squared (= Newton) |
| `kJ/(mol*K)` | kilojoule per mol·kelvin |
| `kg/m^3` | kilograms per cubic meter |
| `BTU/hr` | BTU per hour |
| `lb/ft^3` | pounds per cubic foot |

Multiplication: `*` · Division: `/` · Exponents: `^` or superscript notation  
SI prefixes fully supported: `m`, `k`, `M`, `G`, `μ`, `n`, `p`, …

---

## License

MIT

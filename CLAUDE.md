# OOUX Model Tool — Project Memory

## What This Is
A single-page HTML/JS/CSS tool for visualising and editing OOUX object models as a knowledge graph.
Built as a Door4 internal testbed. Guinea pig dataset: Global View Systems (GVS).
No build step. No framework. Vanilla JS + HTML Canvas. Runs in browser from a single `index.html`.

## Project Structure
```
ooux-tool/
├── CLAUDE.md                  ← this file
├── index.html                 ← single entry point, loads all modules
├── data/
│   ├── models.json            ← manifest: lists available models (one per client/project)
│   ├── gvs.json               ← GVS model (objects + relationships)
│   └── door4.json             ← Door4 model
├── src/
│   ├── data.js                ← load manifest + model, parse, save; schema version checks
│   ├── canvas.js              ← knowledge graph view (HTML Canvas, force layout)
│   ├── cards.js               ← card grid view (object cards with ORCA rows)
│   ├── crud.js                ← CRUD panel (add/edit/delete objects, attributes, CTAs, relationships)
│   ├── state.js               ← shared in-memory state, event bus
│   └── utils.js               ← helpers (id generation, fence-stripping, etc.)
└── .claude/
    └── rules/
        ├── data-schema.md     ← JSON schema rules (objects, relationships, versioning)
        ├── canvas-view.md     ← canvas rendering rules and layout
        ├── card-view.md       ← card view rendering rules
        ├── crud-view.md       ← CRUD panel rules
        └── conventions.md     ← JS/CSS/naming conventions
```

## Module Rules (load when working in that area)
- Data layer → `.claude/rules/data-schema.md`
- Canvas view → `.claude/rules/canvas-view.md`
- Card view → `.claude/rules/card-view.md`
- CRUD panel → `.claude/rules/crud-view.md`
- JS/CSS conventions → `.claude/rules/conventions.md`

## Hard Rules (always apply)
- No build tools. No npm. No bundler. No TypeScript. Vanilla JS (ES modules via `<script type="module">`).
- No external JS libraries except one: `d3-force` loaded from CDN for graph layout only.
- All state lives in `state.js`. No module holds its own state.
- Every JS file starts with filename as comment + 3-line readme (inputs / logic / outputs).
- Model JSON files under `data/` are the only persistence. No localStorage. No backend.
- One model file per client/project; `data/models.json` is the manifest. Nav `<select>` switches the active model.
- Bump `meta.version` in the active model file on every structural schema change.
- Three views: Canvas · Cards · CRUD. One active at a time. View toggled via nav.
- CRUD panel always operates on whatever is selected in Canvas or Cards.

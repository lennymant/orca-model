# Rule: Conventions

## JS Conventions

### File Header (every .js file)
```js
// src/filename.js
// Inputs: [what this module receives]
// Logic:  [what it does]
// Outputs: [what it exposes / emits]
```

### Module Pattern
- ES modules throughout (`import` / `export`)
- No default exports on modules with multiple exports — named exports only
- One responsibility per file — see project structure in CLAUDE.md

### State & Events
- All shared state lives in `state.js` — no other module holds mutable state
- Inter-module communication via event bus in `state.js`:
  ```js
  state.on('event:name', handler)
  state.emit('event:name', payload)
  ```
- Standard events:
  - `state:model-updated` — model changed, all views should re-render
  - `node:selected` — canvas node clicked, payload: `{ id }`
  - `node:open-crud` — canvas node double-clicked, payload: `{ id }`
  - `object:selected` — card clicked, payload: `{ id }`
  - `object:edit` — card edit button clicked, payload: `{ id }`

### ID Generation
- Always use `utils.generateId(prefix)` — never construct IDs manually
- IDs are stable once created — never regenerate for an existing record

### Error Handling
- Wrap JSON.parse in try/catch always
- Strip markdown fences before parsing: `/```json|```/g`
- Log errors to console with `[ooux-tool]` prefix
- Never silently swallow errors

### Functions
- Named functions preferred over arrow functions for top-level exports
- Arrow functions acceptable for callbacks and inline handlers
- No function longer than 40 lines — extract helpers

---

## CSS Conventions

### Approach
- Single `<style>` block in `index.html` for global styles and CSS variables
- Component styles inline in each module's `init()` via `insertAdjacentHTML` or DOM construction
- No external CSS frameworks. No CSS files.

### CSS Variables (defined in :root)
```css
--colour-bg: #0f1117;
--colour-surface: #1a1d27;
--colour-border: #2a2d3a;
--colour-text: #e2e8f0;
--colour-text-muted: #94a3b8;
--colour-accent: #3b82f6;
--colour-danger: #ef4444;
--colour-success: #22c55e;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Dark theme only — no light mode toggle at this stage.

### Layout
- `index.html` has three main regions: `#nav`, `#view-canvas`, `#view-cards`, `#panel-crud`
- Only one view visible at a time; others have `display: none`
- CRUD panel overlays the active view — `position: fixed; right: 0; top: 0`

---

## HTML Conventions

### index.html Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OOUX Model Tool — [Client Name]</title>
  <style>/* global styles + CSS vars */</style>
</head>
<body>
  <nav id="nav"><!-- view switcher + model name + export button --></nav>
  <main>
    <div id="view-canvas"><canvas id="graph-canvas"></canvas></div>
    <div id="view-cards" hidden></div>
    <aside id="panel-crud" hidden></aside>
  </main>
  <script type="module" src="src/state.js"></script>
  <script type="module" src="src/data.js"></script>
  <script type="module" src="src/utils.js"></script>
  <script type="module" src="src/canvas.js"></script>
  <script type="module" src="src/cards.js"></script>
  <script type="module" src="src/crud.js"></script>
  <script type="module">
    // main.js inline — bootstraps the app
  </script>
</body>
</html>
```

---

## What Not To Do
- Do not use `localStorage` or `sessionStorage`
- Do not add npm packages or CDN libraries beyond `d3-force`
- Do not create React components, Vue components, or any framework constructs
- Do not use `var` — use `const` and `let` only
- Do not mix view logic into `state.js` or `data.js`
- Do not hard-code object data in JS files — always read from `model.json` via `data.js`

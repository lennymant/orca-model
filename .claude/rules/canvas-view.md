# Rule: Canvas View

## File
`src/canvas.js` — renders the knowledge graph onto an HTML `<canvas>` element.

## Layout Engine
- Use `d3-force` (CDN) for node positioning: `forceSimulation`, `forceLink`, `forceManyBody`, `forceCenter`
- Run simulation headlessly (no DOM dependency on d3) — extract `x, y` from nodes, render manually on canvas
- Restart simulation on data change; freeze (alpha = 0) on stabilise

## Node Rendering (per object)
- Shape: rounded rectangle
- Width: 140px · Height: 48px · Corner radius: 8px
- Fill: `object.colour` at 90% opacity
- Border: 2px solid `object.colour`
- Label: object name, centred, 13px sans-serif, white, truncated with ellipsis at 120px
- Tier badge: small pill top-right, 10px, tier initial (C/T/B/M/Conv/Comp), white on semi-transparent dark

## Edge Rendering (per relationship)
- Line style by `direction`:
  - `parent-child` → solid line, filled arrowhead at `to` end
  - `peer` → solid line, open arrowhead both ends
  - `ownership` → dashed line, filled arrowhead at `to` end
  - `composition` → solid line, diamond at `from` end, arrowhead at `to` end
  - `reference` → dotted line, open arrowhead at `to` end
- Colour: `#666` default; highlight to `#333` on hover
- Label: relationship `label` text, 11px, centred on edge midpoint, white bg pill

## Interaction
- **Pan**: drag canvas background
- **Zoom**: mouse wheel — min 0.3× max 3× — transform via canvas `scale()`
- **Select node**: click → highlight node, emit `node:selected` event with object id
- **Drag node**: drag node to reposition; pin node position after drag (fix in simulation)
- **Hover node**: show tooltip with object name + tier + attribute count
- **Double-click node**: emit `node:open-crud` event → switches to CRUD view for that object
- **Click empty background**: deselect (clears any connection shading); a drag pans instead

## Connection-generation shading ("Shade by connection")
- Checkbox in the canvas controls; off by default.
- When on and a node is selected, fade every node by its **graph distance** (BFS hops)
  from the selected node, treating relationships as **undirected**:
  - gen 0 (selected) & gen 1 (directly connected): 100% opacity
  - gen 2: 75% · gen 3: 50% · −25% per generation outward, floored at 10%
  - unconnected objects: 10%
- Edges fade to the **minimum** opacity of their two endpoints.
- BFS runs over **visible** nodes only (respects the tier filter).
- Recomputed on select, deselect, toggle, and model change. Implemented via canvas `globalAlpha`.

## Canvas Controls (render as HTML overlay, not on canvas)
- Zoom in / Zoom out buttons
- Fit all (reset transform to show all nodes)
- Toggle labels (edge labels on/off)
- Shade by connection (checkbox — see shading section above)
- Tier filter (multi-select checkboxes: Core / Trust / Brand / Marketing / Conversion / Compliance)
  - Hidden objects are removed from simulation; their edges are also hidden

## Colour Palette (default tier colours — override with object.colour if set)
- Core: `#2563EB`
- Trust: `#059669`
- Brand: `#7C3AED`
- Marketing: `#D97706`
- Conversion: `#DC2626`
- Compliance: `#6B7280`

## Examples dock (foot of canvas)
- Toggled by a **"Show examples"** checkbox in the **nav** (top bar), off by default.
- When on, an overlay docks to the bottom of the canvas view showing a grid of small
  cards — one per object type that has `examples` — each listing that type's example
  instances as chips. Coloured top border per `object.colour`.
- Re-renders on model change while visible. Hidden when the Cards view is active
  (the dock lives inside `#view-canvas`).

## canvas.js Responsibilities
- `init(canvasEl, model)` — set up canvas, run simulation, render loop
- `update(model)` — diff model, update nodes/edges, restart simulation gently (alpha 0.3)
- `getSelectedId()` — return currently selected object id or null
- `setHighlight(id)` — highlight a node programmatically (called from cards.js selection)
- `setExamplesVisible(bool)` — show/hide the examples dock (called from the nav checkbox)
- Listen for state events: `state:model-updated` → call `update()`

# Rule: Card View

## File
`src/cards.js` — renders the object model as a grid of OOUX cards.

## Layout
- CSS grid: `repeat(auto-fill, minmax(320px, 1fr))`, gap 16px
- Sorted by tier order (Core → Trust → Brand → Marketing → Conversion → Compliance), then alphabetically within tier
- Tier group headers above each tier section (sticky, 12px uppercase label)

## Card Structure (per object)
```
┌─────────────────────────────┐
│ [colour bar 4px top]        │
│ Name            [Tier pill] │
│ Description (2 lines max)   │
├─────────────────────────────┤
│ ATTRIBUTES                  │
│ • Name (string, required)   │
│ • Slug (string)             │
│ [+ N more…] if >5           │
├─────────────────────────────┤
│ CTAs                        │
│ [Book a Demo] [Edit]        │
├─────────────────────────────┤
│ RELATIONSHIPS               │
│ → contains Solution Feature │
│ ← belongs to Sector         │
├─────────────────────────────┤
│ [Edit object]               │
└─────────────────────────────┘
```

## Card Rules
- Colour bar uses `object.colour`
- Tier pill: background is `object.colour` at 20% opacity, text is `object.colour`
- Attributes: show max 5; "+ N more" toggle expands inline
- CTAs: render as small tags `[label]`, non-interactive (display only in card view)
- Relationships: resolve both directions from `relationships[]`
  - Outgoing (from this object): `→ [label] [target object name]`
  - Incoming (to this object): `← [inverse_label] [source object name]`
  - Max 4 visible; "+ N more" toggle
- Edit button: emits `object:edit` event with object id → switches to CRUD view

## Filters (render as toolbar above grid)
- Search: text input filters by object name (live, case-insensitive)
- Tier filter: pill toggles (Core / Trust / Brand / Marketing / Conversion / Compliance)
- Priority filter: P0 / P1 / P2 checkboxes
- Clear filters button (only visible when filters active)

## Selection
- Click card → highlight with `2px solid` border using object colour
- Emit `object:selected` event with id → canvas.js highlights matching node
- Shift-click: multi-select (for future batch operations — wire event, don't implement batch yet)

## cards.js Responsibilities
- `init(containerEl, model)` — render full card grid
- `update(model)` — re-render (full replace is fine at this scale)
- `setSelected(id)` — highlight card programmatically (called from canvas selection)
- Listen for: `state:model-updated` → call `update()`
- Listen for: `node:selected` (from canvas) → call `setSelected(id)`

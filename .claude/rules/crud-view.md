# Rule: CRUD Panel

## File
`src/crud.js` — side panel for creating, editing, and deleting objects, attributes, CTAs, and relationships.

## Panel Layout
- Fixed right panel, 380px wide, full viewport height
- Slides in over canvas/cards (CSS transform translateX)
- Opened by: Edit button on card · Double-click on canvas node · "New Object" button in nav
- Closed by: ✕ button · Escape key · clicking outside panel

## Panel Modes
Three modes, toggled by tab strip at top of panel:

### 1. Object
Edit the selected object's core fields:
- Name (text input, required)
- Tier (select: Core / Trust / Brand / Marketing / Conversion / Compliance)
- Priority (select: P0 / P1 / P2)
- Description (textarea, 3 rows)
- Colour (colour picker — default populated from tier palette)
- Examples (repeatable text rows — example instances of this object type; [+ Add example] appends, ✕ removes; blank rows stripped on save)

### 2. Attributes & CTAs
Two sub-sections within the same tab:

**Attributes list**
- Each row: Name (text) · Type (select) · Required (checkbox) · [Delete] button
- Drag handle for reordering (CSS drag, update array order)
- [+ Add attribute] button appends new empty row
- Types: string · text · number · boolean · date · url · image · enum · reference

**CTAs list**
- Each row: Label (text) · Type (select) · [Delete] button
- [+ Add CTA] button appends new empty row
- Types: navigate · create · edit · delete · download · book · read · share · external

### 3. Relationships
- List of all relationships where this object is `from` or `to`
- Each row shows:
  - Direction indicator (→ outgoing / ← incoming)
  - From object name → To object name
  - Type · Cardinality · Direction
  - [Edit] inline expansion · [Delete] button
- [+ Add relationship] button opens relationship form:
  - From: locked to current object (with toggle to switch direction)
  - To: searchable select of all objects
  - Type: text input (free text)
  - Cardinality: select (one-to-one / one-to-many / many-to-many)
  - Direction: select (parent-child / peer / ownership / composition / reference)
  - Label: text input
  - Inverse label: text input

## Actions
- **Save**: validates required fields → calls `state.updateObject(obj)` or `state.addObject(obj)` → emits `state:model-updated`
- **Delete object**: confirmation dialog → calls `state.deleteObject(id)` → also deletes all relationships referencing this id → emits `state:model-updated` → closes panel
- **Cancel / Discard**: if unsaved changes exist, show "Discard changes?" confirm

## Validation Rules
- Object name: required, non-empty, unique within model
- Attribute name: required, non-empty
- CTA label: required, non-empty
- Relationship: `from` and `to` must differ; `label` required

## New Object Flow
- Nav "New Object" button opens panel in Object mode with blank form
- On save: `state.addObject()` with generated id → switches to Attributes tab automatically
- Colour auto-assigned from tier palette if not set

## crud.js Responsibilities
- `open(objectId | null)` — open panel; null = new object mode
- `close()` — close panel, discard unsaved state
- `getCurrentId()` — return id of object being edited, or null
- Listen for: `node:open-crud` (from canvas double-click) → call `open(id)`
- Listen for: `object:edit` (from card edit button) → call `open(id)`

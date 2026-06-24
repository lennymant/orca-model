# Rule: Data Schema

## Files
The tool holds **one model per client/project**, each in its own file under `data/`
(e.g. `data/gvs.json`, `data/door4.json`). A manifest enumerates them.

### Manifest — `data/models.json`
Loaded once at startup by `src/data.js`; drives the model `<select>` in the nav.
```json
{
  "default": "gvs",
  "models": [
    { "id": "gvs",   "name": "GVS Object Model",   "client": "Global View Systems", "file": "data/gvs.json" },
    { "id": "door4", "name": "Door4 Object Model", "client": "Door4",               "file": "data/door4.json" }
  ]
}
```
- `default` — id of the model loaded on startup (falls back to first entry).
- Each model file is the single source of truth for that client; switching the
  select calls `loadModel(file)` → `state.setModel()` → all views re-render.
- To add a client: drop a new `data/<id>.json` and add a manifest entry.

## Top-Level Shape (each model file)
```json
{
  "meta": {
    "name": "string — human name of the model",
    "client": "string — client name",
    "version": "string — semver e.g. 0.1.0",
    "created": "ISO date string",
    "updated": "ISO date string"
  },
  "objects": [ /* ObjectRecord[] */ ],
  "relationships": [ /* RelationshipRecord[] */ ]
}
```

## ObjectRecord
```json
{
  "id": "obj_[snake_case]",
  "name": "string",
  "tier": "Core | Trust | Brand | Marketing | Conversion | Compliance",
  "priority": "P0 | P1 | P2",
  "description": "string",
  "colour": "#hex",
  "attributes": [ /* AttributeRecord[] */ ],
  "ctas": [ /* CTARecord[] */ ],
  "examples": [ "string", "string" ]
}
```

### `examples` field
- Array of strings — example **instances** of this object type (content sketching).
- e.g. `obj_sector` → `["Healthcare", "Retail", "Manufacturing"]`.
- Optional; default `[]`. Older records may omit it — readers must tolerate its absence.
- Authored via the CRUD panel Object tab. Blank entries are stripped on save.

## AttributeRecord
```json
{
  "id": "attr_[4-digit-zero-padded]",
  "name": "string",
  "type": "string | text | number | boolean | date | url | image | enum | reference",
  "required": true | false,
  "notes": "string | omit if empty"
}
```

## CTARecord
```json
{
  "id": "cta_[4-digit-zero-padded]",
  "label": "string",
  "type": "navigate | create | edit | delete | download | book | read | share | external"
}
```

## RelationshipRecord
```json
{
  "id": "rel_[4-digit-zero-padded]",
  "from": "obj_id",
  "to": "obj_id",
  "type": "string — free text e.g. contains | belongs_to | references | composed_of | sponsors",
  "cardinality": "one-to-one | one-to-many | many-to-many",
  "direction": "parent-child | peer | ownership | composition | reference",
  "label": "string — human label for the from→to direction",
  "inverse_label": "string — human label for the to→from direction"
}
```

## ID Rules
- Object IDs: `obj_` prefix + snake_case name e.g. `obj_solution`, `obj_award_edition`
- Attribute IDs: `attr_` + 4-digit zero-padded sequence scoped to the parent object e.g. `attr_0001`
- CTA IDs: `cta_` + 4-digit zero-padded sequence scoped to the parent object
- Relationship IDs: `rel_` + 4-digit zero-padded global sequence

## Versioning
- Bump `meta.version` patch on data-only changes (new object/relationship added)
- Bump minor on schema shape changes (new field added to any record type)
- Always update `meta.updated` on any save

## data.js Responsibilities
- Load the manifest (`loadManifest`) and a chosen model file (`loadModel(file)`) on startup
- Strip markdown fences before `JSON.parse()` (Claude API responses may add them)
- Validate: check `meta.version` exists; warn to console if schema fields are missing
- Expose: `getModel()`, `getObjects()`, `getRelationships()`, `getObjectById(id)`
- Save: `saveModel(model)` — serialises to JSON, triggers download or in-memory update
- ID generation: `generateId(prefix)` — increments global counter per prefix

## GVS Object Tiers (reference)
- Core: Sector · Solution · Solution Feature · Use Case · Case Study
- Trust: Media Library · Person · Partner · Certification · Testimonial · Innovation Project
- Brand: Award Programme · Award Edition · Sponsor
- Marketing: Article · Event · Resource · Audience/Persona
- Conversion: Booking · FAQ
- Compliance: Policy/Legal

// src/crud.js
// Inputs: panel element, object id to edit (or null = new), open/edit events
// Logic:  side panel to create/edit/delete objects, attributes, CTAs, relationships
// Outputs: mutations via state.*; crud.{init,open,close,getCurrentId}

import * as state from './state.js';
import { escapeHtml } from './utils.js';

const TIERS = ['Core', 'Trust', 'Brand', 'Marketing', 'Conversion', 'Compliance'];
const PRIORITIES = ['P0', 'P1', 'P2'];
const ATTR_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'url', 'image', 'enum', 'reference'];
const CTA_TYPES = ['navigate', 'create', 'edit', 'delete', 'download', 'book', 'read', 'share', 'external'];
const TIER_COLOURS = {
  Core: '#2563EB', Trust: '#059669', Brand: '#7C3AED',
  Marketing: '#D97706', Conversion: '#DC2626', Compliance: '#6B7280',
};

let panel = null;
let draft = null;        // working copy of the object being edited
let currentId = null;    // id of existing object, or null for new
let activeTab = 'object';
let dirty = false;

export function init(panelEl) {
  panel = panelEl;
  state.on('node:open-crud', (p) => open(p?.id));
  state.on('object:edit', (p) => open(p?.id));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) close();
  });
}

export function open(objectId = null) {
  currentId = objectId;
  const existing = objectId ? state.getObjectById(objectId) : null;
  draft = existing
    ? structuredClone(existing)
    : { name: '', tier: 'Core', priority: 'P1', description: '', colour: TIER_COLOURS.Core, attributes: [], ctas: [], examples: [] };
  draft.examples = draft.examples || []; // older records may predate the field
  activeTab = 'object';
  dirty = false;
  panel.hidden = false;
  render();
}

export function close() {
  if (dirty && !confirm('Discard changes?')) return;
  panel.hidden = true;
  draft = null;
  currentId = null;
}

export function getCurrentId() {
  return currentId;
}

// --- Render ------------------------------------------------------------------

function render() {
  panel.innerHTML = '';
  panel.appendChild(header());
  panel.appendChild(tabs());
  const body = el('div', 'crud-body');
  if (activeTab === 'object') body.appendChild(objectForm());
  if (activeTab === 'attrs') body.append(attributesSection(), ctasSection());
  if (activeTab === 'rels') body.appendChild(relationshipsSection());
  panel.appendChild(body);
  panel.appendChild(footer());
}

function header() {
  const h = el('header', 'crud-header');
  const title = el('h2');
  title.textContent = currentId ? `Edit: ${draft.name || 'object'}` : 'New object';
  const x = el('button', 'crud-close');
  x.textContent = '✕';
  x.onclick = close;
  h.append(title, x);
  return h;
}

function tabs() {
  const strip = el('div', 'crud-tabs');
  const defs = [['object', 'Object'], ['attrs', 'Attributes & CTAs'], ['rels', 'Relationships']];
  defs.forEach(([key, label]) => {
    const btn = el('button', 'crud-tab');
    btn.textContent = label;
    btn.classList.toggle('is-active', activeTab === key);
    btn.disabled = key === 'rels' && !currentId;
    btn.onclick = () => { activeTab = key; render(); };
    strip.appendChild(btn);
  });
  return strip;
}

// --- Object tab --------------------------------------------------------------

function objectForm() {
  const form = el('div', 'crud-form');
  form.appendChild(field('Name', textInput(draft.name, (v) => { draft.name = v; markDirty(); })));
  form.appendChild(field('Tier', selectInput(TIERS, draft.tier, (v) => {
    draft.tier = v;
    if (!currentId) draft.colour = TIER_COLOURS[v];
    markDirty(); render();
  })));
  form.appendChild(field('Priority', selectInput(PRIORITIES, draft.priority, (v) => { draft.priority = v; markDirty(); })));
  const desc = document.createElement('textarea');
  desc.rows = 3;
  desc.value = draft.description || '';
  desc.oninput = () => { draft.description = desc.value; markDirty(); };
  form.appendChild(field('Description', desc));
  const colour = document.createElement('input');
  colour.type = 'color';
  colour.value = draft.colour || TIER_COLOURS[draft.tier];
  colour.oninput = () => { draft.colour = colour.value; markDirty(); };
  form.appendChild(field('Colour', colour));
  form.appendChild(examplesSection());
  return form;
}

// Example instances of this object type — simple labels (e.g. Sector -> "Healthcare").
function examplesSection() {
  const sec = el('section', 'crud-list');
  sec.appendChild(subhead('Examples'));
  draft.examples.forEach((ex, i) => sec.appendChild(exampleRow(ex, i)));
  sec.appendChild(addButton('+ Add example', () => {
    draft.examples.push('');
    markDirty(); render();
  }));
  return sec;
}

function exampleRow(value, i) {
  const row = el('div', 'crud-row');
  row.append(
    textInput(value, (v) => { draft.examples[i] = v; markDirty(); }, 'e.g. Healthcare'),
    deleteRowBtn(() => { draft.examples.splice(i, 1); markDirty(); render(); }),
  );
  return row;
}

// --- Attributes & CTAs tab ---------------------------------------------------

function attributesSection() {
  const sec = el('section', 'crud-list');
  sec.appendChild(subhead('Attributes'));
  draft.attributes.forEach((a, i) => sec.appendChild(attrRow(a, i)));
  sec.appendChild(addButton('+ Add attribute', () => {
    draft.attributes.push({ name: '', type: 'string', required: false });
    markDirty(); render();
  }));
  return sec;
}

function attrRow(a, i) {
  const row = el('div', 'crud-row');
  row.append(
    textInput(a.name, (v) => { a.name = v; markDirty(); }, 'Name'),
    selectInput(ATTR_TYPES, a.type, (v) => { a.type = v; markDirty(); }),
    requiredBox(a),
    deleteRowBtn(() => { draft.attributes.splice(i, 1); markDirty(); render(); }),
  );
  return row;
}

function requiredBox(a) {
  const label = el('label', 'check');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = Boolean(a.required);
  box.onchange = () => { a.required = box.checked; markDirty(); };
  label.append(box, document.createTextNode('req'));
  return label;
}

function ctasSection() {
  const sec = el('section', 'crud-list');
  sec.appendChild(subhead('CTAs'));
  draft.ctas.forEach((c, i) => sec.appendChild(ctaRow(c, i)));
  sec.appendChild(addButton('+ Add CTA', () => {
    draft.ctas.push({ label: '', type: 'navigate' });
    markDirty(); render();
  }));
  return sec;
}

function ctaRow(c, i) {
  const row = el('div', 'crud-row');
  row.append(
    textInput(c.label, (v) => { c.label = v; markDirty(); }, 'Label'),
    selectInput(CTA_TYPES, c.type, (v) => { c.type = v; markDirty(); }),
    deleteRowBtn(() => { draft.ctas.splice(i, 1); markDirty(); render(); }),
  );
  return row;
}

// --- Relationships tab -------------------------------------------------------

function relationshipsSection() {
  const sec = el('section', 'crud-list');
  state.getRelationshipsFor(currentId).forEach((r) => sec.appendChild(relRow(r)));
  sec.appendChild(addButton('+ Add relationship', () => openRelForm(sec, null)));
  return sec;
}

function relRow(r) {
  const row = el('div', 'crud-rel-row');
  const outgoing = r.from === currentId;
  const other = state.getObjectById(outgoing ? r.to : r.from);
  const arrow = outgoing ? '→ outgoing' : '← incoming';
  row.innerHTML = `<div><strong>${arrow}</strong> ${escapeHtml(other?.name || '?')}
    <div class="muted">${escapeHtml(r.type)} · ${escapeHtml(r.cardinality)} · ${escapeHtml(r.direction)}</div></div>`;
  row.appendChild(deleteRowBtn(() => {
    if (confirm('Delete this relationship?')) { state.deleteRelationship(r.id); render(); }
  }));
  return row;
}

function openRelForm(container, rel) {
  const form = el('div', 'crud-rel-form');
  const others = state.getObjects().filter((o) => o.id !== currentId);
  const target = selectInput(others.map((o) => o.name), others[0]?.name, () => {});
  const type = textInput('', () => {}, 'Type e.g. contains');
  const card = selectInput(['one-to-one', 'one-to-many', 'many-to-many'], 'one-to-many', () => {});
  const dir = selectInput(['parent-child', 'peer', 'ownership', 'composition', 'reference'], 'reference', () => {});
  const label = textInput('', () => {}, 'Label');
  const save = addButton('Save relationship', () => {
    const to = others.find((o) => o.name === target.value);
    if (!to || !label.value.trim()) return alert('Target and label are required.');
    state.addRelationship({ from: currentId, to: to.id, type: type.value, cardinality: card.value, direction: dir.value, label: label.value, inverse_label: label.value });
    render();
  });
  form.append(field('To', target), field('Type', type), field('Cardinality', card), field('Direction', dir), field('Label', label), save);
  container.appendChild(form);
}

// --- Footer / save / delete --------------------------------------------------

function footer() {
  const f = el('footer', 'crud-footer');
  const save = el('button', 'btn-save');
  save.textContent = 'Save';
  save.onclick = onSave;
  f.appendChild(save);
  if (currentId) {
    const del = el('button', 'btn-delete');
    del.textContent = 'Delete';
    del.onclick = onDelete;
    f.appendChild(del);
  }
  return f;
}

function onSave() {
  if (!validate()) return;
  draft.examples = draft.examples.map((s) => s.trim()).filter(Boolean);
  if (currentId) state.updateObject(draft);
  else {
    const created = state.addObject(draft);
    currentId = created.id;
    draft = structuredClone(created);
    activeTab = 'attrs';
  }
  dirty = false;
  render();
}

function onDelete() {
  if (!confirm(`Delete "${draft.name}" and its relationships?`)) return;
  state.deleteObject(currentId);
  panel.hidden = true;
  draft = null;
  currentId = null;
}

function validate() {
  if (!draft.name.trim()) { alert('Object name is required.'); return false; }
  const clash = state.getObjects().some((o) => o.name === draft.name.trim() && o.id !== currentId);
  if (clash) { alert('An object with that name already exists.'); return false; }
  if (draft.attributes.some((a) => !a.name.trim())) { alert('Every attribute needs a name.'); return false; }
  if (draft.ctas.some((c) => !c.label.trim())) { alert('Every CTA needs a label.'); return false; }
  return true;
}

// --- Small builders ----------------------------------------------------------

function markDirty() { dirty = true; }

function field(labelText, control) {
  const wrap = el('label', 'crud-field');
  const span = el('span', 'crud-label');
  span.textContent = labelText;
  wrap.append(span, control);
  return wrap;
}

function textInput(value, onChange, placeholder = '') {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.placeholder = placeholder;
  input.oninput = () => onChange(input.value);
  return input;
}

function selectInput(options, value, onChange) {
  const sel = document.createElement('select');
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => onChange(sel.value);
  return sel;
}

function subhead(text) {
  const h = el('h3', 'crud-subhead');
  h.textContent = text;
  return h;
}

function addButton(text, onClick) {
  const btn = el('button', 'crud-add');
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function deleteRowBtn(onClick) {
  const btn = el('button', 'crud-del');
  btn.textContent = '✕';
  btn.onclick = onClick;
  return btn;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

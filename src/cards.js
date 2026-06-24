// src/cards.js
// Inputs: container element, model (objects + relationships), selection events
// Logic:  render tier-grouped OOUX card grid with search/tier/priority filters
// Outputs: card DOM; emits object:selected, object:edit; cards.{init,update,setSelected}

import * as state from './state.js';
import { escapeHtml, truncate } from './utils.js';

const TIER_ORDER = ['Core', 'Trust', 'Brand', 'Marketing', 'Conversion', 'Compliance'];
const ATTR_LIMIT = 5;
const REL_LIMIT = 4;

let root = null;
let filters = { search: '', tiers: new Set(), priorities: new Set() };

export function init(containerEl, model) {
  root = containerEl;
  state.on('state:model-updated', () => update());
  state.on('node:selected', (p) => setSelected(p?.id));
  update(model);
}

export function update() {
  if (!root) return;
  root.innerHTML = '';
  root.appendChild(renderToolbar());
  const grid = document.createElement('div');
  grid.className = 'cards-grid';
  groupByTier(filterObjects(state.getObjects())).forEach(([tier, objs]) => {
    grid.appendChild(renderTierHeader(tier));
    objs.forEach((o) => grid.appendChild(renderCard(o)));
  });
  root.appendChild(grid);
}

export function setSelected(id) {
  root?.querySelectorAll('.card.is-selected').forEach((el) =>
    el.classList.remove('is-selected'));
  if (id) root?.querySelector(`.card[data-id="${id}"]`)?.classList.add('is-selected');
}

// --- Filtering + grouping ----------------------------------------------------

function filterObjects(objects) {
  const q = filters.search.toLowerCase();
  return objects.filter((o) => {
    if (q && !o.name.toLowerCase().includes(q)) return false;
    if (filters.tiers.size && !filters.tiers.has(o.tier)) return false;
    if (filters.priorities.size && !filters.priorities.has(o.priority)) return false;
    return true;
  });
}

function groupByTier(objects) {
  const map = new Map(TIER_ORDER.map((t) => [t, []]));
  objects.forEach((o) => (map.get(o.tier) || map.set(o.tier, []).get(o.tier)).push(o));
  return [...map.entries()]
    .filter(([, objs]) => objs.length)
    .map(([tier, objs]) => [tier, objs.sort((a, b) => a.name.localeCompare(b.name))]);
}

// --- Toolbar -----------------------------------------------------------------

function renderToolbar() {
  const bar = document.createElement('div');
  bar.className = 'cards-toolbar';
  const search = el('input', 'filter-search');
  search.type = 'search';
  search.placeholder = 'Search objects…';
  search.value = filters.search;
  search.oninput = () => { filters.search = search.value; update(); };
  bar.append(search, tierPills(), priorityChecks());
  if (hasActiveFilters()) bar.appendChild(clearButton());
  return bar;
}

function tierPills() {
  const wrap = el('div', 'filter-tiers');
  TIER_ORDER.forEach((t) => {
    const pill = el('button', 'pill');
    pill.textContent = t;
    pill.classList.toggle('is-on', filters.tiers.has(t));
    pill.onclick = () => { toggle(filters.tiers, t); update(); };
    wrap.appendChild(pill);
  });
  return wrap;
}

function priorityChecks() {
  const wrap = el('div', 'filter-priorities');
  ['P0', 'P1', 'P2'].forEach((p) => {
    const label = el('label', 'check');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = filters.priorities.has(p);
    box.onchange = () => { toggle(filters.priorities, p); update(); };
    label.append(box, document.createTextNode(p));
    wrap.appendChild(label);
  });
  return wrap;
}

function clearButton() {
  const btn = el('button', 'filter-clear');
  btn.textContent = 'Clear filters';
  btn.onclick = () => {
    filters = { search: '', tiers: new Set(), priorities: new Set() };
    update();
  };
  return btn;
}

function hasActiveFilters() {
  return Boolean(filters.search) || filters.tiers.size > 0 || filters.priorities.size > 0;
}

// --- Card --------------------------------------------------------------------

function renderTierHeader(tier) {
  const h = el('h2', 'tier-header');
  h.textContent = tier;
  return h;
}

function renderCard(o) {
  const card = el('article', 'card');
  card.dataset.id = o.id;
  card.style.setProperty('--card-colour', o.colour || 'var(--colour-accent)');
  if (state.getSelectedId() === o.id) card.classList.add('is-selected');
  card.innerHTML = cardHeader(o) + cardAttributes(o) + cardCtas(o) + cardRels(o);
  card.appendChild(editButton(o));
  card.onclick = (e) => { if (!e.target.closest('button')) selectCard(o.id); };
  return card;
}

function cardHeader(o) {
  return `
    <div class="card-bar"></div>
    <header class="card-head">
      <h3>${escapeHtml(o.name)}</h3>
      <span class="tier-pill">${escapeHtml(o.tier)}</span>
    </header>
    <p class="card-desc">${escapeHtml(truncate(o.description || '', 110))}</p>`;
}

function cardAttributes(o) {
  const attrs = o.attributes || [];
  const shown = attrs.slice(0, ATTR_LIMIT).map((a) =>
    `<li>${escapeHtml(a.name)} <span class="muted">(${escapeHtml(a.type)}${a.required ? ', required' : ''})</span></li>`).join('');
  const more = attrs.length > ATTR_LIMIT
    ? `<li class="muted">+ ${attrs.length - ATTR_LIMIT} more…</li>` : '';
  return `<section class="card-section"><h4>Attributes</h4><ul>${shown}${more}</ul></section>`;
}

function cardCtas(o) {
  const ctas = o.ctas || [];
  if (!ctas.length) return '';
  const tags = ctas.map((c) => `<span class="cta-tag">${escapeHtml(c.label)}</span>`).join('');
  return `<section class="card-section"><h4>CTAs</h4><div class="cta-row">${tags}</div></section>`;
}

function cardRels(o) {
  const rels = state.getRelationshipsFor(o.id);
  if (!rels.length) return '';
  const rows = rels.slice(0, REL_LIMIT).map((r) => relRow(o.id, r)).join('');
  const more = rels.length > REL_LIMIT
    ? `<li class="muted">+ ${rels.length - REL_LIMIT} more…</li>` : '';
  return `<section class="card-section"><h4>Relationships</h4><ul class="rel-list">${rows}${more}</ul></section>`;
}

function relRow(selfId, r) {
  const outgoing = r.from === selfId;
  const otherId = outgoing ? r.to : r.from;
  const other = state.getObjectById(otherId);
  const arrow = outgoing ? '→' : '←';
  const label = outgoing ? r.label : (r.inverse_label || r.label);
  return `<li>${arrow} ${escapeHtml(label)} <strong>${escapeHtml(other?.name || otherId)}</strong></li>`;
}

function editButton(o) {
  const btn = el('button', 'card-edit');
  btn.textContent = 'Edit object';
  btn.onclick = () => state.emit('object:edit', { id: o.id });
  return btn;
}

// --- Helpers -----------------------------------------------------------------

function selectCard(id) {
  state.select(id);
  setSelected(id);
  state.emit('object:selected', { id });
}

function toggle(set, value) {
  set.has(value) ? set.delete(value) : set.add(value);
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

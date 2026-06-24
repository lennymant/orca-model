// src/canvas.js
// Inputs: canvas element, model (objects + relationships), selection events
// Logic:  d3-force layout run headlessly; manual canvas render; pan/zoom/drag/select
// Outputs: graph render; emits node:selected, node:open-crud; canvas.{init,update,getSelectedId,setHighlight}

import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
} from 'https://esm.sh/d3-force@3';
import * as state from './state.js';
import { truncate } from './utils.js';

const NODE_W = 140;
const NODE_H = 48;
const RADIUS = 8;
const TIER_INITIAL = {
  Core: 'C', Trust: 'T', Brand: 'B', Marketing: 'M', Conversion: 'Conv', Compliance: 'Comp',
};

let canvas = null;
let ctx = null;
let sim = null;
let nodes = [];
let links = [];
let selectedId = null;
let hiddenTiers = new Set();
let showEdgeLabels = true;
let shaderOn = false;       // "shade by connection generation" toggle
let shadeAlpha = null;      // Map<id, alpha> when shading active, else null
let examplesVisible = false; // "show examples" dock at foot of canvas
const view = { x: 0, y: 0, k: 1 };
const drag = { node: null, panning: false, moved: false, lastX: 0, lastY: 0 };

export function init(canvasEl, model) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', () => { resize(); render(); });
  bindInteractions();
  state.on('state:model-updated', () => update());
  state.on('object:selected', (p) => setHighlight(p?.id));
  buildControls();
  buildExamplesDock();
  update(model);
}

export function update() {
  buildGraph();
  startSimulation(0.6);
  computeShade();
  if (examplesVisible) renderExamples();
}

// Toggle the examples dock (called from the nav "Show examples" checkbox).
export function setExamplesVisible(visible) {
  examplesVisible = visible;
  const dock = document.getElementById('canvas-examples');
  if (!dock) return;
  dock.hidden = !visible;
  if (visible) renderExamples();
}

export function getSelectedId() {
  return selectedId;
}

export function setHighlight(id) {
  selectedId = id;
  computeShade();
}

// --- Graph build + simulation ------------------------------------------------

function buildGraph() {
  const prev = new Map(nodes.map((n) => [n.id, n]));
  nodes = state.getObjects()
    .filter((o) => !hiddenTiers.has(o.tier))
    .map((o) => ({ ...prev.get(o.id), id: o.id, ref: o }));
  const visible = new Set(nodes.map((n) => n.id));
  links = state.getRelationships()
    .filter((r) => visible.has(r.from) && visible.has(r.to))
    .map((r) => ({ source: r.from, target: r.to, ref: r }));
}

function startSimulation(alpha) {
  sim?.stop();
  sim = forceSimulation(nodes)
    .force('link', forceLink(links).id((d) => d.id).distance(180))
    .force('charge', forceManyBody().strength(-600))
    .force('center', forceCenter(canvas.clientWidth / 2, canvas.clientHeight / 2))
    .force('collide', forceCollide(NODE_W / 1.5))
    .alpha(alpha)
    .on('tick', render);
}

// --- Connection-generation shading -------------------------------------------

// BFS graph distance from the selected node (edges treated as undirected),
// mapped to an opacity per node. Recomputed on select / toggle / model change.
function computeShade() {
  const active = shaderOn && selectedId && nodes.some((n) => n.id === selectedId);
  if (!active) { shadeAlpha = null; render(); return; }
  const depth = bfsDepths(selectedId);
  shadeAlpha = new Map(nodes.map((n) => [n.id, alphaForDepth(depth.get(n.id))]));
  render();
}

function bfsDepths(startId) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
  state.getRelationships().forEach((r) => {
    if (adj.has(r.from) && adj.has(r.to)) {
      adj.get(r.from).push(r.to);
      adj.get(r.to).push(r.from);
    }
  });
  const depth = new Map([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift();
    adj.get(cur).forEach((nb) => {
      if (!depth.has(nb)) { depth.set(nb, depth.get(cur) + 1); queue.push(nb); }
    });
  }
  return depth;
}

// gen 0 (selected) & gen 1 = 100%; gen 2 = 75%; gen 3 = 50%; -25% per gen, floor 10%.
// Unreachable (null depth) = floor.
function alphaForDepth(d) {
  if (d == null) return 0.1;
  if (d <= 1) return 1;
  return Math.max(0.1, 1 - (d - 1) * 0.25);
}

function shadeFor(id) {
  return shadeAlpha ? (shadeAlpha.get(id) ?? 0.1) : 1;
}

// --- Render ------------------------------------------------------------------

function render() {
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.k, 0, 0, view.k, view.x, view.y);
  links.forEach(drawEdge);
  nodes.forEach(drawNode);
}

function drawEdge(l) {
  const a = nodeAt(l.source);
  const b = nodeAt(l.target);
  if (!a || !b) return;
  ctx.globalAlpha = Math.min(shadeFor(a.id), shadeFor(b.id));
  applyEdgeStyle(l.ref.direction);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  drawArrow(a, b);
  if (showEdgeLabels) drawEdgeLabel(l.ref.label, a, b);
  ctx.globalAlpha = 1;
}

function applyEdgeStyle(direction) {
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1.5;
  if (direction === 'ownership') ctx.setLineDash([8, 4]);
  else if (direction === 'reference') ctx.setLineDash([2, 4]);
  else ctx.setLineDash([]);
}

function drawArrow(a, b) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const tip = { x: b.x - Math.cos(angle) * (NODE_W / 2), y: b.y - Math.sin(angle) * (NODE_H / 2) };
  const size = 8;
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - size * Math.cos(angle - 0.4), tip.y - size * Math.sin(angle - 0.4));
  ctx.lineTo(tip.x - size * Math.cos(angle + 0.4), tip.y - size * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawEdgeLabel(label, a, b) {
  if (!label) return;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  ctx.font = '11px sans-serif';
  const w = ctx.measureText(label).width + 8;
  ctx.fillStyle = 'rgba(26,27,40,0.85)'; // --midnight-dark
  ctx.fillRect(mx - w / 2, my - 8, w, 16);
  ctx.fillStyle = '#BFC0C6'; // --midnight-light
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, mx, my);
}

function drawNode(n) {
  const colour = n.ref.colour || '#2563EB';
  ctx.globalAlpha = shadeFor(n.id);
  roundRect(n.x - NODE_W / 2, n.y - NODE_H / 2, NODE_W, NODE_H, RADIUS);
  ctx.fillStyle = hexA(colour, n.id === selectedId ? 1 : 0.9);
  ctx.fill();
  ctx.lineWidth = n.id === selectedId ? 3 : 2;
  ctx.strokeStyle = n.id === selectedId ? '#fff' : colour;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(truncate(n.ref.name, 18), n.x, n.y);
  drawTierBadge(n);
  ctx.globalAlpha = 1;
}

function drawTierBadge(n) {
  const txt = TIER_INITIAL[n.ref.tier] || '?';
  ctx.font = '10px sans-serif';
  const w = ctx.measureText(txt).width + 8;
  const bx = n.x + NODE_W / 2 - w - 4;
  const by = n.y - NODE_H / 2 + 4;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(bx, by, w, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(txt, bx + w / 2, by + 7);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Interaction -------------------------------------------------------------

function bindInteractions() {
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDblClick);
}

function onDown(e) {
  const p = toWorld(e);
  const hit = hitTest(p);
  if (hit) {
    drag.node = hit;
    hit.fx = hit.x;
    hit.fy = hit.y;
    selectNode(hit.id);
    sim.alphaTarget(0.1).restart();
  } else {
    drag.panning = true;
    drag.moved = false;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  }
}

function onMove(e) {
  if (drag.node) {
    const p = toWorld(e);
    drag.node.fx = p.x;
    drag.node.fy = p.y;
  } else if (drag.panning) {
    drag.moved = true;
    view.x += e.clientX - drag.lastX;
    view.y += e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    render();
  } else {
    updateHover(e);
  }
}

function onUp() {
  if (drag.node) sim.alphaTarget(0); // leave fx/fy set → node stays pinned
  else if (drag.panning && !drag.moved) deselect(); // clean click on empty bg
  drag.node = null;
  drag.panning = false;
}

function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const k = Math.min(3, Math.max(0.3, view.k * factor));
  const p = toWorld(e);
  view.x = e.offsetX - p.x * k;
  view.y = e.offsetY - p.y * k;
  view.k = k;
  render();
}

function onDblClick(e) {
  const hit = hitTest(toWorld(e));
  if (hit) state.emit('node:open-crud', { id: hit.id });
}

function selectNode(id) {
  selectedId = id;
  state.select(id);
  state.emit('node:selected', { id });
  computeShade();
}

function deselect() {
  selectedId = null;
  state.select(null);
  state.emit('node:selected', { id: null });
  computeShade();
}

// --- Hover tooltip -----------------------------------------------------------

function updateHover(e) {
  const hit = hitTest(toWorld(e));
  const tip = document.getElementById('canvas-tooltip');
  if (!tip) return;
  if (!hit) { tip.hidden = true; canvas.style.cursor = 'grab'; return; }
  canvas.style.cursor = 'pointer';
  tip.hidden = false;
  tip.style.left = `${e.offsetX + 12}px`;
  tip.style.top = `${e.offsetY + 12}px`;
  tip.textContent = `${hit.ref.name} · ${hit.ref.tier} · ${hit.ref.attributes?.length || 0} attrs`;
}

// --- Controls overlay --------------------------------------------------------

function buildControls() {
  const host = canvas.parentElement;
  const bar = document.createElement('div');
  bar.className = 'canvas-controls';
  bar.append(
    ctrlBtn('＋', () => zoomBy(1.2)),
    ctrlBtn('－', () => zoomBy(0.8)),
    ctrlBtn('Fit', fitAll),
    ctrlBtn('Labels', () => { showEdgeLabels = !showEdgeLabels; render(); }),
  );
  bar.appendChild(shaderToggle());
  bar.appendChild(tierFilter());
  host.appendChild(bar);
  const tip = document.createElement('div');
  tip.id = 'canvas-tooltip';
  tip.className = 'canvas-tooltip';
  tip.hidden = true;
  host.appendChild(tip);
}

// Checkbox: when on, clicking a node fades others by connection generation.
function shaderToggle() {
  const label = document.createElement('label');
  label.className = 'canvas-shader-toggle';
  label.title = 'Fade objects by connection generation from the selected object';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = shaderOn;
  box.onchange = () => { shaderOn = box.checked; computeShade(); };
  label.append(box, document.createTextNode('Shade by connection'));
  return label;
}

// --- Examples dock (foot of canvas) ------------------------------------------

function buildExamplesDock() {
  const dock = document.createElement('div');
  dock.id = 'canvas-examples';
  dock.className = 'canvas-examples';
  dock.hidden = true;
  canvas.parentElement.appendChild(dock);
}

// Grid of small cards: one per object type that has example instances.
function renderExamples() {
  const dock = document.getElementById('canvas-examples');
  if (!dock) return;
  dock.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'examples-head';
  const withEx = state.getObjects().filter((o) => o.examples && o.examples.length);
  head.textContent = withEx.length ? 'Examples by object type' : 'No examples defined yet';
  dock.appendChild(head);
  const grid = document.createElement('div');
  grid.className = 'examples-grid';
  withEx.forEach((o) => grid.appendChild(exampleCard(o)));
  dock.appendChild(grid);
}

function exampleCard(o) {
  const card = document.createElement('div');
  card.className = 'example-card';
  card.style.setProperty('--card-colour', o.colour || '#2563EB');
  const h = document.createElement('h5');
  h.textContent = o.name;
  const chips = document.createElement('div');
  chips.className = 'example-chips';
  o.examples.forEach((ex) => {
    const chip = document.createElement('span');
    chip.className = 'example-chip';
    chip.textContent = ex;
    chips.appendChild(chip);
  });
  card.append(h, chips);
  return card;
}

function tierFilter() {
  const wrap = document.createElement('div');
  wrap.className = 'canvas-tier-filter';
  Object.keys(TIER_INITIAL).forEach((tier) => {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    box.onchange = () => {
      box.checked ? hiddenTiers.delete(tier) : hiddenTiers.add(tier);
      update();
    };
    label.append(box, document.createTextNode(tier));
    wrap.appendChild(label);
  });
  return wrap;
}

function ctrlBtn(text, onClick) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function zoomBy(factor) {
  view.k = Math.min(3, Math.max(0.3, view.k * factor));
  render();
}

function fitAll() {
  if (!nodes.length) return;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - NODE_W;
  const maxX = Math.max(...xs) + NODE_W;
  const minY = Math.min(...ys) - NODE_H;
  const maxY = Math.max(...ys) + NODE_H;
  const k = Math.min(canvas.clientWidth / (maxX - minX), canvas.clientHeight / (maxY - minY), 3);
  view.k = Math.max(0.3, k);
  view.x = (canvas.clientWidth - (minX + maxX) * view.k) / 2;
  view.y = (canvas.clientHeight - (minY + maxY) * view.k) / 2;
  render();
}

// --- Geometry helpers --------------------------------------------------------

function resize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

function toWorld(e) {
  return { x: (e.offsetX - view.x) / view.k, y: (e.offsetY - view.y) / view.k };
}

function hitTest(p) {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const n = nodes[i];
    if (n.x == null) continue;
    if (Math.abs(p.x - n.x) <= NODE_W / 2 && Math.abs(p.y - n.y) <= NODE_H / 2) return n;
  }
  return null;
}

function nodeAt(ref) {
  return typeof ref === 'object' ? ref : nodes.find((n) => n.id === ref);
}

function hexA(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

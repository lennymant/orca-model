// src/utils.js
// Inputs: raw strings, id prefixes, existing id collections
// Logic:  pure helpers — slugify, id generation, markdown fence stripping, escaping
// Outputs: named helper functions used across all modules

const LOG_PREFIX = '[ooux-tool]';

// Log a namespaced message. Level is 'log' | 'warn' | 'error'.
export function log(level, ...args) {
  const fn = console[level] || console.log;
  fn(LOG_PREFIX, ...args);
}

// Convert a human name to snake_case suitable for an object id suffix.
export function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Strip ```json … ``` fences that Claude API responses may wrap JSON in.
export function stripFences(raw) {
  return String(raw).replace(/```json|```/g, '').trim();
}

// Generate an object id: obj_<snake_case_name>, de-duplicated against existing ids.
export function generateObjectId(name, existingIds = []) {
  const base = `obj_${slugify(name) || 'object'}`;
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

// Generate the next 4-digit zero-padded id for a prefix, given existing ids.
// e.g. nextSequentialId('attr', ['attr_0001','attr_0003']) -> 'attr_0004'
export function nextSequentialId(prefix, existingIds = []) {
  const max = existingIds.reduce((hi, id) => {
    const m = String(id).match(new RegExp(`^${prefix}_(\\d+)$`));
    return m ? Math.max(hi, parseInt(m[1], 10)) : hi;
  }, 0);
  return `${prefix}_${String(max + 1).padStart(4, '0')}`;
}

// Facade matching conventions.md: generateId(prefix, existingIds, name?).
// With a name -> object-style id; otherwise -> sequential id.
export function generateId(prefix, existingIds = [], name = null) {
  if (prefix === 'obj' && name != null) return generateObjectId(name, existingIds);
  return nextSequentialId(prefix, existingIds);
}

// Escape a string for safe insertion into HTML.
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Truncate text to a max length with an ellipsis.
export function truncate(str, max) {
  const s = String(str ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

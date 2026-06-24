// src/data.js
// Inputs: data/model.json (fetched), model objects to persist
// Logic:  load + fence-strip + parse + validate; serialise + download; version bumps
// Outputs: data.{loadModel, saveModel, validateModel, bumpVersion}

import { stripFences, log, slugify } from './utils.js';
import { setModel, getModel } from './state.js';

const MANIFEST_PATH = 'data/models.json';
const REQUIRED_OBJECT_FIELDS = ['id', 'name', 'tier', 'priority'];

// Fetch the model manifest listing every available model (one per client/project).
// Shape: { default: "id", models: [{ id, name, client, file }] }
export async function loadManifest(path = MANIFEST_PATH) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to fetch ${path}: ${res.status}`);
  const manifest = JSON.parse(stripFences(await res.text()));
  if (!Array.isArray(manifest.models) || !manifest.models.length) {
    throw new Error('manifest has no models');
  }
  log('log', `manifest: ${manifest.models.length} model(s)`);
  return manifest;
}

// Fetch, strip fences, parse, validate, and push into state. Returns the model.
// `path` is a model file from the manifest, e.g. 'data/gvs.json'.
export async function loadModel(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to fetch ${path}: ${res.status}`);
  const raw = await res.text();
  const model = parseModel(raw);
  validateModel(model);
  setModel(model);
  log('log', `loaded model "${model.meta?.name}" v${model.meta?.version}`);
  return model;
}

// Parse model JSON, stripping any markdown fences first. Throws on bad JSON.
export function parseModel(raw) {
  try {
    return JSON.parse(stripFences(raw));
  } catch (err) {
    log('error', 'model.json failed to parse', err);
    throw err;
  }
}

// Warn (do not throw) on missing schema fields so the tool stays usable.
export function validateModel(model) {
  if (!model || typeof model !== 'object') {
    log('error', 'model is not an object');
    return false;
  }
  if (!model.meta?.version) log('warn', 'model.meta.version is missing');
  if (!Array.isArray(model.objects)) log('warn', 'model.objects is not an array');
  if (!Array.isArray(model.relationships)) {
    log('warn', 'model.relationships is not an array');
  }
  (model.objects || []).forEach((o) => {
    REQUIRED_OBJECT_FIELDS.forEach((f) => {
      if (o[f] == null) log('warn', `object ${o.id || '?'} missing "${f}"`);
    });
  });
  return true;
}

// Serialise the current model and trigger a download of model.json.
// Stamps meta.updated and bumps the patch version on every save.
export function saveModel(model = getModel()) {
  bumpVersion(model, 'patch', new Date().toISOString().slice(0, 10));
  const json = JSON.stringify(model, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `${slugify(model.meta?.client) || 'model'}.json`;
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  log('log', `${filename} exported`);
}

// Bump semver. kind = 'patch' (data change) | 'minor' (schema shape change).
// Note: meta.updated is set by the caller with a real timestamp (no Date in lib).
export function bumpVersion(model, kind, isoDate) {
  const [maj, min, pat] = String(model.meta.version || '0.0.0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  model.meta.version =
    kind === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
  if (isoDate) model.meta.updated = isoDate;
  return model.meta.version;
}

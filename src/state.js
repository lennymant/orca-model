// src/state.js
// Inputs: model object (from data.js), mutation calls from crud.js, selection from views
// Logic:  single source of in-memory truth + event bus; owns the model and selection
// Outputs: state.{getModel,setModel,getObjects,getRelationships,getObjectById,
//          addObject,updateObject,deleteObject,addRelationship,updateRelationship,
//          deleteRelationship,select,getSelectedId,on,off,emit}

import { generateId, log } from './utils.js';

let model = { meta: {}, objects: [], relationships: [] };
let selectedId = null;
const listeners = new Map();

// --- Event bus ---------------------------------------------------------------

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((handler) => {
    try {
      handler(payload);
    } catch (err) {
      log('error', `handler for "${event}" threw`, err);
    }
  });
}

// --- Model accessors ---------------------------------------------------------

export function setModel(next) {
  model = next;
  emit('state:model-updated', model);
}

export function getModel() {
  return model;
}

export function getObjects() {
  return model.objects;
}

export function getRelationships() {
  return model.relationships;
}

export function getObjectById(id) {
  return model.objects.find((o) => o.id === id) || null;
}

// --- Selection ---------------------------------------------------------------

export function select(id) {
  selectedId = id;
}

export function getSelectedId() {
  return selectedId;
}

// --- Mutations (all bump updated + emit state:model-updated) ------------------

function touch() {
  model.meta.updated = model.meta.updated || '';
  emit('state:model-updated', model);
}

// Add a new object. Generates an id from its name if not supplied.
export function addObject(obj) {
  const ids = model.objects.map((o) => o.id);
  const record = {
    attributes: [],
    ctas: [],
    ...obj,
    id: obj.id || generateId('obj', ids, obj.name),
  };
  model.objects.push(record);
  touch();
  return record;
}

export function updateObject(obj) {
  const i = model.objects.findIndex((o) => o.id === obj.id);
  if (i === -1) {
    log('warn', `updateObject: no object with id ${obj.id}`);
    return null;
  }
  model.objects[i] = { ...model.objects[i], ...obj };
  touch();
  return model.objects[i];
}

// Delete an object and cascade-delete every relationship referencing it.
export function deleteObject(id) {
  model.objects = model.objects.filter((o) => o.id !== id);
  model.relationships = model.relationships.filter(
    (r) => r.from !== id && r.to !== id,
  );
  if (selectedId === id) selectedId = null;
  touch();
}

export function addRelationship(rel) {
  const ids = model.relationships.map((r) => r.id);
  const record = { ...rel, id: rel.id || generateId('rel', ids) };
  model.relationships.push(record);
  touch();
  return record;
}

export function updateRelationship(rel) {
  const i = model.relationships.findIndex((r) => r.id === rel.id);
  if (i === -1) {
    log('warn', `updateRelationship: no relationship with id ${rel.id}`);
    return null;
  }
  model.relationships[i] = { ...model.relationships[i], ...rel };
  touch();
  return model.relationships[i];
}

export function deleteRelationship(id) {
  model.relationships = model.relationships.filter((r) => r.id !== id);
  touch();
}

// Relationships touching a given object id (both directions).
export function getRelationshipsFor(id) {
  return model.relationships.filter((r) => r.from === id || r.to === id);
}

"use strict";
/**
 * HAK Smart Filter — public headless API.
 * No DOM, Electron, React, AppSheet, or application globals required.
 * @typedef {{q:string,tu:string,den:string,ky:string,sel:Object,one:Object,flag:Object}} FilterState
 */
const core = require("./core/smart-filter.js");
const VERSION = "1.0.0";

function validateConfig(config) {
  if (!config || typeof config !== "object") throw new TypeError("config is required");
  if (!config.screenId || typeof config.screenId !== "string") throw new TypeError("config.screenId must be a string");
  if (!Array.isArray(config.fields)) throw new TypeError("config.fields must be an array");
  const keys = new Set();
  for (const field of config.fields) {
    if (!field || typeof field.key !== "string" || !field.key || !["multi", "enum", "bool"].includes(field.type)) {
      throw new TypeError("Each field requires a key and type (multi|enum|bool)");
    }
    if (keys.has(field.key)) throw new TypeError("Duplicate filter field: " + field.key);
    keys.add(field.key);
    if (field.match != null && typeof field.match !== "function") throw new TypeError("field.match must be a function");
  }
  return config;
}

function createFilter(config, options = {}) {
  validateConfig(config);
  let state = core.normalize(options.initialState || core.empty(), config);
  const listeners = new Set();
  const strict = options.strict !== false;
  function emit() {
    const current = getState();
    for (const fn of Array.from(listeners)) fn(current);
  }
  function getState() { return core.normalize(state, config); }
  function setState(next) {
    const candidate = core.normalize(next, config);
    const issue = core.dateProblem(candidate);
    if (issue) throw new RangeError(issue);
    state = candidate;
    emit();
    return getState();
  }
  function filter(rows, ctx) {
    if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
    const result = core.filterRows(rows, config, state, ctx);
    if (strict && result.unsupported.length) {
      const error = new Error("Unsupported filter conditions: " + result.unsupported.join(", "));
      error.code = "HAK_FILTER_UNSUPPORTED";
      error.unsupported = result.unsupported.slice();
      throw error;
    }
    return { ...result, state: getState(), scope: core.scopeText(config, state) };
  }
  return Object.freeze({
    version: VERSION,
    getState,
    setState,
    reset: () => setState(core.empty()),
    setField: (key, value) => {
      const field = config.fields.find(f => f.key === key);
      if (!field) throw new RangeError("Unknown field: " + key);
      return setState(core.setField(state, field, value));
    },
    removeCondition: condition => setState(core.remove(state, condition)),
    filter,
    describe: () => core.scopeText(config, state),
    conditions: () => core.conditions(config, state),
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    savePreset(name, storage) { return core.presets(storage).save(config.screenId, name, state); },
    loadPreset(name, storage) {
      const result = core.applyPreset(config, core.presets(storage).get(config.screenId, name));
      if (result.ok) setState(result.state);
      return result;
    },
    listPresets(storage) { return core.presets(storage).list(config.screenId); }
  });
}
module.exports = Object.freeze({ VERSION, createFilter, validateConfig, core });

/* Browser entry for script-tag applications.
 * Load core/smart-filter.js first, then this file. */
(function (root) {
  "use strict";
  var core = root.HAKCore && root.HAKCore.sf;
  if (!core) throw new Error("Load core/smart-filter.js before browser.js");
  function createFilter(config, options) {
    options = options || {};
    if (!config || !config.screenId || !Array.isArray(config.fields)) throw new TypeError("Invalid filter config");
    var state = core.normalize(options.initialState || core.empty(), config), listeners = [];
    function getState() { return core.normalize(state, config); }
    function setState(next) {
      var candidate = core.normalize(next, config), issue = core.dateProblem(candidate);
      if (issue) throw new RangeError(issue);
      state = candidate;
      listeners.slice().forEach(function (fn) { fn(getState()); });
      return getState();
    }
    return {
      getState: getState, setState: setState, reset: function () { return setState(core.empty()); },
      setField: function (key, value) {
        var f = config.fields.filter(function (f) { return f.key === key; })[0];
        if (!f) throw new RangeError("Unknown field: " + key);
        return setState(core.setField(state, f, value));
      },
      filter: function (rows, ctx) {
        if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
        var result = core.filterRows(rows, config, state, ctx);
        if (options.strict !== false && result.unsupported.length) throw new Error("Unsupported filter conditions: " + result.unsupported.join(", "));
        result.state = getState(); result.scope = core.scopeText(config, state);
        return result;
      },
      describe: function () { return core.scopeText(config, state); },
      subscribe: function (fn) {
        if (typeof fn !== "function") throw new TypeError("listener must be a function");
        listeners.push(fn);
        return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
      }
    };
  }
  root.HAKSmartFilter = { VERSION: "1.0.0", core: core, createFilter: createFilter };
})(typeof globalThis !== "undefined" ? globalThis : this);

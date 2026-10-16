"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFilter, validateConfig, core } = require("../index.js");

const config = {
  screenId: "test",
  fields: [
    { key: "status", type: "multi", label: "Trạng thái", match: (r, v) => core.inSet(v, r.status) },
    { key: "branch", type: "enum", label: "Chi nhánh", match: (r, v) => r.branch === v },
    { key: "active", type: "bool", label: "Đang làm", match: r => r.active }
  ],
  matchQ: (r, q) => core.hay([r.name], q)
};
const rows = [
  { name: "Nguyễn Văn An", status: "Đã duyệt", branch: "DN", active: true },
  { name: "Tran Binh", status: "Chờ", branch: "QN", active: false },
  { name: "Nguyễn Thảo", status: "Đã duyệt", branch: "DN", active: true }
];
test("headless engine filters multi + enum and preserves input", () => {
  const f = createFilter(config);
  f.setField("status", ["Đã duyệt"]);
  f.setField("branch", "DN");
  const result = f.filter(rows);
  assert.equal(result.kept, 2);
  assert.equal(result.total, 3);
  assert.equal(rows.length, 3);
  assert.deepEqual(result.unsupported, []);
});
test("normalizes Vietnamese search", () => {
  const f = createFilter(config);
  f.setState({ q: "nguyen" });
  assert.equal(f.filter(rows).kept, 2);
});
test("rejects reversed date ranges", () => {
  const f = createFilter(config);
  assert.throws(() => f.setState({ tu: "2026-12-31", den: "2026-01-01" }), RangeError);
  assert.equal(f.getState().tu, "");
});
test("fails closed on unsupported active condition", () => {
  const f = createFilter({ screenId: "strict", fields: [] });
  f.setState({ q: "abc" });
  assert.throws(() => f.filter(rows), e => e.code === "HAK_FILTER_UNSUPPORTED");
});
test("notifies subscribers and supports unsubscribe", () => {
  const f = createFilter(config); let count = 0;
  const stop = f.subscribe(() => count++);
  f.setField("branch", "DN"); stop(); f.reset();
  assert.equal(count, 1);
});
test("state snapshots cannot mutate internal state", () => {
  const f = createFilter(config); f.setField("status", ["Chờ"]);
  const snapshot = f.getState(); snapshot.sel.status.push("Đã duyệt");
  assert.deepEqual(f.getState().sel.status, ["Chờ"]);
});
test("config validation rejects duplicate keys", () => {
  assert.throws(() => validateConfig({ screenId: "x", fields: [{ key: "a", type: "enum" }, { key: "a", type: "enum" }] }), /Duplicate/);
});
test("presets save and restore by screen", () => {
  const map = new Map(), storage = { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v) };
  const f = createFilter(config); f.setField("branch", "DN");
  assert.equal(f.savePreset("DN", storage).ok, true);
  f.reset(); const result = f.loadPreset("DN", storage);
  assert.equal(result.ok, true); assert.equal(f.getState().one.branch, "DN");
});

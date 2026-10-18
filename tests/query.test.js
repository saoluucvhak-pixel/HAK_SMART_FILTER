"use strict";
// V12 truy vấn có kiểu + snapshot dùng chung (chuyển từ nhánh feature/hak-shared-filter-report-v12 của LUONG_HAK).
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFilter, core, query } = require("../index.js");

const rows = [
  { id: 1, name: "Nguyễn Văn A", amount: 100, pb: "DN", allow: true },
  { id: 2, name: "Trần B", amount: 200, pb: "QN", allow: false },
  { id: 3, name: "Nguyen C", amount: 300, pb: "DN", allow: true },
  { id: 4, name: "Lê Đức", amount: null, pb: "", allow: true },
];
const FIELDS = ["name", "amount", "pb"];

// --- giữ đúng 3 test gốc của V12 ---
test("V12: AND/OR, không phân biệt dấu, quyền đọc", () => {
  const q = { logic: "AND", conditions: [{ field: "name", op: "contains", value: "nguyen" }, { logic: "OR", conditions: [{ field: "amount", op: "gte", value: 300 }, { field: "amount", op: "eq", value: 100 }] }] };
  const r = query.queryRows(rows, q, { fields: FIELDS, canRead: r => r.allow });
  assert.deepEqual(r.rows.map(x => x.id), [1, 3]);
  assert.equal(r.totalAuthorized, 3);
});
test("V12: từ chối trường không cho phép (fail closed)", () => {
  assert.throws(() => query.queryRows(rows, { field: "secret", op: "eq", value: 1 }, { fields: ["name"] }), e => e.code === "HAK_FILTER_UNSUPPORTED");
});
test("V12: phân trang", () => {
  const r = query.queryRows(rows, { field: "amount", op: "gte", value: 0 }, { fields: ["amount"], page: 2, pageSize: 1 });
  assert.deepEqual(r.rows.map(x => x.id), [2]);
  assert.equal(r.totalMatched, 3);
});

// --- bổ sung ---
test("toán tử empty/notEmpty/in/between/ne và chữ đ", () => {
  const ids = q => query.queryRows(rows, q, { fields: FIELDS }).rows.map(x => x.id);
  assert.deepEqual(ids({ field: "pb", op: "empty" }), [4]);
  assert.deepEqual(ids({ field: "amount", op: "notEmpty" }), [1, 2, 3]);
  assert.deepEqual(ids({ field: "pb", op: "in", value: ["QN"] }), [2]);
  assert.deepEqual(ids({ field: "amount", op: "between", value: [150, 300] }), [2, 3]);
  assert.deepEqual(ids({ field: "name", op: "contains", value: "duc" }), [4]);
  assert.deepEqual(ids({ field: "pb", op: "ne", value: "DN" }), [2, 4]);
});

test("giá trị sai dạng, lồng quá sâu, quá nhiều điều kiện đều bị từ chối", () => {
  const opt = { fields: FIELDS };
  assert.throws(() => query.queryRows(rows, { field: "pb", op: "in", value: "DN" }, opt), /không đúng dạng/);
  assert.throws(() => query.queryRows(rows, { field: "amount", op: "between", value: [1] }, opt), /không đúng dạng/);
  assert.throws(() => query.queryRows(rows, { field: "pb", op: "regex", value: "x" }, opt), /không hỗ trợ/);
  let deep = { field: "pb", op: "notEmpty" };
  for (let i = 0; i < 14; i++) deep = { logic: "AND", conditions: [deep] };
  assert.throws(() => query.queryRows(rows, deep, opt), /quá sâu/);
  assert.throws(() => query.queryRows(rows, { logic: "OR", conditions: Array(101).fill({ field: "pb", op: "empty" }) }, opt), /không hợp lệ/);
});

test("sắp xếp ổn định, tiếng Việt, ô trống xuống cuối", () => {
  const r = query.queryRows(rows, { field: "amount", op: "lte", value: 1000 }, { fields: FIELDS, sort: { field: "amount", direction: "desc" } });
  assert.deepEqual(r.rows.map(x => x.id), [3, 2, 1]);
  const all = query.queryRows(rows, { logic: "OR", conditions: [{ field: "pb", op: "empty" }, { field: "pb", op: "notEmpty" }] }, { fields: FIELDS, sort: { field: "name", direction: "asc" } });
  assert.deepEqual(all.rows.map(x => x.name), ["Lê Đức", "Nguyễn Văn A", "Nguyen C", "Trần B"].sort((a, b) => a.localeCompare(b, "vi")));
  assert.throws(() => query.queryRows(rows, { field: "pb", op: "empty" }, { fields: FIELDS, sort: { field: "id", direction: "asc" } }), /Sắp xếp/);
});

test("describeQuery viết điều kiện bằng tiếng Việt", () => {
  const q = { logic: "AND", conditions: [{ field: "pb", op: "in", value: ["DN", "QN"] }, { logic: "OR", conditions: [{ field: "amount", op: "gte", value: 100 }, { field: "name", op: "contains", value: "an" }] }] };
  assert.equal(query.describeQuery(q, { pb: "Đơn vị", amount: "Số tiền", name: "Họ tên" }), "Đơn vị thuộc {DN, QN} và (Số tiền ≥ 100 hoặc Họ tên chứa “an”)");
});

test("snapshot V12: đóng băng, có vân tay; bản xuất khớp/không khớp phát hiện được", () => {
  const snap = query.createSnapshot({ rows, query: { field: "pb", op: "eq", value: "DN" }, fields: FIELDS, canRead: r => r.allow, idField: "id", labels: { pb: "Đơn vị" } });
  assert.deepEqual(snap.rows.map(r => r.id), [1, 3]);
  assert.deepEqual([snap.total, snap.kept, snap.scopeText], [3, 2, "Đơn vị = “DN”"]);
  assert.ok(Object.isFrozen(snap) && Object.isFrozen(snap.rows) && Object.isFrozen(snap.rows[0]));
  assert.throws(() => { "use strict"; snap.rows[0].amount = 0; });
  assert.equal(rows[0].amount, 100);
  assert.equal(query.sameAsSnapshot(snap, [{ id: 1 }, { id: 3 }], "id"), true);
  assert.equal(query.sameAsSnapshot(snap, [{ id: 3 }, { id: 1 }], "id"), false, "đảo thứ tự cũng bị phát hiện");
  assert.equal(query.sameAsSnapshot(snap, [{ id: 1 }], "id"), false);
});

test("snapshot từ bộ lọc V10.3 (createFilter) dùng chung scopeText", () => {
  const f = createFilter({
    screenId: "ns", fields: [{ key: "pb", type: "multi", label: "Đơn vị", match: (r, v) => core.inSet(v, r.pb) }],
    matchQ: (r, q) => core.hay([r.name]).includes(q),
  });
  f.setField("pb", ["DN"]);
  const snap = query.createSnapshot({ rows, filter: f, canRead: r => r.allow, idField: "id" });
  assert.deepEqual(snap.rows.map(r => r.id), [1, 3]);
  assert.equal(snap.scopeText, f.describe());
  assert.equal(snap.total, 3);
});

test("chạy được khi nạp bằng thẻ script (không có module)", () => {
  const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
  const ctx = vm.createContext({ self: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "core", "query.js"), "utf8"), ctx);
  assert.equal(typeof vm.runInContext("self.HAKCore.query.queryRows", ctx), "function");
});

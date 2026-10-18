"use strict";
// Tìm kiếm tiếng Việt (có/không dấu, dựng sẵn/tổ hợp) và hiệu năng trên dữ liệu lớn.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFilter, core } = require("../index.js");

const cfg = {
  screenId: "vn",
  fields: [{ key: "dv", type: "multi", label: "Đơn vị", match: (r, v) => core.inSet(v, r.dv) }],
  matchQ: (r, q) => core.hay([r.ten, r.ncc]).includes(q),
};
const rows = [
  { ten: "Keo lá tràm", ncc: "Công ty TNHH SX TM DV Đại Hiệp", dv: "ĐH" },
  { ten: "Dăm gỗ keo", ncc: "Hoàng Anh Khôi Quảng Nam", dv: "HAKQN" },
  { ten: "Gỗ tràm bông vàng", ncc: "Ông Nguyễn Văn Ửng", dv: "HAK" },
];
const kept = q => { const f = createFilter(cfg); f.setState({ q }); return f.filter(rows).rows.map(r => r.ten); };

test("gõ không dấu tìm ra chữ có dấu", () => {
  assert.deepEqual(kept("keo la tram"), ["Keo lá tràm"]);
  assert.deepEqual(kept("dai hiep"), ["Keo lá tràm"]);
  assert.deepEqual(kept("quang nam"), ["Dăm gỗ keo"]);
});

test("chữ đ/Đ và chữ có hai dấu (ử, ộ…)", () => {
  assert.deepEqual(kept("ĐẠI HIỆP"), ["Keo lá tràm"]);
  assert.deepEqual(kept("ung"), ["Gỗ tràm bông vàng"]);
  assert.equal(core.fold("Ửng Ộ Đ"), "ung o d");
});

test("chuỗi dạng tổ hợp (NFD, hay gặp khi dán từ Mac/PDF) vẫn khớp", () => {
  const nfd = "Keo lá tràm".normalize("NFD");
  assert.notEqual(nfd, "Keo lá tràm");
  assert.deepEqual(kept(nfd), ["Keo lá tràm"]);
  assert.equal(core.fold(nfd), core.fold("Keo lá tràm"));
});

test("khoảng trắng thừa đầu/cuối không làm mất kết quả", () => {
  assert.deepEqual(kept("  dam go  "), ["Dăm gỗ keo"]);
});

test("lọc nhiều giá trị so khớp không phân biệt dấu", () => {
  const f = createFilter(cfg);
  f.setField("dv", ["đh", "HAKQN"]);
  assert.equal(f.filter(rows).kept, 2);
});

test("100.000 dòng: lọc dưới 2 giây và không đổi dữ liệu nguồn", () => {
  const big = Array.from({ length: 100000 }, (_, i) => ({ ten: i % 7 ? "Dăm gỗ keo" : "Keo lá tràm", ncc: "NCC " + i, dv: i % 3 ? "HAK" : "ĐH" }));
  const before = JSON.stringify(big[12345]);
  const f = createFilter(cfg);
  f.setState({ q: "keo la tram" });
  f.setField("dv", ["ĐH"]);
  const t0 = process.hrtime.bigint();
  const res = f.filter(big);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const expected = big.filter((r, i) => i % 7 === 0 && i % 3 === 0).length;
  assert.equal(res.kept, expected);
  assert.equal(res.total, 100000);
  assert.equal(JSON.stringify(big[12345]), before);
  assert.ok(ms < 2000, `mất ${ms.toFixed(0)} ms`);
});

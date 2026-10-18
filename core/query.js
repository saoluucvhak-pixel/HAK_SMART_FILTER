// ===== HAK SMART FILTER — truy vấn có kiểu (V12) + ảnh chụp kết quả dùng chung (V11) =====
// Chuyển từ LUONG_HAK, nhánh feature/hak-shared-filter-report-v12 (HAK_SMART_FILTER/src/query-v12.js, smart-filter-adapter.js).
//
// 1) Truy vấn dạng cây AND/OR, chỉ cho phép trường + toán tử trong danh sách trắng → điều kiện lạ bị TỪ CHỐI (fail closed),
//    không bao giờ âm thầm bỏ qua làm sai tổng.
// 2) Quyền đọc (canRead) chạy TRƯỚC điều kiện người dùng; tổng "được phép xem" tách riêng tổng "khớp lọc".
// 3) Ảnh chụp (snapshot): màn hình, Excel, PDF, in dùng CÙNG một tập dòng + cùng mô tả điều kiện + cùng dấu vân tay
//    → so được "màn hình = Excel = PDF".
(function (root) {
  "use strict";
  var OPS = { eq: 1, ne: 1, gt: 1, gte: 1, lt: 1, lte: 1, contains: 1, in: 1, between: 1, empty: 1, notEmpty: 1 };
  var MAX_DEPTH = 12, MAX_CONDITIONS = 100;
  var OP_TEXT = { eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", contains: "chứa", in: "thuộc", between: "từ … đến", empty: "trống", notEmpty: "có dữ liệu" };

  function fold(x) { return String(x == null ? "" : x).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function isBlank(v) { return v === null || v === undefined || v === ""; }

  function fail(msg) { var e = new Error(msg); e.code = "HAK_FILTER_UNSUPPORTED"; return e; }

  /** Kiểm tra cây truy vấn; ném lỗi code HAK_FILTER_UNSUPPORTED nếu có trường/toán tử ngoài danh sách cho phép. */
  function check(node, allowed, depth) {
    depth = depth || 0;
    if (depth > MAX_DEPTH) throw fail("Bộ lọc lồng quá sâu");
    if (!node || typeof node !== "object") throw fail("Truy vấn không hợp lệ");
    if (node.logic) {
      if ((node.logic !== "AND" && node.logic !== "OR") || !Array.isArray(node.conditions) || !node.conditions.length || node.conditions.length > MAX_CONDITIONS)
        throw fail("Nhóm điều kiện không hợp lệ");
      node.conditions.forEach(function (x) { check(x, allowed, depth + 1); });
      return;
    }
    if (!allowed.has(node.field)) throw fail("Trường không được phép lọc: " + node.field);
    if (!OPS[node.op]) throw fail("Toán tử không hỗ trợ: " + node.op);
    if (node.op !== "empty" && node.op !== "notEmpty" && node.value === undefined) throw fail("Thiếu giá trị cho " + node.field);
    if ((node.op === "in" && !Array.isArray(node.value)) || (node.op === "between" && !(Array.isArray(node.value) && node.value.length === 2)))
      throw fail("Giá trị không đúng dạng cho toán tử " + node.op);
  }

  function evaluate(row, node) {
    if (node.logic) return node.logic === "AND" ? node.conditions.every(function (x) { return evaluate(row, x); }) : node.conditions.some(function (x) { return evaluate(row, x); });
    var a = row[node.field], b = node.value;
    switch (node.op) {
      case "empty": return isBlank(a);
      case "notEmpty": return !isBlank(a);
      case "eq": return a === b;
      case "ne": return a !== b;
      case "gt": return a != null && a > b;
      case "gte": return a != null && a >= b;
      case "lt": return a != null && a < b;
      case "lte": return a != null && a <= b;
      case "contains": return fold(a).indexOf(fold(b)) >= 0;
      case "in": return b.indexOf(a) >= 0;
      case "between": return a != null && a >= b[0] && a <= b[1];
    }
    throw fail("Toán tử không hỗ trợ: " + node.op);
  }

  function compare(field, dir) {
    return function (x, y) {
      var a = x[field], b = y[field], r;
      if (a == null && b == null) r = 0; else if (a == null) return 1; else if (b == null) return -1; // ô trống luôn xuống cuối
      else if (typeof a === "string" && typeof b === "string") r = a.localeCompare(b, "vi");
      else r = a < b ? -1 : a > b ? 1 : 0;
      return dir === "desc" ? -r : r;
    };
  }

  /**
   * Lọc theo cây truy vấn.
   * @param {Object[]} rows
   * @param {Object} query  {field, op, value} hoặc {logic:"AND"|"OR", conditions:[...]}
   * @param {{fields: string[], canRead?: function(Object):boolean, sort?: {field:string, direction:"asc"|"desc"}, page?: number, pageSize?: number}} opts
   */
  function queryRows(rows, query, opts) {
    opts = opts || {};
    if (!Array.isArray(rows)) throw new TypeError("rows phải là mảng");
    var allowed = new Set(opts.fields || []);
    check(query, allowed);
    var authorized = typeof opts.canRead === "function" ? rows.filter(opts.canRead) : rows.slice();
    var matched = authorized.filter(function (r) { return evaluate(r, query); });
    if (opts.sort) {
      if (!allowed.has(opts.sort.field) || (opts.sort.direction !== "asc" && opts.sort.direction !== "desc")) throw fail("Sắp xếp không hợp lệ");
      matched = matched.map(function (r, i) { return { r: r, i: i }; })
        .sort(function (x, y) { return compare(opts.sort.field, opts.sort.direction)(x.r, y.r) || x.i - y.i; }) // ổn định
        .map(function (x) { return x.r; });
    }
    var page = opts.page == null ? 1 : opts.page, size = opts.pageSize;
    if (!Number.isSafeInteger(page) || page < 1 || (size !== undefined && (!Number.isSafeInteger(size) || size < 1))) throw new RangeError("Trang không hợp lệ");
    return {
      rows: size ? matched.slice((page - 1) * size, page * size) : matched,
      allMatchedRows: matched, totalAuthorized: authorized.length, totalMatched: matched.length, query: query,
    };
  }

  /** Mô tả truy vấn bằng tiếng Việt — dùng chung cho chip, dòng kết quả, tiêu đề Excel/PDF. */
  function describeQuery(node, labels) {
    labels = labels || {};
    if (node.logic) {
      var parts = node.conditions.map(function (x) { var t = describeQuery(x, labels); return x.logic ? "(" + t + ")" : t; });
      return parts.join(node.logic === "AND" ? " và " : " hoặc ");
    }
    var name = labels[node.field] || node.field, v = node.value;
    if (node.op === "empty" || node.op === "notEmpty") return name + " " + OP_TEXT[node.op];
    if (node.op === "in") return name + " thuộc {" + v.join(", ") + "}";
    if (node.op === "between") return name + " từ " + v[0] + " đến " + v[1];
    return name + " " + OP_TEXT[node.op] + " " + (typeof v === "string" ? "“" + v + "”" : v);
  }

  /** Dấu vân tay ổn định của một tập dòng theo thứ tự (FNV-1a 32 bit trên giá trị cột khóa). */
  function fingerprint(rows, idField) {
    var h = 0x811c9dc5;
    for (var i = 0; i < rows.length; i++) {
      var s = String(idField ? rows[i][idField] : JSON.stringify(rows[i])) + "\u0001";
      for (var j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = Math.imul(h, 0x01000193) >>> 0; }
    }
    return ("0000000" + h.toString(16)).slice(-8) + ":" + rows.length;
  }

  /**
   * Ảnh chụp kết quả dùng chung cho màn hình / Excel / PDF / in.
   * Nhận một trong hai: {query, fields} (V12) hoặc {filter} (đối tượng từ createFilter của V10.3).
   * Trả về object đóng băng: rows (bản sao nông), scopeText, totals, fingerprint, takenAt.
   * Người xuất Excel/PDF chỉ đọc snapshot — không lọc lại — nên mọi nơi ra cùng một tập dòng.
   */
  function createSnapshot(input) {
    input = input || {};
    var rows = input.rows, res, scope;
    if (!Array.isArray(rows)) throw new TypeError("rows phải là mảng");
    if (input.query) {
      res = queryRows(rows, input.query, { fields: input.fields, canRead: input.canRead, sort: input.sort });
      scope = describeQuery(input.query, input.labels);
      res = { rows: res.allMatchedRows, total: res.totalAuthorized, kept: res.totalMatched };
    } else if (input.filter && typeof input.filter.filter === "function") {
      var authorized = typeof input.canRead === "function" ? rows.filter(input.canRead) : rows;
      var r = input.filter.filter(authorized, input.context);
      res = { rows: r.rows, total: authorized.length, kept: r.rows.length };
      scope = r.scope || "";
    } else throw new TypeError("Cần query+fields hoặc filter");
    var copy = res.rows.map(function (x) { return Object.freeze(Object.assign({}, x)); });
    return Object.freeze({
      rows: Object.freeze(copy), total: res.total, kept: res.kept, scopeText: scope || "Tất cả",
      fingerprint: fingerprint(copy, input.idField), takenAt: new Date().toISOString(),
    });
  }

  /** Kiểm tra một bản xuất (danh sách id theo thứ tự) có khớp snapshot không — dùng trong test "màn hình = Excel = PDF". */
  function sameAsSnapshot(snapshot, exportedRows, idField) {
    return fingerprint(exportedRows, idField) === snapshot.fingerprint;
  }

  var api = { OPS: Object.keys(OPS), check: check, evaluate: evaluate, queryRows: queryRows, describeQuery: describeQuery, fingerprint: fingerprint, createSnapshot: createSnapshot, sameAsSnapshot: sameAsSnapshot };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.query = api; }
})(typeof self !== "undefined" ? self : this);

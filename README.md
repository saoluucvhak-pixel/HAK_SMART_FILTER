# HAK Smart Filter v1.1.0

Thư viện lọc dữ liệu dùng chung cho các ứng dụng HAK. Core không yêu cầu DOM, Electron hoặc framework giao diện.

## API chính

`createFilter(config, options?)` tạo một phiên lọc độc lập. API gồm:
- `getState()`, `setState(state)`, `reset()`
- `setField(key, value)`, `removeCondition(condition)`
- `filter(rows, context?)` trả `{rows,total,kept,unsupported,state,scope}`
- `describe()`, `conditions()`, `subscribe(listener)`
- `savePreset(name, storage)`, `loadPreset(name, storage)`, `listPresets(storage)`

Cấu hình yêu cầu `screenId` và `fields`. Mỗi field có `key`, `type` (`multi`, `enum`, `bool`) và `match(row, selectedValue, context)`. Tìm kiếm dùng `matchQ(row, foldedQuery, context)`; lọc ngày dùng `matchDate(row, from, to, context)`.

## Ví dụ Node.js / Electron

```js
const { createFilter, core } = require("./index.js");
const filter = createFilter({
  screenId: "nhan-su",
  fields: [{
    key: "donVi", type: "multi", label: "Đơn vị",
    match: (row, selected) => core.inSet(selected, row.donVi)
  }],
  matchQ: (row, query) => core.hay([row.hoTen, row.maNV]).includes(query)
});
filter.setField("donVi", ["Đà Nẵng"]);
filter.setState({ ...filter.getState(), q: "nguyen" });
const result = filter.filter([
  { hoTen: "Nguyễn An", maNV: "NV01", donVi: "Đà Nẵng" },
  { hoTen: "Trần Bình", maNV: "NV02", donVi: "Quảng Nam" }
]);
console.log(result.rows, result.scope);
```

## Browser không bundler

Nạp `core/smart-filter.js` trước `browser.js`. API có tại `window.HAKSmartFilter.createFilter`.

## UI adapters

`ui/filter-popover.js` và `ui/smart-filter.js` là adapter UI kế thừa từ LUONG_HAK, hiện cần ứng dụng chủ cung cấp các hàm UI. Chúng **chưa** phải gói React/Vue hoặc custom element độc lập. Headless API có thể dùng không cần hai file này.

## Kiểm thử

```sh
npm run check
npm test
```

CI chạy trên Node.js 18, 20 và 22. Trạng thái phát hành phải căn cứ kết quả GitHub Actions mới nhất; chưa có xác nhận publish npm.

## An toàn và tương thích

- Bộ lọc không thay đổi dữ liệu nguồn hay công thức nghiệp vụ.
- Chế độ mặc định `strict` báo lỗi nếu có điều kiện không được cấu hình matcher; dùng `{strict:false}` chỉ khi ứng dụng có cơ chế hiển thị cảnh báo `unsupported`.
- Trạng thái được chuẩn hóa, từ chối khoảng ngày đảo ngược.
- Preset cần storage có `getItem`/`setItem`, có thể dùng localStorage hoặc adapter riêng.
- Không ghi dữ liệu nhân sự hoặc thông tin nhạy cảm vào repository.
- `private:true` trong package.json: chưa phát hành công khai lên npm; có thể dùng dependency GitHub sau khi CI đạt và gắn tag phát hành.

## Truy vấn có kiểu (V12) và ảnh chụp dùng chung — mới ở v1.1.0

Chuyển từ `LUONG_HAK`, nhánh `feature/hak-shared-filter-report-v12` (commit `b4aff3d`): `query-v12.js` và `smart-filter-adapter.js` gộp thành `core/query.js`.

```js
const { queryRows, createSnapshot, query } = require("@hak/smart-filter");

// Cây điều kiện AND/OR; chỉ trường trong `fields` mới được lọc — trường/toán tử lạ bị TỪ CHỐI, không âm thầm bỏ qua
const q = { logic: "AND", conditions: [
  { field: "ncc", op: "contains", value: "dai hiep" },             // không phân biệt dấu
  { logic: "OR", conditions: [{ field: "kl", op: "gte", value: 10 }, { field: "pb", op: "in", value: ["DN", "QN"] }] },
] };
const r = queryRows(rows, q, { fields: ["ncc", "kl", "pb"], canRead: row => quyen.has(row.pb), sort: { field: "kl", direction: "desc" }, page: 1, pageSize: 50 });
// r.totalAuthorized (được phép xem) ≠ r.totalMatched (khớp lọc)

// Ảnh chụp: màn hình, Excel, PDF, in đọc CÙNG một snapshot → cùng tập dòng, cùng mô tả điều kiện
const snap = createSnapshot({ rows, query: q, fields: [...], canRead, idField: "id", labels: { ncc: "Nhà cung cấp" } });
// hoặc từ bộ lọc V10.3: createSnapshot({ rows, filter: createFilter(cfg), canRead, idField: "id" })
query.sameAsSnapshot(snap, rowsDaXuatExcel, "id"); // true nếu bản xuất đúng y tập dòng & thứ tự
```

Toán tử: `eq ne gt gte lt lte contains in between empty notEmpty`. Giới hạn: lồng ≤ 12 cấp, ≤ 100 điều kiện mỗi nhóm.
`describeQuery(q, labels)` viết điều kiện bằng tiếng Việt cho chip, dòng kết quả và tiêu đề báo cáo.

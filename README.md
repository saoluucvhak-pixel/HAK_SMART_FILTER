# HAK Smart Filter v1.0.0

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

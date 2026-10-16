# HAK Smart Filter — tích hợp

Nguồn: `LUONG_HAK`, nhánh `feature/luong-hak-v10-4-enterprise-ui` (bản sao tham chiếu).

## Thành phần
- `core/smart-filter.js`: logic lọc dữ liệu.
- `ui/filter-popover.js`: giao diện popover.
- `ui/smart-filter.js`: toolbar, drawer, chips, preset và summary.

## Thứ tự nạp
1. `core/smart-filter.js`
2. `ui/filter-popover.js`
3. `ui/smart-filter.js`

Các module hiện dùng global `HAKCore.sf` và `HAKUI`; UI yêu cầu adapter `A` từ ứng dụng chủ (`h`, `btn`, `dateField`, `dateIso`, `toast`, `storage`). **Chưa phải thư viện độc lập có thể cài trực tiếp bằng npm.**

## Nguyên tắc an toàn
- Lọc chỉ thay đổi tập dòng hiển thị, không thay đổi dữ liệu nguồn hoặc công thức tính lương.
- Không lưu thông tin nhạy cảm trong preset.
- Kiểm thử riêng trên từng ứng dụng trước khi thay thế bản tích hợp hiện tại.
- Chỉ đồng bộ có kiểm soát, không tự động ghi ngược về `LUONG_HAK/main`.

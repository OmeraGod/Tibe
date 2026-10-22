# Omera trong Tibe

Mở **MỞ OMERA.bat**, dùng `http://127.0.0.1:5051/omera` để xem kênh và mở kịch bản vào bàn dựng. Cổng riêng giữ phiên Tibe 5050 đang dùng không bị gián đoạn. Launcher Tibe tiêu chuẩn vẫn dùng 5050. Tibe đọc kho Studio hiện có, không gọi API YouTube, không tạo tương tác và không tự thay trạng thái công khai.

Trang tổng quan đọc SQLite ở chế độ chỉ đọc, nạp lại kho mỗi 30 giây. Giữ riêng tổng Nội dung, Analytics, nguồn APV, tuổi video lúc đo, thông báo và ngày xử lý chỉ số kiếm tiền. Thiếu số liệu giữ trống; doanh thu chỉ hiện số nếu có tiền và kỳ báo cáo. Nạp kho không có nghĩa đã đọc Studio lần mới.

Nguồn mặc định là thư mục `App/Py-YT` bên cạnh thư mục `Website`. Có thể đặt biến môi trường `TIBE_OMERA_ROOT` hoặc tệp riêng `workspace/omera-config.json`:

```json
{"source_root": "đường dẫn tuyệt đối tới kho Py-YT trên máy của bạn"}
```

Nút **Dựng bản sao** tạo dự án Tibe mới. Hình và chữ là các lớp chỉnh sửa được, có chuyển động nhẹ. Kiểm tra SHA-256 của ảnh nguyên bản và giới hạn đường dẫn trước khi nhập. Kịch bản, biên nhận và video đã đăng được giữ nguyên. Timeline mới dùng thời lượng đề cương: chưa có giọng, nhạc và phụ đề theo từ; cần tạo giọng, căn thời gian và duyệt bản xuất trước đăng. Không gọi bản này là video đã hoàn tất hoặc đã đăng.

Bản trên GitHub Pages chỉ có trình dựng trong trình duyệt. Giữ số liệu kênh, dự án cá nhân, mô hình và khóa ở máy. Không mở bộ xử lý Flask ra Internet; GitHub Pages không chạy Python/FFmpeg/mô hình giọng. Xuất WebM dùng trình duyệt; giọng Việt ngoại tuyến và xuất MP4 dùng bản trên máy. Để triển khai Pages, chọn Settings → Pages → Source → GitHub Actions trong kho, rồi chạy workflow Publish browser editor.

Các giới hạn xuất bản vẫn giữ trong `PUBLISHING.md` và chính sách của kho Omera. Tibe là bàn dựng; mở dự án không đồng nghĩa cho phép đăng lại video cũ.

# tibe · Omera Studio

Trình dựng video trên máy và trong trình duyệt, kèm không gian theo dõi kênh Omera.

- Chạy **MỞ TIBE.bat**, mở **http://127.0.0.1:5050/omera**.
- Theo dõi lượt xem, đăng ký, tiến độ kiếm tiền và hiệu suất từng tập từ kho số liệu đã xác minh.
- Mở kịch bản thành dự án Tibe mới: hình và chữ chỉnh riêng trên timeline, không sửa video đã đăng.
- Tạo giọng Việt trên máy, dựng, xem thử và xuất video với công cụ Tibe có sẵn.
- Bản GitHub Pages chỉ chứa trình dựng trong trình duyệt; không có dữ liệu kênh, khóa, tài khoản, mô hình hoặc dự án cá nhân.

[Hướng dẫn Omera](docs/OMERA.md) · [Hướng dẫn đầy đủ](README_HUONG_DAN.md) · [Nguồn và giấy phép](THIRD_PARTY_NOTICES.md)

## GitHub Pages

Trong kho, chọn **Settings → Pages → Source: GitHub Actions**, rồi chạy **Publish browser editor**. Workflow chỉ đóng gói HTML/CSS/JavaScript và thư viện assets được cung cấp. Không chạy bộ xử lý Python, FFmpeg hay giọng ngoại tuyến trên GitHub Pages.

## Phát triển

Python 3.10+ với `requirements.txt`, FFmpeg/FFprobe trong PATH. Hướng dẫn bộ giọng và Node/REA ở tài liệu đầy đủ. Dùng `python -m unittest discover -s tests -p test_omera_hub.py` để kiểm tra cầu nối; `python scripts/build_pages.py` để chuẩn bị trang tĩnh.

Tibe không bảo đảm lượt xem hay thu nhập. Việc xuất video không tự đăng lên YouTube. Số liệu chưa đọc được luôn được giữ trống.

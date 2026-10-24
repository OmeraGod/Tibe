# tibe · Omera Studio

Trình dựng video trên máy và trong trình duyệt, kèm không gian theo dõi kênh Omera.

**[Mở trình dựng trên web](https://omeragod.github.io/Tibe/)** · **[Không gian Omera trên máy](http://127.0.0.1:5051/omera)**

- Chạy **MỞ OMERA.bat**, mở **http://127.0.0.1:5051/omera**. Bản Tibe tiêu chuẩn vẫn có ở **MỞ TIBE.bat** / cổng 5050.
- Theo dõi lượt xem, đăng ký, tiến độ kiếm tiền và hiệu suất từng tập từ kho số liệu đã xác minh.
- Mở kịch bản thành dự án Tibe mới: hình và chữ chỉnh riêng trên timeline, không sửa video đã đăng.
- Tạo giọng Việt trên máy, dựng, xem thử và xuất video với công cụ Tibe có sẵn.
- Bản GitHub Pages chỉ chứa trình dựng trong trình duyệt; không có dữ liệu kênh, khóa, tài khoản, mô hình hoặc dự án cá nhân.

[Hướng dẫn Omera](docs/OMERA.md) · [Hướng dẫn đầy đủ](README_HUONG_DAN.md) · [Nguồn và giấy phép](THIRD_PARTY_NOTICES.md)

## Omera Batch Studio — 3.6.0

Chạy **MỞ TIBE.bat**, mở **http://127.0.0.1:5050/batch**. Nhập 1–20 kịch bản hoặc nhiều thư mục tư liệu; một bài tạo ba bản 34/42/68 giây. Hàng đợi chạy trên máy chủ với xem thử riêng, tiến trình, hủy/thử lại, tải MP4 và mở tiếp vào editor.

- Bốn bố cục Cinema Glass/Bento, bốn widget, hook chuyển động và phụ đề karaoke.
- Giọng Việt theo từng cảnh, cắt khoảng lặng, nhạc ducking và SFX đồng bộ.
- Xuất production **1080×1920/60fps H.264/AAC**; có nháp 540p/30fps. 60fps là tốc độ phát của tệp, không phải cam kết tốc độ dựng thời gian thực.
- Bộ dựng nền/giọng/MP4 cần bản cục bộ; GitHub Pages chỉ chạy trình chỉnh sửa trong trình duyệt.
- Phụ đề tự chia thời gian là ước lượng khi chưa có mốc từ; MD5/biến thiên hình không bảo đảm tránh nhận diện trùng hoặc tăng lượt xem.

[Hướng dẫn Batch và danh sách từng tệp](docs/OMERA_BATCH_ENGINE.md) · [Năm kịch bản mẫu](docs/examples/batch_projects.json) · [Kết quả kiểm thử](docs/OMERA_VERIFICATION.md)

## GitHub Pages

Trong kho, chọn **Settings → Pages → Source: GitHub Actions**, rồi chạy **Publish browser editor**. Workflow chỉ đóng gói HTML/CSS/JavaScript và thư viện assets được cung cấp. Không chạy bộ xử lý Python, FFmpeg hay giọng ngoại tuyến trên GitHub Pages.

## Phát triển

Python 3.10+ với `requirements.txt`, FFmpeg/FFprobe trong PATH. Hướng dẫn bộ giọng và Node/REA ở tài liệu đầy đủ. Dùng `python -m unittest discover -s tests -p test_omera_hub.py` để kiểm tra cầu nối; `python scripts/build_pages.py` để chuẩn bị trang tĩnh.

Tibe không bảo đảm lượt xem hay thu nhập. Việc xuất video không tự đăng lên YouTube. Số liệu chưa đọc được luôn được giữ trống.

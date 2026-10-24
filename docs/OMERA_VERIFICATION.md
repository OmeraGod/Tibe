# Xác minh Omera Batch 3.6.0 — 24/10/2026

- 50 kiểm tra Python đạt: backend, lưu dự án, Concat, giọng đọc, runtime tích hợp, Omera Hub và Batch.
- Toàn bộ bộ kiểm tra JavaScript đạt; kiểm tra Omera bao gồm pixel thật của bốn bố cục/bốn widget, chuyển động, nối vòng, mốc từ, nguồn phụ khi cắt/dời/xóa cảnh và controller nhập lô/xem thử.
- Năm kịch bản mẫu biên dịch thành 15 biến thể. Kiểm tra queue xác nhận lỗi/hủy một tác vụ không khởi chạy nhầm hoặc chặn vĩnh viễn mục khác.
- Hai MP4 thử A/B: 1080×1920, 60fps, mỗi bản 1 giây, BT.709, AAC 48kHz, có giọng Việt VieNeu và SFX.
- Một bản C hoàn chỉnh: 68 giây, nháp 540×960/30fps, BT.709, AAC 48kHz. Có giọng từng cảnh, RMS thật, nửa phân tích 0.6× và kính lúp. Mốc chữ nằm trong thời lượng giọng từng cảnh.
- Một tác vụ thử gửi qua HTTP rồi để máy chủ chạy độc lập: video nguồn ngang 640×360 vào Bento, xuất 1080×1920/60fps dài 0.5 giây; hoàn tất, có AAC và metadata đúng.
- MD5 tính lại trên cả bốn tệp khớp manifest, các bản có mã riêng. HTTP tải MP4 hỗ trợ attachment và byte range 206.
- Các trang /batch, /omera, script, stylesheet và font mới đã trả HTTP 200; API báo phiên bản 3.6.0 và bộ giọng Việt khả dụng. Hai bản HTML Flask/standalone đồng nhất.

Lô kiểm tra mở rộng (hai preview 1080p + một bản C 68 giây nháp, có TTS) mất khoảng 346 giây trên máy kiểm tra. Đây là phép đo tác vụ cụ thể; không suy ra mọi video đều cùng tốc độ. 60fps là tốc độ phát tệp, không phải tốc độ dựng theo thời gian thực.

Chưa kiểm tra thao tác và bố cục trang trực tiếp trong trình duyệt vì công cụ trình duyệt chưa được cấp truy cập trang cục bộ. Đã kiểm tra controller, HTTP, Canvas native/pixel, FFmpeg và xem ảnh trích từ MP4. Phụ đề tự chia thời gian vẫn là ước lượng nếu không có mốc từ; sửa lời dẫn trong editor không tự sinh lại WAV cũ.

Nhật ký máy hiện tại: `.runtime/omera-regression-python.log`, `.runtime/omera-regression-js.log`, `.runtime/omera-verified-outputs.json`. Tệp video và tư liệu QA nằm trong `workspace/batch`; chúng không được đưa vào ZIP mã nguồn. Hướng dẫn và danh sách tệp tại `docs/OMERA_BATCH_ENGINE.md`.

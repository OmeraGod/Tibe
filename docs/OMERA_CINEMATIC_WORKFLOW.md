# Quy trình dựng Omera — SOP3,24/10/2026

Quy trình hiện hành và biên nhận nằm tại kho Omera gốc, mặc định `E:/Dev_code/App/Py-YT`:

- `data/PRODUCTION_SOP.md`: hướng dẫn chủ đạo.
- `data/production-sop.json` và `data/content-generation-policy.json`v3: quy tắc máy đọc.
- `data/tibe-cinematic-profile.json`: ID và trường Tibe đúng choFilter/Effect/Mask/Keyframe/Audio.
- `data/CINEMATIC_QA.md`: bằng chứng và cách đo bản xuất cuối.

Không sao chép dữ liệu kênh vào Tibe/GitHub. Không coi hồ sơ cấu hình là video đã dựng hoặc đã duyệt.

## Dựng và duyệt

1. Dùng cảVideo,Overlay,Text,Sticker vàAudio có mục đích. Cảnh nền được grade Điện ảnh/Retro60–80%, live effect tinh tế15–25%, keyframePosition/Scale/Rotation0,5–1,5độ; Hero/Montage dành cho video chuyển động thật.
2. Thay thông tin hữu ích trong tối đa4giây. A/B đồng thời dùngOverlayMaskSplit/Rectangle/Circle vớiFeather mềm, nhãn và mũi tên rõ; chỉ đổi một biến. Grain không được dùng thay cho nội dung.
3. Hành động: hard cut/wipe0,2–0,3s. Hồi ức/tâm lý: dissolve/fade-black/blur-mix0,5–0,8s. Không che điểm cắt cần kiểm chứng.
4. Karaoke hoặc≤4từ/dòng, trongsafezone, tránh sơ đồ. Thuật ngữ ở1/3trên bằngHeading/Badge/Neon và cue đi kèm. Giữheader/footer thương hiệu.
5. VieNeu local48kHz,trim đầu/cuối câu. Nhạcduck28%/120ms. Hook có cue0–0,5s; A/B/mũi tên cóWhoosh/Click đúng khung. MP4cuối−16,0LUFS,TruePeak≤−1,5dBTP.
6. XuấtMP4H.264/AAC48kHz/BT.709,1080p;Shorts60fps. Kiểm full decode vàhashproject/MP4, xem hình/chuyển động mọi cảnh, nghe/duyệt đúng phạm vi. Giữ nháp nếu thiếu bằng chứng.

Đường xuấtnative trong bộ tích hợpPy-YT hiện từ chốiSticker: bản5track dùng bộ xuất trình duyệtTibe. Không coi tất cả shader trong thư viện đã được duyệt xuất. Bộ trộn mặc định chưa tự bảo đảm loudness/BT.709; kiểm MP4cuối và sửa/xuất lại nếu cần. Không đồng bộ ghi đè mã live bằng bản tích hợp khác phiên bản.

## Đóng gói

Video dài5–8phút: tình huống+A/B0–25s; ba tầng giải mã; thumbnail riêng1920×1080/3–6từ; tiêu đề neo điện ảnh, mô tả+mục lục+nguồn+AI, đúng15tags vàplaylistchínhthức. Shorts30–36s: CTA chỉ5giâycuối, RelatedVideo trỏ bài dài đúng chủ đề vàplaylist; xác nhận đã lưu trongStudio.

Trước tải/công khai, `production_store.py` ở kho gốc phải qua cả`check_policy`và`check_requirements`đúng giai đoạn. Ngân sách0, tối đa2video/ngàyVN,cách6giờ,trầnđợt14, không đăng bù. Không tự tạo lượt xem/đăng ký/giờ xem.

# Giọng đọc tích hợp trong tibe 3.5

## Sử dụng

1. Mở `MỞ TIBE.bat`, vào Audio → Tạo giọng đọc (hoặc Text → Văn bản thành giọng nói).
2. Giữ bộ **Giọng Việt tự nhiên · trên máy**, chọn giọng, nhập nội dung tối đa 5.000 ký tự. Có thể lấy chữ đang chọn hoặc chèn `[nghỉ 1s]`.
3. Bấm Tạo giọng đọc, nghe thử, tải WAV hoặc Thêm vào video. Tệp chèn vào track âm thanh ở vạch phát, có waveform thật.

Không cần cài hay kết nối CIT. tibe trực tiếp gọi SDK VieNeu trong môi trường do ứng dụng quản lý, không dùng cổng máy chủ giọng riêng. Dùng 25 giọng từ danh sách mô hình đã cài trên máy này; không tạo giả tên giọng. Chọn giọng quyết định phong cách đã có của giọng đó.

## Mô hình và dữ liệu

- SDK khóa `vieneu==3.8.3`; v3 Turbo chạy ONNX CPU, xuất WAV mono PCM 16 bit / 48 kHz. Nguồn: [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS), [gói mô hình](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo).
- Môi trường tại `.runtime/voice-env`, mô hình tại `.runtime/models`, trạng thái giọng tại `.runtime/local-voice.json`. Đã tải sẵn trên máy hiện tại. Khi cài từ ZIP trên máy mới, tibe tự chuẩn bị trong nền và cần Internet lần đầu. Không có khóa API.
- Khi tạo giọng Việt, worker bật `HF_HUB_OFFLINE=1` và `TRANSFORMERS_OFFLINE=1`. Văn bản không được gửi sang dịch vụ TTS bên ngoài. Không tự đổi sang Edge khi lỗi.
- Tốc độ 0,75×–1,50× áp dụng bằng FFmpeg `atempo`. Thẻ nghỉ hỗ trợ s/ms, tối đa 10 giây/thẻ. Nội dung khác được giao cho mô hình; không bảo đảm mọi thẻ cảm xúc đều có tác dụng.
- Lịch sử tối đa 50 mục tại `workspace/tts/voice_<id>.json` và WAV, còn sau khi khởi động lại. Đóng hộp thoại dừng nghe thử, tác vụ đang tạo có thể hoàn tất. Track khóa không nhận thêm clip.

## Đa ngôn ngữ

Chọn một trong 10 ngôn ngữ lời đọc. Ngoài tiếng Việt, ứng dụng chọn Edge TTS qua Internet; nội dung được gửi tới Microsoft để tổng hợp. Danh mục lưu 322 giọng thực tế và lọc theo ngôn ngữ, không có nghĩa mọi giọng được thử từng cái hay luôn sẵn sàng từ nhà cung cấp. Đây chưa phải dịch tự động nội dung sang ngôn ngữ khác. Nút đổi ngôn ngữ giao diện đã được bỏ theo yêu cầu ở bản 3.5.

## Kiến trúc và kiểm tra

`LocalVoice` gọi worker bằng subprocess trong môi trường riêng. `/api/tts/providers` mặc định chỉ lấy bộ giọng tích hợp và Edge, không tìm hoặc gọi CIT. Adapter CIT cũ chỉ còn cho tương thích API khi gọi rõ `legacy=1`; giao diện hiện tại không sử dụng nó. Concat và REA cũng không có biểu mẫu kết nối.

`POST /api/tts/jobs` tạo tác vụ; `GET /api/tts/jobs/<id>` đọc tiến trình; `GET /api/tts/history` đọc lịch sử. Mỗi lúc có một tác vụ tạo giọng. Kết quả chỉ được đưa vào lịch sử sau khi WAV và metadata đã ghi thành công.

Đã chạy tạo giọng Việt thật ngoại tuyến ở thư mục dự án hiện tại; kiểm tra tự động có tạo/chuyển WAV, điều chỉnh tốc độ, lưu lịch sử, lỗi không chuyển bộ giọng và chèn clip qua controller thật. Chưa kiểm tra trực tiếp UI trình duyệt do công cụ không được phép truy cập trang. Nhân bản giọng, hội thoại nhiều người và dịch phụ đề chưa được tích hợp.

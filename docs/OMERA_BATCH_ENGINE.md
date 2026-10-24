# Omera Batch Engine — tibe 3.6.0

Bản nâng cấp bổ sung bộ sản xuất video dọc vào tibe hiện có. Trình chỉnh sửa, thư viện dự án, giọng Việt, hiệu ứng/grade/chuyển cảnh hiện có và Omera Hub tiếp tục dùng chung ứng dụng. Batch chạy bằng tiến trình Node/Canvas trên máy chủ, không phụ thuộc việc giữ tab ở phía trước.

## Mở và dùng

1. Chạy **MỞ TIBE.bat** hoặc **MỞ OMERA.bat**, giữ máy chủ đang chạy. Omera Hub mở mặc định; bấm **Batch Studio**, hoặc truy cập `http://127.0.0.1:5050/batch`.
2. Bấm **5 bài mẫu** để tìm hiểu. Thay ảnh, lời dẫn, thông số và thiết bị bằng nội dung thật của bạn. Mẫu dùng ảnh minh họa, không phải cảnh quay sản phẩm thực tế.
3. **Nhập JSON** nhận một kịch bản, mảng 1–20 kịch bản hoặc `{ "media": {...}, "projects": [...] }`. Tệp mẫu có sẵn ở `docs/examples/batch_projects.json`.
4. Với tư liệu trên ổ đĩa, bấm **Thêm thư mục**. Chọn thư mục cha chứa nhiều thư mục con hoặc thêm từng thư mục. JSON và các tệp được chọn cùng nhau sẽ liên kết theo đường dẫn tương đối. Mục `file` được tải vào thư viện của tibe; không đọc đường dẫn hệ thống tùy ý từ JSON.
5. Không có JSON: mỗi thư mục có ảnh/video tạo một bài Before/After. Tên có `before`/`truoc`, `after`/`sau` được ưu tiên; nếu không sẽ dùng hai tệp đầu. Chỉnh lời dẫn ở **Chỉnh JSON** rồi bấm **Nạp nội dung JSON**.
6. Bấm **Xem thử 3 giây** trên từng bài. Đây là tác vụ nháp riêng 540×960/30fps; chỉ tác vụ xem thử mới được chạy, không kéo các bản đầy đủ khác vào xuất.
7. Chọn A/B/C, chọn chất lượng, bấm **Render All Batch**. 5 bài × 3 biến thể tạo 15 tác vụ. Tối đa 20 bài/lô và 60 bản chưa hoàn tất. Xuất tuần tự giúp giới hạn bộ nhớ.
8. Từng tác vụ có tiến trình, Hủy, Thử lại, Xem video, tải MP4/manifest và **Mở trong editor**. Tắt tab không dừng xuất. Tắt máy chủ/máy tính sẽ gián đoạn; mở lại rồi bấm Thử lại. Tác vụ dở không tự âm thầm khởi chạy.

## Cài đặt trên máy khác

Cần Python 3.10+, Node.js tương thích `package.json`, FFmpeg và FFprobe trong PATH. Lần mở đầu cần Internet để tải thư viện và mô hình giọng. `start_studio.py` chuẩn bị Canvas ở luồng nền qua `npm ci` theo lockfile nếu thư viện chưa có; tiến trình này ghi `.runtime/omera-setup.log`. Nếu thiếu npm, cài Node.js LTS rồi mở lại. Có thể chuẩn bị thủ công bằng `npm ci`. Máy hiện tại đã có Canvas và bộ giọng Việt.

ZIP chứa mã nguồn, font, SFX và giấy phép; không chứa `node_modules`, `.runtime`, mô hình hay video/dự án riêng của bạn. Batch cần máy chủ; mở HTML độc lập không có tiến trình xuất nền. Không có màn hình kết nối CIT/Concat/REA riêng cho bộ dựng này.

## Thiết kế và chuyển động

- Tư liệu chính phủ nền ngay khung đầu, không có màn mở đen. Màu nguồn tăng contrast 1.06 và saturation 1.10. Hình tối từ nguồn vẫn cần bạn chỉnh ánh sáng, không có AI tự phục hồi vùng cháy/tối.
- Thẻ kính lấy mẫu nội dung thực ở phía sau, blur tương đương 18px, nền slate 55%, viền cyan, bóng sâu. Thẻ/badge/widget có chuyển động đàn hồi và fade vào/ra.
- Yêu cầu ghi bốn preset nhưng liệt kê ba. Bản này bổ sung **BENTO_HERO_GLASS** làm preset thứ tư, bên cạnh **BENTO_SPLIT_VERTICAL**, **BENTO_PIP_DIAGRAM**, **BENTO_TRIPLE_GEAR**.
- Mở đầu: zoom 1.25→1 trong 0.4s theo cubic-bezier(0.16,1,0.3,1), glow nhẹ, hook ở trung tâm và whoosh. Các cảnh dài có microzoom/HUD theo nhịp 2.5s.
- Font Plus Jakarta Sans và Playfair Display được đóng gói tại chỗ, không cần Google Fonts khi phát/xuất.
- Karaoke chia tối đa bốn từ/cụm; từ đang đọc nhấn 1.12×, màu ngọc hoặc vàng. Nếu từ/cụm quá rộng, chữ tự thu nhỏ vừa vùng an toàn.
- Pop thẻ -14dB; swish/shutter -12dB; chuông Follow -14dB. Đây là gain theo mẫu SFX, không phải cam kết mức LUFS sau khi trộn nhiều nguồn. Năm âm thanh được tổng hợp riêng bằng `build_omera_sfx.py`.

## Ba bản xuất từ một bài

- **A — Variant_A_Shorts_Loop.mp4:** mặc định 34s, cho phép 32–36s. Có Subscribe và hòa 0.6s cuối về đúng khung đầu. Đây là nối hình; âm thanh không có bảo đảm nối vòng ở mọi nguồn nhạc.
- **B — Variant_B_Reels_FollowGate.mp4:** mặc định 42s, cho phép 38–45s. Nhắc theo dõi ở giây 14; thẻ sơ đồ/gợi ý thiết bị ở sáu giây cuối. Không khóa nội dung và không tự đăng hay mở Shopee.
- **C — Variant_C_WatchTime_65s.mp4:** mặc định 68s, cho phép 65–75s. Nửa đầu trình bày kết quả; nửa sau lặp các cảnh ở 0.6×, có kính lúp và lời `analysis`. Nên viết phân tích riêng thay vì lặp lại câu cũ. Thời lượng trên một phút không bảo đảm Facebook ghi nhận chỉ số xem, phân phối hay đủ điều kiện kiếm tiền.

`scene.duration` là **trọng số phân bổ** trong thời lượng cố định của từng biến thể. Ví dụ hai cảnh có trọng số 2 và 3 sẽ nhận 40% và 60% thời lượng chính. Với C, tỷ lệ đó áp dụng trong từng nửa. `sourceIn` tính bằng giây nguồn; `speed` áp dụng nửa chính, nửa phân tích dùng 0.6. Nếu nguồn ngắn, video được lặp và hàng đợi hiện cảnh báo. Điểm vào vượt cuối nguồn bị từ chối.

## JSON và tư liệu

```json
{
  "projects": [{
    "id": "bai_anh_sang",
    "title": "Ánh sáng cửa sổ",
    "brand": "Omera Studio",
    "hook": "Chỉ đổi hướng sáng, khung hình khác hẳn.",
    "gift": "Sơ đồ góc máy · Tripod và đèn LED",
    "captionColor": "#2DD4BF",
    "durations": {"A": 34, "B": 42, "C": 68},
    "media": {
      "before": {"type": "image", "file": "before.jpg"},
      "after": {"type": "video", "file": "after.mp4"},
      "diagram": {"type": "image", "file": "diagram.png"},
      "gear": {"type": "image", "file": "tripod.png"},
      "music": {"type": "audio", "file": "music.wav"}
    },
    "musicId": "music",
    "narration": {"generate": true, "voice": "Hải Đăng"},
    "scenes": [{
      "mediaId": "after",
      "beforeId": "before",
      "diagramId": "diagram",
      "gearId": "gear",
      "layout": "BENTO_SPLIT_VERTICAL",
      "duration": 4,
      "sourceIn": 0,
      "speed": 1,
      "caption": "Đưa ánh sáng về phía trước chủ thể.",
      "analysis": "Nhìn hướng bóng đổ để tìm vị trí sáng phù hợp.",
      "settings": "Cửa sổ 45° · Tiêu cự 2× · Khóa EV",
      "gear": "Tripod gọn, giữ máy ổn định",
      "widgets": [{"type": "PhoneGridHUD", "start": 3, "duration": 3}]
    }]
  }]
}
```

Thay `file` bằng `url` khi tư liệu đã nhập: `assets/demo/<tên-tệp>`, `/workspace/uploads/<tên-tệp>`, `/workspace/tts/<tên-tệp>`. Không chấp nhận URL Internet, đường dẫn `C:/...` hoặc truy cập thư mục ngoài thư viện. Các `mediaId`, `beforeId`, `diagramId`, `gearId`, `musicId` và widget `mediaId` tham chiếu khóa trong `media`. `beforeId` bắt buộc với split và AB slider. Sơ đồ PIP có thể dùng ảnh/video thật; khi chưa có, hiện sơ đồ ánh sáng 45° minh họa được ghi nhãn.

## Giọng và phụ đề

- `narration.generate: true` không có `text`/`mediaId`: tạo giọng Việt **từng cảnh** từ `caption`, và từ `analysis` ở nửa sau C, đặt đúng thời điểm bắt đầu cảnh. Cảnh đầu tăng tốc phần mở đầu; các cảnh sau không tăng tốc lặp lại.
- `narration.generate: true` kèm `text`: tạo một lời đọc toàn bài. Hoặc cung cấp `narration.mediaId` tham chiếu âm thanh/video có lời đọc. Đây là nguồn ưu tiên so với sinh giọng từng cảnh.
- Giọng được cắt khoảng lặng trên 140ms theo ngưỡng -42dB; ba giây đầu của lời toàn bài/cảnh đầu tăng 1.15×. Giữ phần nghỉ ngắn để tránh nối âm quá cứng. Có cache theo nội dung, giọng và quy trình xử lý.
- Lời đọc dài hơn phần thời gian được cấp sẽ báo lỗi rõ ràng; rút nội dung hoặc tăng trọng số cảnh, không âm thầm cắt mất câu.
- Phụ đề từng cảnh sinh tự động được phân bổ trong thời lượng giọng thực, theo độ dài từ. Đây là **ước lượng**, chưa có forced alignment/ASR theo âm vị. Toàn bài dùng thời gian chia theo cảnh nếu chưa cung cấp mốc.
- Muốn chính xác, thêm `words` vào cảnh, ví dụ `[{"text":"Ánh","start":0.1,"end":0.35},{"text":"sáng","start":0.35,"end":0.7}]`. Các mốc tính bằng giây tương đối từ đầu cảnh đã biên dịch, tăng dần, không chồng nhau; mốc vượt thời lượng cảnh của bất kỳ biến thể được chọn sẽ bị từ chối. Nửa phân tích C tạo mốc riêng từ lời `analysis`.
- Nhạc lặp vừa thời lượng, giảm âm khi có giọng. Âm thanh gốc video hình được tắt trong preset để ưu tiên lời dẫn/nhạc; muốn dùng lời gốc hãy chọn nó làm `narration.mediaId`. Meter HUD lấy đường bao RMS thật của lời đọc đã xử lý, không tạo sóng ngẫu nhiên.

## Bốn widget dùng lại qua JSON

Mỗi widget trong `scene.widgets` có `type`, `start` và `duration` tính bằng giây trong cảnh. Tối đa 12 widget/cảnh. Chúng được ghi trực tiếp lên pixel của video:

- **ABCompareSlider:** quét ảnh/video `beforeId` sang `mediaId`, đường chia và tay nắm chuyển động; cần `beforeId`.
- **PhoneGridHUD:** lưới 9 ô, khung lấy nét, mức 0.5×/1×/2×/3×, EV động và meter giọng nếu có.
- **FollowPulseToast:** nhắc theo dõi `brand`, hoạt ảnh mô phỏng bấm nút chuyển xanh. Sự kiện ở B có chuông tự động. Đồ họa trong MP4 **không phải nút tương tác của mạng xã hội**, không thực hiện Follow thật.
- **GearShowcaseCard:** dùng widget `mediaId` hoặc cảnh `gearId`, mô tả `title`/`scene.gear`, lời tặng `gift` và mũi tên bình luận. Bạn tự cung cấp ảnh và thông tin thiết bị chính xác.

## Chỉnh tiếp trong editor

**Mở trong editor** tạo một bản timeline độc lập, có tư liệu, SFX, nhạc và giọng đã sinh. Bấm cảnh, chỉnh **Omera · Bento** trong bảng thuộc tính: phụ đề, bố cục, thông số và thiết bị. Có thể cắt/dời/nhân đôi cảnh, đổi nguồn, thêm text/sticker/lớp phủ rồi lưu `.clipcut`. Video phụ của Bento được giữ đồng bộ khi retime/split/delete và ẩn khỏi danh sách track cho dễ đọc. Xuất Omera mặc định 1080p/60fps.

Sửa chữ không tự sinh lại WAV cũ; dùng hộp Giọng đọc để tạo lại và thay đoạn tiếng, hoặc sửa JSON nguồn rồi xuất lô mới. Nút thử từ JSON phản ánh bản biên dịch mới; bản timeline đã chỉnh là bản riêng. Các điều khiển transform/mask/effect cũ không áp trực tiếp lên cảnh Omera; có thể đặt lớp phủ/clip thường để dùng bộ công cụ đó.

## Xuất, hiệu năng và phục hồi

Chất lượng **production**: 1080×1920, 60fps, H.264 yuv420p BT.709, âm thanh AAC 48kHz, MP4 faststart. **draft**: 540×960/30fps. FFmpeg đọc video theo luồng raw RGBA; Canvas vẽ font/thẻ/widget; FFmpeg mã hóa, sau đó pipeline chung trộn giọng/nhạc/SFX. Tái dùng ảnh đã grade, lớp blur giảm mật độ, bóng đổ và giới hạn cache ảnh 12 nguồn để giảm chi phí.

**60fps là tốc độ khung hình của tệp, không phải cam kết xuất 60 khung/giây theo thời gian thực.** Thời gian dựng phụ thuộc máy, độ phân giải, số video giải mã và hiệu ứng. Dùng xem thử/draft trước khi xuất 5–20 bài. Máy chủ cần tiếp tục chạy, máy không ngủ; không có dịch vụ đám mây.

Mỗi tác vụ ở `workspace/batch/<id>/` có `spec.json`, `job.json`, nhật ký worker, MP4 và `manifest.json`. ID, seed, grain nhẹ, micro-pan và metadata khác nhau; manifest ghi MD5 để đối chiếu tệp. Các thay đổi này **không bảo đảm tránh nhận diện trùng nội dung**, không thay thế kịch bản/tư liệu nguyên gốc, không bảo đảm tăng retention/lượt xem hay điều kiện nền tảng. Nguồn bên ngoài và dữ liệu kênh không bị đăng/sửa tự động.

## Danh sách tệp mới

- `batch_engine.py`: nhập/kiểm tra tư liệu, biên dịch kế hoạch, hàng đợi lưu ổ đĩa, hủy/thử lại, điều phối worker, trộn tiếng, xác nhận MP4 và manifest.
- `omera_audio.py`: cắt khoảng lặng, tăng tốc hook, cache giọng và RMS thật.
- `templates/batch.html`: UI nhập lô, chất lượng, biến thể, tiến trình, xem/tải kết quả.
- `assets/css/omera-batch.css`: theme sáng, thẻ kính, nút nổi, layout responsive và hộp xem video.
- `assets/js/omera-batch-ui.js`: nhập JSON/thư mục, upload, liên kết tư liệu, xem thử riêng, chạy/hủy/thử lại và theo dõi hàng đợi.
- `assets/js/omera-studio-core.js`: schema, bốn preset, ba biến thể, spring/easing, mốc chữ, event/SFX và chuyển sang timeline.
- `assets/js/omera-studio-canvas.js`: bộ vẽ chia sẻ, bố cục Bento, kính, karaoke, hook, loop, grain và bốn widget.
- `assets/js/omera-studio-editor.js`: đồng bộ kế hoạch với timeline/nguồn video phụ và mở bài batch trong editor.
- `scripts/omera_render_worker.cjs`: giải mã video theo luồng, vẽ từng khung, mã hóa H.264 và gửi tiến trình.
- `scripts/prepare_omera.py`: tự chuẩn bị dependency Canvas theo lockfile ở lần mở đầu.
- `scripts/build_omera_sfx.py`: sinh năm âm thanh gốc có thể tái tạo.
- `scripts/check_omera_batch.py`: kiểm tra xuất thật; `--extended` thêm giọng Việt và C đủ 68 giây.
- `tests/omera-studio.test.cjs`: kiểm tra pixel, chuyển động, widget, bố cục, nối vòng, mốc từ và nguồn phụ khi sửa timeline.
- `tests/omera-batch-ui.test.cjs`: gọi controller thật để kiểm tra nạp năm bài, gửi 15 tác vụ, xem thử riêng và giữ đầu vào khi JSON lỗi.
- `tests/test_omera_batch.py`: kiểm tra queue, lỗi/hủy/khởi động lại, ranh giới dữ liệu, API và FFmpeg âm thanh thật.
- `assets/fonts/PlusJakartaSans-Variable.ttf`, `PlayfairDisplay-Variable.ttf`, hai tệp OFL và `SOURCES.json`: font/giấy phép/nguồn/hash.
- `assets/sfx/whoosh_bass_hit.wav`, `pop_soft.wav`, `camera_shutter.wav`, `swish_transition.wav`, `bell_ding.wav`, `SOURCES.json`: âm thanh dựng.
- `third_party/napi-rs-canvas/LICENSE`: giấy phép thư viện vẽ.
- `docs/OMERA_VERIFICATION.md`: kết quả xác minh video, kiểm thử và giới hạn QA.
- `docs/OMERA_BATCH_ENGINE.md` và `docs/examples/batch_projects.json`: hướng dẫn này và năm bài mẫu hoàn chỉnh.

## Tệp hiện có được nâng cấp

- `app.py`: route trang Batch và đăng ký API mới, phiên bản 3.6.0.
- `render_engine.py`: nhận video đã vẽ từ worker, dùng chung mixer/ducking, cho phép SFX và metadata theo tác vụ.
- `local_voice.py`: hỗ trợ hủy tiến trình sinh giọng do tác vụ batch sở hữu.
- `start_studio.py`: chuẩn bị Canvas ở nền, nhận phiên bản mới; giữ trang Omera Hub mặc định.
- `assets/js/editor.js`: vẽ Omera chung compositor, inspector Bento, lưu production, ẩn helper và mặc định xuất 60fps.
- `assets/js/backend-api.js`: dùng được ở trang Batch không có biến backend riêng của editor.
- `templates/index.html` và `ClipCut_Studio_Standalone.html`: liên kết Batch, font và các script chung; hai bản giữ đồng nhất.
- `templates/omera.html`: thêm liên kết Batch Studio.
- `package.json`, `package-lock.json`: phiên bản mới, khóa `@napi-rs/canvas@0.1.100`, lệnh kiểm tra Omera.
- `tests/backend-api.test.cjs`: cập nhật phiên bản máy chủ mong đợi.
- `scripts/package_source.py`: đóng gói mô-đun mới, giữ loại runtime/tư liệu cá nhân/ảnh QA.
- `README_HUONG_DAN.md`, `THIRD_PARTY_NOTICES.md`: hướng dẫn và ghi nguồn/giấy phép.
- `dist/tibe_Studio_Source.zip`: mã nguồn đã đóng gói lại; không kèm dữ liệu dự án riêng.

## Kiểm tra

Chạy `node tests/omera-studio.test.cjs`, `python -B -m unittest tests/test_omera_batch.py` và `python -B scripts/check_omera_batch.py --extended` bằng runtime của dự án. Kiểm tra smoke sinh video thử trong thư viện riêng của tibe, không đụng tư liệu bên ngoài. Các kiểm tra native Canvas/pixel, controller, API và FFmpeg không thay thế kiểm tra thao tác thực tế trong trình duyệt; lượt nâng cấp này chưa được cấp truy cập công cụ trình duyệt.

Kết quả thực tế của lượt bàn giao: [OMERA_VERIFICATION.md](OMERA_VERIFICATION.md).

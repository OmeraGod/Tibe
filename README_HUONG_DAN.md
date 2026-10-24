# tibe — White Glass Video Editor

Trình dựng video cục bộ với nền trắng trong nhẹ, các nút nổi có phản hồi nhấn và điểm nhấn san hô. Thương hiệu hiển thị là **tibe**. ClipCore, route máy chủ, dữ liệu tự lưu và định dạng `.clipcut` vẫn tương thích với các dự án cũ. Giao diện Flask và bản HTML dùng chung nguồn. Hai ảnh biển/vách đá dùng bản AI dựng lại 1536 × 1024; ảnh gốc được giữ. Xem `assets/demo/GENERATED_ASSETS.md` để biết nguồn và prompt.

## Omera Batch Studio — bản 3.6.0

Mở **http://127.0.0.1:5050/batch** sau khi chạy **MỞ TIBE.bat**. Nhập 1–20 kịch bản hoặc nhiều thư mục tư liệu; một bài tạo ba bản A/B/C (34s/42s/68s), xuất tuần tự ở nền với tiến trình, hủy/thử lại, xem trước, tải MP4/manifest và mở tiếp trong editor. Chọn production để xuất **1080×1920/60fps H.264/AAC**; có bản nháp 540p/30fps.

Bộ dựng mới có bốn bố cục Bento/kính, hook ngay khung đầu, spring/microzoom/HUD, bốn widget, phụ đề karaoke, SFX tự đồng bộ và giọng Việt theo từng cảnh. Chữ tự căn thời gian là ước lượng; cung cấp mốc từ để khớp chính xác. MD5/grain/pan hỗ trợ quản lý phiên bản, không bảo đảm vượt nhận diện trùng hoặc tăng lượt xem. 60fps là tốc độ tệp xuất; thời gian dựng phụ thuộc máy.

Xem **[hướng dẫn đầy đủ, JSON và danh sách từng tệp](docs/OMERA_BATCH_ENGINE.md)**. Năm bài mẫu: `docs/examples/batch_projects.json`. Máy hiện tại đã cài bộ vẽ; máy khác cần Node.js và npm để trình khởi động chuẩn bị dependency theo lockfile. Bản ZIP ở `dist/tibe_Studio_Source.zip` không chứa môi trường/mô hình/dự án cá nhân.

## Bản nâng cấp tibe 3.5.0

- Bỏ nút VI/EN và mô-đun dịch giao diện theo yêu cầu; bỏ biểu tượng mây và dòng báo lưu lớn bên cạnh logo. Bản nháp vẫn tự lưu, nút Lưu và thư viện dự án giữ nguyên.
- Hộp tạo giọng có tiêu đề/nút đóng cố định, chỉ phần nội dung cuộn, bố cục một cột trên màn hình hẹp. Mở lại luôn ở đầu hộp. Khi bộ xử lý chưa chạy, hiện cách mở tibe và nút Thử lại thay cho danh sách giọng tải mãi.
- Sửa trang xem HTML của JetBrains ở localhost:63342/63343: API, giọng đọc, thư mục dự án và tư liệu dùng bộ xử lý tibe tại 127.0.0.1:5050. Không gọi nhầm `/api/status` của IDE. Cần mở `MỞ TIBE.bat` một lần; không có biểu mẫu kết nối riêng. Cầu nối chỉ nhận đúng các địa chỉ IDE này, không dùng cookie và cần header ứng dụng khi ghi.
- Thêm **122 chuyển cảnh GLSL gốc từ GL Transitions 1.76.1**: lật sách, cuộn trang, giọt nước, khối 3D, xoắn, kính vạn hoa, tan hạt, cháy phim… Chạy trực tiếp bằng WebGL 2 trong ô xem thử, trình phát và xuất từng khung hình. Cộng 27 chuyển cảnh Canvas có sẵn thành **149 chuyển cảnh** khi WebGL 2 hoạt động. Không cần mạng để dùng thư viện đã nhúng. Hai mẫu cần texture ngoài không đưa vào giao diện.
- Thêm **40 bộ màu** chân dung/du lịch/điện ảnh/retro/ẩm thực/đen trắng. Cùng 36 màu tibe và 16 màu Concat thành **92 bộ lọc tích hợp**, chưa tính LUT trên máy hoặc nhập thêm.
- Thêm **24 hiệu ứng động** như cực quang, đom đóm, mưa sao băng, cánh hoa, lá thu, radar, kính vạn hoa, sóng nhiệt, mưa mã số, tia sét… Cộng 40 hiệu ứng tibe và 5 preset từ thuật toán cục bộ thành **69 hiệu ứng video**. Có xem thử chuyển động và cường độ. Chỉ các ô nhìn thấy được cập nhật.

Kiểm tra: 122 shader thực tế của ứng dụng được biên dịch và dựng ảnh chuyển động trên GPU Intel OpenGL 3.3, kiểm tra lặp khung hình. Các hiệu ứng Canvas kiểm tra pixel, độ mờ và thời gian; bộ màu dùng chung compositor. Đây là kiểm tra bộ vẽ và controller, chưa phải kiểm tra tương tác trong trình duyệt. WebGL 2 cần tăng tốc đồ họa của trình duyệt; nếu không có, thư viện vẫn giữ các chuyển cảnh Canvas.

Nguồn và giấy phép: [GL Transitions](https://github.com/gl-transitions/gl-transitions), xem `docs/GL_TRANSITIONS.md` và `THIRD_PARTY_NOTICES.md`. Không gắn nhãn bộ nguồn mở này là hiệu ứng CapCut đã giải mã.

## Nền tảng tích hợp từ bản 3.4

Mở **MỞ TIBE.bat** để khởi động ứng dụng. Các chức năng bên dưới dùng chung bộ xử lý của tibe, không có bước kết nối CIT, Concat hoặc REA riêng.

- **Giọng Việt tích hợp:** Audio → Tạo giọng đọc hoặc Text → Văn bản thành giọng nói. Bộ VieNeu 3.8.3 / v3 Turbo ONNX đã được chuẩn bị trên máy hiện tại, có 25 giọng được đọc từ mô hình thực tế. Nhập tối đa 5.000 ký tự, chọn giọng, chỉnh tốc độ, tạo WAV 48 kHz, nghe thử, tải hoặc thêm vào timeline tại vạch phát. Chạy ngoại tuyến sau khi tải mô hình. Lịch sử nằm trong `workspace/tts`. Không cần cài/mở CIT Voice Studio hay nhập cổng kết nối.
- **Ngôn ngữ lời đọc:** Hộp giọng đọc có 10 ngôn ngữ; giọng ngoài tiếng Việt dùng Edge TTS qua Internet, được chọn rõ ràng. Danh mục Edge lưu 322 giọng, lọc theo ngôn ngữ. Đây là chọn ngôn ngữ đọc, chưa có dịch tự động văn bản/phụ đề.
- **Concat dùng trực tiếp:** 16 công thức màu gốc chuyển sang LUT SDR cho preview/xuất video; Audio → Xử lý âm thanh · Concat có 25 gói âm thanh xử lý bằng FFmpeg, nghe thử rồi áp dụng. Không cần chạy ứng dụng Concat. Nguồn và giấy phép tại `third_party/concat`; xem `docs/CONCAT_INTEGRATION.md`.
- **Thuật toán CapCut đã chuyển đổi:** 3 shader nhận diện bằng SHA-256 được chuyển thành 5 lựa chọn chạy trong tibe: hạt phim, mờ ngang, mờ dọc, mờ chéo, mờ mềm. Chúng có xem thử và dùng cùng bộ vẽ khi xuất video; không cần mở CapCut để dùng các bản chuyển đổi này. tibe tự dò tài nguyên tương thích trên máy; REA được dùng để kiểm kê và lưu bằng chứng nguồn tại `workspace/rea`. Chưa khôi phục toàn bộ engine, hiệu ứng Pro hay chuyển cảnh gốc của CapCut. Bộ 40 hiệu ứng, 36 grade và 27 chuyển cảnh trước đây là phần tibe triển khai riêng.
- **Dự án mới / Lưu / Dự án:** thư viện lưu mỗi dự án trong `workspace/projects/<id>/project.clipcut`, đóng gói tư liệu đã dùng. Ctrl+S lưu vào thư mục. Menu xuất vẫn có tải `.clipcut`. Tạo mới/mở dự án khác có thể hoàn tác; Xóa timeline giữ Media và hỗ trợ Ctrl+Z.
- **Timeline trống và dựng phân cảnh:** vùng bắt đầu có nút nhập tư liệu/dựng kịch bản, chỉ hiện track cần dùng. Dựng từ từng dòng hoặc JSON có mediaId, thời lượng, chữ, hiệu ứng, bộ lọc, chuyển cảnh và nhạc. Có mẫu YouTube 16:9, Shorts/Reels 9:16, 1:1 và 4:5; đây là dựng theo dữ liệu đầu vào.

Trên máy hiện tại đã tạo WAV thật bằng mô hình trong chế độ ngoại tuyến. Các bài kiểm tra kiểm tra tạo giọng, lịch sử, chèn ở vạch phát, pixel hiệu ứng và FFmpeg thực tế. Chưa kiểm tra trực tiếp giao diện trong trình duyệt ở lượt cập nhật này vì công cụ không được cấp quyền truy cập trang cục bộ.

## Những chức năng từ bản 3.2

**Sửa Text trong 3.2.1:** nút Thêm văn bản và sáu mẫu chữ hiện ngay tại vạch phát khi đang tạm dừng. Chữ mới không mặc định Fade từ độ mờ 0; vị trí tính theo tỷ lệ canvas, tránh nằm ngoài khung 16:9/1:1. Thao tác thêm dừng phát, chọn clip, hiện track chữ đang ẩn và mở ô nội dung trong inspector. Track khóa vẫn giữ khóa và hiện thông báo. Kiểm tra `tests/editor-text.test.cjs` gọi các nút thật và compositor, xác nhận chữ có pixel ngay tại thời điểm chèn ở bốn tỷ lệ, gồm chữ nhiều dòng tiếng Việt và thêm ở cuối dự án.

- **Phát thử tư liệu:** thẻ nhạc và video có nút Play/Pause riêng. Trình phát nguồn có tua, thời gian, đóng bằng ×/Escape; chuyển nguồn dừng nguồn cũ, không thêm clip hay thay đổi vị trí timeline. Phát timeline, mở hộp thoại hoặc xuất video sẽ dừng nguồn nghe thử. Tab ẩn sẽ tạm dừng nguồn.
- **Nút thêm mới:** nút + hình vuông bo góc, nền san hô, bóng nổi và phản hồi nhấn. Ẩn nút nhập tư liệu khi đang chọn Filter/Effect/Transition. Ảnh có poster không còn biểu tượng ảnh che giữa hình.
- **Filter dùng một thư viện:** 36 grade màu gốc của tibe, chia Chân dung, Điện ảnh, Du lịch, Retro, Ẩm thực, Đen trắng; tìm kiếm, rê chuột thử màu trên clip và chỉnh cường độ. Thư viện bên trái và bảng nổi dùng chung dữ liệu, chỉ hiển thị một nơi. Mỗi ô có ảnh xem thử đúng bộ lọc, kể cả Nguyên bản.
- **LUT .cube thật:** nhập tệp LUT 3D kích thước 2–65, hỗ trợ DOMAIN_MIN/MAX và nội suy trilinear. Nút **LUT trên máy** đọc LUT tương thích từ bản cài và cache CapCut; loại các bản trùng bảng màu. LUT được nhúng trong dự án .clipcut, nên màu đã chọn theo dự án khi lưu/mở lại. Compositor dùng cùng phép tra màu cho preview và MP4/WebM.
- **27 chuyển cảnh hoạt động:** hòa tan, quét bốn hướng, trượt bốn hướng, đẩy trái/phải, zoom vào/ra, xoay, mờ giao thoa, mở tròn, kim cương, rèm, ô bàn cờ, tách/khép giữa, chớp trắng, qua đen, nhiễu quét, khối ngẫu nhiên, quét đồng hồ và nảy khung. Các ô xem thử chạy chuyển động; ảnh nguồn trước được giữ đúng khung cuối trong đoạn chuyển. Đây là phần dựng của tibe.
- **Sóng âm thật:** track nhạc cao hơn, có đường bao âm thanh từ PCM của nguồn. Hai bài mẫu có sẵn 2.048 điểm/bài được tính trực tiếp từ WAV, nên hiện ngay cả trong bản HTML. Tư liệu nhập được giải mã để lấy 4.096 điểm. Đường sóng thay đổi theo điểm cắt, tốc độ/curve, âm lượng và fade; không tạo sóng ngẫu nhiên. Nguồn lỗi hoặc vượt giới hạn phân tích 100 MB hiện thông báo, không giả dữ liệu.
- **Timeline và ô chọn nổi:** tiêu đề track, nút ẩn/khóa/tắt tiếng có nền riêng và bóng nổi. Các menu tỷ lệ, zoom, mask, blend, xuất video… dùng bảng chọn tùy chỉnh, có biểu tượng tỷ lệ, dấu chọn, thao tác bàn phím và tự mở lên trên nếu thiếu chỗ.
- **Sticker linh hoạt:** 63 sticker gồm 9 SVG aesthetic, 36 emoji và 18 hình; tìm kiếm, yêu thích, gần đây, đổi kích thước lưới. Bấm để thêm hoặc kéo vào vị trí trên khung xem/timeline. Mặc định dùng thư viện bên trái; nút **Bảng nổi** chuyển sang bảng có thể kéo và đổi kích thước. Nút ghim/đóng đưa về thư viện, tránh lặp hai lưới.
- **40 hiệu ứng chuyển động:** giữ bộ 23 hiệu ứng trước, thêm Lắc nghiêng, Tilt Shift, Phơi sáng đôi, Dư ảnh, Viền neon, Áp phích, Hai tông màu, Chấm in, Đèn disco, Đèn sân khấu, Bokeh, Pháo giấy, Bong bóng, Cầu vồng, Tia nắng, Bụi nắng, Phim cũ. Có tìm kiếm, nhóm và nút dừng/bật xem thử. Chỉ các ô đang nhìn thấy được cập nhật, tối đa 24 fps; tôn trọng tùy chọn giảm chuyển động của hệ điều hành. Đây là hiệu ứng do tibe triển khai, không phải mã hiệu ứng CapCut được khôi phục.
- Rê chuột/focus để thử hiệu ứng trên clip đang chọn; bấm để áp dụng và xem chuyển động ngay cả khi đang tạm dừng. Inspector có thanh **Intensity** và nút gỡ. Ô xem thử, compositor và xuất video dùng chung `editor-effects.js`; thời gian khung hình quyết định hiệu ứng khi xuất. Độ mờ/keyframe của clip tiếp tục áp dụng cho hiệu ứng.
- Stickers / Filters / Speed đều ẩn khi mở dự án. Chọn công cụ để mở, bấm × để đóng; nút bảng nổi dưới trình phát vẫn bật/tắt cả ba theo yêu cầu trước.

Sau khi cập nhật, dùng **Ctrl+F5** để tải lại giao diện và các tệp JavaScript/CSS.

## Bố trí thư mục

Mã ứng dụng nằm ở thư mục gốc, `assets` và `templates`; hướng dẫn/ảnh tham chiếu ở `docs` (ảnh mẫu tại `docs/reference`). Bản ZIP mới nhất nằm trong `dist/tibe_Studio_Source.zip`; công cụ đóng gói và tạo ảnh xem thử không ghi tệp sinh ra vào thư mục gốc nữa. Dự án và tư liệu của bạn ở `workspace`; `.runtime` chứa bộ xử lý và mô hình đã cài, `node_modules` chứa REA. Giữ các thư mục này để dùng ứng dụng đầy đủ. `scripts`, `tests` và `third_party` là công cụ bảo trì, kiểm tra và nguồn/giấy phép tích hợp.

## Mở ứng dụng

Nhấp đúp **MỞ TIBE.bat**. Ứng dụng mở trang **http://127.0.0.1:5050/** bằng trình duyệt mặc định; giữ cửa sổ tibe đang chạy. Nếu trang đã mở, dùng Ctrl+F5 để nạp bản mới.

Trên máy hiện tại, thư viện đã được chuẩn bị trong `.runtime/python`; script có thể dùng Python đi kèm Codex. Trên máy khác cần Python 3.10+ và FFmpeg/FFprobe trong PATH. Script tự tạo môi trường và tải thư viện/mô hình ở lần đầu qua Internet; các lần sau giọng Việt chạy trên máy. REA cần Node.js và dependency đã khóa trong package-lock. ZIP mã nguồn không kèm môi trường và mô hình dung lượng lớn; thư mục đang dùng trên máy hiện tại đã có sẵn chúng.

Để mở không cần máy chủ: nhấp đúp **ClipCut_Studio_Standalone.html**, giữ nguyên thư mục `assets` bên cạnh. Bản này chỉnh sửa và xuất WebM trong trình duyệt; MP4, giọng đọc và REA cần máy chủ. Các định dạng video được nhập phải được trình duyệt hỗ trợ, ưu tiên MP4 H.264/AAC hoặc WebM.

## Công cụ hoạt động

- Nhập video, ảnh và âm thanh; kéo thả tệp vào thư viện. Bấm để chọn tư liệu; bấm dấu + hoặc bấm đúp để thêm vào timeline. Có thể kéo tư liệu vào đúng vị trí/track mong muốn. Video/ảnh thêm cuối track chính, âm thanh thêm tại vạch phát. Ảnh trong dự án mẫu là ảnh tĩnh.
- Năm track: Video, Overlay, Text, Sticker, Audio. Kéo clip để dời thời gian; kéo mép để cắt; bật/tắt bắt dính. Clip chồng thời gian được hiển thị thành các hàng riêng. Mỗi track có khóa, ẩn/hiện và tắt tiếng cho track có âm thanh. Kéo thanh chia giữa trình phát và timeline để đổi chiều cao; nút Vừa toàn bộ dự án tự chỉnh mức zoom.
- Cắt đôi, cắt trái/phải tại vạch phát, nhân đôi, xóa, xóa nối tiếp trên track đang chọn, đóng băng khung hình và thêm lớp phủ. Shift + bấm để chọn nhiều clip; cắt, xóa, nhân đôi hoặc sao chép/dán cả nhóm. Menu chuột phải chứa các lệnh thường dùng. Kéo mép để mở rộng trở lại trong giới hạn tư liệu nguồn.
- Hoàn tác/làm lại thật, tối đa 80 trạng thái trong phiên. Đổi tốc độ 0,25×–4× giữ đúng đoạn nguồn; chỉnh âm lượng, tắt tiếng từng clip, fade in/out và tách tiếng video thành clip Audio.
- Chỉnh vị trí, tỷ lệ, góc xoay, độ mờ; crop viền, vừa/lấp đầy khung, lật ngang/dọc, mặt nạ Circle, Rectangle, Split, Filmstrip, Heart, Star với Feather/Invert; hòa trộn Normal/Screen/Multiply/Overlay/Darken/Lighten; chroma key chọn màu, ngưỡng và giảm lem màu.
- Keyframe cho vị trí, tỷ lệ, góc xoay và độ mờ. Đặt vạch phát, chỉnh các giá trị, bấm **Thêm keyframe**. Các keyframe nội suy tuyến tính. Khi clip đã có keyframe, thay đổi thuộc tính tạo/cập nhật điểm tại vạch phát. Có nút tới điểm trước/sau và xóa điểm hiện tại. Bấm chữ hoặc lớp phủ trong preview để chọn, kéo để di chuyển, kéo góc khung chọn để đổi tỷ lệ.
- Bộ lọc Cream, Blush, Breeze, Dream, Lomo; độ sáng, tương phản, bão hòa, nhiệt độ ấm/lạnh theo kênh màu, viền tối, sharpen, highlight và shadow. Bộ 40 hiệu ứng chuyển động có xem thử trực tiếp và chỉnh cường độ.
- Chuyển cảnh cắt thẳng, hòa tan, quét ngang và phóng to ở **đầu clip được chọn**; chuyển động fade, Ken Burns, zoom, trượt và nảy. Nguồn clip trước được giữ ở khung cuối trong đoạn chuyển tiếp.
- Chữ nhiều dòng, Heading, Script kèm tia nắng, Subtitle, Karaoke đổi màu theo từ, Neon Glow, Badge màu; 63 sticker SVG/emoji/hình; nhập/xuất phụ đề **SRT**, giữ thời gian và tiếng Việt.
- **Dàn cảnh** chia các câu kịch bản thành clip ảnh mẫu và chữ có thể sửa. Đây là bộ dựng theo quy tắc, không phải AI sinh video.
- Giọng đọc Việt trên máy bằng VieNeu; giọng đa ngôn ngữ qua Edge TTS khi chọn. Chỉ thêm âm thanh sau khi tạo thành công; lỗi được hiển thị.
- Tỷ lệ 9:16, 16:9, 1:1 và 4:5. Xuất WebM hoặc **MP4 H.264 + AAC**, 720p/1080p, 24/30/60 fps. Luồng xuất gồm ảnh, video, lớp phủ, chữ, hiệu ứng và âm thanh đã trộn. MP4 được mã hóa từng khung hình với số khung hình xác định; WebM dùng bộ ghi thời gian thực của trình duyệt.

**Xuất MP4:** cần FFmpeg và FFprobe trong PATH, cùng máy chủ Flask đang chạy. Trình duyệt vẽ từng khung hình (kể cả chữ, mask, bộ lọc, keyframe), gửi theo lô cho FFmpeg mã hóa H.264. FFmpeg trộn các đoạn âm thanh theo điểm nguồn, tốc độ, âm lượng, fade và vị trí trên timeline thành AAC. Có thể chuyển sang tab/cửa sổ khác trong quá trình này. Để ứng dụng và máy chủ chạy cho đến khi hoàn tất; có nút Hủy xuất. Tác vụ dở dang được dọn khi hủy hoặc tắt máy chủ. Thời gian xuất phụ thuộc kích thước và số khung hình, tốc độ ổ đĩa và bộ giải mã của trình duyệt.

**Xuất WebM:** chạy theo thời gian thực, cần giữ cửa sổ ở phía trước; tác vụ hủy khi tab bị ẩn. Nút tắt tiếng dưới preview chỉ tắt tiếng nghe trước; muốn bỏ tiếng khỏi tệp xuất hãy tắt tiếng clip hoặc track trong inspector/timeline.

## Lưu và mở dự án

Ứng dụng tự lưu timeline trong trình duyệt. Tư liệu ở chế độ máy chủ được lưu tại `workspace/uploads`; chế độ HTML lưu tư liệu nhập vào IndexedDB khi trình duyệt cho phép. Xóa dữ liệu trình duyệt có thể xóa bản tự lưu.

Đường dẫn `http://127.0.0.1:5050/?demo=1` mở bản mẫu riêng để xem thử, không ghi đè bản tự lưu hiện có. Có thể tải các thay đổi của bản xem thử bằng Ctrl+S.

Nút **Lưu** hoặc **Ctrl+S** lưu dự án vào thư mục trong `workspace/projects`. Menu xuất → **Lưu tệp dự án** tải tệp **.clipcut** chứa timeline và các tư liệu đã dùng. Các tư liệu nhập được nhúng vào tệp để mở lại trên máy khác; ảnh mẫu dùng thư mục `assets/demo`. Menu dự án → **Mở dự án** mở lại `.clipcut`. Tệp lớn có thể tốn nhiều bộ nhớ khi đóng gói. Đây là định dạng tibe riêng, không phải dự án CapCut Desktop.

## Tích hợp morluto/rea thật

Dependency `rea-agents` được khóa ở **6.7.0** trong `package.json` và `package-lock.json`. Cài bằng `npm install` với Node.js 22.19+, 24.11+ hoặc 26+. Node.js 10 hiện có trong PATH trên máy này không chạy REA được; bootstrap ưu tiên Node.js 24 đi kèm Codex nếu có. Có thể chỉ định đường dẫn Node bằng biến `CLIPCUT_NODE`.

Menu dự án → **Tài nguyên trên máy** hiển thị trạng thái và tài nguyên nhận diện tự động. Bộ hiệu ứng đã chuyển đổi và Concat chạy ngay trong tibe. Phân tích sâu dùng REA thật, lưu bằng chứng tại `workspace/rea`; không chạy hay sửa CapCut. Adapter dùng các lệnh/artifact API có thật ở phiên bản đã khóa.

Mặc định tìm `%LOCALAPPDATA%/CapCut/Apps` hoặc `~/AppData/Local/CapCut/Apps`. Có thể đặt `CLIPCUT_REA_TARGET` tới thư mục Apps khác. Đã kiểm tra trên CapCut **8.3.0.3497**. Báo cáo kiểm tra tĩnh PE không chứng minh đã khôi phục thuật toán của engine.

REA là công cụ phân tích ứng dụng, **không phải SDK dựng video và không tự chuyển toàn bộ CapCut sang dự án**. Phần dựng video ở đây là mã triển khai riêng. Không nhập hiệu ứng Pro hay dịch vụ riêng của CapCut. Ba thuật toán shader đã nhận diện được chuyển đổi sang bộ vẽ riêng; không đóng gói tệp shader hoặc cache gốc.

## Tài nguyên CapCut và REA trong bản 3.2

Menu dự án → **Tài nguyên trên máy** → **Kiểm tra kho hiệu ứng & LUT** gọi `/api/rea/materials`. Script dùng bộ đọc artifact của `rea-agents` 6.7.0 để lập inventory và SHA-256 cho các thư mục tài nguyên/LUT đã chọn, không chạy hoặc sửa CapCut. Báo cáo nằm tại `workspace/rea`; `/api/rea/luts` chỉ đọc các tệp .cube trong Resources và Cache/effect của bản cài được chọn, loại trùng nội dung màu.

Trên máy phát triển: CapCut 8.3.0.3497, Cache/effect có 290 thư mục gốc, 12.975 tệp và 295 config. REA đã inventory bốn nhóm thư mục tài nguyên/LUT. Ba tệp .cube tìm được tương ứng cùng một bảng màu **Alexa LogC to Rec709**, nên thư viện chỉ thêm một LUT. Đây là LUT chuyển LogC, không phải bộ lọc chân dung thông thường. Ngoài ba thuật toán shader đã chuyển đổi ở bản 3.4, các gói shader/Lua, mask/AI và chuyển cảnh gốc phụ thuộc engine CapCut vẫn chưa được chuyển sang tibe. 40 hiệu ứng, 36 grade và 27 chuyển cảnh của tibe được triển khai riêng. Không gắn nhãn các gói chưa hỗ trợ thành lựa chọn dùng được.

ZIP mã nguồn không chứa cache/tài nguyên CapCut hoặc tư liệu cá nhân. LUT được đọc trực tiếp trên máy đã cài, hoặc người dùng nhập .cube; dự án .clipcut lưu bảng màu đã dùng để giữ kết quả.

## Những phần chưa triển khai

Ứng dụng chưa tương đương toàn bộ CapCut. Chưa có nhận dạng lời nói tự động, tách người bằng mô hình AI, theo dõi chuyển động, ổn định hình ảnh, optical flow, làm đẹp khuôn mặt, thư viện template/hiệu ứng thương mại, cộng tác đám mây hoặc xuất draft CapCut tương thích chính thức. Chroma key loại màu được chọn bằng khoảng cách màu và độ mềm ngưỡng; waveform được tính từ âm thanh giải mã được; nguồn không giải mã được hiển thị trạng thái lỗi, không dùng dữ liệu giả. Curve Speed có bốn preset Bezier, dùng cùng phép tích phân thời gian nguồn trong trình duyệt và máy chủ; âm thanh MP4 được chia cửa sổ và co giãn bằng atempo. Giới hạn 300 cửa sổ/clip nên đoạn rất dài có độ phân giải đường cong thưa hơn. Deep/High nghe thử dùng dịch cao độ hạt, MP4 dùng FFmpeg; chất tiếng có thể khác nhẹ.

## Phím tắt

- Space: phát/tạm dừng.
- Ctrl+B: cắt đôi tại vạch phát; Ctrl+D: nhân đôi.
- Delete: xóa; Shift+Delete: xóa và nối track đó.
- Ctrl+Z: hoàn tác; Ctrl+Y hoặc Ctrl+Shift+Z: làm lại.
- Ctrl+C / Ctrl+V: sao chép và dán clip tại vạch phát; Ctrl+I: nhập tư liệu; N: bật/tắt bắt dính.
- Ctrl+S: tải dự án; trái/phải: đi một khung 30 fps; Shift+trái/phải: đi một giây.

## Mã nguồn và kiểm tra

`app.py` xử lý upload, xuất MP4 và API cục bộ; `rea_adapter.py` gọi CLI REA và Edge TTS. `assets/js/editor-core.js` chứa các phép xử lý clip, keyframe, SRT; `assets/js/editor.js` chứa giao diện, compositor, mixer và xuất video. `assets/css/studio.css` chứa giao diện mới, `assets/js/icons.js` chứa biểu tượng SVG. `render_engine.py` mã hóa khung hình và trộn timeline âm thanh bằng FFmpeg. `scripts/prepare_ui.py` đồng bộ bản HTML standalone từ template.

Chạy `npm test` với Node tương thích để kiểm tra cắt/trim/speed/keyframe/SRT và sóng âm từ PCM. Chạy `python -m unittest tests/test_backend.py` để kiểm tra API, tệp upload, MP4 H.264/AAC và giới hạn nguồn truy cập. Các fixture kiểm tra được tạo ở `workspace/exports`.

**Kiểm tra bản 3.2:** đạt 26 kiểm tra xử lý clip/sóng âm, 13 kiểm tra máy chủ và 6 kiểm tra vòng đời phát thử. Kiểm tra render từng hiệu ứng bằng `@napi-rs/canvas`: 41 trường hợp (gồm nguyên bản), thay đổi pixel thật theo thời gian, kết quả xác định ở cùng mốc thời gian, cường độ 0 giữ nguyên ảnh, độ mờ clip bằng 0 không để lộ hiệu ứng, và RGB không làm trắng ảnh. Kiểm tra thêm 32 trường hợp bộ lọc/LUT/chuyển cảnh và compositor thực tế với 28 preset chuyển cảnh cùng cường độ màu. Chạy `npm run test:effects` khi có thư viện kiểm tra tùy chọn `@napi-rs/canvas`; có thể đặt `TIBE_CANVAS_MODULE` tới đường dẫn module đã cài. Thư viện này không cần cho ứng dụng chạy trong trình duyệt.

`node scripts/render_effect_previews.cjs` dựng mẫu hiệu ứng; thêm `--library` để dựng mẫu filter/chuyển cảnh. Mỗi mẫu 3 giây/72 khung hình H.264/AAC từ cùng bộ hiệu ứng và nhạc WAV, kèm GIF. Đây là mẫu đầu ra của renderer, không phải ảnh chụp giao diện. Công cụ trình duyệt đã từ chối truy cập trang cục bộ; không dùng trình duyệt thay thế để vượt chặn. Bản 3.2 đã kiểm tra xử lý và dựng hình, chưa kiểm tra trực tiếp các thao tác giao diện mới. Các video `QA_Studio_3_Browser.mp4` và `QA_Studio_4_Browser.mp4` là bằng chứng của phiên bản trước, không xác nhận giao diện 3.2. Giọng đọc qua mạng chưa được xác nhận lại.

`python scripts/build_demo_waveforms.py` tái tạo sóng âm mẫu, có SHA-256 của từng nguồn WAV. `python scripts/prepare_ui.py` đồng bộ HTML standalone. `python scripts/package_source.py` đóng gói mã nguồn tibe, loại môi trường chạy, tệp xuất và dữ liệu người dùng.

Chạy `npm run test:preview` để kiểm tra Play/Pause, chuyển nguồn, tua, đóng trong lúc tải và dừng khi tab ẩn bằng đối tượng thử nghiệm; đây không phải kiểm thử trình duyệt.

Nguồn REA: https://github.com/morluto/rea — giấy phép MIT của REA và thông báo dependency giữ nguyên trong `node_modules/rea-agents`. Ảnh mẫu giữ từ dự án ban đầu. Hai bản nhạc nền WAV được tạo bằng tổng hợp âm thanh trong script chuẩn bị giao diện.

## Tệp nguồn đang dùng

- `templates/index.html` và `ClipCut_Studio_Standalone.html`: giao diện mới cùng một bản nguồn.
- `assets/css/studio.css`: bố cục và theme sáng/tối. Các stylesheet cũ được giữ để tham khảo, không nạp vào giao diện mới.
- `render_engine.py`: mã hóa MP4 theo khung hình, giới hạn nguồn tệp cục bộ và vòng đời tác vụ.
- `workspace/exports/QA_Studio_3_Browser.mp4`: video kiểm tra từ trình duyệt trên máy phát triển, không đóng gói tư liệu cá nhân vào ZIP mã nguồn.

## Chức năng mới và xuất CapCut

- Normal Speed 0,25–4× và Curve Speed: Montage, Hero, Bullet, Jump Cut; cắt/trim giữ liên tục thời gian nguồn. Đổi preset giữ tổng đoạn nguồn.
- Audio Ducking giảm nhạc còn 28% khi chồng Voice/TTS, chuyển tiếp 120 ms; đặt vai trò Voice trong Audio để đánh dấu giọng đã nhập. TTS được nhận dạng tự động.
- Voice Effects None/Deep/High/Echo/Radio; áp dụng cho nghe trước và xuất MP4.
- Canvas background bật/tắt, chọn màu pastel hoặc Canvas Blur. Blur chỉ áp dụng nền; nội dung chính chỉ mờ khi người dùng chọn hiệu ứng Blur.
- Menu Export → CapCut Desktop draft gọi POST /api/export/capcut_draft. Gói ZIP có draft_content.json, draft_meta_info.json, assets, project.clipcut, compatibility.json và README.
- Xuất theo cấu trúc JSON cộng đồng: https://github.com/GuanYixuan/pyCapCut/tree/main/pycapcut/assets và https://github.com/renezander030/capcut-cli/tree/master/docs/draft-schema . Đã kiểm tra đăng ký tư liệu, đơn vị microsecond, tham chiếu ID, text UTF-16, track, keyframe, đường dẫn và tính toàn vẹn ZIP. Chưa xác nhận mở thành công trong CapCut 8.3. Không sửa kho dự án CapCut. Các hiệu ứng chưa chuyển nguyên vẹn được liệt kê trong compatibility.json; Curve Speed được đổi sang tốc độ trung bình giữ đoạn nguồn. Xuất MP4 để giữ toàn bộ hình ảnh đã dựng trong tibe.
- Video kiểm tra trực tiếp: workspace/exports/QA_Studio_4_Browser.mp4, 2 giây, 48 khung hình, H.264/AAC bắt đầu tại 0; có mặt nạ mềm, nền mờ, sticker SVG, karaoke, Radio và curve âm thanh.

### Đổi tỷ lệ và phóng to

Đổi tỷ lệ 9:16 / 16:9 / 1:1 / 4:5 chuyển clip Video sang Contain để giữ trọn ảnh, không tự kéo giãn hoặc cắt phóng lớn. Tọa độ dọc của chữ, sticker và keyframe được đổi theo chiều cao canvas. Có thể chọn Cover trong Fit nếu chủ ý lấp đầy và crop khung. Zoom chỉ thay đổi cách xem; phần vượt vùng xem được cắt hiển thị, không đổi tỷ lệ hoặc chất lượng tệp xuất. Preview dùng canvas ít nhất 1080 pixel ở cạnh ngắn.

Mở Filters hoặc Stickers từ thanh bên trái để dùng thư viện; nút Bảng nổi chuyển bảng công cụ vào vùng xem. Bấm tab Speed ở inspector để mở bảng tốc độ. Các bảng nổi khởi đầu đều ẩn. Sau khi cập nhật máy chủ/API, khởi động lại run_studio.bat rồi Ctrl+F5 để nhận đủ mã mới.

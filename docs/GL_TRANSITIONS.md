# GL Transitions trong tibe 3.5

Nguồn: https://github.com/gl-transitions/gl-transitions, gói npm **1.76.1**. `third_party/gl-transitions/UPSTREAM.json` ghi tarball, commit và hash đã kiểm tra. `gl-transitions.json` gốc, README, giấy phép MIT và compatibility report upstream được giữ nguyên. Các shader BSD-2/BSD-3 giữ đầy đủ thông báo trong chuỗi mã gốc.

Ứng dụng nhúng 122 shader độc lập trong `assets/js/gl-transition-catalog.js`. Không thêm Displacement/Luma vì cần ảnh texture phụ; không thêm mẫu cannabisleaf vào thư viện biên tập. `assets/js/gl-transitions.js` cung cấp hai texture ảnh, progress, tỷ lệ và toàn bộ tham số mặc định đúng kiểu. Mã shader gốc được ghép với wrapper GLSL ES 3.00; `texture2D` đổi thành `texture` để chạy WebGL 2. Không chuyển thành những tên khác cùng một phép hòa tan.

Preview ô nhỏ, compositor và xuất MP4/WebM đều gọi `TibeLooks.drawTransition`, dùng chung shader. Texture lấy từ hai khung hình đã dựng; đầu/cuối đoạn chuyển giữ chính xác nguồn/đích. Kích thước canvas GPU theo tỷ lệ xuất, không dùng thumbnail để xuất 1080p. Cache tối đa 24 chương trình GPU; chỉ ô đang nhìn thấy được cập nhật, giới hạn 24 fps, tôn trọng giảm chuyển động.

Thư viện GL chỉ đăng ký khi tạo được WebGL 2. Máy không hỗ trợ vẫn có 27 chuyển cảnh Canvas. Nếu một shader gặp lỗi trên driver cụ thể, ứng dụng hiện thông báo và dùng hòa tan cho khung đó; cần đổi lựa chọn hoặc bật tăng tốc đồ họa trước khi xuất để giữ kiểu chuyển mong muốn. Không tuyên bố tương thích mọi GPU.

## Kiểm tra

`scripts/export_gl_checks.cjs` xuất đúng vertex/fragment được ứng dụng tạo. `tests/check_gl_gpu.py` biên dịch và dựng trên GPU native bằng ModernGL QA. Khi kiểm tra native, chỉ đổi version ES 300 sang desktop 330 và bỏ precision declaration. Đã kiểm tra 122/122 trên Intel RaptorLake, OpenGL 3.3: biên dịch thành công, thay đổi ảnh qua ba thời điểm, có alpha và lặp lại cùng khung hình. Báo cáo trên máy ở `workspace/rea/gl-transitions-gpu-check.json`.

Đây là kiểm tra shader/native renderer, chưa kiểm tra trình duyệt WebGL 2 hoặc các nút giao diện trên màn hình thực. Native QA dùng dependency riêng trong `.runtime/qa-gl`, không phải thư viện cần cài để sử dụng tibe. Chuyển cảnh gốc Canvas và các bộ màu được kiểm tra thêm bằng compositor thật trong các bài kiểm tra JavaScript.

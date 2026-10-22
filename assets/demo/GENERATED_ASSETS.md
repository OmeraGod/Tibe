# Ảnh mẫu HD — 21/10/2026

Hai ảnh mẫu được dựng lại bằng công cụ imagegen tích hợp để thay bản mẫu đã nhòe từ đầu. Đây là ảnh AI dựng lại theo bố cục tham chiếu, không phải chi tiết được khôi phục chính xác từ ảnh gốc. Ảnh gốc vẫn được giữ.

- `assets/demo/cliff-hd.png`: 1536 × 1024, dùng thay `cliff.webp` trong cảnh mẫu và dự án ClipCut cũ tham chiếu ảnh mẫu này.
- `assets/demo/coast-hd.png`: 1536 × 1024, dùng thay `coast.webp` và làm ảnh xem thử các bộ lọc.

Phương thức: imagegen tích hợp, chế độ chỉnh sửa với ảnh tham chiếu; không dùng CLI/API key. Nút, logo và sticker vẫn được vẽ bằng CSS/SVG.

## Prompt cliff-hd.png

Use case: photorealistic-natural / image restoration. Asset type: sharp demonstration footage still for a video editor. Input image is the EDIT TARGET, a very blurry low-resolution image of an Italian Mediterranean cliffside village. Reconstruct it as a crisp, high-resolution professional travel photograph retaining the overall framing, hillside buildings, terracotta roofs, warm ivory stone, warm summer sunlight, and Mediterranean setting. The architecture and roofs should have clear detailed edges, stone texture, windows, crisp natural light. Keep the image photographic with full depth of field, NOT painterly, NOT soft focus, NOT gaussian blur, no text, no UI, no border, no watermark. This is a new sharp rendition of the sample, not forensic restoration; preserve the approximate composition rather than making up a claim of recovered detail. Output landscape 1536x1024 or higher with finely resolved texture.

## Prompt coast-hd.png

Use case: photorealistic-natural. Edit target: the supplied blurry demo image of a Mediterranean coast in a video editor. Create a crisp high-resolution reimagining of this exact general composition: wide sea on the left, Amalfi-style steep hillside on the right with ivory and warm peach houses, tiled rooftops, lush green hills, distant hazy headlands, clear pastel blue sky and calm teal sea. Sharp photographic detail and natural color, summer travel editorial photography, deep depth of field. Landscape 1536x1024 or higher. Keep all edges square without the original UI thumbnail rounded border or white margin. No text, no interface, no watermark. Avoid soft focus, painterly appearance, blur. This is a sharp new rendition of the sample, not a claim to forensic restoration.

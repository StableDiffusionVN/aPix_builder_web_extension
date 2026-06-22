# aPix Builder Web Extension

Chrome Manifest V3 extension that brings the aPix Builder workflow into a browser side panel.

**Phiên bản hiện tại:** v1.1.0  
**Tải bản cài:** [GitHub Release v1.1.0](https://github.com/StableDiffusionVN/aPix_builder_web_extension/releases/tag/v1.1.0)

## Tính năng chính

- Kéo thả ảnh từ trang web hoặc desktop vào side panel.
- Chuột phải trên ảnh bất kỳ → **Mở + Run aPix Builder** để import và chạy app/template đang mở ngay, hoặc thêm vào hàng đợi.
- Hỗ trợ import ảnh từ trang bảo vệ hotlink (Pixiv, CDN có Referer) qua staging và tab capture.
- Chạy template ComfyUI, workflow RunningHub, hoặc RunningHub AI App có sẵn.
- Chuyển provider từ thanh mode trên cùng (ComfyUI / RH Workflow / RH App).
- Import thư mục workflow tùy chỉnh (`app_build` + `api.json` khi cần).
- Thêm và lưu RunningHub App ID tùy chỉnh; tự lấy tên, thumbnail, tag và input field.
- **Preset** — lưu/tải bộ tham số theo từng template.
- Hàng đợi chạy riêng cho ComfyUI và RunningHub; dừng và xóa queue an toàn.
- Thư viện output lưu trong IndexedDB; tải một hoặc nhiều ảnh về `Downloads/aPix Builder/`.
- Theo theme sáng/tối của trình duyệt; có override trong Settings.

## Cài đặt (Chrome)

1. Tải `aPix-Builder-Web-Extension-v1.1.0.zip` từ [Releases](https://github.com/StableDiffusionVN/aPix_builder_web_extension/releases).
2. Giải nén thư mục.
3. Mở `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục đã giải nén.

Hoặc build từ mã nguồn:

```bash
npm install
npm run dist:zip
# file: release/aPix-Builder-Web-Extension-v1.1.0.zip
```

## Development

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

`npm run sync:templates` imports templates from the parent aPix Builder repository before each build.

Custom templates selected inside Chrome are copied into the extension's IndexedDB library. The original folder does not need to remain connected after import. Folder scanning uses the File System Access API and only reads `app_build.*` plus `api.json`; scanning is bounded to avoid loading unrelated model files or very large directory trees.

## Yêu cầu

- Google Chrome (Manifest V3, side panel).
- ComfyUI chạy local (`http://127.0.0.1:8188`) hoặc RunningHub API key — cấu hình trong Settings của extension.

## Thay đổi v1.1.0

- Import ảnh từ trang web có bảo vệ hotlink (Pixiv và tương tự).
- Menu chuột phải **Mở + Run** với auto-run và staging ảnh nhúng.
- Thanh preset: lưu/tải/xóa bộ tham số theo template.
- Cải thiện queue runner (ComfyUI / RunningHub), stop và clear.
- Thư viện output và workflow picker ổn định hơn.

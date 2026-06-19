# aPix Builder Web Extension

Chrome Manifest V3 extension that brings the aPix Builder workflow into a browser side panel.

## Features

- Drag images from a webpage or desktop into the side panel.
- Right-click any webpage image and choose **Mở trong aPix Builder**.
- Run bundled ComfyUI templates, RunningHub workflows, or RunningHub AI Apps.
- Switch providers from the persistent top mode bar.
- Import custom ComfyUI/RH Workflow folders (`app_build` plus `api.json` where required).
- Add and persist custom RunningHub App IDs.
- Resolve custom RunningHub App names, thumbnails, tags, and input fields from the App ID.
- Follow the browser light/dark appearance automatically, with explicit theme overrides in Settings.
- Keep outputs in an IndexedDB-backed extension library.
- Download one output or selected outputs into `Downloads/aPix Builder/`.

## Development

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`.

`npm run sync:templates` imports templates from the parent aPix Builder repository before each build.

Custom templates selected inside Chrome are copied into the extension's IndexedDB library. The original folder does not need to remain connected after import. Folder scanning uses the File System Access API and only reads `app_build.*` plus `api.json`; scanning is bounded to avoid loading unrelated model files or very large directory trees.

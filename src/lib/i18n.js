// i18n vi/en cho toàn extension — bảng messages key phẳng + t() mức module
// để cả React component lẫn services (non-React) dùng chung.
// Đổi ngôn ngữ: setLanguage() rồi App re-render (I18nProvider lo phần React).

const messages = {
  vi: {
    // Chung
    "common.loading": "Đang tải…",
    "common.cancel": "Hủy",
    "common.close": "Đóng",
    "common.add": "Thêm",
    "common.delete": "Xóa",
    "common.save": "Lưu",
    "common.test": "Kiểm tra",
    "common.testing": "Đang kiểm tra",

    // App / topbar
    "app.status.ready": "Sẵn sàng",
    "app.openSettings": "Mở Settings",
    "app.modeChanged": "Chế độ {mode}",
    "modes.aria": "Chế độ xử lý",

    // Import ảnh
    "import.title": "Import ảnh",
    "import.done": "Đã import ảnh",
    "import.fromWeb": "Đang import ảnh từ trang web…",
    "import.fromWebDone": "Đã import ảnh từ trang web",
    "import.failed": "Import thất bại",
    "import.autoRunPreparing": "Đã nhận ảnh, đang chuẩn bị chạy…",
    "import.dropHere": "Kéo ảnh vào đây",
    "import.chooseImage": "Chọn ảnh",
    "import.inputAlt": "Ảnh input",
    "import.replace": "Thay ảnh",
    "import.remove": "Xóa ảnh",
    "import.stagingReadFailed": "Không đọc được ảnh đã staging",
    "import.noImage": "Không có ảnh để import",
    "import.fromWebFailed": "Không thể import ảnh từ trang web",
    "import.downloadFailed": "Không thể tải ảnh ({status})",
    "import.notAnImage": "Tệp được chọn không phải ảnh hợp lệ",
    "import.imageOnly": "aPix Builder chỉ nhận tệp hình ảnh",

    // Catalog / template / app
    "catalog.selected": "Đã chọn {name}",
    "catalog.importedTemplates": "Đã import {count} template",
    "catalog.noDirPicker": "Chrome hiện tại không hỗ trợ chọn thư mục an toàn. Hãy cập nhật Chrome.",
    "catalog.scanningFolder": "Đang quét thư mục template…",
    "catalog.importFailed": "Import template thất bại",
    "catalog.unzipping": "Đang giải nén template…",
    "catalog.zipFailed": "Import .zip thất bại",
    "catalog.needApiKeyScan": "Nhập RunningHub API Key trước để quét thông tin App",
    "catalog.scanningApp": "Đang quét thông tin RunningHub App…",
    "catalog.addedApp": "Đã thêm {name}",
    "catalog.invalidAppId": "App ID không hợp lệ",
    "catalog.removedItem": "Đã xóa {name}",
    "catalog.loadTemplateFailed": "Không thể tải template",

    // WorkflowPicker
    "picker.scanning": "Đang quét",
    "picker.folder": "Thư mục",
    "picker.deleteCustom": "Xóa custom",
    "picker.deleteItem": "Xóa {name}",
    "picker.customAppPlaceholder": "Nhập custom App ID",
    "picker.library": "Thư viện",
    "picker.libraryTitle": "Thư viện app RunningHub",

    // Thư viện RunningHub
    "rhlib.title": "Thư viện RunningHub",
    "rhlib.searchPlaceholder": "Tìm app theo tên…",
    "rhlib.categoryAria": "Danh mục",
    "rhlib.allCategories": "Tất cả danh mục",
    "rhlib.sortAria": "Sắp xếp",
    "rhlib.sort.recommend": "Đề xuất",
    "rhlib.sort.hottest": "Hot",
    "rhlib.sort.newest": "Mới nhất",
    "rhlib.results": "{count} kết quả",
    "rhlib.loadFailed": "Không tải được danh sách từ RunningHub — kiểm tra mạng rồi thử lại.",
    "rhlib.openOn": "Mở trên RunningHub",
    "rhlib.importNow": "Import & dùng ngay",

    // AppInfoCard
    "appInfo.plusWarning": "App chạy trên Plus GPU (48GB) — có thể tốn nhiều coin hơn.",

    // Preset
    "preset.exists": "Preset \"{name}\" đã tồn tại",
    "preset.namePlaceholder": "Tên preset",
    "preset.save": "Lưu preset",
    "preset.saveNew": "Lưu preset mới",
    "preset.none": "Không dùng preset",
    "preset.update": "Cập nhật {name}",
    "preset.delete": "Xóa preset",
    "preset.saveFailed": "Không thể lưu preset",

    // Field / thiết lập tham số
    "fields.title": "Thiết lập",
    "fields.loading": "Đang tải trường dữ liệu…",
    "fields.loadingRh": "Đang tải trường dữ liệu từ RunningHub…",
    "fields.scanningModels": "Đang quét checkpoint/LoRA từ ComfyUI…",
    "fields.choose": "Chọn {label}…",
    "fields.search": "Tìm {label}…",
    "fields.noChoices": "Không có lựa chọn",
    "fields.clearFile": "Xóa file ({name})",
    "fields.promptPlaceholder": "Mô tả thay đổi bạn muốn…",

    // Dropdown tìm kiếm
    "dropdown.placeholder": "Chọn model…",
    "dropdown.searchPlaceholder": "Tìm kiếm…",
    "dropdown.empty": "Không có model",
    "dropdown.loadingList": "Đang tải danh sách…",

    // Chạy / hàng đợi
    "run.runLabel": "Chạy {name}",
    "run.workflowFallback": "workflow",
    "run.running": "Đang chạy",
    "run.queue": "Hàng chờ",
    "run.waitSuffix": " (+{count} chờ)",
    "run.queueSuffix": " ({count})",
    "run.options": "Tùy chọn chạy",
    "run.processing": "{runner} đang xử lý…",
    "run.processingQueued": "{runner} đang xử lý ({count} trong hàng chờ)…",
    "run.completedOutputs": "Hoàn tất {count} output",
    "run.cancelled": "Đã hủy",
    "run.failed": "Chạy thất bại",
    "run.nextJob": "Chuyển sang job tiếp theo…",
    "run.nextJobRemaining": "Chuyển sang job tiếp theo ({count} còn lại)…",
    "run.selectFirst": "Hãy chọn template hoặc app",
    "run.importImageFirst": "Hãy import ảnh trước khi chạy",
    "run.importImageFor": "Hãy import ảnh cho \"{label}\" trước khi chạy",
    "run.needApiKey": "Cần RunningHub API Key để chạy lựa chọn này",
    "run.needApiKeyContextMenu": "Nhập RunningHub API Key để chạy ảnh từ menu chuột phải",
    "run.queued": "Đã thêm vào hàng chờ ({count})",
    "run.queueCleared": "Đã xóa hàng chờ",
    "run.stopping": "Đang dừng…",
    "run.jobsInQueue": "{count} job trong hàng chờ",
    "run.parallelRunning": "{runner} đang chạy song song:",

    // Output
    "output.selectAll": "Chọn tất cả",
    "output.downloadSelected": "Tải ảnh đã chọn ({count})",
    "output.deleteSelected": "Xóa ảnh đã chọn ({count})",
    "output.empty": "Output sẽ được lưu trong extension sau khi workflow hoàn tất.",
    "output.done": "Hoàn tất",
    "output.select": "Chọn {name}",
    "output.view": "Xem {name}",
    "output.download": "Tải {name}",
    "output.delete": "Xóa {name}",
    "output.deleteFailed": "Không thể xóa output đã chọn",

    // Lightbox
    "lightbox.view": "Xem ảnh",
    "lightbox.openTab": "Mở tab mới",
    "lightbox.download": "Tải ảnh",
    "lightbox.previous": "Ảnh trước",
    "lightbox.next": "Ảnh tiếp theo",

    // Settings
    "settings.title": "Cài đặt",
    "settings.closeAria": "Đóng Settings",
    "settings.intro": "Giao diện và thông tin kết nối được lưu cục bộ trong extension.",
    "settings.appearance": "Giao diện",
    "settings.themeLabel": "Chủ đề",
    "settings.theme.system": "Tự động theo trình duyệt",
    "settings.theme.dark": "Dark",
    "settings.theme.light": "Light",
    "settings.language": "Ngôn ngữ",
    "settings.language.auto": "Tự động theo trình duyệt",
    "settings.language.vi": "Tiếng Việt",
    "settings.language.en": "English",
    "settings.comfyServers": "ComfyUI servers",
    "settings.comfyPlaceholder": "http://127.0.0.1:8188 hoặc https://user:pass@host",
    "settings.addServer": "Thêm server",
    "settings.selectServer": "Dùng server này",
    "settings.noServers": "Chưa có server — thêm URL ComfyUI bên dưới.",
    "settings.comfyConnected": "Đã kết nối ComfyUI",
    "settings.comfyConnectFailed": "Không kết nối được ComfyUI",
    "settings.rhKeys": "RunningHub API keys",
    "settings.addKey": "Thêm key",
    "settings.keyPlaceholder": "Nhập RunningHub API key",
    "settings.noKeys": "Chưa có API key — thêm key để chạy RunningHub.",
    "settings.showKey": "Hiện API key",
    "settings.hideKey": "Ẩn API key",
    "settings.failoverNote": "Nhiều key: hết điểm hoặc bận sẽ tự chuyển key kế tiếp.",
    "settings.securityNote": "Extension gọi trực tiếp ComfyUI/RunningHub; không gửi key qua server aPix.",
    "settings.save": "Lưu Settings",
    "settings.saved": "Đã lưu Settings",
    "settings.comfyConnectedStatus": "ComfyUI đã kết nối",

    // Discovery ComfyUI
    "discovery.failed": "Không quét được model từ ComfyUI",

    // ComfyUI service
    "comfy.badCredentialUrl": "URL ComfyUI có user/password không hợp lệ cho trình duyệt. Dùng dạng https://user:pass@host hoặc host:user:pass.",
    "comfy.cannotConnect": "Không kết nối được ComfyUI. Kiểm tra ComfyUI đang chạy, URL đúng (vd. http://127.0.0.1:8188), và dùng --listen nếu kết nối từ máy khác.",
    "comfy.cannotConnectAt": "Không kết nối được ComfyUI tại {target}",
    "comfy.uploadFailed": "ComfyUI upload thất bại",
    "comfy.nodeNotFound": "Không tìm thấy node {node}",
    "comfy.fieldNotFound": "Không tìm thấy trường {field}",
    "comfy.interruptFailed": "ComfyUI interrupt thất bại: {status}",
    "comfy.uploadingImage": "Đang tải ảnh lên ComfyUI…",
    "comfy.missingImage": "Thiếu ảnh cho \"{label}\"",
    "comfy.queueing": "Đang đưa workflow vào hàng đợi…",
    "comfy.rejected": "ComfyUI từ chối workflow",
    "comfy.noPromptId": "ComfyUI không trả về prompt_id",
    "comfy.noOutputImages": "Workflow hoàn tất nhưng không có ảnh tại output node trong template.{status}",
    "comfy.retryDownload": "Đang thử tải lại output ComfyUI ({attempt})…",
    "comfy.downloadFailed": "Không thể tải output ComfyUI: {status}",
    "comfy.historyFailed": "Không đọc được ComfyUI history",
    "comfy.processing": "ComfyUI đang xử lý…",
    "comfy.timeout": "ComfyUI quá thời gian chờ 20 phút",
    "comfy.workflowLoadFailed": "Không thể tải workflow",
    "comfy.noResponse": "ComfyUI không phản hồi (extension background)",

    // RunningHub service
    "rh.noApiKey": "Chưa có RunningHub API key",
    "rh.switchKeyBusy": "Key #{from} đang bận — chuyển key #{to}…",
    "rh.switchKeyNoCredit": "Key #{from} hết điểm — chuyển key #{to}…",
    "rh.taskFailed": "RunningHub task thất bại",
    "rh.retryDownload": "Đang thử tải lại output ({attempt})…",
    "rh.recheckTask": "Kiểm tra lại trạng thái task…",
    "rh.downloadFailed": "Không tải được output",
    "rh.taskDoneRetry": "Task đã hoàn thành, thử tải lại output…",
    "rh.downloadFailedRetries": "Không tải được output sau nhiều lần thử",
    "rh.noOutputs": "RunningHub hoàn tất nhưng không có output",
    "rh.noUploadName": "RunningHub không trả về tên tệp đã tải lên",
    "rh.uploadingImage": "Đang tải ảnh lên RunningHub…",
    "rh.sendingApp": "Đang gửi AI App…",
    "rh.sendingWorkflow": "Đang gửi workflow…",
    "rh.noTaskId": "RunningHub không trả về taskId",
    "rh.reconnecting": "Mất kết nối, thử lại ({attempt}/5)…",
    "rh.downloadingOutputs": "Đang tải output…",
    "rh.processing": "RunningHub đang xử lý…",
    "rh.waitingQueue": "Đang chờ hàng đợi RunningHub…",
    "rh.timeout": "RunningHub quá thời gian chờ 20 phút",

    // Import template (lib)
    "tpl.manifestTooLarge": "{name} vượt quá giới hạn 2 MB",
    "tpl.fileTooLarge": "{label} vượt quá giới hạn {limit} MB",
    "tpl.dirModeUnsupported": "Chỉ ComfyUI và RH Workflow hỗ trợ import thư mục template",
    "tpl.invalidDir": "Thư mục template không hợp lệ",
    "tpl.dirTooLarge": "Thư mục quá lớn. Chỉ quét tối đa {entries} mục và sâu {depth} cấp.",
    "tpl.noValidComfyDir": "Không tìm thấy template hợp lệ có app_build và api.json",
    "tpl.noValidRhDir": "Không tìm thấy app_build có runninghub.workflowId",
    "tpl.emptyZip": "Tệp .zip rỗng",
    "tpl.noManifest": "Không tìm thấy app_build.json hoặc app_build.yaml trong thư mục",
    "tpl.noValidComfy": "Không có template hợp lệ: mỗi template ComfyUI cần app_build và api.json",
    "tpl.noValidRh": "Không có RH Workflow hợp lệ: app_build cần runninghub.workflowId",
    "tpl.invalidAppId": "RunningHub App ID phải là chuỗi số hợp lệ"
  },
  en: {
    // Common
    "common.loading": "Loading…",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.add": "Add",
    "common.delete": "Delete",
    "common.save": "Save",
    "common.test": "Test",
    "common.testing": "Testing",

    // App / topbar
    "app.status.ready": "Ready",
    "app.openSettings": "Open Settings",
    "app.modeChanged": "{mode} mode",
    "modes.aria": "Processing mode",

    // Image import
    "import.title": "Import image",
    "import.done": "Image imported",
    "import.fromWeb": "Importing image from the web…",
    "import.fromWebDone": "Image imported from the web",
    "import.failed": "Import failed",
    "import.autoRunPreparing": "Image received, preparing to run…",
    "import.dropHere": "Drop an image here",
    "import.chooseImage": "Choose image",
    "import.inputAlt": "Input image",
    "import.replace": "Replace image",
    "import.remove": "Remove image",
    "import.stagingReadFailed": "Could not read the staged image",
    "import.noImage": "No image to import",
    "import.fromWebFailed": "Could not import the image from this page",
    "import.downloadFailed": "Could not download the image ({status})",
    "import.notAnImage": "The selected file is not a valid image",
    "import.imageOnly": "aPix Builder only accepts image files",

    // Catalog / template / app
    "catalog.selected": "Selected {name}",
    "catalog.importedTemplates": "Imported {count} template(s)",
    "catalog.noDirPicker": "This Chrome version does not support secure folder picking. Please update Chrome.",
    "catalog.scanningFolder": "Scanning template folder…",
    "catalog.importFailed": "Template import failed",
    "catalog.unzipping": "Extracting template…",
    "catalog.zipFailed": ".zip import failed",
    "catalog.needApiKeyScan": "Enter your RunningHub API Key first to scan app info",
    "catalog.scanningApp": "Scanning RunningHub App info…",
    "catalog.addedApp": "Added {name}",
    "catalog.invalidAppId": "Invalid App ID",
    "catalog.removedItem": "Removed {name}",
    "catalog.loadTemplateFailed": "Could not load the template",

    // WorkflowPicker
    "picker.scanning": "Scanning",
    "picker.folder": "Folder",
    "picker.deleteCustom": "Delete custom",
    "picker.deleteItem": "Delete {name}",
    "picker.customAppPlaceholder": "Enter a custom App ID",
    "picker.library": "Library",
    "picker.libraryTitle": "RunningHub app library",

    // RunningHub library
    "rhlib.title": "RunningHub Library",
    "rhlib.searchPlaceholder": "Search apps by name…",
    "rhlib.categoryAria": "Category",
    "rhlib.allCategories": "All categories",
    "rhlib.sortAria": "Sort",
    "rhlib.sort.recommend": "Recommended",
    "rhlib.sort.hottest": "Hot",
    "rhlib.sort.newest": "Newest",
    "rhlib.results": "{count} results",
    "rhlib.loadFailed": "Could not load the list from RunningHub — check your connection and try again.",
    "rhlib.openOn": "Open on RunningHub",
    "rhlib.importNow": "Import & use now",

    // AppInfoCard
    "appInfo.plusWarning": "This app runs on Plus GPU (48GB) — it may cost more coins.",

    // Presets
    "preset.exists": "Preset \"{name}\" already exists",
    "preset.namePlaceholder": "Preset name",
    "preset.save": "Save preset",
    "preset.saveNew": "Save new preset",
    "preset.none": "No preset",
    "preset.update": "Update {name}",
    "preset.delete": "Delete preset",
    "preset.saveFailed": "Could not save the preset",

    // Parameter fields
    "fields.title": "Configure",
    "fields.loading": "Loading fields…",
    "fields.loadingRh": "Loading fields from RunningHub…",
    "fields.scanningModels": "Scanning checkpoints/LoRA from ComfyUI…",
    "fields.choose": "Choose {label}…",
    "fields.search": "Search {label}…",
    "fields.noChoices": "No options",
    "fields.clearFile": "Remove file ({name})",
    "fields.promptPlaceholder": "Describe the change you want…",

    // Searchable dropdown
    "dropdown.placeholder": "Choose a model…",
    "dropdown.searchPlaceholder": "Search…",
    "dropdown.empty": "No models",
    "dropdown.loadingList": "Loading list…",

    // Run / queue
    "run.runLabel": "Run {name}",
    "run.workflowFallback": "workflow",
    "run.running": "Running",
    "run.queue": "Queue",
    "run.waitSuffix": " (+{count} waiting)",
    "run.queueSuffix": " ({count})",
    "run.options": "Run options",
    "run.processing": "{runner} is processing…",
    "run.processingQueued": "{runner} is processing ({count} in queue)…",
    "run.completedOutputs": "Completed {count} output(s)",
    "run.cancelled": "Cancelled",
    "run.failed": "Run failed",
    "run.nextJob": "Moving to the next job…",
    "run.nextJobRemaining": "Moving to the next job ({count} left)…",
    "run.selectFirst": "Select a template or app first",
    "run.importImageFirst": "Import an image before running",
    "run.importImageFor": "Import an image for \"{label}\" before running",
    "run.needApiKey": "A RunningHub API Key is required to run this",
    "run.needApiKeyContextMenu": "Enter your RunningHub API Key to run images from the context menu",
    "run.queued": "Added to queue ({count})",
    "run.queueCleared": "Queue cleared",
    "run.stopping": "Stopping…",
    "run.jobsInQueue": "{count} job(s) in queue",
    "run.parallelRunning": "{runner} is running in parallel:",

    // Output
    "output.selectAll": "Select all",
    "output.downloadSelected": "Download selected ({count})",
    "output.deleteSelected": "Delete selected ({count})",
    "output.empty": "Outputs are stored in the extension once a workflow completes.",
    "output.done": "Done",
    "output.select": "Select {name}",
    "output.view": "View {name}",
    "output.download": "Download {name}",
    "output.delete": "Delete {name}",
    "output.deleteFailed": "Could not delete the selected outputs",

    // Lightbox
    "lightbox.view": "View image",
    "lightbox.openTab": "Open in new tab",
    "lightbox.download": "Download image",
    "lightbox.previous": "Previous image",
    "lightbox.next": "Next image",

    // Settings
    "settings.title": "Settings",
    "settings.closeAria": "Close Settings",
    "settings.intro": "Appearance and connection info are stored locally in the extension.",
    "settings.appearance": "Appearance",
    "settings.themeLabel": "Theme",
    "settings.theme.system": "Follow browser",
    "settings.theme.dark": "Dark",
    "settings.theme.light": "Light",
    "settings.language": "Language",
    "settings.language.auto": "Auto (browser language)",
    "settings.language.vi": "Tiếng Việt",
    "settings.language.en": "English",
    "settings.comfyServers": "ComfyUI servers",
    "settings.comfyPlaceholder": "http://127.0.0.1:8188 or https://user:pass@host",
    "settings.addServer": "Add server",
    "settings.selectServer": "Use this server",
    "settings.noServers": "No servers yet — add a ComfyUI URL below.",
    "settings.comfyConnected": "ComfyUI connected",
    "settings.comfyConnectFailed": "Could not connect to ComfyUI",
    "settings.rhKeys": "RunningHub API keys",
    "settings.addKey": "Add key",
    "settings.keyPlaceholder": "Enter a RunningHub API key",
    "settings.noKeys": "No API keys yet — add one to run RunningHub.",
    "settings.showKey": "Show API key",
    "settings.hideKey": "Hide API key",
    "settings.failoverNote": "Multiple keys: when one runs out of credits or is busy, the next one is used automatically.",
    "settings.securityNote": "The extension talks directly to ComfyUI/RunningHub; keys are never sent to aPix servers.",
    "settings.save": "Save Settings",
    "settings.saved": "Settings saved",
    "settings.comfyConnectedStatus": "ComfyUI connected",

    // ComfyUI discovery
    "discovery.failed": "Could not scan models from ComfyUI",

    // ComfyUI service
    "comfy.badCredentialUrl": "The ComfyUI URL has credentials the browser cannot use. Use https://user:pass@host or host:user:pass.",
    "comfy.cannotConnect": "Could not connect to ComfyUI. Check that it is running, the URL is correct (e.g. http://127.0.0.1:8188), and use --listen for remote access.",
    "comfy.cannotConnectAt": "Could not connect to ComfyUI at {target}",
    "comfy.uploadFailed": "ComfyUI upload failed",
    "comfy.nodeNotFound": "Node {node} not found",
    "comfy.fieldNotFound": "Field {field} not found",
    "comfy.interruptFailed": "ComfyUI interrupt failed: {status}",
    "comfy.uploadingImage": "Uploading image to ComfyUI…",
    "comfy.missingImage": "Missing image for \"{label}\"",
    "comfy.queueing": "Queueing the workflow…",
    "comfy.rejected": "ComfyUI rejected the workflow",
    "comfy.noPromptId": "ComfyUI did not return a prompt_id",
    "comfy.noOutputImages": "The workflow finished but produced no image at the template's output node.{status}",
    "comfy.retryDownload": "Retrying ComfyUI output download ({attempt})…",
    "comfy.downloadFailed": "Could not download the ComfyUI output: {status}",
    "comfy.historyFailed": "Could not read ComfyUI history",
    "comfy.processing": "ComfyUI is processing…",
    "comfy.timeout": "ComfyUI timed out after 20 minutes",
    "comfy.workflowLoadFailed": "Could not load the workflow",
    "comfy.noResponse": "ComfyUI did not respond (extension background)",

    // RunningHub service
    "rh.noApiKey": "No RunningHub API key yet",
    "rh.switchKeyBusy": "Key #{from} is busy — switching to key #{to}…",
    "rh.switchKeyNoCredit": "Key #{from} is out of credits — switching to key #{to}…",
    "rh.taskFailed": "RunningHub task failed",
    "rh.retryDownload": "Retrying output download ({attempt})…",
    "rh.recheckTask": "Re-checking task status…",
    "rh.downloadFailed": "Could not download the output",
    "rh.taskDoneRetry": "Task completed, retrying output download…",
    "rh.downloadFailedRetries": "Could not download the output after several attempts",
    "rh.noOutputs": "RunningHub finished but returned no output",
    "rh.noUploadName": "RunningHub did not return the uploaded file name",
    "rh.uploadingImage": "Uploading image to RunningHub…",
    "rh.sendingApp": "Sending AI App…",
    "rh.sendingWorkflow": "Sending workflow…",
    "rh.noTaskId": "RunningHub did not return a taskId",
    "rh.reconnecting": "Connection lost, retrying ({attempt}/5)…",
    "rh.downloadingOutputs": "Downloading outputs…",
    "rh.processing": "RunningHub is processing…",
    "rh.waitingQueue": "Waiting in the RunningHub queue…",
    "rh.timeout": "RunningHub timed out after 20 minutes",

    // Template import (lib)
    "tpl.manifestTooLarge": "{name} exceeds the 2 MB limit",
    "tpl.fileTooLarge": "{label} exceeds the {limit} MB limit",
    "tpl.dirModeUnsupported": "Only ComfyUI and RH Workflow support template folder import",
    "tpl.invalidDir": "Invalid template folder",
    "tpl.dirTooLarge": "Folder too large. Scans at most {entries} entries and {depth} levels deep.",
    "tpl.noValidComfyDir": "No valid template with app_build and api.json found",
    "tpl.noValidRhDir": "No app_build with runninghub.workflowId found",
    "tpl.emptyZip": "The .zip file is empty",
    "tpl.noManifest": "No app_build.json or app_build.yaml found in the folder",
    "tpl.noValidComfy": "No valid template: each ComfyUI template needs app_build and api.json",
    "tpl.noValidRh": "No valid RH Workflow: app_build needs runninghub.workflowId",
    "tpl.invalidAppId": "RunningHub App ID must be a numeric string"
  }
};

// Mặc định "vi" (đồng bộ hành vi cũ + test node không có navigator tiếng Việt);
// App root gọi setLanguage(resolveLanguage(settings.language)) ngay khi mount.
let currentLanguage = "vi";

/** "auto" → theo navigator.language (vi* → vi, còn lại en); "vi"/"en" giữ nguyên. */
export function resolveLanguage(pref) {
  if (pref === "vi" || pref === "en") return pref;
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return nav.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export function setLanguage(lang) {
  currentLanguage = lang === "en" ? "en" : "vi";
}

export function getLanguage() {
  return currentLanguage;
}

/** Locale định dạng số/giờ theo ngôn ngữ hiện hành. */
export function getLocale() {
  return currentLanguage === "en" ? "en-US" : "vi-VN";
}

/** Dịch key + thay {name} bằng params — dùng được cả trong services (non-React). */
export function t(key, params) {
  const message = messages[currentLanguage]?.[key] ?? messages.vi[key] ?? key;
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, name) => (params[name] != null ? String(params[name]) : match));
}

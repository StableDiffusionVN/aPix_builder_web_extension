// API nội bộ website RunningHub (không cần API key) — thư viện duyệt AI app.
// Không tài liệu chính thức: fail mềm, không ảnh hưởng phần chạy task.
// Tên tiếng Anh cần header Origin = site chính — do rule declarativeNetRequest 102 trong background.js set.

const BASE_URL = "https://www.runninghub.ai";

// Tên danh mục theo ID tag (ổn định) — hiển thị theo ngôn ngữ hiện hành bất kể API trả en/zh.
export const CATEGORY_NAMES = {
  "1671123934319734000": { vi: "Nhân vật ảo", en: "Virtual characters" },
  "1671123934319734090": { vi: "Tạo ảnh", en: "Image generation" },
  "1671123934319734091": { vi: "Tạo video", en: "Video generation" },
  "1671123934319734093": { vi: "Hiệu ứng video", en: "Video effects" },
  "1671123934319734094": { vi: "Anime", en: "Anime" },
  "1871151815242543118": { vi: "Chuyển phong cách", en: "Style transfer" },
  "1871151815242543119": { vi: "Poster", en: "Poster" },
  "1671123934319734092": { vi: "Tạo âm thanh", en: "Audio generation" },
  "1871151815242543115": { vi: "Chỉnh sửa ảnh", en: "Image editing" },
  "1871151815242543107": { vi: "Nhiếp ảnh", en: "Photography" },
  "1871151815242543108": { vi: "Phim & Game", en: "Film & Games" },
  "1671123934319734095": { vi: "Mô hình 3D", en: "3D models" },
  "1871151815242543109": { vi: "Sáng tạo", en: "Creative" },
  "1871151815242543110": { vi: "Thiết kế đồ họa", en: "Graphic design" },
  "1871151815242543111": { vi: "Thương mại điện tử", en: "E-commerce" },
  "1871151815242543112": { vi: "Thiết kế không gian", en: "Interior design" },
  "1871151815242543113": { vi: "Nghệ thuật cách điệu", en: "Stylized art" },
  "1871151815242543114": { vi: "API", en: "API" },
  "1875941016195789655": { vi: "Truyện tranh động AI", en: "AI motion comics" },
  "1871151815242543116": { vi: "Dựng video", en: "Video editing" },
  "1871151815242543117": { vi: "Khác", en: "Other" }
};

/** Tên danh mục theo ngôn ngữ ("vi"/"en") — fallback tên tag từ API. */
export function categoryName(tagId, lang, fallback = "") {
  const entry = CATEGORY_NAMES[tagId];
  if (!entry) return fallback;
  return entry[lang] || entry.vi || fallback;
}

// Header Origin (quyết định tên tiếng Anh) do STATIC rule trong dnr-rules.json set — luôn
// hoạt động ngay khi extension load. sendMessage chỉ là belt-and-braces cài thêm dynamic rule;
// await ack để lần fetch đầu không chạy trước khi rule sẵn sàng.
let headerRulesReady = null;
export function ensureLibraryHeaderRules() {
  if (!headerRulesReady) {
    headerRulesReady = (async () => {
      try {
        await chrome?.runtime?.sendMessage?.({ type: "apix-ensure-header-rules" });
      } catch { /* dev preview ngoài extension không có chrome.runtime */ }
    })();
  }
  return headerRulesReady;
}

// Một số app tác giả không có bản dịch — tên vẫn tiếng Trung kể cả khi gửi Origin.
// Từ điển cụm từ phổ biến trên RunningHub → thay thế bằng tiếng Anh (theo yêu cầu),
// giữ nguyên phần không nhận diện được; tên gốc vẫn hiện ở tooltip.
const CJK_RE = /[㐀-鿿぀-ヿ]/;
const CJK_PHRASES = [
  ["图生视频", "Image-to-Video"], ["文生视频", "Text-to-Video"], ["图生图", "Image-to-Image"],
  ["文生图", "Text-to-Image"], ["图生文", "Image-to-Text"], ["一键换装", "One-click outfit swap"],
  ["一键换脸", "One-click face swap"], ["换脸", "face swap"], ["换装", "outfit swap"],
  ["换衣", "outfit change"], ["一句话", "one-sentence"], ["一键", "one-click"],
  ["动作迁移", "motion transfer"], ["自动尺寸", "auto size"], ["高清修复", "HD restore"],
  ["高清", "HD"], ["修复", "restore"], ["放大", "upscale"], ["全能图片", "All-in-One Image"],
  ["全能", "all-in-one"], ["低价渠道版", "budget edition"], ["低价", "budget"],
  ["官方稳定版", "official stable"], ["官方", "official"], ["稳定", "stable"], ["渠道", "channel"],
  ["自定义提示词", "custom prompt"], ["提示词", "prompt"], ["多图", "multi-image"],
  ["单图", "single-image"], ["编辑流", "editing workflow"], ["编辑", "edit"],
  ["视频", "video"], ["图片", "image"], ["图像", "image"], ["照片", "photo"],
  ["写真", "portrait"], ["人像", "portrait"], ["真人", "realistic"], ["自用", "personal"],
  ["超强", "super"], ["极佳", "excellent"], ["塑型", "shaping"], ["角色替换", "character swap"],
  ["角色", "character"], ["风格转换", "style transfer"], ["风格", "style"], ["动漫", "anime"],
  ["模特", "model"], ["电商", "e-commerce"], ["海报", "poster"], ["直出", "direct output"],
  ["加密", "encrypted"], ["皮肤质感增强", "skin texture enhance"], ["质感", "texture"],
  ["皮肤", "skin"], ["细节", "detail"], ["增强", "enhance"], ["真实感", "realism"],
  ["增加", "add"], ["世界杯", "World Cup"], ["女装", "women's wear"], ["成片", "final image"],
  ["拼贴", "collage"], ["自由版", "free edition"], ["清凉", ""], ["版", "edition"],
  ["新", "new"], ["流", "workflow"], ["单", "single"], ["多", "multi"],
  ["【", " ["], ["】", "] "], ["（", " ("], ["）", ") "], ["、", ", "], ["，", ", "], ["！", "! "], ["：", ": "]
];

/** Dịch thay thế tên còn tiếng Trung bằng cụm từ tiếng Anh phổ biến; trả nguyên bản nếu không có CJK. */
export function translateCjkName(name = "") {
  if (!CJK_RE.test(name)) return name;
  let result = name;
  // Đệm khoảng trắng quanh bản dịch để các cụm liền nhau không dính chữ.
  for (const [zh, en] of CJK_PHRASES) result = result.split(zh).join(en ? ` ${en} ` : " ");
  return result
    .replace(/\s+([,.!:)\]])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim() || name;
}

async function post(pathname, body, signal) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  const payload = await response.json();
  if (payload.code !== 0 && payload.code !== "0") {
    throw new Error(payload.msg || `RunningHub library error ${payload.code}`);
  }
  return payload.data;
}

export async function fetchRhLibraryTags(signal) {
  await ensureLibraryHeaderRules();
  const raw = await post("/api/portal/tag/tree", { rang: "WEBAPP" }, signal);
  return (Array.isArray(raw) ? raw : [])
    .filter(tag => tag?.id)
    .map(tag => ({
      id: String(tag.id),
      name: tag.name || "",
      children: (tag.childTags || []).filter(child => child?.id).map(child => ({
        id: String(child.id),
        name: child.name || ""
      }))
    }));
}

function normalizeRecord(record) {
  if (!record?.id) return null;
  const cover = record.preview || record.covers?.[0] || null;
  const coverUrl = cover?.url || "";
  const stats = record.statisticsInfo || {};
  const rawName = record.name || String(record.id);
  return {
    id: String(record.id),
    name: translateCjkName(rawName),
    originalName: rawName,
    coverUrl: /\.(mp4|webm|mov)(\?|$)/i.test(coverUrl) ? "" : (cover?.thumbnailUri || coverUrl),
    coverIsVideo: /\.(mp4|webm|mov)(\?|$)/i.test(coverUrl),
    useCount: Number(stats.useCount) || 0,
    likeCount: Number(stats.likeCount) || 0,
    tagNames: (record.tags || []).map(tag => tag?.name).filter(Boolean)
  };
}

export async function fetchRhLibraryList({ tags = [], search = "", sort = "RECOMMEND", page = 1, size = 30 } = {}, signal) {
  await ensureLibraryHeaderRules();
  const body = { current: Math.max(1, page), size, tags, sort };
  const keyword = String(search || "").trim();
  if (keyword) body.search = keyword;
  if (sort === "HOTTEST") body.days = 3;
  const raw = await post("/api/webapp/list", body, signal);
  return {
    total: Number(raw?.total) || 0,
    records: (raw?.records || []).map(normalizeRecord).filter(Boolean)
  };
}

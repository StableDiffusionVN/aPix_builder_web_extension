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

// Rule DNR set Origin (tên app tiếng Anh) cài ở background — nhắc cài lại mỗi lần mở thư viện
// (phòng trường hợp onInstalled chưa chạy sau khi update extension).
export function ensureLibraryHeaderRules() {
  try {
    chrome?.runtime?.sendMessage?.({ type: "apix-ensure-header-rules" });
  } catch { /* dev preview ngoài extension không có chrome.runtime */ }
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
  return {
    id: String(record.id),
    name: record.name || String(record.id),
    coverUrl: /\.(mp4|webm|mov)(\?|$)/i.test(coverUrl) ? "" : (cover?.thumbnailUri || coverUrl),
    coverIsVideo: /\.(mp4|webm|mov)(\?|$)/i.test(coverUrl),
    useCount: Number(stats.useCount) || 0,
    likeCount: Number(stats.likeCount) || 0,
    tagNames: (record.tags || []).map(tag => tag?.name).filter(Boolean)
  };
}

export async function fetchRhLibraryList({ tags = [], search = "", sort = "RECOMMEND", page = 1, size = 30 } = {}, signal) {
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

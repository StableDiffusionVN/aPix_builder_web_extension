// API nội bộ website RunningHub (không cần API key) — thư viện duyệt AI app.
// Không tài liệu chính thức: fail mềm, không ảnh hưởng phần chạy task.
// Tên tiếng Anh cần header Origin = site chính — do rule declarativeNetRequest 102 trong background.js set.

const BASE_URL = "https://www.runninghub.ai";

// Tên danh mục theo ID tag (ổn định) — hiển thị tiếng Việt bất kể API trả en/zh.
export const CATEGORY_NAMES_VI = {
  "1671123934319734000": "Nhân vật ảo",
  "1671123934319734090": "Tạo ảnh",
  "1671123934319734091": "Tạo video",
  "1671123934319734093": "Hiệu ứng video",
  "1671123934319734094": "Anime",
  "1871151815242543118": "Chuyển phong cách",
  "1871151815242543119": "Poster",
  "1671123934319734092": "Tạo âm thanh",
  "1871151815242543115": "Chỉnh sửa ảnh",
  "1871151815242543107": "Nhiếp ảnh",
  "1871151815242543108": "Phim & Game",
  "1671123934319734095": "Mô hình 3D",
  "1871151815242543109": "Sáng tạo",
  "1871151815242543110": "Thiết kế đồ họa",
  "1871151815242543111": "Thương mại điện tử",
  "1871151815242543112": "Thiết kế không gian",
  "1871151815242543113": "Nghệ thuật cách điệu",
  "1871151815242543114": "API",
  "1875941016195789655": "Truyện tranh động AI",
  "1871151815242543116": "Dựng video",
  "1871151815242543117": "Khác"
};

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

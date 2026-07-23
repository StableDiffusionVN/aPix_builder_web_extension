// API nội bộ website RunningHub (không cần API key) — thư viện duyệt AI app.
// Không tài liệu chính thức: fail mềm, không ảnh hưởng phần chạy task.
// Tên tiếng Anh cần header Origin = site chính — do rule declarativeNetRequest 102 trong background.js set.

const BASE_URL = "https://www.runninghub.ai";

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

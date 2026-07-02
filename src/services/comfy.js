import { blobToBase64, comfyFetch } from "../lib/comfyBridge.js";
import { buildComfyUrlCandidates, parseComfyTarget } from "../lib/comfyTarget.js";
import { expandActiveFields } from "../lib/catalog.js";
import { fetchWithRetry } from "../lib/fetchRetry.js";

export { buildComfyUrlCandidates, parseComfyTarget as normalizeTarget } from "../lib/comfyTarget.js";

const HEALTH_PATHS = ["/system_stats", "/features", "/queue"];
const API_PREFIXES = ["", "/api"];

let resolvedSession = null;

export function resetComfySession() {
  resolvedSession = null;
}

function formatComfyConnectionError(error, target) {
  const message = String(error?.message || error || "");
  if (/credentials|cannot be constructed from a url/i.test(message)) {
    return "URL ComfyUI có user/password không hợp lệ cho trình duyệt. Dùng dạng https://user:pass@host hoặc host:user:pass.";
  }
  if (/failed to fetch|networkerror|network error/i.test(message)) {
    return "Không kết nối được ComfyUI. Kiểm tra ComfyUI đang chạy, URL đúng (vd. http://127.0.0.1:8188), và dùng --listen nếu kết nối từ máy khác.";
  }
  return message || `Không kết nối được ComfyUI tại ${target.label}`;
}

async function probeComfyEndpoint(url, authHeaders, signal) {
  const response = await comfyFetch(url, { signal, authHeaders });
  return response.ok;
}

export async function resolveComfySession(url, signal) {
  const target = parseComfyTarget(url);
  if (resolvedSession?.input === target.input) return resolvedSession;

  let lastError = null;
  for (const baseUrl of buildComfyUrlCandidates(target)) {
    for (const apiPrefix of API_PREFIXES) {
      for (const path of HEALTH_PATHS) {
        try {
          if (await probeComfyEndpoint(`${baseUrl}${apiPrefix}${path}`, target.authHeaders, signal)) {
            resolvedSession = {
              input: target.input,
              httpBase: baseUrl,
              apiPrefix,
              authHeaders: target.authHeaders
            };
            return resolvedSession;
          }
        } catch (error) {
          lastError = error;
          if (signal?.aborted || error?.name === "AbortError") throw error;
        }
      }
    }
  }

  throw new Error(formatComfyConnectionError(lastError, target));
}

async function assertOk(response, label) {
  if (!response.ok) throw new Error(`${label}: ${response.status} ${await response.text()}`);
  return response;
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Đã hủy", "AbortError"));
    }, { once: true });
  });
}

async function uploadImage(session, image, signal) {
  const name = `apix_web_${Date.now()}_${image.name || "input.png"}`;
  const response = await assertOk(await comfyFetch(`${session.httpBase}${session.apiPrefix}/upload/image`, {
    method: "POST",
    signal,
    authHeaders: session.authHeaders,
    multipart: [
      {
        name: "image",
        file: true,
        filename: name,
        mimeType: image.blob.type || "image/png",
        base64: await blobToBase64(image.blob)
      },
      { name: "type", value: "input" },
      { name: "overwrite", value: "true" }
    ]
  }), "ComfyUI upload thất bại");
  return response.json();
}

function resolveWorkflowPath(workflow, id) {
  const [nodeId, ...rest] = String(id).split("-");
  const rawPath = rest[0] === "inputs" ? rest.slice(1).join("-") : rest.join("-");
  const inputs = workflow[nodeId]?.inputs;
  if (!inputs) throw new Error(`Không tìm thấy node ${nodeId}`);
  // Ưu tiên key phẳng: một số node ComfyUI dùng tên input có dấu chấm (vd "resize_type.longer_size").
  if (Object.prototype.hasOwnProperty.call(inputs, rawPath)) {
    return { target: inputs, key: rawPath };
  }
  const path = rawPath.split(".").filter(Boolean);
  let cursor = inputs;
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index]];
    if (!cursor || typeof cursor !== "object") throw new Error(`Không tìm thấy trường ${rawPath}`);
  }
  return { target: cursor, key: path.at(-1) };
}

function assignValue(workflow, id, value) {
  const { target, key } = resolveWorkflowPath(workflow, id);
  const current = target[key];
  if (typeof current === "number") {
    const parsed = Number(value);
    target[key] = Number.isFinite(parsed) ? parsed : value;
  } else {
    target[key] = value;
  }
}

export async function interruptComfyWorkflow(url) {
  const session = resolvedSession || await resolveComfySession(url);
  const response = await comfyFetch(`${session.httpBase}${session.apiPrefix}/interrupt`, {
    method: "POST",
    authHeaders: session.authHeaders
  });
  if (!response.ok) {
    throw new Error(`ComfyUI interrupt thất bại: ${response.status}`);
  }
}

export async function testComfyConnection(url, signal) {
  await resolveComfySession(url, signal);
  return true;
}

export function collectComfyOutputImages(config, historyEntry) {
  const outputIds = Object.values(config?.output || {}).map(item => String(item.id));
  const images = [];
  for (const nodeId of outputIds) {
    for (const image of historyEntry?.outputs?.[nodeId]?.images || []) {
      images.push({ ...image, nodeId });
    }
  }
  return images;
}

export async function runComfyWorkflow({ url, workflowUrl, workflow: inlineWorkflow, config, fields, values, images = {}, signal, onStatus }) {
  const session = await resolveComfySession(url, signal);
  let workflow;
  if (inlineWorkflow) {
    workflow = typeof structuredClone === "function"
      ? structuredClone(inlineWorkflow)
      : JSON.parse(JSON.stringify(inlineWorkflow));
  } else {
    const workflowResponse = await assertOk(await fetch(workflowUrl), "Không thể tải workflow");
    workflow = await workflowResponse.json();
  }
  // Mỗi field ảnh có record riêng (images: field.key → record); cache upload theo record
  // để hai field dùng chung một ảnh chỉ tải lên một lần.
  const uploadCache = new Map();

  // menu-sub → bung thành field con đang chọn (chỉ nhánh active được gán).
  for (const field of expandActiveFields(fields, values)) {
    const type = field.ui.type;
    if (["image", "image_mask", "file"].includes(type)) {
      const record = images[field.key];
      if (!record) throw new Error(`Thiếu ảnh cho "${field.ui.label || field.key}"`);
      const cacheKey = record.id || record;
      if (!uploadCache.has(cacheKey)) {
        onStatus?.("Đang tải ảnh lên ComfyUI…");
        uploadCache.set(cacheKey, await uploadImage(session, record, signal));
      }
      const uploaded = uploadCache.get(cacheKey);
      assignValue(workflow, field.id, uploaded.name || uploaded.filename || uploaded.image);
      continue;
    }
    const value = values[field.key];
    if (value === "" || value == null) continue;
    assignValue(workflow, field.id, value === "random_seed" ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) : value);
  }

  onStatus?.("Đang đưa workflow vào hàng đợi…");
  const queuedResponse = await assertOk(await comfyFetch(`${session.httpBase}${session.apiPrefix}/prompt`, {
    method: "POST",
    json: { prompt: workflow, client_id: crypto.randomUUID() },
    signal,
    authHeaders: session.authHeaders
  }), "ComfyUI từ chối workflow");
  const queued = await queuedResponse.json();
  if (!queued.prompt_id) throw new Error("ComfyUI không trả về prompt_id");

  const history = await waitForHistory(session, queued.prompt_id, signal, onStatus);
  const entry = history[queued.prompt_id];
  const outputImages = collectComfyOutputImages(config, entry);
  if (!outputImages.length) {
    const status = entry?.status ? ` Status: ${JSON.stringify(entry.status)}` : "";
    throw new Error(`Workflow hoàn tất nhưng không có ảnh tại output node trong template.${status}`);
  }

  return Promise.all(outputImages.map(async (output, index) => {
    const query = new URLSearchParams({
      filename: output.filename,
      subfolder: output.subfolder || "",
      type: output.type || "output"
    });
    const response = await fetchWithRetry(`${session.httpBase}${session.apiPrefix}/view?${query}`, {
      signal,
      fetchFn: (targetUrl, options) => comfyFetch(targetUrl, {
        ...options,
        authHeaders: session.authHeaders
      }),
      onRetry: ({ attempt }) => {
        onStatus?.(`Đang thử tải lại output ComfyUI (${attempt})…`);
      }
    });
    if (!response.ok) throw new Error(`Không thể tải output ComfyUI: ${response.status}`);
    return { blob: await response.blob(), name: output.filename || `comfy-${Date.now()}-${index}.png` };
  }));
}

async function waitForHistory(session, promptId, signal, onStatus) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20 * 60 * 1000) {
    const response = await assertOk(
      await comfyFetch(`${session.httpBase}${session.apiPrefix}/history/${promptId}`, {
        signal,
        authHeaders: session.authHeaders
      }),
      "Không đọc được ComfyUI history"
    );
    const history = await response.json();
    if (history[promptId]) return history;
    onStatus?.("ComfyUI đang xử lý…");
    await delay(1200, signal);
  }
  throw new Error("ComfyUI quá thời gian chờ 20 phút");
}

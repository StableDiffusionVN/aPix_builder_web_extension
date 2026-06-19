import { fetchWithRetry } from "../lib/fetchRetry.js";

function normalizeTarget(raw) {
  const value = String(raw || "http://127.0.0.1:8188").trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(value) ? value : `http://${value}`;
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

async function uploadImage(baseUrl, image, signal) {
  const form = new FormData();
  const name = `apix_web_${Date.now()}_${image.name || "input.png"}`;
  form.append("image", image.blob, name);
  form.append("type", "input");
  form.append("overwrite", "true");
  const response = await assertOk(await fetch(`${baseUrl}/upload/image`, {
    method: "POST",
    body: form,
    signal
  }), "ComfyUI upload thất bại");
  return response.json();
}

function resolveWorkflowPath(workflow, id) {
  const [nodeId, ...rest] = String(id).split("-");
  const rawPath = rest[0] === "inputs" ? rest.slice(1).join("-") : rest.join("-");
  const path = rawPath.split(".").filter(Boolean);
  let cursor = workflow[nodeId]?.inputs;
  if (!cursor) throw new Error(`Không tìm thấy node ${nodeId}`);
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

export async function testComfyConnection(url, signal) {
  const baseUrl = normalizeTarget(url);
  await assertOk(await fetch(`${baseUrl}/system_stats`, { signal }), "Không kết nối được ComfyUI");
  return true;
}

export async function runComfyWorkflow({ url, workflowUrl, workflow: inlineWorkflow, fields, values, image, signal, onStatus }) {
  const baseUrl = normalizeTarget(url);
  let workflow;
  if (inlineWorkflow) {
    workflow = typeof structuredClone === "function"
      ? structuredClone(inlineWorkflow)
      : JSON.parse(JSON.stringify(inlineWorkflow));
  } else {
    const workflowResponse = await assertOk(await fetch(workflowUrl), "Không thể tải workflow");
    workflow = await workflowResponse.json();
  }
  let uploaded;

  for (const field of fields) {
    const type = field.ui.type;
    if (["image", "image_mask", "file"].includes(type)) {
      if (!uploaded) {
        onStatus?.("Đang tải ảnh lên ComfyUI…");
        uploaded = await uploadImage(baseUrl, image, signal);
      }
      assignValue(workflow, field.id, uploaded.name || uploaded.filename || uploaded.image);
      continue;
    }
    const value = values[field.key];
    if (value === "" || value == null) continue;
    assignValue(workflow, field.id, value === "random_seed" ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) : value);
  }

  onStatus?.("Đang đưa workflow vào hàng đợi…");
  const queuedResponse = await assertOk(await fetch(`${baseUrl}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() }),
    signal
  }), "ComfyUI từ chối workflow");
  const queued = await queuedResponse.json();
  if (!queued.prompt_id) throw new Error("ComfyUI không trả về prompt_id");

  const history = await waitForHistory(baseUrl, queued.prompt_id, signal, onStatus);
  const entry = history[queued.prompt_id];
  const images = Object.values(entry?.outputs || {}).flatMap(output => output.images || []);
  if (!images.length) throw new Error("Workflow hoàn tất nhưng không có output ảnh");

  return Promise.all(images.map(async (output, index) => {
    const query = new URLSearchParams({
      filename: output.filename,
      subfolder: output.subfolder || "",
      type: output.type || "output"
    });
    const response = await fetchWithRetry(`${baseUrl}/view?${query}`, {
      signal,
      onRetry: ({ attempt }) => {
        onStatus?.(`Đang thử tải lại output ComfyUI (${attempt})…`);
      }
    });
    if (!response.ok) throw new Error(`Không thể tải output ComfyUI: ${response.status}`);
    return { blob: await response.blob(), name: output.filename || `comfy-${Date.now()}-${index}.png` };
  }));
}

async function waitForHistory(baseUrl, promptId, signal, onStatus) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20 * 60 * 1000) {
    const response = await assertOk(await fetch(`${baseUrl}/history/${promptId}`, { signal }), "Không đọc được ComfyUI history");
    const history = await response.json();
    if (history[promptId]) return history;
    onStatus?.("ComfyUI đang xử lý…");
    await delay(1200, signal);
  }
  throw new Error("ComfyUI quá thời gian chờ 20 phút");
}

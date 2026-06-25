import { fetchWithRetry } from "../lib/fetchRetry.js";

const BASE_URL = "https://www.runninghub.ai";

function headers(apiKey, extra = {}) {
  return { ...extra, Authorization: `Bearer ${apiKey}` };
}

class RhError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "RhError";
    this.code = code;
  }
}

async function readEnvelope(response) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `RunningHub HTTP ${response.status}`);
  }
  if (!response.ok || (payload.code != null && payload.code !== 0)) {
    const message = payload.msg || payload.message || `RunningHub HTTP ${response.status}`;
    throw new RhError(message, payload.code);
  }
  return payload;
}

// Lỗi hết điểm (insufficient coins) → thử key khác.
function isRhInsufficientCoins(error) {
  const code = Number(error?.code);
  if ([1001, 1002, 1004, 1006, 1007].includes(code)) return true;
  return /coin|balance|insufficient|credit|hết|không đủ|不足|余额|积分/i.test(String(error?.message || ""));
}

// Lỗi hàng đợi đầy / key bận (TASK_QUEUE_MAXED) → thử key khác.
function isRhQueueMaxed(error) {
  const code = Number(error?.code);
  if (code === 421 || code === 415) return true;
  return /TASK_QUEUE_MAXED/i.test(String(error?.message || "")) || /queue.*max/i.test(String(error?.message || ""));
}

// Tách chuỗi key thành danh sách (mỗi dòng hoặc dấu phẩy một key) → pool failover.
function parseRhApiKeys(apiKey) {
  return String(apiKey || "").split(/[\n,]+/).map(key => key.trim()).filter(Boolean);
}

// Chạy qua pool key: hết điểm/bận → tự chuyển key kế.
async function runWithRhFailover(apiKey, onStatus, runOnce) {
  const keys = parseRhApiKeys(apiKey);
  if (!keys.length) throw new Error("Chưa có RunningHub API key");
  let lastError;
  for (let index = 0; index < keys.length; index += 1) {
    try {
      return await runOnce(keys[index]);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = error;
      const retryable = isRhInsufficientCoins(error) || isRhQueueMaxed(error);
      if (retryable && index < keys.length - 1) {
        const reason = isRhQueueMaxed(error) ? "đang bận" : "hết điểm";
        onStatus?.(`Key #${index + 1} ${reason} — chuyển key #${index + 2}…`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
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

function isRhTaskSuccessCode(code) {
  return code === 0 || code === "0";
}

function normalizeRhOutputList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.outputs)) return data.outputs;
  if (data.fileUrl || data.url || data.remoteUrl) return [data];
  return [];
}

function outputUrl(output) {
  return output?.fileUrl || output?.url || output?.remoteUrl || "";
}

function rhTaskFailureMessage(payload) {
  return payload.data?.failedReason?.exception_message || payload.msg || "RunningHub task thất bại";
}

async function queryTaskOutputs(apiKey, taskId, signal) {
  const response = await fetch(`${BASE_URL}/task/openapi/outputs`, {
    method: "POST",
    headers: headers(apiKey, { "content-type": "application/json" }),
    body: JSON.stringify({ apiKey, taskId }),
    signal
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `RunningHub HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(payload.msg || payload.message || text || `RunningHub HTTP ${response.status}`);
  }
  return payload;
}

async function downloadOutputBlob(url, signal, onStatus) {
  const response = await fetchWithRetry(url, {
    signal,
    onRetry: ({ attempt }) => {
      onStatus?.(`Đang thử tải lại output (${attempt})…`);
    }
  });
  return response.blob();
}

function outputNameFromUrl(url, index) {
  const pathname = new URL(url).pathname;
  return pathname.split("/").filter(Boolean).pop() || `runninghub-${Date.now()}-${index}.png`;
}

async function downloadRhOutputs(apiKey, taskId, outputs, signal, onStatus) {
  const list = normalizeRhOutputList(outputs);
  const results = [];

  for (let index = 0; index < list.length; index += 1) {
    const url = outputUrl(list[index]);
    if (!url) continue;

    let downloadError = null;
    try {
      const blob = await downloadOutputBlob(url, signal, onStatus);
      results.push({ blob, name: outputNameFromUrl(url, index) });
      continue;
    } catch (error) {
      downloadError = error;
      if (signal?.aborted || error?.name === "AbortError") throw error;
    }

    onStatus?.("Kiểm tra lại trạng thái task…");
    const refreshed = await queryTaskOutputs(apiKey, taskId, signal);
    if (refreshed.code === 805) throw new Error(rhTaskFailureMessage(refreshed));
    if (!isRhTaskSuccessCode(refreshed.code)) {
      throw new Error(downloadError?.message || "Không tải được output");
    }

    const refreshedList = normalizeRhOutputList(refreshed.data);
    const freshUrl = outputUrl(refreshedList[index]) || outputUrl(refreshedList.find(item => outputUrl(item)));
    if (!freshUrl) continue;

    onStatus?.("Task đã hoàn thành, thử tải lại output…");
    try {
      const blob = await downloadOutputBlob(freshUrl, signal, onStatus);
      results.push({ blob, name: outputNameFromUrl(freshUrl, index) });
    } catch (retryError) {
      if (signal?.aborted || retryError?.name === "AbortError") throw retryError;
    }
  }

  if (results.length) return results;

  const final = await queryTaskOutputs(apiKey, taskId, signal);
  if (final.code === 805) throw new Error(rhTaskFailureMessage(final));
  if (isRhTaskSuccessCode(final.code) && normalizeRhOutputList(final.data).some(item => outputUrl(item))) {
    throw new Error("Không tải được output sau nhiều lần thử");
  }
  throw new Error("RunningHub hoàn tất nhưng không có output");
}

export async function getAppDefinition(apiKey, webappId, signal) {
  const query = new URLSearchParams({ apiKey, webappId });
  const response = await fetch(`${BASE_URL}/api/webapp/apiCallDemo?${query}`, {
    headers: headers(apiKey),
    signal
  });
  const payload = await readEnvelope(response);
  const data = payload.data || {};
  const info = {
    webappId: String(webappId),
    webappName: String(data.webappName || "RunningHub App").trim(),
    accessEncrypted: Boolean(data.accessEncrypted),
    statisticsInfo: data.statisticsInfo && typeof data.statisticsInfo === "object" ? data.statisticsInfo : null,
    covers: Array.isArray(data.covers) ? data.covers : [],
    tags: Array.isArray(data.tags) ? data.tags : []
  };
  return {
    name: info.webappName,
    nodes: Array.isArray(data.nodeInfoList) ? data.nodeInfoList : [],
    info
  };
}

export async function uploadImage(apiKey, image, signal) {
  const form = new FormData();
  form.append("apiKey", apiKey);
  form.append("fileType", "input");
  form.append("file", image.blob, image.name || `apix-${Date.now()}.png`);
  const response = await fetch(`${BASE_URL}/task/openapi/upload`, {
    method: "POST",
    headers: headers(apiKey),
    body: form,
    signal
  });
  const payload = await readEnvelope(response);
  if (!payload.data?.fileName) throw new Error("RunningHub không trả về tên tệp đã tải lên");
  return payload.data.fileName;
}

function parseFieldId(id) {
  const parts = String(id || "").split("-");
  return { nodeId: parts.shift() || "", fieldName: parts.join("-") };
}

function isMediaType(type) {
  return ["IMAGE", "AUDIO", "VIDEO"].includes(String(type || "").toUpperCase());
}

export async function prepareNodes(apiKey, nodes, image, signal, onStatus) {
  let uploadedName = "";
  const prepared = [];
  for (const node of nodes) {
    let value = node.fieldValue ?? "";
    if (isMediaType(node.fieldType) && image) {
      if (!uploadedName) {
        onStatus?.("Đang tải ảnh lên RunningHub…");
        uploadedName = await uploadImage(apiKey, image, signal);
      }
      value = uploadedName;
    } else if (value === "random_seed") {
      value = String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    } else if (value != null && typeof value !== "string") {
      value = String(value);
    }
    prepared.push({
      nodeId: String(node.nodeId),
      fieldName: node.fieldName,
      fieldValue: value ?? ""
    });
  }
  return prepared;
}

export function configFieldsToNodes(fields, values, image) {
  return fields.map(field => {
    const { nodeId, fieldName } = parseFieldId(field.id);
    const imageField = ["image", "image_mask", "file"].includes(field.ui.type);
    return {
      nodeId,
      fieldName,
      fieldType: imageField ? "IMAGE" : String(field.ui.type || "STRING").toUpperCase(),
      fieldValue: imageField ? image : values[field.key]
    };
  });
}

export async function runRunningHubApp({ apiKey, webappId, nodes, image, signal, onStatus }) {
  return runWithRhFailover(apiKey, onStatus, async key => {
    const nodeInfoList = await prepareNodes(key, nodes, image, signal, onStatus);
    onStatus?.("Đang gửi AI App…");
    const response = await fetch(`${BASE_URL}/task/openapi/ai-app/run`, {
      method: "POST",
      headers: headers(key, { "content-type": "application/json" }),
      body: JSON.stringify({ apiKey: key, webappId, nodeInfoList }),
      signal
    });
    const payload = await readEnvelope(response);
    return waitForOutputs(key, payload.data?.taskId, signal, onStatus);
  });
}

export async function runRunningHubWorkflow({ apiKey, workflowId, nodes, image, signal, onStatus }) {
  return runWithRhFailover(apiKey, onStatus, async key => {
    const nodeInfoList = await prepareNodes(key, nodes, image, signal, onStatus);
    onStatus?.("Đang gửi workflow…");
    const response = await fetch(`${BASE_URL}/task/openapi/create`, {
      method: "POST",
      headers: headers(key, { "content-type": "application/json" }),
      body: JSON.stringify({ apiKey: key, workflowId, nodeInfoList }),
      signal
    });
    const payload = await readEnvelope(response);
    return waitForOutputs(key, payload.data?.taskId, signal, onStatus);
  });
}

// Huỷ task trên server RunningHub (best-effort) — cần taskId; tránh để task chạy tiếp khi user dừng.
export async function cancelRunningHubTask(apiKey, taskId) {
  const id = String(taskId || "").trim();
  if (!apiKey || !id) return;
  try {
    await fetch(`${BASE_URL}/task/openapi/cancel`, {
      method: "POST",
      headers: headers(apiKey, { "content-type": "application/json" }),
      body: JSON.stringify({ apiKey, taskId: id })
    });
  } catch {
    // best-effort, bỏ qua lỗi
  }
}

async function waitForOutputs(apiKey, taskId, signal, onStatus) {
  if (!taskId) throw new Error("RunningHub không trả về taskId");
  try {
    return await pollOutputs(apiKey, taskId, signal, onStatus);
  } catch (error) {
    // User dừng → huỷ task trên server (không truyền signal đã abort để cancel vẫn gửi được).
    if (signal?.aborted || error?.name === "AbortError") {
      void cancelRunningHubTask(apiKey, taskId);
    }
    throw error;
  }
}

async function pollOutputs(apiKey, taskId, signal, onStatus) {
  const startedAt = Date.now();
  let pollErrors = 0;

  while (Date.now() - startedAt < 10 * 60 * 1000) {
    let payload;
    try {
      payload = await queryTaskOutputs(apiKey, taskId, signal);
      pollErrors = 0;
    } catch (pollError) {
      if (signal?.aborted || pollError?.name === "AbortError") throw pollError;
      pollErrors += 1;
      if (pollErrors >= 5) throw pollError;
      onStatus?.(`Mất kết nối, thử lại (${pollErrors}/5)…`);
      await delay(2500, signal);
      continue;
    }

    if (isRhTaskSuccessCode(payload.code) && payload.data) {
      const list = normalizeRhOutputList(payload.data);
      if (list.some(item => outputUrl(item))) {
        onStatus?.("Đang tải output…");
        return downloadRhOutputs(apiKey, taskId, list, signal, onStatus);
      }
    }
    if (payload.code === 805) throw new Error(rhTaskFailureMessage(payload));

    if (payload.code === 804) {
      onStatus?.("RunningHub đang xử lý…");
    } else if (payload.code === 813) {
      onStatus?.("Đang chờ hàng đợi RunningHub…");
    } else {
      onStatus?.("RunningHub đang xử lý…");
    }
    await delay(3500, signal);
  }
  throw new Error("RunningHub quá thời gian chờ 10 phút");
}

import { hasChromeRuntime } from "./chromeBridge.js";
import { t } from "./i18n.js";
import { sanitizeComfyFetchUrl } from "./comfyTarget.js";

export function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return uint8ArrayToBase64(bytes);
}

function createComfyResponse(data) {
  const bytes = base64ToUint8Array(data.bodyBase64);
  const contentType = data.contentType || "application/octet-stream";
  return {
    ok: data.ok,
    status: data.status,
    statusText: data.statusText || "",
    headers: {
      get(name) {
        return String(name).toLowerCase() === "content-type" ? contentType : null;
      }
    },
    async json() {
      return JSON.parse(new TextDecoder().decode(bytes));
    },
    async text() {
      return new TextDecoder().decode(bytes);
    },
    async blob() {
      return new Blob([bytes], { type: contentType });
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

export async function comfyFetch(url, options = {}) {
  const { method = "GET", headers = {}, authHeaders = {}, json, multipart, signal } = options;
  const safeUrl = sanitizeComfyFetchUrl(url);
  const mergedHeaders = { ...authHeaders, ...headers };

  if (signal?.aborted) {
    throw signal.reason || new DOMException("Đã hủy", "AbortError");
  }

  if (!hasChromeRuntime()) {
    const init = { method, headers: { ...mergedHeaders }, signal };
    if (json !== undefined) {
      init.headers["content-type"] = init.headers["content-type"] || "application/json";
      init.body = JSON.stringify(json);
    }
    return fetch(safeUrl, init);
  }

  const message = {
    type: "APX_COMFY_FETCH",
    url: safeUrl,
    method,
    headers: mergedHeaders
  };
  if (json !== undefined) message.jsonBody = json;
  if (multipart) message.multipart = multipart;

  const result = await chrome.runtime.sendMessage(message);
  if (!result) {
    throw new Error(t("comfy.noResponse"));
  }
  if (!result.success) {
    throw new Error(result.error || "ComfyUI request failed");
  }
  return createComfyResponse(result.data);
}

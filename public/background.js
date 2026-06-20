import { buildPendingImport, MENU_IMPORT_RUN_ID } from "./contextMenuModel.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_IMPORT_RUN_ID,
      title: "Mở + Run aPix Builder",
      contexts: ["image"]
    });
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_IMPORT_RUN_ID || !info.srcUrl || !tab?.windowId) return;
  const pendingImport = buildPendingImport(info, tab);
  await Promise.all([
    chrome.storage.local.set({ pendingImport }),
    chrome.sidePanel.open({ windowId: tab.windowId })
  ]);
  chrome.runtime.sendMessage({ type: "APX_IMPORT_IMAGE", payload: pendingImport }).catch(() => {});
});

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function handleComfyFetch(message) {
  const { url, method = "GET", headers = {}, jsonBody, multipart } = message;
  const safeUrl = (() => {
    try {
      const parsed = new URL(url);
      parsed.username = "";
      parsed.password = "";
      return parsed.toString();
    } catch {
      return url;
    }
  })();
  let body;
  const fetchHeaders = { ...headers };

  if (multipart?.length) {
    body = new FormData();
    for (const part of multipart) {
      if (part.file) {
        const bytes = base64ToUint8Array(part.base64);
        body.append(
          part.name,
          new Blob([bytes], { type: part.mimeType || "application/octet-stream" }),
          part.filename || "file"
        );
      } else {
        body.append(part.name, part.value ?? "");
      }
    }
  } else if (jsonBody !== undefined) {
    body = typeof jsonBody === "string" ? jsonBody : JSON.stringify(jsonBody);
    fetchHeaders["content-type"] = fetchHeaders["content-type"] || "application/json";
  }

  const response = await fetch(safeUrl, { method, headers: fetchHeaders, body });
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type") || "",
    bodyBase64: uint8ArrayToBase64(bytes)
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "APX_FETCH_IMAGE") {
    fetch(message.url, { credentials: "omit", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(`Không thể tải ảnh (${response.status})`);
        const blob = await response.blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        sendResponse({
          ok: true,
          dataUrl: `data:${blob.type || "image/png"};base64,${uint8ArrayToBase64(bytes)}`,
          mimeType: blob.type || "image/png"
        });
      })
      .catch(error => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }

  if (message?.type === "APX_COMFY_FETCH") {
    handleComfyFetch(message)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message || String(error) }));
    return true;
  }

  return false;
});

import { buildPendingImport, MENU_IMPORT_RUN_ID } from "./contextMenuModel.js";
import { buildImportImagePackage } from "./imageImport.js";
import { filenameFromUrl, stagingRef } from "./imageStaging.js";

const IMAGE_HEADER_RULE_IDS = [101, 102];

async function ensureImageHeaderRules() {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: IMAGE_HEADER_RULE_IDS,
    addRules: [
      {
        id: 101,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "referer",
              operation: "set",
              value: "https://www.pixiv.net/"
            }
          ]
        },
        condition: {
          urlFilter: "||pximg.net/",
          resourceTypes: ["xmlhttprequest", "image", "other"]
        }
      },
      {
        // API nội bộ thư viện RunningHub trả tên tiếng Anh khi Origin là site chính
        // (fetch từ extension không tự set được Origin — forbidden header).
        id: 102,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "origin",
              operation: "set",
              value: "https://www.runninghub.ai"
            }
          ]
        },
        condition: {
          regexFilter: "^https://www\\.runninghub\\.ai/api/(portal/|webapp/(list|detail))",
          resourceTypes: ["xmlhttprequest"]
        }
      }
    ]
  }).catch(error => {
    console.warn("Không thể cài rule tải ảnh", error);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_IMPORT_RUN_ID,
      title: "Mở + Run aPix Builder",
      contexts: ["image"]
    });
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  ensureImageHeaderRules();
});

chrome.runtime.onStartup?.addListener(() => {
  ensureImageHeaderRules();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_IMPORT_RUN_ID || !info.srcUrl || !tab?.windowId) return;

  const openPanel = chrome.sidePanel.open({ windowId: tab.windowId }).catch(error => {
    console.warn("Không thể mở side panel", error);
  });
  let pendingImport = buildPendingImport(info, tab);
  try {
    await ensureImageHeaderRules();
    const imagePackage = await buildImportImagePackage({
      url: info.srcUrl,
      pageUrl: info.pageUrl || tab.url || "",
      tabId: tab.id,
      windowId: tab.windowId,
      name: filenameFromUrl(info.srcUrl)
    });
    pendingImport = buildPendingImport(info, tab, imagePackage);
  } catch (error) {
    pendingImport.captureError = error.message || String(error);
  }

  await chrome.storage.local.set({ pendingImport });
  await openPanel;
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

async function handleFetchImage(message) {
  await ensureImageHeaderRules();
  const sourceTab = message.tabId ? await chrome.tabs.get(message.tabId).catch(() => null) : null;
  const imagePackage = await buildImportImagePackage({
    url: message.url,
    pageUrl: message.pageUrl,
    tabId: message.tabId,
    windowId: sourceTab?.windowId || message.windowId || null,
    name: filenameFromUrl(message.url)
  });
  return {
    ok: true,
    ...imagePackage,
    stagingRef: imagePackage.stagingId ? stagingRef(imagePackage.stagingId) : null
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "APX_FETCH_IMAGE") {
    handleFetchImage(message)
      .then(payload => sendResponse(payload))
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

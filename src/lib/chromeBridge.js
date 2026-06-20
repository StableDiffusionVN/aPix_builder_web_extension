import {
  blobFromEmbeddedImage,
  filenameFromUrl,
  parseStagingRef,
  readStagedImage
} from "../../public/imageStaging.js";

export const hasChromeRuntime = () => Boolean(globalThis.chrome?.runtime?.id);

const importLocks = new Set();

export async function consumePendingImport() {
  if (!hasChromeRuntime() || !chrome.storage?.local) return null;
  const { pendingImport } = await chrome.storage.local.get("pendingImport");
  if (pendingImport) await chrome.storage.local.remove("pendingImport");
  return pendingImport || null;
}

export function onPendingImport(handler) {
  if (!hasChromeRuntime() || !chrome.storage?.onChanged) return () => {};
  const listener = (changes, areaName) => {
    if (areaName !== "local" || !changes.pendingImport?.newValue) return;
    handler(changes.pendingImport.newValue);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

async function resolveActiveTab() {
  if (!hasChromeRuntime() || !chrome.tabs?.query) return { pageUrl: "", tabId: null, windowId: null };
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { pageUrl: tab?.url || "", tabId: tab?.id ?? null, windowId: tab?.windowId ?? null };
  } catch {
    return { pageUrl: "", tabId: null, windowId: null };
  }
}

export async function loadImportBlob({
  url,
  stagingId,
  embeddedImage,
  pageUrl,
  tabId,
  windowId,
  name,
  allowRemoteFetch = true
} = {}) {
  if (embeddedImage?.base64) {
    return {
      blob: blobFromEmbeddedImage(embeddedImage),
      suggestedName: name || embeddedImage.name || filenameFromUrl(embeddedImage.sourceUrl || url)
    };
  }

  const resolvedStagingId = stagingId || parseStagingRef(url);
  if (resolvedStagingId) {
    try {
      const staged = await readStagedImage(resolvedStagingId, { remove: true });
      return {
        blob: staged.blob,
        suggestedName: name || staged.name || filenameFromUrl(staged.sourceUrl || url)
      };
    } catch (error) {
      if (!allowRemoteFetch) throw error;
    }
  }

  if (!allowRemoteFetch) {
    throw new Error("Không đọc được ảnh đã staging");
  }

  if (!url) throw new Error("Không có ảnh để import");

  if (url.startsWith("data:")) {
    const blob = await fetch(url).then(response => response.blob());
    return { blob, suggestedName: name || "web-image" };
  }

  if (hasChromeRuntime()) {
    const tab = await resolveActiveTab();
    const response = await chrome.runtime.sendMessage({
      type: "APX_FETCH_IMAGE",
      url,
      pageUrl: pageUrl || tab.pageUrl,
      tabId: tabId ?? tab.tabId,
      windowId: windowId ?? tab.windowId
    });
    if (!response?.ok) throw new Error(response?.error || "Không thể import ảnh từ trang web");

    if (response.embeddedImage?.base64) {
      return {
        blob: blobFromEmbeddedImage(response.embeddedImage),
        suggestedName: name || response.embeddedImage.name || filenameFromUrl(url)
      };
    }

    if (response.stagingId) {
      const staged = await readStagedImage(response.stagingId, { remove: true });
      return {
        blob: staged.blob,
        suggestedName: name || staged.name || filenameFromUrl(url)
      };
    }

    throw new Error("Không thể import ảnh từ trang web");
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không thể tải ảnh (${response.status})`);
  const blob = await response.blob();
  return { blob, suggestedName: name || filenameFromUrl(url) };
}

export async function fetchImageAsBlob(url, options = {}) {
  const { blob } = await loadImportBlob({
    url,
    stagingId: options.stagingId,
    embeddedImage: options.embeddedImage,
    pageUrl: options.pageUrl,
    tabId: options.tabId,
    windowId: options.windowId,
    name: options.name,
    allowRemoteFetch: options.allowRemoteFetch
  });
  return blob;
}

export function runExclusiveImport(requestId, task) {
  if (!requestId) return task();
  if (importLocks.has(requestId)) return Promise.resolve(null);
  importLocks.add(requestId);
  return task().finally(() => {
    importLocks.delete(requestId);
  });
}

export async function downloadBlob(blob, filename) {
  const safeName = String(filename || `apix-${Date.now()}.png`).replace(/[\\/:*?"<>|]/g, "-");
  const url = URL.createObjectURL(blob);
  try {
    if (hasChromeRuntime() && chrome.downloads) {
      await chrome.downloads.download({
        url,
        filename: `aPix Builder/${safeName}`,
        saveAs: false
      });
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeName;
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export async function readSettings() {
  const defaults = {
    comfyUrl: "http://127.0.0.1:8188",
    runningHubApiKey: "",
    theme: "system"
  };
  if (hasChromeRuntime() && chrome.storage?.local) {
    const { settings } = await chrome.storage.local.get("settings");
    return { ...defaults, ...(settings || {}) };
  }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("apix-settings") || "{}") };
  } catch {
    return defaults;
  }
}

export async function writeSettings(settings) {
  if (hasChromeRuntime() && chrome.storage?.local) {
    await chrome.storage.local.set({ settings });
  } else {
    localStorage.setItem("apix-settings", JSON.stringify(settings));
  }
}

export async function readWorkspaceState() {
  const defaults = {
    mode: "comfy",
    selectedByMode: {},
    settingsOpen: false
  };
  if (hasChromeRuntime() && chrome.storage?.local) {
    const { workspaceState } = await chrome.storage.local.get("workspaceState");
    return { ...defaults, ...(workspaceState || {}) };
  }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("apix-workspace-state") || "{}") };
  } catch {
    return defaults;
  }
}

export async function writeWorkspaceState(workspaceState) {
  if (hasChromeRuntime() && chrome.storage?.local) {
    await chrome.storage.local.set({ workspaceState });
  } else {
    localStorage.setItem("apix-workspace-state", JSON.stringify(workspaceState));
  }
}

export const hasChromeRuntime = () => Boolean(globalThis.chrome?.runtime?.id);

export async function consumePendingImport() {
  if (!hasChromeRuntime() || !chrome.storage?.local) return null;
  const { pendingImport } = await chrome.storage.local.get("pendingImport");
  if (pendingImport) await chrome.storage.local.remove("pendingImport");
  return pendingImport || null;
}

export function onImageImport(handler) {
  if (!hasChromeRuntime()) return () => {};
  const listener = message => {
    if (message?.type === "APX_IMPORT_IMAGE" && message.payload?.url) handler(message.payload);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

export async function fetchImageAsBlob(url) {
  if (url.startsWith("data:")) return fetch(url).then(response => response.blob());
  if (hasChromeRuntime()) {
    try {
      const direct = await fetch(url, { credentials: "omit", cache: "no-store" });
      if (direct.ok) return direct.blob();
    } catch {
      // Retry in the service worker for sites with unusual response policies.
    }
    const response = await chrome.runtime.sendMessage({ type: "APX_FETCH_IMAGE", url });
    if (!response?.ok) throw new Error(response?.error || "Không thể import ảnh từ trang web");
    return fetch(response.dataUrl).then(result => result.blob());
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không thể tải ảnh (${response.status})`);
  return response.blob();
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

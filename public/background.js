const MENU_ID = "apix-builder-import-image";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Mở trong aPix Builder",
      contexts: ["image"]
    });
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl || !tab?.windowId) return;
  const pendingImport = {
    url: info.srcUrl,
    pageUrl: info.pageUrl || tab.url || "",
    createdAt: Date.now()
  };
  await Promise.all([
    chrome.storage.local.set({ pendingImport }),
    chrome.sidePanel.open({ windowId: tab.windowId })
  ]);
  chrome.runtime.sendMessage({ type: "APX_IMPORT_IMAGE", payload: pendingImport }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "APX_FETCH_IMAGE") return false;
  fetch(message.url, { credentials: "omit", cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error(`Không thể tải ảnh (${response.status})`);
      const blob = await response.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
      }
      sendResponse({
        ok: true,
        dataUrl: `data:${blob.type || "image/png"};base64,${btoa(binary)}`,
        mimeType: blob.type || "image/png"
      });
    })
    .catch(error => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

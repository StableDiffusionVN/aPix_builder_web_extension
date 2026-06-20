export const MENU_IMPORT_RUN_ID = "apix-builder-import-run-image";

export function buildPendingImport(info, tab, { stagingId = null, embeddedImage = null } = {}) {
  return {
    requestId: crypto.randomUUID(),
    url: info.srcUrl,
    stagingId,
    embeddedImage,
    pageUrl: info.pageUrl || tab?.url || "",
    tabId: tab?.id ?? null,
    windowId: tab?.windowId ?? null,
    autoRun: true,
    createdAt: Date.now()
  };
}

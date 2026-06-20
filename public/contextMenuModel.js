export const MENU_IMPORT_RUN_ID = "apix-builder-import-run-image";

export function buildPendingImport(info, tab) {
  return {
    requestId: crypto.randomUUID(),
    url: info.srcUrl,
    pageUrl: info.pageUrl || tab?.url || "",
    autoRun: true,
    createdAt: Date.now()
  };
}

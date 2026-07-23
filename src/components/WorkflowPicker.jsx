import { FileArchive, FolderInput, LibraryBig, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { AppInfoCard } from "./AppInfoCard";
import { t } from "../lib/i18n";

const MODE_TITLES = {
  comfy: "ComfyUI Template",
  "runninghub-workflow": "RunningHub Workflow",
  "runninghub-app": "RunningHub App"
};

export function WorkflowPicker({ mode, items, selected, appInfo, onSelect, onImportDirectory, onImportZip, onAddCustomApp, onDeleteCustom, importingFolder, scanningApp, onOpenLibrary }) {
  const [customAppId, setCustomAppId] = useState("");
  const zipInputRef = useRef(null);
  const title = MODE_TITLES[mode];
  const isAppMode = mode === "runninghub-app";

  async function addCustomApp() {
    const added = await onAddCustomApp(customAppId);
    if (added !== false) setCustomAppId("");
  }

  return (
    <section className="workflow-picker" aria-labelledby="workflow-picker-title">
      <div className="picker-heading">
        <h2 id="workflow-picker-title">{title}</h2>
        {!isAppMode && (
          <div className="import-buttons">
            <button className="import-folder-button" onClick={onImportDirectory} disabled={importingFolder}>
              {importingFolder ? <LoaderCircle className="spin" size={15} /> : <FolderInput size={15} />} {importingFolder ? t("picker.scanning") : t("picker.folder")}
            </button>
            <button className="import-folder-button" onClick={() => zipInputRef.current?.click()} disabled={importingFolder}>
              <FileArchive size={15} /> .zip
            </button>
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={event => { const f = event.target.files?.[0]; event.target.value = ""; if (f) onImportZip?.(f); }}
            />
          </div>
        )}
      </div>

      <div className="template-select-row">
        <div className="template-select-wrap">
          <select aria-label={title} value={selected?.id || ""} onChange={event => onSelect(items.find(item => item.id === event.target.value))}>
            {items.map(item => <option key={item.id} value={item.id}>{item.custom ? "[Custom] " : ""}{item.name}</option>)}
          </select>
        </div>
        {selected?.custom ? (
          <button
            type="button"
            className="square-button danger-text template-delete-button"
            onClick={() => onDeleteCustom(selected)}
            aria-label={t("picker.deleteItem", { name: selected.name })}
            title={t("picker.deleteCustom")}
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>
      {isAppMode && <AppInfoCard info={appInfo} />}

      {isAppMode && (
        <div className={`custom-app-row${onOpenLibrary ? " has-library" : ""}`}>
          <input aria-label="Custom RunningHub App ID" inputMode="numeric" value={customAppId} onChange={event => setCustomAppId(event.target.value)} placeholder={t("picker.customAppPlaceholder")} />
          <button onClick={addCustomApp} disabled={!customAppId.trim() || scanningApp}>{scanningApp ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} {scanningApp ? t("picker.scanning") : t("common.add")}</button>
          {onOpenLibrary && (
            <button type="button" className="library-open-button" onClick={onOpenLibrary} title={t("picker.libraryTitle")}>
              <LibraryBig size={15} /> {t("picker.library")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

import { FolderInput, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppInfoCard } from "./AppInfoCard";

const MODE_COPY = {
  comfy: { title: "ComfyUI Template", hint: "Template chạy trên ComfyUI local hoặc remote" },
  "runninghub-workflow": { title: "RunningHub Workflow", hint: "Workflow ID và input được đọc từ app_build" },
  "runninghub-app": { title: "RunningHub App", hint: "App mặc định hoặc App ID của riêng bạn" }
};

export function WorkflowPicker({ mode, items, selected, appInfo, onSelect, onImportDirectory, onAddCustomApp, onDeleteCustom, importingFolder, scanningApp }) {
  const [customAppId, setCustomAppId] = useState("");
  const copy = MODE_COPY[mode];
  const isAppMode = mode === "runninghub-app";

  async function addCustomApp() {
    const added = await onAddCustomApp(customAppId);
    if (added !== false) setCustomAppId("");
  }

  return (
    <section className="workflow-picker" aria-labelledby="workflow-picker-title">
      <div className="picker-heading">
        <div><h2 id="workflow-picker-title">{copy.title}</h2><p>{copy.hint}</p></div>
        {!isAppMode && (
          <button className="import-folder-button" onClick={onImportDirectory} disabled={importingFolder}>
            {importingFolder ? <LoaderCircle className="spin" size={15} /> : <FolderInput size={15} />} {importingFolder ? "Đang quét" : "Import"}
          </button>
        )}
      </div>

      <div className="template-select-row">
        <select aria-label={copy.title} value={selected?.id || ""} onChange={event => onSelect(items.find(item => item.id === event.target.value))}>
          {items.map(item => <option key={item.id} value={item.id}>{item.custom ? "[Custom] " : ""}{item.name}</option>)}
        </select>
        {selected?.custom ? (
          <button
            type="button"
            className="square-button danger-text template-delete-button"
            onClick={() => onDeleteCustom(selected)}
            aria-label={`Xóa ${selected.name}`}
            title="Xóa custom"
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>
      {!isAppMode && selected && <div className="selected-template-meta"><span>{selected.description}</span>{selected.custom && <strong>Custom</strong>}</div>}

      {isAppMode && <AppInfoCard info={appInfo} />}

      {isAppMode && (
        <div className="custom-app-row">
          <input aria-label="Custom RunningHub App ID" inputMode="numeric" value={customAppId} onChange={event => setCustomAppId(event.target.value)} placeholder="Nhập custom App ID" />
          <button onClick={addCustomApp} disabled={!customAppId.trim() || scanningApp}>{scanningApp ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} {scanningApp ? "Đang quét" : "Thêm"}</button>
        </div>
      )}
    </section>
  );
}

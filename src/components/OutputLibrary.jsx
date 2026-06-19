import { Check, Download, Trash2 } from "lucide-react";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { formatBytes } from "../lib/images";

function OutputRow({ output, selected, onToggle, onDownload, onDelete }) {
  const url = useObjectUrl(output.blob);
  return (
    <article className="output-row">
      <button className={`check-button ${selected ? "checked" : ""}`} onClick={() => onToggle(output.id)} aria-label={`Chọn ${output.name}`}>
        {selected && <Check size={13} />}
      </button>
      <img src={url} alt={output.name} />
      <div className="output-meta">
        <strong>{output.name}</strong>
        <span>{output.width} × {output.height} · {formatBytes(output.size)}</span>
        <small><i /> Hoàn tất · {new Date(output.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</small>
      </div>
      <div className="output-actions">
        <button className="square-button" onClick={() => onDownload(output)} aria-label={`Tải ${output.name}`}><Download size={17} /></button>
        <button className="square-button danger-text" onClick={() => onDelete(output.id)} aria-label={`Xóa ${output.name}`}><Trash2 size={16} /></button>
      </div>
    </article>
  );
}

export function OutputLibrary({ outputs, selected, onToggle, onToggleAll, onDownload, onDownloadSelected, onDelete, onClear }) {
  return (
    <section className="tool-section output-section" aria-labelledby="outputs-title">
      <div className="section-heading-row">
        <h2 id="outputs-title">Output ({outputs.length})</h2>
        {!!outputs.length && (
          <div className="output-heading-actions">
            {outputs.length > 1 && <label className="select-all"><input type="checkbox" checked={selected.size === outputs.length} onChange={onToggleAll} /> Chọn tất cả</label>}
            <button className="clear-outputs" onClick={onClear} aria-label="Xóa tất cả output"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      {!outputs.length && <div className="empty-output">Output sẽ được lưu trong extension sau khi workflow hoàn tất.</div>}
      {!!outputs.length && (
        <>
          <div className="output-list">
            {outputs.map(output => <OutputRow key={output.id} output={output} selected={selected.has(output.id)} onToggle={onToggle} onDownload={onDownload} onDelete={onDelete} />)}
          </div>
          {outputs.length > 1 && <button className="download-selected" onClick={onDownloadSelected} disabled={!selected.size}>
            <Download size={18} /> Tải các ảnh đã chọn ({selected.size})
          </button>}
        </>
      )}
    </section>
  );
}

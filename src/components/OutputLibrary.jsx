import { Check, Download, Trash2 } from "lucide-react";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { formatBytes } from "../lib/images";
import { mediaKindFromName } from "../lib/mediaKind";
import { getLocale, t } from "../lib/i18n";

function OutputRow({ output, selected, onToggle, onDownload, onDelete, onView }) {
  const url = useObjectUrl(output.blob);
  const kind = mediaKindFromName(output.name || "", output.blob?.type || "");
  return (
    <article className="output-row">
      <button className={`check-button ${selected ? "checked" : ""}`} onClick={() => onToggle(output.id)} aria-label={t("output.select", { name: output.name })}>
        {selected && <Check size={13} />}
      </button>
      <button
        type="button"
        className="output-thumb-button"
        onClick={() => onView?.(output)}
        aria-label={t("output.view", { name: output.name })}
        disabled={!url}
      >
        {url ? (
          kind === "video" ? <video src={url} muted preload="metadata" />
          : kind === "audio" ? <span className="output-thumb-audio" aria-hidden="true">♪</span>
          : <img src={url} alt={output.name} />
        ) : null}
      </button>
      <div className="output-meta">
        <strong>{output.name}</strong>
        <span>{output.width} × {output.height} · {formatBytes(output.size)}</span>
        <small><i /> {t("output.done")} · {new Date(output.createdAt).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}</small>
      </div>
      <div className="output-actions">
        <button className="square-button" onClick={() => onDownload(output)} aria-label={t("output.download", { name: output.name })}><Download size={17} /></button>
        <button className="square-button danger-text" onClick={() => onDelete(output.id)} aria-label={t("output.delete", { name: output.name })}><Trash2 size={16} /></button>
      </div>
    </article>
  );
}

export function OutputLibrary({ outputs, selected, onToggle, onToggleAll, onDownload, onDownloadSelected, onDelete, onDeleteSelected, onView }) {
  const selectedCount = selected.size;
  return (
    <section className="tool-section output-section" aria-labelledby="outputs-title">
      <div className="section-heading-row">
        <h2 id="outputs-title">Output ({outputs.length})</h2>
        {!!outputs.length && (
          <div className="output-heading-actions">
            {outputs.length > 1 && <label className="select-all"><input type="checkbox" checked={selected.size === outputs.length} onChange={onToggleAll} /> {t("output.selectAll")}</label>}
            <button
              className="output-batch-action"
              onClick={onDownloadSelected}
              disabled={!selectedCount}
              aria-label={t("output.downloadSelected", { count: selectedCount })}
              title={t("output.downloadSelected", { count: selectedCount })}
            >
              <Download size={14} />
            </button>
            <button
              className="output-batch-action danger-text"
              onClick={onDeleteSelected}
              disabled={!selectedCount}
              aria-label={t("output.deleteSelected", { count: selectedCount })}
              title={t("output.deleteSelected", { count: selectedCount })}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {!outputs.length && <div className="empty-output">{t("output.empty")}</div>}
      {!!outputs.length && <div className="output-list">
        {outputs.map(output => (
          <OutputRow
            key={output.id}
            output={output}
            selected={selected.has(output.id)}
            onToggle={onToggle}
            onDownload={onDownload}
            onDelete={onDelete}
            onView={onView}
          />
        ))}
      </div>}
    </section>
  );
}

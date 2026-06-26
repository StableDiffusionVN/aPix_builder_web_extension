import { ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { formatBytes, getDroppedImageUrl } from "../lib/images";
import { useObjectUrl } from "../hooks/useObjectUrl";

export function ImportPanel({ image, onFile, onUrl, onClear, busy, embedded = false, label = "Import ảnh" }) {
  const inputRef = useRef(null);
  const previewUrl = useObjectUrl(image?.blob);

  async function handleDrop(event) {
    event.preventDefault();
    const file = [...event.dataTransfer.files].find(item => item.type.startsWith("image/"));
    if (file) return onFile(file);
    const url = getDroppedImageUrl(event.dataTransfer);
    if (url) return onUrl(url);
  }

  const body = (
    <>
      <div
        className={`drop-zone ${image ? "is-compact" : ""}`}
        onDragOver={event => event.preventDefault()}
        onDrop={handleDrop}
        data-testid="drop-zone"
      >
        <ImagePlus size={27} />
        <strong>Kéo ảnh vào đây</strong>
        <button className="secondary-button" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload size={15} /> Chọn ảnh
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={event => event.target.files?.[0] && onFile(event.target.files[0])}
        />
      </div>

      {image && (
        <div className="selected-image" data-testid="selected-image">
          <img src={previewUrl} alt="Ảnh input" />
          <div className="image-meta">
            <strong>{image.name}</strong>
            <span>{image.width} × {image.height} · {formatBytes(image.size)}</span>
          </div>
          <div className="selected-actions">
            <button className="icon-text-button" onClick={() => inputRef.current?.click()} aria-label="Thay ảnh"><RefreshCw size={16} /></button>
            <button className="icon-text-button danger-text" onClick={onClear} aria-label="Xóa ảnh"><Trash2 size={16} /></button>
          </div>
        </div>
      )}
    </>
  );

  // embedded: nhúng trong khung field/sub-menu (không bọc section + tiêu đề riêng).
  if (embedded) {
    return (
      <div className="field import-field">
        <span>{label}</span>
        {body}
      </div>
    );
  }

  return (
    <section className="tool-section import-section" aria-labelledby="import-title">
      <h2 id="import-title">Import ảnh</h2>
      {body}
    </section>
  );
}

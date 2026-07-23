import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-react";
import { mediaKindFromName } from "../lib/mediaKind";
import { t } from "../lib/i18n";

export function ImageLightbox({
  open,
  imageUrl,
  title,
  currentPosition = 0,
  total = 0,
  canPrevious = false,
  canNext = false,
  onPrevious,
  onNext,
  onClose,
  onDownload
}) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      } else if (event.key === "ArrowLeft" && canPrevious) {
        event.preventDefault();
        onPrevious?.();
      } else if (event.key === "ArrowRight" && canNext) {
        event.preventDefault();
        onNext?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canNext, canPrevious, onClose, onNext, onPrevious, open]);

  if (!open || !imageUrl) return null;

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title || t("lightbox.view")}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="image-lightbox-toolbar">
        <button type="button" className="square-button" onClick={() => window.open(imageUrl, "_blank", "noopener")} aria-label={t("lightbox.openTab")}>
          <ExternalLink size={16} />
        </button>
        {onDownload ? (
          <button type="button" className="square-button" onClick={onDownload} aria-label={t("lightbox.download")}>
            <Download size={16} />
          </button>
        ) : null}
        <button type="button" className="square-button" onClick={onClose} aria-label={t("common.close")}>
          <X size={18} />
        </button>
      </div>
      {total > 1 ? (
        <>
          <button
            type="button"
            className="image-lightbox-nav image-lightbox-previous"
            onClick={onPrevious}
            disabled={!canPrevious}
            aria-label={t("lightbox.previous")}
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            className="image-lightbox-nav image-lightbox-next"
            onClick={onNext}
            disabled={!canNext}
            aria-label={t("lightbox.next")}
          >
            <ChevronRight size={26} />
          </button>
        </>
      ) : null}
      {mediaKindFromName(title || "") === "video" ? (
        <video className="image-lightbox-image" src={imageUrl} controls autoPlay playsInline preload="metadata" />
      ) : mediaKindFromName(title || "") === "audio" ? (
        <audio className="image-lightbox-audio" src={imageUrl} controls autoPlay preload="metadata" />
      ) : (
        <img className="image-lightbox-image" src={imageUrl} alt={title || "Output"} />
      )}
      {title || total > 1 ? (
        <div className="image-lightbox-caption">
          {total > 1 ? <span>{currentPosition} / {total}</span> : null}
          {title ? <strong>{title}</strong> : null}
        </div>
      ) : null}
    </div>,
    document.body
  );
}

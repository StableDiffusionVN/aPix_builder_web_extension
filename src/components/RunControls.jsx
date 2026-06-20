import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Play, Square, Trash2 } from "lucide-react";

export function RunControls({
  running,
  canRun,
  canCancel,
  queueCount = 0,
  onRun,
  onCancel,
  onClearQueue,
  onStopAll,
  runLabel = "Chạy workflow"
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const hasQueue = queueCount > 0;
  const canClearQueue = Boolean(onClearQueue && hasQueue);
  const canStopAll = Boolean(onStopAll && (canCancel || hasQueue || running));

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [menuOpen]);

  const runAction = handler => {
    setMenuOpen(false);
    handler?.();
  };

  return (
    <div className={`run-controls${menuOpen ? " is-open" : ""}`} ref={menuRef}>
      <button
        type="button"
        className="run-button run-controls-main"
        onClick={onRun}
        disabled={!canRun}
      >
        {running ? <Loader2 className="spin" size={17} /> : <Play size={18} fill="currentColor" />}
        <span>
          {running
            ? `Hàng chờ${queueCount ? ` (${queueCount})` : ""}`
            : runLabel}
        </span>
      </button>
      <button
        type="button"
        className="run-controls-toggle"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(current => !current);
        }}
        aria-label="Tùy chọn chạy"
        aria-expanded={menuOpen}
      >
        <ChevronDown size={14} />
      </button>
      {menuOpen ? (
        <div className="run-controls-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => runAction(onCancel)} disabled={!canCancel}>
            <Square size={13} fill="currentColor" />
            <span>Stop</span>
          </button>
          {onClearQueue ? (
            <button type="button" role="menuitem" onClick={() => runAction(onClearQueue)} disabled={!canClearQueue}>
              <Trash2 size={13} />
              <span>Clear queue</span>
            </button>
          ) : null}
          {onStopAll ? (
            <button type="button" role="menuitem" className="danger" onClick={() => runAction(onStopAll)} disabled={!canStopAll}>
              <Square size={13} fill="currentColor" />
              <span>Stop all</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

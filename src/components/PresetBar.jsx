import { Bookmark, BookmarkPlus, Check, RefreshCw, Tag, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../lib/i18n";

export function PresetBar({ templateId, presets, onLoad, onSave, onUpdate, onDelete, storageWarning = "" }) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    setSelectedId("");
    setSaving(false);
    setNameError("");
  }, [templateId]);

  if (!templateId) return null;

  const selectedPreset = presets.find(preset => preset.id === selectedId) || null;

  function handleSelect(id) {
    setSelectedId(id);
    if (!id) return;
    const preset = presets.find(candidate => candidate.id === id);
    if (preset) onLoad(preset.values || {});
  }

  function handleSaveClick() {
    setSaveName("");
    setNameError("");
    setSaving(true);
  }

  function handleConfirmSave() {
    const name = saveName.trim() || "Preset";
    const id = onSave(name);
    if (id === null) {
      setNameError(t("preset.exists", { name }));
      return;
    }
    setSelectedId(id);
    setSaving(false);
    setNameError("");
  }

  function handleSaveKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirmSave();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setSaving(false);
      setNameError("");
    }
  }

  return (
    <section className="preset-bar" aria-label="Preset">
      {saving ? (
        <>
          <div className="preset-action-row">
            <div className={`preset-input-wrap ${nameError ? "has-error" : ""}`}>
              <Tag size={15} />
              <input
                value={saveName}
                onChange={event => { setSaveName(event.target.value); if (nameError) setNameError(""); }}
                onKeyDown={handleSaveKeyDown}
                placeholder={t("preset.namePlaceholder")}
                autoFocus
              />
            </div>
            <button type="button" className="square-button" onClick={handleConfirmSave} title={t("preset.save")}>
              <Check size={15} />
            </button>
            <button type="button" className="square-button" onClick={() => { setSaving(false); setNameError(""); }} title={t("common.cancel")}>
              <X size={15} />
            </button>
          </div>
          {nameError ? <span className="preset-message danger-text">{nameError}</span> : null}
        </>
      ) : (
        <div className="preset-action-row">
          <div className="preset-select-wrap">
            <Bookmark size={15} />
            <select value={selectedId} onChange={event => handleSelect(event.target.value)} aria-label="Preset">
              <option value="">{t("preset.none")}</option>
              {presets.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
          </div>
          <button type="button" className="square-button" onClick={handleSaveClick} title={t("preset.saveNew")}>
            <BookmarkPlus size={15} />
          </button>
          {selectedPreset ? (
            <>
              <button type="button" className="square-button" onClick={() => onUpdate(selectedId)} title={t("preset.update", { name: selectedPreset.name })}>
                <RefreshCw size={15} />
              </button>
              <button type="button" className="square-button danger-text" onClick={() => { onDelete(selectedId); setSelectedId(""); }} title={t("preset.delete")}>
                <Trash2 size={15} />
              </button>
            </>
          ) : null}
        </div>
      )}
      {!saving && storageWarning ? <span className="preset-message">{storageWarning}</span> : null}
    </section>
  );
}

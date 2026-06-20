import { useCallback, useEffect, useRef, useState } from "react";
import { readWorkflowPresets, writeWorkflowPresets } from "../lib/libraryDb";

export function sanitizePresetValues(values) {
  const result = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (typeof value === "string" && (value.startsWith("data:") || value.length > 200000)) continue;
    if (value && typeof value === "object") continue;
    result[key] = value;
  }
  return result;
}

export function createPresetId() {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function usePresets() {
  const dataRef = useRef({});
  const persistQueueRef = useRef(Promise.resolve());
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");

  const bump = useCallback(() => setVersion(current => current + 1), []);

  const queuePersist = useCallback(next => {
    dataRef.current = next;
    persistQueueRef.current = persistQueueRef.current
      .catch(() => {})
      .then(async () => {
        await writeWorkflowPresets(next);
        setStorageWarning("");
      })
      .catch(error => {
        console.error("Failed to save extension presets:", error);
        setStorageWarning("Không lưu được preset");
      });
    bump();
  }, [bump]);

  useEffect(() => {
    let cancelled = false;
    readWorkflowPresets()
      .then(presets => {
        if (cancelled) return;
        dataRef.current = presets;
        setReady(true);
        bump();
      })
      .catch(error => {
        console.error("Failed to load extension presets:", error);
        if (!cancelled) {
          setReady(true);
          setStorageWarning("Không tải được preset");
        }
      });
    return () => { cancelled = true; };
  }, [bump]);

  const getPresets = useCallback(templateId => dataRef.current[templateId] || [], []);

  const savePreset = useCallback((templateId, name, values) => {
    if (!templateId) return null;
    const trimmed = name.trim() || "Preset";
    const presets = getPresets(templateId);
    if (presets.some(preset => preset.name === trimmed)) return null;
    const id = createPresetId();
    queuePersist({
      ...dataRef.current,
      [templateId]: [
        ...presets,
        {
          id,
          name: trimmed,
          values: sanitizePresetValues(values),
          createdAt: new Date().toISOString()
        }
      ]
    });
    return id;
  }, [getPresets, queuePersist]);

  const updatePreset = useCallback((templateId, presetId, values) => {
    if (!templateId || !presetId) return;
    const presets = getPresets(templateId).map(preset => (
      preset.id === presetId
        ? { ...preset, values: sanitizePresetValues(values), updatedAt: new Date().toISOString() }
        : preset
    ));
    queuePersist({ ...dataRef.current, [templateId]: presets });
  }, [getPresets, queuePersist]);

  const deletePreset = useCallback((templateId, presetId) => {
    if (!templateId || !presetId) return;
    const presets = getPresets(templateId).filter(preset => preset.id !== presetId);
    queuePersist({ ...dataRef.current, [templateId]: presets });
  }, [getPresets, queuePersist]);

  return {
    getPresets,
    savePreset,
    updatePreset,
    deletePreset,
    presetsReady: ready,
    presetsVersion: version,
    presetsStorageWarning: storageWarning
  };
}

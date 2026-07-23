import { LoaderCircle, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { DynamicFields } from "./components/DynamicFields";
import { ImageLightbox } from "./components/ImageLightbox";
import { ImportPanel } from "./components/ImportPanel";
import { ModeTabs } from "./components/ModeTabs";
import { OutputLibrary } from "./components/OutputLibrary";
import { PresetBar } from "./components/PresetBar";
import { RunControls } from "./components/RunControls";
import { SettingsPanel } from "./components/SettingsPanel";
import { WorkflowPicker } from "./components/WorkflowPicker";
import { consumePendingImport, downloadBlob, loadImportBlob, onPendingImport, readSettings, readWorkspaceState, runExclusiveImport, writeSettings, writeWorkspaceState } from "./lib/chromeBridge";
import { defaultValues, expandActiveFields, flattenConfigInputs, loadCatalog, loadComfyWorkflow, loadTemplateConfig } from "./lib/catalog";
import { resolveLanguage, setLanguage, t } from "./lib/i18n";
import { I18nProvider } from "./lib/I18nContext";

const IMAGE_FIELD_TYPES = ["image", "image_mask", "file"];
import { normalizeImageRecord } from "./lib/images";
import { adjacentPreviewIndex } from "./lib/lightboxNavigation";
import { clearInput, deleteCustomCatalogItem, deleteOutput, deleteOutputs, listCustomCatalogItems, listOutputs, loadInputs, saveCustomCatalogItem, saveInput, saveOutput } from "./lib/libraryDb";
import { createCustomRunningHubApp, importTemplateDirectory, importTemplateZip } from "./lib/templateImport";
import { RhLibraryBrowser } from "./components/RhLibraryBrowser";
import { usePresets } from "./hooks/usePresets";
import { laneKeyForKind, laneKeyForMode, useRunnerLane } from "./hooks/useRunnerLane";
import { interruptComfyWorkflow, runComfyWorkflow, resetComfySession, testComfyConnection } from "./services/comfy";
import { augmentDiscoveryWithSdvn, enrichFieldsWithDiscovery, getComfyDiscovery, resetComfyDiscoveryCache } from "./services/comfyDiscovery";
import { configFieldsToNodes, getAppDefinition, runRunningHubApp, runRunningHubWorkflow } from "./services/runningHub";

function runnerLabelForKind(kind) {
  return kind === "comfy" ? "ComfyUI" : "RunningHub";
}

function modeLabelForKind(kind) {
  if (kind === "comfy") return "ComfyUI";
  if (kind === "runninghub-workflow") return "RH Workflow";
  return "RH App";
}

function nodeToField(node) {
  const type = String(node.fieldType || "STRING").toUpperCase();
  const data = node.fieldData;
  let choices = Array.isArray(data) ? data : data?.options || data?.values || data?.choices || [];
  if (!choices.length && typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      choices = Array.isArray(parsed) ? parsed : parsed?.options || parsed?.values || parsed?.choices || [];
    } catch { /* RunningHub also uses plain strings for field metadata. */ }
  }
  return {
    key: `${node.nodeId}|${node.fieldName}`,
    node,
    ui: {
      label: node.description || node.nodeName || node.fieldName,
      type: type === "IMAGE" ? "image" : type === "AUDIO" ? "audio" : type === "VIDEO" ? "video" : type === "LIST" ? "dropdown" : ["INT", "INTEGER"].includes(type) ? "int" : ["FLOAT", "NUMBER"].includes(type) ? "float" : String(node.fieldValue || "").length > 80 ? "text" : "string",
      value: node.fieldValue ?? "",
      choices
    }
  };
}

export default function App() {
  const [catalog, setCatalog] = useState([]);
  const [mode, setMode] = useState("comfy");
  const [selected, setSelected] = useState(null);
  const [selectedByMode, setSelectedByMode] = useState({});
  const [appInfo, setAppInfo] = useState(null);
  const [config, setConfig] = useState(null);
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  // Ảnh input theo slot: field ảnh đầu tiên → "current" (tương thích bản cũ + import từ menu
  // chuột phải), các field ảnh còn lại → "field:<key>". Template nhiều input image → nhiều panel.
  const [images, setImages] = useState({});
  const [outputs, setOutputs] = useState([]);
  const [checked, setChecked] = useState(new Set());
  const [settings, setSettings] = useState({ comfyUrl: "http://127.0.0.1:8188", runningHubApiKey: "", theme: "system" });
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [importingFolder, setImportingFolder] = useState(false);
  const [scanningApp, setScanningApp] = useState(false);
  const [rhLibraryOpen, setRhLibraryOpen] = useState(false);
  const comfyLane = useRunnerLane();
  const rhLane = useRunnerLane();
  const lanes = { comfy: comfyLane, rh: rhLane };
  const [autoRunImports, setAutoRunImports] = useState([]);
  const [previewOutput, setPreviewOutput] = useState(null);
  const [status, setStatus] = useState(() => t("app.status.ready"));
  const [error, setError] = useState("");
  const handledImportIdsRef = useRef(new Set());
  const workspaceReadyRef = useRef(false);
  const previewUrlRef = useRef("");
  const {
    getPresets,
    savePreset,
    updatePreset,
    deletePreset,
    presetsVersion,
    presetsStorageWarning
  } = usePresets();

  const importFromFile = useCallback(async (slot, file) => {
    setError("");
    try {
      const record = await normalizeImageRecord(file, file.name);
      await saveInput(record, slot);
      setImages(current => ({ ...current, [slot]: record }));
      setStatus(t("import.done"));
    } catch (nextError) {
      setError(nextError.message);
    }
  }, []);

  const importFromUrl = useCallback(async (slot, url, options = {}) => {
    setError("");
    setStatus(t("import.fromWeb"));
    try {
      const { blob, suggestedName } = await loadImportBlob({
        url,
        stagingId: options.stagingId,
        embeddedImage: options.embeddedImage,
        pageUrl: options.pageUrl,
        tabId: options.tabId,
        windowId: options.windowId,
        name: options.name,
        allowRemoteFetch: options.allowRemoteFetch !== false
      });
      let name = suggestedName || "web-image";
      try { if (!suggestedName) name = new URL(url).pathname.split("/").filter(Boolean).pop() || name; } catch { /* data URL */ }
      const record = await normalizeImageRecord(blob, name);
      await saveInput(record, slot);
      setImages(current => ({ ...current, [slot]: record }));
      setStatus(t("import.fromWebDone"));
      return record;
    } catch (nextError) {
      setError(nextError.message);
      setStatus(t("import.failed"));
      return null;
    }
  }, []);

  const handleExternalImport = useCallback(async payload => {
    if (!payload?.url && !payload?.embeddedImage && !payload?.stagingId) return;
    const requestId = payload.requestId || `${payload.url}:${payload.createdAt || "legacy"}`;

    return runExclusiveImport(requestId, async () => {
      if (handledImportIdsRef.current.has(requestId)) return null;
      handledImportIdsRef.current.add(requestId);
      if (handledImportIdsRef.current.size > 100) {
        const oldestRequestId = handledImportIdsRef.current.values().next().value;
        handledImportIdsRef.current.delete(oldestRequestId);
      }

      if (payload.captureError && !payload.embeddedImage && !payload.stagingId) {
        setError(payload.captureError);
        setStatus(t("import.failed"));
        return null;
      }

      // Import từ menu chuột phải luôn vào slot "current" (field ảnh đầu tiên).
      const importedImage = await importFromUrl("current", payload.url, {
        stagingId: payload.stagingId,
        embeddedImage: payload.embeddedImage,
        pageUrl: payload.pageUrl,
        tabId: payload.tabId,
        windowId: payload.windowId,
        allowRemoteFetch: !payload.stagingId && !payload.embeddedImage
      });
      if (importedImage && payload.autoRun) {
        setAutoRunImports(current => [...current, {
          requestId,
          createdAt: Number(payload.createdAt) || Date.now(),
          image: importedImage
        }].sort((left, right) => left.createdAt - right.createdAt));
        setStatus(t("import.autoRunPreparing"));
      }
      return importedImage;
    });
  }, [importFromUrl]);

  useEffect(() => {
    Promise.all([loadCatalog(), listCustomCatalogItems(), loadInputs(), listOutputs(), readSettings(), readWorkspaceState()]).then(([items, customItems, savedImages, savedOutputs, savedSettings, savedWorkspace]) => {
      const defaultsById = new Map(items.map(item => [item.id, item]));
      const mergedItems = [...items, ...customItems.filter(item => !defaultsById.has(item.id))];
      const savedMode = ["comfy", "runninghub-workflow", "runninghub-app"].includes(savedWorkspace.mode)
        ? savedWorkspace.mode
        : "comfy";
      const savedSelectedByMode = savedWorkspace.selectedByMode || {};
      const restoredSelected = mergedItems.find(item => (
        item.kind === savedMode && item.id === savedSelectedByMode[savedMode]
      )) || mergedItems.find(item => item.kind === savedMode) || null;
      setCatalog(mergedItems);
      setMode(savedMode);
      setSelectedByMode(savedSelectedByMode);
      setSelected(restoredSelected);
      setImages(savedImages || {});
      setOutputs(savedOutputs);
      setLanguage(resolveLanguage(savedSettings.language || "auto"));
      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
      setStatus(t("app.status.ready"));
      setSettingsOpen(Boolean(savedWorkspace.settingsOpen));
      workspaceReadyRef.current = true;
    }).catch(nextError => setError(nextError.message));
    consumePendingImport().then(payload => {
      if (payload) {
        chrome.storage.local.remove("pendingImport").catch(() => {});
        handleExternalImport(payload);
      }
    });
    return onPendingImport(payload => {
      chrome.storage.local.remove("pendingImport").catch(() => {});
      handleExternalImport(payload);
    });
  }, [handleExternalImport]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme || "system";
  }, [settings.theme]);

  const modeItems = useMemo(() => catalog.filter(item => item.kind === mode), [catalog, mode]);
  const selectedTemplateId = selected?.id || "";
  const currentPresets = useMemo(
    () => selectedTemplateId ? getPresets(selectedTemplateId) : [],
    [getPresets, presetsVersion, selectedTemplateId]
  );

  useEffect(() => {
    if (!modeItems.length) {
      setSelected(null);
      return;
    }
    if (!selected || selected.kind !== mode || !modeItems.some(item => item.id === selected.id)) {
      setSelected(modeItems.find(item => item.id === selectedByMode[mode]) || modeItems[0]);
    }
  }, [mode, modeItems, selected, selectedByMode]);

  useEffect(() => {
    if (!workspaceReadyRef.current || !selected?.id || selected.kind !== mode) return;
    setSelectedByMode(current => (
      current[mode] === selected.id ? current : { ...current, [mode]: selected.id }
    ));
  }, [mode, selected]);

  useEffect(() => {
    if (!workspaceReadyRef.current) return;
    writeWorkspaceState({
      mode,
      selectedByMode,
      settingsOpen
    }).catch(error => {
      console.error("Failed to save extension workspace state:", error);
    });
  }, [mode, selectedByMode, settingsOpen]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function loadFields() {
      setError("");
      setLoadingFields(true);
      setConfig(null);
      setFields([]);
      setValues({});
      setAppInfo(selected.kind === "runninghub-app" ? selected.appInfo || null : null);
      try {
        if (selected.kind === "runninghub-app") {
          if (!settings.runningHubApiKey) {
            return;
          }
          const definition = await getAppDefinition(settings.runningHubApiKey, selected.slug);
          const nextFields = definition.nodes.map(nodeToField);
          if (!cancelled) {
            setConfig({ app: { name: definition.name }, appNodes: definition.nodes });
            setAppInfo(definition.info);
            setFields(nextFields);
            setValues(defaultValues(nextFields, { kind: selected.kind }));
            if (selected.custom) {
              const refreshed = { ...selected, name: definition.name, appInfo: definition.info };
              await saveCustomCatalogItem(refreshed);
              if (!cancelled) setCatalog(current => current.map(item => item.id === refreshed.id ? refreshed : item));
            }
          }
        } else {
          const nextConfig = await loadTemplateConfig(selected);
          const baseFields = flattenConfigInputs(nextConfig);
          if (cancelled) return;
          // Render form NGAY với field từ YAML — không chặn UI chờ quét model/thư viện SDVN.
          setConfig(nextConfig);
          setFields(baseFields);
          setValues(defaultValues(baseFields, { kind: selected.kind }));
          setLoadingFields(false);
          if (selected.kind === "comfy") {
            // Quét model + thư viện SDVN chạy NỀN, xong mới enrich lại field (dropdown
            // hiện spinner qua discoveryLoading trong lúc chờ).
            setDiscoveryLoading(true);
            try {
              // Workflow JSON để dò node loader SDVN (bơm thêm model/lora kể cả khi không có server).
              const workflowJson = await loadComfyWorkflow(selected);
              let discovery = { dynamicChoices: {}, modelLists: {} };
              if (settings.comfyUrl) {
                try {
                  discovery = await getComfyDiscovery(settings.comfyUrl);
                } catch (discoveryError) {
                  if (!cancelled) setError(discoveryError.message || t("discovery.failed"));
                }
              }
              discovery = await augmentDiscoveryWithSdvn(discovery, baseFields, workflowJson);
              const enriched = enrichFieldsWithDiscovery(baseFields, discovery, workflowJson);
              if (!cancelled) {
                setFields(enriched);
                // Giữ giá trị user đã chỉnh trong lúc chờ; chỉ điền default cho ô trống
                // và thay giá trị không còn nằm trong danh sách model mới.
                setValues(current => {
                  const defaults = defaultValues(enriched, { kind: selected.kind });
                  const next = { ...current };
                  for (const [key, value] of Object.entries(defaults)) {
                    if (next[key] == null || next[key] === "") next[key] = value;
                  }
                  for (const field of enriched) {
                    if (!field.ui?.dynamic) continue;
                    const choices = (field.ui.choices || []).map(String);
                    if (choices.length && !choices.includes(String(next[field.key] ?? ""))) {
                      next[field.key] = defaults[field.key];
                    }
                  }
                  return next;
                });
              }
            } finally {
              if (!cancelled) setDiscoveryLoading(false);
            }
          }
        }
      } catch (nextError) {
        if (!cancelled) setError(nextError.message);
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    }
    loadFields();
    return () => { cancelled = true; };
  }, [selected, settings.runningHubApiKey, settings.comfyUrl]);

  const awaitingModelDiscovery = selected?.kind === "comfy" && discoveryLoading;
  // Field ảnh đang hiển thị (top-level + nhánh menu-sub active), theo thứ tự khai báo.
  const activeImageFields = useMemo(
    () => expandActiveFields(fields, values).filter(field => IMAGE_FIELD_TYPES.includes(field.ui?.type)),
    [fields, values]
  );
  // Slot lưu ảnh cho từng field: field đầu → "current", còn lại → "field:<key>".
  const imageSlots = useMemo(() => {
    const map = {};
    activeImageFields.forEach((field, index) => {
      map[field.key] = index === 0 ? "current" : `field:${field.key}`;
    });
    return map;
  }, [activeImageFields]);
  const canSubmit = useMemo(
    () => Boolean(
      selected && !loadingFields && !awaitingModelDiscovery
      && activeImageFields.every(field => images[imageSlots[field.key]])
    ),
    [selected, loadingFields, awaitingModelDiscovery, activeImageFields, images, imageSlots]
  );
  const topLevelImageFields = useMemo(
    () => fields.filter(field => IMAGE_FIELD_TYPES.includes(field.ui?.type)),
    [fields]
  );
  const currentLaneKey = laneKeyForMode(mode);
  const currentLane = lanes[currentLaneKey];
  const otherLaneKey = currentLaneKey === "comfy" ? "rh" : "comfy";
  const otherLane = lanes[otherLaneKey];
  const queueCount = currentLane.queue.length + (
    selected && laneKeyForKind(selected.kind) === currentLaneKey ? autoRunImports.length : 0
  );

  function createJobSnapshot(imageOverride = null) {
    // Chốt ảnh cho từng field ảnh tại thời điểm queue; override (auto-run từ menu
    // chuột phải) chỉ thay ảnh của slot "current" (field ảnh đầu tiên).
    const imagesByFieldKey = {};
    for (const field of activeImageFields) {
      const slot = imageSlots[field.key];
      imagesByFieldKey[field.key] = (imageOverride && slot === "current")
        ? imageOverride
        : images[slot] || null;
    }
    return {
      id: crypto.randomUUID(),
      queuedAt: Date.now(),
      selected,
      config,
      fields,
      values: { ...values },
      images: imagesByFieldKey,
      settings: {
        comfyUrl: settings.comfyUrl,
        runningHubApiKey: settings.runningHubApiKey
      }
    };
  }

  async function persistResults(results, job, startedAt, onStatus) {
    const saved = [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const dimensions = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(result.blob);
        const img = new Image();
        img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = reject;
        img.src = url;
      });
      const record = {
        id: crypto.randomUUID(),
        blob: result.blob,
        name: result.name || `${job.selected.slug}-${Date.now()}-${index}.png`,
        mimeType: result.blob.type,
        size: result.blob.size,
        ...dimensions,
        workflowName: job.selected.name,
        durationMs: Date.now() - startedAt,
        createdAt: Date.now()
      };
      await saveOutput(record);
      saved.push(record);
    }
    setOutputs(current => [...saved, ...current]);
    setChecked(new Set(saved.map(item => item.id)));
    onStatus?.(t("run.completedOutputs", { count: saved.length }));
  }

  async function executeJob(laneKey, job) {
    const lane = lanes[laneKey];
    if (job.selected.kind.startsWith("runninghub") && !job.settings.runningHubApiKey) {
      setSettingsOpen(true);
      throw new Error(t("run.needApiKey"));
    }

    lane.setError("");
    lane.setRunning(true);
    lane.setActiveJob(job);
    lane.activeJobRef.current = job;
    const controller = new AbortController();
    lane.abortRef.current = controller;
    const startedAt = Date.now();
    const queueAhead = lane.queueRef.current.length;
    const updateStatus = message => lane.setStatus(message);

    try {
      updateStatus(t("run.processing", { runner: runnerLabelForKind(job.selected.kind) }));
      if (queueAhead) updateStatus(t("run.processingQueued", { runner: runnerLabelForKind(job.selected.kind), count: queueAhead }));

      let results;
      if (job.selected.kind === "comfy") {
        results = await runComfyWorkflow({
          url: job.settings.comfyUrl,
          workflowUrl: job.selected.workflowUrl,
          workflow: job.selected.workflow,
          config: job.config,
          fields: job.fields,
          values: job.values,
          images: job.images,
          signal: controller.signal,
          onStatus: updateStatus
        });
      } else if (job.selected.kind === "runninghub-workflow") {
        const nodes = configFieldsToNodes(job.fields, job.values, job.images);
        results = await runRunningHubWorkflow({
          apiKey: job.settings.runningHubApiKey,
          workflowId: String(job.config?.runninghub?.workflowId || ""),
          nodes,
          signal: controller.signal,
          onStatus: updateStatus
        });
      } else {
        // RH App: node media nhận record ảnh của chính field đó trong fieldValue.
        const nodes = job.fields.map(field => ({
          ...field.node,
          fieldValue: IMAGE_FIELD_TYPES.includes(field.ui?.type)
            ? (job.images[field.key] ?? field.node.fieldValue)
            : job.values[field.key]
        }));
        results = await runRunningHubApp({
          apiKey: job.settings.runningHubApiKey,
          webappId: job.selected.slug,
          nodes,
          signal: controller.signal,
          onStatus: updateStatus
        });
      }

      await persistResults(results, job, startedAt, updateStatus);
    } catch (nextError) {
      if (nextError.name !== "AbortError") lane.setError(nextError.message);
      updateStatus(nextError.name === "AbortError" ? t("run.cancelled") : t("run.failed"));
      throw nextError;
    } finally {
      lane.activeJobRef.current = null;
      lane.abortRef.current = null;
      const [nextJob, ...remaining] = lane.queueRef.current;
      lane.setQueue(remaining);
      if (nextJob) {
        lane.setActiveJob(nextJob);
        updateStatus(remaining.length ? t("run.nextJobRemaining", { count: remaining.length }) : t("run.nextJob"));
        void executeJob(laneKey, nextJob).catch(() => {});
      } else {
        lane.setActiveJob(null);
        lane.setRunning(false);
      }
    }
  }

  function enqueueRun(imageOverride = null) {
    if (!selected) return setError(t("run.selectFirst"));
    const missingField = activeImageFields.find(field => {
      const slot = imageSlots[field.key];
      if (imageOverride && slot === "current") return false;
      return !images[slot];
    });
    if (missingField) {
      return setError(
        activeImageFields.length > 1
          ? t("run.importImageFor", { label: missingField.ui?.label || missingField.key })
          : t("run.importImageFirst")
      );
    }
    if (selected.kind.startsWith("runninghub") && !settings.runningHubApiKey) {
      setSettingsOpen(true);
      return setError(t("run.needApiKey"));
    }

    const job = createJobSnapshot(imageOverride);
    const laneKey = laneKeyForKind(job.selected.kind);
    const lane = lanes[laneKey];
    if (lane.running || lane.queueRef.current.length > 0) {
      const nextQueue = [...lane.queueRef.current, job];
      lane.setQueue(nextQueue);
      lane.setStatus(t("run.queued", { count: nextQueue.length }));
      lane.setError("");
      return;
    }

    void executeJob(laneKey, job).catch(() => {});
  }

  useEffect(() => {
    if (!autoRunImports.length || !selected) return;
    if (selected.kind.startsWith("runninghub") && !settings.runningHubApiKey) {
      setSettingsDraft(settings);
      setSettingsOpen(true);
      setError(t("run.needApiKeyContextMenu"));
      return;
    }
    if (!config || loadingFields || (selected.kind === "comfy" && discoveryLoading)) return;

    const [nextImport] = autoRunImports;
    setAutoRunImports(current => current.slice(1));
    enqueueRun(nextImport.image);
  }, [autoRunImports, config, discoveryLoading, fields, loadingFields, selected, settings, values]);

  function clearQueue() {
    const lane = lanes[currentLaneKey];
    const pendingAutoRuns = selected && laneKeyForKind(selected.kind) === currentLaneKey ? autoRunImports.length : 0;
    if (!lane.queueRef.current.length && !pendingAutoRuns) return;
    lane.setQueue([]);
    if (pendingAutoRuns) setAutoRunImports([]);
    lane.setStatus(t("run.queueCleared"));
    lane.setError("");
  }

  async function stopCurrent() {
    const lane = lanes[currentLaneKey];
    if (!lane.running && !lane.activeJobRef.current) return;
    lane.setStatus(t("run.stopping"));
    lane.abortRef.current?.abort();
    const job = lane.activeJobRef.current;
    if (currentLaneKey === "comfy" && job?.selected?.kind === "comfy" && job.settings?.comfyUrl) {
      try {
        await interruptComfyWorkflow(job.settings.comfyUrl);
      } catch {
        /* Comfy có thể đã dừng hoặc không phản hồi interrupt */
      }
    }
  }

  async function stopAll() {
    clearQueue();
    await stopCurrent();
  }

  const openPreview = useCallback(output => {
    if (!output?.blob) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(output.blob);
    previewUrlRef.current = url;
    setPreviewOutput({ url, name: output.name, output });
  }, []);

  const closePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewOutput(null);
  }, []);

  const previewIndex = useMemo(
    () => previewOutput ? outputs.findIndex(output => output.id === previewOutput.output.id) : -1,
    [outputs, previewOutput]
  );
  const previousPreviewIndex = adjacentPreviewIndex(previewIndex, -1, outputs.length);
  const nextPreviewIndex = adjacentPreviewIndex(previewIndex, 1, outputs.length);

  const showPreviousPreview = useCallback(() => {
    if (previousPreviewIndex >= 0) openPreview(outputs[previousPreviewIndex]);
  }, [openPreview, outputs, previousPreviewIndex]);

  const showNextPreview = useCallback(() => {
    if (nextPreviewIndex >= 0) openPreview(outputs[nextPreviewIndex]);
  }, [nextPreviewIndex, openPreview, outputs]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  async function selectWorkflow(item) {
    if (!item) return;
    setSelected(item);
    setSelectedByMode(current => ({ ...current, [item.kind]: item.id }));
    setStatus(t("catalog.selected", { name: item.name }));
  }

  async function persistImported(imported) {
    for (const item of imported) await saveCustomCatalogItem(item);
    setCatalog(current => {
      const importedIds = new Set(imported.map(item => item.id));
      return [...current.filter(item => !importedIds.has(item.id)), ...imported];
    });
    if (imported[0]) setSelected(imported[0]);
    setStatus(t("catalog.importedTemplates", { count: imported.length }));
  }

  async function chooseTemplateFolder() {
    setError("");
    if (typeof window.showDirectoryPicker !== "function") {
      setError(t("catalog.noDirPicker"));
      return;
    }
    setImportingFolder(true);
    try {
      const directoryHandle = await window.showDirectoryPicker({ mode: "read" });
      setStatus(t("catalog.scanningFolder"));
      await persistImported(await importTemplateDirectory(directoryHandle, mode));
    } catch (nextError) {
      if (nextError.name === "AbortError") return;
      setError(nextError.message);
      setStatus(t("catalog.importFailed"));
    } finally {
      setImportingFolder(false);
    }
  }

  async function chooseTemplateZip(file) {
    if (!file) return;
    setError("");
    setImportingFolder(true);
    try {
      setStatus(t("catalog.unzipping"));
      await persistImported(await importTemplateZip(file, mode));
    } catch (nextError) {
      setError(nextError.message);
      setStatus(t("catalog.zipFailed"));
    } finally {
      setImportingFolder(false);
    }
  }

  async function addCustomApp(appId) {
    setError("");
    if (!settings.runningHubApiKey) {
      setSettingsDraft(settings);
      setSettingsOpen(true);
      setError(t("catalog.needApiKeyScan"));
      return false;
    }
    setScanningApp(true);
    try {
      const existing = catalog.find(item => item.kind === "runninghub-app" && item.slug === String(appId).trim());
      if (existing) {
        setSelected(existing);
        setStatus(t("catalog.selected", { name: existing.name }));
        return;
      }
      setStatus(t("catalog.scanningApp"));
      const definition = await getAppDefinition(settings.runningHubApiKey, String(appId).trim());
      const item = createCustomRunningHubApp(appId, definition.info);
      await saveCustomCatalogItem(item);
      setCatalog(current => [...current, item]);
      setSelected(item);
      setAppInfo(definition.info);
      setStatus(t("catalog.addedApp", { name: item.name }));
    } catch (nextError) {
      setError(nextError.message);
      setStatus(t("catalog.invalidAppId"));
      return false;
    } finally {
      setScanningApp(false);
    }
    return true;
  }

  async function importFromLibrary(record) {
    const added = await addCustomApp(record.id);
    if (added !== false) setRhLibraryOpen(false);
  }

  async function removeCustomItem(item) {
    if (!item?.custom) return;
    await deleteCustomCatalogItem(item.id);
    setCatalog(current => current.filter(candidate => candidate.id !== item.id));
    setStatus(t("catalog.removedItem", { name: item.name }));
  }

  async function removeInput(slot) {
    await clearInput(slot);
    setImages(current => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  }

  function updateValue(key, value) {
    setValues(current => ({ ...current, [key]: value }));
  }

  // Binding panel import cho một field ảnh: ảnh + handler gắn với slot của field đó.
  const getImageInput = useCallback(fieldKey => {
    const slot = imageSlots[fieldKey];
    if (!slot) return null;
    return {
      image: images[slot] || null,
      onFile: file => importFromFile(slot, file),
      onUrl: (url, options) => importFromUrl(slot, url, options),
      onClear: () => removeInput(slot),
      busy: currentLane.running
    };
  }, [imageSlots, images, importFromFile, importFromUrl, currentLane.running]);

  async function run() {
    enqueueRun();
  }

  async function removeOutput(id) {
    await deleteOutput(id);
    setOutputs(current => current.filter(item => item.id !== id));
    setChecked(current => { const next = new Set(current); next.delete(id); return next; });
  }

  async function removeSelectedOutputs() {
    if (!checked.size) return;
    const selectedIds = new Set(checked);
    await deleteOutputs(selectedIds);
    setOutputs(current => current.filter(item => !selectedIds.has(item.id)));
    setChecked(new Set());
  }

  function toggleOutput(id) {
    setChecked(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function saveSettings() {
    await writeSettings(settingsDraft);
    setSettings(settingsDraft);
    resetComfySession();
    resetComfyDiscoveryCache();
    setSettingsOpen(false);
    setStatus(t("settings.saved"));
  }

  return (
    <I18nProvider language={settings.language || "auto"}>
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <div className="brand"><BrandMark /><strong>aPix Builder</strong><span>Web</span></div>
          <div className="topbar-actions"><span className="ready-dot" title={currentLane.running ? currentLane.status : status} /><button className="square-button" onClick={() => { setSettingsDraft(settings); setSettingsOpen(true); }} aria-label={t("app.openSettings")}><Settings size={19} /></button></div>
        </div>
        <ModeTabs value={mode} onChange={nextMode => { setMode(nextMode); setError(""); if (!lanes[laneKeyForMode(nextMode)].running) setStatus(t("app.modeChanged", { mode: modeLabelForKind(nextMode) })); }} />
      </header>

      <main>
        <WorkflowPicker
          mode={mode}
          items={modeItems}
          selected={selected}
          onSelect={selectWorkflow}
          appInfo={appInfo}
          onImportDirectory={chooseTemplateFolder}
          onImportZip={chooseTemplateZip}
          onAddCustomApp={addCustomApp}
          onDeleteCustom={removeCustomItem}
          importingFolder={importingFolder}
          scanningApp={scanningApp}
          onOpenLibrary={() => setRhLibraryOpen(true)}
        />
        <RhLibraryBrowser
          open={rhLibraryOpen}
          onClose={() => setRhLibraryOpen(false)}
          onImport={importFromLibrary}
          importing={scanningApp}
        />
        {mode !== "runninghub-app" ? (
          <PresetBar
            templateId={selectedTemplateId}
            presets={currentPresets}
            onLoad={nextValues => setValues(current => ({ ...current, ...nextValues }))}
            onSave={name => savePreset(selectedTemplateId, name, values)}
            onUpdate={id => updatePreset(selectedTemplateId, id, values)}
            onDelete={id => deletePreset(selectedTemplateId, id)}
            storageWarning={presetsStorageWarning}
          />
        ) : null}
        {topLevelImageFields.map(field => {
          const binding = getImageInput(field.key);
          return binding ? (
            <ImportPanel
              key={field.key}
              label={topLevelImageFields.length > 1 ? (field.ui?.label || field.key) : t("import.title")}
              {...binding}
            />
          ) : null;
        })}
        <DynamicFields
          fields={fields}
          values={values}
          onChange={updateValue}
          loading={loadingFields}
          discoveryLoading={discoveryLoading}
          workflowKind={mode}
          getImageInput={getImageInput}
        />

        <section className="run-section">
          <RunControls
            running={currentLane.running}
            canRun={canSubmit}
            canCancel={currentLane.running}
            queueCount={queueCount}
            onRun={run}
            onCancel={stopCurrent}
            onClearQueue={clearQueue}
            onStopAll={stopAll}
            runLabel={t("run.runLabel", { name: selected?.name || t("run.workflowFallback") })}
            runningLabel={currentLane.activeJob?.selected?.name}
            runningRunner={currentLane.activeJob ? runnerLabelForKind(currentLane.activeJob.selected.kind) : ""}
          />
          {otherLane.running && otherLane.activeJob ? (
            <div className="queue-mode-hint">
              {t("run.parallelRunning", { runner: runnerLabelForKind(otherLane.activeJob.selected.kind) })} <strong>{otherLane.activeJob.selected.name}</strong>
            </div>
          ) : null}
          {currentLane.running && currentLane.status ? (
            <div className="processing-status"><LoaderCircle className="spin" size={14} /><span>{currentLane.status}</span></div>
          ) : null}
          {!currentLane.running && queueCount > 0 ? (
            <div className="queue-status">{t("run.jobsInQueue", { count: queueCount })}</div>
          ) : null}
          {(currentLane.error || error) ? (
            <div className="error-message" role="alert">{currentLane.error || error}</div>
          ) : null}
        </section>

        <OutputLibrary
          outputs={outputs}
          selected={checked}
          onToggle={toggleOutput}
          onToggleAll={() => setChecked(checked.size === outputs.length ? new Set() : new Set(outputs.map(item => item.id)))}
          onDownload={output => downloadBlob(output.blob, output.name)}
          onDownloadSelected={async () => { for (const output of outputs.filter(item => checked.has(item.id))) await downloadBlob(output.blob, output.name); }}
          onDelete={removeOutput}
          onDeleteSelected={removeSelectedOutputs}
          onView={openPreview}
        />
      </main>

      <SettingsPanel
        open={settingsOpen}
        settings={settingsDraft}
        onChange={setSettingsDraft}
        onSave={saveSettings}
        onTestComfy={async () => { resetComfySession(); resetComfyDiscoveryCache(); await testComfyConnection(settingsDraft.comfyUrl); setStatus(t("settings.comfyConnectedStatus")); }}
        onClose={() => setSettingsOpen(false)}
      />

      <ImageLightbox
        open={Boolean(previewOutput)}
        imageUrl={previewOutput?.url || ""}
        title={previewOutput?.name || ""}
        currentPosition={previewIndex + 1}
        total={outputs.length}
        canPrevious={previousPreviewIndex >= 0}
        canNext={nextPreviewIndex >= 0}
        onPrevious={showPreviousPreview}
        onNext={showNextPreview}
        onClose={closePreview}
        onDownload={previewOutput?.output ? () => downloadBlob(previewOutput.output.blob, previewOutput.output.name) : undefined}
      />
    </div>
    </I18nProvider>
  );
}

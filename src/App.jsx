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
import { defaultValues, flattenConfigInputs, loadCatalog, loadTemplateConfig } from "./lib/catalog";
import { normalizeImageRecord } from "./lib/images";
import { adjacentPreviewIndex } from "./lib/lightboxNavigation";
import { clearInput, deleteCustomCatalogItem, deleteOutput, deleteOutputs, listCustomCatalogItems, listOutputs, loadInput, saveCustomCatalogItem, saveInput, saveOutput } from "./lib/libraryDb";
import { createCustomRunningHubApp, importTemplateDirectory } from "./lib/templateImport";
import { usePresets } from "./hooks/usePresets";
import { interruptComfyWorkflow, runComfyWorkflow, resetComfySession, testComfyConnection } from "./services/comfy";
import { enrichFieldsWithDiscovery, getComfyDiscovery, resetComfyDiscoveryCache } from "./services/comfyDiscovery";
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
      type: type === "IMAGE" ? "image" : type === "LIST" ? "dropdown" : ["INT", "INTEGER"].includes(type) ? "int" : ["FLOAT", "NUMBER"].includes(type) ? "float" : String(node.fieldValue || "").length > 80 ? "text" : "string",
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
  const [image, setImage] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [checked, setChecked] = useState(new Set());
  const [settings, setSettings] = useState({ comfyUrl: "http://127.0.0.1:8188", runningHubApiKey: "", theme: "system" });
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [importingFolder, setImportingFolder] = useState(false);
  const [scanningApp, setScanningApp] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [runQueue, setRunQueue] = useState([]);
  const [autoRunImports, setAutoRunImports] = useState([]);
  const [previewOutput, setPreviewOutput] = useState(null);
  const [status, setStatus] = useState("Sẵn sàng");
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const runQueueRef = useRef([]);
  const activeJobRef = useRef(null);
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

  const importFromFile = useCallback(async file => {
    setError("");
    try {
      const record = await normalizeImageRecord(file, file.name);
      await saveInput(record);
      setImage(record);
      setStatus("Đã import ảnh");
    } catch (nextError) {
      setError(nextError.message);
    }
  }, []);

  const importFromUrl = useCallback(async (url, options = {}) => {
    setError("");
    setStatus("Đang import ảnh từ trang web…");
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
      await saveInput(record);
      setImage(record);
      setStatus("Đã import ảnh từ trang web");
      return record;
    } catch (nextError) {
      setError(nextError.message);
      setStatus("Import thất bại");
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
        setStatus("Import thất bại");
        return null;
      }

      const importedImage = await importFromUrl(payload.url, {
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
        setStatus("Đã nhận ảnh, đang chuẩn bị chạy…");
      }
      return importedImage;
    });
  }, [importFromUrl]);

  useEffect(() => {
    Promise.all([loadCatalog(), listCustomCatalogItems(), loadInput(), listOutputs(), readSettings(), readWorkspaceState()]).then(([items, customItems, savedImage, savedOutputs, savedSettings, savedWorkspace]) => {
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
      setImage(savedImage || null);
      setOutputs(savedOutputs);
      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
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
          let nextFields = flattenConfigInputs(nextConfig);
          if (selected.kind === "comfy") {
            if (!settings.comfyUrl) {
              if (!cancelled) {
                setConfig(nextConfig);
                setFields(nextFields);
                setValues(defaultValues(nextFields, { kind: selected.kind }));
              }
              return;
            }
            if (!cancelled) setDiscoveryLoading(true);
            try {
              const discovery = await getComfyDiscovery(settings.comfyUrl);
              nextFields = enrichFieldsWithDiscovery(nextFields, discovery);
            } catch (discoveryError) {
              if (!cancelled) setError(discoveryError.message || "Không quét được model từ ComfyUI");
            } finally {
              if (!cancelled) setDiscoveryLoading(false);
            }
          }
          if (!cancelled) {
            setConfig(nextConfig);
            setFields(nextFields);
            setValues(defaultValues(nextFields, { kind: selected.kind }));
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
  const canSubmit = useMemo(
    () => Boolean(image && selected && !loadingFields && !awaitingModelDiscovery),
    [image, selected, loadingFields, awaitingModelDiscovery]
  );
  const queueCount = runQueue.length + autoRunImports.length;

  function setQueue(nextQueue) {
    runQueueRef.current = nextQueue;
    setRunQueue(nextQueue);
  }

  function createJobSnapshot(imageOverride = null) {
    return {
      id: crypto.randomUUID(),
      queuedAt: Date.now(),
      selected,
      config,
      fields,
      values: { ...values },
      image: imageOverride || image,
      settings: {
        comfyUrl: settings.comfyUrl,
        runningHubApiKey: settings.runningHubApiKey
      }
    };
  }

  async function persistResults(results, job, startedAt) {
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
    setStatus(`Hoàn tất ${saved.length} output`);
  }

  async function executeJob(job) {
    if (job.selected.kind.startsWith("runninghub") && !job.settings.runningHubApiKey) {
      setSettingsOpen(true);
      throw new Error("Cần RunningHub API Key để chạy lựa chọn này");
    }

    setError("");
    setRunning(true);
    setActiveJob(job);
    activeJobRef.current = job;
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    const queueAhead = runQueueRef.current.length;

    try {
      setStatus(`${runnerLabelForKind(job.selected.kind)} đang xử lý…`);
      if (queueAhead) setStatus(`${runnerLabelForKind(job.selected.kind)} đang xử lý (${queueAhead} trong hàng chờ)…`);

      let results;
      if (job.selected.kind === "comfy") {
        results = await runComfyWorkflow({
          url: job.settings.comfyUrl,
          workflowUrl: job.selected.workflowUrl,
          workflow: job.selected.workflow,
          config: job.config,
          fields: job.fields,
          values: job.values,
          image: job.image,
          signal: controller.signal,
          onStatus: setStatus
        });
      } else if (job.selected.kind === "runninghub-workflow") {
        const nodes = configFieldsToNodes(job.fields, job.values, job.image);
        results = await runRunningHubWorkflow({
          apiKey: job.settings.runningHubApiKey,
          workflowId: String(job.config?.runninghub?.workflowId || ""),
          nodes,
          image: job.image,
          signal: controller.signal,
          onStatus: setStatus
        });
      } else {
        const nodes = job.fields.map(field => ({ ...field.node, fieldValue: job.values[field.key] }));
        results = await runRunningHubApp({
          apiKey: job.settings.runningHubApiKey,
          webappId: job.selected.slug,
          nodes,
          image: job.image,
          signal: controller.signal,
          onStatus: setStatus
        });
      }

      await persistResults(results, job, startedAt);
    } catch (nextError) {
      if (nextError.name !== "AbortError") setError(nextError.message);
      setStatus(nextError.name === "AbortError" ? "Đã hủy" : "Chạy thất bại");
      throw nextError;
    } finally {
      activeJobRef.current = null;
      abortRef.current = null;
      const [nextJob, ...remaining] = runQueueRef.current;
      setQueue(remaining);
      if (nextJob) {
        setActiveJob(nextJob);
        setStatus(remaining.length ? `Chuyển sang job tiếp theo (${remaining.length} còn lại)…` : "Chuyển sang job tiếp theo…");
        void executeJob(nextJob).catch(() => {});
      } else {
        setActiveJob(null);
        setRunning(false);
      }
    }
  }

  function enqueueRun(imageOverride = null) {
    const jobImage = imageOverride || image;
    if (!jobImage) return setError("Hãy import ảnh trước khi chạy");
    if (!selected) return setError("Hãy chọn template hoặc app");
    if (selected.kind.startsWith("runninghub") && !settings.runningHubApiKey) {
      setSettingsOpen(true);
      return setError("Cần RunningHub API Key để chạy lựa chọn này");
    }

    const job = createJobSnapshot(jobImage);
    if (running || runQueueRef.current.length > 0) {
      const nextQueue = [...runQueueRef.current, job];
      setQueue(nextQueue);
      setStatus(`Đã thêm vào hàng chờ (${nextQueue.length})`);
      setError("");
      return;
    }

    void executeJob(job).catch(() => {});
  }

  useEffect(() => {
    if (!autoRunImports.length || !selected) return;
    if (selected.kind.startsWith("runninghub") && !settings.runningHubApiKey) {
      setSettingsDraft(settings);
      setSettingsOpen(true);
      setError("Nhập RunningHub API Key để chạy ảnh từ menu chuột phải");
      return;
    }
    if (!config || loadingFields || (selected.kind === "comfy" && discoveryLoading)) return;

    const [nextImport] = autoRunImports;
    setAutoRunImports(current => current.slice(1));
    enqueueRun(nextImport.image);
  }, [autoRunImports, config, discoveryLoading, fields, loadingFields, selected, settings, values]);

  function clearQueue() {
    if (!runQueueRef.current.length && !autoRunImports.length) return;
    setQueue([]);
    setAutoRunImports([]);
    setStatus("Đã xóa hàng chờ");
    setError("");
  }

  async function stopCurrent() {
    if (!running && !activeJobRef.current) return;
    setStatus("Đang dừng…");
    abortRef.current?.abort();
    const job = activeJobRef.current;
    if (job?.selected?.kind === "comfy" && job.settings?.comfyUrl) {
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
    setStatus(`Đã chọn ${item.name}`);
  }

  async function chooseTemplateFolder() {
    setError("");
    if (typeof window.showDirectoryPicker !== "function") {
      setError("Chrome hiện tại không hỗ trợ chọn thư mục an toàn. Hãy cập nhật Chrome.");
      return;
    }
    setImportingFolder(true);
    try {
      const directoryHandle = await window.showDirectoryPicker({ mode: "read" });
      setStatus("Đang quét thư mục template…");
      const imported = await importTemplateDirectory(directoryHandle, mode);
      for (const item of imported) await saveCustomCatalogItem(item);
      setCatalog(current => {
        const importedIds = new Set(imported.map(item => item.id));
        return [...current.filter(item => !importedIds.has(item.id)), ...imported];
      });
      setSelected(imported[0]);
      setStatus(`Đã import ${imported.length} template`);
    } catch (nextError) {
      if (nextError.name === "AbortError") return;
      setError(nextError.message);
      setStatus("Import template thất bại");
    } finally {
      setImportingFolder(false);
    }
  }

  async function addCustomApp(appId) {
    setError("");
    if (!settings.runningHubApiKey) {
      setSettingsDraft(settings);
      setSettingsOpen(true);
      setError("Nhập RunningHub API Key trước để quét thông tin App");
      return false;
    }
    setScanningApp(true);
    try {
      const existing = catalog.find(item => item.kind === "runninghub-app" && item.slug === String(appId).trim());
      if (existing) {
        setSelected(existing);
        setStatus(`Đã chọn ${existing.name}`);
        return;
      }
      setStatus("Đang quét thông tin RunningHub App…");
      const definition = await getAppDefinition(settings.runningHubApiKey, String(appId).trim());
      const item = createCustomRunningHubApp(appId, definition.info);
      await saveCustomCatalogItem(item);
      setCatalog(current => [...current, item]);
      setSelected(item);
      setAppInfo(definition.info);
      setStatus(`Đã thêm ${item.name}`);
    } catch (nextError) {
      setError(nextError.message);
      setStatus("App ID không hợp lệ");
      return false;
    } finally {
      setScanningApp(false);
    }
    return true;
  }

  async function removeCustomItem(item) {
    if (!item?.custom) return;
    await deleteCustomCatalogItem(item.id);
    setCatalog(current => current.filter(candidate => candidate.id !== item.id));
    setStatus(`Đã xóa ${item.name}`);
  }

  async function removeInput() {
    await clearInput();
    setImage(null);
  }

  function updateValue(key, value) {
    setValues(current => ({ ...current, [key]: value }));
  }

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
    setStatus("Đã lưu Settings");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <div className="brand"><BrandMark /><strong>aPix Builder</strong><span>Web</span></div>
          <div className="topbar-actions"><span className="ready-dot" title={status} /><button className="square-button" onClick={() => { setSettingsDraft(settings); setSettingsOpen(true); }} aria-label="Mở Settings"><Settings size={19} /></button></div>
        </div>
        <ModeTabs value={mode} onChange={nextMode => { setMode(nextMode); setError(""); if (!running) setStatus(`Chế độ ${modeLabelForKind(nextMode)}`); }} />
      </header>

      <main>
        <WorkflowPicker
          mode={mode}
          items={modeItems}
          selected={selected}
          onSelect={selectWorkflow}
          appInfo={appInfo}
          onImportDirectory={chooseTemplateFolder}
          onAddCustomApp={addCustomApp}
          onDeleteCustom={removeCustomItem}
          importingFolder={importingFolder}
          scanningApp={scanningApp}
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
        <ImportPanel image={image} onFile={importFromFile} onUrl={importFromUrl} onClear={removeInput} busy={running} />
        <DynamicFields fields={fields} values={values} onChange={updateValue} loading={loadingFields} discoveryLoading={discoveryLoading} workflowKind={mode} />

        <section className="run-section">
          <RunControls
            running={running}
            canRun={canSubmit}
            canCancel={running}
            queueCount={queueCount}
            onRun={run}
            onCancel={stopCurrent}
            onClearQueue={clearQueue}
            onStopAll={stopAll}
            runLabel={`Chạy ${selected?.name || "workflow"}`}
            runningLabel={activeJob?.selected?.name}
            runningRunner={activeJob ? runnerLabelForKind(activeJob.selected.kind) : ""}
          />
          {running && activeJob && activeJob.selected.kind !== mode ? (
            <div className="queue-mode-hint">
              Đang chạy job <strong>{runnerLabelForKind(activeJob.selected.kind)}</strong> ({activeJob.selected.name}) — tab hiện tại là {modeLabelForKind(mode)}
            </div>
          ) : null}
          {running && <div className="processing-status"><LoaderCircle className="spin" size={14} /><span>{status}</span></div>}
          {!running && queueCount > 0 && <div className="queue-status">{queueCount} job trong hàng chờ</div>}
          {error && <div className="error-message" role="alert">{error}</div>}
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
        onTestComfy={async () => { resetComfySession(); resetComfyDiscoveryCache(); await testComfyConnection(settingsDraft.comfyUrl); setStatus("ComfyUI đã kết nối"); }}
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
  );
}

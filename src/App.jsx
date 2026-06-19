import { LoaderCircle, Play, Settings, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { DynamicFields } from "./components/DynamicFields";
import { ImportPanel } from "./components/ImportPanel";
import { ModeTabs } from "./components/ModeTabs";
import { OutputLibrary } from "./components/OutputLibrary";
import { SettingsPanel } from "./components/SettingsPanel";
import { WorkflowPicker } from "./components/WorkflowPicker";
import { consumePendingImport, downloadBlob, fetchImageAsBlob, onImageImport, readSettings, writeSettings } from "./lib/chromeBridge";
import { defaultValues, flattenConfigInputs, loadCatalog, loadTemplateConfig } from "./lib/catalog";
import { normalizeImageRecord } from "./lib/images";
import { clearInput, clearOutputs, deleteCustomCatalogItem, deleteOutput, listCustomCatalogItems, listOutputs, loadInput, saveCustomCatalogItem, saveInput, saveOutput } from "./lib/libraryDb";
import { createCustomRunningHubApp, importTemplateDirectory } from "./lib/templateImport";
import { runComfyWorkflow, testComfyConnection } from "./services/comfy";
import { configFieldsToNodes, getAppDefinition, runRunningHubApp, runRunningHubWorkflow } from "./services/runningHub";

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
  const [importingFolder, setImportingFolder] = useState(false);
  const [scanningApp, setScanningApp] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Sẵn sàng");
  const [error, setError] = useState("");
  const abortRef = useRef(null);

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

  const importFromUrl = useCallback(async url => {
    setError("");
    setStatus("Đang import ảnh từ trang web…");
    try {
      const blob = await fetchImageAsBlob(url);
      let name = "web-image";
      try { name = new URL(url).pathname.split("/").filter(Boolean).pop() || name; } catch { /* data URL */ }
      const record = await normalizeImageRecord(blob, name);
      await saveInput(record);
      setImage(record);
      setStatus("Đã import ảnh từ trang web");
    } catch (nextError) {
      setError(nextError.message);
      setStatus("Import thất bại");
    }
  }, []);

  useEffect(() => {
    Promise.all([loadCatalog(), listCustomCatalogItems(), loadInput(), listOutputs(), readSettings()]).then(([items, customItems, savedImage, savedOutputs, savedSettings]) => {
      const defaultsById = new Map(items.map(item => [item.id, item]));
      const mergedItems = [...items, ...customItems.filter(item => !defaultsById.has(item.id))];
      setCatalog(mergedItems);
      setImage(savedImage || null);
      setOutputs(savedOutputs);
      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
    }).catch(nextError => setError(nextError.message));
    consumePendingImport().then(pending => pending?.url && importFromUrl(pending.url));
    return onImageImport(payload => importFromUrl(payload.url));
  }, [importFromUrl]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme || "system";
  }, [settings.theme]);

  const modeItems = useMemo(() => catalog.filter(item => item.kind === mode), [catalog, mode]);

  useEffect(() => {
    if (!modeItems.length) {
      setSelected(null);
      return;
    }
    if (!selected || selected.kind !== mode || !modeItems.some(item => item.id === selected.id)) {
      setSelected(modeItems[0]);
    }
  }, [mode, modeItems, selected]);

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
            setValues(defaultValues(nextFields));
            if (selected.custom) {
              const refreshed = { ...selected, name: definition.name, appInfo: definition.info };
              await saveCustomCatalogItem(refreshed);
              if (!cancelled) setCatalog(current => current.map(item => item.id === refreshed.id ? refreshed : item));
            }
          }
        } else {
          const nextConfig = await loadTemplateConfig(selected);
          const nextFields = flattenConfigInputs(nextConfig);
          if (!cancelled) {
            setConfig(nextConfig);
            setFields(nextFields);
            setValues(defaultValues(nextFields));
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
  }, [selected, settings.runningHubApiKey]);

  const canRun = useMemo(() => Boolean(image && selected && !running && !loadingFields), [image, selected, running, loadingFields]);

  async function selectWorkflow(item) {
    if (!item) return;
    setSelected(item);
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
    if (!image) return setError("Hãy import ảnh trước khi chạy");
    if (!selected) return setError("Hãy chọn template hoặc app");
    if (selected.kind.startsWith("runninghub") && !settings.runningHubApiKey) {
      setSettingsOpen(true);
      return setError("Cần RunningHub API Key để chạy lựa chọn này");
    }
    setError("");
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    try {
      let results;
      if (selected.kind === "comfy") {
        results = await runComfyWorkflow({ url: settings.comfyUrl, workflowUrl: selected.workflowUrl, workflow: selected.workflow, fields, values, image, signal: controller.signal, onStatus: setStatus });
      } else if (selected.kind === "runninghub-workflow") {
        const nodes = configFieldsToNodes(fields, values, image);
        results = await runRunningHubWorkflow({ apiKey: settings.runningHubApiKey, workflowId: String(config?.runninghub?.workflowId || ""), nodes, image, signal: controller.signal, onStatus: setStatus });
      } else {
        const nodes = fields.map(field => ({ ...field.node, fieldValue: values[field.key] }));
        results = await runRunningHubApp({ apiKey: settings.runningHubApiKey, webappId: selected.slug, nodes, image, signal: controller.signal, onStatus: setStatus });
      }
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
          name: result.name || `${selected.slug}-${Date.now()}-${index}.png`,
          mimeType: result.blob.type,
          size: result.blob.size,
          ...dimensions,
          workflowName: selected.name,
          durationMs: Date.now() - startedAt,
          createdAt: Date.now()
        };
        await saveOutput(record);
        saved.push(record);
      }
      setOutputs(current => [...saved, ...current]);
      setChecked(new Set(saved.map(item => item.id)));
      setStatus(`Hoàn tất ${saved.length} output`);
    } catch (nextError) {
      if (nextError.name !== "AbortError") setError(nextError.message);
      setStatus(nextError.name === "AbortError" ? "Đã hủy" : "Chạy thất bại");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  async function removeOutput(id) {
    await deleteOutput(id);
    setOutputs(current => current.filter(item => item.id !== id));
    setChecked(current => { const next = new Set(current); next.delete(id); return next; });
  }

  async function removeAllOutputs() {
    await clearOutputs();
    setOutputs([]);
    setChecked(new Set());
  }

  function toggleOutput(id) {
    setChecked(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function saveSettings() {
    await writeSettings(settingsDraft);
    setSettings(settingsDraft);
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
        <ModeTabs value={mode} onChange={nextMode => { setMode(nextMode); setError(""); setStatus(`Chế độ ${nextMode === "comfy" ? "ComfyUI" : nextMode === "runninghub-workflow" ? "RH Workflow" : "RH App"}`); }} />
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
        <ImportPanel image={image} onFile={importFromFile} onUrl={importFromUrl} onClear={removeInput} busy={running} />
        <DynamicFields fields={fields} values={values} onChange={updateValue} loading={loadingFields} />

        <section className="run-section">
          <button className="run-button" onClick={running ? () => abortRef.current?.abort() : run} disabled={!running && !canRun}>
            {running ? <Square size={17} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            {running ? "Hủy tiến trình" : `Chạy ${selected?.name || "workflow"}`}
          </button>
          {running && <div className="processing-status"><LoaderCircle className="spin" size={14} /><span>{status}</span></div>}
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
          onClear={removeAllOutputs}
        />
      </main>

      <SettingsPanel
        open={settingsOpen}
        settings={settingsDraft}
        onChange={setSettingsDraft}
        onSave={saveSettings}
        onTestComfy={async () => { await testComfyConnection(settingsDraft.comfyUrl); setStatus("ComfyUI đã kết nối"); }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

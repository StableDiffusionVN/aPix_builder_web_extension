import YAML from "yaml";
import { t } from "./i18n.js";

const MANIFEST_NAMES = ["app_build.json", "app_build.yaml", "app_build.yml"];
const MAX_SCAN_ENTRIES = 300;
const MAX_SCAN_DEPTH = 3;
const MAX_TEMPLATES = 50;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_WORKFLOW_BYTES = 30 * 1024 * 1024;

function normalizedPath(file) {
  return String(file.webkitRelativePath || file.name || "").replace(/^\/+/, "");
}

function dirname(filePath) {
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/");
}

function basename(filePath) {
  return filePath.split("/").filter(Boolean).at(-1) || "template";
}

function joinPath(dir, name) {
  return dir ? `${dir}/${name}` : name;
}

async function parseManifest(file) {
  if (file.size > MAX_MANIFEST_BYTES) throw new Error(t("tpl.manifestTooLarge", { name: file.name }));
  const text = await file.text();
  if (/\.json$/i.test(file.name)) return JSON.parse(text);
  return YAML.parse(text);
}

async function yieldToBrowser() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function fileFromHandle(handle, maxBytes, label) {
  const file = await handle.getFile();
  if (file.size > maxBytes) throw new Error(t("tpl.fileTooLarge", { label, limit: Math.round(maxBytes / 1024 / 1024) }));
  return file;
}

export async function importTemplateDirectory(rootHandle, kind) {
  if (!["comfy", "runninghub-workflow"].includes(kind)) {
    throw new Error(t("tpl.dirModeUnsupported"));
  }
  if (!rootHandle || rootHandle.kind !== "directory") throw new Error(t("tpl.invalidDir"));

  const queue = [{ handle: rootHandle, depth: 0, path: rootHandle.name || "templates" }];
  const imported = [];
  let scannedEntries = 0;

  while (queue.length && imported.length < MAX_TEMPLATES) {
    const current = queue.shift();
    const fileHandles = new Map();
    const childDirectories = [];

    for await (const [name, handle] of current.handle.entries()) {
      scannedEntries += 1;
      if (scannedEntries > MAX_SCAN_ENTRIES) {
        throw new Error(t("tpl.dirTooLarge", { entries: MAX_SCAN_ENTRIES, depth: MAX_SCAN_DEPTH }));
      }
      if (handle.kind === "file" && (MANIFEST_NAMES.includes(name) || name === "api.json")) {
        fileHandles.set(name, handle);
      } else if (handle.kind === "directory" && current.depth < MAX_SCAN_DEPTH) {
        childDirectories.push({ handle, depth: current.depth + 1, path: `${current.path}/${name}` });
      }
      if (scannedEntries % 25 === 0) await yieldToBrowser();
    }

    const manifestName = fileHandles.has("app_build.json")
      ? "app_build.json"
      : MANIFEST_NAMES.find(name => fileHandles.has(name));
    if (manifestName) {
      const manifestFile = await fileFromHandle(fileHandles.get(manifestName), MAX_MANIFEST_BYTES, manifestName);
      const config = await parseManifest(manifestFile);
      const workflowHandle = fileHandles.get("api.json");
      if (kind === "comfy" && !workflowHandle) {
        // Not a complete ComfyUI template; continue scanning children.
      } else if (kind === "runninghub-workflow" && !String(config?.runninghub?.workflowId || "").trim()) {
        // Not a RunningHub workflow template.
      } else {
        let workflow = null;
        if (workflowHandle) {
          const workflowFile = await fileFromHandle(workflowHandle, MAX_WORKFLOW_BYTES, "api.json");
          workflow = JSON.parse(await workflowFile.text());
        }
        imported.push({
          id: `custom:${kind}:${crypto.randomUUID()}`,
          slug: current.handle.name || basename(current.path),
          kind,
          name: config?.app?.name || current.handle.name || basename(current.path),
          description: `Custom · ${kind === "comfy" ? "ComfyUI template" : "RunningHub workflow"}`,
          config,
          workflow,
          custom: true,
          importedAt: Date.now()
        });
      }
    }
    queue.push(...childDirectories);
  }

  if (!imported.length) {
    throw new Error(kind === "comfy"
      ? t("tpl.noValidComfyDir")
      : t("tpl.noValidRhDir"));
  }
  return imported;
}

/** Import template từ tệp .zip (vd xuất ra từ app chính) — giải nén rồi dùng importTemplateFiles. */
export async function importTemplateZip(file, kind) {
  const { unzipSync } = await import("fflate");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(bytes);
  const files = Object.entries(entries)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, data]) => {
      const base = name.split("/").pop() || name;
      const synthetic = new File([data], base);
      // Giữ đường dẫn tương đối để gom theo thư mục (manifest + api.json cùng dir).
      Object.defineProperty(synthetic, "webkitRelativePath", { value: name });
      return synthetic;
    });
  if (!files.length) throw new Error(t("tpl.emptyZip"));
  return importTemplateFiles(files, kind);
}

export async function importTemplateFiles(fileList, kind) {
  if (!['comfy', 'runninghub-workflow'].includes(kind)) {
    throw new Error(t("tpl.dirModeUnsupported"));
  }
  const files = Array.from(fileList || []);
  const byPath = new Map(files.map(file => [normalizedPath(file), file]));
  const manifestByDirectory = new Map();
  for (const file of files.filter(candidate => MANIFEST_NAMES.includes(candidate.name))) {
    const directory = dirname(normalizedPath(file));
    const current = manifestByDirectory.get(directory);
    if (!current || /\.json$/i.test(file.name)) manifestByDirectory.set(directory, file);
  }
  const manifests = [...manifestByDirectory.values()];
  if (!manifests.length) throw new Error(t("tpl.noManifest"));

  const imported = [];
  for (const manifest of manifests) {
    const manifestPath = normalizedPath(manifest);
    const dir = dirname(manifestPath);
    const config = await parseManifest(manifest);
    if (!config?.app?.name && !config?.input) continue;
    const workflowFile = byPath.get(joinPath(dir, "api.json"));
    if (kind === "comfy" && !workflowFile) continue;
    if (kind === "runninghub-workflow" && !String(config?.runninghub?.workflowId || "").trim()) continue;
    let workflow = null;
    if (workflowFile) workflow = JSON.parse(await workflowFile.text());
    const folderName = basename(dir);
    imported.push({
      id: `custom:${kind}:${crypto.randomUUID()}`,
      slug: folderName,
      kind,
      name: config.app?.name || folderName,
      description: `Custom · ${kind === "comfy" ? "ComfyUI template" : "RunningHub workflow"}`,
      config,
      workflow,
      custom: true,
      importedAt: Date.now()
    });
  }
  if (!imported.length) {
    throw new Error(kind === "comfy"
      ? t("tpl.noValidComfy")
      : t("tpl.noValidRh"));
  }
  return imported;
}

export function createCustomRunningHubApp(appId, info = null) {
  const id = String(appId || "").trim();
  if (!/^\d{8,}$/.test(id)) throw new Error(t("tpl.invalidAppId"));
  return {
    id: `runninghub-app:${id}`,
    slug: id,
    kind: "runninghub-app",
    name: info?.webappName || `Custom App ${id}`,
    description: "RunningHub AI App",
    appInfo: info ? { ...info, webappId: id } : null,
    custom: true,
    importedAt: Date.now()
  };
}

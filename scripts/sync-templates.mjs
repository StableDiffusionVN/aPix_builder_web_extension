import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const extensionRoot = process.cwd();
const parentRoot = path.resolve(extensionRoot, "..");
const publicRoot = path.join(extensionRoot, "public");
const templatesRoot = path.join(publicRoot, "templates");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function syncGroup(sourceRelative, kind) {
  const sourceRoot = path.join(parentRoot, sourceRelative);
  if (!(await exists(sourceRoot))) return [];
  const items = [];
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceDir = path.join(sourceRoot, entry.name);
    const targetDir = path.join(templatesRoot, kind, entry.name);
    await cp(sourceDir, targetDir, { recursive: true, force: true });
    const yamlPath = path.join(targetDir, "app_build.yaml");
    if (!(await exists(yamlPath))) continue;
    const config = YAML.parse(await readFile(yamlPath, "utf8"));
    await writeFile(path.join(targetDir, "app_build.json"), JSON.stringify(config, null, 2));
    items.push({
      id: `${kind}:${entry.name}`,
      slug: entry.name,
      kind,
      name: config?.app?.name || entry.name,
      configUrl: `./templates/${kind}/${entry.name}/app_build.json`,
      workflowUrl: await exists(path.join(targetDir, "api.json"))
        ? `./templates/${kind}/${entry.name}/api.json`
        : null
    });
  }
  return items;
}

const hasParentTemplates = await exists(path.join(parentRoot, "config/default"))
  || await exists(path.join(parentRoot, "config/default-rh"));
let templates = [];
if (hasParentTemplates) {
  await rm(templatesRoot, { recursive: true, force: true });
  await mkdir(templatesRoot, { recursive: true });
  templates = [
    ...(await syncGroup("config/default", "comfy")),
    ...(await syncGroup("config/default-rh", "runninghub-workflow"))
  ];
  await writeFile(path.join(templatesRoot, "index.json"), JSON.stringify(templates, null, 2));
} else {
  try {
    templates = JSON.parse(await readFile(path.join(templatesRoot, "index.json"), "utf8"));
    console.log("Parent aPix Builder not found; using bundled templates.");
  } catch {
    throw new Error("No parent templates and no bundled public/templates/index.json");
  }
}

const appsSource = path.join(parentRoot, "config/default-rh/apps.json");
const dataRoot = path.join(publicRoot, "data");
await mkdir(dataRoot, { recursive: true });
if (await exists(appsSource)) {
  await cp(appsSource, path.join(dataRoot, "runninghub-apps.json"));
}

const iconRoot = path.join(publicRoot, "icons");
const iconSource = path.join(parentRoot, "aPix_builder_pts/icons/sdvn-icon-48.png");
await mkdir(iconRoot, { recursive: true });
if (await exists(iconSource)) {
  await cp(iconSource, path.join(iconRoot, "icon-48.png"));
}

console.log(`Synced ${templates.length} aPix template(s).`);

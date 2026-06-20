import { choiceOptionsFromField, menuChoiceOptions, resolveMenuStoredValue } from "./menuChoices.js";
import { isDynamicFieldType, resolveDynamicFieldType } from "./dynamicTypes.js";

const APP_DESCRIPTIONS = {
  "2039924771751731201": "Tăng độ phân giải và phục hồi chi tiết",
  "2064284416448491522": "Biến đổi hình ảnh bằng AI App"
};

const TEMPLATE_DESCRIPTIONS = {
  "klein-edit-image": "Chỉnh sửa ảnh theo prompt",
  "klein-edit-image-lora": "Chỉnh sửa ảnh với LoRA trên RunningHub",
  "sdvn-klein-upscale-ultimate": "Upscale, làm nét và khớp màu"
};

const CHOICE_FIELD_TYPES = new Set(["menu", "menu-sub", "dropdown", "checkpoints", "loras"]);

export function isModelChoiceField(field) {
  if (!field) return false;
  if (field.ui?.dynamic || isDynamicFieldType(field.ui?.type) || resolveDynamicFieldType(field)) return true;
  return CHOICE_FIELD_TYPES.has(field.ui?.type) && Boolean((field.ui?.choices || field.choices || []).length);
}

export function resolveModelFieldValue(field, choices = field?.ui?.choices || field?.choices || []) {
  const options = choiceOptionsFromField(field, choices);
  if (!options.length) return field?.ui?.value ?? "";
  const preferred = resolveMenuStoredValue(field?.ui?.value, choices, menuChoiceOptions(field?.ui));
  if (preferred && options.some(option => option.value === preferred)) return preferred;
  return options[0].value;
}

export async function loadCatalog() {
  const [templatesResponse, appsResponse] = await Promise.all([
    fetch("./templates/index.json"),
    fetch("./data/runninghub-apps.json")
  ]);
  const templates = templatesResponse.ok ? await templatesResponse.json() : [];
  const apps = appsResponse.ok ? await appsResponse.json() : [];
  return [
    ...apps.map(app => ({
      id: `runninghub-app:${app.id}`,
      slug: app.id,
      kind: "runninghub-app",
      name: app.name,
      description: APP_DESCRIPTIONS[app.id] || "RunningHub AI App"
    })),
    ...templates.map(template => ({
      ...template,
      description: `${template.kind === "comfy" ? "ComfyUI" : "RunningHub"} · ${TEMPLATE_DESCRIPTIONS[template.slug] || "Workflow template"}`
    }))
  ];
}

export async function loadTemplateConfig(item) {
  if (item?.config) return item.config;
  if (!item?.configUrl) return null;
  const response = await fetch(item.configUrl);
  if (!response.ok) throw new Error("Không thể tải template");
  return response.json();
}

export function flattenConfigInputs(config) {
  return Object.entries(config?.input || {})
    .map(([key, item]) => ({ key, ...item, ui: item?.ui || {} }))
    .filter(item => item.id && item.ui.type !== "note" && item.ui.type !== "markdown");
}

export function defaultValues(fields) {
  return Object.fromEntries(fields.map(field => {
    if (isModelChoiceField(field)) {
      const choices = field.ui.choices || field.choices || [];
      if (choices.length) return [field.key, resolveModelFieldValue(field, choices)];
    }
    return [field.key, field.ui.value ?? (field.ui.type === "seed" ? "random_seed" : "")];
  }));
}

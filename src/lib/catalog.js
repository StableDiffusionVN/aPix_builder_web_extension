import { choiceOptionsFromField, lookupMenuSubFields, menuChoiceOptions, resolveMenuStoredValue } from "./menuChoices.js";
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
const MENU_FIELD_TYPES = new Set(["menu", "menu-sub", "dropdown"]);

function fieldChoices(field) {
  return field?.ui?.choices || field?.choices || [];
}

export function usesRemoteModelDiscovery(kind) {
  return kind === "comfy";
}

export function isModelChoiceField(field, { kind } = {}) {
  if (!field) return false;
  const choices = fieldChoices(field);
  if (kind === "runninghub-workflow" || kind === "runninghub-app") {
    if (field.ui?.dynamic || isDynamicFieldType(field.ui?.type)) return true;
    return MENU_FIELD_TYPES.has(field.ui?.type) && choices.length > 0;
  }
  if (field.ui?.dynamic || isDynamicFieldType(field.ui?.type) || resolveDynamicFieldType(field)) return true;
  return CHOICE_FIELD_TYPES.has(field.ui?.type) && choices.length > 0;
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

/** Workflow JSON (api.json) của template ComfyUI — để dò class_type node (vd loader SDVN). */
export async function loadComfyWorkflow(item) {
  if (item?.workflow) return item.workflow;
  if (!item?.workflowUrl) return null;
  try {
    const response = await fetch(item.workflowUrl);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export function flattenConfigInputs(config) {
  return Object.entries(config?.input || {})
    .map(([key, item]) => ({ key, ...item, ui: item?.ui || {} }))
    // Giữ field có id; menu-sub có thể không có id (chỉ là bộ chọn nhánh) → vẫn giữ.
    .filter(item => (item.id || item.ui.type === "menu-sub") && item.ui.type !== "note" && item.ui.type !== "markdown");
}

// MARK: menu-sub (conditional) — bộ chọn nhánh hiển thị field con khác nhau theo lựa chọn.

export function isMenuSub(field) {
  return field?.ui?.type === "menu-sub";
}

/** Lựa chọn đang hiệu lực của một menu-sub (đã chuẩn hoá về value). */
export function activeMenuChoice(field, values) {
  return resolveMenuStoredValue(
    values?.[field.key] ?? field.ui?.value,
    fieldChoices(field),
    menuChoiceOptions(field.ui)
  );
}

/** Field con của lựa chọn đang chọn (key tổng hợp ổn định: `${parent}.${choice}.${child}`). */
export function activeSubFields(field, values) {
  if (!isMenuSub(field)) return [];
  const selected = activeMenuChoice(field, values);
  const sub = lookupMenuSubFields(field.ui?.sub || {}, selected, fieldChoices(field), menuChoiceOptions(field.ui));
  return Object.entries(sub).map(([childKey, child]) => ({
    key: `${field.key}.${selected}.${childKey}`,
    parentKey: field.key,
    choice: selected,
    ...child,
    ui: child?.ui || {}
  }));
}

/** Mọi field con (mọi nhánh) — để seed default. */
export function allSubFields(field) {
  if (!isMenuSub(field)) return [];
  const out = [];
  for (const [choice, children] of Object.entries(field.ui?.sub || {})) {
    for (const [childKey, child] of Object.entries(children || {})) {
      out.push({ key: `${field.key}.${choice}.${childKey}`, parentKey: field.key, choice, ...child, ui: child?.ui || {} });
    }
  }
  return out;
}

/** Bung danh sách field để render/chạy: menu-sub → [parent (nếu có id)] + field con đang chọn. */
export function expandActiveFields(fields, values) {
  const out = [];
  for (const field of fields) {
    if (isMenuSub(field)) {
      if (field.id) out.push(field);   // gửi giá trị lựa chọn tới node nếu menu có id
      out.push(...activeSubFields(field, values));
    } else {
      out.push(field);
    }
  }
  return out;
}

function fieldDefault(field, kind) {
  if (isModelChoiceField(field, { kind })) {
    const choices = fieldChoices(field);
    if (choices.length) return resolveModelFieldValue(field, choices);
  }
  return field.ui.value ?? (field.ui.type === "seed" ? "random_seed" : "");
}

export function defaultValues(fields, { kind } = {}) {
  const out = {};
  for (const field of fields) {
    if (isMenuSub(field)) {
      out[field.key] = resolveMenuStoredValue(field.ui.value, fieldChoices(field), menuChoiceOptions(field.ui));
      for (const sub of allSubFields(field)) out[sub.key] = fieldDefault(sub, kind);
      continue;
    }
    out[field.key] = fieldDefault(field, kind);
  }
  return out;
}

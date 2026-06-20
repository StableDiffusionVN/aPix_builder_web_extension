export const DYNAMIC_FIELD_REGISTRY = {
  checkpoints: {
    label: "checkpoints",
    aliases: ["checkpoint", "ckpt"],
    fields: ["ckpt_name"],
    modelFolder: "checkpoints"
  },
  loras: {
    label: "loras",
    aliases: ["lora"],
    fields: ["lora_name"],
    modelFolder: "loras"
  },
  vae: {
    label: "vae",
    aliases: ["vaes"],
    fields: ["vae_name"],
    modelFolder: "vae"
  },
  controlnets: {
    label: "controlnets",
    aliases: ["controlnet", "control_net"],
    fields: ["control_net_name", "model_name"],
    modelFolder: "controlnet"
  },
  upscale_models: {
    label: "upscale_models",
    aliases: ["upscale_model", "upscalers"],
    fields: ["model_name"],
    modelFolder: "upscale_models"
  },
  samplers: {
    label: "samplers",
    aliases: ["sampler"],
    fields: ["sampler_name"]
  },
  schedulers: {
    label: "schedulers",
    aliases: ["scheduler"],
    fields: ["scheduler"]
  },
  unet: {
    label: "unet",
    aliases: ["unets", "diffusion_models", "diffusion_model"],
    fields: ["unet_name"],
    modelFolder: "diffusion_models"
  },
  style_models: {
    label: "style_models",
    aliases: ["style_model"],
    fields: ["style_model_name"],
    modelFolder: "style_models"
  },
  embeddings: {
    label: "embeddings",
    aliases: ["embedding"],
    fields: ["embedding"]
  },
  clip: {
    label: "clip",
    aliases: ["clips", "text_encoders", "text_encoder"],
    fields: ["clip_name"],
    modelFolder: "text_encoders"
  },
  clip_vision: {
    label: "clip_vision",
    aliases: ["clipvision", "clip_visions"],
    fields: ["clip_name"],
    modelFolder: "clip_vision"
  }
};

const DYNAMIC_TYPE_ALIASES = Object.fromEntries(
  Object.entries(DYNAMIC_FIELD_REGISTRY).flatMap(([type, config]) => [
    [type, type],
    [config.label, type],
    ...(config.aliases || []).map(alias => [alias, type])
  ])
);

export const DYNAMIC_FIELD_TYPES = Object.keys(DYNAMIC_FIELD_REGISTRY);

export function canonicalDynamicType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return DYNAMIC_TYPE_ALIASES[normalized] || "";
}

export function isDynamicFieldType(type) {
  return Boolean(canonicalDynamicType(type));
}

export function inferDynamicTypeFromFieldId(id) {
  const normalized = String(id || "").toLowerCase();
  if (normalized.includes("ckpt_name")) return "checkpoints";
  if (normalized.includes("lora_name")) return "loras";
  if (normalized.includes("vae_name")) return "vae";
  if (normalized.includes("control_net_name")) return "controlnets";
  if (normalized.includes("unet_name")) return "unet";
  return "";
}

const STATIC_FIELD_TYPES = new Set([
  "string",
  "text",
  "int",
  "float",
  "number",
  "boolean",
  "seed",
  "image",
  "image_mask",
  "file",
  "note",
  "markdown"
]);

const CHOICE_FIELD_TYPES = new Set(["menu", "menu-sub", "dropdown"]);

export function resolveDynamicFieldType(field) {
  const explicitType = String(field?.ui?.type || "").trim().toLowerCase();
  const canonical = canonicalDynamicType(explicitType);
  if (canonical) return canonical;
  if (STATIC_FIELD_TYPES.has(explicitType)) return "";
  if (CHOICE_FIELD_TYPES.has(explicitType)) return inferDynamicTypeFromFieldId(field?.id);
  if (!explicitType) return inferDynamicTypeFromFieldId(field?.id);
  return "";
}

export function dynamicFieldChoices(discovery, type) {
  const canonical = canonicalDynamicType(type) || type;
  if (!canonical) return [];
  return discovery?.dynamicChoices?.[canonical] || discovery?.modelLists?.[canonical] || [];
}

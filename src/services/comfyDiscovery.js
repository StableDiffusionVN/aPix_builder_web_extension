import { comfyFetch } from "../lib/comfyBridge.js";
import { dynamicFieldChoices, resolveDynamicFieldType } from "../lib/dynamicTypes.js";
import { resolveComfySession } from "./comfy.js";

const dynamicChoiceSources = {
  checkpoints: {
    modelFolder: "checkpoints",
    objectInfo: [
      ["CheckpointLoaderSimple", "ckpt_name"],
      ["CheckpointLoader", "ckpt_name"]
    ]
  },
  loras: {
    modelFolder: "loras",
    objectInfo: [
      ["LoraLoader", "lora_name"],
      ["LoraLoaderModelOnly", "lora_name"]
    ]
  },
  vae: {
    modelFolder: "vae",
    objectInfo: [["VAELoader", "vae_name"]]
  },
  controlnets: {
    modelFolder: "controlnet",
    objectInfo: [
      ["ControlNetLoader", "control_net_name"],
      ["DiffControlNetLoader", "model_name"]
    ]
  },
  upscale_models: {
    modelFolder: "upscale_models",
    objectInfo: [["UpscaleModelLoader", "model_name"]]
  },
  samplers: {
    objectInfo: [
      ["KSampler", "sampler_name"],
      ["KSamplerAdvanced", "sampler_name"]
    ]
  },
  schedulers: {
    objectInfo: [
      ["KSampler", "scheduler"],
      ["KSamplerAdvanced", "scheduler"]
    ]
  },
  unet: {
    modelFolder: "diffusion_models",
    objectInfo: [["UNETLoader", "unet_name"]]
  },
  style_models: {
    modelFolder: "style_models",
    objectInfo: [["StyleModelLoader", "style_model_name"]]
  },
  embeddings: {
    modelFolder: "embeddings"
  },
  clip: {
    modelFolder: "text_encoders",
    objectInfo: [
      ["CLIPLoader", "clip_name"],
      ["DualCLIPLoader", "clip_name1"],
      ["DualCLIPLoader", "clip_name2"]
    ]
  },
  clip_vision: {
    modelFolder: "clip_vision",
    objectInfo: [["CLIPVisionLoader", "clip_name"]]
  }
};

function uniqueStrings(items) {
  return [...new Set((items || []).filter(item => typeof item === "string" && item.trim()))];
}

function readChoiceList(objectInfo, nodeType, inputName) {
  const choices = objectInfo?.[nodeType]?.input?.required?.[inputName]?.[0]
    ?? objectInfo?.[nodeType]?.input?.optional?.[inputName]?.[0];
  return Array.isArray(choices) ? choices.filter(item => typeof item === "string") : [];
}

function choicesFromObjectInfo(objectInfo, sources = []) {
  return uniqueStrings(sources.flatMap(([nodeType, inputName]) => readChoiceList(objectInfo, nodeType, inputName)));
}

async function tryFetchComfyJson(url, authHeaders, signal, fallback) {
  try {
    const response = await comfyFetch(url, { signal, authHeaders });
    if (!response.ok) return fallback;
    return response.json();
  } catch {
    return fallback;
  }
}

async function fetchComfyJson(url, authHeaders, signal) {
  const response = await comfyFetch(url, { signal, authHeaders });
  if (!response.ok) {
    throw new Error(`ComfyUI ${url} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function buildDynamicChoices(session, objectInfo, modelFolders, signal) {
  const modelsByFolder = {};
  const dynamicChoices = {};
  const folderSet = new Set(modelFolders || []);
  const endpoint = path => `${session.httpBase}${session.apiPrefix}${path}`;

  await Promise.all(Object.values(dynamicChoiceSources).map(async source => {
    if (!source.modelFolder || !folderSet.has(source.modelFolder)) return;
    const models = await tryFetchComfyJson(
      endpoint(`/models/${encodeURIComponent(source.modelFolder)}`),
      session.authHeaders,
      signal,
      []
    );
    modelsByFolder[source.modelFolder] = Array.isArray(models) ? uniqueStrings(models) : [];
  }));

  for (const [type, source] of Object.entries(dynamicChoiceSources)) {
    const fromModels = source.modelFolder ? modelsByFolder[source.modelFolder] || [] : [];
    const fromObjectInfo = choicesFromObjectInfo(objectInfo, source.objectInfo);
    dynamicChoices[type] = uniqueStrings([...fromModels, ...fromObjectInfo]);
  }

  dynamicChoices.embeddings = uniqueStrings([
    ...(dynamicChoices.embeddings || []),
    ...(modelsByFolder.embeddings || [])
  ]);

  return { dynamicChoices, modelsByFolder };
}

let discoveryCache = null;

export function resetComfyDiscoveryCache() {
  discoveryCache = null;
}

export async function getComfyDiscovery(comfyUrl, signal, { refresh = false } = {}) {
  const session = await resolveComfySession(comfyUrl, signal);
  const cacheKey = session.input;
  if (!refresh && discoveryCache?.key === cacheKey) {
    return discoveryCache.data;
  }

  const endpoint = path => `${session.httpBase}${session.apiPrefix}${path}`;
  const [modelFolders, embeddings, objectInfo] = await Promise.all([
    tryFetchComfyJson(endpoint("/models"), session.authHeaders, signal, []),
    tryFetchComfyJson(endpoint("/embeddings"), session.authHeaders, signal, []),
    fetchComfyJson(endpoint("/object_info"), session.authHeaders, signal).catch(() => ({}))
  ]);

  const { dynamicChoices, modelsByFolder } = await buildDynamicChoices(
    session,
    objectInfo,
    Array.isArray(modelFolders) ? modelFolders : [],
    signal
  );

  if (Array.isArray(embeddings) && embeddings.length) {
    dynamicChoices.embeddings = uniqueStrings([
      ...(dynamicChoices.embeddings || []),
      ...embeddings
    ]);
  }

  const data = {
    address: session.input,
    fetchedAt: new Date().toISOString(),
    modelFolders: Array.isArray(modelFolders) ? modelFolders : [],
    modelsByFolder,
    dynamicChoices,
    modelLists: dynamicChoices
  };

  discoveryCache = { key: cacheKey, data };
  return data;
}

export function enrichFieldsWithDiscovery(fields, discovery) {
  return fields.map(field => {
    const dynamicKind = resolveDynamicFieldType(field);
    if (!dynamicKind) return field;
    const serverChoices = dynamicFieldChoices(discovery, dynamicKind);
    const choices = serverChoices.length ? serverChoices : (field.ui.choices || []);
    return {
      ...field,
      ui: {
        ...field.ui,
        type: field.ui.type === "menu" || field.ui.type === "string" ? dynamicKind : field.ui.type,
        choices,
        dynamic: true
      }
    };
  });
}

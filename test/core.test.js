import { describe, expect, it } from "vitest";
import { laneKeyForKind, laneKeyForMode } from "../src/hooks/useRunnerLane.js";
import { extensionForType, fileStem, formatBytes } from "../src/lib/images";
import { configFieldsToNodes } from "../src/services/runningHub";
import { buildComfyUrlCandidates, parseComfyTarget } from "../src/lib/comfyTarget";
import { collectComfyOutputImages } from "../src/services/comfy";
import { augmentDiscoveryWithSdvn, enrichFieldsWithDiscovery, sdvnAugmentTypes } from "../src/services/comfyDiscovery";
import { activeSubFields, defaultValues, expandActiveFields, flattenConfigInputs, isModelChoiceField, resolveModelFieldValue } from "../src/lib/catalog";
import { resolveDynamicFieldType } from "../src/lib/dynamicTypes";
import { choiceOptionsFromField } from "../src/lib/menuChoices";
import { createCustomRunningHubApp, importTemplateDirectory, importTemplateFiles, importTemplateZip } from "../src/lib/templateImport";
import { zipSync } from "fflate";
import { renderToStaticMarkup } from "react-dom/server";
import { AppInfoCard } from "../src/components/AppInfoCard";
import { OutputLibrary } from "../src/components/OutputLibrary";
import { sanitizePresetValues } from "../src/hooks/usePresets";
import { buildPendingImport, MENU_IMPORT_RUN_ID } from "../public/contextMenuModel";
import { buildImageFetchAttempts, normalizeImageUrl } from "../public/imageFetch.js";
import { parseStagingRef, stagingRef, embeddedImageFromBuffer, blobFromEmbeddedImage } from "../public/imageStaging.js";
import { adjacentPreviewIndex } from "../src/lib/lightboxNavigation";

describe("lightbox navigation", () => {
  it("moves left and right within the output list", () => {
    expect(adjacentPreviewIndex(1, -1, 3)).toBe(0);
    expect(adjacentPreviewIndex(1, 1, 3)).toBe(2);
  });

  it("stops at the beginning and end of the output list", () => {
    expect(adjacentPreviewIndex(0, -1, 3)).toBe(-1);
    expect(adjacentPreviewIndex(2, 1, 3)).toBe(-1);
  });
});

describe("context menu imports", () => {
  it("exposes only the import-and-run menu ID", () => {
    expect(MENU_IMPORT_RUN_ID).toBe("apix-builder-import-run-image");
  });

  it("marks import-and-run requests for the side panel", () => {
    const pending = buildPendingImport(
      { srcUrl: "https://example.com/image.png", pageUrl: "https://example.com/gallery" },
      { id: 42, windowId: 7, url: "https://example.com/fallback" },
      { stagingId: "stage-1" }
    );
    expect(pending).toMatchObject({
      url: "https://example.com/image.png",
      pageUrl: "https://example.com/gallery",
      tabId: 42,
      windowId: 7,
      stagingId: "stage-1",
      autoRun: true
    });
    expect(pending.requestId).toBeTruthy();
    expect(pending.createdAt).toEqual(expect.any(Number));
  });
});

describe("image fetch strategies", () => {
  it("builds referer-aware fetch attempts for hotlink-protected images", () => {
    const attempts = buildImageFetchAttempts(
      "https://cdn.example.com/photo.jpg",
      "https://gallery.example.com/item/1"
    );
    expect(attempts.length).toBeGreaterThan(2);
    expect(attempts.some(init => init.headers?.Referer === "https://gallery.example.com/item/1")).toBe(true);
    expect(attempts.some(init => init.credentials === "include")).toBe(true);
  });

  it("normalizes relative image URLs against the page URL", () => {
    expect(normalizeImageUrl("/assets/a.png", "https://example.com/page")).toBe("https://example.com/assets/a.png");
  });

  it("builds staging refs for intermediate image storage", () => {
    expect(stagingRef("abc-123")).toBe("apix-staging://abc-123");
    expect(parseStagingRef("apix-staging://abc-123")).toBe("abc-123");
  });

  it("embeds captured image bytes for pending imports", () => {
    const embedded = embeddedImageFromBuffer(new Uint8Array([137, 80, 78, 71]).buffer, {
      mimeType: "image/png",
      name: "sample.png",
      sourceUrl: "https://example.com/sample.png"
    });
    expect(embedded?.mimeType).toBe("image/png");
    expect(blobFromEmbeddedImage(embedded).size).toBe(4);
  });
});

describe("image helpers", () => {
  it("builds safe output names and readable sizes", () => {
    expect(fileStem("my photo.final.jpg")).toBe("my-photo-final");
    expect(extensionForType("image/jpeg")).toBe("jpg");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("workflow presets", () => {
  it("keeps scalar form values and drops large/image-like payloads", () => {
    expect(sanitizePresetValues({
      prompt: "make it realistic",
      steps: 4,
      enabled: true,
      image: { kind: "input-image", blob: new Blob() },
      preview: "data:image/png;base64,abc"
    })).toEqual({
      prompt: "make it realistic",
      steps: 4,
      enabled: true
    });
  });
});

describe("output batch actions", () => {
  const output = {
    id: "output-1",
    blob: new Blob(["image"], { type: "image/png" }),
    name: "result.png",
    width: 1024,
    height: 1024,
    size: 5,
    createdAt: 0
  };

  it("renders compact selected-only download and delete controls", () => {
    const html = renderToStaticMarkup(OutputLibrary({
      outputs: [output],
      selected: new Set([output.id]),
      onToggle: () => {},
      onToggleAll: () => {},
      onDownload: () => {},
      onDownloadSelected: () => {},
      onDelete: () => {},
      onDeleteSelected: () => {},
      onView: () => {}
    }));
    expect(html).toContain('aria-label="Tải ảnh đã chọn (1)"');
    expect(html).toContain('aria-label="Xóa ảnh đã chọn (1)"');
    expect(html).not.toContain("Tải các ảnh đã chọn");
    expect(html).not.toContain("Xóa tất cả output");
  });

  it("disables both batch controls when nothing is selected", () => {
    const html = renderToStaticMarkup(OutputLibrary({
      outputs: [output],
      selected: new Set(),
      onToggle: () => {},
      onToggleAll: () => {},
      onDownload: () => {},
      onDownloadSelected: () => {},
      onDelete: () => {},
      onDeleteSelected: () => {},
      onView: () => {}
    }));
    expect(html.match(/output-batch-action[^>]*disabled/g)).toHaveLength(2);
  });
});

describe("ComfyUI URL helpers", () => {
  it("normalizes missing protocol and trailing slash", () => {
    expect(parseComfyTarget("127.0.0.1:8188").httpBase).toBe("http://127.0.0.1:8188");
    expect(parseComfyTarget("http://localhost:8188/").httpBase).toBe("http://localhost:8188");
  });

  it("strips credentials from fetch URL and builds Basic auth", () => {
    const target = parseComfyTarget("https://apixsdvn:12321@colab.comfy.vn");
    expect(target.httpBase).toBe("https://colab.comfy.vn");
    expect(target.label).toBe("https://apixsdvn:12321@colab.comfy.vn");
    expect(target.authHeaders.authorization).toBe(`Basic ${btoa("apixsdvn:12321")}`);
  });

  it("supports host:user:pass shorthand", () => {
    const target = parseComfyTarget("colab.comfy.vn:apixsdvn:12321");
    expect(target.httpBase).toBe("http://colab.comfy.vn");
    expect(target.authHeaders.authorization).toBe(`Basic ${btoa("apixsdvn:12321")}`);
  });

  it("tries localhost and 127.0.0.1 for local ComfyUI", () => {
    const target = parseComfyTarget("http://localhost:8188");
    expect(buildComfyUrlCandidates(target)).toEqual([
      "http://127.0.0.1:8188",
      "http://localhost:8188"
    ]);
    expect(buildComfyUrlCandidates(parseComfyTarget("https://comfy.example.com"))).toEqual([
      "https://comfy.example.com"
    ]);
  });
});

describe("model field defaults", () => {
  it("keeps template default when present in server list", () => {
    const field = {
      key: "checkpoint",
      ui: {
        type: "checkpoints",
        value: "Flux2-klein-9b.safetensors"
      }
    };
    const choices = ["other.safetensors", "Flux2-klein-9b.safetensors"];
    expect(resolveModelFieldValue(field, choices)).toBe("Flux2-klein-9b.safetensors");
    expect(defaultValues([{ ...field, ui: { ...field.ui, choices } }])).toEqual({
      checkpoint: "Flux2-klein-9b.safetensors"
    });
  });

  it("defaults boolean/number/json theo app chính (không phải chuỗi rỗng)", () => {
    const fields = [
      { key: "flag", ui: { type: "boolean", label: "Flag" } },
      { key: "flagOn", ui: { type: "boolean", label: "Flag on", value: true } },
      { key: "steps", ui: { type: "int", label: "Steps", minimum: 4 } },
      { key: "cfg", ui: { type: "float", label: "CFG" } },
      { key: "extra", ui: { type: "json", label: "Extra" } }
    ];
    expect(defaultValues(fields)).toEqual({
      flag: false,
      flagOn: true,
      steps: 4,
      cfg: 0,
      extra: "{}"
    });
  });

  it("falls back to first model when default is missing", () => {
    const field = {
      key: "lora",
      ui: {
        type: "loras",
        value: "missing.safetensors"
      }
    };
    const choices = ["first.safetensors", "second.safetensors"];
    expect(resolveModelFieldValue(field, choices)).toBe("first.safetensors");
  });

  it("resolves menu label syntax defaults", () => {
    const field = {
      key: "lora",
      ui: {
        type: "menu",
        menuLabelSyntax: true,
        value: "[SDVN]_Upscale_Klein-9b_v1.safetensors",
        choices: [
          "Default:[SDVN]_Upscale_Klein-9b_v1.safetensors",
          "Product:[SDVN]_Upscale_Product_Klein-9b_v1.safetensors"
        ]
      }
    };
    expect(isModelChoiceField(field)).toBe(true);
    expect(resolveModelFieldValue(field, field.ui.choices)).toBe("[SDVN]_Upscale_Klein-9b_v1.safetensors");
    expect(choiceOptionsFromField(field, field.ui.choices)).toEqual([
      { label: "Default", value: "[SDVN]_Upscale_Klein-9b_v1.safetensors", raw: "Default:[SDVN]_Upscale_Klein-9b_v1.safetensors" },
      { label: "Product", value: "[SDVN]_Upscale_Product_Klein-9b_v1.safetensors", raw: "Product:[SDVN]_Upscale_Product_Klein-9b_v1.safetensors" }
    ]);
  });
});

describe("ComfyUI output collection", () => {
  const config = {
    output: {
      anh_ket_qua: { id: "11", ui: { type: "image", label: "Ảnh kết quả" } }
    }
  };

  it("collects images only from configured output node ids", () => {
    const historyEntry = {
      outputs: {
        "5": { images: [{ filename: "input-preview.png" }] },
        "11": { images: [{ filename: "result.png", subfolder: "", type: "output" }] },
        "14": { images: [{ filename: "debug.png" }] }
      }
    };
    expect(collectComfyOutputImages(config, historyEntry)).toEqual([
      { filename: "result.png", subfolder: "", type: "output", nodeId: "11" }
    ]);
  });

  it("returns empty when configured output nodes have no images", () => {
    const historyEntry = {
      outputs: {
        "5": { images: [{ filename: "input-preview.png" }] }
      }
    };
    expect(collectComfyOutputImages(config, historyEntry)).toEqual([]);
  });
});

describe("ComfyUI field discovery", () => {
  it("injects checkpoint and lora choices from discovery", () => {
    const fields = [
      { key: "checkpoint", id: "1-ckpt_name", ui: { type: "checkpoints", label: "Checkpoint" } },
      { key: "lora", id: "54-lora_name", ui: { type: "menu", label: "Lora", choices: ["local.safetensors"] } },
      { key: "prompt", ui: { type: "text", label: "Prompt" } }
    ];
    const discovery = {
      dynamicChoices: {
        checkpoints: ["Flux2-klein-9b.safetensors", "other.safetensors"],
        loras: ["sample-lora.safetensors"]
      }
    };
    const enriched = enrichFieldsWithDiscovery(fields, discovery);
    expect(enriched[0].ui.choices).toEqual(["Flux2-klein-9b.safetensors", "other.safetensors"]);
    expect(enriched[1].ui.choices).toEqual(["sample-lora.safetensors"]);
    expect(enriched[1].ui.dynamic).toBe(true);
    expect(enriched[2].ui.choices).toBeUndefined();
  });

  it("does not treat RH workflow string checkpoint/lora fields as model pickers", () => {
    const checkpoint = {
      key: "checkpoint",
      id: "46-ckpt_name",
      ui: { type: "string", label: "Checkpoint", value: "Flux2-klein-9b-fp8.safetensors" }
    };
    const lora = {
      key: "lora_klein",
      id: "47-lora_name",
      ui: { type: "string", label: "Lora Klein", value: "SDVN_Make_cosplay_klein_9b_v1.safetensors" }
    };
    const loraMenu = {
      key: "lora_upscale",
      id: "6-lora_name",
      ui: {
        type: "menu",
        label: "Lora Upscale",
        choices: ["Default:upsacle_200_9b_8k.safetensors"],
        value: "upsacle_200_9b_8k.safetensors"
      }
    };

    expect(resolveDynamicFieldType(checkpoint)).toBe("");
    expect(resolveDynamicFieldType(lora)).toBe("");
    expect(isModelChoiceField(checkpoint)).toBe(false);
    expect(isModelChoiceField(lora)).toBe(false);
    expect(isModelChoiceField(loraMenu)).toBe(true);
    expect(isModelChoiceField(checkpoint, { kind: "runninghub-workflow" })).toBe(false);
    expect(isModelChoiceField(lora, { kind: "runninghub-workflow" })).toBe(false);
    expect(isModelChoiceField(loraMenu, { kind: "runninghub-workflow" })).toBe(true);

    const defaults = defaultValues([checkpoint, lora, loraMenu], { kind: "runninghub-workflow" });
    expect(defaults.checkpoint).toBe("Flux2-klein-9b-fp8.safetensors");
    expect(defaults.lora_klein).toBe("SDVN_Make_cosplay_klein_9b_v1.safetensors");

    const discovery = { dynamicChoices: { loras: ["server-lora.safetensors"] } };
    const enriched = enrichFieldsWithDiscovery([checkpoint, lora, loraMenu], discovery);
    expect(enriched[0]).toEqual(checkpoint);
    expect(enriched[1]).toEqual(lora);
    expect(enriched[2].ui.dynamic).toBe(true);
    expect(enriched[2].ui.choices).toEqual(["server-lora.safetensors"]);
  });
});

describe("custom catalog import", () => {
  it("imports one ComfyUI template per folder and prefers JSON manifest", async () => {
    const fakeFile = (name, path, content) => ({ name, webkitRelativePath: path, text: async () => content });
    const config = JSON.stringify({ app: { name: "Custom Upscale" }, input: {} });
    const workflow = JSON.stringify({ "1": { inputs: {} } });
    const result = await importTemplateFiles([
      fakeFile("app_build.yaml", "pack/upscale/app_build.yaml", "app:\n  name: Old name\ninput: {}"),
      fakeFile("app_build.json", "pack/upscale/app_build.json", config),
      fakeFile("api.json", "pack/upscale/api.json", workflow)
    ], "comfy");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Custom Upscale");
    expect(result[0].workflow["1"]).toBeTruthy();
  });

  it("validates custom RunningHub app IDs", () => {
    const item = createCustomRunningHubApp("2064284416448491522", { webappName: "Scanned App", tags: [] });
    expect(item.slug).toBe("2064284416448491522");
    expect(item.name).toBe("Scanned App");
    expect(() => createCustomRunningHubApp("bad-id")).toThrow(/chuỗi số/);
  });

  it("scans only manifest files from a directory handle", async () => {
    const fileHandle = (name, content) => ({
      kind: "file",
      getFile: async () => ({ name, size: content.length, text: async () => content })
    });
    const entries = [
      ["app_build.json", fileHandle("app_build.json", JSON.stringify({ app: { name: "Safe Folder" }, input: {} }))],
      ["api.json", fileHandle("api.json", JSON.stringify({ "1": { inputs: {} } }))],
      ["large-model.safetensors", { kind: "file", getFile: () => { throw new Error("must not read"); } }]
    ];
    const root = { kind: "directory", name: "safe-folder", entries: async function* () { yield* entries; } };
    const result = await importTemplateDirectory(root, "comfy");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Safe Folder");
  });

  it("stops oversized directory scans before reading file contents", async () => {
    const root = {
      kind: "directory",
      name: "too-large",
      entries: async function* () {
        for (let index = 0; index < 301; index += 1) {
          yield [`file-${index}.bin`, { kind: "file", getFile: () => { throw new Error("must not read"); } }];
        }
      }
    };
    await expect(importTemplateDirectory(root, "comfy")).rejects.toThrow(/quá lớn/);
  });

  it("renders scanned RunningHub App metadata", () => {
    const html = renderToStaticMarkup(AppInfoCard({
      info: {
        webappId: "2063520107715981314",
        webappName: "mikami_swapface",
        covers: [{ thumbnailUri: "https://example.com/thumb.jpg" }],
        tags: [{ nameEn: "Image-to-Image" }]
      }
    }));
    expect(html).toContain("mikami_swapface");
    expect(html).toContain("Image-to-Image");
    expect(html).toContain("thumb.jpg");
  });
});

describe("RunningHub workflow mapping", () => {
  it("maps template field IDs and injects each field's own image", () => {
    const refImage = { blob: {}, name: "ref.png" };
    const maskImage = { blob: {}, name: "mask.png" };
    const fields = [
      { key: "input", id: "7-image", ui: { type: "image" } },
      { key: "mask", id: "9-image", ui: { type: "image" } },
      { key: "strength", id: "6-strength_model", ui: { type: "float" } }
    ];
    expect(configFieldsToNodes(fields, { strength: 0.8 }, { input: refImage, mask: maskImage })).toEqual([
      { nodeId: "7", fieldName: "image", fieldType: "IMAGE", fieldValue: refImage },
      { nodeId: "9", fieldName: "image", fieldType: "IMAGE", fieldValue: maskImage },
      { nodeId: "6", fieldName: "strength_model", fieldType: "FLOAT", fieldValue: 0.8 }
    ]);
  });
});

describe("menu-sub (conditional)", () => {
  const config = {
    input: {
      tai_anh: {
        ui: {
          type: "menu-sub",
          label: "Tải ảnh",
          choices: ["Upload", "URL"],
          value: "Upload",
          sub: {
            Upload: { up_img: { id: "7-image", ui: { type: "image", label: "Image" } } },
            URL: {
              up_url: { id: "7-url", ui: { type: "string", label: "URL" } },
              up_steps: { id: "2-steps", ui: { type: "int", label: "Steps", value: 12 } }
            }
          }
        }
      },
      strength: { id: "6-strength_model", ui: { type: "float", value: 0.8 } }
    }
  };

  it("giữ menu-sub (không id) khi flatten + seed default mọi nhánh", () => {
    const fields = flattenConfigInputs(config);
    expect(fields.map(f => f.key)).toEqual(["tai_anh", "strength"]);
    const values = defaultValues(fields, { kind: "comfy" });
    expect(values.tai_anh).toBe("Upload");
    expect(values["tai_anh.URL.up_url"]).toBe("");
    expect(values["tai_anh.URL.up_steps"]).toBe(12);
    expect(values.strength).toBe(0.8);
  });

  it("activeSubFields đổi theo lựa chọn", () => {
    const fields = flattenConfigInputs(config);
    const menu = fields[0];
    expect(activeSubFields(menu, { tai_anh: "Upload" }).map(f => f.id)).toEqual(["7-image"]);
    expect(activeSubFields(menu, { tai_anh: "URL" }).map(f => f.id)).toEqual(["7-url", "2-steps"]);
  });

  it("configFieldsToNodes chỉ gửi field con của nhánh đang chọn", () => {
    const image = { blob: {}, name: "in.png" };
    const fields = flattenConfigInputs(config);
    const values = { ...defaultValues(fields, { kind: "comfy" }), tai_anh: "URL", "tai_anh.URL.up_url": "http://x/y.png" };
    expect(configFieldsToNodes(fields, values, image)).toEqual([
      { nodeId: "7", fieldName: "url", fieldType: "STRING", fieldValue: "http://x/y.png" },
      { nodeId: "2", fieldName: "steps", fieldType: "INT", fieldValue: 12 },
      { nodeId: "6", fieldName: "strength_model", fieldType: "FLOAT", fieldValue: 0.8 }
    ]);
  });

  it("expandActiveFields bung nhánh Upload có field ảnh", () => {
    const fields = flattenConfigInputs(config);
    const expanded = expandActiveFields(fields, { tai_anh: "Upload" });
    expect(expanded.map(f => f.id)).toEqual(["7-image", "6-strength_model"]);
  });
});

describe("import template .zip", () => {
  it("giải nén .zip và import được template comfy", async () => {
    const enc = new TextEncoder();
    const cfg = JSON.stringify({ app: { name: "Zip Test" }, input: { x: { id: "1-text", ui: { type: "string" } } }, output: { o: { id: "9", ui: { type: "image" } } } });
    const api = JSON.stringify({ "1": { class_type: "X", inputs: { text: "" } }, "9": { class_type: "SaveImage", inputs: {} } });
    const zipped = zipSync({
      "zip-test/app_build.json": enc.encode(cfg),
      "zip-test/api.json": enc.encode(api)
    });
    const file = new File([zipped], "zip-test.zip");
    const imported = await importTemplateZip(file, "comfy");
    expect(imported.length).toBe(1);
    expect(imported[0].name).toBe("Zip Test");
  });
});

describe("SDVN model augmentation", () => {
  it("chỉ thêm cho field type loras/checkpoints, bỏ qua menu dù node SDVN", () => {
    const fields = [
      { key: "ckpt", id: "53-ckpt_name", ui: { type: "checkpoints" } },
      { key: "lora", id: "54-lora_name", ui: { type: "loras" } },
      // type menu (dù id lora_name + node SDVN) → KHÔNG được thêm danh sách.
      { key: "loraMenu", id: "55-lora_name", ui: { type: "menu", choices: ["a"] } },
      { key: "vae", id: "10-vae_name", ui: { type: "vae" } }
    ];
    const workflow = {
      "53": { class_type: "SDVN Load Checkpoint" },
      "54": { class_type: "SDVN Load Lora" },
      "55": { class_type: "SDVN Load Lora" },
      "10": { class_type: "VAELoader" }
    };
    expect([...sdvnAugmentTypes(fields, workflow)].sort()).toEqual(["checkpoints", "loras"]);
  });

  it("không bơm khi node không phải SDVN", () => {
    const fields = [{ key: "ckpt", id: "1-ckpt_name", ui: { type: "checkpoints" } }];
    const workflow = { "1": { class_type: "CheckpointLoaderSimple" } };
    expect(sdvnAugmentTypes(fields, workflow).size).toBe(0);
  });

  it("bơm thư viện SDVN với 'None' đầu danh sách, server trước, SDVN sau", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ "Sdvn-A.safetensors": {}, "Sdvn-B.safetensors": {} })
    });
    try {
      const fields = [{ key: "ckpt", id: "3-Ckpt_name", ui: { type: "checkpoints" } }];
      const workflow = { "3": { class_type: "SDVN Load Checkpoint" } };
      const discovery = { dynamicChoices: { checkpoints: ["Server-1.safetensors"] } };
      const augmented = await augmentDiscoveryWithSdvn(discovery, fields, workflow);
      expect(augmented.dynamicChoices.checkpoints).toEqual([
        "None",
        "Server-1.safetensors",
        "Sdvn-A.safetensors",
        "Sdvn-B.safetensors"
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("runner lanes", () => {
  it("maps ComfyUI to its own lane", () => {
    expect(laneKeyForKind("comfy")).toBe("comfy");
    expect(laneKeyForMode("comfy")).toBe("comfy");
  });

  it("maps RunningHub workflow and app to the same lane", () => {
    expect(laneKeyForKind("runninghub-workflow")).toBe("rh");
    expect(laneKeyForKind("runninghub-app")).toBe("rh");
    expect(laneKeyForMode("runninghub-workflow")).toBe("rh");
    expect(laneKeyForMode("runninghub-app")).toBe("rh");
  });
});

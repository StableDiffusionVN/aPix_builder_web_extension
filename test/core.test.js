import { describe, expect, it } from "vitest";
import { extensionForType, fileStem, formatBytes } from "../src/lib/images";
import { configFieldsToNodes } from "../src/services/runningHub";
import { buildComfyUrlCandidates, parseComfyTarget } from "../src/lib/comfyTarget";
import { collectComfyOutputImages } from "../src/services/comfy";
import { enrichFieldsWithDiscovery } from "../src/services/comfyDiscovery";
import { defaultValues, isModelChoiceField, resolveModelFieldValue } from "../src/lib/catalog";
import { choiceOptionsFromField } from "../src/lib/menuChoices";
import { createCustomRunningHubApp, importTemplateDirectory, importTemplateFiles } from "../src/lib/templateImport";
import { renderToStaticMarkup } from "react-dom/server";
import { AppInfoCard } from "../src/components/AppInfoCard";
import { buildPendingImport, MENU_IMPORT_RUN_ID } from "../public/contextMenuModel";
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
      { url: "https://example.com/fallback" }
    );
    expect(pending).toMatchObject({
      url: "https://example.com/image.png",
      pageUrl: "https://example.com/gallery",
      autoRun: true
    });
    expect(pending.requestId).toBeTruthy();
    expect(pending.createdAt).toEqual(expect.any(Number));
  });
});

describe("image helpers", () => {
  it("builds safe output names and readable sizes", () => {
    expect(fileStem("my photo.final.jpg")).toBe("my-photo-final");
    expect(extensionForType("image/jpeg")).toBe("jpg");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
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
  it("maps template field IDs and injects the current image", () => {
    const image = { blob: {}, name: "input.png" };
    const fields = [
      { key: "input", id: "7-image", ui: { type: "image" } },
      { key: "strength", id: "6-strength_model", ui: { type: "float" } }
    ];
    expect(configFieldsToNodes(fields, { strength: 0.8 }, image)).toEqual([
      { nodeId: "7", fieldName: "image", fieldType: "IMAGE", fieldValue: image },
      { nodeId: "6", fieldName: "strength_model", fieldType: "FLOAT", fieldValue: 0.8 }
    ]);
  });
});

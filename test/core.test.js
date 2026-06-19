import { describe, expect, it } from "vitest";
import { extensionForType, fileStem, formatBytes } from "../src/lib/images";
import { configFieldsToNodes } from "../src/services/runningHub";
import { createCustomRunningHubApp, importTemplateDirectory, importTemplateFiles } from "../src/lib/templateImport";
import { renderToStaticMarkup } from "react-dom/server";
import { AppInfoCard } from "../src/components/AppInfoCard";

describe("image helpers", () => {
  it("builds safe output names and readable sizes", () => {
    expect(fileStem("my photo.final.jpg")).toBe("my-photo-final");
    expect(extensionForType("image/jpeg")).toBe("jpg");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
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

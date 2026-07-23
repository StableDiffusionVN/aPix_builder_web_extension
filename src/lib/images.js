import { t } from "./i18n.js";

export function fileStem(name = "image") {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "image";
}

export function extensionForType(type = "image/png") {
  if (/jpe?g/i.test(type)) return "jpg";
  if (/webp/i.test(type)) return "webp";
  if (/gif/i.test(type)) return "gif";
  return "png";
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function getImageDimensions(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error(t("import.notAnImage")));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export async function normalizeImageRecord(blob, suggestedName = "image") {
  if (!blob?.type?.startsWith("image/")) throw new Error(t("import.imageOnly"));
  const dimensions = await getImageDimensions(blob);
  const ext = extensionForType(blob.type);
  const name = suggestedName.includes(".") ? suggestedName : `${fileStem(suggestedName)}.${ext}`;
  return {
    blob,
    name,
    mimeType: blob.type,
    size: blob.size,
    ...dimensions,
    importedAt: Date.now()
  };
}

export function getDroppedImageUrl(dataTransfer) {
  const direct = dataTransfer.getData("application/x-apix-image-url")
    || dataTransfer.getData("text/uri-list")
    || dataTransfer.getData("text/plain");
  if (/^(https?:|data:|blob:)/i.test(direct.trim())) return direct.trim().split(/\r?\n/)[0];
  const html = dataTransfer.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.querySelector("img")?.src || "";
  }
  return "";
}

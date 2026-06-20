import { fetchImageWithAttempts } from "./imageFetch.js";
import {
  embeddedImageFromBuffer,
  filenameFromUrl,
  stageImageBuffer
} from "./imageStaging.js";
import { captureImageInTab, payloadToArrayBuffer } from "./tabImageCapture.js";

async function captureImagePayload({ url, pageUrl = "", tabId = null }) {
  try {
    const blob = await fetchImageWithAttempts(url, { pageUrl });
    return {
      buffer: await blob.arrayBuffer(),
      mimeType: blob.type || "image/png"
    };
  } catch {
    // Some authenticated pages only expose the loaded image from the tab context.
  }

  if (tabId) {
    const tabPayload = await captureImageInTab(tabId, url);
    const buffer = payloadToArrayBuffer(tabPayload);
    if (buffer) {
      return {
        buffer,
        mimeType: tabPayload.mimeType || "image/png"
      };
    }
  }

  throw new Error("Không thể lưu ảnh vào bộ nhớ trung gian");
}

export async function buildImportImagePackage({ url, pageUrl = "", tabId = null, windowId = null, name = "" }) {
  const { buffer, mimeType } = await captureImagePayload({ url, pageUrl, tabId, windowId });
  const resolvedName = name || filenameFromUrl(url);
  const embeddedImage = embeddedImageFromBuffer(buffer, {
    mimeType,
    name: resolvedName,
    sourceUrl: url
  });

  if (embeddedImage) {
    return { embeddedImage, stagingId: null };
  }

  const stagingId = await stageImageBuffer(buffer, {
    mimeType,
    name: resolvedName,
    sourceUrl: url
  });
  return { embeddedImage: null, stagingId };
}

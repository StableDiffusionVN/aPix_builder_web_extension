export function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function normalizeImageUrl(url, baseUrl = globalThis.location?.href) {
  try {
    return new URL(url, baseUrl || undefined).href;
  } catch {
    return String(url || "").trim();
  }
}

export function buildImageFetchAttempts(url, pageUrl = "") {
  const imageOrigin = safeOrigin(url);
  const pageOrigin = safeOrigin(pageUrl);
  const referers = [...new Set([
    pageUrl,
    pageOrigin ? `${pageOrigin}/` : "",
    imageOrigin ? `${imageOrigin}/` : "",
    url
  ].filter(Boolean))];

  const attempts = [];
  const bases = [
    { credentials: "omit", cache: "no-store", mode: "cors" },
    { credentials: "include", cache: "no-store", mode: "cors" }
  ];

  for (const base of bases) {
    attempts.push({ ...base });
    for (const referer of referers) {
      attempts.push({
        ...base,
        headers: { Referer: referer, Origin: safeOrigin(referer) || imageOrigin }
      });
    }
  }

  const seen = new Set();
  return attempts.filter(init => {
    const key = JSON.stringify(init);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function isLikelyImage(blob) {
  if (!blob || blob.size <= 0) return false;
  if (blob.type?.startsWith("image/")) return true;
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (header[0] === 0xff && header[1] === 0xd8) return true;
  if (header[0] === 0x89 && header[1] === 0x50) return true;
  if (header[0] === 0x47 && header[1] === 0x49) return true;
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) return true;
  return false;
}

export function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function blobToDataUrlPayload(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mimeType = blob.type || "image/png";
  return {
    dataUrl: `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`,
    mimeType,
    buffer: bytes.buffer,
    byteLength: bytes.byteLength
  };
}

export async function blobToTransferPayload(blob) {
  const buffer = await blob.arrayBuffer();
  return {
    buffer,
    mimeType: blob.type || "image/png",
    byteLength: buffer.byteLength
  };
}

export async function fetchImageWithAttempts(url, { pageUrl = "", fetchImpl = fetch } = {}) {
  const normalizedUrl = normalizeImageUrl(url);
  let lastStatus = 0;

  for (const init of buildImageFetchAttempts(normalizedUrl, pageUrl)) {
    try {
      const response = await fetchImpl(normalizedUrl, init);
      lastStatus = response.status;
      if (!response.ok) continue;
      const blob = await response.blob();
      if (await isLikelyImage(blob)) return blob;
    } catch {
      // Try the next fetch strategy.
    }
  }

  const suffix = lastStatus ? ` (${lastStatus})` : "";
  throw new Error(`Không thể tải ảnh${suffix}`);
}

function findDomImage(url, documentRef = document) {
  const normalized = normalizeImageUrl(url, documentRef.location?.href);
  const images = [...documentRef.images];
  const exact = images.find(image => {
    const candidates = [image.currentSrc, image.src].filter(Boolean).map(value => normalizeImageUrl(value, documentRef.location?.href));
    return candidates.includes(normalized);
  });
  if (exact) return exact;

  let targetPath = "";
  try {
    targetPath = new URL(normalized).pathname;
  } catch {
    return null;
  }
  return images.find(image => {
    const candidates = [image.currentSrc, image.src].filter(Boolean);
    return candidates.some(candidate => {
      try {
        return new URL(candidate, documentRef.location?.href).pathname === targetPath;
      } catch {
        return false;
      }
    });
  }) || null;
}

export async function captureImageInPage(url, { pageUrl = "", documentRef = document, fetchImpl = fetch } = {}) {
  const normalizedUrl = normalizeImageUrl(url);
  const referer = pageUrl || documentRef.location?.href || normalizedUrl;

  try {
    return await fetchImageWithAttempts(normalizedUrl, { pageUrl: referer, fetchImpl });
  } catch {
    // Fall back to DOM capture below.
  }

  const image = findDomImage(normalizedUrl, documentRef);
  if (image) {
    for (const src of [...new Set([image.currentSrc, image.src].filter(Boolean))]) {
      try {
        return await fetchImageWithAttempts(src, { pageUrl: referer, fetchImpl });
      } catch {
        // Try canvas next.
      }
    }
  }

  throw new Error("Không thể tải ảnh (403)");
}

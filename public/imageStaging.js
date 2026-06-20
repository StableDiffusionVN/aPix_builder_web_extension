const DB_NAME = "apix-builder-web-extension-staging";
const DB_VERSION = 1;
const STORE = "images";
const MAX_AGE_MS = 60 * 60 * 1000;
const INLINE_IMAGE_LIMIT = 6_000_000;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    Promise.resolve(action(store, transaction)).then(resolve).catch(reject);
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

export function stagingRef(stagingId) {
  return `apix-staging://${stagingId}`;
}

export function parseStagingRef(value) {
  const text = String(value || "");
  if (!text.startsWith("apix-staging://")) return "";
  return text.slice("apix-staging://".length);
}

export function filenameFromUrl(url, fallback = "web-image") {
  try {
    const name = new URL(url).pathname.split("/").filter(Boolean).pop();
    return name || fallback;
  } catch {
    return fallback;
  }
}

export function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function canEmbedImageBase64(base64Length) {
  return base64Length > 0 && base64Length <= INLINE_IMAGE_LIMIT;
}

export function embeddedImageFromBuffer(arrayBuffer, { mimeType = "image/png", name = "web-image", sourceUrl = "" } = {}) {
  const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
  if (!canEmbedImageBase64(base64.length)) return null;
  return { base64, mimeType, name, sourceUrl };
}

export function blobFromEmbeddedImage(embeddedImage) {
  if (!embeddedImage?.base64) throw new Error("Không có dữ liệu ảnh đã staging");
  const bytes = base64ToUint8Array(embeddedImage.base64);
  return new Blob([bytes], { type: embeddedImage.mimeType || "image/png" });
}

async function purgeExpiredImages(db) {
  const cutoff = Date.now() - MAX_AGE_MS;
  await runTransaction(db, "readwrite", store => new Promise((resolve, reject) => {
    const index = store.index("createdAt");
    const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  }));
}

export async function stageImageBuffer(arrayBuffer, {
  mimeType = "image/png",
  name = "web-image",
  sourceUrl = ""
} = {}) {
  const db = await openDb();
  try {
    await purgeExpiredImages(db);
    const id = crypto.randomUUID();
    await runTransaction(db, "readwrite", store => store.put({
      id,
      buffer: arrayBuffer,
      mimeType,
      name,
      sourceUrl,
      createdAt: Date.now()
    }));
    return id;
  } finally {
    db.close();
  }
}

export async function stageImageBlob(blob, meta = {}) {
  const buffer = await blob.arrayBuffer();
  return stageImageBuffer(buffer, {
    mimeType: blob.type || meta.mimeType || "image/png",
    name: meta.name || "web-image",
    sourceUrl: meta.sourceUrl || ""
  });
}

export async function readStagedImage(id, { remove = true } = {}) {
  const db = await openDb();
  try {
    const record = await runTransaction(db, "readonly", store => requestToPromise(store.get(id)));
    if (!record?.buffer) throw new Error("Ảnh staging không còn tồn tại");
    if (remove) {
      await runTransaction(db, "readwrite", store => store.delete(id));
    }
    return {
      blob: new Blob([record.buffer], { type: record.mimeType || "image/png" }),
      name: record.name || "web-image",
      sourceUrl: record.sourceUrl || ""
    };
  } finally {
    db.close();
  }
}

export async function deleteStagedImage(id) {
  if (!id) return;
  const db = await openDb();
  try {
    await runTransaction(db, "readwrite", store => store.delete(id));
  } finally {
    db.close();
  }
}

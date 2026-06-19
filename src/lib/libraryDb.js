const DB_NAME = "apix-builder-web-extension";
const DB_VERSION = 2;
const INPUT_STORE = "input";
const OUTPUT_STORE = "outputs";
const TEMPLATE_STORE = "templates";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INPUT_STORE)) db.createObjectStore(INPUT_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(OUTPUT_STORE)) {
        const store = db.createObjectStore(OUTPUT_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
        const store = db.createObjectStore(TEMPLATE_STORE, { keyPath: "id" });
        store.createIndex("kind", "kind");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(storeName, mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function saveInput(record) {
  return transact(INPUT_STORE, "readwrite", store => store.put({ ...record, id: "current" }));
}

export function loadInput() {
  return transact(INPUT_STORE, "readonly", store => store.get("current"));
}

export function clearInput() {
  return transact(INPUT_STORE, "readwrite", store => store.delete("current"));
}

export function saveOutput(record) {
  return transact(OUTPUT_STORE, "readwrite", store => store.put(record));
}

export async function listOutputs() {
  const records = await transact(OUTPUT_STORE, "readonly", store => store.getAll());
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteOutput(id) {
  return transact(OUTPUT_STORE, "readwrite", store => store.delete(id));
}

export function clearOutputs() {
  return transact(OUTPUT_STORE, "readwrite", store => store.clear());
}

export function saveCustomCatalogItem(record) {
  return transact(TEMPLATE_STORE, "readwrite", store => store.put(record));
}

export function listCustomCatalogItems() {
  return transact(TEMPLATE_STORE, "readonly", store => store.getAll());
}

export function deleteCustomCatalogItem(id) {
  return transact(TEMPLATE_STORE, "readwrite", store => store.delete(id));
}

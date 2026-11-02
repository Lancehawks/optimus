"use client";

const DATABASE_NAME = "optimus-local-drafts";
const STORE_NAME = "whiteboards";
const DATABASE_VERSION = 1;

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "whiteboardId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction(mode, operation) {
  return openDatabase().then((database) => {
    if (!database) return null;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
      transaction.onabort = () => database.close();
    });
  });
}

export function saveWhiteboardDraft(whiteboardId, data) {
  if (!whiteboardId || !data) return Promise.resolve(null);
  return runTransaction("readwrite", (store) => store.put({
    whiteboardId,
    data,
    updatedAt: Date.now(),
  }));
}

export function loadWhiteboardDraft(whiteboardId) {
  if (!whiteboardId) return Promise.resolve(null);
  return runTransaction("readonly", (store) => store.get(whiteboardId));
}

export function deleteWhiteboardDraft(whiteboardId) {
  if (!whiteboardId) return Promise.resolve(null);
  return runTransaction("readwrite", (store) => store.delete(whiteboardId));
}


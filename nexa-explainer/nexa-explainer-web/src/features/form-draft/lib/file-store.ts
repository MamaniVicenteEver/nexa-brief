/** Thin wrapper around IndexedDB for `File` values — the one browser storage
 * that can hold a real File/Blob (structured-clonable, no base64 encoding
 * needed). sessionStorage/localStorage can only hold strings, so an actual
 * uploaded file can't survive there.
 *
 * One shared database, one object store, keyed by an opaque string the
 * caller controls (see `useFormDraft`, which keys by `${draftKey}:${field}`).
 * Entries outlive the browser tab on purpose — `useFormDraft` clears them
 * itself once its paired sessionStorage entry is gone, so a fresh tab
 * doesn't resurrect a stale file. */

const DB_NAME = "nexa-form-drafts";
const DB_VERSION = 1;
const STORE_NAME = "files";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function readDraftFile(key: string): Promise<File | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as File | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

export async function writeDraftFile(key: string, file: File): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function deleteDraftFile(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

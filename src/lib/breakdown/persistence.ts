// Minimal IndexedDB key/value store — ported from the standalone ANASU Web
// app, where this backed ALL studio state (products included). Here it only
// backs drawingTemplate.ts's title-block templates (company logo/fields,
// per-browser cosmetic config for PDF exports) — actual product/BOM data now
// goes through the real `/api/breakdowns/...` endpoints (Prisma/Postgres)
// instead, see src/app/breakdown/[id]/page.tsx. A failure here (private
// browsing, quota, unsupported browser) just means a user's own template
// tweaks don't survive a reload on that browser — never throws into the
// caller, and never affects the shared product data at all.
const DB_NAME = "anasu-studio";
const STORE = "state";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadState<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveState<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore — best effort
  }
}

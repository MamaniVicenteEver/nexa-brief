/** Thin, SSR-safe wrapper around `sessionStorage` for JSON-serializable
 * values — survives navigating away and back within the same tab, cleared
 * automatically when the tab closes. Not for File/Blob values: those go
 * through `file-store.ts` (IndexedDB) instead, since sessionStorage can only
 * hold strings. */

const isBrowser = typeof window !== "undefined";

export function readSessionValue<T>(key: string): T | null {
  if (!isBrowser) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSessionValue(key: string, value: unknown): void {
  if (!isBrowser) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or a non-serializable value slipped through — draft
    // persistence is best-effort, never worth breaking the form over.
  }
}

export function removeSessionValue(key: string): void {
  if (!isBrowser) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

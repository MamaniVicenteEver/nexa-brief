/** Small JSON settings only. Expiration is checked on access, without background timers. */
export function createExpiringJsonStore<T>(
  namespace: string,
  { ttlMs = 86_400_000, maxEntries = 32, maxBytes = 262_144 } = {},
) {
  type Entry = { id: string; value: T; updatedAt: number; expiresAt: number };
  const key = `nexa:json:${namespace}:v1`;
  const storage = () => {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  };
  const save = (entries: Entry[]) => {
    const store = storage();
    if (!store) return false;
    const bounded = entries.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, maxEntries);
    try {
      let json = JSON.stringify(bounded);
      while (json.length * 2 > maxBytes && bounded.length > 1) {
        bounded.pop();
        json = JSON.stringify(bounded);
      }
      if (json.length * 2 > maxBytes) return false;
      store.setItem(key, json);
      return true;
    } catch {
      return false;
    }
  };
  const read = (): Entry[] => {
    const store = storage();
    if (!store) return [];
    try {
      const raw = store.getItem(key);
      if (!raw) return [];
      if (raw.length * 2 > maxBytes) {
        store.removeItem(key);
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        store.removeItem(key);
        return [];
      }
      const live = parsed
        .filter(
          (item): item is Entry =>
            item &&
            typeof item.id === "string" &&
            Number.isFinite(item.updatedAt) &&
            Number.isFinite(item.expiresAt) &&
            item.expiresAt > Date.now(),
        )
        .slice(0, maxEntries);
      if (live.length !== parsed.length) save(live);
      return live;
    } catch {
      try {
        store.removeItem(key);
      } catch {
        /* Storage may be unavailable. */
      }
      return [];
    }
  };
  const set = (id: string, value: T) =>
    save([
      { id, value, updatedAt: Date.now(), expiresAt: Date.now() + ttlMs },
      ...read().filter((entry) => entry.id !== id),
    ]);
  return {
    get: (id: string): T | null => read().find((entry) => entry.id === id)?.value ?? null,
    list: () => read().map((entry) => ({ ...entry })),
    create: (id: string, value: T) =>
      read().some((entry) => entry.id === id) ? false : set(id, value),
    set,
    update: (id: string, update: (value: T) => T) => {
      const entry = read().find((item) => item.id === id);
      return entry ? set(id, update(entry.value)) : false;
    },
    remove: (id: string) => save(read().filter((entry) => entry.id !== id)),
    clear: () => {
      try {
        storage()?.removeItem(key);
      } catch {
        /* Keep other storage intact. */
      }
    },
    clean: () => {
      const entries = read();
      save(entries);
      return entries.length;
    },
  };
}

import { createExpiringJsonStore } from "@/shared/storage/expiring-json-store";

const supported = new Set(["lyrics-impact", "lyrics-romantic", "lyrics-suave", "lyrics-triste"]);
export const supportsBackgroundVisibility = (templateId: string) => supported.has(templateId);
const store = createExpiringJsonStore<number>("studio-background-opacity", { ttlMs: 86_400_000, maxEntries: 32 });
export const backgroundVisibility = {
  get(id: string): number | null {
    const value = store.get(id);
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  },
  set(id: string, value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1 && store.set(id, value);
  },
  remove: store.remove,
};

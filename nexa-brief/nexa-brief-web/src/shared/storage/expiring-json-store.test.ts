import { afterEach, describe, expect, it, vi } from "vitest";
import { createExpiringJsonStore } from "./expiring-json-store";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("bounded expiring JSON storage", () => {
  it("creates, reads, updates and deletes only its own records", () => {
    const store = createExpiringJsonStore<{ n: number }>("test");
    localStorage.setItem("unrelated", "keep");
    expect(store.create("a", { n: 1 })).toBe(true);
    expect(store.create("a", { n: 2 })).toBe(false);
    expect(store.update("a", (v) => ({ n: v.n + 1 }))).toBe(true);
    expect(store.get("a")).toEqual({ n: 2 });
    store.remove("a");
    expect(store.get("a")).toBeNull();
    store.set("b", { n: 3 });
    store.clear();
    expect(store.list()).toEqual([]);
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
  it("expires lazily without timers and evicts older records at the limit", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const store = createExpiringJsonStore<number>("bounded", {
      ttlMs: 100,
      maxEntries: 2,
      maxBytes: 1024,
    });
    store.set("a", 1);
    now.mockReturnValue(1010);
    store.set("b", 2);
    now.mockReturnValue(1020);
    store.set("c", 3);
    expect(store.get("a")).toBeNull();
    expect(store.list()).toHaveLength(2);
    now.mockReturnValue(1200);
    expect(store.clean()).toBe(0);
    expect(store.list()).toEqual([]);
  });
  it("handles corrupt data, oversized values and unavailable storage", () => {
    const store = createExpiringJsonStore<string>("broken", { maxBytes: 200 });
    localStorage.setItem("nexa:json:broken:v1", "invalid JSON");
    expect(store.get("a")).toBeNull();
    expect(store.set("a", "x".repeat(400))).toBe(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(store.set("a", "value")).toBe(false);
  });
});

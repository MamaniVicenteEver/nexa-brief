import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { backgroundVisibility, supportsBackgroundVisibility } from "../services/background-visibility";

beforeEach(() => { window.localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z")); });
afterEach(() => { vi.useRealTimers(); });
it("stores each prototype in the browser and expires after 24 hours", () => {
  expect(backgroundVisibility.get("draft-a")).toBeNull();
  expect(backgroundVisibility.set("draft-a", 0.35)).toBe(true);
  backgroundVisibility.set("draft-b", 0.8);
  vi.advanceTimersByTime(86_399_999);
  expect(backgroundVisibility.get("draft-a")).toBe(0.35);
  expect(backgroundVisibility.get("draft-b")).toBe(0.8);
  vi.advanceTimersByTime(1);
  expect(backgroundVisibility.get("draft-a")).toBeNull();
});
it("rejects invalid values and only enables supported lyric designs", () => {
  expect(backgroundVisibility.set("x", 1.2)).toBe(false);
  expect(backgroundVisibility.get("x")).toBeNull();
  expect(supportsBackgroundVisibility("lyrics-impact")).toBe(true);
  expect(supportsBackgroundVisibility("unrelated")).toBe(false);
});

import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { resolveRemoteAssets } from "./remote-assets.js";

describe("resolveRemoteAssets", () => {
  const workDirs: string[] = [];
  const originalFetch = globalThis.fetch;

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(workDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("downloads an allowed URL once and rewrites HTML and CSS to loopback", async () => {
    const workDir = await mkdtemp(path.join(os.tmpdir(), "nexa-remote-assets-test-"));
    workDirs.push(workDir);
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { "content-type": "image/png" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveRemoteAssets(
      {
        kind: "html",
        html: '<img src="https://example.com/cover">',
        css: ".cover { background-image: url(https://example.com/cover); }",
      },
      undefined,
      { workDir, allowlist: ["example.com"], timeoutMs: 1_000, maxBytes: 1_024, maxRedirects: 1 },
    );
    try {
      expect(resolved.count).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(resolved.input.kind).toBe("html");
      if (resolved.input.kind !== "html") throw new Error("Expected HTML input");
      expect(resolved.input.html).toContain("127.0.0.1");
      expect(resolved.input.css).toContain("127.0.0.1");
      expect(resolved.input.html).not.toContain("example.com");
      expect(resolved.input.css).not.toContain("example.com");
    } finally {
      await resolved.stop();
      vi.stubGlobal("fetch", originalFetch);
    }
  });

  it("rejects a hostname that is not explicitly allowed", async () => {
    const workDir = await mkdtemp(path.join(os.tmpdir(), "nexa-remote-assets-test-"));
    workDirs.push(workDir);
    await expect(resolveRemoteAssets(
      { kind: "html", html: '<img src="https://not-allowed.example/image.png">' },
      undefined,
      { workDir, allowlist: ["example.com"], timeoutMs: 1_000, maxBytes: 1_024, maxRedirects: 1 },
    )).rejects.toThrow("NETWORK_ALLOWLIST");
  });

  it("does not treat SVG XML namespaces as downloadable remote assets", async () => {
    const workDir = await mkdtemp(path.join(os.tmpdir(), "nexa-remote-assets-test-"));
    workDirs.push(workDir);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveRemoteAssets(
      { kind: "html", html: '<div style="background:url(data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3C/svg%3E)"></div>' },
      undefined,
      { workDir, allowlist: [], timeoutMs: 1_000, maxBytes: 1_024, maxRedirects: 1 },
    );
    try {
      expect(resolved.count).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await resolved.stop();
      vi.stubGlobal("fetch", originalFetch);
    }
  });
});

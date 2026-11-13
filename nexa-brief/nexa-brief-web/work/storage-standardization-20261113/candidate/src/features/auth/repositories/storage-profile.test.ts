// @vitest-environment node
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJsonFile, writeJsonFile } from "./json-store";
import { authStorageBackend, profileDirectory, profileWebDataDirectory } from "./storage-profile";

let temp: string;
const keys = [
  "NEXA_PROFILE_DIR",
  "NEXA_PROFILE_MANIFEST",
  "NEXA_WEB_DATA_DIR",
  "XDG_CONFIG_HOME",
] as const;
const original = new Map(keys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  temp = mkdtempSync(path.join(os.tmpdir(), "nexa-profile-test-"));
  for (const key of keys) delete process.env[key];
  process.env.XDG_CONFIG_HOME = path.join(temp, "xdg");
});
afterEach(() => {
  for (const key of keys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(temp, { recursive: true, force: true });
});

function profile(name: string, version: number, users = "json") {
  const root = path.join(temp, name);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    path.join(root, "profile.json"),
    JSON.stringify({ schema_version: version, id: name, providers: { users } }),
  );
  return root;
}

describe("server profile storage", () => {
  it("resolves v1, v2 and v3, selects the provider and rejects invalid roots or versions", () => {
    const one = profile("one", 1),
      two = profile("two", 2, "other");
    process.env.NEXA_PROFILE_DIR = one;
    expect(profileWebDataDirectory()).toBe(path.join(one, "web-data"));
    expect(authStorageBackend()).toBe("json");
    process.env.NEXA_PROFILE_DIR = two;
    expect(profileWebDataDirectory()).toBe(path.join(two, ".system/web-data"));
    expect(authStorageBackend()).toBe("other");
    process.env.NEXA_PROFILE_DIR = "";
    process.env.NEXA_PROFILE_MANIFEST = path.join(two, "profile.json");
    expect(authStorageBackend()).toBe("other");
    delete process.env.NEXA_PROFILE_MANIFEST;
    process.env.NEXA_PROFILE_DIR = "relative";
    expect(() => profileDirectory()).toThrow(/absolute/);
    const three = profile("three", 3);
    process.env.NEXA_PROFILE_DIR = three;
    expect(profileWebDataDirectory()).toBe(path.join(three, ".system/web-data"));
    process.env.NEXA_PROFILE_DIR = profile("future", 4);
    expect(() => profileWebDataDirectory()).toThrow(/Unsupported/);
  });

  it("isolates JSON writes and validates explicit v2 web data overrides", async () => {
    const one = profile("one", 1),
      two = profile("two", 2);
    process.env.NEXA_PROFILE_DIR = one;
    await writeJsonFile("records.json", [{ synthetic: "one" }]);
    process.env.NEXA_PROFILE_DIR = two;
    expect(await readJsonFile("records.json")).toEqual([]);
    await writeJsonFile("records.json", [{ synthetic: "two" }]);
    expect(
      JSON.parse(readFileSync(path.join(two, ".system/web-data/records.json"), "utf8")),
    ).toEqual([{ synthetic: "two" }]);
    process.env.NEXA_WEB_DATA_DIR = path.join(temp, "explicit");
    await expect(readJsonFile("records.json")).rejects.toThrow(/does not match/);
    const alias = path.join(temp, "web-alias");
    symlinkSync(path.join(two, ".system/web-data"), alias, "dir");
    process.env.NEXA_WEB_DATA_DIR = alias;
    expect(await readJsonFile("records.json")).toEqual([{ synthetic: "two" }]);
    process.env.NEXA_PROFILE_DIR = one;
    process.env.NEXA_WEB_DATA_DIR = path.join(temp, "explicit");
    await writeJsonFile("records.json", [{ synthetic: "override" }]);
    expect(JSON.parse(readFileSync(path.join(one, "web-data/records.json"), "utf8"))).toEqual([
      { synthetic: "one" },
    ]);
  });

  it("seeds an empty v2 profile selected through XDG without reading other profiles", async () => {
    const other = profile("other", 1),
      root = profile("selected", 2);
    const selectorDir = path.join(temp, "xdg/nexa-brief");
    mkdirSync(selectorDir, { recursive: true });
    writeFileSync(
      path.join(selectorDir, "storage-profile.json"),
      JSON.stringify({ profile_dir: root }),
    );
    const cmd = spawnSync(
      process.execPath,
      ["scripts/seed-admin.mjs", "test@example.invalid", "synthetic-password"],
      {
        cwd: process.cwd(),
        env: { ...process.env },
        encoding: "utf8",
      },
    );
    expect(cmd.status, cmd.stderr).toBe(0);
    const users = JSON.parse(readFileSync(path.join(root, ".system/web-data/users.json"), "utf8"));
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe("admin");
    expect(await bcrypt.compare("synthetic-password", users[0].passwordHash)).toBe(true);
    process.env.NEXA_PROFILE_DIR = other;
    expect(await readJsonFile("users.json")).toEqual([]);
  });

  it("refuses to seed a foreign v2 web directory", () => {
    const root = profile("selected", 2);
    const foreign = path.join(temp, "other-profile-web-data");
    const cmd = spawnSync(
      process.execPath,
      ["scripts/seed-admin.mjs", "a@example.invalid", "test-password"],
      {
        cwd: process.cwd(),
        env: { ...process.env, NEXA_PROFILE_DIR: root, NEXA_WEB_DATA_DIR: foreign },
        encoding: "utf8",
      },
    );
    expect(cmd.status).not.toBe(0);
    expect(cmd.stderr).toContain("does not match");
    expect(existsSync(foreign)).toBe(false);
  });

  it("serializes concurrent admin seeds in the same profile", async () => {
    const root = profile("concurrent", 2);
    const env = { ...process.env, NEXA_PROFILE_DIR: root };
    const seed = (email: string) =>
      new Promise<number | null>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["scripts/seed-admin.mjs", email, "synthetic-password"],
          {
            cwd: process.cwd(),
            env,
            stdio: "ignore",
          },
        );
        child.once("error", reject);
        child.once("exit", resolve);
      });
    expect(await Promise.all([seed("a@example.invalid"), seed("b@example.invalid")])).toEqual([
      0, 0,
    ]);
    const users = JSON.parse(readFileSync(path.join(root, ".system/web-data/users.json"), "utf8"));
    expect(users.map((user: { email: string }) => user.email).sort()).toEqual([
      "a@example.invalid",
      "b@example.invalid",
    ]);
  });
});

describe("container web data alias", () => {
  it("accepts the explicit mount if only a manifest is supplied", () => {
    const root = profile("container", 2);
    process.env.NEXA_PROFILE_DIR = "";
    process.env.NEXA_PROFILE_MANIFEST = path.join(root, "profile.json");
    process.env.NEXA_WEB_DATA_DIR = "/app/data";
    expect(authStorageBackend()).toBe("json");
    expect(profileWebDataDirectory()).toBe("/app/data");
  });
});

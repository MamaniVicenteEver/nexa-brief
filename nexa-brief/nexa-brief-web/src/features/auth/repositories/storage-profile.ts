import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function profileDirectory(): string | undefined {
  if (process.env.NEXA_PROFILE_DIR !== undefined) return process.env.NEXA_PROFILE_DIR || undefined;
  const selector = path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    "nexa-brief",
    "storage-profile.json",
  );
  return existsSync(selector) ? JSON.parse(readFileSync(selector, "utf8")).profile_dir : undefined;
}

export function authStorageBackend(): string {
  const root = profileDirectory();
  const manifest =
    process.env.NEXA_PROFILE_MANIFEST || (root ? path.join(root, "profile.json") : undefined);
  if (!manifest) return "json";
  const value = JSON.parse(readFileSync(manifest, "utf8"));
  if (value.schema_version !== 1) throw new Error("Unsupported storage profile version");
  return value.providers?.users || "json";
}

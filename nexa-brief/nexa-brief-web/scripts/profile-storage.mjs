// Shared by the Node-only auth repository and the standalone admin seed script.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function profileDirectory() {
  let root;
  if (process.env.NEXA_PROFILE_DIR !== undefined) {
    root = process.env.NEXA_PROFILE_DIR || undefined;
  } else {
    const selector = path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
      "nexa-brief",
      "storage-profile.json",
    );
    root = existsSync(selector)
      ? JSON.parse(readFileSync(selector, "utf8")).profile_dir
      : undefined;
  }
  if (root !== undefined && (typeof root !== "string" || !path.isAbsolute(root))) {
    throw new Error("NEXA_PROFILE_DIR must be an absolute path");
  }
  return root;
}

function manifestFor(root) {
  const manifest =
    process.env.NEXA_PROFILE_MANIFEST || (root ? path.join(root, "profile.json") : undefined);
  if (!manifest) return undefined;
  const value = JSON.parse(readFileSync(manifest, "utf8"));
  if (![1, 2, 3].includes(value.schema_version))
    throw new Error("Unsupported storage profile version");
  return value;
}

export function authStorageBackend() {
  return manifestFor(profileDirectory())?.providers?.users || "json";
}

// Resolve symlinks in existing ancestors even if a final path has not been created yet.
function canonicalPath(value) {
  let current = path.resolve(value);
  const tail = [];
  for (;;) {
    try {
      return path.join(realpathSync(current), ...tail);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      tail.unshift(path.basename(current));
      current = parent;
    }
  }
}

export function profileWebDataDirectory() {
  const root = profileDirectory();
  const override = process.env.NEXA_WEB_DATA_DIR || undefined;
  // Docker supplies only the mounted manifest and /app/data, not a profile root.
  if (!root) return override;
  const value = manifestFor(root);
  const expected =
    value.schema_version >= 2
      ? path.join(root, ".system", "web-data")
      : path.join(root, "web-data");
  if (
    value.schema_version >= 2 &&
    override &&
    (!path.isAbsolute(override) || canonicalPath(override) !== canonicalPath(expected))
  ) {
    throw new Error("NEXA_WEB_DATA_DIR does not match the selected v2 profile");
  }
  return override || expected;
}

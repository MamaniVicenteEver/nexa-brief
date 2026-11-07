#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { authStorageBackend, profileWebDataDirectory } from "./profile-storage.mjs";

// Crea o actualiza un admin en el perfil activo. No copia usuarios de otro perfil.
if (authStorageBackend() !== "json")
  throw new Error("El administrador inicial requiere el proveedor JSON");
const DATA_DIR = profileWebDataDirectory() || path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const email = process.argv[2] ?? "admin@nexabrief.com";
const password = process.argv[3] ?? "admin123";

await mkdir(DATA_DIR, { recursive: true, mode: 0o770 });
// Same lock as the web repository: concurrent seeds and web writes serialize.
const lockPath = path.join(DATA_DIR, ".users.json.lock");
const lockHandle = await open(lockPath, "a", 0o660);
try {
  await lockHandle.chmod(0o660);
} finally {
  await lockHandle.close();
}
const child = spawn(
  "flock",
  ["-x", "-w", "15", lockPath, "sh", "-c", "printf 'locked\\n'; cat >/dev/null"],
  { stdio: ["pipe", "pipe", "ignore"] },
);
await new Promise((resolve, reject) => {
  let locked = false;
  child.once("error", reject);
  child.stdout.once("data", () => {
    locked = true;
    resolve();
  });
  child.once("exit", () => {
    if (!locked) reject(new Error("Shared user storage is busy or unavailable"));
  });
});
try {
  let users;
  try {
    users = JSON.parse(await readFile(USERS_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    users = [];
  }
  const index = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());
  const user = {
    id: index >= 0 ? users[index].id : randomUUID(),
    email,
    name: "Admin",
    passwordHash: await bcrypt.hash(password, 10),
    role: "admin",
    createdAt: index >= 0 ? users[index].createdAt : new Date().toISOString(),
  };
  if (index >= 0) users[index] = user;
  else users.push(user);
  const temporary = path.join(DATA_DIR, `.users.json.${randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, "wx", 0o660);
    try {
      await handle.chmod(0o660);
      await handle.writeFile(JSON.stringify(users, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, USERS_FILE);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
} finally {
  const done = new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once("exit", resolve);
  });
  child.stdin.end();
  await done;
}
console.log("Usuario admin actualizado.");

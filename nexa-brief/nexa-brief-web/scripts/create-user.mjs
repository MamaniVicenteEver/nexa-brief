#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password) {
  console.error("Uso: node scripts/create-user.mjs <email> <nombre> <contraseña>");
  process.exit(2);
}

const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");
let users = [];

try {
  users = JSON.parse(await readFile(usersFile, "utf-8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

if (!Array.isArray(users)) throw new Error("El almacén de usuarios no tiene el formato esperado.");
if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
  console.error(`Ya existe un usuario con ${email}; no se modificó ningún usuario.`);
  process.exit(1);
}

users.push({
  id: randomUUID(),
  email,
  name,
  passwordHash: await bcrypt.hash(password, 10),
  role: "admin",
  createdAt: new Date().toISOString(),
});

await mkdir(dataDir, { recursive: true });
const temporaryFile = `${usersFile}.${process.pid}.tmp`;
await writeFile(temporaryFile, JSON.stringify(users, null, 2), { encoding: "utf-8", mode: 0o600 });
await rename(temporaryFile, usersFile);
console.log(`Usuario admin creado: ${email}`);

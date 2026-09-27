#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
// Crea (o reemplaza) un usuario admin por defecto en data/users.json para que
// siempre haya un login disponible sin depender del flujo de aprobación por
// email. Uso: node scripts/seed-admin.mjs [email] [password]
import bcrypt from "bcryptjs";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const email = process.argv[2] ?? "admin@nexabrief.com";
const password = process.argv[3] ?? "admin123";

async function readUsers() {
  try {
    return JSON.parse(await readFile(USERS_FILE, "utf-8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const users = await readUsers();
const passwordHash = await bcrypt.hash(password, 10);
const existingIndex = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());

const user = {
  id: existingIndex >= 0 ? users[existingIndex].id : randomUUID(),
  email,
  name: "Admin",
  passwordHash,
  role: "admin",
  createdAt: existingIndex >= 0 ? users[existingIndex].createdAt : new Date().toISOString(),
};

if (existingIndex >= 0) {
  users[existingIndex] = user;
} else {
  users.push(user);
}

await mkdir(DATA_DIR, { recursive: true });
await writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");

console.log(`Usuario admin listo: ${email} / ${password}`);

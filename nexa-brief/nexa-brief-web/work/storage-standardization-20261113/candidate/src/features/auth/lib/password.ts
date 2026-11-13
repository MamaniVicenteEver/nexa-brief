import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Contraseña temporal legible, enviada una única vez por email al aprobar una solicitud. */
export function generateRandomPassword(): string {
  return randomBytes(12).toString("base64url");
}

import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { RenderTimeoutError } from "../engines/errors.js";

/** Crea `WORK_DIR/<jobId>` y devuelve su ruta absoluta. Un job siempre tiene
 * su propio directorio — nunca comparte espacio con otro job en vuelo. */
export async function createJobWorkDir(jobId: string): Promise<string> {
  const dir = path.resolve(env.WORK_DIR, jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Borra el workdir de un job, salvo KEEP_WORKDIRS=true (debug). Se llama
 * tanto en éxito como en fallo — un job que revienta no debe dejar basura. */
export async function cleanupJobWorkDir(dir: string): Promise<void> {
  if (env.KEEP_WORKDIRS) return;
  await rm(dir, { recursive: true, force: true });
}

/** Corre `task` con un límite de tiempo duro. A diferencia de un
 * setTimeout+clearTimeout manual, esto no dice nada sobre CÓMO se cancela
 * el trabajo interno (eso lo maneja cada motor: execa tiene su propio
 * `timeout` para subprocesos, Playwright tiene el suyo para el browser) —
 * esta función es la red de seguridad final que garantiza que la promesa
 * del job nunca cuelga más de `timeoutMs`, sin importar el motor. */
export async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RenderTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export function newJobId(): string {
  return randomUUID();
}

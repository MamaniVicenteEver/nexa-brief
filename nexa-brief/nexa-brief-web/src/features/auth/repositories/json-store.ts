import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { profileWebDataDirectory } from "./storage-profile";

function dataDirectory() {
  return profileWebDataDirectory() || path.join(process.cwd(), "data");
}
function target(fileName: string) {
  if (path.basename(fileName) !== fileName || !/^[a-zA-Z0-9_.-]+$/.test(fileName))
    throw new Error("Invalid data filename");
  return path.join(dataDirectory(), fileName);
}

export async function readJsonFile<T>(fileName: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(target(fileName), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAtomic<T>(fileName: string, records: T[]) {
  const destination = target(fileName);
  const temporary = path.join(dataDirectory(), `.${fileName}.${randomUUID()}.tmp`);
  const handle = await open(temporary, "wx", 0o660);
  try {
    await handle.chmod(0o660);
    await handle.writeFile(JSON.stringify(records, null, 2), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

async function withFileLock<T>(fileName: string, callback: () => Promise<T>): Promise<T> {
  await mkdir(dataDirectory(), { recursive: true, mode: 0o770 });
  const lockPath = target(`.${fileName}.lock`);
  try {
    const handle = await open(lockPath, "wx", 0o660);
    try {
      await handle.chmod(0o660);
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  // flock is held by a child until stdin closes; process death releases it in
  // the kernel. This works across Node instances and container PID namespaces.
  const child = spawn(
    "flock",
    ["-x", "-w", "15", lockPath, "sh", "-c", "printf 'locked\n'; cat >/dev/null"],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  await new Promise<void>((resolve, reject) => {
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
    return await callback();
  } finally {
    const done = new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once("exit", () => resolve());
    });
    child.stdin.end();
    await done;
  }
}

export async function mutateJsonFile<T, R>(
  fileName: string,
  update: (records: T[]) => { records: T[]; result: R },
): Promise<R> {
  return withFileLock(fileName, async () => {
    const { records, result } = update(await readJsonFile<T>(fileName));
    await writeAtomic(fileName, records);
    return result;
  });
}

export async function writeJsonFile<T>(fileName: string, records: T[]): Promise<void> {
  await withFileLock(fileName, () => writeAtomic(fileName, records));
}

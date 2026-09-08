import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

export async function readJsonFile<T>(fileName: string): Promise<T[]> {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeJsonFile<T>(fileName: string, records: T[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, fileName);
  await writeFile(filePath, JSON.stringify(records, null, 2), "utf-8");
}

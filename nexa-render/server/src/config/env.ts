import { z } from "zod";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// El servidor puede arrancarse desde el workspace (`pnpm --filter …`) o desde
// `server/`; resolver desde este módulo evita que el cwd decida si `.env` se
// aplica o se ignora. Las variables ya presentes en el proceso conservan
// precedencia sobre el archivo.
const envFilePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
if (existsSync(envFilePath)) loadEnvFile(envFilePath);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),

  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  REDIS_CONNECT_RETRIES: z.coerce.number().int().min(0).max(3).default(3),

  WORK_DIR: z.string().default("./work"),
  /** Salidas persistentes: OUT_DIR/<engine>/<jobId>/{metadata.json,resources,outputs}. */
  OUT_DIR: z.string().default("./out"),
  KEEP_WORKDIRS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

  PLAYWRIGHT_CONCURRENCY: z.coerce.number().int().positive().default(2),
  REMOTION_CONCURRENCY: z.coerce.number().int().positive().default(3),
  HYPERFRAMES_CONCURRENCY: z.coerce.number().int().positive().default(3),

  JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  NETWORK_ALLOWLIST: z
    .string()
    .default("fonts.googleapis.com,fonts.gstatic.com")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

  REMOTE_ASSET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  REMOTE_ASSET_MAX_BYTES: z.coerce.number().int().positive().default(250 * 1024 * 1024),
  REMOTE_ASSET_MAX_REDIRECTS: z.coerce.number().int().min(0).max(10).default(3),

  DEFAULT_STATIC_DURATION_SECONDS: z.coerce.number().positive().default(5),

  HYPERFRAMES_BIN: z.string().default(""),

  // AWS es opcional: el modo local no necesita ninguna credencial. En
  // producción se deben inyectar credenciales mediante un IAM role (ECS/EC2),
  // nunca copiarlas dentro de este archivo ni de la imagen Docker.
  AWS_REGION: z.string().default("us-east-1"),
  AWS_RENDER_TIMEOUT_MS: z.coerce.number().int().positive().default(900_000),
  REMOTION_AWS_FUNCTION_NAME: z.string().default(""),
  REMOTION_AWS_REGION: z.string().default("us-east-1"),
  REMOTION_AWS_SITE_PREFIX: z.string().default("nexa-render"),
  REMOTION_AWS_FRAMES_PER_LAMBDA: z.coerce.number().int().positive().default(120),
  HYPERFRAMES_AWS_STACK_NAME: z.string().default(""),
  HYPERFRAMES_AWS_BUCKET: z.string().default(""),
  HYPERFRAMES_AWS_STATE_MACHINE_ARN: z.string().default(""),
  HYPERFRAMES_AWS_CHUNK_SIZE: z.coerce.number().int().positive().default(240),
  // Conservador para no saturar la cuenta con fan-out de chunks (429).
  HYPERFRAMES_AWS_MAX_PARALLEL_CHUNKS: z.coerce.number().int().min(1).max(16).default(2),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

import { Redis } from "ioredis";
import { env } from "../config/env.js";

/** Conexión compartida por todas las colas/workers de BullMQ. BullMQ requiere
 * `maxRetriesPerRequest: null` en la conexión que usan sus Workers. */
export const redisConnection = new Redis(env.REDIS_URL, {
  connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
  maxRetriesPerRequest: null,
  retryStrategy: (attempt) =>
    attempt > env.REDIS_CONNECT_RETRIES ? null : Math.min(attempt * 250, 1_000),
});

import { buildServer } from "./api/server.js";
import { env } from "./config/env.js";
import { closeQueues } from "./queue/queues.js";
import { startWorkers, stopWorkers } from "./queue/workers.js";

async function main() {
  startWorkers();
  const app = await buildServer();

  await app.listen({ port: env.PORT, host: env.HOST });

  const shutdown = async () => {
    app.log.info("shutting_down");
    await app.close();
    await stopWorkers();
    await closeQueues();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("fatal_startup_error", err);
  process.exit(1);
});

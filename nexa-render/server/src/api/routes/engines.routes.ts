import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { listEngines } from "../../engines/factory.js";
import { env } from "../../config/env.js";
import { EngineStatusSchema } from "../schemas/engines.schema.js";

const IMPLEMENTED: Record<string, boolean> = {
  playwright: true,
  remotion: true,
  hyperframes: true,
};

export async function enginesRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/api/v1/engines",
    {
      schema: {
        tags: ["engines"],
        summary: "Lista los 3 motores y su estado real (implemented: true|false)",
        response: { 200: z.array(EngineStatusSchema) },
      },
    },
    async () =>
      listEngines().map((engine) => ({
        name: engine.name,
        implemented: IMPLEMENTED[engine.name] ?? false,
        supportsReact: engine.name === "remotion",
        workerTargets: engine.name === "playwright"
          ? ["local"]
          : engine.name === "remotion" && env.REMOTION_AWS_FUNCTION_NAME
            ? ["local", "aws"]
            : engine.name === "hyperframes" && env.HYPERFRAMES_AWS_STACK_NAME && env.HYPERFRAMES_AWS_BUCKET
              ? ["local", "aws"]
              : ["local"],
      })),
  );
}

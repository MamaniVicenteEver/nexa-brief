import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env } from "../config/env.js";
import { errorHandler } from "./error-mapper.js";
import { engineRoutesGroup } from "./routes.js";
import { logger } from "../observability/logger.js";

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
  }).withTypeProvider();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: env.ALLOWED_ORIGINS });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "nexa-render API",
        description:
          "Servicio de render HTML/React → video con Playwright, Remotion y HyperFrames. Cada job conserva metadata, recursos y videos en OUT_DIR.",
        version: "0.1.0",
      },
      tags: [
        { name: "jobs", description: "Encolar y consultar jobs de render" },
        { name: "templates", description: "Plantillas default (una por motor)" },
        { name: "previews", description: "Previsualizaciones transitorias del editor" },
        { name: "engines", description: "Estado de los 3 motores" },
        { name: "health", description: "Healthcheck" },
      ],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.setErrorHandler(errorHandler);
  await app.register(engineRoutesGroup);

  return app;
}

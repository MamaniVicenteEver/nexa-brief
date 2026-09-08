import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { EngineError } from "../engines/errors.js";
import { WorkerNotImplementedError } from "../jobs/job.service.js";

/**
 * Mismo contrato de error que ya documenta
 * nexa-brief-server/docs/api-videos-frontend.md — reusado tal cual para que
 * `web/` pueda portar casi literal `nexa-brief-web/src/infrastructure/api/api-error.ts`:
 *
 *   - Errores de negocio -> { detail: "<string>" }
 *   - Errores de validación de schema (zod) -> { detail: [{ loc, msg, type }] }
 */
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ZodError || (error as { validation?: unknown }).validation) {
    const zodError = error instanceof ZodError ? error : undefined;
    const issues = zodError?.issues ?? [];
    reply.status(422).send({
      detail: issues.map((issue) => ({
        loc: ["body", ...issue.path.map(String)],
        msg: issue.message,
        type: issue.code,
      })),
    });
    return;
  }

  if (error instanceof WorkerNotImplementedError || error instanceof EngineError) {
    reply.status(error.status).send({ detail: error.message });
    return;
  }

  request.log.error(error, "unhandled_error");
  reply.status(500).send({ detail: "Error interno del servidor." });
}

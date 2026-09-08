import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { getJob, submitJob } from "../../jobs/job.service.js";
import {
  ErrorResponseSchema,
  JobParamsSchema,
  JobResponseSchema,
  SubmitJobResponseSchema,
  SubmitJobSchema,
} from "../schemas/jobs.schema.js";

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/v1/jobs",
    {
      schema: {
        tags: ["jobs"],
        summary: "Encola un job de render — elige motor explícito o 'auto'",
        body: SubmitJobSchema,
        response: { 202: SubmitJobResponseSchema, 422: ErrorResponseSchema, 501: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      request.log.info({ event: "api_job_submit", inputKind: request.body.input.kind, requestedEngine: request.body.engine ?? "auto" });
      const { jobId, engineUsed } = await submitJob(request.body);
      request.log.info({ event: "api_job_accepted", jobId, engineUsed });
      return reply.status(202).send({ jobId, engineUsed });
    },
  );

  typed.get(
    "/api/v1/jobs/:jobId",
    {
      schema: {
        tags: ["jobs"],
        summary: "Estado de un job — queued|running|completed|failed",
        params: JobParamsSchema,
        response: { 200: JobResponseSchema, 404: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      request.log.debug({ event: "api_job_status_requested", jobId: request.params.jobId });
      const job = await getJob(request.params.jobId);
      if (!job) {
        return reply.status(404).send({ detail: `Job '${request.params.jobId}' no encontrado.` });
      }
      return job;
    },
  );
}

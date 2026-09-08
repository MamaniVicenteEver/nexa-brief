import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRenderStudioDetail } from "../../services/render-studio.service.js";

export async function renderStudioRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/renders/:jobId", { schema: { params: z.object({ jobId: z.string().min(1) }) } }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const detail = await getRenderStudioDetail(jobId);
    if (!detail) return reply.status(404).send({ detail: `Render '${jobId}' no encontrado.` });
    return detail;
  });
}

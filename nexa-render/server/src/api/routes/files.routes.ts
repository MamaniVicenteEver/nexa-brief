import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { openOutputVideo } from "../../services/output-gallery.service.js";

/** Sirve estático desde OUT_DIR/<engine>/<jobId>/outputs. En Fase 3 (worker AWS), esto se
 * reemplaza por una URL presignada de S3 en vez de servir desde disco local. */
export async function filesRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/files/:jobId/:filename",
    {
      schema: {
        tags: ["jobs"],
        summary: "Descarga/reproduce el mp4 resultante de un job completado",
        params: z.object({ jobId: z.string(), filename: z.string() }),
      },
    },
    async (request, reply) => {
      const output = openOutputVideo(request.params.jobId, request.params.filename);
      if (!output) {
        return reply.status(404).send({ detail: "Archivo no encontrado." });
      }

      request.log.info({ event: "output_file_served", jobId: request.params.jobId, filename: request.params.filename, engine: output.engine });
      reply.type("video/mp4");
      return reply.send(output.stream);
    },
  );
}

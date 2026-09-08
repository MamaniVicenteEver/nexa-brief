import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { renderRemotionPreview } from "../../services/remotion-preview.service.js";

const PreviewBody = z.object({
  componentSource: z.string().min(1),
  props: z.record(z.unknown()).default({}),
  fps: z.union([z.literal(30), z.literal(60)]).default(30),
  durationSeconds: z.number().positive().max(60).default(5),
  format: z.enum(["desktop", "mobile"]).default("desktop"),
  frame: z.number().int().nonnegative().optional(),
});

/** PNG transitorio para que el editor muestre el JSX antes de encolar el MP4. */
export async function remotionPreviewRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/v1/previews/remotion",
    {
      schema: {
        tags: ["templates"],
        summary: "Renderiza un cuadro PNG de preview para un componente Remotion",
        body: PreviewBody,
      },
    },
    async (request, reply) => {
      const preview = await renderRemotionPreview(request.body);
      reply.header("Cache-Control", "no-store");
      reply.type("image/png");
      return reply.send(preview);
    },
  );
}

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { listOutputVideos } from "../../services/output-gallery.service.js";
import { GalleryQuerySchema, GalleryResponseSchema } from "../schemas/gallery.schema.js";

export async function galleryRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/v1/gallery",
    {
      schema: {
        tags: ["gallery"],
        summary: "Lista paginada de videos reales almacenados en OUT_DIR",
        querystring: GalleryQuerySchema,
        response: { 200: GalleryResponseSchema },
      },
    },
    async (request) => listOutputVideos(request.query),
  );
}

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getTemplateDetail, listTemplates } from "../../templates/index.js";
import { ErrorResponseSchema } from "../schemas/jobs.schema.js";
import { TemplateDetailSchema, TemplateParamsSchema, TemplateSummarySchema } from "../schemas/templates.schema.js";

export async function templatesRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/v1/templates",
    {
      schema: {
        tags: ["templates"],
        summary: "Lista las 3 plantillas default (una por motor)",
        response: { 200: z.array(TemplateSummarySchema) },
      },
    },
    async () => listTemplates(),
  );

  typed.get(
    "/api/v1/templates/:slug",
    {
      schema: {
        tags: ["templates"],
        summary: "Detalle de una plantilla (html/css/js o componente React)",
        params: TemplateParamsSchema,
        response: { 200: TemplateDetailSchema, 404: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      const detail = await getTemplateDetail(request.params.slug);
      if (!detail) {
        return reply.status(404).send({ detail: `Plantilla '${request.params.slug}' no encontrada.` });
      }
      return detail;
    },
  );
}

import { z } from "zod";

export const TemplateSummarySchema = z.object({
  slug: z.string(),
  engine: z.enum(["playwright", "remotion", "hyperframes"]),
  engineImplemented: z.boolean(),
  title: z.string(),
  description: z.string(),
});

// Exportado aparte (no solo inline en TemplateDetailSchema) para que
// gallery.schema.ts lo reutilice tal cual — misma forma de RenderInput
// que ya usan las plantillas, sin duplicar el union.
export const RenderInputSchema = z.union([
  z.object({ kind: z.literal("html"), html: z.string(), css: z.string().optional(), js: z.string().optional() }),
  z.object({ kind: z.literal("react"), componentSource: z.string(), props: z.record(z.unknown()).optional() }),
]);

export const TemplateDetailSchema = TemplateSummarySchema.extend({
  input: RenderInputSchema,
});

export const TemplateParamsSchema = z.object({ slug: z.string() });

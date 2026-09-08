import { z } from "zod";

const RenderInputSchema = z.union([
  z.object({
    kind: z.literal("html"),
    html: z.string().min(1),
    css: z.string().optional(),
    js: z.string().optional(),
  }),
  z.object({
    kind: z.literal("react"),
    componentSource: z.string().min(1),
    props: z.record(z.unknown()).optional(),
  }),
]);

export const SubmitJobSchema = z.object({
  input: RenderInputSchema,
  engine: z.enum(["playwright", "remotion", "hyperframes", "auto"]).optional()
    .describe("Si se omite, se usa 'auto' — ver la regla de selección en server/README.md"),
  worker: z.enum(["local", "aws"]).optional().describe("'aws' todavía no implementado (Fase 3)"),
  fps: z.union([z.literal(30), z.literal(60)]).optional(),
  formats: z.array(z.enum(["mobile", "desktop"])).min(1).optional(),
  audioUrl: z.string().optional().describe("file://... o https://...; las URLs remotas deben apuntar a un dominio en NETWORK_ALLOWLIST"),
  durationSeconds: z.number().positive().max(3_600).optional()
    .describe("Respaldo en segundos si el medio/código no declara duración"),
});

export type SubmitJobBody = z.infer<typeof SubmitJobSchema>;

export const JobParamsSchema = z.object({
  jobId: z.string().min(1),
});

export const SubmitJobResponseSchema = z.object({
  jobId: z.string(),
  engineUsed: z.enum(["playwright", "remotion", "hyperframes"]),
});

const EngineOutputSchema = z.object({
  format: z.enum(["mobile", "desktop"]),
  path: z.string(),
});

const EngineResultSchema = z.object({
  outputs: z.array(EngineOutputSchema),
  stats: z.record(z.unknown()),
});

export const JobResponseSchema = z.object({
  id: z.string(),
  input: RenderInputSchema,
  engineRequested: z.string(),
  engineUsed: z.string().optional(),
  worker: z.enum(["local", "aws"]),
  fps: z.union([z.literal(30), z.literal(60)]),
  formats: z.array(z.enum(["mobile", "desktop"])),
  audioUrl: z.string().optional(),
  durationSeconds: z.number().optional(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  result: EngineResultSchema.optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ErrorResponseSchema = z.object({
  detail: z.union([
    z.string(),
    z.array(z.object({ loc: z.array(z.string()), msg: z.string(), type: z.string() })),
  ]),
});

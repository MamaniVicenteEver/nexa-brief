import { z } from "zod";

/** Lo elegido en la sección "Contenido" cuando el nicho tiene plantilla con
 * requisitos (el mismo StudioValue que usa el Estudio). Va dentro del form
 * para que useFormDraft lo persista junto con el resto. */
const contentSchema = z.object({
  musicAssetId: z.string().nullable(),
  media: z.record(
    z.string(),
    z.array(z.object({ assetId: z.string(), kind: z.enum(["image", "video"]) })),
  ),
  texts: z.record(z.string(), z.string()),
  brief: z.string(),
});

export const createVideoSchema = z
  .object({
    categoryName: z.string().min(1, "Selecciona una categoría"),
    quantity: z.number().int().min(1).max(10),
    userContext: z.string().max(500).optional(),
    durationMode: z.enum(["auto", "manual"]),
    repeatCount: z.number().int().min(1).max(10),
    manualSeconds: z.number().int().min(5).max(300).optional(),
    songName: z.string().optional(),
    artist: z.string().optional(),
    topic: z.string().optional(),
    songDescription: z.string().optional(),
    language: z.string().optional(),
    // El backend busca imagen/música automáticamente si no se suben — igual
    // que el mockup ("El sistema elegirá... automáticamente").
    imageFile: z.instanceof(File).optional(),
    musicFile: z.instanceof(File).optional(),
    videoFile: z.instanceof(File).optional(),
    // Alternativa a subir un archivo: reusar un asset ya archivado en la
    // librería (elegido en el picker de Plantillas). CreateVideoForm no los
    // setea hoy — quedan disponibles para quien sí los necesite (Plantillas).
    imageAssetId: z.string().optional(),
    musicAssetId: z.string().optional(),
    videoAssetId: z.string().optional(),
    // Solo relevante si el motor efectivo (recorderEngineOverride o el
    // default del niche) es "remotion" u "hyperframes" (ver Niche.supportedEngines
    // en types.ts) — el backend rechaza este campo en cualquier otro caso.
    // undefined = usa el default global del servidor (hoy "local").
    renderTarget: z.enum(["local", "aws"]).optional(),
    // Override del motor de grabación (ver RecorderEngineSection.tsx) — solo
    // se manda cuando el usuario elige explícitamente una opción distinta al
    // default del niche, filtrada por Niche.supportedEngines. undefined =
    // usa el default del nicho.
    recorderEngineOverride: z.enum(["remotion", "hyperframes", "playwright"]).optional(),
    // "platform:alias" por cada canal elegido en ChannelsSection (ej.
    // "youtube:canal_1"). Vacío = no publicar automáticamente en ningún lado.
    // Sin .default() a propósito: con default() zod hace el output no-opcional
    // pero el input opcional, y useForm<CreateVideoFormValues> (que usa el
    // output) choca con lo que espera zodResolver (el input). El valor
    // inicial se pone en defaultValues del useForm, no acá.
    publishingAccounts: z.array(z.string()),
    // Contenido de la plantilla (ver ContentSection). `contentTemplateId`
    // dice a qué plantilla pertenece: al cambiar de nicho los lugares son
    // otros, así que lo guardado para otra plantilla se ignora en vez de
    // mandarse con slots que no existen. Opcionales: otros que arman estos
    // valores a mano (TemplateRecordButton) no los conocen.
    content: contentSchema.optional(),
    contentTemplateId: z.string().nullable().optional(),
  })
  .refine((values) => values.durationMode !== "manual" || values.manualSeconds !== undefined, {
    message: "Indica la duración en segundos",
    path: ["manualSeconds"],
  });

export type CreateVideoFormValues = z.infer<typeof createVideoSchema>;

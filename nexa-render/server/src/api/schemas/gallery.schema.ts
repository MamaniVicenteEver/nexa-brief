import { z } from "zod";
export const GalleryItemSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  engine: z.enum(["playwright", "remotion", "hyperframes"]),
  format: z.enum(["desktop", "mobile"]),
  filename: z.string(),
  fps: z.number(),
  bytes: z.number(),
  durationSeconds: z.number().optional(),
  codec: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  completedAt: z.string(),
  videoUrl: z.string(),
});

export const GalleryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(6),
  engine: z.enum(["playwright", "remotion", "hyperframes"]).optional(),
  format: z.enum(["desktop", "mobile"]).optional(),
});

export const GalleryResponseSchema = z.object({
  items: z.array(GalleryItemSchema),
  categories: z.array(z.object({
    engine: z.enum(["playwright", "remotion", "hyperframes"]),
    count: z.number().int().nonnegative(),
  })),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
    hasPreviousPage: z.boolean(),
    hasNextPage: z.boolean(),
  }),
});

import { z } from "zod";

export const createVideoSchema = z.object({});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;

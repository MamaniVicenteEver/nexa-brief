import { z } from "zod";

export const EngineStatusSchema = z.object({
  name: z.enum(["playwright", "remotion", "hyperframes"]),
  implemented: z.boolean(),
  supportsReact: z.boolean(),
  workerTargets: z.array(z.enum(["local", "aws"])),
});

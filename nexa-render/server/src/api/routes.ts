import type { FastifyInstance } from "fastify";
import { enginesRoutes } from "./routes/engines.routes.js";
import { filesRoutes } from "./routes/files.routes.js";
import { galleryRoutes } from "./routes/gallery.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { jobsRoutes } from "./routes/jobs.routes.js";
import { remotionPreviewRoutes } from "./routes/remotion-preview.routes.js";
import { renderStudioRoutes } from "./routes/render-studio.routes.js";
import { templatesRoutes } from "./routes/templates.routes.js";

export async function engineRoutesGroup(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(enginesRoutes);
  await app.register(templatesRoutes);
  await app.register(galleryRoutes);
  await app.register(renderStudioRoutes);
  await app.register(jobsRoutes);
  await app.register(remotionPreviewRoutes);
  await app.register(filesRoutes);
}

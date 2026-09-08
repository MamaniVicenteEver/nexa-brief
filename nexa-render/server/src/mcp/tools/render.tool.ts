import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { submitJob } from "../../jobs/job.service.js";

/**
 * Mismo `submitJob()` que usa POST /api/v1/jobs — REST y MCP comparten una
 * sola implementación de negocio (ver server/README.md → "Verificación",
 * punto 6: correr el mismo job por ambas vías y confirmar que coinciden).
 */
export function registerRenderTool(server: McpServer): void {
  server.tool(
    "render",
    "Envía un job de render de HTML/CSS/JS (o un componente React) a video. Devuelve un jobId para consultar con getStatus.",
    {
      html: z.string().optional().describe("HTML del video (modo 'html' — mutuamente excluyente con reactComponent)"),
      css: z.string().optional(),
      js: z.string().optional(),
      reactComponent: z.string().optional().describe("Código fuente de un componente React (modo 'react')"),
      audioUrl: z.string().optional().describe("file://... o https://...; los dominios remotos deben estar en NETWORK_ALLOWLIST"),
      engine: z.enum(["playwright", "remotion", "hyperframes", "auto"]).optional(),
      worker: z.enum(["local", "aws"]).optional(),
      fps: z.union([z.literal(30), z.literal(60)]).optional(),
      formats: z.array(z.enum(["mobile", "desktop"])).optional(),
      durationSeconds: z.number().positive().max(3_600).optional(),
    },
    async ({ html, css, js, reactComponent, audioUrl, engine, worker, fps, formats, durationSeconds }) => {
      if (!html && !reactComponent) {
        return {
          isError: true,
          content: [{ type: "text", text: "Hace falta 'html' o 'reactComponent'." }],
        };
      }

      const input = reactComponent
        ? ({ kind: "react", componentSource: reactComponent } as const)
        : ({ kind: "html", html: html!, css, js } as const);

      try {
        const { jobId, engineUsed } = await submitJob({ input, engine, worker, fps, formats, audioUrl, durationSeconds });
        return { content: [{ type: "text", text: JSON.stringify({ jobId, engineUsed }) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    },
  );
}

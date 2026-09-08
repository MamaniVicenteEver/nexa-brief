import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { env } from "../../config/env.js";

/**
 * FASE 1: valida el target pedido; no persiste una preferencia default
 * todavía (cada llamada a render() sigue necesitando su propio `worker` si
 * quiere pisar el default "local"). Fase 3, cuando exista el worker AWS de
 * verdad, es cuando tiene sentido agregar un default persistido por cliente.
 */
export function registerConfigureWorkerTool(server: McpServer): void {
  server.tool(
    "configureWorker",
    "Valida un motor/worker objetivo. AWS está disponible para Remotion y HyperFrames cuando sus variables están configuradas.",
    {
      engine: z.enum(["playwright", "remotion", "hyperframes"]),
      target: z.enum(["local", "aws"]),
    },
    async ({ engine, target }) => {
      if (target === "aws") {
        if (engine === "playwright") {
          return { isError: true, content: [{ type: "text", text: "Playwright se ejecuta localmente; AWS está disponible para Remotion y HyperFrames." }] };
        }
        const configured = engine === "remotion"
          ? Boolean(env.REMOTION_AWS_FUNCTION_NAME)
          : Boolean(env.HYPERFRAMES_AWS_STACK_NAME && env.HYPERFRAMES_AWS_BUCKET);
        if (configured) return { content: [{ type: "text", text: JSON.stringify({ ok: true, engine, target }) }] };
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `AWS para '${engine}' no está configurado en el servidor.`,
            },
          ],
        };
      }
      return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
    },
  );
}

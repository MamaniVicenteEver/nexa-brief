import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getJob } from "../../jobs/job.service.js";

export function registerGetStatusTool(server: McpServer): void {
  server.tool(
    "getStatus",
    "Consulta el estado de un job enviado con render(). status: queued|running|completed|failed.",
    { jobId: z.string() },
    async ({ jobId }) => {
      const job = await getJob(jobId);
      if (!job) {
        return { isError: true, content: [{ type: "text", text: `Job '${jobId}' no encontrado.` }] };
      }

      const videoUrls =
        job.status === "completed" && job.result
          ? job.result.outputs.map((o) => `/files/${job.id}/${o.format}${o.path.slice(o.path.lastIndexOf("."))}`)
          : undefined;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: job.status, videoUrls, error: job.error }),
          },
        ],
      };
    },
  );
}

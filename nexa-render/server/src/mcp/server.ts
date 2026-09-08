import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerConfigureWorkerTool } from "./tools/configure-worker.tool.js";
import { registerGetStatusTool } from "./tools/get-status.tool.js";
import { registerRenderTool } from "./tools/render.tool.js";

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "nexa-render", version: "0.1.0" });

  registerRenderTool(server);
  registerGetStatusTool(server);
  registerConfigureWorkerTool(server);

  return server;
}

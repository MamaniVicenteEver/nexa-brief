import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./mcp/server.js";

/**
 * Entrypoint MCP — proceso SEPARADO de `index.ts`. Este proceso NO arranca
 * los Workers de BullMQ (ver queue/workers.ts) — solo produce/consulta jobs
 * en la misma cola Redis que ya procesan los Workers de `index.ts`. Para que
 * un job enviado por acá realmente se renderice, `pnpm dev` (index.ts) tiene
 * que estar corriendo en paralelo. Ver server/README.md → "Desarrollo local".
 */
async function main() {
  const server = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("fatal_mcp_startup_error", err);
  process.exit(1);
});

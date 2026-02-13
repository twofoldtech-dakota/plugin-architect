#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDb } from "./storage/index.js";
import { registerAllTools } from "./tools/index.js";
import { registerUiResources } from "./ui-resources.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "hive",
    version: "1.0.0",
  });

  registerAllTools(server);
  registerUiResources(server);

  return server;
}

async function main() {
  // Initialize SQLite database (creates schema on first run)
  getDb();

  const mode = process.argv.includes("--http") ? "http" : "stdio";

  if (mode === "http") {
    const { startHttpServer } = await import("./transport-http.js");
    await startHttpServer(createServer);
  } else {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

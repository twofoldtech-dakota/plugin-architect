#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initHiveDir } from "./storage/index.js";
import { registerPhase0, registerPhase1, registerPhase2, registerPhase3, registerPhase4, registerPhase5, registerPhase6 } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "hive",
    version: "0.5.0",
  });

  // Phase 0: Discovery (ideas)
  registerPhase0(server);

  // Phase 1: Foundation (projects, patterns, dependencies)
  registerPhase1(server);

  // Phase 2: Validation (spec checking, code validation, progress, features)
  registerPhase2(server);

  // Phase 3: Acceleration (scaffolding, features, search)
  registerPhase3(server);

  // Phase 4: Intelligence (suggestions, drift detection, staleness, scoring)
  registerPhase4(server);

  // Phase 5: Cross-Project Intelligence (lineage, decision graph, antipatterns, similarity, insights, comparison, stack suggestion)
  registerPhase5(server);

  // Phase 6: Autonomous Build Agent (plan, execute, checkpoint, resume, rollback)
  registerPhase6(server);

  return server;
}

async function main() {
  await initHiveDir();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

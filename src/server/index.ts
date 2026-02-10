#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initHiveDir } from "./storage/index.js";
import { registerPhase0, registerPhase1, registerPhase2, registerPhase3, registerPhase4, registerPhase5, registerPhase6, registerPhase7, registerPhase8, registerPhase9, registerPhase10, registerPhase11, registerPhase12, registerPhase13, registerPhase14, registerPhase15, registerPhase16 } from "./tools/index.js";
import { registerUiResources } from "./ui-resources.js";

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

  // Phase 7: Product Lifecycle (deploy, health, errors, usage, backlog, archive)
  registerPhase7(server);

  // Phase 8: Fleet Management (fleet status, dep scanning, pattern updates, costs, whats next)
  registerPhase8(server);

  // Phase 9: Self-Improving Hive (retrospective, knowledge gaps, pattern health, estimates)
  registerPhase9(server);

  // Phase 10: Sovereign Builder OS (idea pipeline, revenue tracking, maintenance, build orchestration, knowledge export, autonomy)
  registerPhase10(server);

  // Phase 11: Self-Replicating Hive (self-audit, tool proposals, evolution, rollback, history)
  registerPhase11(server);

  // Phase 12: Revenue Engine (revenue dashboard, pricing analysis, growth signals, experiments, financial summary)
  registerPhase12(server);

  // Phase 13: Content & Marketing Engine (launch assets, content generation, marketing dashboard, campaigns, changelog)
  registerPhase13(server);

  // Phase 14: Business Operations (invoices, financial reports, contracts, compliance, expenses, clients)
  registerPhase14(server);

  // Phase 15: Knowledge Marketplace (package patterns, package stacks, marketplace dashboard, enhanced export)
  registerPhase15(server);

  // Phase 16: Hive Mesh (peer-to-peer knowledge sharing, delegation, reputation)
  registerPhase16(server);

  // UI: Register bundled view resources
  registerUiResources(server);

  return server;
}

async function main() {
  await initHiveDir();

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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { TelemetryLog, Proposal, ProposalEvidence, ProposalType } from "../types/meta.js";

export function registerProposeTool(server: McpServer): void {
  server.tool(
    "hive_propose_tool",
    "Propose a new tool, refactor, removal, schema change, or UI change for Hive. Generates a structured proposal with evidence from telemetry analysis. Saves to meta/proposals/.",
    {
      type: z
        .enum(["new_tool", "refactor_tool", "remove_tool", "schema_change", "ui_change"])
        .describe("Type of proposal"),
      target: z.string().optional().describe("Existing tool name (for refactor/remove)"),
      description: z.string().optional().describe("Description of the proposal. Auto-generated from telemetry if omitted"),
    },
    async ({ type, target, description }) => {
      // Read telemetry for evidence
      let telemetry: TelemetryLog;
      try {
        telemetry = await readYaml<TelemetryLog>(join(HIVE_DIRS.meta, "telemetry.yaml"));
      } catch {
        telemetry = { entries: [] };
      }

      const totalCalls = telemetry.entries.length;

      // Build evidence from telemetry
      const evidence: ProposalEvidence = {
        tool_calls_analyzed: totalCalls,
      };

      // Auto-generate description if not provided
      let proposalDescription = description ?? "";
      let proposalName = "";
      let reasoning = "";
      let inputSchema: Record<string, unknown> | undefined;
      let output: string | undefined;
      let implementationPlan: string[] | undefined;
      let estimatedEffort = "medium";
      let affectedTools: string[] = [];

      if (target) {
        affectedTools = [target];
      }

      switch (type as ProposalType) {
        case "new_tool": {
          if (!description) {
            // Analyze telemetry for repeated patterns that could become a tool
            const sequences = new Map<string, number>();
            for (let i = 0; i < telemetry.entries.length - 1; i++) {
              const pair = `${telemetry.entries[i].tool} -> ${telemetry.entries[i + 1].tool}`;
              sequences.set(pair, (sequences.get(pair) ?? 0) + 1);
            }

            const mostCommon = [...sequences.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 1)[0];

            if (mostCommon) {
              evidence.pattern_detected = `repeated_sequence: ${mostCommon[0]}`;
              proposalDescription = `Create a combined tool for the frequently repeated sequence: ${mostCommon[0]} (occurred ${mostCommon[1]} times)`;
            } else {
              proposalDescription = "New tool proposal (no telemetry pattern detected — provide a description)";
            }
          }

          proposalName = target ? `New tool: ${target}` : "New tool proposal";
          reasoning = "Repeated manual workflows can be automated into a single tool call.";
          estimatedEffort = "medium";
          implementationPlan = [
            "Define input schema and output format",
            "Create tool handler in src/server/tools/",
            "Add types to src/server/types/ if needed",
            "Register in tools/index.ts under appropriate phase",
            "Wire into server entry point",
          ];
          break;
        }

        case "refactor_tool": {
          if (!target) {
            return {
              content: [{ type: "text" as const, text: "target is required for refactor_tool proposals." }],
              isError: true,
            };
          }

          // Analyze the target tool's telemetry
          const targetEntries = telemetry.entries.filter((e) => e.tool === target);
          const errorCount = targetEntries.filter((e) => e.outcome === "error").length;
          const avgDuration = targetEntries.length > 0
            ? Math.round(targetEntries.reduce((sum, e) => sum + e.duration_ms, 0) / targetEntries.length)
            : 0;

          if (!description) {
            const issues: string[] = [];
            if (errorCount > 0) issues.push(`${errorCount} errors in ${targetEntries.length} calls`);
            if (avgDuration > 3000) issues.push(`average duration ${avgDuration}ms`);
            proposalDescription = issues.length > 0
              ? `Refactor ${target}: ${issues.join(", ")}`
              : `Refactor ${target} for improved performance/reliability`;
          }

          evidence.pattern_detected = `error_rate: ${targetEntries.length > 0 ? Math.round((errorCount / targetEntries.length) * 100) : 0}%`;
          if (avgDuration > 0) {
            evidence.time_saved_per_call = Math.max(0, avgDuration - 1000);
          }

          proposalName = `Refactor: ${target}`;
          reasoning = "Reducing error rates and improving performance enhances developer experience.";
          estimatedEffort = "medium";
          implementationPlan = [
            `Analyze current implementation of ${target}`,
            "Identify bottlenecks and error sources",
            "Refactor with improved error handling and performance",
            "Test against existing telemetry patterns",
          ];
          break;
        }

        case "remove_tool": {
          if (!target) {
            return {
              content: [{ type: "text" as const, text: "target is required for remove_tool proposals." }],
              isError: true,
            };
          }

          const targetCalls = telemetry.entries.filter((e) => e.tool === target).length;
          if (!description) {
            proposalDescription = `Remove unused tool ${target} (${targetCalls} calls in telemetry)`;
          }

          evidence.pattern_detected = targetCalls === 0 ? "never_used" : `low_usage: ${targetCalls} calls`;

          proposalName = `Remove: ${target}`;
          reasoning = "Unused tools increase cognitive load and maintenance burden.";
          estimatedEffort = "small";
          implementationPlan = [
            `Remove tool handler file for ${target}`,
            "Remove import and registration from tools/index.ts",
            "Remove associated types if unused elsewhere",
            "Update phase registration",
          ];
          break;
        }

        case "schema_change": {
          proposalName = target ? `Schema change: ${target}` : "Schema change proposal";
          reasoning = description ?? "Schema evolution to support new capabilities.";
          estimatedEffort = "medium";
          implementationPlan = [
            "Define new/updated type interfaces",
            "Create migration logic for existing YAML files",
            "Update affected tool handlers",
            "Test with existing data",
          ];
          break;
        }

        case "ui_change": {
          proposalName = target ? `UI change: ${target}` : "UI change proposal";
          reasoning = description ?? "UI improvement for better developer experience.";
          estimatedEffort = "medium";
          implementationPlan = [
            "Design UI changes",
            "Update view components",
            "Rebuild UI bundle",
            "Test in MCP client",
          ];
          break;
        }
      }

      // Generate proposal ID
      let nextId = 1;
      try {
        const proposalsDir = join(HIVE_DIRS.meta, "proposals");
        const existing = await readdir(proposalsDir);
        const yamlFiles = existing.filter((f) => f.endsWith(".yaml"));
        nextId = yamlFiles.length + 1;
      } catch {
        // No proposals dir yet
      }

      const proposalId = `prop-${String(nextId).padStart(3, "0")}`;

      const proposal: Proposal = {
        id: proposalId,
        type,
        status: "pending",
        target,
        name: proposalName,
        description: proposalDescription,
        reasoning,
        input_schema: inputSchema,
        output,
        implementation_plan: implementationPlan,
        estimated_effort: estimatedEffort,
        affected_tools: affectedTools.length > 0 ? affectedTools : undefined,
        affected_ui: undefined,
        evidence,
        created: new Date().toISOString().split("T")[0],
      };

      await writeYaml(join(HIVE_DIRS.meta, "proposals", `${proposalId}.yaml`), proposal);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                proposal_id: proposalId,
                type,
                proposal,
                evidence,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

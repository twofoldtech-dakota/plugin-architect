import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type {
  TelemetryLog,
  TelemetryEntry,
  ToolUsageStat,
  RepeatedPattern,
  AuditResult,
  Proposal,
  ProposalEvidence,
} from "../types/meta.js";

// All known Hive tools for detecting unused ones
const ALL_HIVE_TOOLS = [
  "hive_capture_idea", "hive_evaluate_idea", "hive_list_ideas", "hive_promote_idea",
  "hive_init_project", "hive_get_architecture", "hive_update_architecture", "hive_log_decision",
  "hive_register_pattern", "hive_find_patterns", "hive_register_dependency", "hive_check_dependency",
  "hive_register_api", "hive_list_projects", "hive_list_patterns", "hive_list_stacks",
  "hive_validate_against_spec", "hive_validate_code", "hive_check_progress", "hive_evaluate_feature",
  "hive_scaffold_project", "hive_add_feature", "hive_snapshot_patterns", "hive_search_knowledge",
  "hive_suggest_patterns", "hive_detect_drift", "hive_surface_decisions", "hive_check_staleness",
  "hive_score_patterns", "hive_pattern_lineage", "hive_decision_graph", "hive_register_antipattern",
  "hive_score_similarity", "hive_get_insights", "hive_compare_projects", "hive_suggest_stack",
  "hive_plan_build", "hive_execute_step", "hive_review_checkpoint", "hive_resume_build",
  "hive_rollback_step", "hive_deploy", "hive_check_health", "hive_get_errors",
  "hive_get_usage", "hive_add_to_backlog", "hive_get_backlog", "hive_archive_project",
  "hive_fleet_status", "hive_fleet_scan_deps", "hive_fleet_update_pattern", "hive_fleet_costs",
  "hive_whats_next", "hive_retrospective", "hive_knowledge_gaps", "hive_pattern_health",
  "hive_estimate", "hive_idea_pipeline", "hive_track_revenue", "hive_fleet_revenue",
  "hive_maintenance_run", "hive_build_from_description", "hive_export_knowledge", "hive_autonomy_status",
  "hive_self_audit", "hive_propose_tool", "hive_evolve", "hive_rollback_evolution", "hive_evolution_history",
];

function filterByPeriod(entries: TelemetryEntry[], period: string): TelemetryEntry[] {
  const now = new Date();
  let cutoff: Date;

  switch (period) {
    case "last_week":
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "all_time":
      return entries;
    case "last_month":
    default:
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const cutoffStr = cutoff.toISOString().split("T")[0];
  return entries.filter((e) => e.date >= cutoffStr);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function registerSelfAudit(server: McpServer): void {
  server.tool(
    "hive_self_audit",
    "Audit Hive tool usage from telemetry. Identifies unused tools, slow tools, error patterns, repeated manual patterns, and generates improvement proposals. Returns a health score (0-100).",
    {
      period: z
        .enum(["last_week", "last_month", "all_time"])
        .optional()
        .default("last_month")
        .describe("Time period to analyze"),
      focus: z
        .enum(["unused_tools", "slow_tools", "error_patterns", "gaps", "all"])
        .optional()
        .default("all")
        .describe("Focus area for audit"),
    },
    async ({ period, focus }) => {
      const telemetryPath = join(HIVE_DIRS.meta, "telemetry.yaml");

      let telemetry: TelemetryLog;
      try {
        telemetry = await readYaml<TelemetryLog>(telemetryPath);
      } catch {
        telemetry = { entries: [] };
      }

      const filtered = filterByPeriod(telemetry.entries, period);
      const totalCalls = filtered.length;

      // --- Per-tool usage stats ---
      const toolMap = new Map<string, TelemetryEntry[]>();
      for (const entry of filtered) {
        const list = toolMap.get(entry.tool) ?? [];
        list.push(entry);
        toolMap.set(entry.tool, list);
      }

      const toolUsage: ToolUsageStat[] = [];
      for (const [tool, entries] of toolMap) {
        const durations = entries.map((e) => e.duration_ms);
        const errors = entries.filter((e) => e.outcome === "error").length;
        const ignored = entries.filter((e) => e.outcome === "ignored").length;

        toolUsage.push({
          tool,
          calls: entries.length,
          avg_duration_ms: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          p95_duration_ms: percentile(durations, 95),
          used_pct: totalCalls > 0 ? Math.round((entries.length / totalCalls) * 100) : 0,
          ignored_pct: entries.length > 0 ? Math.round((ignored / entries.length) * 100) : 0,
          error_pct: entries.length > 0 ? Math.round((errors / entries.length) * 100) : 0,
        });
      }

      toolUsage.sort((a, b) => b.calls - a.calls);

      // --- Unused tools ---
      const usedTools = new Set(toolMap.keys());
      const unusedTools = (focus === "all" || focus === "unused_tools")
        ? ALL_HIVE_TOOLS.filter((t) => !usedTools.has(t))
        : [];

      // --- Slow tools (p95 > 5000ms) ---
      const slowTools = (focus === "all" || focus === "slow_tools")
        ? toolUsage
            .filter((t) => t.p95_duration_ms > 5000)
            .map((t) => ({ tool: t.tool, p95_duration_ms: t.p95_duration_ms }))
            .sort((a, b) => b.p95_duration_ms - a.p95_duration_ms)
        : [];

      // --- Repeated manual patterns ---
      // Look for sequences of tool calls that repeat — e.g., same 2-3 tool combo appearing multiple times
      const repeatedPatterns: RepeatedPattern[] = [];
      if (focus === "all" || focus === "gaps") {
        const sequences = new Map<string, number>();
        for (let i = 0; i < filtered.length - 1; i++) {
          const pair = `${filtered[i].tool} -> ${filtered[i + 1].tool}`;
          sequences.set(pair, (sequences.get(pair) ?? 0) + 1);
        }

        for (const [seq, count] of sequences) {
          if (count >= 3) {
            const tools = seq.split(" -> ");
            repeatedPatterns.push({
              description: `Frequent sequence: ${seq}`,
              occurrences: count,
              suggested_tool_name: `hive_${tools[0].replace("hive_", "")}_and_${tools[1].replace("hive_", "")}`,
            });
          }
        }
      }

      // --- Health score (0-100) ---
      let healthScore = 100;

      // Penalize for high unused tool ratio
      const unusedRatio = ALL_HIVE_TOOLS.length > 0
        ? unusedTools.length / ALL_HIVE_TOOLS.length
        : 0;
      healthScore -= Math.round(unusedRatio * 30); // up to -30

      // Penalize for slow tools
      healthScore -= Math.min(20, slowTools.length * 5); // up to -20

      // Penalize for high error rates
      const avgErrorRate = toolUsage.length > 0
        ? toolUsage.reduce((sum, t) => sum + t.error_pct, 0) / toolUsage.length
        : 0;
      healthScore -= Math.min(20, Math.round(avgErrorRate)); // up to -20

      // Penalize for no telemetry data
      if (totalCalls === 0) healthScore = Math.min(healthScore, 50);

      // Bonus for repeated patterns being identified (shows active use)
      healthScore += Math.min(10, repeatedPatterns.length * 2);

      healthScore = Math.max(0, Math.min(100, healthScore));

      // --- Generate proposals for critical issues ---
      let proposalsGenerated = 0;
      const proposalsDir = join(HIVE_DIRS.meta, "proposals");

      // Propose removing truly unused tools (only if we have enough data)
      if (totalCalls >= 50 && unusedTools.length > 0) {
        for (const unusedTool of unusedTools.slice(0, 3)) {
          const proposalId = `prop-${String(Date.now()).slice(-6)}-${proposalsGenerated}`;
          const evidence: ProposalEvidence = {
            tool_calls_analyzed: totalCalls,
            pattern_detected: "never_used",
          };

          const proposal: Proposal = {
            id: proposalId,
            type: "remove_tool",
            status: "pending",
            target: unusedTool,
            name: `Consider removing ${unusedTool}`,
            description: `Tool "${unusedTool}" has never been called in ${totalCalls} total tool invocations during the ${period} period.`,
            reasoning: "Unused tools add cognitive overhead and maintenance burden.",
            estimated_effort: "small",
            affected_tools: [unusedTool],
            evidence,
            created: new Date().toISOString().split("T")[0],
          };

          await writeYaml(join(proposalsDir, `${proposalId}.yaml`), proposal);
          proposalsGenerated++;
        }
      }

      // Propose optimization for slow tools
      for (const slow of slowTools.slice(0, 2)) {
        const proposalId = `prop-${String(Date.now()).slice(-6)}-${proposalsGenerated}`;
        const evidence: ProposalEvidence = {
          tool_calls_analyzed: totalCalls,
          pattern_detected: "slow_execution",
          time_saved_per_call: slow.p95_duration_ms - 2000,
        };

        const proposal: Proposal = {
          id: proposalId,
          type: "refactor_tool",
          status: "pending",
          target: slow.tool,
          name: `Optimize ${slow.tool}`,
          description: `Tool "${slow.tool}" has a p95 latency of ${slow.p95_duration_ms}ms, exceeding the 5000ms threshold.`,
          reasoning: "High latency tools degrade the developer experience.",
          estimated_effort: "medium",
          affected_tools: [slow.tool],
          evidence,
          created: new Date().toISOString().split("T")[0],
        };

        await writeYaml(join(proposalsDir, `${proposalId}.yaml`), proposal);
        proposalsGenerated++;
      }

      const result: AuditResult = {
        period,
        total_calls: totalCalls,
        tool_usage: toolUsage,
        unused_tools: unusedTools,
        slow_tools: slowTools,
        repeated_patterns: repeatedPatterns,
        proposals_generated: proposalsGenerated,
        health_score: healthScore,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}

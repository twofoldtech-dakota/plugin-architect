import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { MaintenanceSchedule, MaintenanceLog, MaintenanceResult } from "../types/sovereign.js";

const execAsync = promisify(exec);

export function registerMaintenanceRun(server: McpServer): void {
  server.tool(
    "hive_maintenance_run",
    "Run maintenance tasks from schedule.yaml. Supports dry-run mode and individual rule execution.",
    {
      rule: z.string().optional().describe("Specific rule ID to run (omit for all rules)"),
      dry_run: z.boolean().optional().default(true).describe("If true, show what would execute without running (default: true)"),
    },
    async ({ rule, dry_run }) => {
      const schedulePath = join(HIVE_DIRS.maintenance, "schedule.yaml");

      let schedule: MaintenanceSchedule;
      try {
        schedule = await readYaml<MaintenanceSchedule>(schedulePath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: "No maintenance/schedule.yaml found.",
                  setup: {
                    message: "Create ~/.hive/maintenance/schedule.yaml with this structure:",
                    example: {
                      rules: [
                        {
                          id: "dep-check",
                          name: "Check dependency staleness",
                          type: "hive_tool",
                          target: "hive_check_staleness",
                          schedule: "weekly",
                          applies_to: [],
                          auto_apply: false,
                        },
                        {
                          id: "health-check",
                          name: "Run health checks",
                          type: "command",
                          target: "curl -sf https://myapp.com/health",
                          schedule: "daily",
                          applies_to: ["my-app"],
                          auto_apply: false,
                        },
                      ],
                    },
                  },
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      // Filter rules
      const rulesToRun = rule
        ? schedule.rules.filter((r) => r.id === rule)
        : schedule.rules;

      if (rulesToRun.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: rule
                ? `Rule "${rule}" not found in maintenance schedule.`
                : "No maintenance rules configured.",
            },
          ],
          isError: true,
        };
      }

      // Dry run — show what would execute
      if (dry_run) {
        const preview = rulesToRun.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          target: r.target,
          args: r.args,
          schedule: r.schedule,
          applies_to: r.applies_to.length > 0 ? r.applies_to : "all projects",
          auto_apply: r.auto_apply,
          last_run: r.last_run ?? "never",
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  mode: "dry_run",
                  rules_to_run: preview.length,
                  rules: preview,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Execute rules
      const results: MaintenanceResult[] = [];
      const now = new Date().toISOString().split("T")[0];

      for (const r of rulesToRun) {
        if (r.type === "command") {
          try {
            const { stdout } = await execAsync(r.target, { timeout: 60000 });
            results.push({
              rule_id: r.id,
              rule_name: r.name,
              date: now,
              status: "ok",
              output: stdout.slice(0, 2000),
            });
            r.last_run = now;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            results.push({
              rule_id: r.id,
              rule_name: r.name,
              date: now,
              status: "failed",
              error: errorMsg,
            });
          }
        } else if (r.type === "hive_tool") {
          // For hive_tool type, we record the instruction to call the tool
          // since we can't directly invoke other MCP tools from within a tool handler
          results.push({
            rule_id: r.id,
            rule_name: r.name,
            date: now,
            status: "action_needed",
            output: `Run tool: ${r.target}`,
            action_taken: r.args
              ? `Suggested call: ${r.target} with args ${JSON.stringify(r.args)}`
              : `Suggested call: ${r.target}`,
          });
          r.last_run = now;
        }
      }

      // Save updated schedule (last_run times)
      await writeYaml(schedulePath, schedule);

      // Append to maintenance log
      const logPath = join(HIVE_DIRS.maintenance, "log.yaml");
      let log: MaintenanceLog;
      try {
        log = await readYaml<MaintenanceLog>(logPath);
      } catch {
        log = { results: [] };
      }

      log.results.push(...results);
      // Keep last 200 entries
      if (log.results.length > 200) {
        log.results = log.results.slice(-200);
      }
      await writeYaml(logPath, log);

      const summary = {
        total: results.length,
        ok: results.filter((r) => r.status === "ok").length,
        action_needed: results.filter((r) => r.status === "action_needed").length,
        failed: results.filter((r) => r.status === "failed").length,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ results, summary }, null, 2),
          },
        ],
      };
    },
  );
}

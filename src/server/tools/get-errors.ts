import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { ErrorsConfig, ErrorEntry } from "../types/lifecycle.js";

const execAsync = promisify(exec);

export function registerGetErrors(server: McpServer): void {
  server.tool(
    "hive_get_errors",
    "Get error tracking data for a project. Optionally pulls fresh errors via source_command.",
    {
      project: z.string().describe("Project slug"),
      severity: z.enum(["critical", "error", "warning"]).optional().describe("Filter by severity"),
      since: z.string().optional().describe("Filter errors since this ISO date"),
      resolved: z.boolean().optional().describe("Filter by resolution status (true=resolved, false=unresolved)"),
    },
    async ({ project, severity, since, resolved }) => {
      const errorsPath = join(HIVE_DIRS.projects, safeName(project), "errors.yaml");

      let config: ErrorsConfig;
      try {
        config = await readYaml<ErrorsConfig>(errorsPath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `No errors.yaml found for project "${project}".`,
                  setup: {
                    message: "Create errors.yaml in your project directory with this structure:",
                    example: {
                      source_command: "npm run check-errors 2>&1",
                      entries: [],
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

      // Pull fresh errors if source_command is configured
      if (config.source_command) {
        try {
          const { stdout } = await execAsync(config.source_command, { timeout: 30000 });
          const lines = stdout.trim().split("\n").filter((l) => l.length > 0);

          for (const line of lines) {
            // Avoid duplicates by checking if message already exists and is unresolved
            const exists = config.entries.some((e) => e.message === line.trim() && !e.resolved);
            if (!exists && line.trim()) {
              const nextId = `err-${String(config.entries.length + 1).padStart(3, "0")}`;
              config.entries.push({
                id: nextId,
                date: new Date().toISOString().split("T")[0],
                severity: "error",
                message: line.trim(),
                count: 1,
                resolved: false,
              });
            }
          }

          await writeYaml(errorsPath, config);
        } catch {
          // Source command failed — continue with existing entries
        }
      }

      // Apply filters
      let filtered = config.entries;

      if (severity) {
        filtered = filtered.filter((e) => e.severity === severity);
      }

      if (since) {
        filtered = filtered.filter((e) => e.date >= since);
      }

      if (resolved !== undefined) {
        filtered = filtered.filter((e) => e.resolved === resolved);
      }

      // Compute summary
      const summary = {
        total: filtered.length,
        by_severity: {
          critical: filtered.filter((e) => e.severity === "critical").length,
          error: filtered.filter((e) => e.severity === "error").length,
          warning: filtered.filter((e) => e.severity === "warning").length,
        },
        unresolved: filtered.filter((e) => !e.resolved).length,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ entries: filtered, summary }, null, 2),
          },
        ],
      };
    },
  );
}

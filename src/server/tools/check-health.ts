import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { HealthConfig, HealthCheck, HealthCheckResult, HealthResult } from "../types/lifecycle.js";

const execAsync = promisify(exec);

type HealthStatus = "green" | "yellow" | "red";

async function runHttpCheck(check: HealthCheck): Promise<HealthCheckResult> {
  const timeout = check.timeout_ms ?? 10000;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(check.target, { signal: controller.signal });
    clearTimeout(timer);

    const response_time_ms = Date.now() - start;
    const expectedStatus = check.expected_status ?? 200;

    let status: HealthStatus;
    if (response.status === expectedStatus) {
      status = response_time_ms > timeout * 0.8 ? "yellow" : "green";
    } else {
      status = "red";
    }

    return {
      name: check.name,
      status,
      response_time_ms,
      error: response.status !== expectedStatus ? `Expected ${expectedStatus}, got ${response.status}` : undefined,
      checked_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: check.name,
      status: "red",
      response_time_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      checked_at: new Date().toISOString(),
    };
  }
}

async function runCommandCheck(check: HealthCheck): Promise<HealthCheckResult> {
  const timeout = check.timeout_ms ?? 10000;
  const start = Date.now();

  try {
    const { stdout } = await execAsync(check.target, { timeout });
    const response_time_ms = Date.now() - start;
    const output = stdout.trim();

    let status: HealthStatus = "green";
    if (check.expected_output && !output.includes(check.expected_output)) {
      status = "red";
    } else if (response_time_ms > timeout * 0.8) {
      status = "yellow";
    }

    return {
      name: check.name,
      status,
      response_time_ms,
      error: status === "red" ? `Output did not contain expected: "${check.expected_output}"` : undefined,
      checked_at: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: check.name,
      status: "red",
      response_time_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      checked_at: new Date().toISOString(),
    };
  }
}

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("yellow")) return "yellow";
  return "green";
}

export function registerCheckHealth(server: McpServer): void {
  server.tool(
    "hive_check_health",
    "Run health checks for a project. Executes HTTP and command checks defined in health.yaml.",
    {
      project: z.string().describe("Project slug"),
    },
    async ({ project }) => {
      const healthPath = join(HIVE_DIRS.projects, safeName(project), "health.yaml");

      let config: HealthConfig;
      try {
        config = await readYaml<HealthConfig>(healthPath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `No health.yaml found for project "${project}".`,
                  setup: {
                    message: "Create health.yaml in your project directory with this structure:",
                    example: {
                      checks: [
                        { name: "API", type: "http", target: "https://api.example.com/health", timeout_ms: 5000, expected_status: 200 },
                        { name: "Database", type: "command", target: "pg_isready", timeout_ms: 3000 },
                      ],
                      results: [],
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

      if (!config.checks || config.checks.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No health checks defined in health.yaml for "${project}".` }],
          isError: true,
        };
      }

      const checkResults: HealthCheckResult[] = [];

      for (const check of config.checks) {
        const result = check.type === "http" ? await runHttpCheck(check) : await runCommandCheck(check);
        checkResults.push(result);
      }

      const overall = worstStatus(checkResults.map((r) => r.status));

      const result: HealthResult = {
        overall,
        checks: checkResults,
        checked_at: new Date().toISOString(),
      };

      if (!config.results) config.results = [];
      config.results.push(result);

      // Keep last 50 results
      if (config.results.length > 50) {
        config.results = config.results.slice(-50);
      }

      await writeYaml(healthPath, config);

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

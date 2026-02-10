import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { DeployConfig, DeployRecord } from "../types/lifecycle.js";

const execAsync = promisify(exec);

export function registerDeploy(server: McpServer): void {
  server.tool(
    "hive_deploy",
    "Deploy a project. Reads deploy.yaml for target config, supports dry-run mode.",
    {
      project: z.string().describe("Project slug"),
      dry_run: z.boolean().optional().default(true).describe("If true, show commands without executing (default: true)"),
      notes: z.string().optional().describe("Optional deploy notes"),
    },
    async ({ project, dry_run, notes }) => {
      const deployPath = join(HIVE_DIRS.projects, safeName(project), "deploy.yaml");

      let config: DeployConfig;
      try {
        config = await readYaml<DeployConfig>(deployPath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `No deploy.yaml found for project "${project}".`,
                  setup: {
                    message: "Create deploy.yaml in your project directory with this structure:",
                    example: {
                      target: {
                        command: "npm run deploy",
                        directory: "/path/to/project",
                        pre_deploy: ["npm run build", "npm test"],
                      },
                      history: [],
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

      const target = config.target;
      if (!target || !target.command) {
        return {
          content: [{ type: "text" as const, text: `deploy.yaml for "${project}" is missing a target.command.` }],
          isError: true,
        };
      }

      // Dry run — just show what would execute
      if (dry_run) {
        const commands: string[] = [];
        if (target.pre_deploy) {
          commands.push(...target.pre_deploy);
        }
        commands.push(target.command);

        const record: DeployRecord = {
          id: `deploy-${String(config.history.length + 1).padStart(3, "0")}`,
          date: new Date().toISOString(),
          status: "dry_run",
          notes,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  mode: "dry_run",
                  directory: target.directory ?? "(current)",
                  environment_vars: target.environment_vars ?? {},
                  commands,
                  record,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Live deploy
      const startTime = Date.now();
      const cwd = target.directory ?? process.cwd();
      const env = { ...process.env, ...target.environment_vars };

      try {
        // Run pre-deploy commands
        if (target.pre_deploy) {
          for (const cmd of target.pre_deploy) {
            await execAsync(cmd, { cwd, env });
          }
        }

        // Run deploy command
        const { stdout } = await execAsync(target.command, { cwd, env });
        const duration_ms = Date.now() - startTime;

        const record: DeployRecord = {
          id: `deploy-${String(config.history.length + 1).padStart(3, "0")}`,
          date: new Date().toISOString(),
          status: "success",
          duration_ms,
          notes,
        };

        config.history.push(record);
        await writeYaml(deployPath, config);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ message: "Deploy succeeded", record, output: stdout.slice(0, 2000) }, null, 2),
            },
          ],
        };
      } catch (err) {
        const duration_ms = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : String(err);

        const record: DeployRecord = {
          id: `deploy-${String(config.history.length + 1).padStart(3, "0")}`,
          date: new Date().toISOString(),
          status: "failed",
          duration_ms,
          error: errorMsg,
          notes,
        };

        config.history.push(record);
        await writeYaml(deployPath, config);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ message: "Deploy failed", record }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}

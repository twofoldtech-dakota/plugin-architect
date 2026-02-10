import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml, slugify } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";

export function registerInitProject(server: McpServer): void {
  server.tool(
    "hive_init_project",
    "Initialize a new project with architecture doc, decisions log, and API registry. Optionally pre-populate from a stack preset.",
    {
      name: z.string().describe("Project name"),
      description: z.string().describe("What you're building"),
      stack: z.string().optional().describe("Stack preset slug (e.g., 'next-drizzle-sqlite')"),
    },
    async ({ name, description, stack }) => {
      const slug = slugify(name);
      const projectDir = join(HIVE_DIRS.projects, slug);
      const now = new Date().toISOString().split("T")[0];

      let stackData: Record<string, string> = {};
      let components: Architecture["components"] = [];
      let fileStructure: Record<string, unknown> = {};

      if (stack) {
        try {
          const preset = await readYaml<Record<string, unknown>>(
            join(HIVE_DIRS.stacks, `${stack}.yaml`),
          );
          if (preset.dependencies && typeof preset.dependencies === "object") {
            stackData = { preset: stack };
          }
          if (Array.isArray(preset.patterns)) {
            stackData.patterns = (preset.patterns as string[]).join(", ");
          }
          if (preset.file_structure && typeof preset.file_structure === "object") {
            fileStructure = preset.file_structure as Record<string, unknown>;
          }
        } catch {
          // Stack preset not found — continue without it
        }
      }

      const architecture: Architecture = {
        project: name,
        description,
        created: now,
        updated: now,
        status: "planning",
        stack: stackData,
        components,
        data_flows: [],
        file_structure: fileStructure,
      };

      await writeYaml(join(projectDir, "architecture.yaml"), architecture);
      await writeYaml(join(projectDir, "decisions.yaml"), { decisions: [] });
      await writeYaml(join(projectDir, "apis.yaml"), { apis: [] });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(architecture, null, 2),
          },
        ],
      };
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, safeName } from "../storage/index.js";
import type { Architecture, ApiRegistry } from "../types/architecture.js";

export function registerValidateAgainstSpec(server: McpServer): void {
  server.tool(
    "hive_validate_against_spec",
    "Validate a proposed action or set of files against the project architecture. Use before making changes to ensure alignment.",
    {
      project: z.string().describe("Project slug"),
      action: z.string().describe("What you are about to do (natural language description)"),
      files: z.array(z.string()).optional().describe("File paths that will be created or modified"),
    },
    async ({ project, action, files }) => {
      const projectDir = join(HIVE_DIRS.projects, safeName(project));

      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(join(projectDir, "architecture.yaml"));
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      let apis: ApiRegistry = { apis: [] };
      try {
        apis = await readYaml<ApiRegistry>(join(projectDir, "apis.yaml"));
      } catch {
        // No APIs registered yet
      }

      const concerns: string[] = [];
      const suggestions: string[] = [];

      const actionLower = action.toLowerCase();
      const knownComponents = architecture.components.map((c) => c.name.toLowerCase());
      const knownDeps = architecture.components.flatMap((c) => c.dependencies);
      const knownFiles = architecture.components.flatMap((c) => c.files);
      const stackKeys = Object.keys(architecture.stack);

      // Check if the action references components that exist in the architecture
      const referencedComponents = architecture.components.filter(
        (c) => actionLower.includes(c.name.toLowerCase()) || actionLower.includes(c.type.toLowerCase()),
      );

      if (referencedComponents.length === 0 && architecture.components.length > 0) {
        concerns.push(
          `Action does not clearly map to any known component. Known components: ${knownComponents.join(", ")}`,
        );
        suggestions.push("Clarify which component this action relates to, or add a new component to the architecture.");
      }

      // Check if proposed files align with existing file structure
      if (files && files.length > 0) {
        for (const file of files) {
          // Check if file fits within any component's known file patterns
          const matchesComponent = architecture.components.some((c) =>
            c.files.some((f) => {
              // Simple prefix/glob matching
              if (f.includes("*")) {
                const prefix = f.split("*")[0];
                return file.startsWith(prefix);
              }
              return file === f || file.startsWith(f.replace(/[^/]+$/, ""));
            }),
          );

          if (!matchesComponent && knownFiles.length > 0) {
            concerns.push(`File "${file}" does not match any component's file patterns.`);

            // Find closest matching component
            const bestMatch = architecture.components.find((c) =>
              c.files.some((f) => {
                const dir = f.replace(/[^/]+$/, "");
                return dir && file.includes(dir);
              }),
            );

            if (bestMatch) {
              suggestions.push(`"${file}" might belong to component "${bestMatch.name}" — consider adding it to that component's files.`);
            } else {
              suggestions.push(`Consider adding "${file}" to an existing component's files list or creating a new component.`);
            }
          }
        }
      }

      // Check if action might introduce new dependencies not in the stack
      const commonDeps = ["react", "vue", "angular", "express", "fastify", "next", "svelte", "tailwind", "prisma", "drizzle", "sqlite", "postgres", "redis", "graphql"];
      for (const dep of commonDeps) {
        if (actionLower.includes(dep) && !stackKeys.some((k) => k.toLowerCase().includes(dep)) && !knownDeps.includes(dep)) {
          concerns.push(`Action references "${dep}" which is not in the project stack or dependencies.`);
          suggestions.push(`Register "${dep}" in the stack or as a dependency before proceeding.`);
        }
      }

      // Check if action might conflict with registered APIs
      if (actionLower.includes("api") || actionLower.includes("endpoint") || actionLower.includes("route")) {
        if (apis.apis.length > 0) {
          suggestions.push(`Project has ${apis.apis.length} registered API(s). Check apis.yaml to avoid conflicts.`);
        } else {
          suggestions.push("Consider registering any new APIs with hive_register_api.");
        }
      }

      // Check data flow alignment
      if (architecture.data_flows.length > 0) {
        const flowSteps = architecture.data_flows.flatMap((f) => f.steps.map((s) => s.toLowerCase()));
        const actionTerms = actionLower.split(/\s+/);
        const touchesFlow = actionTerms.some((term) => flowSteps.some((step) => step.includes(term)));
        if (touchesFlow) {
          suggestions.push("This action may affect existing data flows. Review data_flows in the architecture.");
        }
      }

      const aligned = concerns.length === 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ aligned, concerns, suggestions }, null, 2),
          },
        ],
      };
    },
  );
}

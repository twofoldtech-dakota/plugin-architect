import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { join } from "node:path";
import { projectsRepo, patternsRepo } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";

interface FileOperation {
  action: "create" | "modify";
  path: string;
  content: string;
  source_pattern?: string;
}

function determineTargetPath(fileName: string, _architecture: Architecture): string {
  return fileName;
}

export function registerAddFeature(server: McpServer): void {
  registerAppTool(
    server,
    "hive_add_feature",
    {
      description: "Add a feature to an existing project by matching patterns from the knowledge base.",
      _meta: { ui: { resourceUri: "ui://hive/scaffold-preview" } },
      inputSchema: {
        project: z.string().describe("Project slug"),
        feature: z.string().describe("Feature description"),
        project_path: z.string().describe("Absolute path to the project codebase"),
      },
    },
    async ({ project, feature, project_path }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return { content: [{ type: "text" as const, text: `Project "${project}" not found.` }], isError: true };
      }

      const terms = feature.toLowerCase().split(/\s+/);
      const matchingPatterns = patternsRepo.list().filter((p) => {
        const nameMatch = terms.some((t) => p.name.toLowerCase().includes(t));
        const tagMatch = p.tags.some((t) => terms.includes(t.toLowerCase()));
        return nameMatch || tagMatch;
      });

      if (matchingPatterns.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ message: `No patterns found matching "${feature}".`, suggestion: "Register patterns first." }, null, 2),
          }],
        };
      }

      const operations: FileOperation[] = [];
      const matchedNames: string[] = [];

      for (const pattern of matchingPatterns) {
        matchedNames.push(pattern.name);
        for (const file of pattern.files) {
          const targetPath = join(project_path, determineTargetPath(file.path, proj.architecture));
          operations.push({ action: "create", path: targetPath, content: file.content, source_pattern: pattern.name });
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ feature, matched_patterns: matchedNames, operations, note: "Review and apply the file operations above." }, null, 2),
        }],
      };
    },
  );
}

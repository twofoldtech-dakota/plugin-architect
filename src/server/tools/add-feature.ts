import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";

interface FileOperation {
  action: "create" | "modify";
  path: string;
  content: string;
  source_pattern?: string;
}

function findMatchingPatterns(
  index: PatternIndex,
  feature: string,
  architecture: Architecture,
): string[] {
  const terms = feature.toLowerCase().split(/\s+/);
  const stackKeys = Object.keys(architecture.stack).map((k) => k.toLowerCase());
  const stackValues = Object.values(architecture.stack).map((v) => String(v).toLowerCase());
  const stackTerms = [...stackKeys, ...stackValues];

  return index.patterns
    .filter((entry) => {
      const nameWords = entry.name.toLowerCase();
      const tagMatch = entry.tags.some((t) => terms.includes(t.toLowerCase()));
      const nameMatch = terms.some((term) => nameWords.includes(term));
      return tagMatch || nameMatch;
    })
    .map((entry) => entry.slug);
}

function determineTargetPath(
  fileName: string,
  architecture: Architecture,
): string {
  // Try to infer a reasonable placement from the architecture's file_structure
  // Fall back to the file's own path
  return fileName;
}

export function registerAddFeature(server: McpServer): void {
  server.tool(
    "hive_add_feature",
    "Add a feature to an existing project by matching patterns from the knowledge base. Returns file operations (create/modify) that can be applied to the project.",
    {
      project: z.string().describe("Project slug"),
      feature: z.string().describe("Feature description (natural language or pattern name)"),
      project_path: z.string().describe("Absolute path to the project codebase"),
    },
    async ({ project, feature, project_path }) => {
      // Read project architecture
      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(
          join(HIVE_DIRS.projects, project, "architecture.yaml"),
        );
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `Project "${project}" not found. Use hive_list_projects to see available projects.`,
            },
          ],
          isError: true,
        };
      }

      // Search patterns matching the feature
      let index: PatternIndex;
      try {
        index = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: "No patterns registered. Register patterns first with hive_register_pattern.",
            },
          ],
          isError: true,
        };
      }

      const matchingSlugs = findMatchingPatterns(index, feature, architecture);

      if (matchingSlugs.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: `No patterns found matching "${feature}". Consider registering relevant patterns first.`,
                  suggestion: "Use hive_register_pattern to add patterns, then try again.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Read matching patterns and build file operations
      const operations: FileOperation[] = [];
      const matchedPatterns: string[] = [];

      for (const slug of matchingSlugs) {
        try {
          const pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${slug}.yaml`));
          matchedPatterns.push(pattern.name);

          for (const file of pattern.files) {
            const targetPath = join(project_path, determineTargetPath(file.path, architecture));
            operations.push({
              action: "create",
              path: targetPath,
              content: file.content,
              source_pattern: pattern.name,
            });
          }
        } catch {
          // Skip unreadable patterns
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                feature,
                matched_patterns: matchedPatterns,
                operations,
                note: "Review the file operations above and apply them to your project. Paths may need adjustment to fit your project structure.",
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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml, slugify } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { Pattern } from "../types/pattern.js";

interface StackPreset {
  name: string;
  description: string;
  tags?: string[];
  dependencies?: {
    production?: Record<string, string>;
    dev?: Record<string, string>;
  };
  patterns?: string[];
  file_structure?: Record<string, unknown>;
}

/** Recursively create directories from a file_structure tree. */
async function createFileStructure(
  basePath: string,
  structure: Record<string, unknown>,
  created: string[],
): Promise<void> {
  for (const [key, value] of Object.entries(structure)) {
    const fullPath = join(basePath, key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      await mkdir(fullPath, { recursive: true });
      created.push(fullPath + "/");
      await createFileStructure(fullPath, value as Record<string, unknown>, created);
    } else {
      // Leaf node — create an empty file placeholder
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, "", "utf-8");
      created.push(fullPath);
    }
  }
}

export function registerScaffoldProject(server: McpServer): void {
  server.tool(
    "hive_scaffold_project",
    "Scaffold a full project from a stack preset — creates directory structure, package.json, pattern files, and a Hive project entry.",
    {
      name: z.string().describe("Project name"),
      stack: z.string().describe("Stack preset slug (e.g., 'next-drizzle-sqlite')"),
      output_path: z.string().describe("Absolute path where the project directory will be created"),
    },
    async ({ name, stack, output_path }) => {
      // Read stack preset
      let preset: StackPreset;
      try {
        preset = await readYaml<StackPreset>(join(HIVE_DIRS.stacks, `${stack}.yaml`));
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `Stack preset "${stack}" not found. Use hive_list_stacks to see available presets.`,
            },
          ],
          isError: true,
        };
      }

      const projectDir = join(output_path, slugify(name));
      const createdFiles: string[] = [];

      // Create project root
      await mkdir(projectDir, { recursive: true });

      // Generate package.json from preset dependencies
      if (preset.dependencies) {
        const pkg = {
          name: slugify(name),
          version: "0.1.0",
          private: true,
          description: preset.description,
          dependencies: preset.dependencies.production ?? {},
          devDependencies: preset.dependencies.dev ?? {},
        };
        const pkgPath = join(projectDir, "package.json");
        await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
        createdFiles.push(pkgPath);
      }

      // Create file structure from preset
      if (preset.file_structure && typeof preset.file_structure === "object") {
        await createFileStructure(projectDir, preset.file_structure as Record<string, unknown>, createdFiles);
      }

      // Read and write pattern files into the project
      if (preset.patterns && preset.patterns.length > 0) {
        for (const patternSlug of preset.patterns) {
          try {
            const pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${patternSlug}.yaml`));
            for (const file of pattern.files) {
              const filePath = join(projectDir, file.path);
              await mkdir(join(filePath, ".."), { recursive: true });
              await writeFile(filePath, file.content, "utf-8");
              createdFiles.push(filePath);
            }
          } catch {
            // Skip patterns that can't be read
          }
        }
      }

      // Create Hive project entry
      const slug = slugify(name);
      const hiveProjectDir = join(HIVE_DIRS.projects, slug);
      const now = new Date().toISOString().split("T")[0];

      const architecture: Architecture = {
        project: name,
        description: preset.description,
        created: now,
        updated: now,
        status: "planning",
        stack: { preset: stack },
        components: [],
        data_flows: [],
        file_structure: preset.file_structure ?? {},
      };

      await writeYaml(join(hiveProjectDir, "architecture.yaml"), architecture);
      await writeYaml(join(hiveProjectDir, "decisions.yaml"), { decisions: [] });
      await writeYaml(join(hiveProjectDir, "apis.yaml"), { apis: [] });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Project "${name}" scaffolded from stack "${stack}"`,
                project_path: projectDir,
                hive_project: slug,
                files_created: createdFiles.length,
                files: createdFiles,
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

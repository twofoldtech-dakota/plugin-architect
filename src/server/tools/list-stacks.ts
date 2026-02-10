import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";

interface StackPreset {
  name: string;
  description: string;
  tags?: string[];
}

export function registerListStacks(server: McpServer): void {
  server.tool(
    "hive_list_stacks",
    "List all available stack presets",
    {},
    async () => {
      let files: string[];
      try {
        files = await readdir(HIVE_DIRS.stacks);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No stack presets found." }],
        };
      }

      const yamlFiles = files.filter((f) => f.endsWith(".yaml"));

      if (yamlFiles.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No stack presets found." }],
        };
      }

      const stacks: Array<{ slug: string; name: string; description: string; tags: string[] }> = [];

      for (const file of yamlFiles) {
        try {
          const preset = await readYaml<StackPreset>(join(HIVE_DIRS.stacks, file));
          stacks.push({
            slug: file.replace(".yaml", ""),
            name: preset.name,
            description: preset.description,
            tags: preset.tags ?? [],
          });
        } catch {
          // Skip malformed files
        }
      }

      if (stacks.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No stack presets found." }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(stacks, null, 2),
          },
        ],
      };
    },
  );
}

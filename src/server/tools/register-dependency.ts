import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dependenciesRepo } from "../storage/index.js";

export function registerRegisterDependency(server: McpServer): void {
  server.tool(
    "hive_register_dependency",
    "Cache a dependency's real API surface (exports, types, signatures, gotchas) to prevent hallucination",
    {
      name: z.string().describe("Package name (e.g., 'drizzle-orm')"),
      version: z.string().describe("Package version (e.g., '0.34.x')"),
      surface: z.object({
        exports: z
          .array(
            z.object({
              name: z.string(),
              type: z.string(),
              signature: z.string(),
              description: z.string(),
            }),
          )
          .optional()
          .describe("Exported functions/classes"),
        column_types: z.array(z.string()).optional().describe("Available column types"),
        common_patterns: z
          .array(z.object({ name: z.string(), code: z.string() }))
          .optional()
          .describe("Common usage patterns"),
        gotchas: z.array(z.string()).optional().describe("Known gotchas and pitfalls"),
      }),
    },
    async ({ name, version, surface }) => {
      dependenciesRepo.upsert({
        name,
        version,
        exports: surface.exports,
        column_types: surface.column_types,
        common_patterns: surface.common_patterns,
        gotchas: surface.gotchas,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Dependency "${name}@${version}" registered`,
                exports_count: surface.exports?.length ?? 0,
                gotchas_count: surface.gotchas?.length ?? 0,
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

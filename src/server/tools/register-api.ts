import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { ApiRegistry, ApiContract } from "../types/architecture.js";

export function registerRegisterApi(server: McpServer): void {
  server.tool(
    "hive_register_api",
    "Register an internal or external API contract for a project",
    {
      project: z.string().describe("Project slug"),
      name: z.string().describe("API name (e.g., 'internal-rest', 'stripe')"),
      type: z.enum(["internal", "external"]).describe("API type"),
      base: z.string().describe("Base URL or path (e.g., '/api' or 'https://api.stripe.com/v1')"),
      endpoints: z
        .array(
          z.object({
            method: z.string().describe("HTTP method"),
            path: z.string().describe("Endpoint path"),
            body: z.record(z.string(), z.string()).optional().describe("Request body shape"),
            response: z.record(z.string(), z.string()).optional().describe("Response shape"),
            errors: z
              .array(z.object({ status: z.number(), message: z.string() }))
              .optional()
              .describe("Known error responses"),
            docs: z.string().optional().describe("Documentation URL"),
          }),
        )
        .describe("API endpoints"),
    },
    async ({ project, name, type, base, endpoints }) => {
      const apisPath = join(HIVE_DIRS.projects, project, "apis.yaml");

      let registry: ApiRegistry;
      try {
        registry = await readYaml<ApiRegistry>(apisPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      const api: ApiContract = { name, type, base, endpoints };

      // Replace existing API with same name, or append
      const idx = registry.apis.findIndex((a) => a.name === name);
      if (idx >= 0) {
        registry.apis[idx] = api;
      } else {
        registry.apis.push(api);
      }

      await writeYaml(apisPath, registry);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `API "${name}" registered for project "${project}"`,
                endpoints_count: endpoints.length,
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

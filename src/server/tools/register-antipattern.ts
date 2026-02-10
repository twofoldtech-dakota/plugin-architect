import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml, slugify } from "../storage/index.js";
import type { Antipattern, AntipatternIndex } from "../types/antipattern.js";

export function registerRegisterAntipattern(server: McpServer): void {
  server.tool(
    "hive_register_antipattern",
    "Register an anti-pattern — something you learned NOT to do. Records the context, why it's bad, and what to do instead. Surfaces in future insights.",
    {
      name: z.string().describe("Short name for the anti-pattern (e.g., 'N+1 queries in GraphQL resolvers')"),
      description: z.string().describe("What the anti-pattern is"),
      context: z.string().describe("When/where this anti-pattern typically comes up"),
      why_bad: z.string().describe("Why this is a bad idea"),
      instead: z.string().describe("What to do instead"),
      tags: z.array(z.string()).describe("Tags for discovery (e.g., ['database', 'performance', 'graphql'])"),
      severity: z.enum(["critical", "warning", "minor"]).describe("How bad is this? critical = causes real harm, warning = causes problems, minor = suboptimal"),
      learned_from: z.string().optional().describe("Project slug where this was learned"),
    },
    async ({ name, description, context, why_bad, instead, tags, severity, learned_from }) => {
      const slug = slugify(name);
      const now = new Date().toISOString().split("T")[0];

      const antipattern: Antipattern = {
        name,
        slug,
        description,
        context,
        why_bad,
        instead,
        tags,
        severity,
        learned_from,
        created: now,
      };

      await writeYaml(join(HIVE_DIRS.antipatterns, `${slug}.yaml`), antipattern);

      // Update antipattern index
      const indexPath = join(HIVE_DIRS.antipatterns, "index.yaml");
      let index: AntipatternIndex;
      try {
        index = await readYaml<AntipatternIndex>(indexPath);
      } catch {
        index = { antipatterns: [] };
      }

      index.antipatterns = index.antipatterns.filter((a) => a.slug !== slug);
      index.antipatterns.push({ slug, name, tags, severity });

      await writeYaml(indexPath, index);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { message: `Anti-pattern "${name}" registered`, slug, severity, tags },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

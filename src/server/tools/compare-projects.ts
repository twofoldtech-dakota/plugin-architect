import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture, DecisionLog, ApiRegistry } from "../types/architecture.js";

interface ProjectSnapshot {
  project: string;
  description: string;
  status: string;
  stack: Record<string, string>;
  component_count: number;
  components: string[];
  decision_count: number;
  api_count: number;
}

interface Comparison {
  project_a: ProjectSnapshot;
  project_b: ProjectSnapshot;
  stack_overlap: string[];
  stack_a_only: string[];
  stack_b_only: string[];
  component_overlap: string[];
  components_a_only: string[];
  components_b_only: string[];
  decision_comparison: Array<{
    component: string;
    a_decision: string | null;
    b_decision: string | null;
    same_choice: boolean;
  }>;
  summary: string;
}

async function loadProject(slug: string): Promise<{
  arch: Architecture;
  decisions: DecisionLog;
  apis: ApiRegistry;
} | null> {
  try {
    const [arch, decisions, apis] = await Promise.all([
      readYaml<Architecture>(join(HIVE_DIRS.projects, slug, "architecture.yaml")),
      readYaml<DecisionLog>(join(HIVE_DIRS.projects, slug, "decisions.yaml")).catch(() => ({ decisions: [] })),
      readYaml<ApiRegistry>(join(HIVE_DIRS.projects, slug, "apis.yaml")).catch(() => ({ apis: [] })),
    ]);
    return { arch, decisions, apis };
  } catch {
    return null;
  }
}

function toSnapshot(arch: Architecture, decisions: DecisionLog, apis: ApiRegistry): ProjectSnapshot {
  return {
    project: arch.project,
    description: arch.description,
    status: arch.status,
    stack: arch.stack,
    component_count: arch.components.length,
    components: arch.components.map((c) => c.name),
    decision_count: decisions.decisions.length,
    api_count: apis.apis.length,
  };
}

export function registerCompareProjects(server: McpServer): void {
  server.tool(
    "hive_compare_projects",
    "Side-by-side comparison of two projects — stacks, components, decisions, and APIs. Useful for understanding differences and shared patterns between projects.",
    {
      project_a: z.string().describe("First project slug"),
      project_b: z.string().describe("Second project slug"),
    },
    async ({ project_a, project_b }) => {
      const [dataA, dataB] = await Promise.all([loadProject(project_a), loadProject(project_b)]);

      if (!dataA) {
        return {
          content: [{ type: "text" as const, text: `Project "${project_a}" not found.` }],
          isError: true,
        };
      }
      if (!dataB) {
        return {
          content: [{ type: "text" as const, text: `Project "${project_b}" not found.` }],
          isError: true,
        };
      }

      const snapA = toSnapshot(dataA.arch, dataA.decisions, dataA.apis);
      const snapB = toSnapshot(dataB.arch, dataB.decisions, dataB.apis);

      // Stack comparison
      const stackA = Object.entries(dataA.arch.stack);
      const stackB = Object.entries(dataB.arch.stack);
      const stackAKeys = new Set(stackA.map(([k]) => k));
      const stackBKeys = new Set(stackB.map(([k]) => k));
      const stackAValues = new Set(stackA.map(([, v]) => v.toLowerCase()));
      const stackBValues = new Set(stackB.map(([, v]) => v.toLowerCase()));

      const stackOverlap = stackA
        .filter(([k, v]) => stackBKeys.has(k) || stackBValues.has(v.toLowerCase()))
        .map(([k, v]) => `${k}:${v}`);
      const stackAOnly = stackA
        .filter(([k, v]) => !stackBKeys.has(k) && !stackBValues.has(v.toLowerCase()))
        .map(([k, v]) => `${k}:${v}`);
      const stackBOnly = stackB
        .filter(([k, v]) => !stackAKeys.has(k) && !stackAValues.has(v.toLowerCase()))
        .map(([k, v]) => `${k}:${v}`);

      // Component comparison
      const compANames = new Set(dataA.arch.components.map((c) => c.name.toLowerCase()));
      const compBNames = new Set(dataB.arch.components.map((c) => c.name.toLowerCase()));
      const componentOverlap = [...compANames].filter((n) => compBNames.has(n));
      const componentsAOnly = [...compANames].filter((n) => !compBNames.has(n));
      const componentsBOnly = [...compBNames].filter((n) => !compANames.has(n));

      // Decision comparison by component
      const decisionComparison: Comparison["decision_comparison"] = [];
      const allComponents = new Set([
        ...dataA.decisions.decisions.map((d) => d.component.toLowerCase()),
        ...dataB.decisions.decisions.map((d) => d.component.toLowerCase()),
      ]);

      for (const comp of allComponents) {
        const aDecision = dataA.decisions.decisions.find(
          (d) => d.component.toLowerCase() === comp,
        );
        const bDecision = dataB.decisions.decisions.find(
          (d) => d.component.toLowerCase() === comp,
        );

        const aText = aDecision?.decision ?? null;
        const bText = bDecision?.decision ?? null;

        // Simple same-choice check
        let sameChoice = false;
        if (aText && bText) {
          const aTerms = aText.toLowerCase().split(/\s+/);
          const bTerms = bText.toLowerCase().split(/\s+/);
          const overlap = aTerms.filter((t) => bTerms.includes(t) && t.length > 3);
          sameChoice = overlap.length >= 2;
        }

        decisionComparison.push({ component: comp, a_decision: aText, b_decision: bText, same_choice: sameChoice });
      }

      // Build summary
      const summaryParts: string[] = [];
      if (stackOverlap.length > 0) {
        summaryParts.push(`${stackOverlap.length} shared stack choice(s)`);
      }
      if (componentOverlap.length > 0) {
        summaryParts.push(`${componentOverlap.length} shared component(s)`);
      }
      const sameDecisions = decisionComparison.filter((d) => d.same_choice).length;
      if (sameDecisions > 0) {
        summaryParts.push(`${sameDecisions} similar decision(s)`);
      }

      const summary =
        summaryParts.length > 0
          ? `"${snapA.project}" and "${snapB.project}" share ${summaryParts.join(", ")}.`
          : `"${snapA.project}" and "${snapB.project}" have little in common.`;

      const comparison: Comparison = {
        project_a: snapA,
        project_b: snapB,
        stack_overlap: stackOverlap,
        stack_a_only: stackAOnly,
        stack_b_only: stackBOnly,
        component_overlap: componentOverlap,
        components_a_only: componentsAOnly,
        components_b_only: componentsBOnly,
        decision_comparison: decisionComparison,
        summary,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(comparison, null, 2) }],
      };
    },
  );
}

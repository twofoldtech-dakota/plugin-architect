import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { decisionsRepo, projectsRepo } from "../storage/index.js";

function normalizeTerms(text: string): string[] {
  return text.toLowerCase().split(/[\s_\-/]+/).filter((t) => t.length > 1);
}

function termsOverlap(a: string[], b: string[]): number {
  return a.filter((t) => b.includes(t)).length;
}

export function registerDecisionGraph(server: McpServer): void {
  server.tool(
    "hive_decision_graph",
    "Build a decision graph connecting related architectural decisions across projects.",
    {
      topic: z.string().describe("Component or topic to map decisions for"),
      include_related: z.boolean().optional().describe("Include loosely related decisions (default true)"),
    },
    { readOnlyHint: true },
    async ({ topic, include_related }) => {
      const includeRelated = include_related !== false;
      const topicTerms = normalizeTerms(topic);
      const projects = projectsRepo.list();
      const projectMap = new Map(projects.map((p) => [p.id, p.slug]));

      const allDecisions = decisionsRepo.listAll();
      const nodes: Array<{ project: string; decision: { id: string; date: string; component: string; decision: string; reasoning: string } }> = [];

      for (const d of allDecisions) {
        const projSlug = projectMap.get(d.project_id) ?? "unknown";
        const componentTerms = normalizeTerms(d.component);
        const textTerms = normalizeTerms(`${d.decision} ${d.reasoning}`);
        if (termsOverlap(topicTerms, componentTerms) > 0 || (includeRelated && termsOverlap(topicTerms, textTerms) > 0)) {
          nodes.push({ project: projSlug, decision: { id: d.id, date: d.date, component: d.component, decision: d.decision, reasoning: d.reasoning } });
        }
      }

      if (nodes.length === 0) return { content: [{ type: "text" as const, text: `No decisions found related to "${topic}".` }] };

      const edges: Array<{ from: { project: string; decision_id: string }; to: { project: string; decision_id: string }; relationship: string; description: string }> = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (termsOverlap(normalizeTerms(a.decision.component), normalizeTerms(b.decision.component)) > 0) {
            const sameChoice = termsOverlap(normalizeTerms(a.decision.decision), normalizeTerms(b.decision.decision)) > 0;
            edges.push({ from: { project: a.project, decision_id: a.decision.id }, to: { project: b.project, decision_id: b.decision.id }, relationship: sameChoice ? "same_choice" : "conflicting_choice", description: sameChoice ? `Similar approach for ${a.decision.component}` : `Different choices for ${a.decision.component}` });
          }
        }
      }

      const clusterMap = new Map<string, typeof nodes>();
      for (const node of nodes) {
        const key = node.decision.component.toLowerCase();
        if (!clusterMap.has(key)) clusterMap.set(key, []);
        clusterMap.get(key)!.push(node);
      }

      const clusters = [...clusterMap].map(([component, decisions]) => ({
        component,
        decision_count: decisions.length,
        decisions: decisions.map((n) => ({ project: n.project, id: n.decision.id, date: n.decision.date, decision: n.decision.decision, reasoning: n.decision.reasoning })),
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ topic, total_decisions: nodes.length, total_connections: edges.length, clusters, edges }, null, 2) }],
      };
    },
  );
}

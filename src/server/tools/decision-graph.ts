import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Decision, DecisionLog } from "../types/architecture.js";

interface GraphNode {
  project: string;
  decision: Decision;
}

interface GraphEdge {
  from: { project: string; decision_id: string };
  to: { project: string; decision_id: string };
  relationship: "same_component" | "same_choice" | "conflicting_choice" | "references";
  description: string;
}

interface DecisionCluster {
  component: string;
  decisions: GraphNode[];
  consensus: string | null;
  conflicts: string[];
}

function normalizeTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_\-/]+/)
    .filter((t) => t.length > 1);
}

function termsOverlap(a: string[], b: string[]): number {
  return a.filter((t) => b.includes(t)).length;
}

export function registerDecisionGraph(server: McpServer): void {
  server.tool(
    "hive_decision_graph",
    "Build a decision graph connecting related architectural decisions across projects. Shows patterns of choices, consensus, and conflicts for a given topic. Answers: 'last time you chose X, here's why.'",
    {
      topic: z.string().describe("Component or topic to map decisions for (e.g., 'auth', 'database', 'api')"),
      include_related: z.boolean().optional().describe("Include loosely related decisions (default true)"),
    },
    async ({ topic, include_related }) => {
      const includeRelated = include_related !== false;
      const topicTerms = normalizeTerms(topic);

      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      // Collect all relevant decisions
      const nodes: GraphNode[] = [];

      for (const dir of projectDirs) {
        let log: DecisionLog;
        try {
          log = await readYaml<DecisionLog>(join(HIVE_DIRS.projects, dir, "decisions.yaml"));
        } catch {
          continue;
        }

        for (const decision of log.decisions) {
          const componentTerms = normalizeTerms(decision.component);
          const decisionText = `${decision.decision} ${decision.reasoning}`;
          const textTerms = normalizeTerms(decisionText);

          const componentOverlap = termsOverlap(topicTerms, componentTerms);
          const textOverlap = termsOverlap(topicTerms, textTerms);

          if (componentOverlap > 0 || (includeRelated && textOverlap > 0)) {
            nodes.push({ project: dir, decision });
          }
        }
      }

      if (nodes.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No decisions found related to "${topic}" across any projects.`,
            },
          ],
        };
      }

      // Build edges between related decisions
      const edges: GraphEdge[] = [];

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];

          const aComponentTerms = normalizeTerms(a.decision.component);
          const bComponentTerms = normalizeTerms(b.decision.component);
          const componentOverlap = termsOverlap(aComponentTerms, bComponentTerms);

          if (componentOverlap > 0) {
            // Check if same choice or conflicting
            const aChoiceTerms = normalizeTerms(a.decision.decision);
            const bChoiceTerms = normalizeTerms(b.decision.decision);
            const choiceOverlap = termsOverlap(aChoiceTerms, bChoiceTerms);

            const relationship = choiceOverlap > 0 ? "same_choice" : "conflicting_choice";
            const description =
              relationship === "same_choice"
                ? `Both projects chose similar approach for ${a.decision.component}`
                : `Different choices for ${a.decision.component}: "${a.decision.decision.slice(0, 50)}" vs "${b.decision.decision.slice(0, 50)}"`;

            edges.push({
              from: { project: a.project, decision_id: a.decision.id },
              to: { project: b.project, decision_id: b.decision.id },
              relationship,
              description,
            });
          }
        }
      }

      // Cluster decisions by component
      const clusterMap = new Map<string, GraphNode[]>();
      for (const node of nodes) {
        const key = node.decision.component.toLowerCase();
        if (!clusterMap.has(key)) clusterMap.set(key, []);
        clusterMap.get(key)!.push(node);
      }

      const clusters: DecisionCluster[] = [];
      for (const [component, decisions] of clusterMap) {
        // Find consensus — most common choice keywords
        const choiceCounts = new Map<string, number>();
        for (const node of decisions) {
          const key = normalizeTerms(node.decision.decision).slice(0, 3).join(" ");
          choiceCounts.set(key, (choiceCounts.get(key) ?? 0) + 1);
        }

        let consensus: string | null = null;
        let maxCount = 0;
        for (const [choice, count] of choiceCounts) {
          if (count > maxCount && count > 1) {
            consensus = choice;
            maxCount = count;
          }
        }

        // Find conflicting decisions within cluster
        const conflicts: string[] = [];
        if (choiceCounts.size > 1 && decisions.length > 1) {
          for (const [choice] of choiceCounts) {
            if (choice !== consensus) {
              const example = decisions.find(
                (d) => normalizeTerms(d.decision.decision).slice(0, 3).join(" ") === choice,
              );
              if (example) {
                conflicts.push(
                  `${example.project}: "${example.decision.decision.slice(0, 80)}"`,
                );
              }
            }
          }
        }

        clusters.push({ component, decisions, consensus, conflicts });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                topic,
                total_decisions: nodes.length,
                total_connections: edges.length,
                clusters: clusters.map((c) => ({
                  component: c.component,
                  decision_count: c.decisions.length,
                  consensus: c.consensus,
                  conflicts: c.conflicts,
                  decisions: c.decisions.map((n) => ({
                    project: n.project,
                    id: n.decision.id,
                    date: n.decision.date,
                    decision: n.decision.decision,
                    reasoning: n.decision.reasoning,
                  })),
                })),
                edges,
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

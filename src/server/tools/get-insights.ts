import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { patternsRepo, projectsRepo, decisionsRepo, dependenciesRepo, antipatternsRepo } from "../storage/index.js";

interface Insight {
  patterns_to_use: Array<{ name: string; slug: string; description: string; usage_count: number }>;
  decisions_made_before: Array<{ project: string; component: string; decision: string; reasoning: string }>;
  antipatterns_to_avoid: Array<{ name: string; severity: string; why_bad: string; instead: string }>;
  dependency_gotchas: Array<{ dependency: string; gotchas: string[] }>;
  stack_preferences: Array<{ key: string; value: string; used_by: string[] }>;
  summary: string;
}

function matchesType(text: string, typeTerms: string[]): boolean {
  const lower = text.toLowerCase();
  return typeTerms.some((t) => lower.includes(t));
}

export function registerGetInsights(server: McpServer): void {
  server.tool(
    "hive_get_insights",
    "Get a pre-flight briefing before building a system. Aggregates patterns to use, past decisions, anti-patterns to avoid, and dependency gotchas for a given type of system. Answers: 'what should I know before building another [type] system?'",
    {
      type: z.string().describe("Type of system (e.g., 'api', 'fullstack', 'cli', 'database', 'auth', 'realtime')"),
      stack: z.array(z.string()).optional().describe("Stack keywords to narrow insights (e.g., ['typescript', 'next'])"),
    },
    async ({ type: systemType, stack }) => {
      const typeTerms = systemType
        .toLowerCase()
        .split(/[\s_\-/]+/)
        .filter((t) => t.length > 1);
      const stackTerms = (stack ?? []).map((s) => s.toLowerCase());

      const insight: Insight = {
        patterns_to_use: [],
        decisions_made_before: [],
        antipatterns_to_avoid: [],
        dependency_gotchas: [],
        stack_preferences: [],
        summary: "",
      };

      // 1. Find relevant patterns
      const allPatterns = patternsRepo.list();
      for (const pattern of allPatterns) {
        const tagMatch = pattern.tags.some((t) => typeTerms.includes(t.toLowerCase()));
        const nameMatch = matchesType(pattern.name, typeTerms);
        if (!tagMatch && !nameMatch) continue;

        if (stackTerms.length > 0 && pattern.stack) {
          const hasStackOverlap = pattern.stack.some((s) => stackTerms.includes(s.toLowerCase()));
          if (!hasStackOverlap && !tagMatch) continue;
        }
        insight.patterns_to_use.push({
          name: pattern.name,
          slug: pattern.slug,
          description: pattern.description,
          usage_count: pattern.used_in?.length ?? 0,
        });
      }
      insight.patterns_to_use.sort((a, b) => b.usage_count - a.usage_count);

      // 2. Find relevant decisions across projects
      const projects = projectsRepo.list();
      const stackCounts = new Map<string, string[]>();

      for (const proj of projects) {
        const arch = proj.architecture;
        const archText = `${arch.description} ${arch.components.map((c) => `${c.name} ${c.type} ${c.description}`).join(" ")}`;
        const archRelevant = matchesType(archText, typeTerms);
        const stackValues = Object.values(arch.stack).map((v) => v.toLowerCase());
        const stackRelevant = stackTerms.length > 0 && stackTerms.some((t) => stackValues.includes(t));

        if (!archRelevant && !stackRelevant) continue;

        for (const [key, value] of Object.entries(arch.stack)) {
          const mapKey = `${key}:${value}`;
          if (!stackCounts.has(mapKey)) stackCounts.set(mapKey, []);
          stackCounts.get(mapKey)!.push(proj.slug);
        }

        const decisions = decisionsRepo.listByProject(proj.id);
        for (const decision of decisions) {
          const decText = `${decision.component} ${decision.decision} ${decision.reasoning}`;
          if (matchesType(decText, typeTerms)) {
            insight.decisions_made_before.push({
              project: proj.slug,
              component: decision.component,
              decision: decision.decision,
              reasoning: decision.reasoning,
            });
          }
        }
      }

      for (const [mapKey, usedBy] of stackCounts) {
        const [key, value] = mapKey.split(":");
        insight.stack_preferences.push({ key, value, used_by: usedBy });
      }
      insight.stack_preferences.sort((a, b) => b.used_by.length - a.used_by.length);

      // 3. Find relevant antipatterns
      const allAntipatterns = antipatternsRepo.list();
      for (const ap of allAntipatterns) {
        const tagMatch = ap.tags.some((t) => typeTerms.includes(t.toLowerCase()));
        const nameMatch = matchesType(ap.name, typeTerms);
        if (!tagMatch && !nameMatch) continue;
        insight.antipatterns_to_avoid.push({
          name: ap.name,
          severity: ap.severity,
          why_bad: ap.why_bad,
          instead: ap.instead,
        });
      }

      const severityOrder = { critical: 3, warning: 2, minor: 1 };
      insight.antipatterns_to_avoid.sort(
        (a, b) => severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder],
      );

      // 4. Find relevant dependency gotchas
      const allDeps = dependenciesRepo.list();
      for (const dep of allDeps) {
        if (dep.gotchas && dep.gotchas.length > 0) {
          const depText = `${dep.name} ${(dep.exports ?? []).map((e) => e.name).join(" ")}`;
          if (matchesType(depText, typeTerms) || matchesType(depText, stackTerms)) {
            insight.dependency_gotchas.push({
              dependency: dep.name,
              gotchas: dep.gotchas,
            });
          }
        }
      }

      // Build summary
      const parts: string[] = [];
      if (insight.patterns_to_use.length > 0) parts.push(`${insight.patterns_to_use.length} relevant pattern(s)`);
      if (insight.decisions_made_before.length > 0) parts.push(`${insight.decisions_made_before.length} past decision(s)`);
      if (insight.antipatterns_to_avoid.length > 0) parts.push(`${insight.antipatterns_to_avoid.length} anti-pattern(s) to avoid`);
      if (insight.dependency_gotchas.length > 0) parts.push(`${insight.dependency_gotchas.length} dependency gotcha(s)`);
      if (insight.stack_preferences.length > 0) parts.push(`${insight.stack_preferences.length} stack preference(s) from past projects`);

      insight.summary =
        parts.length > 0
          ? `Insights for building a "${systemType}" system: ${parts.join(", ")}.`
          : `No prior knowledge found for "${systemType}" systems. This will be your first.`;

      return {
        content: [{ type: "text" as const, text: JSON.stringify(insight, null, 2) }],
      };
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, patternsRepo } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";

type Verdict = "build it" | "defer it" | "cut it" | "simplify it";
type Alignment = "core" | "nice-to-have" | "bloat" | "distraction";

function assessAlignment(feature: string, architecture: Architecture) {
  const featureLower = feature.toLowerCase();
  const stackValues = Object.values(architecture.stack).map((v) => String(v).toLowerCase());
  const descLower = architecture.description.toLowerCase();
  const supports: string[] = [];
  const irrelevant: string[] = [];

  for (const comp of architecture.components) {
    const compTerms = [comp.name.toLowerCase(), comp.type.toLowerCase(), comp.description.toLowerCase()];
    if (compTerms.some((t) => featureLower.includes(t) || t.includes(featureLower.split(/\s+/)[0]))) {
      supports.push(comp.name);
    }
  }

  const featureTerms = featureLower.split(/\s+/).filter((t) => t.length > 3);
  if (featureTerms.some((term) => descLower.includes(term))) supports.push("project description");
  if (featureTerms.some((term) => stackValues.some((v) => v.includes(term)))) supports.push("existing stack");

  for (const comp of architecture.components) {
    if (!supports.includes(comp.name)) irrelevant.push(comp.name);
  }

  let score: number;
  if (supports.length >= 3) score = 5;
  else if (supports.length === 2) score = 4;
  else if (supports.length === 1) score = 3;
  else score = featureTerms.some((term) => descLower.includes(term)) ? 2 : 1;

  let classification: Alignment;
  if (score >= 4) classification = "core";
  else if (score === 3) classification = "nice-to-have";
  else if (score === 2) classification = "bloat";
  else classification = "distraction";

  return { score, classification, supports, irrelevant };
}

function assessEffort(feature: string, componentCount: number): "low" | "medium" | "high" {
  const fl = feature.toLowerCase();
  const complex = ["authentication", "auth", "real-time", "websocket", "migration", "refactor", "rewrite", "internationalization", "i18n", "encryption", "multi-tenant"];
  const simple = ["button", "style", "color", "text", "label", "icon", "tooltip", "badge"];
  if (complex.some((i) => fl.includes(i)) || componentCount > 5) return "high";
  if (simple.some((i) => fl.includes(i)) && componentCount <= 2) return "low";
  return "medium";
}

function deriveVerdict(alignment: Alignment, effort: "low" | "medium" | "high", impact: "low" | "medium" | "high"): { verdict: Verdict; reasoning: string; simplified_alternative?: string } {
  if (impact === "high" && effort !== "high") return { verdict: "build it", reasoning: "High impact with manageable effort." };
  if (impact === "high") return { verdict: "simplify it", reasoning: "High impact but high effort — find a simpler version.", simplified_alternative: "Consider an MVP version." };
  if (impact === "medium" && effort === "low") return { verdict: "build it", reasoning: "Low effort with meaningful impact." };
  if (impact === "medium" && effort === "medium" && alignment === "core") return { verdict: "build it", reasoning: "Core-aligned with balanced effort/impact." };
  if (impact === "medium" && effort === "medium") return { verdict: "defer it", reasoning: "Moderate effort and impact — defer until core is solid." };
  if (impact === "medium") return { verdict: "simplify it", reasoning: "Meaningful impact but heavy effort — simplify.", simplified_alternative: "Strip to minimum viable version." };
  if (impact === "low" && effort === "low") return { verdict: "defer it", reasoning: "Low impact — focus on higher-impact work first." };
  return { verdict: "cut it", reasoning: "Low impact relative to effort." };
}

export function registerEvaluateFeature(server: McpServer): void {
  server.tool(
    "hive_evaluate_feature",
    "Evaluate whether a proposed feature is worth building.",
    {
      project: z.string().describe("Project slug"),
      feature: z.string().describe("Feature description"),
      reasoning: z.string().optional().describe("Why you think this feature is needed"),
    },
    async ({ project, feature, reasoning }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return { content: [{ type: "text" as const, text: `Project "${project}" not found.` }], isError: true };
      }

      const architecture = proj.architecture;
      const featureTerms = feature.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      const matchingPatterns = patternsRepo.list()
        .filter((p) => {
          const nameMatch = featureTerms.some((term) => p.name.toLowerCase().includes(term));
          const tagMatch = p.tags.some((tag) => featureTerms.includes(tag.toLowerCase()));
          return nameMatch || tagMatch;
        })
        .map((p) => p.name);

      const { score, classification, supports, irrelevant } = assessAlignment(feature, architecture);
      const effort = assessEffort(feature, architecture.components.length);
      const impact: "low" | "medium" | "high" = classification === "core" && supports.length >= 2 ? "high" : classification === "core" || classification === "nice-to-have" ? "medium" : "low";
      const ratio = effort === impact ? "neutral" as const : (effort === "low" && impact !== "low") || (effort === "medium" && impact === "high") ? "favorable" as const : "unfavorable" as const;
      const { verdict, reasoning: vr, simplified_alternative } = deriveVerdict(classification, effort, impact);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            feature,
            alignment: { score, classification, supports_goals: supports, irrelevant_to_goals: irrelevant },
            effort_impact: { estimated_effort: effort, estimated_impact: impact, ratio },
            matching_patterns: matchingPatterns,
            tradeoffs: {
              complexity_added: effort === "high" ? "Significant" : effort === "medium" ? "Moderate" : "Minimal",
              maintenance_burden: classification === "core" ? "Justified" : classification === "nice-to-have" ? "Acceptable" : "Questionable",
            },
            recommendation: { verdict, reasoning: reasoning ? `${vr} User context: ${reasoning}` : vr, simplified_alternative },
          }, null, 2),
        }],
      };
    },
  );
}

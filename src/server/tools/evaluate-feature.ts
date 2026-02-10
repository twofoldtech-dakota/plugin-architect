import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, safeName } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { PatternIndex } from "../types/pattern.js";

type Verdict = "build it" | "defer it" | "cut it" | "simplify it";
type Alignment = "core" | "nice-to-have" | "bloat" | "distraction";

interface FeatureEvaluation {
  feature: string;
  alignment: {
    score: number;
    classification: Alignment;
    supports_goals: string[];
    irrelevant_to_goals: string[];
  };
  effort_impact: {
    estimated_effort: "low" | "medium" | "high";
    estimated_impact: "low" | "medium" | "high";
    ratio: "favorable" | "neutral" | "unfavorable";
  };
  matching_patterns: string[];
  tradeoffs: {
    complexity_added: string;
    maintenance_burden: string;
    what_to_cut?: string;
  };
  recommendation: {
    verdict: Verdict;
    reasoning: string;
    simplified_alternative?: string;
  };
}

function assessAlignment(
  feature: string,
  architecture: Architecture,
): { score: number; classification: Alignment; supports: string[]; irrelevant: string[] } {
  const featureLower = feature.toLowerCase();
  const components = architecture.components;
  const stackValues = Object.values(architecture.stack).map((v) => String(v).toLowerCase());
  const descLower = architecture.description.toLowerCase();

  const supports: string[] = [];
  const irrelevant: string[] = [];

  // Check if feature relates to existing components
  for (const comp of components) {
    const compTerms = [comp.name.toLowerCase(), comp.type.toLowerCase(), comp.description.toLowerCase()];
    const matches = compTerms.some((t) => featureLower.includes(t) || t.includes(featureLower.split(/\s+/)[0]));
    if (matches) {
      supports.push(comp.name);
    }
  }

  // Check if feature relates to project description/goals
  const featureTerms = featureLower.split(/\s+/).filter((t) => t.length > 3);
  const descMatch = featureTerms.some((term) => descLower.includes(term));
  if (descMatch) supports.push("project description");

  // Check stack alignment
  const stackMatch = featureTerms.some((term) => stackValues.some((v) => v.includes(term)));
  if (stackMatch) supports.push("existing stack");

  // Determine irrelevant goals — components the feature doesn't touch
  for (const comp of components) {
    if (!supports.includes(comp.name)) {
      irrelevant.push(comp.name);
    }
  }

  // Score: 5 = perfectly aligned, 1 = completely off-track
  let score: number;
  if (supports.length >= 3) score = 5;
  else if (supports.length === 2) score = 4;
  else if (supports.length === 1) score = 3;
  else if (descMatch || stackMatch) score = 2;
  else score = 1;

  let classification: Alignment;
  if (score >= 4) classification = "core";
  else if (score === 3) classification = "nice-to-have";
  else if (score === 2) classification = "bloat";
  else classification = "distraction";

  return { score, classification, supports, irrelevant };
}

function assessEffort(feature: string, componentCount: number): "low" | "medium" | "high" {
  const featureLower = feature.toLowerCase();
  const complexityIndicators = ["authentication", "auth", "real-time", "websocket", "migration", "refactor", "rewrite", "internationalization", "i18n", "encryption", "multi-tenant"];
  const simpleIndicators = ["button", "style", "color", "text", "label", "icon", "tooltip", "badge"];

  const isComplex = complexityIndicators.some((i) => featureLower.includes(i));
  const isSimple = simpleIndicators.some((i) => featureLower.includes(i));

  if (isComplex || componentCount > 5) return "high";
  if (isSimple && componentCount <= 2) return "low";
  return "medium";
}

function assessImpact(alignment: Alignment, supports: string[]): "low" | "medium" | "high" {
  if (alignment === "core" && supports.length >= 2) return "high";
  if (alignment === "core" || alignment === "nice-to-have") return "medium";
  return "low";
}

function deriveVerdict(
  alignment: Alignment,
  effort: "low" | "medium" | "high",
  impact: "low" | "medium" | "high",
): { verdict: Verdict; reasoning: string; simplified_alternative?: string } {
  // High impact, any effort → build it
  if (impact === "high" && effort !== "high") {
    return { verdict: "build it", reasoning: "High impact with manageable effort — clear win." };
  }

  // High impact, high effort → consider simplifying
  if (impact === "high" && effort === "high") {
    return {
      verdict: "simplify it",
      reasoning: "High impact but high effort — find a simpler version that delivers the core value.",
      simplified_alternative: "Consider an MVP version that covers the primary use case only.",
    };
  }

  // Medium impact, low effort → build it
  if (impact === "medium" && effort === "low") {
    return { verdict: "build it", reasoning: "Low effort with meaningful impact — quick win." };
  }

  // Medium impact, medium effort → depends on alignment
  if (impact === "medium" && effort === "medium") {
    if (alignment === "core") {
      return { verdict: "build it", reasoning: "Core-aligned feature with balanced effort/impact." };
    }
    return { verdict: "defer it", reasoning: "Moderate effort and impact — defer until core features are solid." };
  }

  // Medium impact, high effort → defer or simplify
  if (impact === "medium" && effort === "high") {
    return {
      verdict: "simplify it",
      reasoning: "Meaningful impact but heavy effort — simplify to reduce scope.",
      simplified_alternative: "Strip to the minimum viable version and iterate.",
    };
  }

  // Low impact → cut or defer
  if (impact === "low" && effort === "low") {
    return { verdict: "defer it", reasoning: "Low impact even though effort is low — focus on higher-impact work first." };
  }

  return { verdict: "cut it", reasoning: "Low impact relative to effort — does not justify the cost." };
}

export function registerEvaluateFeature(server: McpServer): void {
  registerAppTool(
    server,
    "hive_evaluate_feature",
    {
      description: "Evaluate whether a proposed feature is worth building. Analyzes alignment with project goals, effort vs. impact, and returns a recommendation.",
      _meta: { ui: { resourceUri: "ui://hive/feature-evaluator" } },
      inputSchema: {
        project: z.string().describe("Project slug"),
        feature: z.string().describe("Feature description (natural language)"),
        reasoning: z.string().optional().describe("Why you think this feature is needed"),
      },
    },
    async ({ project, feature, reasoning }) => {
      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(join(HIVE_DIRS.projects, safeName(project), "architecture.yaml"));
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      // Check for matching patterns that could accelerate the feature
      const matchingPatterns: string[] = [];
      try {
        const index = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
        const featureTerms = feature.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
        for (const entry of index.patterns) {
          const nameMatch = featureTerms.some((term) => entry.name.toLowerCase().includes(term));
          const tagMatch = entry.tags.some((tag) => featureTerms.includes(tag.toLowerCase()));
          if (nameMatch || tagMatch) {
            matchingPatterns.push(entry.name);
          }
        }
      } catch {
        // No patterns registered
      }

      // Analyze alignment
      const { score, classification, supports, irrelevant } = assessAlignment(feature, architecture);

      // Analyze effort and impact
      const effort = assessEffort(feature, architecture.components.length);
      const impact = assessImpact(classification, supports);
      const ratio = effort === impact ? "neutral" as const :
        (effort === "low" && impact !== "low") || (effort === "medium" && impact === "high") ? "favorable" as const :
        "unfavorable" as const;

      // Derive verdict
      const { verdict, reasoning: verdictReasoning, simplified_alternative } = deriveVerdict(classification, effort, impact);

      // Build tradeoffs
      const complexity = effort === "high" ? "Significant — touches multiple components and may require new abstractions." :
        effort === "medium" ? "Moderate — requires changes across a few areas." :
        "Minimal — localized change.";

      const maintenance = classification === "core" ? "Justified — core features need ongoing maintenance." :
        classification === "nice-to-have" ? "Acceptable — but ensure it doesn't grow in scope." :
        "Questionable — non-core features add long-term maintenance cost.";

      const evaluation: FeatureEvaluation = {
        feature,
        alignment: {
          score,
          classification,
          supports_goals: supports,
          irrelevant_to_goals: irrelevant,
        },
        effort_impact: {
          estimated_effort: effort,
          estimated_impact: impact,
          ratio,
        },
        matching_patterns: matchingPatterns,
        tradeoffs: {
          complexity_added: complexity,
          maintenance_burden: maintenance,
        },
        recommendation: {
          verdict,
          reasoning: reasoning ? `${verdictReasoning} User context: ${reasoning}` : verdictReasoning,
          simplified_alternative,
        },
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(evaluation, null, 2),
          },
        ],
      };
    },
  );
}

/**
 * Hive UI — shared view types
 *
 * Re-exports server types and defines composite types that match
 * the actual JSON shapes returned by tool handlers.
 */

// Re-export pure TS interfaces from server types (no Node imports)
export type {
  Idea,
  Evaluation,
} from "../../server/types/idea.js";

export type {
  Architecture,
  Component,
  DataFlow,
  Decision,
  DecisionLog,
  ApiEndpoint,
  ApiContract,
} from "../../server/types/architecture.js";

export type {
  Pattern,
  PatternFile,
  PatternLineageEntry,
  PatternIndexEntry,
} from "../../server/types/pattern.js";

export type {
  DependencyMeta,
  DependencyExport,
  DependencySurface,
  CommonPattern,
} from "../../server/types/dependency.js";

export type {
  Antipattern,
} from "../../server/types/antipattern.js";

// ── Composite view data types ────────────────────────────────
// These match the actual JSON.stringify'd shapes returned by tool handlers.

import type { Evaluation } from "../../server/types/idea.js";
import type { Architecture, Decision } from "../../server/types/architecture.js";
import type { Pattern } from "../../server/types/pattern.js";

/** evaluate-idea tool return shape */
export interface IdeaEvaluationData {
  idea: {
    name: string;
    slug: string;
    problem: string;
    audience: string;
    status: string;
  };
  evaluation: Evaluation;
}

/** list-ideas tool return shape */
export interface IdeaListItem {
  name: string;
  slug: string;
  status: string;
  problem: string;
  audience?: string;
  verdict?: string;
  feasibility_score?: number;
  estimated_sessions?: number;
  created: string;
}

/** get-architecture tool return shape */
export interface ArchitectureViewData {
  architecture: Architecture;
  decisions: Decision[];
}

/** check-progress tool return shape */
export interface ComponentProgress {
  name: string;
  type: string;
  description: string;
  status: "built" | "in_progress" | "missing";
  expected_files: string[];
  found_files: string[];
  missing_files: string[];
}

export interface ProgressData {
  project: string;
  built: ComponentProgress[];
  in_progress: ComponentProgress[];
  missing: ComponentProgress[];
  coverage_pct: number;
}

/** evaluate-feature tool return shape */
export interface FeatureEvaluationData {
  feature: string;
  alignment: {
    score: number;
    classification: "core" | "nice-to-have" | "bloat" | "distraction";
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
    verdict: "build it" | "defer it" | "cut it" | "simplify it";
    reasoning: string;
    simplified_alternative?: string;
  };
}

/** scaffold-project tool return shape */
export interface ScaffoldFile {
  path: string;
  type: "file" | "directory";
}

export interface ScaffoldData {
  message: string;
  project_path: string;
  hive_project: string;
  stack?: { name: string; description: string };
  files_created: number;
  files: ScaffoldFile[];
}

/** search-knowledge tool return shape */
export interface SearchResult {
  type: "pattern" | "dependency" | "decision" | "architecture";
  name: string;
  relevance: number;
  summary: string;
  data: unknown;
}

export interface SearchResultsData {
  query: string;
  total_results: number;
  results: SearchResult[];
}

/** find-patterns tool return type is Pattern[] directly */
export type PatternGalleryData = Pattern[];

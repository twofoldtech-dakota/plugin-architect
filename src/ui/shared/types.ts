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
import type { ProjectStatusCard, WhatsNextRecommendation } from "../../server/types/fleet.js";
import type { BacklogItem, BacklogItemType, BacklogPriority, BacklogStatus } from "../../server/types/lifecycle.js";
import type { PatternHealthReport } from "../../server/types/retrospective.js";

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

// ── Re-exports for dashboard views ───────────────────────────

export type {
  ProjectStatusCard,
  WhatsNextRecommendation,
} from "../../server/types/fleet.js";

export type {
  BacklogItem,
  BacklogItemType,
  BacklogPriority,
  BacklogStatus,
} from "../../server/types/lifecycle.js";

export type {
  PatternHealthEntry,
  PatternHealthReport,
} from "../../server/types/retrospective.js";

// ── New view data types ──────────────────────────────────────

/** fleet-status tool return shape */
export interface FleetDashboardData {
  projects: ProjectStatusCard[];
  summary: {
    total_projects: number;
    healthy: number;
    unhealthy: number;
    total_monthly_cost: number;
    total_monthly_revenue: number;
    net_monthly: number;
  };
}

/** revenue-dashboard tool return shape */
export interface RevenueDashboardData {
  period: string;
  totals: {
    total_mrr: number;
    total_arr: number;
    total_customers: number;
    churn_rate: number;
    ltv: number;
  };
  comparison?: {
    mrr_change: number;
    mrr_change_pct: number;
    customer_change: number;
  };
  products: {
    project: string;
    mrr: number;
    customers: number;
    churn_rate: number;
    ltv: number;
    growth_rate: number;
    contribution_pct: number;
    plan_breakdown?: { plan: string; customers: number; mrr: number }[];
    trend: "up" | "down" | "flat";
  }[];
  top_growing: { project: string; growth_rate: number }[];
  needs_attention: { project: string; reasons: string[] }[];
  revenue_by_day: { date: string; mrr: number; customers: number }[];
}

/** whats-next tool return shape */
export interface PriorityQueueData {
  available_time: "quick" | "session" | "deep";
  focus?: string;
  total_recommendations: number;
  recommendations: WhatsNextRecommendation[];
}

/** get-backlog tool return shape */
export interface BacklogBoardData {
  items: BacklogItem[];
  summary: {
    total: number;
    by_type: Record<BacklogItemType, number>;
    by_priority: Record<BacklogPriority, number>;
  };
}

/** financial-summary tool return shape */
export interface PnlViewData {
  period: string;
  revenue: {
    total: number;
    recurring: number;
    one_time: number;
  };
  expenses: {
    total: number;
    by_category: Record<string, number>;
  };
  profit: number;
  margin_pct: number;
  runway?: string;
  customers: number;
  per_product: {
    project: string;
    revenue: number;
    recurring: number;
    one_time: number;
    customers: number;
    cost: number;
    profit: number;
    profitable: boolean;
  }[];
  most_profitable?: { project: string; profit: number };
  least_profitable?: { project: string; profit: number };
  recommendations: string[];
}

/** pattern-health tool return shape (mirrors PatternHealthReport) */
export type PatternHealthData = PatternHealthReport;

/** knowledge-gaps tool return shape */
export interface GapRadarData {
  scope: string;
  unregistered_patterns: {
    suggested_name: string;
    evidence: string[];
    found_in_projects: string[];
  }[];
  unregistered_deps: {
    name: string;
    used_in_projects: string[];
  }[];
  potential_antipatterns: {
    description: string;
    evidence: string;
    projects: string[];
  }[];
  summary: string;
}

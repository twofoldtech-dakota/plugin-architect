// ---- Retrospective ----

export interface PatternUsageRecord {
  name: string;
  slug: string;
  worked: boolean;
  notes?: string;
}

export interface Retrospective {
  project: string;
  created: string;
  planning_accuracy: {
    planned_components: number;
    actual_components: number;
    scope_change_pct: number;
  };
  pattern_reuse: {
    patterns_used: PatternUsageRecord[];
    reuse_rate: number;
  };
  knowledge_usage: {
    pre_registered_deps_used: number;
    new_deps_added: number;
    decisions_informed_by_history: number;
    hallucinations_caught: number;
  };
  lessons: string[];
  scores: {
    speed: number;
    quality: number;
    knowledge_growth: number;
    overall: number;
  };
}

// ---- Pattern Health ----

export interface PatternHealthEntry {
  slug: string;
  name: string;
  total_uses: number;
  recent_uses: number;
  modification_rate: number;
  staleness: "fresh" | "aging" | "stale";
  confidence: "high" | "medium" | "low";
  last_used?: string;
  recommendations: string[];
}

export interface PatternHealthReport {
  patterns: PatternHealthEntry[];
  summary: {
    total: number;
    fresh: number;
    aging: number;
    stale: number;
    avg_confidence: number;
  };
  updated: string;
}

// ---- Estimates ----

export interface EstimateRecord {
  project: string;
  description: string;
  estimated_sessions: number;
  actual_sessions?: number;
  components: number;
  stack?: string;
  pattern_coverage: number;
  date: string;
}

export interface EstimatesHistory {
  estimates: EstimateRecord[];
}

// ---- Tool Usage Metrics ----

export interface ToolUsageEntry {
  tool: string;
  calls: number;
  avg_duration_ms: number;
  error_count: number;
  last_used: string;
}

export interface ToolUsageMetrics {
  entries: ToolUsageEntry[];
  updated: string;
}

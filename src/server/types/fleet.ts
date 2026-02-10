// ---- Fleet Topology ----

export interface FleetHost {
  name: string;
  provider: string;
  type: string;
  projects: string[];
  specs?: Record<string, string>;
}

export interface FleetDomain {
  name: string;
  registrar: string;
  dns?: string;
  expiry?: string;
  projects: string[];
}

export interface FleetTopology {
  hosts: FleetHost[];
  domains: FleetDomain[];
}

// ---- Fleet Costs ----

export interface FleetCostEntry {
  name: string;
  category: "hosting" | "apis" | "domains" | "tools" | "other";
  provider: string;
  amount: number;
  period: "monthly" | "yearly";
  currency?: string;
  projects?: string[];
}

export interface FleetCosts {
  entries: FleetCostEntry[];
}

// ---- Fleet Priorities ----

export interface FleetPriority {
  project: string;
  score: number;
  reasons: string[];
}

export interface FleetPriorities {
  priorities: FleetPriority[];
  computed_at: string;
}

// ---- Fleet Status (output) ----

export interface ProjectStatusCard {
  project: string;
  status: string;
  health?: "green" | "yellow" | "red" | "unknown";
  recent_errors: number;
  usage_trend?: "up" | "down" | "flat" | "unknown";
  last_deploy?: string;
  monthly_cost: number;
  monthly_revenue: number;
}

// ---- Revenue ----

export interface RevenueEntry {
  date: string;
  amount: number;
  customers?: number;
  source?: string;
}

export interface RevenueConfig {
  model?: string;
  entries: RevenueEntry[];
  summary?: {
    mrr: number;
    total: number;
    customers?: number;
    trend?: "up" | "down" | "flat";
  };
}

// ---- Revenue Snapshots (Phase 12) ----

export interface PlanBreakdown {
  plan: string;
  customers: number;
  mrr: number;
}

export interface RevenueSnapshot {
  date: string;
  total_mrr: number;
  total_arr: number;
  total_customers: number;
  churn_rate?: number;
  ltv?: number;
  products: {
    project: string;
    mrr: number;
    customers: number;
    churn_rate?: number;
    ltv?: number;
    plan_breakdown?: PlanBreakdown[];
  }[];
}

// ---- Experiments (Phase 12) ----

export interface ExperimentVariant {
  name: string;
  description?: string;
  traffic_pct: number;
}

export interface ExperimentResult {
  variant: string;
  visitors: number;
  conversions: number;
  revenue?: number;
  conversion_rate?: number;
}

export interface ExperimentConfig {
  id: string;
  project: string;
  type: "pricing" | "landing_page" | "feature_flag";
  hypothesis: string;
  variants: ExperimentVariant[];
  duration_days: number;
  status: "created" | "running" | "completed" | "cancelled";
  started: string;
  ends: string;
  results?: ExperimentResult[];
  winner?: string;
  confidence?: number;
}

// ---- Pricing Analysis (Phase 12) ----

export interface PricingRecommendation {
  action: "raise_price" | "lower_price" | "add_tier" | "remove_tier" | "change_limits";
  target: string;
  current?: string | number;
  proposed?: string | number;
  reasoning: string;
  estimated_impact: {
    mrr_change: number;
    customer_change: number;
    confidence: "high" | "medium" | "low";
  };
}

// ---- Growth Signals (Phase 12) ----

export interface GrowthSignal {
  project: string;
  classification: "accelerating" | "decelerating" | "stable";
  growth_rate: number;
  signals: string[];
}

export interface GrowthRecommendation {
  project: string;
  action: string;
  reasoning: string;
  priority: "high" | "medium" | "low";
}

// ---- Whats Next ----

export interface WhatsNextRecommendation {
  project: string;
  action: string;
  reason: string;
  score: number;
  effort: "trivial" | "small" | "medium" | "large";
  source: "error" | "backlog" | "usage" | "health" | "maintenance";
}

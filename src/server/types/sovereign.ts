// ---- Maintenance ----

export interface MaintenanceRule {
  id: string;
  name: string;
  type: "command" | "hive_tool";
  /** Shell command or hive tool name to execute. */
  target: string;
  /** Tool args (JSON) if type is hive_tool. */
  args?: Record<string, unknown>;
  /** Cron-like schedule description (e.g., "weekly", "daily", "monthly"). */
  schedule: string;
  /** Projects this rule applies to. Empty = all projects. */
  applies_to: string[];
  /** If true, auto-apply fixes when action_needed. */
  auto_apply: boolean;
  last_run?: string;
}

export interface MaintenanceSchedule {
  rules: MaintenanceRule[];
}

export interface MaintenanceResult {
  rule_id: string;
  rule_name: string;
  date: string;
  status: "ok" | "action_needed" | "failed";
  output?: string;
  error?: string;
  action_taken?: string;
}

export interface MaintenanceLog {
  results: MaintenanceResult[];
}

// ---- Idea Pipeline ----

export interface IdeaPipelineEntry {
  slug: string;
  name: string;
  status: string;
  capability_score: number;
  pattern_coverage: number;
  estimated_sessions: number;
  priority_score: number;
  recommendation: "build_next" | "build_soon" | "park" | "needs_evaluation";
}

// ---- Autonomy ----

export interface AutonomySession {
  session_id: string;
  project: string;
  status: "running" | "paused" | "awaiting_approval" | "completed" | "failed";
  current_step?: string;
  progress: string;
  risk_level: "low" | "medium" | "high";
  pending_action?: string;
  started: string;
  updated: string;
}

export interface AutonomyState {
  sessions: AutonomySession[];
}

// ---- Export ----

export interface ExportManifest {
  export_date: string;
  scope: string[];
  format: string;
  counts: {
    patterns: number;
    dependencies: number;
    decisions: number;
    stacks: number;
    antipatterns: number;
  };
  file_path: string;
}

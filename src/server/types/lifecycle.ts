// ---- Deploy ----

export interface DeployTarget {
  command: string;
  directory?: string;
  environment_vars?: Record<string, string>;
  pre_deploy?: string[];
}

export interface DeployRecord {
  id: string;
  date: string;
  status: "success" | "failed" | "dry_run";
  duration_ms?: number;
  version?: string;
  commit?: string;
  url?: string;
  error?: string;
  notes?: string;
}

export interface DeployConfig {
  target: DeployTarget;
  history: DeployRecord[];
}

// ---- Health ----

export interface HealthCheck {
  name: string;
  type: "http" | "command";
  target: string; // URL for http, command string for command
  timeout_ms?: number;
  expected_status?: number; // for http checks
  expected_output?: string; // for command checks
}

export interface HealthCheckResult {
  name: string;
  status: "green" | "yellow" | "red";
  response_time_ms?: number;
  error?: string;
  checked_at: string;
}

export interface HealthResult {
  overall: "green" | "yellow" | "red";
  checks: HealthCheckResult[];
  checked_at: string;
}

export interface HealthConfig {
  checks: HealthCheck[];
  results: HealthResult[];
}

// ---- Errors ----

export interface ErrorEntry {
  id: string;
  date: string;
  severity: "critical" | "error" | "warning";
  message: string;
  count: number;
  source?: string;
  resolved: boolean;
  resolved_date?: string;
  resolution?: string;
}

export interface ErrorsConfig {
  source_command?: string;
  entries: ErrorEntry[];
}

// ---- Usage ----

export interface UsageEntry {
  date: string;
  requests?: number;
  visitors?: number;
  error_rate?: number;
  custom?: Record<string, number>;
}

export interface UsageTrend {
  direction: "up" | "down" | "flat";
  change_pct: number;
}

export interface UsageConfig {
  source_command?: string;
  entries: UsageEntry[];
  trend?: UsageTrend;
}

// ---- Backlog ----

export type BacklogItemType = "bug" | "improvement" | "idea" | "maintenance";
export type BacklogPriority = "critical" | "high" | "medium" | "low";
export type BacklogStatus = "open" | "in_progress" | "done" | "wont_fix";

export interface BacklogItem {
  id: string;
  type: BacklogItemType;
  title: string;
  description?: string;
  priority: BacklogPriority;
  status: BacklogStatus;
  source?: string;
  created: string;
  updated?: string;
}

export interface BacklogConfig {
  items: BacklogItem[];
}

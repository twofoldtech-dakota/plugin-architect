// ---- Telemetry ----

export interface TelemetryEntry {
  tool: string;
  args?: Record<string, unknown>;
  duration_ms: number;
  outcome: "success" | "error" | "ignored";
  user_action?: string;
  session: string;
  date: string;
}

export interface TelemetryLog {
  entries: TelemetryEntry[];
}

// ---- Evolution ----

export interface EvolutionEntry {
  id: string;
  date: string;
  type: "new_tool" | "refactor_tool" | "remove_tool" | "schema_change" | "ui_change";
  proposal_id: string;
  description: string;
  files_changed: EvolutionFileChange[];
  rollback_version: string;
  outcome: "applied" | "rolled_back" | "failed";
}

export interface EvolutionFileChange {
  path: string;
  action: "created" | "modified" | "deleted";
  previous_content?: string;
}

export interface EvolutionLog {
  entries: EvolutionEntry[];
}

// ---- Proposals ----

export type ProposalType = "new_tool" | "refactor_tool" | "remove_tool" | "schema_change" | "ui_change";
export type ProposalStatus = "pending" | "approved" | "rejected" | "applied";

export interface ProposalEvidence {
  tool_calls_analyzed: number;
  pattern_detected?: string;
  time_saved_per_call?: number;
}

export interface Proposal {
  id: string;
  type: ProposalType;
  status: ProposalStatus;
  target?: string;
  name: string;
  description: string;
  reasoning: string;
  input_schema?: Record<string, unknown>;
  output?: string;
  implementation_plan?: string[];
  estimated_effort: string;
  affected_tools?: string[];
  affected_ui?: string[];
  evidence: ProposalEvidence;
  created: string;
}

// ---- Audit ----

export interface ToolUsageStat {
  tool: string;
  calls: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  used_pct: number;
  ignored_pct: number;
  error_pct: number;
}

export interface RepeatedPattern {
  description: string;
  occurrences: number;
  suggested_tool_name: string;
}

export interface AuditResult {
  period: string;
  total_calls: number;
  tool_usage: ToolUsageStat[];
  unused_tools: string[];
  slow_tools: Array<{ tool: string; p95_duration_ms: number }>;
  repeated_patterns: RepeatedPattern[];
  proposals_generated: number;
  health_score: number;
}

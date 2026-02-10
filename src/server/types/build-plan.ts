/** A single atomic unit of work in a build plan. */
export interface BuildTask {
  id: string;
  name: string;
  description: string;
  /** Task IDs that must complete before this one can start. */
  depends_on: string[];
  status: "pending" | "in_progress" | "completed" | "failed" | "rolled_back";
  /** Component name from the architecture this task builds. */
  component?: string;
  /** Files expected to be created or modified. */
  expected_files: string[];
  /** Actual file changes recorded after execution. */
  file_changes: FileChange[];
  started?: string;
  completed?: string;
  /** Error message if the task failed. */
  error?: string;
}

/** A grouping of related tasks executed together. */
export interface BuildPhase {
  id: string;
  name: string;
  description: string;
  tasks: BuildTask[];
  status: "pending" | "in_progress" | "completed" | "failed";
  /** Whether a checkpoint review is required after this phase completes. */
  checkpoint: boolean;
}

/** Tracks a single file creation, modification, or deletion for rollback. */
export interface FileChange {
  path: string;
  action: "created" | "modified" | "deleted";
  /** Previous file content (for modified/deleted files), enables rollback. */
  previous_content?: string;
}

/** The full build plan for a project, persisted to build-plan.yaml. */
export interface BuildPlan {
  project: string;
  description: string;
  created: string;
  updated: string;
  status: "planning" | "in_progress" | "paused" | "completed" | "failed";
  /** The current phase index (0-based). */
  current_phase: number;
  phases: BuildPhase[];
  /** Session tracking — which Claude Code session last touched this plan. */
  session_id: string;
}

/** A single atomic unit of work in a build plan. */
export interface BuildTask {
  id: string;
  name: string;
  description: string;
  depends_on: string[];
  status: "pending" | "in_progress" | "completed" | "failed" | "rolled_back";
  component?: string;
  expected_files: string[];
  file_changes: FileChange[];
  started?: string;
  completed?: string;
  error?: string;
}

/** A grouping of related tasks executed together. */
export interface BuildPhase {
  id: string;
  name: string;
  description: string;
  tasks: BuildTask[];
  status: "pending" | "in_progress" | "completed" | "failed";
  checkpoint: boolean;
}

/** Tracks a single file creation, modification, or deletion for rollback. */
export interface FileChange {
  path: string;
  action: "created" | "modified" | "deleted";
  previous_content?: string;
}

/** The full build plan for a project. */
export interface BuildPlan {
  id?: string;
  project_id?: string;
  project: string;
  description: string;
  created: string;
  updated: string;
  status: "planning" | "in_progress" | "paused" | "completed" | "failed";
  current_phase: number;
  phases: BuildPhase[];
  session_id: string;
}

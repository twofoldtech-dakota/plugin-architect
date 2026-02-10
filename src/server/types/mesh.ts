// ---- Mesh Identity ----

export type TrustLevel = "unknown" | "known" | "verified" | "trusted";

export interface MeshIdentity {
  peer_id: string;
  display_name: string;
  public_key: string;
  specialties: string[];
  reputation_score: number;
  joined: string;
  status: "connected" | "disconnected";
}

export interface MeshSettings {
  share_patterns: boolean;
  share_anti_patterns: boolean;
  share_benchmarks: boolean;
  accept_delegations: boolean;
  auto_merge_anti_patterns: boolean;
}

// ---- Mesh Peers ----

export interface MeshPeer {
  peer_id: string;
  display_name: string;
  specialties: string[];
  reputation_score: number;
  patterns_exchanged: number;
  trust_level: TrustLevel;
  last_seen: string;
}

// ---- Shared Knowledge ----

export interface SharedPattern {
  mesh_id: string;
  original_slug: string;
  name: string;
  description: string;
  tags: string[];
  stack?: string[];
  file_structure: string[]; // file names only, no source code
  exports: string[]; // exported interfaces/functions (structural only)
  shared_by: string; // peer_id
  shared_at: string;
  adoptions: number;
  rating: number;
}

export interface SharedAntiPattern {
  mesh_id: string;
  name: string;
  description: string;
  context: string;
  why_bad: string;
  instead: string;
  tags: string[];
  severity: "critical" | "warning" | "minor";
  shared_by: string;
  shared_at: string;
  reporters: number;
}

export interface SharedBenchmark {
  mesh_id: string;
  stack: string[];
  satisfaction: number; // 1-5
  pain_points: string[];
  praise: string[];
  migration_from?: string[];
  migration_to?: string[];
  shared_by: string;
  shared_at: string;
}

// ---- Delegations ----

export type DelegationStatus = "searching" | "assigned" | "in_progress" | "completed" | "failed" | "cancelled";

export interface MeshDelegation {
  id: string;
  description: string;
  required_specialties: string[];
  budget_tokens?: number;
  deadline?: string;
  prefer_peer?: string;
  status: DelegationStatus;
  assigned_to?: {
    peer_id: string;
    display_name: string;
    reputation: number;
    specialties: string[];
    estimated_completion?: string;
  };
  result?: {
    output: string;
    files?: string[];
    quality_rating?: number;
  };
  cost_tokens?: number;
  created: string;
  updated: string;
}

// ---- Reputation ----

export type ReputationRank = "newcomer" | "contributor" | "expert" | "authority";

export interface ReputationEvent {
  date: string;
  event: string;
  reputation_change: number;
}

export interface ReputationContributions {
  patterns_shared: number;
  adoptions_of_your_patterns: number;
  anti_patterns_contributed: number;
  delegations_completed: number;
  delegations_failed: number;
  average_rating_received: number;
}

export interface MeshReputation {
  peer_id: string;
  display_name: string;
  reputation_score: number;
  rank: ReputationRank;
  specialties: string[];
  contributions: ReputationContributions;
  history: ReputationEvent[];
}

export interface Idea {
  id?: string;
  name: string;
  slug: string;
  description: string;
  problem: string;
  audience: string;
  proposed_solution: string;
  assumptions: string[];
  open_questions: string[];
  status: "raw" | "evaluated" | "approved" | "rejected" | "parked";
  competitive_landscape?: string;
  market_data?: string;
  research_links?: string;
  signals?: string;
  skill_fit?: string;
  created: string;
  updated: string;
  evaluation?: Evaluation;
}

export interface Evaluation {
  id?: string;
  idea_id?: string;
  feasibility: {
    score: number;
    has_patterns: boolean;
    known_stack: boolean;
    estimated_sessions: number;
    unknowns: string[];
  };
  competitive: {
    exists_already: boolean;
    differentiator: string;
    references: string[];
  };
  scope: {
    mvp_definition: string;
    mvp_components: string[];
    deferred: string[];
    full_vision: string;
  };
  verdict: "build" | "park" | "kill" | "needs_more_thinking";
  reasoning: string;
  created?: string;
}

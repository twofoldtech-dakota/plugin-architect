export interface Component {
  name: string;
  type: string;
  description: string;
  files: string[];
  dependencies: string[];
  schema?: {
    tables?: Array<{
      name: string;
      columns: Array<{ name: string; type: string; primary?: boolean; unique?: boolean }>;
    }>;
  };
}

export interface DataFlow {
  name: string;
  steps: string[];
}

export interface Architecture {
  project: string;
  description: string;
  created: string;
  updated: string;
  status: "ideation" | "planning" | "building" | "shipping" | "archived";
  stack: Record<string, string>;
  components: Component[];
  data_flows: DataFlow[];
  file_structure: Record<string, unknown>;
}

export interface Decision {
  id: string;
  project_id?: string;
  date: string;
  component: string;
  decision: string;
  reasoning: string;
  alternatives_considered?: string[];
  revisit_when?: string;
}

export interface DecisionLog {
  decisions: Decision[];
}

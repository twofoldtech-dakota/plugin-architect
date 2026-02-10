export interface Antipattern {
  name: string;
  slug: string;
  description: string;
  context: string;
  why_bad: string;
  instead: string;
  tags: string[];
  severity: "critical" | "warning" | "minor";
  learned_from?: string;
  created: string;
}

export interface AntipatternIndexEntry {
  slug: string;
  name: string;
  tags: string[];
  severity: "critical" | "warning" | "minor";
}

export interface AntipatternIndex {
  antipatterns: AntipatternIndexEntry[];
}

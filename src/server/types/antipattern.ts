export interface Antipattern {
  id?: string;
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

export interface PatternFile {
  path: string;
  content: string;
}

export interface PatternLineageEntry {
  version: number;
  date: string;
  project: string;
  changes: string;
}

export interface Pattern {
  id?: string;
  name: string;
  slug: string;
  description: string;
  tags: string[];
  stack?: string[];
  verified: boolean;
  created: string;
  used_in: string[];
  files: PatternFile[];
  notes?: string;
  version?: number;
  lineage?: PatternLineageEntry[];
}

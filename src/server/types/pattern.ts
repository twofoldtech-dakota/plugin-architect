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

export interface PatternIndexEntry {
  slug: string;
  name: string;
  tags: string[];
}

export interface PatternIndex {
  patterns: PatternIndexEntry[];
}

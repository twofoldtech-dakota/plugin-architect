export interface DependencyMeta {
  name: string;
  version: string;
  fetched: string;
  source?: string;
}

export interface DependencyExport {
  name: string;
  type: string;
  signature: string;
  description: string;
}

export interface CommonPattern {
  name: string;
  code: string;
}

export interface DependencySurface {
  name: string;
  version: string;
  exports?: DependencyExport[];
  column_types?: string[];
  common_patterns?: CommonPattern[];
  gotchas?: string[];
}

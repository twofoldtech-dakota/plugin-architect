// ---- Launch Playbook ----

export interface LaunchAsset {
  type: "landing_page" | "readme" | "tweets" | "product_hunt" | "email" | "changelog";
  content: string;
  source_components?: string[];
}

export interface LaunchPlaybook {
  project: string;
  tone: "technical" | "casual" | "professional";
  generated: string;
  assets: LaunchAsset[];
}

// ---- Content ----

export interface ContentPiece {
  id: string;
  project: string;
  type: "blog_post" | "tutorial" | "documentation" | "comparison" | "case_study";
  title: string;
  body: string;
  meta: {
    description: string;
    keywords: string[];
    word_count: number;
    reading_time_min: number;
  };
  code_examples?: Array<{
    code: string;
    language?: string;
    source_file?: string;
  }>;
  internal_links?: string[];
  suggested_publish_date?: string;
  created: string;
}

// ---- Content Calendar ----

export interface ContentCalendarEntry {
  id: string;
  project: string;
  type: string;
  title: string;
  scheduled: string;
  status: "planned" | "drafted" | "published" | "cancelled";
  channel?: string;
}

export interface ContentCalendar {
  entries: ContentCalendarEntry[];
}

// ---- Campaigns ----

export interface CampaignPiece {
  day: number;
  channel: "email" | "twitter" | "blog" | "landing_page";
  content: string;
  scheduled_time?: string;
}

export interface CampaignConfig {
  id: string;
  project: string;
  brief: string;
  channels: string[];
  duration_days: number;
  timeline: CampaignPiece[];
  total_pieces: number;
  estimated_reach?: number;
  tracking_setup?: string;
  status: "draft" | "active" | "completed" | "cancelled";
  created: string;
}

// ---- Content Performance Analytics ----

export interface ContentPerformanceEntry {
  content_id: string;
  title: string;
  project: string;
  type: string;
  channel?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_attributed: number;
  date: string;
}

export interface ContentPerformance {
  entries: ContentPerformanceEntry[];
}

// ---- Messaging Effectiveness ----

export interface MessagingEntry {
  angle: string;
  channel: string;
  conversion_rate: number;
  sample_size: number;
  date: string;
}

export interface MessagingEffectiveness {
  entries: MessagingEntry[];
}

// ---- Changelog ----

export interface ChangelogEntry {
  version?: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
  removed: string[];
  highlights?: string;
  source_commits?: string[];
  source_decisions?: string[];
}

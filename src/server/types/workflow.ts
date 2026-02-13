// ---- Workflow Journal ----

export type WorkflowEntryType = "conversation_summary" | "learning" | "accomplishment" | "note";

export type WorkflowMood = "great" | "good" | "neutral" | "tough";

export interface WorkflowEntry {
  id: string;
  type: WorkflowEntryType;
  title: string;
  content: string;
  tags: string[];
  project?: string;
  mood?: WorkflowMood;
  published: boolean;
  published_at?: string;
  created: string;
  updated: string;
}

// ---- JSON Feed v1.1 Export ----

export interface WorkflowFeedItem {
  id: string;
  title: string;
  content_text: string;
  date_published: string;
  date_modified: string;
  tags?: string[];
  _hive: {
    type: WorkflowEntryType;
    project?: string;
    mood?: WorkflowMood;
  };
}

export interface WorkflowJsonFeed {
  version: "https://jsonfeed.org/version/1.1";
  title: string;
  home_page_url?: string;
  feed_url?: string;
  items: WorkflowFeedItem[];
}

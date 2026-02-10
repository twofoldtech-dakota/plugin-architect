/**
 * Search Results — Hive MCP App
 *
 * Displays results from hive_search_knowledge with tab-based
 * filtering by result type, re-search capability, and expandable
 * detail views for each result.
 *
 * Tool: hive_search_knowledge
 */

import { createRoot } from "react-dom/client";
import { useState, useMemo } from "react";
import { useHiveApp } from "../../shared/hooks";
import {
  Card,
  Badge,
  TabBar,
  SearchBar,
  ScoreDots,
  Expandable,
  CodeBlock,
  LoadingState,
  EmptyState,
  ErrorState,
} from "../../shared/react-components";
import type { SearchResultsData, SearchResult } from "../../shared/types";
import "../../shared/styles.css";
import "../../shared/components.css";

// ── Type badge color mapping ────────────────────────────────

function typeBadgeVariant(
  type: SearchResult["type"],
): "info" | "success" | "warning" | "neutral" {
  switch (type) {
    case "pattern":
      return "info";
    case "dependency":
      return "success";
    case "decision":
      return "warning";
    case "architecture":
      return "neutral";
    default:
      return "neutral";
  }
}

// ── Relevance to score (1-5 scale) ─────────────────────────

function relevanceToScore(relevance: number): number {
  // relevance is typically 0-1, map to 1-5
  return Math.max(1, Math.min(5, Math.round(relevance * 5)));
}

function relevanceColor(
  relevance: number,
): "success" | "warning" | "error" {
  if (relevance >= 0.7) return "success";
  if (relevance >= 0.4) return "warning";
  return "error";
}

// ── SearchResultCard ────────────────────────────────────────

function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <Card className="search-result-card">
      <div className="hive-flex hive-items-center hive-gap-sm hive-flex-wrap">
        <Badge label={result.type} variant={typeBadgeVariant(result.type)} />
        <strong className="hive-text-sm">{result.name}</strong>
        <div style={{ marginLeft: "auto" }}>
          <ScoreDots
            score={relevanceToScore(result.relevance)}
            max={5}
            color={relevanceColor(result.relevance)}
          />
        </div>
      </div>
      <p className="hive-text-sm hive-text-muted hive-mt-sm">
        {result.summary}
      </p>
      <div className="hive-mt-sm">
        <Expandable title="Details">
          <CodeBlock
            code={JSON.stringify(result.data, null, 2)}
            filename={`${result.type}/${result.name}`}
          />
        </Expandable>
      </div>
    </Card>
  );
}

// ── Tab definitions ─────────────────────────────────────────

const ALL_TAB = "all";
const TYPE_TABS: { id: string; label: string; type?: SearchResult["type"] }[] = [
  { id: ALL_TAB, label: "All" },
  { id: "pattern", label: "Patterns", type: "pattern" },
  { id: "dependency", label: "Dependencies", type: "dependency" },
  { id: "decision", label: "Decisions", type: "decision" },
  { id: "architecture", label: "Architectures", type: "architecture" },
];

// ── Main App ────────────────────────────────────────────────

function SearchResults() {
  const { data, isLoading, error, callTool } =
    useHiveApp<SearchResultsData>("search-results");

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState(ALL_TAB);

  // Count results by type
  const counts = useMemo(() => {
    if (!data) return {};
    const c: Record<string, number> = { [ALL_TAB]: data.results.length };
    for (const r of data.results) {
      c[r.type] = (c[r.type] ?? 0) + 1;
    }
    return c;
  }, [data]);

  // Build tab data with counts
  const tabs = useMemo(
    () =>
      TYPE_TABS.map((t) => ({
        id: t.id,
        label: t.label,
        count: counts[t.id] ?? 0,
      })),
    [counts],
  );

  // Filter results by active tab
  const filteredResults = useMemo(() => {
    if (!data) return [];
    if (activeTab === ALL_TAB) return data.results;
    return data.results.filter((r) => r.type === activeTab);
  }, [data, activeTab]);

  const handleSearch = () => {
    if (!query.trim()) return;
    callTool("hive_search_knowledge", { query: query.trim() });
  };

  if (isLoading) return <LoadingState message="Searching..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message="No search results available." />;

  return (
    <div style={{ padding: "var(--hive-space-lg)", maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: "var(--hive-space-sm)" }}>
        Search Results
      </h1>
      <p className="hive-text-sm hive-text-muted" style={{ marginBottom: "var(--hive-space-md)" }}>
        Query: <strong>"{data.query}"</strong> &mdash; {data.total_results} result
        {data.total_results !== 1 ? "s" : ""}
      </p>

      {/* Re-search bar */}
      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={handleSearch}
        placeholder="Search knowledge base..."
      />

      {/* Tab bar */}
      <TabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />

      {/* Results */}
      {filteredResults.length === 0 ? (
        <EmptyState message={`No ${activeTab === ALL_TAB ? "" : activeTab + " "}results found.`} />
      ) : (
        <div className="hive-flex hive-flex-col hive-gap-md">
          {filteredResults.map((r, i) => (
            <SearchResultCard key={`${r.type}-${r.name}-${i}`} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────

const root = createRoot(document.getElementById("root")!);
root.render(<SearchResults />);

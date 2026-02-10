/**
 * Pattern Gallery — Hive MCP App
 *
 * Browsable gallery of registered code patterns with search,
 * tag filtering, and detail view with file contents.
 *
 * Tool: hive_find_patterns
 */

import { createRoot } from "react-dom/client";
import { useState, useMemo } from "react";
import { useHiveApp } from "../../shared/hooks";
import {
  Card,
  Badge,
  Tag,
  Button,
  SearchBar,
  CodeBlock,
  Modal,
  Expandable,
  LoadingState,
  EmptyState,
  ErrorState,
} from "../../shared/react-components";
import type { PatternGalleryData, Pattern } from "../../shared/types";
import "../../shared/styles.css";
import "../../shared/components.css";

// ── PatternCard ─────────────────────────────────────────────

function PatternCard({
  pattern,
  onClick,
}: {
  pattern: Pattern;
  onClick: () => void;
}) {
  const descriptionTruncated =
    pattern.description.length > 120
      ? pattern.description.slice(0, 120) + "..."
      : pattern.description;

  return (
    <Card className="pattern-card" onClick={onClick}>
      <div
        onClick={onClick}
        style={{ cursor: "pointer" }}
      >
        <div className="hive-flex hive-items-center hive-gap-sm hive-flex-wrap">
          <strong>{pattern.name}</strong>
          {pattern.verified && <Badge label="Verified" variant="success" />}
          {pattern.used_in.length > 0 && (
            <Badge
              label={`${pattern.used_in.length} project${pattern.used_in.length !== 1 ? "s" : ""}`}
              variant="neutral"
            />
          )}
        </div>
        <p className="hive-text-muted hive-text-sm hive-mt-sm">
          {descriptionTruncated}
        </p>
        {pattern.tags.length > 0 && (
          <div className="hive-flex hive-flex-wrap hive-gap-xs hive-mt-sm">
            {pattern.tags.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── PatternDetail ───────────────────────────────────────────

function PatternDetail({
  pattern,
  onClose,
}: {
  pattern: Pattern;
  onClose: () => void;
}) {
  return (
    <Modal title={pattern.name} onClose={onClose}>
      <div className="hive-flex hive-items-center hive-gap-sm hive-flex-wrap">
        {pattern.verified && <Badge label="Verified" variant="success" />}
        {pattern.version != null && (
          <Badge label={`v${pattern.version}`} variant="neutral" />
        )}
        {pattern.stack && pattern.stack.length > 0 && (
          <span className="hive-text-sm hive-text-muted">
            Stack: {pattern.stack.join(", ")}
          </span>
        )}
      </div>

      <p className="hive-text-sm hive-mt-md">{pattern.description}</p>

      {pattern.notes && (
        <div className="hive-mt-md">
          <Expandable title="Notes" defaultOpen>
            <p className="hive-text-sm hive-text-muted">{pattern.notes}</p>
          </Expandable>
        </div>
      )}

      {pattern.tags.length > 0 && (
        <div className="hive-flex hive-flex-wrap hive-gap-xs hive-mt-md">
          {pattern.tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>
      )}

      {pattern.used_in.length > 0 && (
        <p className="hive-text-sm hive-text-muted hive-mt-md">
          Used in: {pattern.used_in.join(", ")}
        </p>
      )}

      {/* Files */}
      <div className="hive-flex hive-flex-col hive-gap-md hive-mt-lg">
        {pattern.files.map((file) => (
          <CodeBlock key={file.path} filename={file.path} code={file.content} />
        ))}
      </div>

      {/* Placeholder Apply button */}
      <div className="hive-mt-lg">
        <Button label="Apply Pattern" variant="primary" disabled />
      </div>
    </Modal>
  );
}

// ── Tag filter chips ────────────────────────────────────────

function TagFilter({
  allTags,
  activeTags,
  onToggle,
}: {
  allTags: string[];
  activeTags: Set<string>;
  onToggle: (tag: string) => void;
}) {
  if (allTags.length === 0) return null;

  return (
    <div className="hive-flex hive-flex-wrap hive-gap-xs" style={{ marginBottom: "var(--hive-space-md)" }}>
      {allTags.map((t) => (
        <span
          key={t}
          className={`hive-tag${activeTags.has(t) ? " hive-tag-active" : ""}`}
          style={{
            cursor: "pointer",
            background: activeTags.has(t)
              ? "var(--hive-accent)"
              : undefined,
            color: activeTags.has(t)
              ? "var(--hive-accent-fg)"
              : undefined,
          }}
          onClick={() => onToggle(t)}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────

function PatternGallery() {
  const { data, isLoading, error, callTool } =
    useHiveApp<PatternGalleryData>("pattern-gallery");

  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);

  // Collect unique tags from all patterns
  const allTags = useMemo(() => {
    if (!data) return [];
    const tagSet = new Set<string>();
    for (const p of data) {
      for (const t of p.tags) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }, [data]);

  // Filter patterns by active tags
  const filteredPatterns = useMemo(() => {
    if (!data) return [];
    if (activeTags.size === 0) return data;
    return data.filter((p) => p.tags.some((t) => activeTags.has(t)));
  }, [data, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    callTool("hive_find_patterns", { query: query.trim() });
  };

  if (isLoading) return <LoadingState message="Loading patterns..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message="No pattern data available." />;

  return (
    <div style={{ padding: "var(--hive-space-lg)", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: "var(--hive-space-md)" }}>
        Pattern Gallery
      </h1>

      {/* Search */}
      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={handleSearch}
        placeholder="Search patterns..."
      />

      {/* Tag filter */}
      <TagFilter allTags={allTags} activeTags={activeTags} onToggle={toggleTag} />

      {/* Grid */}
      {filteredPatterns.length === 0 ? (
        <EmptyState message="No patterns match the current filters." />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--hive-space-md)",
          }}
        >
          {filteredPatterns.map((p) => (
            <PatternCard
              key={p.slug}
              pattern={p}
              onClick={() => setSelectedPattern(p)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedPattern && (
        <PatternDetail
          pattern={selectedPattern}
          onClose={() => setSelectedPattern(null)}
        />
      )}
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────

const root = createRoot(document.getElementById("root")!);
root.render(<PatternGallery />);

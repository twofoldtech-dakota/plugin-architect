/**
 * Scaffold Preview — Hive MCP App
 *
 * Displays the result of a scaffold_project operation: success
 * message, stats, and the full file tree of created files.
 *
 * Tool: hive_scaffold_project
 */

import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useHiveApp } from "../../shared/hooks";
import {
  Card,
  StatCard,
  FileTree,
  CodeBlock,
  Badge,
  LoadingState,
  EmptyState,
  ErrorState,
} from "../../shared/react-components";
import type { ScaffoldData } from "../../shared/types";
import "../../shared/styles.css";
import "../../shared/components.css";

// ── StatsBar ────────────────────────────────────────────────

function StatsBar({ data }: { data: ScaffoldData }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "var(--hive-space-md)",
        marginBottom: "var(--hive-space-lg)",
      }}
    >
      <StatCard
        value={data.files_created}
        label="Files Created"
        color="var(--hive-success)"
      />
      <StatCard value={data.hive_project} label="Hive Project" />
      <StatCard
        value={data.files.length}
        label="Total Entries"
        color="var(--hive-info)"
      />
    </div>
  );
}

// ── CopyablePath ────────────────────────────────────────────

function CopyablePath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(path).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ marginBottom: "var(--hive-space-lg)" }}>
      <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
        Project Path
      </span>
      <div
        className="hive-flex hive-items-center hive-gap-sm"
        style={{
          background: "var(--hive-bg-subtle)",
          border: "1px solid var(--hive-border-muted)",
          borderRadius: "var(--hive-radius-md)",
          padding: "var(--hive-space-sm) var(--hive-space-md)",
          fontFamily: "var(--hive-font-mono)",
          fontSize: 12,
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {path}
        </span>
        <button
          type="button"
          className="hive-btn hive-btn-sm"
          onClick={copy}
          style={{ flexShrink: 0 }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────

function ScaffoldPreview() {
  const { data, isLoading, error } =
    useHiveApp<ScaffoldData>("scaffold-preview");

  if (isLoading) return <LoadingState message="Loading scaffold result..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message="No scaffold data available." />;

  return (
    <div style={{ padding: "var(--hive-space-lg)", maxWidth: 800, margin: "0 auto" }}>
      {/* Success header */}
      <div
        className="hive-flex hive-items-center hive-gap-md"
        style={{ marginBottom: "var(--hive-space-lg)" }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Scaffold Complete
        </h1>
        <Badge label="Success" variant="success" />
      </div>

      {/* Message */}
      <Card>
        <p className="hive-text-sm">{data.message}</p>
      </Card>

      <div style={{ marginTop: "var(--hive-space-lg)" }}>
        {/* Stats */}
        <StatsBar data={data} />

        {/* Project path (copyable) */}
        <CopyablePath path={data.project_path} />

        {/* File tree */}
        <Card title="Created Files">
          <FileTree files={data.files} basePath={data.project_path} />
        </Card>
      </div>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────

const root = createRoot(document.getElementById("root")!);
root.render(<ScaffoldPreview />);

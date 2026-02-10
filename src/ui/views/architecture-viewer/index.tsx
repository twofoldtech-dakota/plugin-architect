/**
 * Architecture Viewer — Hive MCP App
 *
 * Displays a project's architecture spec: stack, components,
 * data flows, file structure, and decision history.
 *
 * Tool: hive_get_architecture
 */

import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useHiveApp } from "../../shared/hooks";
import {
  Card,
  Badge,
  TechPill,
  Tag,
  Expandable,
  CodeBlock,
  LoadingState,
  EmptyState,
  ErrorState,
} from "../../shared/react-components";
import type {
  ArchitectureViewData,
  Component,
  DataFlow,
  Decision,
} from "../../shared/types";
import "../../shared/styles.css";
import "../../shared/components.css";

// ── Status badge variant mapping ────────────────────────────

function statusVariant(
  status: string,
): "success" | "warning" | "error" | "info" | "neutral" {
  switch (status) {
    case "shipping":
      return "success";
    case "building":
      return "info";
    case "planning":
      return "warning";
    case "ideation":
      return "neutral";
    case "archived":
      return "error";
    default:
      return "neutral";
  }
}

// ── StackBanner ─────────────────────────────────────────────

function StackBanner({ stack }: { stack: Record<string, string> }) {
  const entries = Object.entries(stack);
  if (entries.length === 0) return null;

  return (
    <div className="hive-flex hive-flex-wrap hive-gap-sm hive-mt-sm">
      {entries.map(([key, value]) => (
        <TechPill key={key} label={`${key}: ${value}`} />
      ))}
    </div>
  );
}

// ── ComponentsSection ───────────────────────────────────────

function ComponentCard({
  component,
  isSelected,
  onClick,
}: {
  component: Component;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Card className="arch-component-card">
      <div
        style={{ cursor: "pointer" }}
        onClick={onClick}
      >
        <div className="hive-flex hive-items-center hive-gap-sm">
          <strong>{component.name}</strong>
          <Badge label={component.type} variant="info" />
        </div>
        <p className="hive-text-muted hive-text-sm hive-mt-sm">
          {component.description}
        </p>
        <div className="hive-flex hive-gap-md hive-mt-sm hive-text-sm hive-text-subtle">
          <span>{component.files.length} file{component.files.length !== 1 ? "s" : ""}</span>
          <span>{component.dependencies.length} dep{component.dependencies.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      {isSelected && (
        <div
          style={{
            marginTop: "var(--hive-space-md)",
            paddingTop: "var(--hive-space-md)",
            borderTop: "1px solid var(--hive-border)",
          }}
        >
          {component.files.length > 0 && (
            <div style={{ marginBottom: "var(--hive-space-sm)" }}>
              <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
                Files
              </span>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, fontFamily: "var(--hive-font-mono)", lineHeight: 1.8 }}>
                {component.files.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {component.dependencies.length > 0 && (
            <div style={{ marginBottom: "var(--hive-space-sm)" }}>
              <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
                Dependencies
              </span>
              <div className="hive-flex hive-gap-xs hive-flex-wrap">
                {component.dependencies.map((d) => (
                  <Badge key={d} label={d} variant="neutral" />
                ))}
              </div>
            </div>
          )}
          {component.schema && component.schema.tables && component.schema.tables.length > 0 && (
            <div>
              <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
                Schema
              </span>
              {component.schema.tables.map((table) => (
                <div key={table.name} style={{ marginBottom: "var(--hive-space-sm)" }}>
                  <strong className="hive-text-sm">{table.name}</strong>
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginTop: 4 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "2px 8px", borderBottom: "1px solid var(--hive-border)" }}>Column</th>
                        <th style={{ textAlign: "left", padding: "2px 8px", borderBottom: "1px solid var(--hive-border)" }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map((col) => (
                        <tr key={col.name}>
                          <td style={{ padding: "2px 8px", fontFamily: "var(--hive-font-mono)" }}>
                            {col.name}
                            {col.primary && <Badge label="PK" variant="info" />}
                            {col.unique && <Badge label="UQ" variant="neutral" />}
                          </td>
                          <td style={{ padding: "2px 8px", color: "var(--hive-fg-muted)" }}>{col.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ComponentsSection({ components }: { components: Component[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  if (components.length === 0) return null;

  return (
    <Card title="Components">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "var(--hive-space-md)",
        }}
      >
        {components.map((c) => (
          <ComponentCard
            key={c.name}
            component={c}
            isSelected={selected === c.name}
            onClick={() => setSelected(selected === c.name ? null : c.name)}
          />
        ))}
      </div>
    </Card>
  );
}

// ── DataFlowsSection ────────────────────────────────────────

function DataFlowTimeline({ flow }: { flow: DataFlow }) {
  return (
    <Expandable title={flow.name}>
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {flow.steps.map((step, i) => (
          <li
            key={i}
            className="hive-flex hive-items-center hive-gap-sm"
            style={{ padding: "var(--hive-space-xs) 0" }}
          >
            <span
              className="hive-badge hive-badge-info"
              style={{
                minWidth: 22,
                textAlign: "center",
                display: "inline-block",
              }}
            >
              {i + 1}
            </span>
            <span className="hive-text-sm">{step}</span>
            {i < flow.steps.length - 1 && (
              <span className="hive-text-subtle" style={{ marginLeft: "auto" }}>
                &#8594;
              </span>
            )}
          </li>
        ))}
      </ol>
    </Expandable>
  );
}

function DataFlowsSection({ dataFlows }: { dataFlows: DataFlow[] }) {
  if (dataFlows.length === 0) return null;

  return (
    <Card title="Data Flows">
      <div className="hive-flex hive-flex-col hive-gap-sm">
        {dataFlows.map((flow) => (
          <DataFlowTimeline key={flow.name} flow={flow} />
        ))}
      </div>
    </Card>
  );
}

// ── FileStructureSection ────────────────────────────────────

function FileTreeNode({
  name,
  value,
  depth = 0,
}: {
  name: string;
  value: unknown;
  depth?: number;
}) {
  const isObject =
    value !== null && typeof value === "object" && !Array.isArray(value);
  const children = isObject
    ? Object.entries(value as Record<string, unknown>)
    : [];

  if (isObject && children.length > 0) {
    return (
      <Expandable title={name}>
        <div style={{ paddingLeft: "var(--hive-space-md)" }}>
          {children.map(([childName, childValue]) => (
            <FileTreeNode
              key={childName}
              name={childName}
              value={childValue}
              depth={depth + 1}
            />
          ))}
        </div>
      </Expandable>
    );
  }

  return (
    <div
      className="hive-text-sm hive-text-mono"
      style={{ padding: "var(--hive-space-xs) var(--hive-space-md)" }}
    >
      {name}
      {value != null && typeof value !== "object" && (
        <span className="hive-text-subtle"> — {String(value)}</span>
      )}
    </div>
  );
}

function FileStructureSection({
  fileStructure,
}: {
  fileStructure: Record<string, unknown>;
}) {
  const entries = Object.entries(fileStructure);
  if (entries.length === 0) return null;

  return (
    <Card title="File Structure">
      {entries.map(([name, value]) => (
        <FileTreeNode key={name} name={name} value={value} />
      ))}
    </Card>
  );
}

// ── DecisionsTimeline ───────────────────────────────────────

function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <Card className="arch-decision-card">
      <div className="hive-flex hive-items-center hive-gap-sm hive-flex-wrap">
        <span className="hive-text-mono hive-text-sm hive-text-subtle">
          {decision.id}
        </span>
        <span className="hive-text-sm hive-text-muted">{decision.date}</span>
        <Badge label={decision.component} variant="info" />
      </div>
      <p className="hive-text-sm hive-mt-sm">{decision.decision}</p>
      <Expandable title="Reasoning">
        <p className="hive-text-sm hive-text-muted">{decision.reasoning}</p>
      </Expandable>
      {decision.alternatives_considered &&
        decision.alternatives_considered.length > 0 && (
          <div className="hive-flex hive-flex-wrap hive-gap-xs hive-mt-sm">
            {decision.alternatives_considered.map((alt) => (
              <Tag key={alt} label={alt} />
            ))}
          </div>
        )}
      {decision.revisit_when && (
        <p className="hive-text-sm hive-text-subtle hive-mt-sm">
          Revisit: {decision.revisit_when}
        </p>
      )}
    </Card>
  );
}

function DecisionsTimeline({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) return null;

  const sorted = [...decisions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <Card title="Decisions">
      <div className="hive-flex hive-flex-col hive-gap-md">
        {sorted.map((d) => (
          <DecisionCard key={d.id} decision={d} />
        ))}
      </div>
    </Card>
  );
}

// ── Main App ────────────────────────────────────────────────

function ArchitectureViewer() {
  const { data, isLoading, error } =
    useHiveApp<ArchitectureViewData>("architecture-viewer");

  if (isLoading) return <LoadingState message="Loading architecture..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message="No architecture data available." />;

  const { architecture, decisions } = data;

  return (
    <div style={{ padding: "var(--hive-space-lg)", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div className="hive-flex hive-items-center hive-gap-md" style={{ marginBottom: "var(--hive-space-md)" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {architecture.project}
        </h1>
        <Badge
          label={architecture.status}
          variant={statusVariant(architecture.status)}
        />
      </div>
      <p className="hive-text-muted" style={{ marginBottom: "var(--hive-space-lg)" }}>
        {architecture.description}
      </p>

      {/* Stack */}
      <StackBanner stack={architecture.stack} />

      {/* Sections */}
      <div className="hive-flex hive-flex-col hive-gap-lg hive-mt-lg">
        <ComponentsSection components={architecture.components} />
        <DataFlowsSection dataFlows={architecture.data_flows} />
        <FileStructureSection fileStructure={architecture.file_structure} />
        <DecisionsTimeline decisions={decisions} />
      </div>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────

const root = createRoot(document.getElementById("root")!);
root.render(<ArchitectureViewer />);

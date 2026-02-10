import { createRoot } from "react-dom/client";
import { useHiveApp } from "../../shared/hooks";
import {
  Card,
  Button,
  ProgressRing,
  StatCard,
  HBar,
  Expandable,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../shared/react-components";
import type { ProgressData, ComponentProgress } from "../../shared/types";
import "../../shared/styles.css";
import "../../shared/components.css";

// ── Helpers ────────────────────────────────────────────────

function statusColor(status: ComponentProgress["status"]): string {
  switch (status) {
    case "built":
      return "var(--hive-success)";
    case "in_progress":
      return "var(--hive-warning)";
    case "missing":
      return "var(--hive-error)";
  }
}

// ── Components ─────────────────────────────────────────────

function ProgressHeader({ coverage }: { coverage: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--hive-space-sm)",
        marginBottom: "var(--hive-space-lg)",
      }}
    >
      <ProgressRing value={coverage} size={120} strokeWidth={8} />
      <span className="hive-text-muted hive-text-sm">Project Coverage</span>
    </div>
  );
}

function StatsRow({
  built,
  inProgress,
  missing,
}: {
  built: number;
  inProgress: number;
  missing: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "var(--hive-space-md)",
        marginBottom: "var(--hive-space-lg)",
      }}
    >
      <StatCard value={built} label="Built" color="var(--hive-success)" />
      <StatCard
        value={inProgress}
        label="In Progress"
        color="var(--hive-warning)"
      />
      <StatCard value={missing} label="Missing" color="var(--hive-error)" />
    </div>
  );
}

function FileList({
  files,
  color,
}: {
  files: string[];
  color: string;
}) {
  if (files.length === 0) return null;
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 16,
        fontSize: 12,
        lineHeight: 1.8,
        fontFamily: "var(--hive-font-mono)",
      }}
    >
      {files.map((f, i) => (
        <li key={i} style={{ color }}>
          {f}
        </li>
      ))}
    </ul>
  );
}

function ComponentDetail({
  component,
  showBuildNext,
  onBuildNext,
}: {
  component: ComponentProgress;
  showBuildNext?: boolean;
  onBuildNext?: () => void;
}) {
  const found = component.found_files.length;
  const expected = component.expected_files.length;

  return (
    <Expandable
      title={`${component.name} (${component.type}) -- ${found}/${expected} files`}
    >
      <div className="hive-flex hive-flex-col hive-gap-sm">
        {component.description && (
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--hive-fg-muted)" }}>
            {component.description}
          </p>
        )}
        <HBar
          label={component.name}
          value={found}
          max={expected}
          color={statusColor(component.status)}
        />

        {component.found_files.length > 0 && (
          <div>
            <span
              className="hive-text-sm"
              style={{
                color: "var(--hive-success)",
                fontWeight: 500,
                display: "block",
                marginBottom: "var(--hive-space-xs)",
              }}
            >
              Found
            </span>
            <FileList files={component.found_files} color="var(--hive-success)" />
          </div>
        )}

        {component.missing_files.length > 0 && (
          <div>
            <span
              className="hive-text-sm"
              style={{
                color: "var(--hive-error)",
                fontWeight: 500,
                display: "block",
                marginBottom: "var(--hive-space-xs)",
              }}
            >
              Missing
            </span>
            <FileList files={component.missing_files} color="var(--hive-error)" />
          </div>
        )}

        {showBuildNext && onBuildNext && (
          <div style={{ marginTop: "var(--hive-space-sm)" }}>
            <Button label="Build Next" variant="primary" small onClick={onBuildNext} />
          </div>
        )}
      </div>
    </Expandable>
  );
}

function ComponentSection({
  title,
  components,
  color,
  firstMissingBuildNext,
  onBuildNext,
}: {
  title: string;
  components: ComponentProgress[];
  color: string;
  firstMissingBuildNext?: string;
  onBuildNext?: (name: string) => void;
}) {
  if (components.length === 0) return null;
  return (
    <Card title={title}>
      <div
        style={{
          borderLeft: `3px solid ${color}`,
          paddingLeft: "var(--hive-space-md)",
        }}
      >
        <div className="hive-flex hive-flex-col hive-gap-sm">
          {components.map((c, i) => (
            <ComponentDetail
              key={c.name}
              component={c}
              showBuildNext={firstMissingBuildNext === c.name}
              onBuildNext={onBuildNext ? () => onBuildNext(c.name) : undefined}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── App ────────────────────────────────────────────────────

function ProgressDashboardApp() {
  const { data, isLoading, error, sendMessage } =
    useHiveApp<ProgressData>("progress-dashboard");

  if (isLoading) return <LoadingState message="Checking progress..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message="No progress data available." />;

  const firstMissing = data.missing.length > 0 ? data.missing[0].name : undefined;

  const handleBuildNext = (name: string) => {
    sendMessage(`Build the ${name} component for ${data.project}`);
  };

  return (
    <div style={{ padding: "var(--hive-space-lg)", maxWidth: 640 }}>
      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: 0,
          marginBottom: "var(--hive-space-lg)",
          textAlign: "center",
        }}
      >
        Build Progress{data.project ? ` — ${data.project}` : ""}
      </h1>

      <ProgressHeader coverage={data.coverage_pct} />

      <StatsRow
        built={data.built.length}
        inProgress={data.in_progress.length}
        missing={data.missing.length}
      />

      <div className="hive-flex hive-flex-col hive-gap-md">
        <ComponentSection
          title="Built"
          components={data.built}
          color="var(--hive-success)"
        />
        <ComponentSection
          title="In Progress"
          components={data.in_progress}
          color="var(--hive-warning)"
        />
        <ComponentSection
          title="Missing"
          components={data.missing}
          color="var(--hive-error)"
          firstMissingBuildNext={firstMissing}
          onBuildNext={handleBuildNext}
        />
      </div>
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<ProgressDashboardApp />);

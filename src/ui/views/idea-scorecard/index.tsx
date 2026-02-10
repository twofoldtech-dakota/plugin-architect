import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useHiveApp } from "../../shared/hooks";
import {
  Card,
  Badge,
  Tag,
  ScoreDots,
  Button,
  Expandable,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../shared/react-components";
import type { IdeaEvaluationData } from "../../shared/types";
import "../../shared/styles.css";
import "../../shared/components.css";

// ── Verdict helpers ────────────────────────────────────────

type Verdict = "build" | "park" | "kill" | "needs_more_thinking";

const verdictConfig: Record<
  Verdict,
  { label: string; variant: "success" | "warning" | "error" | "info"; bg: string }
> = {
  build: { label: "Build", variant: "success", bg: "var(--hive-success-bg)" },
  park: { label: "Park", variant: "warning", bg: "var(--hive-warning-bg)" },
  kill: { label: "Kill", variant: "error", bg: "var(--hive-error-bg)" },
  needs_more_thinking: {
    label: "Needs More Thinking",
    variant: "info",
    bg: "var(--hive-info-bg)",
  },
};

function verdictBorderColor(verdict: Verdict): string {
  const map: Record<Verdict, string> = {
    build: "var(--hive-success)",
    park: "var(--hive-warning)",
    kill: "var(--hive-error)",
    needs_more_thinking: "var(--hive-info)",
  };
  return map[verdict];
}

// ── Components ─────────────────────────────────────────────

function ScorecardHeader({ idea, slug }: { idea: string; slug: string }) {
  return (
    <div style={{ marginBottom: "var(--hive-space-lg)" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{idea}</h1>
      <span className="hive-text-muted hive-text-sm">{slug}</span>
    </div>
  );
}

function VerdictBanner({
  verdict,
  reasoning,
}: {
  verdict: Verdict;
  reasoning: string;
}) {
  const config = verdictConfig[verdict];
  return (
    <div
      style={{
        background: config.bg,
        borderLeft: `4px solid ${verdictBorderColor(verdict)}`,
        borderRadius: "var(--hive-radius-md)",
        padding: "var(--hive-space-md) var(--hive-space-lg)",
        marginBottom: "var(--hive-space-lg)",
      }}
    >
      <div className="hive-flex hive-items-center hive-gap-sm" style={{ marginBottom: "var(--hive-space-xs)" }}>
        <Badge label={config.label} variant={config.variant} />
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{reasoning}</p>
    </div>
  );
}

function FeasibilitySection({
  feasibility,
}: {
  feasibility: IdeaEvaluationData["evaluation"]["feasibility"];
}) {
  const scoreColor =
    feasibility.score >= 4
      ? "success"
      : feasibility.score >= 2
        ? "warning"
        : "error";

  return (
    <Card title="Feasibility">
      <div className="hive-flex hive-flex-col hive-gap-md">
        <div className="hive-flex hive-items-center hive-gap-sm">
          <span className="hive-text-sm hive-text-muted" style={{ minWidth: 60 }}>
            Score
          </span>
          <ScoreDots score={feasibility.score} max={5} color={scoreColor} />
          <span className="hive-text-sm hive-text-muted">
            {feasibility.score}/5
          </span>
        </div>

        <div className="hive-flex hive-gap-sm hive-flex-wrap">
          <Badge
            label={feasibility.has_patterns ? "Has Patterns" : "No Patterns"}
            variant={feasibility.has_patterns ? "success" : "neutral"}
          />
          <Badge
            label={feasibility.known_stack ? "Known Stack" : "Unknown Stack"}
            variant={feasibility.known_stack ? "success" : "neutral"}
          />
        </div>

        <div className="hive-text-sm">
          <span className="hive-text-muted">Estimated sessions: </span>
          <strong>{feasibility.estimated_sessions}</strong>
        </div>

        {feasibility.unknowns.length > 0 && (
          <div>
            <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
              Unknowns
            </span>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
              {feasibility.unknowns.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function CompetitiveSection({
  competitive,
}: {
  competitive: IdeaEvaluationData["evaluation"]["competitive"];
}) {
  return (
    <Card title="Competitive Landscape">
      <div className="hive-flex hive-flex-col hive-gap-md">
        <div className="hive-flex hive-items-center hive-gap-sm">
          <Badge
            label={competitive.exists_already ? "Exists Already" : "Novel"}
            variant={competitive.exists_already ? "warning" : "success"}
          />
        </div>

        <div>
          <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
            Differentiator
          </span>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {competitive.differentiator}
          </p>
        </div>

        {competitive.references.length > 0 && (
          <div>
            <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
              References
            </span>
            <div className="hive-flex hive-gap-xs hive-flex-wrap">
              {competitive.references.map((ref, i) => (
                <Tag key={i} label={ref} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ScopeSection({
  scope,
}: {
  scope: IdeaEvaluationData["evaluation"]["scope"];
}) {
  return (
    <Card title="Scope">
      <div className="hive-flex hive-flex-col hive-gap-md">
        <div>
          <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
            MVP Definition
          </span>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {scope.mvp_definition}
          </p>
        </div>

        {scope.mvp_components.length > 0 && (
          <div>
            <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
              MVP Components
            </span>
            <div className="hive-flex hive-gap-xs hive-flex-wrap">
              {scope.mvp_components.map((c, i) => (
                <Tag key={i} label={c} />
              ))}
            </div>
          </div>
        )}

        {scope.deferred.length > 0 && (
          <div>
            <span className="hive-text-sm hive-text-muted" style={{ display: "block", marginBottom: "var(--hive-space-xs)" }}>
              Deferred
            </span>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: "var(--hive-fg-muted)" }}>
              {scope.deferred.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        <Expandable title="Full Vision">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {scope.full_vision}
          </p>
        </Expandable>
      </div>
    </Card>
  );
}

function ActionBar({
  slug,
  callTool,
  sendMessage,
}: {
  slug: string;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  sendMessage: (text: string) => Promise<void>;
}) {
  const [promoting, setPromoting] = useState(false);

  const handlePromote = async () => {
    setPromoting(true);
    try {
      await callTool("hive_promote_idea", { idea: slug });
    } finally {
      setPromoting(false);
    }
  };

  const handleReEvaluate = () => {
    sendMessage(`Re-evaluate the idea "${slug}" with fresh analysis`);
  };

  return (
    <div
      className="hive-flex hive-gap-sm hive-items-center"
      style={{
        padding: "var(--hive-space-md) 0",
        borderTop: "1px solid var(--hive-border)",
        marginTop: "var(--hive-space-lg)",
      }}
    >
      <Button
        label={promoting ? "Promoting..." : "Promote to Project"}
        variant="primary"
        onClick={handlePromote}
        disabled={promoting}
      />
      <Button label="Re-evaluate" onClick={handleReEvaluate} />
    </div>
  );
}

// ── App ────────────────────────────────────────────────────

function IdeaScorecardApp() {
  const { data, isLoading, error, callTool, sendMessage } =
    useHiveApp<IdeaEvaluationData>("idea-scorecard");

  if (isLoading) return <LoadingState message="Loading evaluation..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message="No evaluation data available." />;

  const { idea, slug, evaluation } = data;

  return (
    <div style={{ padding: "var(--hive-space-lg)", maxWidth: 640 }}>
      <ScorecardHeader idea={idea} slug={slug} />
      <VerdictBanner verdict={evaluation.verdict} reasoning={evaluation.reasoning} />

      <div className="hive-flex hive-flex-col hive-gap-md">
        <FeasibilitySection feasibility={evaluation.feasibility} />
        <CompetitiveSection competitive={evaluation.competitive} />
        <ScopeSection scope={evaluation.scope} />
      </div>

      <ActionBar slug={slug} callTool={callTool} sendMessage={sendMessage} />
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<IdeaScorecardApp />);

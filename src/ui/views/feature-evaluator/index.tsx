import { createRoot } from "react-dom/client";
import { useHiveApp } from "../../shared/hooks";
import {
  Card,
  Badge,
  Tag,
  ScoreDots,
  QuadrantChart,
  Expandable,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../shared/react-components";
import type { FeatureEvaluationData } from "../../shared/types";
import "../../shared/styles.css";
import "../../shared/components.css";

// ── Recommendation helpers ─────────────────────────────────

type RecommendationVerdict = "build it" | "simplify it" | "defer it" | "cut it";

const recommendationConfig: Record<
  RecommendationVerdict,
  { variant: "success" | "warning" | "info" | "error"; bg: string; border: string }
> = {
  "build it": {
    variant: "success",
    bg: "var(--hive-success-bg)",
    border: "var(--hive-success)",
  },
  "simplify it": {
    variant: "warning",
    bg: "var(--hive-warning-bg)",
    border: "var(--hive-warning)",
  },
  "defer it": {
    variant: "info",
    bg: "var(--hive-info-bg)",
    border: "var(--hive-info)",
  },
  "cut it": {
    variant: "error",
    bg: "var(--hive-error-bg)",
    border: "var(--hive-error)",
  },
};

function classificationVariant(
  c: string,
): "success" | "info" | "warning" | "error" {
  switch (c) {
    case "core":
      return "success";
    case "nice-to-have":
      return "info";
    case "bloat":
      return "warning";
    case "distraction":
      return "error";
    default:
      return "info";
  }
}

function ratioVariant(
  r: string,
): "success" | "warning" | "error" {
  switch (r) {
    case "favorable":
      return "success";
    case "neutral":
      return "warning";
    case "unfavorable":
      return "error";
    default:
      return "warning";
  }
}

// ── Components ─────────────────────────────────────────────

function FeatureHeader({ feature }: { feature: string }) {
  return (
    <h1
      style={{
        fontSize: 20,
        fontWeight: 700,
        margin: 0,
        marginBottom: "var(--hive-space-lg)",
      }}
    >
      {feature}
    </h1>
  );
}

function EffortImpactSection({
  effortImpact,
}: {
  effortImpact: FeatureEvaluationData["effort_impact"];
}) {
  return (
    <Card title="Effort vs Impact">
      <div className="hive-flex hive-flex-col hive-gap-md hive-items-center">
        <QuadrantChart
          x={effortImpact.estimated_effort}
          y={effortImpact.estimated_impact}
          xLabel="Effort"
          yLabel="Impact"
          quadrantLabels={[
            "Low effort\nHigh impact",
            "High effort\nHigh impact",
            "Low effort\nLow impact",
            "High effort\nLow impact",
          ]}
        />
        <div className="hive-flex hive-gap-sm hive-items-center" style={{ marginTop: "var(--hive-space-md)" }}>
          <Badge
            label={`Effort: ${effortImpact.estimated_effort}`}
            variant="neutral"
          />
          <Badge
            label={`Impact: ${effortImpact.estimated_impact}`}
            variant="neutral"
          />
          <Badge
            label={effortImpact.ratio}
            variant={ratioVariant(effortImpact.ratio)}
          />
        </div>
      </div>
    </Card>
  );
}

function AlignmentSection({
  alignment,
}: {
  alignment: FeatureEvaluationData["alignment"];
}) {
  const scoreColor =
    alignment.score >= 4
      ? "success"
      : alignment.score >= 2
        ? "warning"
        : "error";

  return (
    <Card title="Alignment">
      <div className="hive-flex hive-flex-col hive-gap-md">
        <div className="hive-flex hive-items-center hive-gap-sm">
          <span className="hive-text-sm hive-text-muted" style={{ minWidth: 60 }}>
            Score
          </span>
          <ScoreDots score={alignment.score} max={5} color={scoreColor} />
          <span className="hive-text-sm hive-text-muted">
            {alignment.score}/5
          </span>
        </div>

        <div className="hive-flex hive-items-center hive-gap-sm">
          <span className="hive-text-sm hive-text-muted">Classification:</span>
          <Badge
            label={alignment.classification}
            variant={classificationVariant(alignment.classification)}
          />
        </div>

        {alignment.supports_goals.length > 0 && (
          <div>
            <span
              className="hive-text-sm hive-text-muted"
              style={{
                display: "block",
                marginBottom: "var(--hive-space-xs)",
              }}
            >
              Supports Goals
            </span>
            <div className="hive-flex hive-gap-xs hive-flex-wrap">
              {alignment.supports_goals.map((g, i) => (
                <Tag key={i} label={g} />
              ))}
            </div>
          </div>
        )}

        {alignment.irrelevant_to_goals.length > 0 && (
          <Expandable title="Irrelevant to Goals">
            <div className="hive-flex hive-gap-xs hive-flex-wrap">
              {alignment.irrelevant_to_goals.map((g, i) => (
                <Tag key={i} label={g} />
              ))}
            </div>
          </Expandable>
        )}
      </div>
    </Card>
  );
}

function PatternBoost({ patterns }: { patterns: string[] }) {
  if (patterns.length === 0) return null;
  return (
    <Card title="Pattern Boost">
      <div>
        <span
          className="hive-text-sm hive-text-muted"
          style={{
            display: "block",
            marginBottom: "var(--hive-space-sm)",
          }}
        >
          Existing patterns that could accelerate this feature:
        </span>
        <div className="hive-flex hive-gap-xs hive-flex-wrap">
          {patterns.map((p, i) => (
            <Tag key={i} label={p} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function TradeoffsSection({
  tradeoffs,
}: {
  tradeoffs: FeatureEvaluationData["tradeoffs"];
}) {
  return (
    <Card title="Tradeoffs">
      <div className="hive-flex hive-flex-col hive-gap-md">
        <div>
          <span
            className="hive-text-sm hive-text-muted"
            style={{
              display: "block",
              marginBottom: "var(--hive-space-xs)",
            }}
          >
            Complexity Added
          </span>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {tradeoffs.complexity_added}
          </p>
        </div>

        <div>
          <span
            className="hive-text-sm hive-text-muted"
            style={{
              display: "block",
              marginBottom: "var(--hive-space-xs)",
            }}
          >
            Maintenance Burden
          </span>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {tradeoffs.maintenance_burden}
          </p>
        </div>

        {tradeoffs.what_to_cut && (
          <div>
            <span
              className="hive-text-sm hive-text-muted"
              style={{
                display: "block",
                marginBottom: "var(--hive-space-xs)",
              }}
            >
              Consider Cutting
            </span>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              {tradeoffs.what_to_cut}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function RecommendationBanner({
  recommendation,
}: {
  recommendation: FeatureEvaluationData["recommendation"];
}) {
  const config = recommendationConfig[recommendation.verdict];

  return (
    <div
      style={{
        background: config.bg,
        borderLeft: `4px solid ${config.border}`,
        borderRadius: "var(--hive-radius-md)",
        padding: "var(--hive-space-md) var(--hive-space-lg)",
        marginBottom: "var(--hive-space-lg)",
      }}
    >
      <div
        className="hive-flex hive-items-center hive-gap-sm"
        style={{ marginBottom: "var(--hive-space-xs)" }}
      >
        <Badge label={recommendation.verdict} variant={config.variant} />
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
        {recommendation.reasoning}
      </p>
      {recommendation.simplified_alternative && (
        <div style={{ marginTop: "var(--hive-space-md)" }}>
          <span
            className="hive-text-sm"
            style={{
              fontWeight: 600,
              display: "block",
              marginBottom: "var(--hive-space-xs)",
            }}
          >
            Simplified Alternative
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            {recommendation.simplified_alternative}
          </p>
        </div>
      )}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────

function FeatureEvaluatorApp() {
  const { data, isLoading, error } =
    useHiveApp<FeatureEvaluationData>("feature-evaluator");

  if (isLoading) return <LoadingState message="Evaluating feature..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message="No feature evaluation data available." />;

  return (
    <div style={{ padding: "var(--hive-space-lg)", maxWidth: 640 }}>
      <FeatureHeader feature={data.feature} />
      <RecommendationBanner recommendation={data.recommendation} />

      <div className="hive-flex hive-flex-col hive-gap-md">
        <EffortImpactSection effortImpact={data.effort_impact} />
        <AlignmentSection alignment={data.alignment} />
        <PatternBoost patterns={data.matching_patterns} />
        <TradeoffsSection tradeoffs={data.tradeoffs} />
      </div>
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<FeatureEvaluatorApp />);

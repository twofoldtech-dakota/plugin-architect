import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useHiveApp } from "../../shared/hooks";
import {
  Badge,
  Button,
  ScoreDots,
  Modal,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../shared/react-components";
import type { IdeaListItem } from "../../shared/types";
import "../../shared/styles.css";
import "../../shared/components.css";

// ── Column definitions ─────────────────────────────────────

type ColumnId = "raw" | "evaluated" | "approved" | "parked" | "rejected";

interface ColumnDef {
  id: ColumnId;
  label: string;
  color: string;
  borderColor: string;
}

const columns: ColumnDef[] = [
  {
    id: "raw",
    label: "Raw",
    color: "var(--hive-bg-muted)",
    borderColor: "var(--hive-fg-subtle)",
  },
  {
    id: "evaluated",
    label: "Evaluated",
    color: "var(--hive-info-bg)",
    borderColor: "var(--hive-info)",
  },
  {
    id: "approved",
    label: "Approved",
    color: "var(--hive-success-bg)",
    borderColor: "var(--hive-success)",
  },
  {
    id: "parked",
    label: "Parked",
    color: "var(--hive-warning-bg)",
    borderColor: "var(--hive-warning)",
  },
  {
    id: "rejected",
    label: "Rejected",
    color: "var(--hive-error-bg)",
    borderColor: "var(--hive-error)",
  },
];

// ── Verdict badge variant mapping ──────────────────────────

function verdictVariant(
  verdict?: string,
): "success" | "warning" | "error" | "info" | "neutral" {
  switch (verdict) {
    case "build":
      return "success";
    case "park":
      return "warning";
    case "kill":
      return "error";
    case "needs_more_thinking":
      return "info";
    default:
      return "neutral";
  }
}

// ── Components ─────────────────────────────────────────────

function KanbanCard({
  item,
  onClick,
  onEvaluate,
  onPromote,
}: {
  item: IdeaListItem;
  onClick: () => void;
  onEvaluate?: () => void;
  onPromote?: () => void;
}) {
  return (
    <div className="hive-kanban-card" onClick={onClick}>
      <div className="hive-kanban-card-title">{item.name}</div>
      <div className="hive-kanban-card-desc">{item.problem}</div>
      <div className="hive-flex hive-items-center hive-gap-xs hive-flex-wrap" style={{ marginTop: "var(--hive-space-xs)" }}>
        {item.verdict && (
          <Badge label={item.verdict} variant={verdictVariant(item.verdict)} />
        )}
        {item.feasibility_score != null && (
          <ScoreDots score={item.feasibility_score} max={5} />
        )}
        {item.estimated_sessions != null && (
          <span className="hive-badge hive-badge-neutral" style={{ fontSize: 10 }}>
            {item.estimated_sessions} sessions
          </span>
        )}
      </div>
      {(onEvaluate || onPromote) && (
        <div className="hive-flex hive-gap-xs" style={{ marginTop: "var(--hive-space-sm)" }} onClick={(e) => e.stopPropagation()}>
          {onEvaluate && (
            <button type="button" className="hive-btn hive-btn-sm" onClick={onEvaluate}>
              Evaluate
            </button>
          )}
          {onPromote && (
            <button type="button" className="hive-btn hive-btn-sm hive-btn-primary" onClick={onPromote}>
              Promote
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  def,
  items,
  onCardClick,
  onEvaluate,
  onPromote,
}: {
  def: ColumnDef;
  items: IdeaListItem[];
  onCardClick: (item: IdeaListItem) => void;
  onEvaluate?: (slug: string) => void;
  onPromote?: (slug: string) => void;
}) {
  return (
    <div className="hive-kanban-column">
      <div
        className="hive-kanban-column-header"
        style={{ borderBottomColor: def.borderColor }}
      >
        <span>{def.label}</span>
        <span
          className="hive-badge hive-badge-neutral"
          style={{ fontSize: 10, padding: "1px 6px" }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div
          style={{
            padding: "var(--hive-space-lg)",
            textAlign: "center",
            fontSize: 11,
            color: "var(--hive-fg-subtle)",
          }}
        >
          No ideas
        </div>
      ) : (
        items.map((item) => (
          <KanbanCard
            key={item.slug}
            item={item}
            onClick={() => onCardClick(item)}
            onEvaluate={def.id === "raw" && onEvaluate ? () => onEvaluate(item.slug) : undefined}
            onPromote={def.id === "approved" && onPromote ? () => onPromote(item.slug) : undefined}
          />
        ))
      )}
    </div>
  );
}

function IdeaDetailModal({
  item,
  onClose,
}: {
  item: IdeaListItem;
  onClose: () => void;
}) {
  return (
    <Modal title={item.name} onClose={onClose}>
      <div className="hive-flex hive-flex-col hive-gap-md">
        <div className="hive-flex hive-gap-sm hive-items-center">
          <Badge label={item.status} variant={verdictVariant(item.status)} />
          {item.verdict && (
            <Badge
              label={item.verdict}
              variant={verdictVariant(item.verdict)}
            />
          )}
        </div>

        <div>
          <span
            className="hive-text-sm hive-text-muted"
            style={{
              display: "block",
              marginBottom: "var(--hive-space-xs)",
            }}
          >
            Problem
          </span>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {item.problem}
          </p>
        </div>

        {item.audience && (
          <div>
            <span
              className="hive-text-sm hive-text-muted"
              style={{
                display: "block",
                marginBottom: "var(--hive-space-xs)",
              }}
            >
              Audience
            </span>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              {item.audience}
            </p>
          </div>
        )}

        <div>
          <span
            className="hive-text-sm hive-text-muted"
            style={{
              display: "block",
              marginBottom: "var(--hive-space-xs)",
            }}
          >
            Slug
          </span>
          <span className="hive-text-mono hive-text-sm">{item.slug}</span>
        </div>

        <div>
          <span
            className="hive-text-sm hive-text-muted"
            style={{
              display: "block",
              marginBottom: "var(--hive-space-xs)",
            }}
          >
            Created
          </span>
          <span className="hive-text-sm">{item.created}</span>
        </div>
      </div>
    </Modal>
  );
}

// ── App ────────────────────────────────────────────────────

function IdeaKanbanApp() {
  const { data, isLoading, error, callTool, sendMessage } = useHiveApp<IdeaListItem[]>("idea-kanban");
  const [selectedItem, setSelectedItem] = useState<IdeaListItem | null>(null);

  if (isLoading) return <LoadingState message="Loading ideas..." />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState message="No ideas captured yet." />;

  // Group items by status into columns
  const grouped: Record<ColumnId, IdeaListItem[]> = {
    raw: [],
    evaluated: [],
    approved: [],
    parked: [],
    rejected: [],
  };

  for (const item of data) {
    const status = item.status as ColumnId;
    if (grouped[status]) {
      grouped[status].push(item);
    } else {
      grouped.raw.push(item);
    }
  }

  const handleEvaluate = (slug: string) => {
    sendMessage(`Evaluate idea ${slug}`);
  };

  const handlePromote = (slug: string) => {
    callTool("hive_promote_idea", { idea: slug });
  };

  return (
    <div style={{ padding: "var(--hive-space-lg)" }}>
      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: 0,
          marginBottom: "var(--hive-space-lg)",
        }}
      >
        Idea Board
      </h1>

      <div className="hive-kanban">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            def={col}
            items={grouped[col.id]}
            onCardClick={setSelectedItem}
            onEvaluate={handleEvaluate}
            onPromote={handlePromote}
          />
        ))}
      </div>

      {selectedItem && (
        <IdeaDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<IdeaKanbanApp />);

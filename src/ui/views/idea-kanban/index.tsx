import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useHiveApp } from "../../shared/hooks";
import {
  Badge,
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
}: {
  item: IdeaListItem;
  onClick: () => void;
}) {
  return (
    <div className="hive-kanban-card" onClick={onClick}>
      <div className="hive-kanban-card-title">{item.name}</div>
      <div className="hive-kanban-card-desc">{item.problem}</div>
      {item.verdict && (
        <div style={{ marginTop: "var(--hive-space-xs)" }}>
          <Badge label={item.verdict} variant={verdictVariant(item.verdict)} />
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  def,
  items,
  onCardClick,
}: {
  def: ColumnDef;
  items: IdeaListItem[];
  onCardClick: (item: IdeaListItem) => void;
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
  const { data, isLoading, error } = useHiveApp<IdeaListItem[]>("idea-kanban");
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
      // Fallback: put unknown statuses in "raw"
      grouped.raw.push(item);
    }
  }

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

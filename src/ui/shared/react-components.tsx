/**
 * Hive — shared React components
 *
 * Uses existing .hive-* CSS classes from styles.css and
 * additional classes from components.css.
 */

import { useState, type ReactNode } from "react";

// ── Card ──────────────────────────────────────────────────

export function Card({
  title,
  subtitle,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={["hive-card", className].filter(Boolean).join(" ")}>
      {title && <div className="hive-card-title">{title}</div>}
      {subtitle && <div className="hive-card-subtitle">{subtitle}</div>}
      {children}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────

export function Button({
  label,
  variant = "default",
  small,
  onClick,
  disabled,
}: {
  label: string;
  variant?: "default" | "primary" | "danger";
  small?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls = [
    "hive-btn",
    variant === "primary" && "hive-btn-primary",
    variant === "danger" && "hive-btn-danger",
    small && "hive-btn-sm",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} type="button" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────

export function Badge({
  label,
  variant = "neutral",
}: {
  label: string;
  variant?: "success" | "warning" | "error" | "info" | "neutral";
}) {
  return <span className={`hive-badge hive-badge-${variant}`}>{label}</span>;
}

// ── Tag ───────────────────────────────────────────────────

export function Tag({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="hive-tag">
      {label}
      {onRemove && (
        <span className="hive-tag-remove" onClick={onRemove}>
          &times;
        </span>
      )}
    </span>
  );
}

// ── Score Dots ────────────────────────────────────────────

export function ScoreDots({
  score,
  max = 5,
  color,
}: {
  score: number;
  max?: number;
  color?: "success" | "warning" | "error";
}) {
  return (
    <div className="hive-score-dots">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={["hive-score-dot", i < score && "filled", i < score && color]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}

// ── Progress Ring ─────────────────────────────────────────

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const strokeColor =
    color ?? (value >= 80 ? "var(--hive-success)" : value >= 50 ? "var(--hive-warning)" : "var(--hive-error)");

  return (
    <div className="hive-progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="hive-progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="hive-progress-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={strokeColor}
        />
      </svg>
      <span className="hive-progress-ring-label">{value}%</span>
    </div>
  );
}

// ── Tab Bar ───────────────────────────────────────────────

export function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="hive-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`hive-tab${tab.id === active ? " active" : ""}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
          {tab.count != null && <span className="hive-tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Expandable ────────────────────────────────────────────

export function Expandable({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="hive-expandable">
      <button className="hive-expandable-header" onClick={() => setOpen(!open)}>
        <span className={`hive-expandable-chevron${open ? " open" : ""}`}>&#9654;</span>
        {title}
      </button>
      {open && <div className="hive-expandable-body">{children}</div>}
    </div>
  );
}

// ── Code Block ────────────────────────────────────────────

export function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="hive-code-block">
      {(filename || true) && (
        <div className="hive-code-block-header">
          <span>{filename ?? ""}</span>
          <button className="hive-code-block-copy" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre>{code}</pre>
    </div>
  );
}

// ── File Tree ─────────────────────────────────────────────

export function FileTree({ files, basePath }: { files: string[]; basePath?: string }) {
  const stripped = basePath
    ? files.map((f) => (f.startsWith(basePath) ? f.slice(basePath.length).replace(/^\//, "") : f))
    : files;

  return (
    <div className="hive-file-tree">
      {stripped.map((file, i) => {
        const depth = file.split("/").length - 1;
        const isDir = file.endsWith("/");
        return (
          <div
            key={i}
            className="hive-file-tree-item"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            <span className="hive-file-tree-icon">{isDir ? "\u{1F4C1}" : "\u{1F4C4}"}</span>
            <span>{file.split("/").pop()}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="hive-modal-overlay" onClick={onClose}>
      <div className="hive-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hive-modal-header">
          <span className="hive-modal-title">{title}</span>
          <button className="hive-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Loading / Empty / Error States ────────────────────────

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="hive-loading">
      <div className="hive-loading-spinner" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ icon, message }: { icon?: string; message: string }) {
  return (
    <div className="hive-empty-state">
      {icon && <span className="hive-empty-state-icon">{icon}</span>}
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="hive-error-state">
      <span>{message}</span>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────

export function StatCard({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <div className="hive-stat-card">
      <span className="hive-stat-value" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="hive-stat-label">{label}</span>
    </div>
  );
}

// ── Horizontal Bar ────────────────────────────────────────

export function HBar({
  label,
  value,
  max = 100,
  color,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="hive-bar">
      <span className="hive-bar-label">{label}</span>
      <div className="hive-bar-track">
        <div
          className="hive-bar-fill"
          style={{ width: `${pct}%`, background: color ?? "var(--hive-accent)" }}
        />
      </div>
    </div>
  );
}

// ── Tech Pills ────────────────────────────────────────────

export function TechPill({ label }: { label: string }) {
  return <span className="hive-tech-pill">{label}</span>;
}

// ── Quadrant Chart ────────────────────────────────────────

export function QuadrantChart({
  x,
  y,
  xLabel = "Effort",
  yLabel = "Impact",
  quadrantLabels,
}: {
  x: "low" | "medium" | "high";
  y: "low" | "medium" | "high";
  xLabel?: string;
  yLabel?: string;
  quadrantLabels?: [string, string, string, string];
}) {
  const labels = quadrantLabels ?? ["Low effort\nHigh impact", "High effort\nHigh impact", "Low effort\nLow impact", "High effort\nLow impact"];
  const xPct = x === "low" ? 25 : x === "medium" ? 50 : 75;
  const yPct = y === "low" ? 75 : y === "medium" ? 50 : 25;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div className="hive-quadrant">
        {labels.map((l, i) => (
          <div key={i} className="hive-quadrant-cell">
            {l.split("\n").map((line, j) => (
              <span key={j}>
                {line}
                {j < l.split("\n").length - 1 && <br />}
              </span>
            ))}
          </div>
        ))}
        <div className="hive-quadrant-dot" style={{ left: `${xPct}%`, top: `${yPct}%` }} />
      </div>
      <span className="hive-quadrant-axis-x">{xLabel}</span>
      <span className="hive-quadrant-axis-y">{yLabel}</span>
    </div>
  );
}

// ── Search Bar ────────────────────────────────────────────

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  return (
    <div className="hive-search-bar">
      <input
        className="hive-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder={placeholder}
      />
      <Button label="Search" variant="primary" small onClick={onSubmit} />
    </div>
  );
}

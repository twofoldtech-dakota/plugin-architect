/**
 * Hive — shared React components
 *
 * Uses Tailwind utilities via the cn() helper. Theme tokens
 * are defined in tailwind.css and reference CSS vars from styles.css
 * for automatic dark mode support.
 */

import { useState, type ReactNode } from "react";
import { cn } from "./utils";

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
    <div className={cn("bg-hive-surface border border-hive-border rounded-lg p-4 shadow-hive-sm", className)}>
      {title && <div className="text-[15px] font-semibold mb-3">{title}</div>}
      {subtitle && <div className="text-xs text-hive-fg-muted mb-3">{subtitle}</div>}
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
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1 font-medium leading-none border rounded-md cursor-pointer transition-colors text-[13px]",
        !small && "px-3 py-2",
        small && "px-2 py-1 text-xs",
        variant === "default" && "border-hive-border bg-hive-surface text-hive-fg hover:bg-hive-surface-subtle",
        variant === "primary" && "border-hive-accent bg-hive-accent text-hive-accent-fg hover:bg-hive-accent-hover hover:border-hive-accent-hover",
        variant === "danger" && "border-hive-error bg-hive-error text-white hover:opacity-90",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
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
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded",
        variant === "success" && "bg-hive-success-bg text-hive-success",
        variant === "warning" && "bg-hive-warning-bg text-hive-warning",
        variant === "error" && "bg-hive-error-bg text-hive-error",
        variant === "info" && "bg-hive-info-bg text-hive-info",
        variant === "neutral" && "bg-hive-surface-muted text-hive-fg-muted",
      )}
    >
      {label}
    </span>
  );
}

// ── Tag ───────────────────────────────────────────────────

export function Tag({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-hive-surface-muted text-hive-fg-muted">
      {label}
      {onRemove && (
        <span className="cursor-pointer opacity-60 text-sm leading-none hover:opacity-100" onClick={onRemove}>
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
    <div className="inline-flex gap-1 items-center">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-colors",
            i < score
              ? cn(
                  !color && "bg-hive-accent",
                  color === "success" && "bg-hive-success",
                  color === "warning" && "bg-hive-warning",
                  color === "error" && "bg-hive-error",
                )
              : "bg-hive-surface-muted",
          )}
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
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-hive-surface-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={strokeColor}
          fill="none"
          strokeLinecap="round"
          className="transition-all duration-600"
        />
      </svg>
      <span className="absolute font-semibold text-sm">{value}%</span>
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
    <div className="flex border-b border-hive-border mb-3 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={cn(
            "px-3 py-2 text-xs font-medium border-b-2 cursor-pointer whitespace-nowrap transition-colors bg-transparent border-x-0 border-t-0",
            tab.id === active
              ? "text-hive-accent border-b-hive-accent"
              : "text-hive-fg-muted border-b-transparent hover:text-hive-fg",
          )}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
          {tab.count != null && (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] ml-1.5 text-[10px] font-semibold rounded-full",
                tab.id === active
                  ? "bg-hive-info-bg text-hive-accent"
                  : "bg-hive-surface-muted text-hive-fg-muted",
              )}
            >
              {tab.count}
            </span>
          )}
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
    <div className="border border-hive-border-muted rounded-md overflow-hidden">
      <button
        className="flex items-center gap-2 px-3 py-2 bg-hive-surface-subtle cursor-pointer text-xs font-medium select-none border-0 w-full text-left text-hive-fg hover:bg-hive-surface-muted"
        onClick={() => setOpen(!open)}
      >
        <span
          className={cn("text-[10px] transition-transform", open && "rotate-90")}
        >
          &#9654;
        </span>
        {title}
      </button>
      {open && <div className="p-3">{children}</div>}
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
    <div className="relative bg-hive-surface-subtle border border-hive-border-muted rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-hive-border-muted text-[11px] text-hive-fg-muted">
        <span>{filename ?? ""}</span>
        <button
          className="px-1.5 py-0.5 text-[10px] cursor-pointer bg-hive-surface-muted border-0 rounded text-hive-fg-muted hover:text-hive-fg"
          onClick={copy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 p-3 overflow-x-auto font-hive-mono text-xs leading-relaxed text-hive-fg">{code}</pre>
    </div>
  );
}

// ── File Tree ─────────────────────────────────────────────

export function FileTree({ files, basePath }: { files: (string | { path: string; type: string })[]; basePath?: string }) {
  const paths = files.map((f) => (typeof f === "string" ? f : f.path));
  const typeMap = new Map<string, string>();
  for (const f of files) {
    if (typeof f !== "string") typeMap.set(f.path, f.type);
  }

  const stripped = basePath
    ? paths.map((f) => (f.startsWith(basePath) ? f.slice(basePath.length).replace(/^\//, "") : f))
    : paths;

  return (
    <div className="font-hive-mono text-xs leading-[1.8]">
      {stripped.map((file, i) => {
        const depth = file.split("/").length - 1;
        const origPath = paths[i];
        const isDir = typeMap.has(origPath) ? typeMap.get(origPath) === "directory" : file.endsWith("/");
        return (
          <div
            key={i}
            className="flex items-center gap-1 text-hive-fg"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            <span className="w-3.5 text-center text-hive-fg-muted shrink-0">{isDir ? "\u{1F4C1}" : "\u{1F4C4}"}</span>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div
        className="bg-hive-surface border border-hive-border rounded-lg shadow-hive-md max-w-[90vw] max-h-[85vh] overflow-y-auto p-6 min-w-[320px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[15px] font-semibold">{title}</span>
          <button
            className="bg-transparent border-0 text-lg cursor-pointer text-hive-fg-muted p-1 leading-none hover:text-hive-fg"
            onClick={onClose}
          >
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
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-hive-fg-muted text-[13px]">
      <div className="w-6 h-6 border-2 border-hive-border border-t-hive-accent rounded-full animate-spin" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ icon, message }: { icon?: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-6 text-hive-fg-muted text-center">
      {icon && <span className="text-2xl opacity-50">{icon}</span>}
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-hive-error-bg border border-hive-error rounded-md text-hive-error text-[13px] text-center">
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
    <div className="flex flex-col items-center gap-1 p-3 bg-hive-surface-subtle border border-hive-border-muted rounded-md text-center">
      <span className="text-2xl font-bold leading-none" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="text-[11px] font-medium text-hive-fg-muted uppercase tracking-wide">
        {label}
      </span>
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
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium min-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
      <div className="flex-1 h-2 bg-hive-surface-muted rounded overflow-hidden">
        <div
          className="h-full rounded transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color ?? "var(--hive-accent)" }}
        />
      </div>
    </div>
  );
}

// ── Tech Pills ────────────────────────────────────────────

export function TechPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-hive-info-bg text-hive-info">
      {label}
    </span>
  );
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
    <div className="relative inline-block">
      <div className="relative grid grid-cols-2 grid-rows-2 w-[200px] h-[200px] border border-hive-border rounded-md overflow-hidden">
        {labels.map((l, i) => (
          <div key={i} className="flex items-center justify-center text-[10px] text-hive-fg-subtle border border-hive-border-muted/50">
            {l.split("\n").map((line, j) => (
              <span key={j}>
                {line}
                {j < l.split("\n").length - 1 && <br />}
              </span>
            ))}
          </div>
        ))}
        <div
          className="absolute w-3 h-3 rounded-full bg-hive-accent border-2 border-hive-surface shadow-hive-sm -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: `${xPct}%`, top: `${yPct}%` }}
        />
      </div>
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-hive-fg-subtle uppercase tracking-wide">{xLabel}</span>
      <span className="absolute -left-7 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-hive-fg-subtle uppercase tracking-wide">{yLabel}</span>
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
    <div className="flex gap-2 mb-3">
      <input
        className="flex-1 w-full px-3 py-2 text-[13px] text-hive-fg bg-hive-surface border border-hive-border rounded-md outline-none transition-colors focus:border-hive-accent"
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

// ── Refresh Button ────────────────────────────────────────

export function RefreshButton({
  onClick,
  loading = false,
  label = "Refresh",
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border border-hive-border rounded-md cursor-pointer transition-colors bg-hive-surface text-hive-fg-muted hover:text-hive-fg hover:bg-hive-surface-subtle",
        loading && "opacity-60 cursor-not-allowed",
      )}
      type="button"
      onClick={onClick}
      disabled={loading}
    >
      <svg
        className={cn("w-3.5 h-3.5", loading && "animate-spin")}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 8A6 6 0 1 1 8 2" strokeLinecap="round" />
        <path d="M8 0l2.5 2L8 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}

// ── SparkLine ─────────────────────────────────────────────

export function SparkLine({
  data,
  width = 60,
  height = 20,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color ?? "var(--hive-accent)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Status Dot ────────────────────────────────────────────

export function StatusDot({
  status,
  size = "md",
  label,
}: {
  status: "green" | "yellow" | "red" | "unknown";
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "rounded-full shrink-0",
          size === "sm" && "w-2 h-2",
          size === "md" && "w-2.5 h-2.5",
          size === "lg" && "w-3 h-3",
          status === "green" && "bg-hive-success",
          status === "yellow" && "bg-hive-warning",
          status === "red" && "bg-hive-error",
          status === "unknown" && "bg-hive-surface-muted",
        )}
      />
      {label && <span className="text-xs text-hive-fg-muted">{label}</span>}
    </span>
  );
}

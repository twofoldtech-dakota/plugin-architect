/**
 * Hive — reusable UI primitives
 *
 * Vanilla DOM helpers for building tool views.
 * All components use `.hive-*` CSS classes from styles.css.
 */

// ── Element factory ───────────────────────────────────────

type Attrs = Record<string, string | boolean | EventListener>;
type Child = Node | string | null | undefined;

/** Create an HTML element with attributes and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K];
export function h(
  tag: string,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElement;
export function h(
  tag: string,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElement {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (typeof val === "function") {
        el.addEventListener(key.replace(/^on/, "").toLowerCase(), val as EventListener);
      } else if (typeof val === "boolean") {
        if (val) el.setAttribute(key, "");
      } else {
        el.setAttribute(key, val);
      }
    }
  }

  for (const child of children) {
    if (child == null) continue;
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }

  return el;
}

// ── Card ──────────────────────────────────────────────────

export interface CardOpts {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function card(opts: CardOpts, ...children: Child[]): HTMLDivElement {
  const cls = ["hive-card", opts.className].filter(Boolean).join(" ");
  return h(
    "div",
    { class: cls },
    opts.title ? h("div", { class: "hive-card-title" }, opts.title) : null,
    opts.subtitle ? h("div", { class: "hive-card-subtitle" }, opts.subtitle) : null,
    ...children,
  ) as HTMLDivElement;
}

// ── Button ────────────────────────────────────────────────

export type ButtonVariant = "default" | "primary" | "danger";

export interface ButtonOpts {
  label: string;
  variant?: ButtonVariant;
  small?: boolean;
  onClick?: () => void;
}

export function button(opts: ButtonOpts): HTMLButtonElement {
  const classes = ["hive-btn"];
  if (opts.variant === "primary") classes.push("hive-btn-primary");
  if (opts.variant === "danger") classes.push("hive-btn-danger");
  if (opts.small) classes.push("hive-btn-sm");

  return h("button", {
    class: classes.join(" "),
    type: "button",
    ...(opts.onClick ? { onClick: opts.onClick } : {}),
  }, opts.label) as HTMLButtonElement;
}

// ── Tag ───────────────────────────────────────────────────

export interface TagOpts {
  label: string;
  onRemove?: () => void;
}

export function tag(opts: TagOpts): HTMLSpanElement {
  return h(
    "span",
    { class: "hive-tag" },
    opts.label,
    opts.onRemove
      ? h("span", { class: "hive-tag-remove", onClick: opts.onRemove }, "\u00d7")
      : null,
  ) as HTMLSpanElement;
}

// ── Badge (status) ────────────────────────────────────────

export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

export interface BadgeOpts {
  label: string;
  variant?: BadgeVariant;
}

export function badge(opts: BadgeOpts): HTMLSpanElement {
  const variant = opts.variant ?? "neutral";
  return h(
    "span",
    { class: `hive-badge hive-badge-${variant}` },
    opts.label,
  ) as HTMLSpanElement;
}

// ── Form field ────────────────────────────────────────────

export interface FieldOpts {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "number";
  placeholder?: string;
  required?: boolean;
  value?: string;
  options?: { value: string; label: string }[]; // for select
}

export function formField(opts: FieldOpts): HTMLDivElement {
  const group = h("div", { class: "hive-form-group" });
  group.append(h("label", { class: "hive-label", for: opts.name }, opts.label));

  let input: HTMLElement;

  if (opts.type === "textarea") {
    input = h("textarea", {
      class: "hive-textarea",
      name: opts.name,
      id: opts.name,
      ...(opts.placeholder ? { placeholder: opts.placeholder } : {}),
      ...(opts.required ? { required: true } : {}),
    });
    if (opts.value) (input as HTMLTextAreaElement).value = opts.value;
  } else if (opts.type === "select") {
    input = h("select", { class: "hive-select", name: opts.name, id: opts.name });
    for (const opt of opts.options ?? []) {
      const option = h("option", { value: opt.value }, opt.label);
      if (opt.value === opts.value) (option as HTMLOptionElement).selected = true;
      input.append(option);
    }
  } else {
    input = h("input", {
      class: "hive-input",
      type: opts.type ?? "text",
      name: opts.name,
      id: opts.name,
      ...(opts.placeholder ? { placeholder: opts.placeholder } : {}),
      ...(opts.required ? { required: true } : {}),
      ...(opts.value ? { value: opts.value } : {}),
    });
  }

  group.append(input);
  return group as HTMLDivElement;
}

// ── Form builder ──────────────────────────────────────────

export interface FormOpts {
  fields: FieldOpts[];
  submitLabel?: string;
  onSubmit: (data: Record<string, string>) => void;
}

export function form(opts: FormOpts): HTMLFormElement {
  const el = h("form", null) as HTMLFormElement;

  for (const field of opts.fields) {
    el.append(formField(field));
  }

  el.append(
    h(
      "div",
      { class: "hive-mt-md" },
      button({ label: opts.submitLabel ?? "Submit", variant: "primary" }),
    ),
  );

  el.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(el);
    const data: Record<string, string> = {};
    for (const [key, val] of fd.entries()) {
      data[key] = val as string;
    }
    opts.onSubmit(data);
  });

  // Override button type to submit
  const btn = el.querySelector(".hive-btn");
  if (btn) btn.setAttribute("type", "submit");

  return el;
}

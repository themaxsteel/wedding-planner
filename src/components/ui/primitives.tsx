import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatIDR, percentOf, type BudgetHealth } from "@/lib/money";

/* ========================================================================== */
/* BUTTON                                                                     */
/* ========================================================================== */

type ButtonVariant = "solid" | "outline" | "ghost" | "danger" | "quiet";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap " +
  "rounded-[5px] border transition-[background-color,border-color,color,transform] duration-150 " +
  "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45 select-none";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  solid:
    "bg-solid text-inverse border-solid hover:bg-solid-hover hover:border-solid-hover",
  outline:
    "bg-surface text-ink border-line hover:bg-hover hover:border-line-strong",
  ghost: "bg-transparent text-muted border-transparent hover:bg-hover hover:text-ink",
  quiet:
    "bg-sunken text-ink border-transparent hover:bg-hover",
  danger:
    "bg-red-bg text-red-fg border-red-line hover:brightness-[0.97] dark:hover:brightness-110",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3 text-[13px]",
  lg: "h-10 px-4 text-[13.5px]",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "outline",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...props}
    />
  );
}

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function LinkButton({
  className,
  variant = "outline",
  size = "md",
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...props}
    />
  );
}

/* ========================================================================== */
/* SURFACE                                                                    */
/* ========================================================================== */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[8px] border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-line px-4 py-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-snug text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.09em] text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </header>
  );
}

/* ========================================================================== */
/* BADGE                                                                      */
/* ========================================================================== */

export type Tone =
  | "neutral"
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-neutral-bg text-neutral-fg border-neutral-line",
  red: "bg-red-bg text-red-fg border-red-line",
  blue: "bg-blue-bg text-blue-fg border-blue-line",
  green: "bg-green-bg text-green-fg border-green-line",
  yellow: "bg-yellow-bg text-yellow-fg border-yellow-line",
  purple: "bg-purple-bg text-purple-fg border-purple-line",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-px",
        "text-[10px] font-medium uppercase tracking-[0.05em] whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Titik warna kecil sebagai penanda kategori — tidak memakan lebar kolom. */
export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const map: Record<Tone, string> = {
    neutral: "bg-neutral-fg",
    red: "bg-red-fg",
    blue: "bg-blue-fg",
    green: "bg-green-fg",
    yellow: "bg-yellow-fg",
    purple: "bg-purple-fg",
  };
  return (
    <span
      aria-hidden
      className={cn("inline-block size-[6px] shrink-0 rounded-full", map[tone])}
    />
  );
}

export function asTone(value: string | null | undefined): Tone {
  const tones: Tone[] = ["neutral", "red", "blue", "green", "yellow", "purple"];
  return tones.includes(value as Tone) ? (value as Tone) : "neutral";
}

const STATUS_META = {
  paid: { tone: "green" as Tone, label: "Lunas" },
  partial: { tone: "yellow" as Tone, label: "Sebagian" },
  unpaid: { tone: "red" as Tone, label: "Belum bayar" },
};

export function StatusBadge({ status }: { status: keyof typeof STATUS_META }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/* ========================================================================== */
/* PROGRESS                                                                   */
/* ========================================================================== */

const HEALTH_BAR: Record<BudgetHealth, string> = {
  empty: "bg-neutral-line",
  safe: "bg-green-fg",
  warning: "bg-yellow-fg",
  over: "bg-red-fg",
};

export function Progress({
  used,
  total,
  health,
  className,
  thick,
}: {
  used: number;
  total: number;
  health: BudgetHealth;
  className?: string;
  thick?: boolean;
}) {
  const pct = Math.min(100, percentOf(used, total));
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-sunken",
        thick ? "h-[6px]" : "h-[4px]",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", HEALTH_BAR[health])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ========================================================================== */
/* STAT                                                                       */
/* ========================================================================== */

export function StatTile({
  label,
  value,
  hint,
  tone,
  emphasis,
  className,
}: {
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  tone?: Tone;
  emphasis?: boolean;
  className?: string;
}) {
  const toneText: Record<Tone, string> = {
    neutral: "text-ink",
    red: "text-red-fg",
    blue: "text-blue-fg",
    green: "text-green-fg",
    yellow: "text-yellow-fg",
    purple: "text-purple-fg",
  };
  return (
    <div
      className={cn(
        "min-w-0 rounded-[8px] border border-line bg-surface px-3.5 py-3",
        className,
      )}
    >
      <p className="text-[10.5px] leading-tight font-medium uppercase tracking-[0.08em] text-faint">
        {label}
      </p>
      {/*
        Nominal tidak boleh dipotong: "Rp 193.000…" terbaca sebagai angka lain.
        Kalau ruangnya kurang, biarkan turun baris — bukan hilang sebagian.
      */}
      <p
        className={cn(
          "tnum mt-1 font-semibold break-words",
          emphasis ? "text-[18px]" : "text-[15.5px]",
          tone ? toneText[tone] : "text-ink",
        )}
      >
        {typeof value === "number" ? formatIDR(value) : value}
      </p>
      {hint ? (
        <div className="mt-1 truncate text-[11.5px] text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

/* ========================================================================== */
/* MISC                                                                       */
/* ========================================================================== */

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="mb-3 h-px w-10 bg-line-strong"
      />
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Money({
  value,
  className,
  signed,
  muted,
}: {
  value: number;
  className?: string;
  /** tampilkan +/- dan warnai hijau/merah — untuk kolom mutasi */
  signed?: boolean;
  muted?: boolean;
}) {
  const tone = signed
    ? value > 0
      ? "text-green-fg"
      : value < 0
        ? "text-red-fg"
        : "text-muted"
    : muted
      ? "text-muted"
      : "text-ink";
  const prefix = signed && value > 0 ? "+" : "";
  return (
    <span className={cn("tnum whitespace-nowrap", tone, className)}>
      {prefix}
      {formatIDR(value)}
    </span>
  );
}

export function Callout({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[6px] border px-3 py-2 text-[12px] leading-relaxed",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[4px] border border-line bg-sunken px-1 py-px font-mono text-[10.5px] text-muted">
      {children}
    </kbd>
  );
}

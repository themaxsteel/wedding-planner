import * as React from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-[5px] border border-line bg-surface px-2.5 text-[13px] text-ink " +
  "placeholder:text-faint transition-colors duration-150 " +
  "hover:border-line-strong focus:border-line-strong focus:outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink " +
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-8", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(CONTROL, "min-h-16 py-1.5 leading-relaxed", className)} {...props} />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(CONTROL, "h-8 appearance-none pr-7", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-faint"
      >
        <path
          d="M4 6.5 8 10.5 12 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex items-baseline justify-between gap-2 text-[11.5px] font-medium text-muted",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {hint ? <span className="text-[11px] font-normal text-faint">{hint}</span> : null}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? <p className="text-[11.5px] text-red-fg">{error}</p> : null}
    </div>
  );
}

/**
 * Centangnya digambar sebagai SVG saudara, bukan background-image, supaya
 * tanda centang tidak bergantung pada dukungan `appearance: none` dan tetap
 * mewarisi warna teks di mode gelap.
 */
export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span
      className={cn(
        "relative inline-flex size-[15px] shrink-0 items-center justify-center",
        className,
      )}
    >
      <input
        type="checkbox"
        className={cn(
          "peer absolute inset-0 size-full cursor-pointer appearance-none rounded-[3px]",
          "border border-line-strong bg-surface transition-colors duration-150",
          "hover:border-ink checked:border-solid checked:bg-solid",
        )}
        {...props}
      />
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none relative size-[11px] text-inverse opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
      >
        <path
          d="M3.5 8.5l3 3 6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Radio bergaya segmented control — dipakai untuk pilih jenis transaksi & status bayar. */
export function SegmentedOption({
  checked,
  className,
  children,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition-colors duration-150",
        checked
          ? "bg-surface text-ink shadow-[var(--shadow-raise)]"
          : "text-muted hover:text-ink",
        className,
      )}
    >
      <input type="radio" className="sr-only" checked={checked} {...props} />
      {children}
    </label>
  );
}

export function SegmentedGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex gap-0.5 rounded-[6px] border border-line bg-sunken p-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { formatNumber, parseIDR } from "@/lib/money";

/**
 * Input rupiah dengan pemisah ribuan otomatis.
 *
 * Nilai yang dikirim ke server adalah string apa adanya ("1.250.000");
 * parseIDR() di sisi server yang mengubahnya jadi integer. Jadi tidak ada
 * hidden field kembar yang bisa keluar sinkron.
 */
export function MoneyInput({
  name,
  defaultValue = 0,
  value,
  onValueChange,
  className,
  id,
  placeholder = "0",
  disabled,
  autoFocus,
  required,
}: {
  name?: string;
  defaultValue?: number;
  /** kendalikan dari luar bila nilainya perlu ikut perhitungan langsung */
  value?: number;
  onValueChange?: (value: number) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const controlled = value !== undefined;
  const [text, setText] = React.useState(() =>
    defaultValue > 0 ? formatNumber(defaultValue) : "",
  );

  const display = controlled
    ? value > 0
      ? formatNumber(value)
      : ""
    : text;

  function handleChange(raw: string) {
    const parsed = parseIDR(raw);
    // Biarkan field kosong benar-benar kosong, jangan dipaksa jadi "0".
    const next = raw.trim() === "" ? "" : formatNumber(parsed);
    if (!controlled) setText(next);
    onValueChange?.(parsed);
  }

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-medium text-faint"
      >
        Rp
      </span>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        className={cn(
          "tnum h-8 w-full rounded-[5px] border border-line bg-surface pl-8 pr-2.5 text-right text-[13px] text-ink",
          "placeholder:text-faint transition-colors duration-150",
          "hover:border-line-strong focus:border-line-strong focus:outline-none",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink",
          "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted",
          className,
        )}
      />
    </div>
  );
}

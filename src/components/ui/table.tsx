import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Tabel padat: tinggi baris ~30px, teks 12.5px, angka rata kanan dengan
 * tabular-nums. Selalu dibungkus kontainer overflow-x sendiri supaya
 * halaman tidak pernah menggeser secara horizontal.
 */

export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="min-w-max lg:min-w-full">{children}</div>
    </div>
  );
}

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-[12.5px]", className)}
      {...props}
    />
  );
}

export function Th({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 z-10 border-b border-line bg-surface px-3 py-1.5",
        "text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint",
        "whitespace-nowrap",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 py-1.5 align-middle text-ink",
        // Nominal tidak boleh pecah dua baris; TableWrap sudah menyediakan
        // scroll horizontal kalau ruangnya kurang.
        numeric && "tnum whitespace-nowrap text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors duration-150 hover:bg-hover", className)}
      {...props}
    />
  );
}

/** Baris total di kaki tabel. */
export function TotalRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-t border-line-strong bg-sunken font-semibold text-ink",
        className,
      )}
      {...props}
    />
  );
}

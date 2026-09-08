"use client";

import * as React from "react";
import { useActionState } from "react";
import { saveBudgetStep, goToStep } from "@/actions/setup";
import { Button, Callout, Dot, asTone } from "@/components/ui/primitives";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { MoneyInput } from "@/components/money-input";
import { formatIDR, percentOf } from "@/lib/money";
import { cn } from "@/lib/cn";

export type BudgetTarget = {
  id: number;
  name: string;
  color: string;
  childNames: string[];
  budgetAmount: number;
};

export function StepBudget({
  categories,
  targetTotal,
}: {
  categories: BudgetTarget[];
  targetTotal: number;
}) {
  const [result, action] = useActionState(saveBudgetStep, null);
  const [values, setValues] = React.useState<Record<number, number>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, c.budgetAmount])),
  );

  const allocated = categories.reduce((s, c) => s + (values[c.id] ?? 0), 0);
  const left = targetTotal - allocated;
  const hasTarget = targetTotal > 0;

  const payload = JSON.stringify({
    budgets: categories.map((c) => ({
      categoryId: c.id,
      budgetAmount: String(values[c.id] ?? 0),
    })),
  });

  /** Membagi sisa target secara merata ke pos yang masih kosong. */
  function distributeRemainder() {
    const empty = categories.filter((c) => (values[c.id] ?? 0) === 0);
    if (empty.length === 0 || left <= 0) return;
    // Bulatkan ke ribuan supaya angkanya enak dibaca, sisa pembagian
    // ditambahkan ke pos terakhir agar totalnya tetap persis.
    const each = Math.floor(left / empty.length / 1000) * 1000;
    const next = { ...values };
    empty.forEach((c) => (next[c.id] = each));
    const remainder = left - each * empty.length;
    if (remainder > 0) next[empty[empty.length - 1].id] += remainder;
    setValues(next);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <Callout tone="blue">
        Budget ditetapkan sekali untuk seluruh event — bukan per bulan. Angka
        ini dibandingkan dengan total transaksi di kategori tersebut, termasuk
        yang belum dibayar, sehingga pos yang sudah &quot;habis dijanjikan ke
        vendor&quot; langsung terlihat meski uangnya belum keluar.
      </Callout>

      <div
        className={cn(
          "sticky top-2 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-[8px] border px-3.5 py-2.5 backdrop-blur",
          left < 0
            ? "border-red-line bg-red-bg"
            : "border-line bg-[color-mix(in_srgb,var(--c-surface)_92%,transparent)]",
        )}
      >
        <Summary label="Target total" value={targetTotal} />
        <Summary label="Dialokasikan" value={allocated} />
        <Summary
          label={left < 0 ? "Kelebihan alokasi" : "Belum dialokasikan"}
          value={Math.abs(left)}
          tone={left < 0 ? "text-red-fg" : left === 0 ? "text-green-fg" : undefined}
        />
        {hasTarget ? (
          <div className="min-w-[120px] flex-1">
            <div className="h-[5px] w-full overflow-hidden rounded-full bg-sunken">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  left < 0 ? "bg-red-fg" : "bg-solid",
                )}
                style={{ width: `${Math.min(100, percentOf(allocated, targetTotal))}%` }}
              />
            </div>
          </div>
        ) : null}
        {hasTarget && left > 0 ? (
          <Button variant="quiet" size="sm" onClick={distributeRemainder}>
            Bagi rata sisanya
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[8px] border border-line bg-surface">
        {categories.map((cat, i) => {
          const value = values[cat.id] ?? 0;
          const share = allocated > 0 ? Math.round((value / allocated) * 100) : 0;
          return (
            <div
              key={cat.id}
              className="animate-rise grid grid-cols-1 items-center gap-2 border-b border-line px-3 py-2 last:border-b-0 sm:grid-cols-[1fr_60px_170px]"
              style={{ animationDelay: `${Math.min(i, 14) * 25}ms` }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Dot tone={asTone(cat.color)} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {cat.name}
                  </p>
                  {cat.childNames.length > 0 ? (
                    <p className="truncate text-[11px] text-faint">
                      {cat.childNames.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="tnum text-right text-[11.5px] text-faint">
                {value > 0 ? `${share}%` : "—"}
              </span>
              <MoneyInput
                value={value}
                onValueChange={(v) =>
                  setValues((prev) => ({ ...prev, [cat.id]: v }))
                }
              />
            </div>
          );
        })}
      </div>

      <p className="text-[12px] leading-relaxed text-muted">
        Pos yang dibiarkan 0 tetap bisa dipakai bertransaksi — hanya saja
        seluruh pengeluarannya akan langsung dihitung sebagai melebihi budget.
        Semua angka ini bisa diubah kapan saja di halaman Budget.
      </p>

      <FormMessage result={result} />

      <div className="flex justify-between border-t border-line pt-3">
        <Button variant="ghost" onClick={() => goToStep(3)}>
          Kembali
        </Button>
        <SubmitButton>Lanjut ke Supplier</SubmitButton>
      </div>
    </form>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
        {label}
      </p>
      <p className={cn("tnum text-[14px] font-semibold text-ink", tone)}>
        {formatIDR(value)}
      </p>
    </div>
  );
}

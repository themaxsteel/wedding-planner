import { getDb } from "@/db";
import { getBudgetTree, getEvent, summarizeBudget } from "@/db/queries";
import { Callout, PageHeader, StatTile } from "@/components/ui/primitives";
import { BudgetView } from "@/components/budget/budget-view";
import { formatIDR } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const db = await getDb();
  const [event, expense, income] = await Promise.all([
    getEvent(db),
    getBudgetTree(db, "expense"),
    getBudgetTree(db, "income"),
  ]);
  const totals = summarizeBudget(expense);
  const incomeTotals = summarizeBudget(income);

  const unallocated = event.totalBudgetTarget - totals.budget;

  return (
    <>
      <PageHeader
        title="Budget"
        description="Satu angka per kategori untuk seluruh event. Realisasi dihitung dari nilai transaksi — termasuk yang belum dibayar — sehingga pos yang sudah habis dijanjikan ke vendor langsung terlihat."
      />

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="Total budget"
          value={totals.budget}
          hint={
            unallocated === 0
              ? "Sesuai target"
              : unallocated > 0
                ? `${formatIDR(unallocated)} belum dialokasikan`
                : `${formatIDR(-unallocated)} melebihi target`
          }
        />
        <StatTile
          label="Terpakai"
          value={totals.committed}
          hint="komitmen, termasuk hutang"
        />
        <StatTile label="Kas keluar" value={totals.paid} hint="benar-benar dibayar" />
        <StatTile
          label="Sisa budget"
          value={totals.remaining}
          tone={totals.remaining < 0 ? "red" : "green"}
          emphasis
        />
        <StatTile
          label="Dana masuk"
          value={incomeTotals.committed}
          tone="green"
          hint="seluruh pemasukan"
        />
      </div>

      {totals.overBudgetCount > 0 ? (
        <Callout tone="red" className="mb-3">
          {totals.overBudgetCount} kategori melebihi budget. Naikkan
          alokasinya, atau geser dana dari pos yang masih longgar.
        </Callout>
      ) : null}

      <BudgetView nodes={expense} />

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold tracking-[-0.01em] text-ink">
          Sumber dana
        </h2>
        <p className="mb-2.5 text-[12px] text-muted">
          Pos pemasukan tidak memakai budget — angka di sini adalah realisasi
          dana yang sudah masuk.
        </p>
        <div className="overflow-hidden rounded-[8px] border border-line bg-surface">
          <ul className="divide-y divide-[var(--c-border)]">
            {income.map((node) => (
              <li
                key={node.id}
                className="flex items-center gap-3 px-3 py-2 text-[12.5px]"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-ink">
                  {node.name}
                </span>
                <span className="tnum text-faint">{node.txCount} transaksi</span>
                <span className="tnum w-[140px] text-right font-semibold text-green-fg">
                  {formatIDR(node.committed)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

import { getDb } from "@/db";
import {
  getOutstandingDebts,
  getSelectableAccounts,
  groupDebtsBySupplier,
} from "@/db/queries";
import { PageHeader, StatTile } from "@/components/ui/primitives";
import { DebtsView } from "@/components/debts/debts-view";
import { dueStatus } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const db = await getDb();
  const [debts, selectableAccounts] = await Promise.all([
    getOutstandingDebts(db),
    getSelectableAccounts(db),
  ]);
  const groups = groupDebtsBySupplier(debts);
  const accounts = selectableAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    groupName: a.groupName,
  }));

  const total = debts.reduce((s, d) => s + d.outstanding, 0);
  const overdue = debts.filter((d) => dueStatus(d.dueDate) === "overdue");
  const soon = debts.filter((d) => dueStatus(d.dueDate) === "soon");
  const overdueTotal = overdue.reduce((s, d) => s + d.outstanding, 0);
  const soonTotal = soon.reduce((s, d) => s + d.outstanding, 0);

  return (
    <>
      <PageHeader
        title="Hutang Supplier"
        description="Pengeluaran yang sudah tercatat membebani budget tetapi uangnya belum keluar. Mencatat pembayaran di sini langsung mengurangi saldo sub account yang dipakai."
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="Total hutang"
          value={total}
          tone={total > 0 ? "red" : "green"}
          emphasis
          hint={`${debts.length} tagihan`}
        />
        <StatTile
          label="Lewat jatuh tempo"
          value={overdueTotal}
          tone={overdue.length > 0 ? "red" : undefined}
          hint={`${overdue.length} tagihan`}
        />
        <StatTile
          label="Jatuh tempo ≤ 7 hari"
          value={soonTotal}
          tone={soon.length > 0 ? "yellow" : undefined}
          hint={`${soon.length} tagihan`}
        />
        <StatTile
          label="Pihak tertagih"
          value={String(groups.length)}
          hint="supplier & lainnya"
        />
      </div>

      <DebtsView debts={debts} groups={groups} accounts={accounts} />
    </>
  );
}

import { getDb } from "@/db";
import { getBudgetTree, listSuppliers } from "@/db/queries";
import { PageHeader, StatTile } from "@/components/ui/primitives";
import { SuppliersView } from "@/components/suppliers/suppliers-view";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const db = await getDb();
  const [suppliers, expenseTree] = await Promise.all([
    listSuppliers(db, { includeArchived: true }),
    getBudgetTree(db, "expense"),
  ]);
  const categories = expenseTree.map((c) => ({ id: c.id, name: c.name }));

  const active = suppliers.filter((s) => !s.archived);
  const withDebt = suppliers.filter((s) => s.outstanding > 0);
  const totalOutstanding = suppliers.reduce((s, x) => s + x.outstanding, 0);
  const totalCommitted = suppliers.reduce((s, x) => s + x.totalCommitted, 0);

  return (
    <>
      <PageHeader
        title="Supplier"
        description="Daftar vendor beserta rekapan nilai kesepakatan dan sisa kewajiban. Klik nama supplier untuk melihat seluruh riwayat transaksinya."
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="Supplier aktif"
          value={String(active.length)}
          hint={`${suppliers.length - active.length} diarsipkan`}
        />
        <StatTile label="Total nilai kesepakatan" value={totalCommitted} />
        <StatTile
          label="Sisa kewajiban"
          value={totalOutstanding}
          tone={totalOutstanding > 0 ? "red" : "green"}
          emphasis
        />
        <StatTile
          label="Punya tagihan terbuka"
          value={String(withDebt.length)}
          hint="supplier"
        />
      </div>

      <SuppliersView suppliers={suppliers} categories={categories} />
    </>
  );
}

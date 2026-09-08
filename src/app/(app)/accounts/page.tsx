import { getDb } from "@/db";
import { getAccountTree } from "@/db/queries";
import { PageHeader, StatTile } from "@/components/ui/primitives";
import { AccountsView } from "@/components/accounts/accounts-view";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const db = await getDb();
  const tree = await getAccountTree(db, { includeArchived: true });

  const total = tree.reduce((s, g) => s + g.balance, 0);
  const opening = tree.reduce(
    (s, g) => s + g.accounts.reduce((n, a) => n + a.openingBalance, 0),
    0,
  );
  const accountCount = tree.reduce((n, g) => n + g.accounts.length, 0);

  return (
    <>
      <PageHeader
        title="Assets Account"
        description="Main account hanya wadah pengelompokan. Sub account adalah tempat transaksi benar-benar terjadi — klik namanya untuk melihat buku kas dan saldo berjalannya."
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Total saldo" value={total} emphasis />
        <StatTile label="Total saldo awal" value={opening} />
        <StatTile
          label="Perubahan bersih"
          value={total - opening}
          tone={total - opening < 0 ? "red" : "green"}
        />
        <StatTile
          label="Jumlah akun"
          value={`${tree.length} / ${accountCount}`}
          hint="main / sub"
        />
      </div>

      <AccountsView tree={tree} />
    </>
  );
}

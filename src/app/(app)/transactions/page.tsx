import { getDb } from "@/db";
import {
  getDetailsFor,
  getTransactionFormData,
  listTransactions,
  type TransactionFilters,
} from "@/db/queries";
import { PageHeader, StatTile } from "@/components/ui/primitives";
import { FilterBar } from "@/components/transactions/filter-bar";
import { TransactionsView } from "@/components/transactions/transactions-view";
import { isISODate } from "@/lib/dates";
import type { PaymentStatus, TransactionType } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const db = await getDb();
  const [rows, formData] = await Promise.all([
    listTransactions(db, filters),
    getTransactionFormData(db),
  ]);
  const { payments, attachments } = await getDetailsFor(
    db,
    rows.map((r) => r.id),
  );

  const totalIn = rows
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + r.amount, 0);
  const totalOut = rows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);
  const totalUnpaid = rows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.outstanding, 0);

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Semua pencatatan keuangan event. Klik baris mana pun untuk melihat rincian, riwayat pembayaran, dan lampirannya."
      />

      <FilterBar
        categories={formData.expenseCategories}
        accounts={formData.accounts}
        suppliers={formData.suppliers}
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Baris tampil" value={String(rows.length)} />
        <StatTile label="Pemasukan" value={totalIn} tone="green" />
        <StatTile label="Pengeluaran" value={totalOut} />
        <StatTile
          label="Belum dibayar"
          value={totalUnpaid}
          tone={totalUnpaid > 0 ? "red" : undefined}
        />
      </div>

      <TransactionsView
        rows={rows}
        details={{
          payments: Object.fromEntries(payments),
          attachments: Object.fromEntries(attachments),
        }}
        formData={formData}
        emptyTitle={
          hasAnyFilter(sp) ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"
        }
        emptyDescription={
          hasAnyFilter(sp)
            ? "Longgarkan filternya, atau reset untuk melihat seluruh transaksi."
            : "Catat pengeluaran, pemasukan, atau transfer pertama Anda."
        }
      />
    </>
  );
}

const TYPES = new Set(["expense", "income", "transfer"]);
const STATUSES = new Set(["paid", "partial", "unpaid"]);

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): TransactionFilters {
  const type = one(sp.type);
  const status = one(sp.status);
  const from = one(sp.from);
  const to = one(sp.to);
  const num = (v: string | undefined) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };

  return {
    type: type && TYPES.has(type) ? (type as TransactionType) : undefined,
    status: status && STATUSES.has(status) ? (status as PaymentStatus) : undefined,
    categoryId: num(one(sp.category)),
    accountId: num(one(sp.account)),
    supplierId: num(one(sp.supplier)),
    dateFrom: from && isISODate(from) ? from : undefined,
    dateTo: to && isISODate(to) ? to : undefined,
    search: one(sp.q),
  };
}

function hasAnyFilter(sp: Record<string, string | string[] | undefined>) {
  return ["q", "type", "status", "category", "account", "supplier", "from", "to"].some(
    (k) => Boolean(one(sp[k])),
  );
}

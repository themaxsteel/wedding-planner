import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/db";
import {
  getDetailsFor,
  getSupplier,
  getTransactionFormData,
  listTransactions,
} from "@/db/queries";
import { Card, CardHeader, PageHeader, StatTile } from "@/components/ui/primitives";
import { TransactionsView } from "@/components/transactions/transactions-view";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplierId = Number(id);
  if (!Number.isInteger(supplierId) || supplierId <= 0) notFound();

  const db = await getDb();
  const [supplier, rows, formData] = await Promise.all([
    getSupplier(db, supplierId),
    listTransactions(db, { supplierId }),
    getTransactionFormData(db),
  ]);
  if (!supplier) notFound();

  const { payments, attachments } = await getDetailsFor(
    db,
    rows.map((r) => r.id),
  );

  const contact = [
    supplier.contactPerson,
    supplier.phone,
    supplier.email,
  ].filter(Boolean);
  const bank = [supplier.bankName, supplier.bankAccount]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Link
        href="/suppliers"
        className="no-print mb-2 inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeftIcon size={11} />
        Semua supplier
      </Link>

      <PageHeader
        eyebrow={supplier.categoryName ?? "Tanpa kategori"}
        title={supplier.name}
        description={contact.length > 0 ? contact.join(" · ") : undefined}
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Transaksi" value={String(supplier.txCount)} />
        <StatTile label="Nilai kesepakatan" value={supplier.totalCommitted} />
        <StatTile label="Sudah dibayar" value={supplier.totalPaid} tone="green" />
        <StatTile
          label="Sisa kewajiban"
          value={supplier.outstanding}
          tone={supplier.outstanding > 0 ? "red" : "green"}
          emphasis
        />
      </div>

      {bank || supplier.note ? (
        <Card className="mb-3">
          <CardHeader title="Catatan vendor" />
          <div className="space-y-1.5 px-3 py-2.5 text-[12.5px]">
            {bank ? (
              <p>
                <span className="text-muted">Rekening: </span>
                <span className="tnum text-ink">{bank}</span>
              </p>
            ) : null}
            {supplier.note ? (
              <p className="whitespace-pre-wrap leading-relaxed text-ink">
                {supplier.note}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <h2 className="mb-2 text-[13px] font-semibold tracking-[-0.01em] text-ink">
        Riwayat transaksi
      </h2>
      <TransactionsView
        rows={rows}
        details={{
          payments: Object.fromEntries(payments),
          attachments: Object.fromEntries(attachments),
        }}
        formData={formData}
        showAddButton={false}
        emptyTitle="Belum ada transaksi dengan supplier ini"
        emptyDescription="Pilih supplier ini saat mencatat pengeluaran agar riwayatnya terkumpul di sini."
      />
    </>
  );
}

"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  FilePdfIcon,
  ImageIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { deletePayment, deleteTransaction } from "@/actions/transactions";
import { Sheet } from "@/components/ui/modal";
import { ActionButton } from "@/components/ui/action-button";
import {
  Badge,
  Button,
  Dot,
  Money,
  StatusBadge,
  asTone,
} from "@/components/ui/primitives";
import { formatIDR } from "@/lib/money";
import { formatDate, dueLabel, dueStatus } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/presets";
import type { AttachmentRow, PaymentRow, TransactionRow } from "@/db/queries";

const TYPE_LABEL = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer: "Transfer",
} as const;

export function TransactionDetail({
  tx,
  payments,
  attachments,
  onClose,
  onEdit,
  onAddPayment,
}: {
  tx: TransactionRow | null;
  payments: PaymentRow[];
  attachments: AttachmentRow[];
  onClose: () => void;
  onEdit: (tx: TransactionRow) => void;
  onAddPayment: (tx: TransactionRow) => void;
}) {
  if (!tx) return null;

  const isExpense = tx.type === "expense";
  const due = dueStatus(tx.dueDate);

  return (
    <Sheet
      open
      onClose={onClose}
      title={tx.description}
      description={`${TYPE_LABEL[tx.type]} · ${formatDate(tx.date)}`}
      footer={
        <>
          <ActionButton
            action={() => deleteTransaction(tx.id)}
            variant="danger"
            size="md"
            confirm={{
              title: "Hapus transaksi?",
              description: (
                <>
                  {tx.description} sebesar {formatIDR(tx.amount)} akan dihapus
                  {payments.length > 0
                    ? `, beserta ${payments.length} pembayaran yang tercatat. Saldo akun akan kembali seperti sebelum transaksi ini.`
                    : "."}{" "}
                  Tindakan ini tidak bisa dibatalkan.
                </>
              ),
            }}
            onDone={onClose}
          >
            <TrashIcon size={13} />
            Hapus
          </ActionButton>
          <Button variant="outline" onClick={() => onEdit(tx)}>
            <PencilSimpleIcon size={13} />
            Ubah
          </Button>
          {isExpense && tx.outstanding > 0 ? (
            <Button variant="solid" onClick={() => onAddPayment(tx)}>
              Catat pembayaran
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[8px] border border-line bg-sunken px-3.5 py-3">
          <p className="tnum text-[22px] font-semibold tracking-[-0.02em] text-ink">
            {formatIDR(tx.amount)}
          </p>
          {isExpense ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={tx.paymentStatus} />
              {tx.outstanding > 0 ? (
                <span className="text-[12px] text-muted">
                  Terbayar{" "}
                  <span className="tnum text-ink">{formatIDR(tx.paid)}</span> ·
                  sisa{" "}
                  <span className="tnum font-semibold text-red-fg">
                    {formatIDR(tx.outstanding)}
                  </span>
                </span>
              ) : (
                <span className="text-[12px] text-muted">Tidak ada sisa hutang</span>
              )}
            </div>
          ) : null}
        </div>

        <dl className="divide-y divide-[var(--c-border)] overflow-hidden rounded-[8px] border border-line">
          {tx.type === "transfer" ? (
            <Row label="Perpindahan">
              <span className="inline-flex items-center gap-1.5">
                {tx.accountName}
                <ArrowRightIcon size={12} className="text-faint" />
                {tx.toAccountName}
              </span>
            </Row>
          ) : (
            <>
              <Row label={isExpense ? "Kategori" : "Pos pemasukan"}>
                <span className="inline-flex items-center gap-1.5">
                  <Dot tone={asTone(tx.categoryColor)} />
                  {tx.parentCategoryName
                    ? `${tx.parentCategoryName} › ${tx.categoryName}`
                    : (tx.categoryName ?? "—")}
                </span>
              </Row>
              <Row label="Supplier">{tx.supplierName ?? "—"}</Row>
              <Row label={isExpense ? "Sumber dana" : "Masuk ke akun"}>
                {tx.accountName}
              </Row>
            </>
          )}
          {tx.dueDate ? (
            <Row label="Jatuh tempo">
              <span className="inline-flex items-center gap-2">
                {formatDate(tx.dueDate)}
                {tx.outstanding > 0 ? (
                  <Badge
                    tone={
                      due === "overdue" ? "red" : due === "soon" ? "yellow" : "neutral"
                    }
                  >
                    {dueLabel(tx.dueDate)}
                  </Badge>
                ) : null}
              </span>
            </Row>
          ) : null}
          {tx.note ? <Row label="Catatan">{tx.note}</Row> : null}
        </dl>

        {tx.type !== "transfer" ? (
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
              Riwayat pembayaran
            </h3>
            {payments.length === 0 ? (
              <p className="rounded-[6px] border border-dashed border-line px-3 py-3 text-center text-[12px] text-muted">
                Belum ada pembayaran. Seluruh nilai transaksi tercatat sebagai
                hutang.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--c-border)] overflow-hidden rounded-[8px] border border-line">
                {payments.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]"
                  >
                    <span className="tnum w-5 shrink-0 text-[11px] text-faint">
                      {i + 1}.
                    </span>
                    <span className="tnum w-[86px] shrink-0 text-muted">
                      {formatDate(p.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {p.accountName} ·{" "}
                      {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ??
                        p.method}
                    </span>
                    <Money value={p.amount} className="font-medium" />
                    <ActionButton
                      action={() => deletePayment(p.id)}
                      aria-label="Hapus pembayaran"
                      className="w-6 px-0 hover:text-red-fg"
                      confirm={{
                        title: "Hapus pembayaran?",
                        description: `Pembayaran ${formatIDR(p.amount)} pada ${formatDate(p.date)} akan dihapus. Saldo ${p.accountName} bertambah kembali dan sisa hutang naik.`,
                      }}
                    >
                      <TrashIcon size={12} />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {attachments.length > 0 ? (
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
              Lampiran
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/api/attachments/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-[220px] items-center gap-1.5 rounded-[5px] border border-line bg-surface px-2 py-1 text-[12px] text-ink transition-colors hover:bg-hover"
                  >
                    {a.mime === "application/pdf" ? (
                      <FilePdfIcon size={13} className="shrink-0 text-faint" />
                    ) : (
                      <ImageIcon size={13} className="shrink-0 text-faint" />
                    )}
                    <span className="truncate">{a.originalName}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-3 py-1.5 text-[12.5px]">
      <dt className="w-[104px] shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  PaperclipIcon,
  PlusIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  Badge,
  Dot,
  EmptyState,
  Money,
  StatusBadge,
  asTone,
  Button,
} from "@/components/ui/primitives";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, dueLabel, dueStatus } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { TransactionForm, type TransactionFormData } from "./transaction-form";
import { TransactionDetail } from "./transaction-detail";
import { PaymentDialog, type PayableTarget } from "./payment-dialog";
import type { AttachmentRow, PaymentRow, TransactionRow } from "@/db/queries";
import type { TransactionType } from "@/db/schema";

export type DetailMaps = {
  payments: Record<number, PaymentRow[]>;
  attachments: Record<number, AttachmentRow[]>;
};

/**
 * Semua interaksi transaksi hidup di satu komponen: daftar, panel detail,
 * form tambah/ubah, dan dialog cicilan. Panel-panel itu saling memanggil
 * (detail -> ubah, detail -> catat pembayaran), jadi memisahkannya hanya
 * memindahkan kerumitan ke koordinasi antar komponen.
 */
export function TransactionsView({
  rows,
  details,
  formData,
  emptyTitle = "Belum ada transaksi",
  emptyDescription = "Catat pengeluaran, pemasukan, atau transfer pertama Anda.",
  showAddButton = true,
}: {
  rows: TransactionRow[];
  details: DetailMaps;
  formData: TransactionFormData;
  emptyTitle?: string;
  emptyDescription?: string;
  showAddButton?: boolean;
}) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [formType, setFormType] = React.useState<TransactionType>("expense");
  const [editing, setEditing] = React.useState<TransactionRow | null>(null);
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const [payTarget, setPayTarget] = React.useState<PayableTarget | null>(null);

  const detail = detailId ? (rows.find((r) => r.id === detailId) ?? null) : null;

  // Setelah data di-refresh oleh Server Action, baris yang sedang dibuka
  // bisa saja hilang (terhapus / tak lolos filter) - tutup panelnya.
  React.useEffect(() => {
    if (detailId && !rows.some((r) => r.id === detailId)) setDetailId(null);
  }, [rows, detailId]);

  function openNew(type: TransactionType) {
    setEditing(null);
    setFormType(type);
    setFormOpen(true);
  }

  function openEdit(tx: TransactionRow) {
    setDetailId(null);
    setEditing(tx);
    setFormType(tx.type);
    setFormOpen(true);
  }

  return (
    <>
      {showAddButton ? (
        <div className="no-print mb-3 flex flex-wrap gap-1.5">
          <Button variant="solid" onClick={() => openNew("expense")}>
            <PlusIcon size={12} weight="bold" />
            Pengeluaran
          </Button>
          <Button onClick={() => openNew("income")}>
            <PlusIcon size={12} weight="bold" />
            Pemasukan
          </Button>
          <Button onClick={() => openNew("transfer")}>
            <PlusIcon size={12} weight="bold" />
            Transfer
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[8px] border border-line bg-surface">
        {rows.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={
              showAddButton ? (
                <Button variant="solid" onClick={() => openNew("expense")}>
                  Catat pengeluaran pertama
                </Button>
              ) : null
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="w-[92px]">Tanggal</Th>
                  <Th>Keterangan</Th>
                  <Th className="w-[170px]">Kategori</Th>
                  <Th className="w-[140px]">Supplier</Th>
                  <Th className="w-[120px]">Akun</Th>
                  <Th className="w-[110px]">Status</Th>
                  <Th numeric className="w-[130px]">
                    Nominal
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr
                    key={row.id}
                    onClick={() => setDetailId(row.id)}
                    className="cursor-pointer"
                  >
                    <Td className="tnum whitespace-nowrap text-muted">
                      {formatDate(row.date)}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">
                          {row.description}
                        </span>
                        {row.attachmentCount > 0 ? (
                          <PaperclipIcon
                            size={11}
                            className="shrink-0 text-faint"
                            aria-label={`${row.attachmentCount} lampiran`}
                          />
                        ) : null}
                      </span>
                    </Td>
                    <Td className="text-muted">
                      {row.type === "transfer" ? (
                        <span className="inline-flex items-center gap-1 text-faint">
                          {row.accountName}
                          <ArrowRightIcon size={10} />
                          {row.toAccountName}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Dot tone={asTone(row.categoryColor)} />
                          <span className="truncate">
                            {row.parentCategoryName ?? row.categoryName}
                            {row.parentCategoryName ? (
                              <span className="text-faint">
                                {" › "}
                                {row.categoryName}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      )}
                    </Td>
                    <Td className="truncate text-muted">
                      {row.supplierName ?? "—"}
                    </Td>
                    <Td className="truncate text-muted">{row.accountName}</Td>
                    <Td>
                      <StatusCell row={row} />
                    </Td>
                    <Td numeric>
                      <span
                        className={cn(
                          "font-medium",
                          row.type === "income" && "text-green-fg",
                          row.type === "transfer" && "text-muted",
                        )}
                      >
                        {row.type === "income" ? "+" : row.type === "expense" ? "−" : ""}
                        {new Intl.NumberFormat("id-ID").format(row.amount)}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>

      <TransactionForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        data={formData}
        editing={editing}
        defaultType={formType}
      />

      <TransactionDetail
        tx={detail}
        payments={detail ? (details.payments[detail.id] ?? []) : []}
        attachments={detail ? (details.attachments[detail.id] ?? []) : []}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
        onAddPayment={(tx) => {
          setDetailId(null);
          setPayTarget({
            id: tx.id,
            description: tx.description,
            supplierName: tx.supplierName,
            amount: tx.amount,
            paid: tx.paid,
            outstanding: tx.outstanding,
            dueDate: tx.dueDate,
          });
        }}
      />

      <PaymentDialog
        target={payTarget}
        accounts={formData.accounts}
        onClose={() => setPayTarget(null)}
      />
    </>
  );
}

function StatusCell({ row }: { row: TransactionRow }) {
  if (row.type === "transfer") return <Badge tone="neutral">Transfer</Badge>;
  if (row.type === "income") return <Badge tone="green">Diterima</Badge>;

  const due = dueStatus(row.dueDate);
  return (
    <span className="flex flex-wrap items-center gap-1">
      <StatusBadge status={row.paymentStatus} />
      {row.outstanding > 0 && due === "overdue" ? (
        <Badge tone="red">{dueLabel(row.dueDate)}</Badge>
      ) : null}
    </span>
  );
}

export { Money };

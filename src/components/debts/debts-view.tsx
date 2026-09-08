"use client";

import * as React from "react";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import {
  Badge,
  Button,
  EmptyState,
  Progress,
  StatusBadge,
} from "@/components/ui/primitives";
import { Table, TableWrap, Td, Th, TotalRow, Tr } from "@/components/ui/table";
import { SegmentedGroup, SegmentedOption } from "@/components/ui/field";
import { PaymentDialog, type PayableTarget } from "@/components/transactions/payment-dialog";
import { formatIDR, budgetHealth } from "@/lib/money";
import { formatDate, dueLabel, dueStatus } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { DebtRow, SupplierDebtGroup } from "@/db/queries";
import type { AccountOption } from "@/components/transactions/transaction-form";

export function DebtsView({
  debts,
  groups,
  accounts,
}: {
  debts: DebtRow[];
  groups: SupplierDebtGroup[];
  accounts: AccountOption[];
}) {
  const [view, setView] = React.useState<"item" | "supplier">("item");
  const [target, setTarget] = React.useState<PayableTarget | null>(null);

  const totalOutstanding = debts.reduce((s, d) => s + d.outstanding, 0);
  const totalAmount = debts.reduce((s, d) => s + d.amount, 0);
  const totalPaid = debts.reduce((s, d) => s + d.paid, 0);

  function pay(d: DebtRow) {
    setTarget({
      id: d.id,
      description: d.description,
      supplierName: d.supplierName,
      amount: d.amount,
      paid: d.paid,
      outstanding: d.outstanding,
      dueDate: d.dueDate,
    });
  }

  if (debts.length === 0) {
    return (
      <div className="rounded-[8px] border border-line bg-surface">
        <EmptyState
          title="Tidak ada hutang yang belum lunas"
          description="Setiap pengeluaran yang Anda tandai belum dibayar atau baru dibayar sebagian akan muncul di sini, lengkap dengan sisa dan jatuh temponya."
        />
      </div>
    );
  }

  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <SegmentedGroup>
          <SegmentedOption
            name="debtview"
            value="item"
            checked={view === "item"}
            onChange={() => setView("item")}
          >
            Per transaksi
          </SegmentedOption>
          <SegmentedOption
            name="debtview"
            value="supplier"
            checked={view === "supplier"}
            onChange={() => setView("supplier")}
          >
            Per supplier
          </SegmentedOption>
        </SegmentedGroup>
        <p className="text-[12px] text-muted">
          {debts.length} tagihan belum lunas ke {groups.length} pihak
        </p>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-line bg-surface">
        {view === "item" ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="w-[92px]">Jatuh tempo</Th>
                  <Th>Keterangan</Th>
                  <Th className="w-[150px]">Supplier</Th>
                  <Th className="w-[150px]">Kategori</Th>
                  <Th numeric className="w-[115px]">
                    Nilai
                  </Th>
                  <Th numeric className="w-[115px]">
                    Terbayar
                  </Th>
                  <Th numeric className="w-[120px]">
                    Sisa
                  </Th>
                  <Th className="w-[96px]" />
                </tr>
              </thead>
              <tbody>
                {debts.map((d) => (
                  <Tr key={d.id}>
                    <Td className="whitespace-nowrap">
                      <DueCell dueDate={d.dueDate} />
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{d.description}</span>
                        <StatusBadge status={d.paymentStatus} />
                      </span>
                    </Td>
                    <Td className="truncate text-muted">
                      {d.supplierName ?? "—"}
                    </Td>
                    <Td className="truncate text-muted">
                      {d.parentCategoryName ?? d.categoryName ?? "—"}
                    </Td>
                    <Td numeric className="text-muted">
                      {formatIDR(d.amount)}
                    </Td>
                    <Td numeric className="text-muted">
                      {d.paid > 0 ? formatIDR(d.paid) : "—"}
                    </Td>
                    <Td numeric className="font-semibold text-red-fg">
                      {formatIDR(d.outstanding)}
                    </Td>
                    <Td>
                      <Button size="sm" variant="outline" onClick={() => pay(d)}>
                        Bayar
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
              <tfoot>
                <TotalRow>
                  <Td colSpan={4} className="text-[12px] font-semibold">
                    Total
                  </Td>
                  <Td numeric>{formatIDR(totalAmount)}</Td>
                  <Td numeric>{formatIDR(totalPaid)}</Td>
                  <Td numeric className="text-red-fg">
                    {formatIDR(totalOutstanding)}
                  </Td>
                  <Td />
                </TotalRow>
              </tfoot>
            </Table>
          </TableWrap>
        ) : (
          <ul className="divide-y divide-[var(--c-border)]">
            {groups.map((g) => (
              <SupplierGroup
                key={g.supplierId ?? "none"}
                group={g}
                onPay={pay}
              />
            ))}
          </ul>
        )}
      </div>

      <PaymentDialog
        target={target}
        accounts={accounts}
        onClose={() => setTarget(null)}
      />
    </>
  );
}

function SupplierGroup({
  group,
  onPay,
}: {
  group: SupplierDebtGroup;
  onPay: (d: DebtRow) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-hover"
      >
        <CaretRightIcon
          size={12}
          className={cn(
            "shrink-0 text-faint transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">
            {group.supplierName}
          </p>
          <p className="text-[11.5px] text-faint">
            {group.itemCount} tagihan
            {group.nearestDueDate
              ? ` · terdekat ${formatDate(group.nearestDueDate)}`
              : ""}
          </p>
        </div>
        <div className="hidden w-[180px] shrink-0 sm:block">
          <Progress
            used={group.paid}
            total={group.amount}
            health={budgetHealth(group.paid, group.amount)}
          />
          <p className="tnum mt-1 text-right text-[11px] text-faint">
            {formatIDR(group.paid)} / {formatIDR(group.amount)}
          </p>
        </div>
        <p className="tnum w-[130px] shrink-0 text-right text-[13px] font-semibold text-red-fg">
          {formatIDR(group.outstanding)}
        </p>
      </button>

      {open ? (
        <ul className="animate-fade border-t border-line bg-sunken">
          {group.items.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 pl-8 text-[12.5px]"
            >
              <span className="w-[92px] shrink-0">
                <DueCell dueDate={d.dueDate} />
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">
                {d.description}
              </span>
              <span className="tnum text-muted">
                {formatIDR(d.paid)} / {formatIDR(d.amount)}
              </span>
              <span className="tnum w-[120px] text-right font-semibold text-red-fg">
                {formatIDR(d.outstanding)}
              </span>
              <Button size="sm" variant="outline" onClick={() => onPay(d)}>
                Bayar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function DueCell({ dueDate }: { dueDate: string | null }) {
  const status = dueStatus(dueDate);
  if (!dueDate) return <span className="text-faint">Tanpa tempo</span>;

  return (
    <span className="flex flex-col gap-0.5">
      <span className="tnum text-muted">{formatDate(dueDate)}</span>
      {status === "overdue" || status === "soon" ? (
        <Badge tone={status === "overdue" ? "red" : "yellow"}>
          {dueLabel(dueDate)}
        </Badge>
      ) : null}
    </span>
  );
}

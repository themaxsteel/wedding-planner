import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/db";
import {
  getCashflowSeries,
  getDashboard,
  getDetailsFor,
  getTransactionFormData,
} from "@/db/queries";
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  Dot,
  EmptyState,
  PageHeader,
  Progress,
  StatTile,
  asTone,
} from "@/components/ui/primitives";
import { TransactionsView } from "@/components/transactions/transactions-view";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { budgetHealth, formatIDR, percentOf } from "@/lib/money";
import { formatDate, formatDateLong, dueLabel, dueStatus } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = await getDb();
  const d = await getDashboard(db);
  const [cashflow, formData, { payments, attachments }] = await Promise.all([
    getCashflowSeries(db),
    getTransactionFormData(db),
    getDetailsFor(
      db,
      d.recentTransactions.map((r) => r.id),
    ),
  ]);

  const topCategories = [...d.expenseTree]
    .filter((n) => n.budget > 0 || n.committed > 0)
    .sort((a, b) => percentOf(b.committed, b.budget) - percentOf(a.committed, a.budget))
    .slice(0, 6);

  const funded = d.income.committed;
  const shortfall = d.expense.committed - funded;

  return (
    <>
      <PageHeader
        eyebrow={
          d.event.eventDate
            ? `${formatDateLong(d.event.eventDate)}${
                d.daysToEvent !== null && d.daysToEvent >= 0
                  ? ` · ${d.daysToEvent} hari lagi`
                  : ""
              }`
            : "Tanggal event belum diisi"
        }
        title={d.event.name}
        description="Angka Terpakai memuat komitmen ke vendor walau belum dibayar. Kas Keluar hanya yang sudah benar-benar keluar dari rekening. Selisihnya adalah hutang."
      />

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
        <StatTile
          label="Total budget"
          value={d.expense.budget}
          hint={`${d.expenseTree.length} kategori`}
        />
        <StatTile
          label="Terpakai"
          value={d.expense.committed}
          hint={`${percentOf(d.expense.committed, d.expense.budget)}% dari budget`}
        />
        <StatTile label="Kas keluar" value={d.expense.paid} hint="sudah dibayar" />
        <StatTile
          label="Sisa budget"
          value={d.expense.remaining}
          tone={d.expense.remaining < 0 ? "red" : "green"}
          emphasis
        />
        <StatTile
          label="Saldo seluruh akun"
          value={d.totalBalance}
          hint={`${d.accountTree.length} main account`}
        />
        <StatTile
          label="Total hutang"
          value={d.totalDebt}
          tone={d.totalDebt > 0 ? "red" : "green"}
          emphasis
          hint={`${d.debtCount} tagihan belum lunas`}
        />
      </div>

      {d.overBudget.length > 0 ? (
        <Callout tone="red" className="mb-3">
          <strong className="font-semibold">
            {d.overBudget.length} kategori melebihi budget:
          </strong>{" "}
          {d.overBudget
            .map((n) => `${n.name} (+${formatIDR(n.committed - n.budget)})`)
            .join(", ")}
          .
        </Callout>
      ) : null}

      {shortfall > 0 && funded > 0 ? (
        <Callout tone="yellow" className="mb-3">
          Komitmen pengeluaran melebihi dana yang sudah masuk sebesar{" "}
          <strong className="font-semibold">{formatIDR(shortfall)}</strong>.
          Pastikan sumber dana berikutnya sudah pasti sebelum menambah
          kesepakatan baru.
        </Callout>
      ) : null}

      <div className="mb-3 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Arus kas & komitmen"
            description="Garis biru: saldo riil. Garis putus-putus: total yang sudah dijanjikan ke vendor."
          />
          <CashflowChart data={cashflow} />
        </Card>

        <Card>
          <CardHeader
            title="Jatuh tempo terdekat"
            description="Hutang yang lewat tempo atau jatuh dalam 14 hari."
            action={
              <Link
                href="/debts"
                className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
              >
                Semua hutang
                <ArrowRightIcon size={11} />
              </Link>
            }
          />
          {d.urgentDebts.length === 0 ? (
            <EmptyState
              title="Tidak ada yang mendesak"
              description="Belum ada tagihan yang jatuh tempo dalam dua minggu ke depan."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-[var(--c-border)]">
              {d.urgentDebts.slice(0, 6).map((debt) => {
                const status = dueStatus(debt.dueDate);
                return (
                  <li
                    key={debt.id}
                    className="flex items-center gap-2.5 px-3 py-2 text-[12.5px]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {debt.description}
                      </p>
                      <p className="truncate text-[11.5px] text-faint">
                        {debt.supplierName ?? "Tanpa supplier"} ·{" "}
                        {formatDate(debt.dueDate)}
                      </p>
                    </div>
                    <Badge tone={status === "overdue" ? "red" : "yellow"}>
                      {dueLabel(debt.dueDate)}
                    </Badge>
                    <span className="tnum w-[110px] shrink-0 text-right font-semibold text-red-fg">
                      {formatIDR(debt.outstanding)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title="Pos paling terpakai"
            description="Diurutkan dari persentase pemakaian budget tertinggi."
            action={
              <Link
                href="/budget"
                className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
              >
                Semua budget
                <ArrowRightIcon size={11} />
              </Link>
            }
          />
          {topCategories.length === 0 ? (
            <EmptyState
              title="Belum ada pemakaian budget"
              description="Catat pengeluaran pertama untuk melihat perbandingannya di sini."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-[var(--c-border)]">
              {topCategories.map((node) => (
                <li key={node.id} className="px-3 py-2">
                  <div className="mb-1 flex items-baseline gap-2">
                    <Dot tone={asTone(node.color)} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
                      {node.name}
                    </span>
                    <span className="tnum text-[11.5px] text-muted">
                      {formatIDR(node.committed)}
                      <span className="text-faint"> / {formatIDR(node.budget)}</span>
                    </span>
                  </div>
                  <Progress
                    used={node.committed}
                    total={node.budget}
                    health={budgetHealth(node.committed, node.budget)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Saldo per akun"
            description="Sub account adalah tempat transaksi; main account hanya menjumlahkan."
            action={
              <Link
                href="/accounts"
                className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
              >
                Kelola akun
                <ArrowRightIcon size={11} />
              </Link>
            }
          />
          <ul className="divide-y divide-[var(--c-border)]">
            {d.accountTree.map((group) => (
              <li key={group.id} className="px-3 py-2">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
                    {group.name}
                  </span>
                  <span className="tnum text-[12.5px] font-semibold text-ink">
                    {formatIDR(group.balance)}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {group.accounts.map((acc) => (
                    <li
                      key={acc.id}
                      className="flex items-baseline gap-2 pl-2 text-[11.5px]"
                    >
                      <span className="min-w-0 flex-1 truncate text-muted">
                        {acc.name}
                      </span>
                      <span className="tnum text-muted">
                        {formatIDR(acc.balance)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
            Transaksi terakhir
          </h2>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
          >
            Semua transaksi
            <ArrowRightIcon size={11} />
          </Link>
        </div>
        <TransactionsView
          rows={d.recentTransactions}
          details={{
            payments: Object.fromEntries(payments),
            attachments: Object.fromEntries(attachments),
          }}
          formData={formData}
        />
      </section>
    </>
  );
}

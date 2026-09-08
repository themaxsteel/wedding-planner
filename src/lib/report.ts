import "server-only";

import { getDb } from "@/db";
import {
  getAccountTree,
  getBudgetTree,
  getCashbook,
  getEvent,
  getOutstandingDebts,
  listSuppliers,
  listTransactions,
  summarizeBudget,
} from "@/db/queries";
import { formatDate, formatDateLong, todayISO } from "./dates";

/**
 * Satu bentuk data untuk semua saluran laporan: halaman Laporan di layar,
 * file Excel, dan file PDF. Sekali dihitung, tiga tempat memakainya, jadi
 * ketiganya dijamin menunjukkan angka yang sama.
 */
export async function buildReport() {
  const db = await getDb();

  const [event, expenseTree, incomeTree, accountTree, debts, transactions, suppliersRaw] =
    await Promise.all([
      getEvent(db),
      getBudgetTree(db, "expense", { includeArchived: true }),
      getBudgetTree(db, "income", { includeArchived: true }),
      getAccountTree(db, { includeArchived: true }),
      getOutstandingDebts(db),
      listTransactions(db, { limit: 5000 }),
      listSuppliers(db, { includeArchived: true }),
    ]);

  const expense = summarizeBudget(expenseTree);
  const income = summarizeBudget(incomeTree);
  const totalBalance = accountTree.reduce((s, g) => s + g.balance, 0);

  const cashbookTargets = accountTree.flatMap((group) =>
    group.accounts.map((account) => ({ groupName: group.name, account })),
  );
  const cashbooks = await Promise.all(
    cashbookTargets.map(async (target) => ({
      ...target,
      entries: await getCashbook(db, target.account.id),
    })),
  );

  return {
    event,
    generatedAt: todayISO(),
    title: event.name,
    subtitle: event.eventDate
      ? `Hari-H ${formatDateLong(event.eventDate)}`
      : "Tanggal hari-H belum ditentukan",
    expense,
    income,
    expenseTree,
    incomeTree,
    accountTree,
    totalBalance,
    debts,
    debtTotal: debts.reduce((s, d) => s + d.outstanding, 0),
    transactions,
    suppliers: suppliersRaw.filter((s) => s.txCount > 0 || !s.archived),
    cashbooks,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

/** Nama file unduhan: "Laporan Keuangan - Nama Event - 2026-09-08.xlsx" */
export function reportFileName(report: Report, ext: string) {
  const safe = report.event.name.replace(/[^\p{L}\p{N} _-]/gu, "").trim();
  return `Laporan Keuangan - ${safe || "Wedding"} - ${report.generatedAt}.${ext}`;
}

export const TYPE_LABEL: Record<string, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer: "Transfer",
};

export const STATUS_LABEL: Record<string, string> = {
  paid: "Lunas",
  partial: "Sebagian",
  unpaid: "Belum bayar",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  payment: "Pembayaran",
  transfer_in: "Transfer masuk",
  transfer_out: "Transfer keluar",
};

export { formatDate };

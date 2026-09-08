import ExcelJS from "exceljs";
import {
  buildReport,
  reportFileName,
  STATUS_LABEL,
  TYPE_LABEL,
  MOVEMENT_LABEL,
  formatDate,
} from "@/lib/report";

export const dynamic = "force-dynamic";

const RP = '"Rp" #,##0;[Red]-"Rp" #,##0';
const INK = "FF2F3437";
const MUTED = "FF787774";
const LINE = "FFE8E7E3";

/**
 * Lima lembar yang menjawab lima pertanyaan berbeda:
 * budget vs realisasi, arus kas per akun, sisa kewajiban ke vendor,
 * rekap per vendor, dan seluruh transaksi mentah untuk diolah sendiri.
 */
export async function GET() {
  const report = await buildReport();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Wedding Finance Planner";
  wb.created = new Date();

  buildSummarySheet(wb, report);
  buildBudgetSheet(wb, report);
  buildDebtSheet(wb, report);
  buildSupplierSheet(wb, report);
  buildTransactionSheet(wb, report);
  buildCashbookSheet(wb, report);

  const buffer = await wb.xlsx.writeBuffer();

  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        reportFileName(report, "xlsx"),
      )}`,
      "Cache-Control": "no-store",
    },
  });
}

type Report = Awaited<ReturnType<typeof buildReport>>;

function titleRow(ws: ExcelJS.Worksheet, text: string, span: number) {
  const row = ws.addRow([text]);
  row.font = { bold: true, size: 13, color: { argb: INK } };
  ws.mergeCells(row.number, 1, row.number, span);
  return row;
}

function headerRow(ws: ExcelJS.Worksheet, values: string[]) {
  const row = ws.addRow(values);
  row.font = { bold: true, size: 10, color: { argb: MUTED } };
  row.eachCell((cell) => {
    cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
  });
  return row;
}

function money(ws: ExcelJS.Worksheet, columns: number[]) {
  for (const c of columns) ws.getColumn(c).numFmt = RP;
}

function buildSummarySheet(wb: ExcelJS.Workbook, r: Report) {
  const ws = wb.addWorksheet("Ringkasan");
  ws.columns = [{ width: 32 }, { width: 20 }, { width: 46 }];

  titleRow(ws, r.title, 3);
  ws.addRow([r.subtitle]).font = { color: { argb: MUTED }, size: 10 };
  ws.addRow([`Laporan dibuat ${formatDate(r.generatedAt)}`]).font = {
    color: { argb: MUTED },
    size: 10,
  };
  ws.addRow([]);

  headerRow(ws, ["Pos", "Nilai", "Keterangan"]);

  const rows: [string, number, string][] = [
    ["Target total budget", r.event.totalBudgetTarget, "Ditetapkan saat setup"],
    ["Total budget dialokasikan", r.expense.budget, "Jumlah budget per kategori"],
    [
      "Terpakai (akrual)",
      r.expense.committed,
      "Seluruh nilai transaksi, termasuk yang belum dibayar",
    ],
    ["Kas keluar", r.expense.paid, "Yang benar-benar sudah dibayar"],
    ["Sisa budget", r.expense.remaining, "Budget dikurangi terpakai"],
    ["Total hutang supplier", r.debtTotal, "Terpakai dikurangi kas keluar"],
    ["Total pemasukan", r.income.committed, "Seluruh dana masuk"],
    ["Saldo seluruh akun", r.totalBalance, "Saldo awal + kas masuk - kas keluar"],
  ];

  for (const [label, value, note] of rows) {
    const row = ws.addRow([label, value, note]);
    row.getCell(3).font = { color: { argb: MUTED }, size: 10 };
  }
  money(ws, [2]);

  ws.addRow([]);
  headerRow(ws, ["Akun", "Saldo", "Jenis"]);
  for (const group of r.accountTree) {
    const g = ws.addRow([group.name, group.balance, "Main account"]);
    g.font = { bold: true };
    for (const acc of group.accounts) {
      ws.addRow([`    ${acc.name}`, acc.balance, "Sub account"]).getCell(
        3,
      ).font = { color: { argb: MUTED }, size: 10 };
    }
  }
  money(ws, [2]);
}

function buildBudgetSheet(wb: ExcelJS.Workbook, r: Report) {
  const ws = wb.addWorksheet("Budget vs Realisasi");
  ws.columns = [
    { width: 30 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 12 },
  ];

  titleRow(ws, "Budget vs Realisasi", 7);
  ws.addRow([]);
  headerRow(ws, [
    "Kategori",
    "Budget",
    "Terpakai",
    "Kas keluar",
    "Belum dibayar",
    "Sisa",
    "% terpakai",
  ]);

  for (const node of r.expenseTree) {
    const row = ws.addRow([
      node.name,
      node.budget,
      node.committed,
      node.paid,
      node.outstanding,
      node.remaining,
      node.budget > 0 ? node.committed / node.budget : null,
    ]);
    row.font = { bold: true };
    if (node.remaining < 0) {
      row.getCell(6).font = { bold: true, color: { argb: "FF9F2F2D" } };
    }
    for (const child of node.children) {
      ws.addRow([
        `    ${child.name}`,
        null,
        child.committed,
        child.paid,
        child.outstanding,
        null,
        null,
      ]).font = { color: { argb: MUTED }, size: 10 };
    }
  }

  const total = ws.addRow([
    "TOTAL",
    r.expense.budget,
    r.expense.committed,
    r.expense.paid,
    r.expense.outstanding,
    r.expense.remaining,
    r.expense.budget > 0 ? r.expense.committed / r.expense.budget : null,
  ]);
  total.font = { bold: true };
  total.eachCell((cell) => {
    cell.border = { top: { style: "thin", color: { argb: INK } } };
  });

  money(ws, [2, 3, 4, 5, 6]);
  ws.getColumn(7).numFmt = "0%";

  ws.addRow([]);
  headerRow(ws, ["Sumber dana", "Realisasi"]);
  for (const node of r.incomeTree) {
    ws.addRow([node.name, node.committed]).font = { bold: true };
    for (const child of node.children) {
      ws.addRow([`    ${child.name}`, child.committed]).font = {
        color: { argb: MUTED },
        size: 10,
      };
    }
  }
  ws.addRow(["TOTAL PEMASUKAN", r.income.committed]).font = { bold: true };
}

function buildDebtSheet(wb: ExcelJS.Workbook, r: Report) {
  const ws = wb.addWorksheet("Daftar Hutang");
  ws.columns = [
    { width: 13 },
    { width: 34 },
    { width: 22 },
    { width: 20 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 13 },
  ];

  titleRow(ws, "Hutang supplier yang belum lunas", 8);
  ws.addRow([]);
  headerRow(ws, [
    "Jatuh tempo",
    "Keterangan",
    "Supplier",
    "Kategori",
    "Nilai",
    "Terbayar",
    "Sisa",
    "Status",
  ]);

  for (const d of r.debts) {
    ws.addRow([
      d.dueDate ? formatDate(d.dueDate) : "—",
      d.description,
      d.supplierName ?? "—",
      d.parentCategoryName ?? d.categoryName ?? "—",
      d.amount,
      d.paid,
      d.outstanding,
      STATUS_LABEL[d.paymentStatus] ?? d.paymentStatus,
    ]);
  }

  const total = ws.addRow([
    "TOTAL",
    null,
    null,
    null,
    r.debts.reduce((s, d) => s + d.amount, 0),
    r.debts.reduce((s, d) => s + d.paid, 0),
    r.debtTotal,
    null,
  ]);
  total.font = { bold: true };
  money(ws, [5, 6, 7]);
}

function buildSupplierSheet(wb: ExcelJS.Workbook, r: Report) {
  const ws = wb.addWorksheet("Supplier");
  ws.columns = [
    { width: 28 },
    { width: 20 },
    { width: 18 },
    { width: 24 },
    { width: 9 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  titleRow(ws, "Rekap per supplier", 8);
  ws.addRow([]);
  headerRow(ws, [
    "Nama",
    "Kategori",
    "Kontak",
    "Rekening",
    "Tx",
    "Nilai",
    "Terbayar",
    "Sisa",
  ]);

  for (const s of r.suppliers) {
    ws.addRow([
      s.name,
      s.categoryName ?? "—",
      s.phone ?? s.email ?? "—",
      [s.bankName, s.bankAccount].filter(Boolean).join(" ") || "—",
      s.txCount,
      s.totalCommitted,
      s.totalPaid,
      s.outstanding,
    ]);
  }
  money(ws, [6, 7, 8]);
}

function buildTransactionSheet(wb: ExcelJS.Workbook, r: Report) {
  const ws = wb.addWorksheet("Transaksi");
  ws.columns = [
    { width: 13 },
    { width: 13 },
    { width: 36 },
    { width: 22 },
    { width: 20 },
    { width: 22 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 13 },
    { width: 13 },
  ];

  titleRow(ws, "Seluruh transaksi", 11);
  ws.addRow([]);
  headerRow(ws, [
    "Tanggal",
    "Jenis",
    "Keterangan",
    "Kategori",
    "Sub-kategori",
    "Supplier",
    "Akun",
    "Nominal",
    "Terbayar",
    "Sisa",
    "Status",
  ]);

  for (const t of r.transactions) {
    ws.addRow([
      formatDate(t.date),
      TYPE_LABEL[t.type] ?? t.type,
      t.description,
      t.parentCategoryName ?? t.categoryName ?? "—",
      t.parentCategoryName ? t.categoryName : "—",
      t.supplierName ?? "—",
      t.type === "transfer"
        ? `${t.accountName} → ${t.toAccountName}`
        : t.accountName,
      t.amount,
      t.paid,
      t.outstanding,
      t.type === "transfer" ? "—" : (STATUS_LABEL[t.paymentStatus] ?? ""),
    ]);
  }
  money(ws, [8, 9, 10]);
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 11 } };
}

function buildCashbookSheet(wb: ExcelJS.Workbook, r: Report) {
  const ws = wb.addWorksheet("Buku Kas");
  ws.columns = [
    { width: 13 },
    { width: 36 },
    { width: 18 },
    { width: 22 },
    { width: 16 },
    { width: 18 },
  ];

  titleRow(ws, "Buku kas per sub account", 6);
  ws.addRow([]);

  for (const book of r.cashbooks) {
    const head = ws.addRow([
      `${book.groupName} › ${book.account.name}`,
      null,
      null,
      null,
      "Saldo akhir",
      book.account.balance,
    ]);
    head.font = { bold: true, size: 11 };
    head.getCell(6).numFmt = RP;

    headerRow(ws, [
      "Tanggal",
      "Keterangan",
      "Jenis",
      "Pihak / akun",
      "Mutasi",
      "Saldo",
    ]);

    const opening = ws.addRow([
      "",
      "Saldo awal",
      "",
      "",
      null,
      book.account.openingBalance,
    ]);
    opening.font = { color: { argb: MUTED }, italic: true };
    opening.getCell(6).numFmt = RP;

    for (const e of book.entries) {
      const row = ws.addRow([
        formatDate(e.date),
        e.description,
        MOVEMENT_LABEL[e.kind] ?? e.kind,
        e.counterparty ?? "—",
        e.delta,
        e.balance,
      ]);
      row.getCell(5).numFmt = RP;
      row.getCell(6).numFmt = RP;
    }

    ws.addRow([]);
  }
}

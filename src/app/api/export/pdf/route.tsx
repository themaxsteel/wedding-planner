import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  buildReport,
  reportFileName,
  STATUS_LABEL,
  formatDate,
  type Report,
} from "@/lib/report";
import { formatIDR } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Ringkasan cetak untuk dibagikan ke klien atau keluarga: kondisi budget,
 * saldo tiap akun, dan sisa kewajiban ke vendor. Rincian transaksi baris
 * per baris ada di file Excel, bukan di sini.
 */
export async function GET() {
  const report = await buildReport();
  const buffer = await renderToBuffer(<ReportDocument report={report} />);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        reportFileName(report, "pdf"),
      )}`,
      "Cache-Control": "no-store",
    },
  });
}

const INK = "#2f3437";
const MUTED = "#787774";
const FAINT = "#9b9a97";
const LINE = "#e8e7e3";
const RED = "#9f2f2d";
const GREEN = "#346538";

const s = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 42,
    paddingHorizontal: 40,
    fontSize: 8.5,
    color: INK,
    fontFamily: "Helvetica",
  },
  h1: { fontSize: 18, fontFamily: "Times-Roman" },
  sub: { fontSize: 9, color: MUTED, marginTop: 3 },
  section: { marginTop: 18 },
  h2: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 8 },
  kpi: {
    width: "23.5%",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  kpiLabel: { fontSize: 6.5, color: FAINT, letterSpacing: 0.5 },
  kpiValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 3 },
  kpiHint: { fontSize: 6.5, color: FAINT, marginTop: 2 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingVertical: 3.5,
  },
  headRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 3,
  },
  th: { fontSize: 6.5, color: FAINT, letterSpacing: 0.4 },
  cell: { fontSize: 8 },
  num: { fontSize: 8, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  red: { color: RED },
  green: { color: GREEN },
  indent: { paddingLeft: 10, color: MUTED, fontSize: 7.5 },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 4,
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    fontSize: 7,
    color: FAINT,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
  },
  note: { fontSize: 7.5, color: MUTED, marginTop: 6, lineHeight: 1.5 },
});

function ReportDocument({ report }: { report: Report }) {
  return (
    <Document
      title={reportFileName(report, "pdf")}
      author="Wedding Finance Planner"
    >
      <Page size="A4" style={s.page}>
        <View>
          <Text style={s.h1}>{report.title}</Text>
          <Text style={s.sub}>
            {report.subtitle} · Laporan keuangan per{" "}
            {formatDate(report.generatedAt)}
          </Text>
        </View>

        <View style={s.kpiRow}>
          <Kpi label="TOTAL BUDGET" value={report.expense.budget} />
          <Kpi
            label="TERPAKAI"
            value={report.expense.committed}
            hint="termasuk yang belum dibayar"
          />
          <Kpi
            label="KAS KELUAR"
            value={report.expense.paid}
            hint="sudah dibayar"
          />
          <Kpi
            label="SISA BUDGET"
            value={report.expense.remaining}
            color={report.expense.remaining < 0 ? RED : GREEN}
          />
          <Kpi label="TOTAL PEMASUKAN" value={report.income.committed} />
          <Kpi label="SALDO SELURUH AKUN" value={report.totalBalance} />
          <Kpi
            label="TOTAL HUTANG"
            value={report.debtTotal}
            color={report.debtTotal > 0 ? RED : GREEN}
            hint={`${report.debts.length} tagihan`}
          />
          <Kpi
            label="TARGET BUDGET"
            value={report.event.totalBudgetTarget}
            hint="ditetapkan saat setup"
          />
        </View>

        <Text style={s.note}>
          Terpakai dihitung dari nilai seluruh transaksi pengeluaran, termasuk
          yang belum dibayar. Kas keluar hanya mencatat uang yang benar-benar
          sudah keluar dari rekening. Selisih keduanya adalah total hutang ke
          supplier.
        </Text>

        <View style={s.section}>
          <Text style={s.h2}>Budget vs realisasi</Text>
          <View style={s.headRow}>
            <Text style={[s.th, { flex: 3 }]}>KATEGORI</Text>
            <Text style={[s.th, { flex: 1.4, textAlign: "right" }]}>BUDGET</Text>
            <Text style={[s.th, { flex: 1.4, textAlign: "right" }]}>
              TERPAKAI
            </Text>
            <Text style={[s.th, { flex: 1.4, textAlign: "right" }]}>
              KAS KELUAR
            </Text>
            <Text style={[s.th, { flex: 1.4, textAlign: "right" }]}>SISA</Text>
          </View>

          {report.expenseTree.map((node) => (
            <View key={node.id} style={s.row} wrap={false}>
              <Text style={[s.cell, s.bold, { flex: 3 }]}>{node.name}</Text>
              <Text style={[s.num, { flex: 1.4 }]}>
                {formatIDR(node.budget)}
              </Text>
              <Text style={[s.num, { flex: 1.4 }]}>
                {formatIDR(node.committed)}
              </Text>
              <Text style={[s.num, s.muted, { flex: 1.4 }]}>
                {formatIDR(node.paid)}
              </Text>
              <Text
                style={[
                  s.num,
                  s.bold,
                  { flex: 1.4 },
                  node.remaining < 0 ? s.red : {},
                ]}
              >
                {formatIDR(node.remaining)}
              </Text>
            </View>
          ))}

          <View style={s.totalRow}>
            <Text style={[s.cell, s.bold, { flex: 3 }]}>TOTAL</Text>
            <Text style={[s.num, s.bold, { flex: 1.4 }]}>
              {formatIDR(report.expense.budget)}
            </Text>
            <Text style={[s.num, s.bold, { flex: 1.4 }]}>
              {formatIDR(report.expense.committed)}
            </Text>
            <Text style={[s.num, s.bold, { flex: 1.4 }]}>
              {formatIDR(report.expense.paid)}
            </Text>
            <Text
              style={[
                s.num,
                s.bold,
                { flex: 1.4 },
                report.expense.remaining < 0 ? s.red : {},
              ]}
            >
              {formatIDR(report.expense.remaining)}
            </Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Saldo per akun</Text>
          {report.accountTree.map((group) => (
            <View key={group.id} wrap={false}>
              <View style={s.row}>
                <Text style={[s.cell, s.bold, { flex: 4 }]}>{group.name}</Text>
                <Text style={[s.num, s.bold, { flex: 1.6 }]}>
                  {formatIDR(group.balance)}
                </Text>
              </View>
              {group.accounts.map((acc) => (
                <View key={acc.id} style={s.row}>
                  <Text style={[s.cell, s.indent, { flex: 4 }]}>
                    {acc.name}
                    {acc.accountNumber ? ` · ${acc.accountNumber}` : ""}
                  </Text>
                  <Text style={[s.num, s.muted, { flex: 1.6 }]}>
                    {formatIDR(acc.balance)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <Footer report={report} />
      </Page>

      <Page size="A4" style={s.page}>
        <View>
          <Text style={s.h2}>Daftar hutang supplier</Text>
          {report.debts.length === 0 ? (
            <Text style={s.note}>
              Tidak ada tagihan yang belum lunas per {formatDate(report.generatedAt)}.
            </Text>
          ) : (
            <>
              <View style={s.headRow}>
                <Text style={[s.th, { flex: 1.3 }]}>JATUH TEMPO</Text>
                <Text style={[s.th, { flex: 3 }]}>KETERANGAN</Text>
                <Text style={[s.th, { flex: 2 }]}>SUPPLIER</Text>
                <Text style={[s.th, { flex: 1.4, textAlign: "right" }]}>
                  NILAI
                </Text>
                <Text style={[s.th, { flex: 1.4, textAlign: "right" }]}>
                  TERBAYAR
                </Text>
                <Text style={[s.th, { flex: 1.4, textAlign: "right" }]}>
                  SISA
                </Text>
                <Text style={[s.th, { flex: 1.2 }]}>STATUS</Text>
              </View>

              {report.debts.map((d) => (
                <View key={d.id} style={s.row} wrap={false}>
                  <Text style={[s.cell, s.muted, { flex: 1.3 }]}>
                    {d.dueDate ? formatDate(d.dueDate) : "—"}
                  </Text>
                  <Text style={[s.cell, { flex: 3 }]}>{d.description}</Text>
                  <Text style={[s.cell, s.muted, { flex: 2 }]}>
                    {d.supplierName ?? "—"}
                  </Text>
                  <Text style={[s.num, { flex: 1.4 }]}>
                    {formatIDR(d.amount)}
                  </Text>
                  <Text style={[s.num, s.muted, { flex: 1.4 }]}>
                    {formatIDR(d.paid)}
                  </Text>
                  <Text style={[s.num, s.bold, s.red, { flex: 1.4 }]}>
                    {formatIDR(d.outstanding)}
                  </Text>
                  <Text style={[s.cell, s.muted, { flex: 1.2 }]}>
                    {STATUS_LABEL[d.paymentStatus]}
                  </Text>
                </View>
              ))}

              <View style={s.totalRow}>
                <Text style={[s.cell, s.bold, { flex: 6.3 }]}>TOTAL</Text>
                <Text style={[s.num, s.bold, { flex: 1.4 }]}>
                  {formatIDR(report.debts.reduce((x, d) => x + d.amount, 0))}
                </Text>
                <Text style={[s.num, s.bold, { flex: 1.4 }]}>
                  {formatIDR(report.debts.reduce((x, d) => x + d.paid, 0))}
                </Text>
                <Text style={[s.num, s.bold, s.red, { flex: 1.4 }]}>
                  {formatIDR(report.debtTotal)}
                </Text>
                <Text style={[s.cell, { flex: 1.2 }]}> </Text>
              </View>
            </>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Sumber dana</Text>
          <View style={s.headRow}>
            <Text style={[s.th, { flex: 4 }]}>POS PEMASUKAN</Text>
            <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>
              REALISASI
            </Text>
          </View>
          {report.incomeTree.map((node) => (
            <View key={node.id} style={s.row} wrap={false}>
              <Text style={[s.cell, { flex: 4 }]}>{node.name}</Text>
              <Text style={[s.num, s.green, { flex: 1.6 }]}>
                {formatIDR(node.committed)}
              </Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.cell, s.bold, { flex: 4 }]}>TOTAL PEMASUKAN</Text>
            <Text style={[s.num, s.bold, { flex: 1.6 }]}>
              {formatIDR(report.income.committed)}
            </Text>
          </View>
        </View>

        <Footer report={report} />
      </Page>
    </Document>
  );
}

function Kpi({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: number;
  hint?: string;
  color?: string;
}) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, color ? { color } : {}]}>
        {formatIDR(value)}
      </Text>
      {hint ? <Text style={s.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

function Footer({ report }: { report: Report }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {report.title} · dibuat {formatDate(report.generatedAt)}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Halaman ${pageNumber} dari ${totalPages}`
        }
      />
    </View>
  );
}

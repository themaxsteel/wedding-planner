import { FileXlsIcon, FilePdfIcon } from "@phosphor-icons/react/dist/ssr";
import {
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
  StatTile,
} from "@/components/ui/primitives";
import { Table, TableWrap, Td, Th, TotalRow, Tr } from "@/components/ui/table";
import { buildReport, STATUS_LABEL } from "@/lib/report";
import { formatIDR, percentOf } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PrintButton } from "@/components/reports/print-button";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const r = await buildReport();

  return (
    <>
      <PageHeader
        title="Laporan"
        description="Rekap siap dibagikan ke klien atau keluarga. Excel memuat seluruh rincian termasuk buku kas per akun; PDF berisi ringkasan dua halaman."
        action={
          <>
            <PrintButton />
            <LinkButton href="/api/export/xlsx" prefetch={false}>
              <FileXlsIcon size={13} />
              Excel
            </LinkButton>
            <LinkButton href="/api/export/pdf" prefetch={false} variant="solid">
              <FilePdfIcon size={13} />
              PDF
            </LinkButton>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
        <StatTile label="Total budget" value={r.expense.budget} />
        <StatTile
          label="Terpakai"
          value={r.expense.committed}
          hint={`${percentOf(r.expense.committed, r.expense.budget)}% dari budget`}
        />
        <StatTile label="Kas keluar" value={r.expense.paid} />
        <StatTile
          label="Sisa budget"
          value={r.expense.remaining}
          tone={r.expense.remaining < 0 ? "red" : "green"}
        />
        <StatTile label="Pemasukan" value={r.income.committed} tone="green" />
        <StatTile
          label="Total hutang"
          value={r.debtTotal}
          tone={r.debtTotal > 0 ? "red" : "green"}
        />
      </div>

      <Card className="mb-3">
        <CardHeader
          title="Budget vs realisasi"
          description="Terpakai memuat komitmen yang belum dibayar; Kas keluar hanya yang sudah dibayar."
        />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Kategori</Th>
                <Th numeric className="w-[130px]">
                  Budget
                </Th>
                <Th numeric className="w-[130px]">
                  Terpakai
                </Th>
                <Th numeric className="w-[130px]">
                  Kas keluar
                </Th>
                <Th numeric className="w-[130px]">
                  Belum dibayar
                </Th>
                <Th numeric className="w-[130px]">
                  Sisa
                </Th>
                <Th numeric className="w-[70px]">
                  %
                </Th>
              </tr>
            </thead>
            <tbody>
              {r.expenseTree.map((node) => (
                <Tr key={node.id}>
                  <Td className="font-medium">{node.name}</Td>
                  <Td numeric className="text-muted">
                    {formatIDR(node.budget)}
                  </Td>
                  <Td numeric>{formatIDR(node.committed)}</Td>
                  <Td numeric className="text-muted">
                    {formatIDR(node.paid)}
                  </Td>
                  <Td
                    numeric
                    className={node.outstanding > 0 ? "text-red-fg" : "text-faint"}
                  >
                    {node.outstanding > 0 ? formatIDR(node.outstanding) : "—"}
                  </Td>
                  <Td
                    numeric
                    className={
                      node.remaining < 0 ? "font-semibold text-red-fg" : ""
                    }
                  >
                    {formatIDR(node.remaining)}
                  </Td>
                  <Td numeric className="text-muted">
                    {node.budget > 0
                      ? `${percentOf(node.committed, node.budget)}%`
                      : "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
            <tfoot>
              <TotalRow>
                <Td>Total</Td>
                <Td numeric>{formatIDR(r.expense.budget)}</Td>
                <Td numeric>{formatIDR(r.expense.committed)}</Td>
                <Td numeric>{formatIDR(r.expense.paid)}</Td>
                <Td numeric className="text-red-fg">
                  {formatIDR(r.expense.outstanding)}
                </Td>
                <Td
                  numeric
                  className={r.expense.remaining < 0 ? "text-red-fg" : ""}
                >
                  {formatIDR(r.expense.remaining)}
                </Td>
                <Td numeric>
                  {percentOf(r.expense.committed, r.expense.budget)}%
                </Td>
              </TotalRow>
            </tfoot>
          </Table>
        </TableWrap>
      </Card>

      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Arus kas per akun" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Akun</Th>
                  <Th numeric className="w-[110px]">
                    Saldo awal
                  </Th>
                  <Th numeric className="w-[110px]">
                    Masuk
                  </Th>
                  <Th numeric className="w-[110px]">
                    Keluar
                  </Th>
                  <Th numeric className="w-[120px]">
                    Saldo
                  </Th>
                </tr>
              </thead>
              <tbody>
                {r.accountTree.flatMap((group) => [
                  <Tr key={`g${group.id}`} className="bg-sunken">
                    <Td className="font-semibold">{group.name}</Td>
                    <Td numeric />
                    <Td numeric />
                    <Td numeric />
                    <Td numeric className="font-semibold">
                      {formatIDR(group.balance)}
                    </Td>
                  </Tr>,
                  ...group.accounts.map((acc) => (
                    <Tr key={`a${acc.id}`}>
                      <Td className="pl-6 text-muted">{acc.name}</Td>
                      <Td numeric className="text-muted">
                        {formatIDR(acc.openingBalance)}
                      </Td>
                      <Td numeric className="text-green-fg">
                        {formatIDR(acc.cashIn + acc.transferIn)}
                      </Td>
                      <Td numeric className="text-red-fg">
                        {formatIDR(acc.cashOut + acc.transferOut)}
                      </Td>
                      <Td numeric className="font-medium">
                        {formatIDR(acc.balance)}
                      </Td>
                    </Tr>
                  )),
                ])}
              </tbody>
              <tfoot>
                <TotalRow>
                  <Td colSpan={4}>Total saldo</Td>
                  <Td numeric>{formatIDR(r.totalBalance)}</Td>
                </TotalRow>
              </tfoot>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader title="Sumber dana" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Pos pemasukan</Th>
                  <Th numeric className="w-[90px]">
                    Transaksi
                  </Th>
                  <Th numeric className="w-[140px]">
                    Realisasi
                  </Th>
                </tr>
              </thead>
              <tbody>
                {r.incomeTree.map((node) => (
                  <Tr key={node.id}>
                    <Td className="font-medium">{node.name}</Td>
                    <Td numeric className="text-muted">
                      {node.txCount}
                    </Td>
                    <Td numeric className="text-green-fg">
                      {formatIDR(node.committed)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
              <tfoot>
                <TotalRow>
                  <Td colSpan={2}>Total</Td>
                  <Td numeric>{formatIDR(r.income.committed)}</Td>
                </TotalRow>
              </tfoot>
            </Table>
          </TableWrap>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Daftar hutang"
          description={`${r.debts.length} tagihan belum lunas per ${formatDate(r.generatedAt)}.`}
        />
        {r.debts.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-muted">
            Tidak ada kewajiban terbuka ke supplier.
          </p>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="w-[92px]">Jatuh tempo</Th>
                  <Th>Keterangan</Th>
                  <Th className="w-[150px]">Supplier</Th>
                  <Th numeric className="w-[120px]">
                    Nilai
                  </Th>
                  <Th numeric className="w-[120px]">
                    Terbayar
                  </Th>
                  <Th numeric className="w-[120px]">
                    Sisa
                  </Th>
                  <Th className="w-[100px]">Status</Th>
                </tr>
              </thead>
              <tbody>
                {r.debts.map((d) => (
                  <Tr key={d.id}>
                    <Td className="tnum whitespace-nowrap text-muted">
                      {d.dueDate ? formatDate(d.dueDate) : "—"}
                    </Td>
                    <Td className="font-medium">{d.description}</Td>
                    <Td className="text-muted">{d.supplierName ?? "—"}</Td>
                    <Td numeric className="text-muted">
                      {formatIDR(d.amount)}
                    </Td>
                    <Td numeric className="text-muted">
                      {formatIDR(d.paid)}
                    </Td>
                    <Td numeric className="font-semibold text-red-fg">
                      {formatIDR(d.outstanding)}
                    </Td>
                    <Td className="text-muted">
                      {STATUS_LABEL[d.paymentStatus]}
                    </Td>
                  </Tr>
                ))}
              </tbody>
              <tfoot>
                <TotalRow>
                  <Td colSpan={5}>Total sisa kewajiban</Td>
                  <Td numeric className="text-red-fg">
                    {formatIDR(r.debtTotal)}
                  </Td>
                  <Td />
                </TotalRow>
              </tfoot>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

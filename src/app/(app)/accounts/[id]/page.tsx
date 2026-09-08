import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/db";
import { getAccountBalances, getAccountTree, getCashbook } from "@/db/queries";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatTile,
} from "@/components/ui/primitives";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatIDR } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  payment: "Pembayaran",
  transfer_in: "Transfer masuk",
  transfer_out: "Transfer keluar",
} as const;

export default async function CashbookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) notFound();

  const db = await getDb();
  const [balances, groupTree, entries] = await Promise.all([
    getAccountBalances(db),
    getAccountTree(db, { includeArchived: true }),
    getCashbook(db, accountId),
  ]);

  const account = balances.find((a) => a.id === accountId);
  if (!account) notFound();

  const group = groupTree.find((g) => g.id === account.groupId);

  return (
    <>
      <Link
        href="/accounts"
        className="no-print mb-2 inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeftIcon size={11} />
        Semua akun
      </Link>

      <PageHeader
        eyebrow={group?.name}
        title={account.name}
        description={
          [
            account.accountNumber ? `No. ${account.accountNumber}` : null,
            account.holderName ? `a.n. ${account.holderName}` : null,
            account.note,
          ]
            .filter(Boolean)
            .join(" · ") || "Buku kas: seluruh mutasi urut tanggal."
        }
        action={
          <Link
            href={`/transactions?account=${account.id}`}
            className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
          >
            Transaksi akun ini
            <ArrowRightIcon size={11} />
          </Link>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Saldo saat ini" value={account.balance} emphasis />
        <StatTile label="Saldo awal" value={account.openingBalance} />
        <StatTile
          label="Total masuk"
          value={account.cashIn + account.transferIn}
          tone="green"
        />
        <StatTile
          label="Total keluar"
          value={account.cashOut + account.transferOut}
          tone="red"
        />
      </div>

      <Card>
        {entries.length === 0 ? (
          <EmptyState
            title="Belum ada mutasi"
            description="Saldo akun ini masih sama dengan saldo awalnya. Pengeluaran yang belum dibayar tidak muncul di sini karena uangnya memang belum keluar."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="w-[92px]">Tanggal</Th>
                  <Th>Keterangan</Th>
                  <Th className="w-[130px]">Jenis</Th>
                  <Th className="w-[150px]">Pihak / akun</Th>
                  <Th numeric className="w-[130px]">
                    Mutasi
                  </Th>
                  <Th numeric className="w-[140px]">
                    Saldo
                  </Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <Tr key={e.key}>
                    <Td className="tnum whitespace-nowrap text-muted">
                      {formatDate(e.date)}
                    </Td>
                    <Td className="truncate font-medium">{e.description}</Td>
                    <Td>
                      <Badge
                        tone={
                          e.kind === "payment"
                            ? e.txType === "income"
                              ? "green"
                              : "red"
                            : "neutral"
                        }
                      >
                        {KIND_LABEL[e.kind]}
                      </Badge>
                    </Td>
                    <Td className="truncate text-muted">
                      {e.counterparty ?? "—"}
                    </Td>
                    <Td
                      numeric
                      className={
                        e.delta >= 0 ? "text-green-fg" : "text-red-fg"
                      }
                    >
                      {e.delta >= 0 ? "+" : "−"}
                      {formatIDR(Math.abs(e.delta)).replace("Rp ", "")}
                    </Td>
                    <Td numeric className="font-semibold">
                      {formatIDR(e.balance)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {entries.length > 0 ? (
        <p className="mt-2 text-[11.5px] text-faint">
          Baris terakhir selalu sama dengan saldo akun di halaman Assets
          Account — keduanya dihitung dari sumber yang sama.
        </p>
      ) : null}
    </>
  );
}

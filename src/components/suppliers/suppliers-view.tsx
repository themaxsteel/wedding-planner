"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  ArchiveIcon,
  ArrowClockwiseIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  archiveSupplier,
  deleteSupplier,
  submitSupplier,
} from "@/actions/master";
import { Dialog } from "@/components/ui/modal";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Button, Card, EmptyState } from "@/components/ui/primitives";
import { Table, TableWrap, Td, Th, TotalRow, Tr } from "@/components/ui/table";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldError } from "@/components/ui/form";
import { formatIDR } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { SupplierRow } from "@/db/queries";

export function SuppliersView({
  suppliers,
  categories,
}: {
  suppliers: SupplierRow[];
  categories: { id: number; name: string }[];
}) {
  const [draft, setDraft] = React.useState<SupplierRow | "new" | null>(null);

  const totalCommitted = suppliers.reduce((s, x) => s + x.totalCommitted, 0);
  const totalPaid = suppliers.reduce((s, x) => s + x.totalPaid, 0);
  const totalOutstanding = suppliers.reduce((s, x) => s + x.outstanding, 0);

  return (
    <>
      <div className="no-print mb-3">
        <Button variant="solid" onClick={() => setDraft("new")}>
          <PlusIcon size={12} weight="bold" />
          Supplier baru
        </Button>
      </div>

      <Card>
        {suppliers.length === 0 ? (
          <EmptyState
            title="Belum ada supplier"
            description="Mendaftarkan vendor membuat daftar hutang bisa dikelompokkan per pihak, dan riwayat tiap vendor bisa dibuka sendiri."
            action={
              <Button variant="solid" onClick={() => setDraft("new")}>
                Tambah supplier pertama
              </Button>
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th className="w-[150px]">Kategori</Th>
                  <Th className="w-[130px]">Kontak</Th>
                  <Th numeric className="w-[70px]">
                    Tx
                  </Th>
                  <Th numeric className="w-[130px]">
                    Nilai
                  </Th>
                  <Th numeric className="w-[130px]">
                    Terbayar
                  </Th>
                  <Th numeric className="w-[130px]">
                    Sisa hutang
                  </Th>
                  <Th className="w-[90px]" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <Tr key={s.id} className={cn(s.archived && "opacity-55")}>
                    <Td>
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="flex items-center gap-1.5 font-medium hover:underline"
                      >
                        <span className="truncate">{s.name}</span>
                        {s.archived ? <Badge tone="neutral">Arsip</Badge> : null}
                      </Link>
                    </Td>
                    <Td className="truncate text-muted">
                      {s.categoryName ?? "—"}
                    </Td>
                    <Td className="tnum truncate text-muted">
                      {s.phone ?? s.email ?? "—"}
                    </Td>
                    <Td numeric className="text-muted">
                      {s.txCount}
                    </Td>
                    <Td numeric className="text-muted">
                      {formatIDR(s.totalCommitted)}
                    </Td>
                    <Td numeric className="text-muted">
                      {formatIDR(s.totalPaid)}
                    </Td>
                    <Td
                      numeric
                      className={cn(
                        "font-semibold",
                        s.outstanding > 0 ? "text-red-fg" : "text-muted",
                      )}
                    >
                      {formatIDR(s.outstanding)}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Ubah ${s.name}`}
                          onClick={() => setDraft(s)}
                          className="w-6 px-0"
                        >
                          <PencilSimpleIcon size={12} />
                        </Button>
                        <ActionButton
                          action={() => archiveSupplier(s.id, !s.archived)}
                          aria-label={s.archived ? "Aktifkan" : "Arsipkan"}
                          title={s.archived ? "Aktifkan kembali" : "Arsipkan"}
                          className="w-6 px-0"
                        >
                          {s.archived ? (
                            <ArrowClockwiseIcon size={12} />
                          ) : (
                            <ArchiveIcon size={12} />
                          )}
                        </ActionButton>
                        <ActionButton
                          action={() => deleteSupplier(s.id)}
                          aria-label={`Hapus ${s.name}`}
                          className="w-6 px-0 hover:text-red-fg"
                          confirm={{
                            title: `Hapus ${s.name}?`,
                            description:
                              "Supplier yang sudah dipakai di transaksi tidak bisa dihapus — arsipkan saja.",
                          }}
                        >
                          <TrashIcon size={12} />
                        </ActionButton>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
              <tfoot>
                <TotalRow>
                  <Td colSpan={4} className="text-[12px] font-semibold">
                    Total
                  </Td>
                  <Td numeric>{formatIDR(totalCommitted)}</Td>
                  <Td numeric>{formatIDR(totalPaid)}</Td>
                  <Td numeric className="text-red-fg">
                    {formatIDR(totalOutstanding)}
                  </Td>
                  <Td />
                </TotalRow>
              </tfoot>
            </Table>
          </TableWrap>
        )}
      </Card>

      <SupplierDialog
        draft={draft}
        categories={categories}
        onClose={() => setDraft(null)}
      />
    </>
  );
}

export function SupplierDialog({
  draft,
  categories,
  onClose,
}: {
  draft: SupplierRow | "new" | null;
  categories: { id: number; name: string }[];
  onClose: () => void;
}) {
  const [result, action] = useActionState(submitSupplier, null);

  React.useEffect(() => {
    if (result?.ok) onClose();
  }, [result, onClose]);

  if (!draft) return null;
  const s = draft === "new" ? null : draft;

  return (
    <Dialog
      open
      onClose={onClose}
      title={s ? `Ubah ${s.name}` : "Supplier baru"}
      description="Data rekening membantu saat mencatat pembayaran termin."
    >
      <form action={action} className="space-y-3.5">
        {s ? <input type="hidden" name="id" value={s.id} /> : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label="Nama" htmlFor="sname" error={fieldError(result, "name")}>
            <Input
              id="sname"
              name="name"
              required
              maxLength={120}
              defaultValue={s?.name ?? ""}
              autoFocus
            />
          </Field>
          <Field label="Kategori" htmlFor="scategory" hint="opsional">
            <Select
              id="scategory"
              name="categoryId"
              defaultValue={s?.categoryId ?? ""}
            >
              <option value="">Tanpa kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama kontak" htmlFor="scontact" hint="opsional">
            <Input
              id="scontact"
              name="contactPerson"
              maxLength={120}
              defaultValue={s?.contactPerson ?? ""}
            />
          </Field>
          <Field label="No. HP" htmlFor="sphone" hint="opsional">
            <Input
              id="sphone"
              name="phone"
              maxLength={40}
              defaultValue={s?.phone ?? ""}
            />
          </Field>
        </div>

        <Field label="Email" htmlFor="semail" hint="opsional">
          <Input
            id="semail"
            name="email"
            maxLength={120}
            defaultValue={s?.email ?? ""}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <Field label="Bank" htmlFor="sbank" hint="opsional">
            <Input
              id="sbank"
              name="bankName"
              maxLength={80}
              defaultValue={s?.bankName ?? ""}
            />
          </Field>
          <Field label="No. rekening" htmlFor="saccount" hint="opsional">
            <Input
              id="saccount"
              name="bankAccount"
              maxLength={60}
              defaultValue={s?.bankAccount ?? ""}
              className="tnum"
            />
          </Field>
        </div>

        <Field label="Catatan" htmlFor="snote" hint="opsional">
          <Textarea
            id="snote"
            name="note"
            maxLength={500}
            defaultValue={s?.note ?? ""}
            placeholder="Isi paket, syarat DP, jadwal termin, dsb."
          />
        </Field>

        <FormMessage result={result} />

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <SubmitButton>Simpan</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

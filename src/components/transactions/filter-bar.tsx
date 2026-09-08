"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/field";
import type { AccountOption, CategoryOption, SupplierOption } from "./transaction-form";

/**
 * Filter disimpan di URL, bukan di state komponen — supaya tampilan yang
 * sedang dilihat bisa di-bookmark, di-refresh, dan ditautkan dari halaman
 * lain (mis. "lihat semua transaksi kategori Dekorasi").
 */
export function FilterBar({
  categories,
  accounts,
  suppliers,
}: {
  categories: CategoryOption[];
  accounts: AccountOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const get = (key: string) => params.get(key) ?? "";

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  // Pencarian di-debounce agar tidak menembak server tiap ketikan.
  const [search, setSearch] = React.useState(get("q"));
  React.useEffect(() => setSearch(get("q")), [params]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (search === get("q")) return;
    const t = window.setTimeout(() => setParam("q", search), 300);
    return () => window.clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = [
    "q",
    "type",
    "status",
    "category",
    "account",
    "supplier",
    "from",
    "to",
  ].filter((k) => params.get(k)).length;

  const parents = categories.filter((c) => c.isParent);

  return (
    <div
      className={`no-print mb-3 flex flex-wrap items-center gap-2 transition-opacity ${pending ? "opacity-60" : ""}`}
    >
      <div className="relative min-w-[180px] flex-1">
        <MagnifyingGlassIcon
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari keterangan, supplier, catatan…"
          className="pl-7"
          aria-label="Cari transaksi"
        />
      </div>

      <Select
        value={get("type")}
        onChange={(e) => setParam("type", e.target.value)}
        className="w-[130px]"
        aria-label="Jenis transaksi"
      >
        <option value="">Semua jenis</option>
        <option value="expense">Pengeluaran</option>
        <option value="income">Pemasukan</option>
        <option value="transfer">Transfer</option>
      </Select>

      <Select
        value={get("status")}
        onChange={(e) => setParam("status", e.target.value)}
        className="w-[130px]"
        aria-label="Status pembayaran"
      >
        <option value="">Semua status</option>
        <option value="paid">Lunas</option>
        <option value="partial">Sebagian</option>
        <option value="unpaid">Belum bayar</option>
      </Select>

      <Select
        value={get("category")}
        onChange={(e) => setParam("category", e.target.value)}
        className="w-[150px]"
        aria-label="Kategori"
      >
        <option value="">Semua kategori</option>
        {parents.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select
        value={get("account")}
        onChange={(e) => setParam("account", e.target.value)}
        className="w-[130px]"
        aria-label="Akun"
      >
        <option value="">Semua akun</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>

      <Select
        value={get("supplier")}
        onChange={(e) => setParam("supplier", e.target.value)}
        className="w-[140px]"
        aria-label="Supplier"
      >
        <option value="">Semua supplier</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      <Input
        type="date"
        value={get("from")}
        onChange={(e) => setParam("from", e.target.value)}
        className="w-[135px]"
        aria-label="Tanggal mulai"
      />
      <span className="text-[12px] text-faint">—</span>
      <Input
        type="date"
        value={get("to")}
        onChange={(e) => setParam("to", e.target.value)}
        className="w-[135px]"
        aria-label="Tanggal akhir"
      />

      {activeCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.replace(pathname))}
        >
          <XIcon size={11} weight="bold" />
          Reset {activeCount} filter
        </Button>
      ) : null}
    </div>
  );
}

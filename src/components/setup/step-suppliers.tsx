"use client";

import * as React from "react";
import { useActionState } from "react";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";
import { submitSupplier, deleteSupplier } from "@/actions/master";
import { finishSetup, goToStep } from "@/actions/setup";
import { Button, Callout, EmptyState } from "@/components/ui/primitives";
import { ActionButton } from "@/components/ui/action-button";
import { Input, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";

export type SupplierSeed = {
  id: number;
  name: string;
  categoryName: string | null;
  phone: string | null;
};

export function StepSuppliers({
  suppliers,
  categories,
}: {
  suppliers: SupplierSeed[];
  categories: { id: number; name: string }[];
}) {
  const [result, action] = useActionState(submitSupplier, null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Kosongkan form setelah supplier berhasil ditambahkan agar bisa
  // langsung mengetik yang berikutnya.
  React.useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <div className="space-y-4">
      <Callout tone="blue">
        Langkah ini opsional. Supplier yang terdaftar akan muncul sebagai
        pilihan saat mencatat pengeluaran, dan daftar hutang bisa
        dikelompokkan per supplier. Anda juga bisa menambahkannya belakangan
        sambil jalan.
      </Callout>

      <form
        ref={formRef}
        action={action}
        className="grid grid-cols-1 gap-2 rounded-[8px] border border-line bg-surface p-3 sm:grid-cols-[1fr_160px_140px_auto]"
      >
        <Input name="name" placeholder="Nama supplier / vendor" required maxLength={120} />
        <Select name="categoryId" defaultValue="" aria-label="Kategori supplier">
          <option value="">Tanpa kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input name="phone" placeholder="No. HP" maxLength={40} />
        <SubmitButton size="md" pendingLabel="…">
          <PlusIcon size={12} weight="bold" />
          Tambah
        </SubmitButton>
      </form>

      <FormMessage result={result} />

      <div className="overflow-hidden rounded-[8px] border border-line bg-surface">
        {suppliers.length === 0 ? (
          <EmptyState
            title="Belum ada supplier"
            description="Lewati saja kalau daftar vendor Anda belum final."
          />
        ) : (
          <ul className="divide-y divide-[var(--c-border)]">
            {suppliers.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {s.name}
                </span>
                <span className="hidden truncate text-[12px] text-muted sm:block">
                  {s.categoryName ?? "—"}
                </span>
                <span className="tnum hidden w-28 truncate text-right text-[12px] text-muted sm:block">
                  {s.phone ?? "—"}
                </span>
                <ActionButton
                  action={() => deleteSupplier(s.id)}
                  aria-label={`Hapus ${s.name}`}
                  className="w-7 px-0 hover:text-red-fg"
                >
                  <TrashIcon size={13} />
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-between border-t border-line pt-3">
        <Button variant="ghost" onClick={() => goToStep(4)}>
          Kembali
        </Button>
        <form action={finishSetup}>
          <SubmitButton pendingLabel="Menyiapkan…">
            {suppliers.length === 0
              ? "Lewati & mulai pakai aplikasi"
              : "Selesai & mulai pakai aplikasi"}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

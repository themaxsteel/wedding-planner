"use client";

import * as React from "react";
import { useActionState } from "react";
import { PlusIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { saveCategoriesStep, goToStep } from "@/actions/setup";
import { Button, Callout, Dot, asTone } from "@/components/ui/primitives";
import { Checkbox, Input, SegmentedGroup, SegmentedOption } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import {
  CATEGORY_COLORS,
  EXPENSE_CATEGORY_PRESETS,
  INCOME_CATEGORY_PRESETS,
} from "@/lib/presets";
import type { CategoryKind } from "@/db/schema";

type DraftChild = { key: string; name: string };

type DraftCategory = {
  key: string;
  selected: boolean;
  name: string;
  color: string;
  children: DraftChild[];
};

export type ExistingCategory = {
  kind: CategoryKind;
  name: string;
  color: string;
  children: string[];
};

const uid = () => Math.random().toString(36).slice(2, 9);

const COLOR_SWATCH: Record<string, string> = {
  neutral: "bg-neutral-fg",
  red: "bg-red-fg",
  blue: "bg-blue-fg",
  green: "bg-green-fg",
  yellow: "bg-yellow-fg",
  purple: "bg-purple-fg",
};

function fromPresets(kind: CategoryKind): DraftCategory[] {
  const presets =
    kind === "expense" ? EXPENSE_CATEGORY_PRESETS : INCOME_CATEGORY_PRESETS;
  return presets.map((p) => ({
    key: uid(),
    selected: p.defaultSelected,
    name: p.name,
    color: p.color,
    children: p.children.map((c) => ({ key: uid(), name: c })),
  }));
}

function fromExisting(rows: ExistingCategory[]): DraftCategory[] {
  return rows.map((r) => ({
    key: uid(),
    selected: true,
    name: r.name,
    color: r.color,
    children: r.children.map((c) => ({ key: uid(), name: c })),
  }));
}

export function StepCategories({
  existing,
}: {
  existing: ExistingCategory[];
}) {
  const [result, action] = useActionState(saveCategoriesStep, null);
  const [tab, setTab] = React.useState<CategoryKind>("expense");

  const existingExpense = existing.filter((e) => e.kind === "expense");
  const existingIncome = existing.filter((e) => e.kind === "income");

  const [expense, setExpense] = React.useState<DraftCategory[]>(() =>
    existingExpense.length ? fromExisting(existingExpense) : fromPresets("expense"),
  );
  const [income, setIncome] = React.useState<DraftCategory[]>(() =>
    existingIncome.length ? fromExisting(existingIncome) : fromPresets("income"),
  );

  const list = tab === "expense" ? expense : income;
  const setList = tab === "expense" ? setExpense : setIncome;

  const serialize = (rows: DraftCategory[]) =>
    rows
      .filter((c) => c.selected && c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        color: c.color,
        children: c.children
          .map((ch) => ch.name.trim())
          .filter((n) => n.length > 0),
      }));

  const payload = JSON.stringify({
    expense: serialize(expense),
    income: serialize(income),
  });

  const expenseCount = expense.filter((c) => c.selected).length;
  const incomeCount = income.filter((c) => c.selected).length;
  const blocked = expenseCount === 0 || incomeCount === 0;

  function patch(key: string, next: Partial<DraftCategory>) {
    setList((rows) => rows.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <Callout tone="blue">
        Kategori dipakai dua tingkat: <strong className="font-semibold">induk</strong>{" "}
        memegang angka budget, <strong className="font-semibold">sub-kategori</strong>{" "}
        dipilih saat mencatat transaksi. Realisasi sub-kategori otomatis
        dijumlahkan ke induknya. Centang yang Anda butuhkan — nama dan isinya
        bebas diubah.
      </Callout>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedGroup>
          <SegmentedOption
            name="kind"
            value="expense"
            checked={tab === "expense"}
            onChange={() => setTab("expense")}
          >
            Pengeluaran
            <span className="tnum text-faint">{expenseCount}</span>
          </SegmentedOption>
          <SegmentedOption
            name="kind"
            value="income"
            checked={tab === "income"}
            onChange={() => setTab("income")}
          >
            Pemasukan
            <span className="tnum text-faint">{incomeCount}</span>
          </SegmentedOption>
        </SegmentedGroup>

        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setList((rows) => rows.map((r) => ({ ...r, selected: true })))
            }
          >
            Pilih semua
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setList((rows) => rows.map((r) => ({ ...r, selected: false })))
            }
          >
            Kosongkan
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {list.map((cat, i) => (
          <CategoryRow
            key={cat.key}
            cat={cat}
            index={i}
            onPatch={(next) => patch(cat.key, next)}
            onRemove={() =>
              setList((rows) => rows.filter((r) => r.key !== cat.key))
            }
          />
        ))}
      </div>

      <Button
        onClick={() =>
          setList((rows) => [
            ...rows,
            {
              key: uid(),
              selected: true,
              name: "",
              color: "neutral",
              children: [],
            },
          ])
        }
      >
        <PlusIcon size={12} weight="bold" />
        Tambah kategori {tab === "expense" ? "pengeluaran" : "pemasukan"}
      </Button>

      {blocked ? (
        <Callout tone="yellow">
          Pilih minimal satu kategori pengeluaran dan satu kategori pemasukan.
          Saat ini: {expenseCount} pengeluaran, {incomeCount} pemasukan.
        </Callout>
      ) : null}

      <FormMessage result={result} />

      <div className="flex justify-between border-t border-line pt-3">
        <Button variant="ghost" onClick={() => goToStep(2)}>
          Kembali
        </Button>
        <SubmitButton disabled={blocked}>Lanjut ke Budget</SubmitButton>
      </div>
    </form>
  );
}

function CategoryRow({
  cat,
  index,
  onPatch,
  onRemove,
}: {
  cat: DraftCategory;
  index: number;
  onPatch: (next: Partial<DraftCategory>) => void;
  onRemove: () => void;
}) {
  const [newChild, setNewChild] = React.useState("");

  function addChild() {
    const name = newChild.trim();
    if (!name) return;
    onPatch({
      children: [...cat.children, { key: Math.random().toString(36).slice(2, 9), name }],
    });
    setNewChild("");
  }

  return (
    <div
      className={cn(
        "animate-rise group rounded-[8px] border bg-surface transition-colors duration-200",
        cat.selected ? "border-line" : "border-dashed border-line opacity-60",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Checkbox
          checked={cat.selected}
          onChange={(e) => onPatch({ selected: e.target.checked })}
          aria-label={`Pakai kategori ${cat.name || index + 1}`}
        />
        <Dot tone={asTone(cat.color)} />
        <Input
          value={cat.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Nama kategori"
          className="h-7 max-w-[240px] font-medium"
          aria-label="Nama kategori"
        />
        <div className="ml-auto flex items-center gap-1">
          {/* Warna jarang diubah, jadi disembunyikan sampai baris disentuh. */}
          <div className="flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={`Warna ${c}`}
                aria-label={`Warna ${c}`}
                onClick={() => onPatch({ color: c })}
                className={cn(
                  "size-[9px] rounded-full transition-transform duration-150 hover:scale-125",
                  COLOR_SWATCH[c],
                  cat.color === c &&
                    "outline outline-1 outline-offset-[3px] outline-ink",
                )}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={`Hapus kategori ${cat.name}`}
            className="ml-1 w-7 px-0 hover:text-red-fg"
          >
            <XIcon size={13} />
          </Button>
        </div>
      </div>

      {cat.selected ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2">
          {cat.children.map((child) => (
            <span
              key={child.key}
              className="group inline-flex items-center gap-1 rounded-full border border-line bg-sunken py-0.5 pl-2 pr-1 text-[11.5px] text-ink"
            >
              {child.name}
              <button
                type="button"
                aria-label={`Hapus sub-kategori ${child.name}`}
                onClick={() =>
                  onPatch({
                    children: cat.children.filter((c) => c.key !== child.key),
                  })
                }
                className="rounded-full p-0.5 text-faint transition-colors hover:bg-hover hover:text-red-fg"
              >
                <XIcon size={9} weight="bold" />
              </button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <input
              value={newChild}
              onChange={(e) => setNewChild(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChild();
                }
              }}
              placeholder="+ sub-kategori"
              aria-label={`Tambah sub-kategori pada ${cat.name}`}
              className="h-6 w-32 rounded-full border border-dashed border-line bg-transparent px-2 text-[11.5px] text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
            />
          </span>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  ArchiveIcon,
  ArrowClockwiseIcon,
  CaretRightIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  archiveCategory,
  deleteCategory,
  submitCategory,
} from "@/actions/master";
import { Dialog } from "@/components/ui/modal";
import { ActionButton } from "@/components/ui/action-button";
import {
  Badge,
  Button,
  Card,
  Dot,
  asTone,
} from "@/components/ui/primitives";
import {
  Field,
  Input,
  SegmentedGroup,
  SegmentedOption,
} from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldError } from "@/components/ui/form";
import { MoneyInput } from "@/components/money-input";
import { formatIDR } from "@/lib/money";
import { CATEGORY_COLORS } from "@/lib/presets";
import { cn } from "@/lib/cn";
import type { CategoryNode } from "@/db/queries";
import type { CategoryKind } from "@/db/schema";

type Draft = {
  id?: number;
  kind: CategoryKind;
  parentId: number | null;
  parentName?: string;
  name: string;
  color: string;
  budget: number;
  committed?: number;
} | null;

export function CategoriesView({
  expense,
  income,
}: {
  expense: CategoryNode[];
  income: CategoryNode[];
}) {
  const [kind, setKind] = React.useState<CategoryKind>("expense");
  const [draft, setDraft] = React.useState<Draft>(null);

  const nodes = kind === "expense" ? expense : income;

  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <SegmentedGroup>
          <SegmentedOption
            name="catkind"
            value="expense"
            checked={kind === "expense"}
            onChange={() => setKind("expense")}
          >
            Pengeluaran
            <span className="tnum text-faint">{expense.length}</span>
          </SegmentedOption>
          <SegmentedOption
            name="catkind"
            value="income"
            checked={kind === "income"}
            onChange={() => setKind("income")}
          >
            Pemasukan
            <span className="tnum text-faint">{income.length}</span>
          </SegmentedOption>
        </SegmentedGroup>

        <Button
          variant="solid"
          onClick={() =>
            setDraft({
              kind,
              parentId: null,
              name: "",
              color: "neutral",
              budget: 0,
            })
          }
        >
          <PlusIcon size={12} weight="bold" />
          Kategori induk baru
        </Button>
      </div>

      <div className="stagger space-y-2">
        {nodes.map((node, i) => (
          <CategoryCard
            key={node.id}
            node={node}
            index={i}
            kind={kind}
            onEdit={setDraft}
          />
        ))}
      </div>

      <CategoryDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

function CategoryCard({
  node,
  index,
  kind,
  onEdit,
}: {
  node: CategoryNode;
  index: number;
  kind: CategoryKind;
  onEdit: (draft: Draft) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card style={{ "--i": index } as React.CSSProperties}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5",
          node.archived && "opacity-55",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <CaretRightIcon
            size={12}
            className={cn(
              "shrink-0 text-faint transition-transform duration-200",
              open && "rotate-90",
            )}
          />
          <Dot tone={asTone(node.color)} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-ink">
                {node.name}
              </span>
              {node.archived ? <Badge tone="neutral">Arsip</Badge> : null}
            </span>
            <span className="block text-[11.5px] text-faint">
              {node.children.length} sub-kategori · {node.txCount} transaksi
            </span>
          </span>
        </button>

        {kind === "expense" ? (
          <div className="w-[150px] text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
              Budget
            </p>
            <p className="tnum text-[13px] font-semibold text-ink">
              {formatIDR(node.budget)}
            </p>
          </div>
        ) : null}

        <div className="w-[150px] text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
            Terpakai
          </p>
          <p className="tnum text-[13px] text-muted">
            {formatIDR(node.committed)}
          </p>
        </div>

        <div className="flex shrink-0 gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Ubah ${node.name}`}
            onClick={() =>
              onEdit({
                id: node.id,
                kind,
                parentId: null,
                name: node.name,
                color: node.color,
                budget: node.budget,
                committed: node.committed,
              })
            }
            className="w-7 px-0"
          >
            <PencilSimpleIcon size={13} />
          </Button>
          <ActionButton
            action={() => archiveCategory(node.id, !node.archived)}
            aria-label={node.archived ? "Aktifkan kembali" : "Arsipkan"}
            title={
              node.archived
                ? "Aktifkan kembali"
                : "Arsipkan beserta sub-kategorinya"
            }
            className="w-7 px-0"
          >
            {node.archived ? (
              <ArrowClockwiseIcon size={13} />
            ) : (
              <ArchiveIcon size={13} />
            )}
          </ActionButton>
          <ActionButton
            action={() => deleteCategory(node.id)}
            aria-label={`Hapus ${node.name}`}
            className="w-7 px-0 hover:text-red-fg"
            confirm={{
              title: `Hapus kategori ${node.name}?`,
              description:
                "Hanya bisa dihapus kalau belum punya sub-kategori dan belum pernah dipakai transaksi. Kalau sudah, arsipkan saja.",
            }}
          >
            <TrashIcon size={13} />
          </ActionButton>
        </div>
      </div>

      {open ? (
        <div className="animate-fade border-t border-line bg-sunken">
          <ul className="divide-y divide-[var(--c-border)]">
            {node.children.map((child) => (
              <li
                key={child.id}
                className="flex items-center gap-3 py-1.5 pl-8 pr-3 text-[12.5px]"
              >
                <span className="min-w-0 flex-1 truncate text-ink">
                  {child.name}
                </span>
                <span className="tnum text-faint">{child.txCount} transaksi</span>
                <span className="tnum w-[130px] text-right text-muted">
                  {formatIDR(child.committed)}
                </span>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Ubah ${child.name}`}
                    onClick={() =>
                      onEdit({
                        id: child.id,
                        kind,
                        parentId: node.id,
                        parentName: node.name,
                        name: child.name,
                        color: child.color,
                        budget: 0,
                      })
                    }
                    className="w-6 px-0"
                  >
                    <PencilSimpleIcon size={12} />
                  </Button>
                  <ActionButton
                    action={() => deleteCategory(child.id)}
                    aria-label={`Hapus ${child.name}`}
                    className="w-6 px-0 hover:text-red-fg"
                    confirm={{
                      title: `Hapus ${child.name}?`,
                      description:
                        "Sub-kategori yang sudah dipakai transaksi tidak bisa dihapus.",
                    }}
                  >
                    <TrashIcon size={12} />
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-3 py-1.5 pl-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onEdit({
                  kind,
                  parentId: node.id,
                  parentName: node.name,
                  name: "",
                  color: node.color,
                  budget: 0,
                })
              }
            >
              <PlusIcon size={12} weight="bold" />
              Tambah sub-kategori
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function CategoryDialog({
  draft,
  onClose,
}: {
  draft: Draft;
  onClose: () => void;
}) {
  const [result, action] = useActionState(submitCategory, null);
  const [color, setColor] = React.useState("neutral");

  React.useEffect(() => {
    if (draft) setColor(draft.color);
  }, [draft]);

  React.useEffect(() => {
    if (result?.ok) onClose();
  }, [result, onClose]);

  if (!draft) return null;

  const isChild = draft.parentId !== null;
  const title = draft.id
    ? `Ubah ${draft.name}`
    : isChild
      ? `Sub-kategori baru di ${draft.parentName}`
      : "Kategori induk baru";

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={
        isChild
          ? "Sub-kategori tidak punya budget sendiri — realisasinya dijumlahkan ke induknya."
          : "Kategori induk memegang angka budget untuk seluruh event."
      }
    >
      <form action={action} className="space-y-3.5">
        {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}
        <input type="hidden" name="kind" value={draft.kind} />
        <input type="hidden" name="parentId" value={draft.parentId ?? ""} />
        <input type="hidden" name="color" value={color} />

        <Field label="Nama" htmlFor="cname" error={fieldError(result, "name")}>
          <Input
            id="cname"
            name="name"
            required
            maxLength={80}
            defaultValue={draft.name}
            autoFocus
          />
        </Field>

        {!isChild && draft.kind === "expense" ? (
          <Field
            label="Budget untuk seluruh event"
            htmlFor="cbudget"
            error={fieldError(result, "budgetAmount")}
          >
            <MoneyInput
              id="cbudget"
              name="budgetAmount"
              defaultValue={draft.budget}
            />
          </Field>
        ) : (
          <input type="hidden" name="budgetAmount" value="0" />
        )}

        <Field label="Warna penanda">
          <div className="flex items-center gap-2 pt-1">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Warna ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border transition-colors",
                  color === c
                    ? "border-ink bg-hover"
                    : "border-transparent hover:bg-hover",
                )}
              >
                <Dot tone={asTone(c)} />
              </button>
            ))}
          </div>
        </Field>

        {draft.committed && draft.committed > 0 ? (
          <p className="text-[12px] leading-relaxed text-muted">
            Kategori ini sudah menampung {formatIDR(draft.committed)} transaksi.
          </p>
        ) : null}

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

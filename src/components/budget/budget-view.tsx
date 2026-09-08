"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { CaretRightIcon, PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { submitBudget } from "@/actions/master";
import {
  Badge,
  Button,
  Dot,
  Progress,
  asTone,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/modal";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/money-input";
import { budgetHealth, formatIDR, percentOf } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { CategoryNode } from "@/db/queries";

const HEALTH_TONE = {
  empty: "neutral",
  safe: "green",
  warning: "yellow",
  over: "red",
} as const;

export function BudgetView({ nodes }: { nodes: CategoryNode[] }) {
  const [editing, setEditing] = React.useState<CategoryNode | null>(null);

  return (
    <>
      <div className="stagger space-y-2">
        {nodes.map((node, i) => (
          <BudgetCard
            key={node.id}
            node={node}
            index={i}
            onEdit={() => setEditing(node)}
          />
        ))}
      </div>

      <BudgetDialog node={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function BudgetCard({
  node,
  index,
  onEdit,
}: {
  node: CategoryNode;
  index: number;
  onEdit: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const health = budgetHealth(node.committed, node.budget);
  const pct = percentOf(node.committed, node.budget);
  const hasChildren = node.children.length > 0;

  return (
    <div
      className="overflow-hidden rounded-[8px] border border-line bg-surface"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => hasChildren && setOpen((v) => !v)}
          aria-expanded={hasChildren ? open : undefined}
          disabled={!hasChildren}
          className="flex min-w-[180px] flex-1 items-center gap-2 text-left disabled:cursor-default"
        >
          <CaretRightIcon
            size={12}
            className={cn(
              "shrink-0 text-faint transition-transform duration-200",
              open && "rotate-90",
              !hasChildren && "opacity-0",
            )}
          />
          <Dot tone={asTone(node.color)} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink">
              {node.name}
            </span>
            <span className="block text-[11.5px] text-faint">
              {node.txCount} transaksi
              {hasChildren ? ` · ${node.children.length} sub-kategori` : ""}
            </span>
          </span>
        </button>

        <div className="flex w-full items-center gap-3 sm:w-auto sm:flex-1">
          <div className="min-w-[110px] flex-1">
            <Progress
              used={node.committed}
              total={node.budget}
              health={health}
              thick
            />
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="tnum text-[11.5px] text-muted">
                {formatIDR(node.committed)}
                <span className="text-faint"> / {formatIDR(node.budget)}</span>
              </span>
              <Badge tone={HEALTH_TONE[health]}>
                {node.budget > 0 ? `${pct}%` : "tanpa budget"}
              </Badge>
            </div>
          </div>

          <div className="w-[130px] shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
              {node.remaining < 0 ? "Kelebihan" : "Sisa"}
            </p>
            <p
              className={cn(
                "tnum text-[13.5px] font-semibold",
                node.remaining < 0 ? "text-red-fg" : "text-ink",
              )}
            >
              {formatIDR(Math.abs(node.remaining))}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label={`Ubah budget ${node.name}`}
            className="w-7 shrink-0 px-0"
          >
            <PencilSimpleIcon size={13} />
          </Button>
        </div>
      </div>

      {node.outstanding > 0 ? (
        <p className="border-t border-line bg-sunken px-3 py-1.5 text-[11.5px] text-muted">
          Termasuk{" "}
          <span className="tnum font-semibold text-red-fg">
            {formatIDR(node.outstanding)}
          </span>{" "}
          yang sudah dijanjikan ke vendor tapi belum dibayar.
        </p>
      ) : null}

      {open && hasChildren ? (
        <ul className="animate-fade divide-y divide-[var(--c-border)] border-t border-line bg-sunken">
          {node.children.map((child) => (
            <li
              key={child.id}
              className="flex items-center gap-3 py-1.5 pl-8 pr-3 text-[12.5px]"
            >
              <Link
                href={`/transactions?category=${node.id}`}
                className="min-w-0 flex-1 truncate text-ink hover:underline"
              >
                {child.name}
              </Link>
              <span className="tnum text-faint">{child.txCount} tx</span>
              {child.outstanding > 0 ? (
                <span className="tnum text-red-fg">
                  −{formatIDR(child.outstanding)} belum bayar
                </span>
              ) : null}
              <span className="tnum w-[120px] text-right font-medium text-ink">
                {formatIDR(child.committed)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function BudgetDialog({
  node,
  onClose,
}: {
  node: CategoryNode | null;
  onClose: () => void;
}) {
  const [result, action] = useActionState(submitBudget, null);

  React.useEffect(() => {
    if (result?.ok) onClose();
  }, [result, onClose]);

  if (!node) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Budget ${node.name}`}
      description="Berlaku untuk seluruh event, bukan per bulan."
    >
      <form action={action} className="space-y-3.5">
        <input type="hidden" name="categoryId" value={node.id} />

        <Field label="Alokasi budget" htmlFor="budgetAmount">
          <MoneyInput
            id="budgetAmount"
            name="budgetAmount"
            defaultValue={node.budget}
            autoFocus
          />
        </Field>

        <p className="text-[12px] leading-relaxed text-muted">
          Sudah terpakai{" "}
          <span className="tnum font-semibold text-ink">
            {formatIDR(node.committed)}
          </span>{" "}
          dari {node.txCount} transaksi. Menurunkan budget di bawah angka itu
          diperbolehkan — pos ini akan ditandai jebol.
        </p>

        <FormMessage result={result} />

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <SubmitButton>Simpan budget</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

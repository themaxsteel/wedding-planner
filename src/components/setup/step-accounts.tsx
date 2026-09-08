"use client";

import * as React from "react";
import { useActionState } from "react";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";
import { saveAccountsStep, goToStep } from "@/actions/setup";
import { Button, Callout } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { MoneyInput } from "@/components/money-input";
import { formatIDR } from "@/lib/money";
import {
  ACCOUNT_GROUP_PRESETS,
  ACCOUNT_GROUP_TYPE_LABEL,
  type AccountGroupType,
} from "@/lib/presets";

type DraftAccount = {
  key: string;
  name: string;
  accountNumber: string;
  openingBalance: number;
};

type DraftGroup = {
  key: string;
  name: string;
  type: AccountGroupType;
  accounts: DraftAccount[];
};

export type ExistingGroup = {
  name: string;
  type: string;
  accounts: { name: string; accountNumber: string | null; openingBalance: number }[];
};

const uid = () => Math.random().toString(36).slice(2, 9);

function emptyAccount(name = ""): DraftAccount {
  return { key: uid(), name, accountNumber: "", openingBalance: 0 };
}

function fromPresets(): DraftGroup[] {
  return ACCOUNT_GROUP_PRESETS.filter((p) => p.defaultSelected).map((p) => ({
    key: uid(),
    name: p.name,
    type: p.type,
    // Ambil satu sub account contoh; sisanya user tambah sendiri.
    accounts: [emptyAccount(p.accounts[0])],
  }));
}

export function StepAccounts({ existing }: { existing: ExistingGroup[] }) {
  const [result, action] = useActionState(saveAccountsStep, null);
  const [groups, setGroups] = React.useState<DraftGroup[]>(() =>
    existing.length > 0
      ? existing.map((g) => ({
          key: uid(),
          name: g.name,
          type: (g.type as AccountGroupType) ?? "bank",
          accounts: g.accounts.map((a) => ({
            key: uid(),
            name: a.name,
            accountNumber: a.accountNumber ?? "",
            openingBalance: a.openingBalance,
          })),
        }))
      : fromPresets(),
  );

  const totalOpening = groups.reduce(
    (sum, g) => sum + g.accounts.reduce((s, a) => s + a.openingBalance, 0),
    0,
  );
  const accountCount = groups.reduce((n, g) => n + g.accounts.length, 0);

  function patchGroup(key: string, patch: Partial<DraftGroup>) {
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  function patchAccount(
    gKey: string,
    aKey: string,
    patch: Partial<DraftAccount>,
  ) {
    setGroups((gs) =>
      gs.map((g) =>
        g.key === gKey
          ? {
              ...g,
              accounts: g.accounts.map((a) =>
                a.key === aKey ? { ...a, ...patch } : a,
              ),
            }
          : g,
      ),
    );
  }

  const payload = JSON.stringify({
    groups: groups.map((g) => ({
      name: g.name,
      type: g.type,
      accounts: g.accounts.map((a) => ({
        name: a.name,
        accountNumber: a.accountNumber,
        openingBalance: String(a.openingBalance),
      })),
    })),
  });

  const hasEmptyName =
    groups.some((g) => !g.name.trim()) ||
    groups.some((g) => g.accounts.some((a) => !a.name.trim()));
  const hasEmptyGroup = groups.some((g) => g.accounts.length === 0);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <Callout tone="blue">
        <strong className="font-semibold">Main account</strong> hanya wadah
        pengelompokan — saldonya adalah jumlah sub account di dalamnya.{" "}
        <strong className="font-semibold">Sub account</strong> adalah rekening
        atau kas yang benar-benar dipakai bertransaksi; setiap pengeluaran dan
        pemasukan nanti selalu menunjuk ke salah satunya.
      </Callout>

      <div className="space-y-3">
        {groups.map((group, gi) => {
          const groupTotal = group.accounts.reduce(
            (s, a) => s + a.openingBalance,
            0,
          );
          return (
            <div
              key={group.key}
              className="animate-rise rounded-[8px] border border-line bg-surface"
              style={{ animationDelay: `${gi * 40}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                  Main
                </span>
                <Input
                  value={group.name}
                  onChange={(e) => patchGroup(group.key, { name: e.target.value })}
                  placeholder="Nama main account"
                  className="h-7 w-40 font-medium"
                  aria-label={`Nama main account ${gi + 1}`}
                />
                <Select
                  value={group.type}
                  onChange={(e) =>
                    patchGroup(group.key, {
                      type: e.target.value as AccountGroupType,
                    })
                  }
                  className="h-7 w-32"
                  aria-label="Jenis main account"
                >
                  {Object.entries(ACCOUNT_GROUP_TYPE_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </Select>
                <span className="tnum ml-auto text-[12px] text-muted">
                  {formatIDR(groupTotal)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Hapus main account ${group.name}`}
                  onClick={() =>
                    setGroups((gs) => gs.filter((g) => g.key !== group.key))
                  }
                  className="w-7 px-0 hover:text-red-fg"
                >
                  <TrashIcon size={13} />
                </Button>
              </div>

              <div className="divide-y divide-[var(--c-border)]">
                {group.accounts.map((acc, ai) => (
                  <div
                    key={acc.key}
                    className="grid grid-cols-1 gap-2 px-3 py-2 sm:grid-cols-[1fr_140px_160px_auto] sm:items-center"
                  >
                    <Input
                      value={acc.name}
                      onChange={(e) =>
                        patchAccount(group.key, acc.key, { name: e.target.value })
                      }
                      placeholder="Nama sub account (mis. BCA)"
                      aria-label={`Nama sub account ${ai + 1}`}
                    />
                    <Input
                      value={acc.accountNumber}
                      onChange={(e) =>
                        patchAccount(group.key, acc.key, {
                          accountNumber: e.target.value,
                        })
                      }
                      placeholder="No. rekening"
                      className="tnum"
                      aria-label="Nomor rekening"
                    />
                    <MoneyInput
                      value={acc.openingBalance}
                      onValueChange={(v) =>
                        patchAccount(group.key, acc.key, { openingBalance: v })
                      }
                      placeholder="Saldo awal"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Hapus sub account ${acc.name || ai + 1}`}
                      onClick={() =>
                        patchGroup(group.key, {
                          accounts: group.accounts.filter(
                            (a) => a.key !== acc.key,
                          ),
                        })
                      }
                      className="w-7 justify-self-end px-0 hover:text-red-fg"
                    >
                      <TrashIcon size={13} />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border-t border-line px-3 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    patchGroup(group.key, {
                      accounts: [...group.accounts, emptyAccount()],
                    })
                  }
                >
                  <PlusIcon size={12} weight="bold" />
                  Tambah sub account
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() =>
            setGroups((gs) => [
              ...gs,
              { key: uid(), name: "", type: "bank", accounts: [emptyAccount()] },
            ])
          }
        >
          <PlusIcon size={12} weight="bold" />
          Tambah main account
        </Button>
        {ACCOUNT_GROUP_PRESETS.filter(
          (p) => !groups.some((g) => g.name === p.name),
        ).map((p) => (
          <Button
            key={p.name}
            variant="quiet"
            size="sm"
            onClick={() =>
              setGroups((gs) => [
                ...gs,
                {
                  key: uid(),
                  name: p.name,
                  type: p.type,
                  accounts: [emptyAccount(p.accounts[0])],
                },
              ])
            }
          >
            + {p.name}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line bg-sunken px-3 py-2">
        <span className="text-[12px] text-muted">
          {groups.length} main account · {accountCount} sub account
        </span>
        <span className="text-[12px] text-muted">
          Total saldo awal{" "}
          <span className="tnum font-semibold text-ink">
            {formatIDR(totalOpening)}
          </span>
        </span>
      </div>

      {hasEmptyName ? (
        <Callout tone="yellow">
          Masih ada nama main account atau sub account yang kosong.
        </Callout>
      ) : null}
      {hasEmptyGroup ? (
        <Callout tone="yellow">
          Setiap main account butuh minimal satu sub account, karena transaksi
          hanya bisa ditulis di sub account.
        </Callout>
      ) : null}

      <FormMessage result={result} />

      <div className="flex justify-between border-t border-line pt-3">
        <Button variant="ghost" onClick={() => goToStep(1)}>
          Kembali
        </Button>
        <SubmitButton disabled={hasEmptyName || hasEmptyGroup || groups.length === 0}>
          Lanjut ke Kategori
        </SubmitButton>
      </div>
    </form>
  );
}

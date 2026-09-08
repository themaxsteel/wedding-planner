"use client";

import * as React from "react";
import Link from "next/link";
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
  archiveAccount,
  deleteAccount,
  deleteAccountGroup,
  submitAccount,
  submitAccountGroup,
} from "@/actions/master";
import { Dialog } from "@/components/ui/modal";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Button, Card, EmptyState } from "@/components/ui/primitives";
import { Field, Input, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldError } from "@/components/ui/form";
import { MoneyInput } from "@/components/money-input";
import { formatIDR } from "@/lib/money";
import { ACCOUNT_GROUP_TYPE_LABEL } from "@/lib/presets";
import { cn } from "@/lib/cn";
import type { AccountBalanceRow, AccountGroupWithAccounts } from "@/db/queries";

type GroupDraft = { id?: number; name: string; type: string } | null;
type AccountDraft =
  | { groupId: number; account?: AccountBalanceRow }
  | null;

export function AccountsView({ tree }: { tree: AccountGroupWithAccounts[] }) {
  const [groupDraft, setGroupDraft] = React.useState<GroupDraft>(null);
  const [accountDraft, setAccountDraft] = React.useState<AccountDraft>(null);

  return (
    <>
      <div className="no-print mb-3">
        <Button
          variant="solid"
          onClick={() => setGroupDraft({ name: "", type: "bank" })}
        >
          <PlusIcon size={12} weight="bold" />
          Main account baru
        </Button>
      </div>

      {tree.length === 0 ? (
        <Card>
          <EmptyState
            title="Belum ada main account"
            description="Main account mengelompokkan rekening; sub account di dalamnya yang dipakai bertransaksi."
          />
        </Card>
      ) : (
        <div className="stagger space-y-3">
          {tree.map((group, i) => (
            <Card key={group.id} style={{ "--i": i } as React.CSSProperties}>
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[13.5px] font-semibold text-ink">
                      {group.name}
                    </h2>
                    <Badge tone="neutral">
                      {ACCOUNT_GROUP_TYPE_LABEL[
                        group.type as keyof typeof ACCOUNT_GROUP_TYPE_LABEL
                      ] ?? group.type}
                    </Badge>
                  </div>
                  <p className="text-[11.5px] text-faint">
                    {group.accounts.length} sub account
                  </p>
                </div>

                <p className="tnum text-[15px] font-semibold text-ink">
                  {formatIDR(group.balance)}
                </p>

                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Ubah ${group.name}`}
                    onClick={() =>
                      setGroupDraft({
                        id: group.id,
                        name: group.name,
                        type: group.type,
                      })
                    }
                    className="w-7 px-0"
                  >
                    <PencilSimpleIcon size={13} />
                  </Button>
                  <ActionButton
                    action={() => deleteAccountGroup(group.id)}
                    aria-label={`Hapus ${group.name}`}
                    className="w-7 px-0 hover:text-red-fg"
                    confirm={{
                      title: `Hapus main account ${group.name}?`,
                      description:
                        "Hanya bisa dihapus kalau sudah tidak punya sub account sama sekali.",
                    }}
                  >
                    <TrashIcon size={13} />
                  </ActionButton>
                </div>
              </div>

              {group.accounts.length === 0 ? (
                <p className="px-3 py-3 text-center text-[12px] text-muted">
                  Belum ada sub account di grup ini.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--c-border)]">
                  {group.accounts.map((acc) => (
                    <AccountRow
                      key={acc.id}
                      account={acc}
                      onEdit={() =>
                        setAccountDraft({ groupId: group.id, account: acc })
                      }
                    />
                  ))}
                </ul>
              )}

              <div className="border-t border-line px-3 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAccountDraft({ groupId: group.id })}
                >
                  <PlusIcon size={12} weight="bold" />
                  Tambah sub account
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GroupDialog draft={groupDraft} onClose={() => setGroupDraft(null)} />
      <AccountDialog
        draft={accountDraft}
        onClose={() => setAccountDraft(null)}
      />
    </>
  );
}

function AccountRow({
  account,
  onEdit,
}: {
  account: AccountBalanceRow;
  onEdit: () => void;
}) {
  const archived = Boolean(account.archived);

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 transition-colors hover:bg-hover",
        archived && "opacity-55",
      )}
    >
      <Link
        href={`/accounts/${account.id}`}
        className="group flex min-w-0 flex-1 items-center gap-1.5"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-ink group-hover:underline">
              {account.name}
            </span>
            {archived ? <Badge tone="neutral">Arsip</Badge> : null}
          </span>
          <span className="block truncate text-[11.5px] text-faint">
            {account.accountNumber ? `${account.accountNumber} · ` : ""}
            {account.movementCount} mutasi · saldo awal{" "}
            {formatIDR(account.openingBalance)}
          </span>
        </span>
        <CaretRightIcon
          size={11}
          className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100"
        />
      </Link>

      <div className="hidden text-right sm:block">
        <p className="tnum text-[11.5px] text-green-fg">
          +{formatIDR(account.cashIn + account.transferIn)}
        </p>
        <p className="tnum text-[11.5px] text-red-fg">
          −{formatIDR(account.cashOut + account.transferOut)}
        </p>
      </div>

      <p className="tnum w-[130px] text-right text-[13.5px] font-semibold text-ink">
        {formatIDR(account.balance)}
      </p>

      <div className="flex shrink-0 gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Ubah ${account.name}`}
          onClick={onEdit}
          className="w-7 px-0"
        >
          <PencilSimpleIcon size={13} />
        </Button>
        <ActionButton
          action={() => archiveAccount(account.id, !archived)}
          aria-label={archived ? "Aktifkan kembali" : "Arsipkan"}
          title={archived ? "Aktifkan kembali" : "Arsipkan"}
          className="w-7 px-0"
        >
          {archived ? (
            <ArrowClockwiseIcon size={13} />
          ) : (
            <ArchiveIcon size={13} />
          )}
        </ActionButton>
        <ActionButton
          action={() => deleteAccount(account.id)}
          aria-label={`Hapus ${account.name}`}
          className="w-7 px-0 hover:text-red-fg"
          confirm={{
            title: `Hapus ${account.name}?`,
            description:
              "Sub account yang sudah pernah dipakai bertransaksi tidak bisa dihapus — arsipkan saja agar riwayatnya tetap utuh.",
          }}
        >
          <TrashIcon size={13} />
        </ActionButton>
      </div>
    </li>
  );
}

function GroupDialog({
  draft,
  onClose,
}: {
  draft: GroupDraft;
  onClose: () => void;
}) {
  const [result, action] = useActionState(submitAccountGroup, null);
  React.useEffect(() => {
    if (result?.ok) onClose();
  }, [result, onClose]);

  if (!draft) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={draft.id ? "Ubah main account" : "Main account baru"}
      description="Main account tidak bisa dipakai bertransaksi — ia hanya menjumlahkan sub account di bawahnya."
    >
      <form action={action} className="space-y-3.5">
        {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}

        <Field label="Nama" htmlFor="gname" error={fieldError(result, "name")}>
          <Input
            id="gname"
            name="name"
            required
            maxLength={80}
            defaultValue={draft.name}
            placeholder="mis. Bank"
            autoFocus
          />
        </Field>

        <Field label="Jenis" htmlFor="gtype">
          <Select id="gtype" name="type" defaultValue={draft.type}>
            {Object.entries(ACCOUNT_GROUP_TYPE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
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

function AccountDialog({
  draft,
  onClose,
}: {
  draft: AccountDraft;
  onClose: () => void;
}) {
  const [result, action] = useActionState(submitAccount, null);
  React.useEffect(() => {
    if (result?.ok) onClose();
  }, [result, onClose]);

  if (!draft) return null;
  const acc = draft.account;
  const locked = Boolean(acc && acc.movementCount > 0);

  return (
    <Dialog
      open
      onClose={onClose}
      title={acc ? `Ubah ${acc.name}` : "Sub account baru"}
      description="Inilah tempat transaksi benar-benar dicatat."
    >
      <form action={action} className="space-y-3.5">
        {acc ? <input type="hidden" name="id" value={acc.id} /> : null}
        <input type="hidden" name="groupId" value={draft.groupId} />

        <Field label="Nama" htmlFor="aname" error={fieldError(result, "name")}>
          <Input
            id="aname"
            name="name"
            required
            maxLength={80}
            defaultValue={acc?.name ?? ""}
            placeholder="mis. BCA"
            autoFocus
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nomor rekening" htmlFor="anumber" hint="opsional">
            <Input
              id="anumber"
              name="accountNumber"
              maxLength={60}
              defaultValue={acc?.accountNumber ?? ""}
              className="tnum"
            />
          </Field>
          <Field label="Atas nama" htmlFor="aholder" hint="opsional">
            <Input
              id="aholder"
              name="holderName"
              maxLength={120}
              defaultValue={acc?.holderName ?? ""}
            />
          </Field>
        </div>

        <Field
          label="Saldo awal"
          htmlFor="aopening"
          error={fieldError(result, "openingBalance")}
        >
          <MoneyInput
            id="aopening"
            name="openingBalance"
            defaultValue={acc?.openingBalance ?? 0}
          />
        </Field>

        {locked ? (
          <p className="text-[12px] leading-relaxed text-muted">
            Akun ini sudah punya {acc!.movementCount} mutasi. Mengubah saldo
            awal akan menggeser seluruh saldo berjalannya — pastikan angkanya
            memang keliru sejak awal.
          </p>
        ) : null}

        <Field label="Catatan" htmlFor="anote" hint="opsional">
          <Input
            id="anote"
            name="note"
            maxLength={300}
            defaultValue={acc?.note ?? ""}
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

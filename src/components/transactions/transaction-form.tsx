"use client";

import * as React from "react";
import { useActionState } from "react";
import { saveExpense, saveIncome, saveTransfer } from "@/actions/transactions";
import { Sheet } from "@/components/ui/modal";
import { Button, Callout } from "@/components/ui/primitives";
import {
  Field,
  Input,
  SegmentedGroup,
  SegmentedOption,
  Select,
  Textarea,
} from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldError } from "@/components/ui/form";
import { MoneyInput } from "@/components/money-input";
import { AttachmentInput } from "./attachment-input";
import { formatIDR } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/presets";
import type { TransactionRow } from "@/db/queries";
import type { TransactionType } from "@/db/schema";

export type AccountOption = {
  id: number;
  name: string;
  groupName: string;
};

export type CategoryOption = {
  id: number;
  name: string;
  parentName: string | null;
  isParent: boolean;
};

export type SupplierOption = { id: number; name: string };

export type TransactionFormData = {
  accounts: AccountOption[];
  expenseCategories: CategoryOption[];
  incomeCategories: CategoryOption[];
  suppliers: SupplierOption[];
};

type PaymentMode = "full" | "partial" | "none";

export function TransactionForm({
  open,
  onClose,
  data,
  editing,
  defaultType = "expense",
  defaultCategoryId,
  defaultAccountId,
}: {
  open: boolean;
  onClose: () => void;
  data: TransactionFormData;
  /** transaksi yang sedang diubah; jenisnya tidak bisa diganti */
  editing?: TransactionRow | null;
  defaultType?: TransactionType;
  defaultCategoryId?: number;
  defaultAccountId?: number;
}) {
  const [type, setType] = React.useState<TransactionType>(
    editing?.type ?? defaultType,
  );

  React.useEffect(() => {
    if (open) setType(editing?.type ?? defaultType);
  }, [open, editing, defaultType]);

  const isEdit = Boolean(editing);
  const title = isEdit
    ? "Ubah transaksi"
    : type === "expense"
      ? "Catat pengeluaran"
      : type === "income"
        ? "Catat pemasukan"
        : "Catat transfer";

  const noAccounts = data.accounts.length === 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={
        isEdit
          ? "Jenis transaksi tidak bisa diubah. Hapus dan buat ulang bila perlu."
          : undefined
      }
      width="lg"
    >
      {noAccounts ? (
        <Callout tone="yellow">
          Belum ada sub account aktif. Tambahkan lebih dulu di halaman Akun.
        </Callout>
      ) : (
        <div className="space-y-3.5">
          {!isEdit ? (
            <SegmentedGroup className="w-full">
              <SegmentedOption
                name="txtype"
                value="expense"
                checked={type === "expense"}
                onChange={() => setType("expense")}
                className="flex-1"
              >
                Pengeluaran
              </SegmentedOption>
              <SegmentedOption
                name="txtype"
                value="income"
                checked={type === "income"}
                onChange={() => setType("income")}
                className="flex-1"
              >
                Pemasukan
              </SegmentedOption>
              <SegmentedOption
                name="txtype"
                value="transfer"
                checked={type === "transfer"}
                onChange={() => setType("transfer")}
                className="flex-1"
              >
                Transfer
              </SegmentedOption>
            </SegmentedGroup>
          ) : null}

          {type === "expense" ? (
            <ExpenseFields
              key={`expense-${editing?.id ?? "new"}`}
              data={data}
              editing={editing}
              defaultCategoryId={defaultCategoryId}
              defaultAccountId={defaultAccountId}
              onDone={onClose}
            />
          ) : null}
          {type === "income" ? (
            <IncomeFields
              key={`income-${editing?.id ?? "new"}`}
              data={data}
              editing={editing}
              defaultAccountId={defaultAccountId}
              onDone={onClose}
            />
          ) : null}
          {type === "transfer" ? (
            <TransferFields
              key={`transfer-${editing?.id ?? "new"}`}
              data={data}
              editing={editing}
              defaultAccountId={defaultAccountId}
              onDone={onClose}
            />
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

/* ========================================================================== */
/* PENGELUARAN                                                                */
/* ========================================================================== */

function ExpenseFields({
  data,
  editing,
  defaultCategoryId,
  defaultAccountId,
  onDone,
}: {
  data: TransactionFormData;
  editing?: TransactionRow | null;
  defaultCategoryId?: number;
  defaultAccountId?: number;
  onDone: () => void;
}) {
  const [result, action] = useActionState(saveExpense, null);
  const [amount, setAmount] = React.useState(editing?.amount ?? 0);
  const [downPayment, setDownPayment] = React.useState(
    editing && editing.paid > 0 && editing.paid < editing.amount
      ? editing.paid
      : 0,
  );
  const [mode, setMode] = React.useState<PaymentMode>(() => {
    if (!editing) return "full";
    if (editing.paymentStatus === "paid") return "full";
    if (editing.paymentStatus === "partial") return "partial";
    return "none";
  });

  useCloseOnSuccess(result, onDone);

  // Saat mengubah transaksi yang cicilannya sudah berjalan, pengaturan
  // pembayaran di muka tidak lagi relevan — termin diurus di halaman Hutang.
  const paymentLocked = Boolean(editing && editing.paid > 0);
  const remaining = Math.max(0, amount - downPayment);

  return (
    <form action={action} className="space-y-3.5">
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
        <Field label="Tanggal" htmlFor="date" error={fieldError(result, "date")}>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={editing?.date ?? todayISO()}
          />
        </Field>
        <Field
          label="Keterangan"
          htmlFor="description"
          error={fieldError(result, "description")}
        >
          <Input
            id="description"
            name="description"
            required
            maxLength={200}
            defaultValue={editing?.description ?? ""}
            placeholder="mis. Pelunasan paket foto & video"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Nominal"
          htmlFor="amount"
          error={fieldError(result, "amount")}
        >
          <MoneyInput
            id="amount"
            name="amount"
            value={amount}
            onValueChange={setAmount}
            required
          />
        </Field>
        <Field
          label="Kategori"
          htmlFor="categoryId"
          hint="pilih sub-kategori bila ada"
          error={fieldError(result, "categoryId")}
        >
          <CategorySelect
            id="categoryId"
            options={data.expenseCategories}
            defaultValue={editing?.categoryId ?? defaultCategoryId}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supplier" htmlFor="supplierId" hint="opsional">
          <Select
            id="supplierId"
            name="supplierId"
            defaultValue={editing?.supplierId ?? ""}
          >
            <option value="">Tanpa supplier</option>
            {data.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Sumber dana"
          htmlFor="accountId"
          error={fieldError(result, "accountId")}
        >
          <AccountSelect
            id="accountId"
            accounts={data.accounts}
            defaultValue={editing?.accountId ?? defaultAccountId}
          />
        </Field>
      </div>

      <div className="rounded-[6px] border border-line bg-sunken p-3">
        <p className="mb-2 text-[11.5px] font-medium text-muted">
          Status pembayaran
        </p>

        {paymentLocked ? (
          <>
            <input type="hidden" name="paymentMode" value="none" />
            <Callout tone="blue">
              Transaksi ini sudah punya{" "}
              <strong className="font-semibold">
                {formatIDR(editing!.paid)}
              </strong>{" "}
              pembayaran tercatat. Termin berikutnya dicatat lewat halaman
              Hutang agar riwayat cicilannya tetap rapi.
            </Callout>

            {/*
              Jatuh tempo tetap bisa diubah di sini. Tanpa field ini form
              akan mengirim nilai kosong dan diam-diam menghapus tanggal
              jatuh tempo yang sudah tercatat.
            */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field
                label="Jatuh tempo sisa"
                htmlFor="dueDateLocked"
                hint="opsional"
                error={fieldError(result, "dueDate")}
              >
                <Input
                  id="dueDateLocked"
                  name="dueDate"
                  type="date"
                  defaultValue={editing?.dueDate ?? ""}
                />
              </Field>
              <div className="flex items-end">
                <p className="text-[12px] leading-relaxed text-muted">
                  Sisa{" "}
                  <span className="tnum font-semibold text-ink">
                    {formatIDR(Math.max(0, amount - editing!.paid))}
                  </span>{" "}
                  masih tercatat sebagai hutang.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="paymentMode" value={mode} />
            <SegmentedGroup className="w-full">
              <SegmentedOption
                name="mode"
                value="full"
                checked={mode === "full"}
                onChange={() => setMode("full")}
                className="flex-1"
              >
                Lunas
              </SegmentedOption>
              <SegmentedOption
                name="mode"
                value="partial"
                checked={mode === "partial"}
                onChange={() => setMode("partial")}
                className="flex-1"
              >
                DP sebagian
              </SegmentedOption>
              <SegmentedOption
                name="mode"
                value="none"
                checked={mode === "none"}
                onChange={() => setMode("none")}
                className="flex-1"
              >
                Belum bayar
              </SegmentedOption>
            </SegmentedGroup>

            <div className="mt-3 space-y-3">
              {mode === "partial" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Jumlah DP"
                    htmlFor="downPayment"
                    error={fieldError(result, "downPayment")}
                  >
                    <MoneyInput
                      id="downPayment"
                      name="downPayment"
                      value={downPayment}
                      onValueChange={setDownPayment}
                    />
                  </Field>
                  <Field label="Tanggal bayar DP" htmlFor="paymentDate">
                    <Input
                      id="paymentDate"
                      name="paymentDate"
                      type="date"
                      defaultValue={todayISO()}
                    />
                  </Field>
                </div>
              ) : null}

              {mode !== "full" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Jatuh tempo sisa"
                    htmlFor="dueDate"
                    hint="opsional"
                    error={fieldError(result, "dueDate")}
                  >
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      defaultValue={editing?.dueDate ?? ""}
                    />
                  </Field>
                  <div className="flex items-end">
                    <p className="text-[12px] leading-relaxed text-muted">
                      Sisa{" "}
                      <span className="tnum font-semibold text-ink">
                        {formatIDR(mode === "none" ? amount : remaining)}
                      </span>{" "}
                      akan masuk daftar hutang.
                    </p>
                  </div>
                </div>
              ) : null}

              {mode !== "none" ? (
                <Field label="Metode pembayaran" htmlFor="paymentMethod">
                  <Select
                    id="paymentMethod"
                    name="paymentMethod"
                    defaultValue="transfer"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
          </>
        )}
      </div>

      <Field label="Catatan" htmlFor="note" hint="opsional">
        <Textarea
          id="note"
          name="note"
          maxLength={500}
          defaultValue={editing?.note ?? ""}
          placeholder="Detail paket, syarat pembatalan, dsb."
        />
      </Field>

      <AttachmentInput />

      <FormMessage result={result} />

      <FormFooter onCancel={onDone} isEdit={Boolean(editing)} />
    </form>
  );
}

/* ========================================================================== */
/* PEMASUKAN                                                                  */
/* ========================================================================== */

function IncomeFields({
  data,
  editing,
  defaultAccountId,
  onDone,
}: {
  data: TransactionFormData;
  editing?: TransactionRow | null;
  defaultAccountId?: number;
  onDone: () => void;
}) {
  const [result, action] = useActionState(saveIncome, null);
  useCloseOnSuccess(result, onDone);

  return (
    <form action={action} className="space-y-3.5">
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
        <Field label="Tanggal" htmlFor="idate" error={fieldError(result, "date")}>
          <Input
            id="idate"
            name="date"
            type="date"
            required
            defaultValue={editing?.date ?? todayISO()}
          />
        </Field>
        <Field
          label="Keterangan"
          htmlFor="idescription"
          error={fieldError(result, "description")}
        >
          <Input
            id="idescription"
            name="description"
            required
            maxLength={200}
            defaultValue={editing?.description ?? ""}
            placeholder="mis. Kontribusi keluarga besar"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nominal" htmlFor="iamount" error={fieldError(result, "amount")}>
          <MoneyInput
            id="iamount"
            name="amount"
            defaultValue={editing?.amount ?? 0}
            required
          />
        </Field>
        <Field
          label="Kategori"
          htmlFor="icategoryId"
          error={fieldError(result, "categoryId")}
        >
          <CategorySelect
            id="icategoryId"
            options={data.incomeCategories}
            defaultValue={editing?.categoryId ?? undefined}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Masuk ke akun"
          htmlFor="iaccountId"
          error={fieldError(result, "accountId")}
        >
          <AccountSelect
            id="iaccountId"
            accounts={data.accounts}
            defaultValue={editing?.accountId ?? defaultAccountId}
          />
        </Field>
        <Field label="Metode" htmlFor="ipaymentMethod">
          <Select id="ipaymentMethod" name="paymentMethod" defaultValue="transfer">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Catatan" htmlFor="inote" hint="opsional">
        <Textarea
          id="inote"
          name="note"
          maxLength={500}
          defaultValue={editing?.note ?? ""}
        />
      </Field>

      <AttachmentInput />

      <FormMessage result={result} />

      <FormFooter onCancel={onDone} isEdit={Boolean(editing)} />
    </form>
  );
}

/* ========================================================================== */
/* TRANSFER                                                                   */
/* ========================================================================== */

function TransferFields({
  data,
  editing,
  defaultAccountId,
  onDone,
}: {
  data: TransactionFormData;
  editing?: TransactionRow | null;
  defaultAccountId?: number;
  onDone: () => void;
}) {
  const [result, action] = useActionState(saveTransfer, null);
  useCloseOnSuccess(result, onDone);

  return (
    <form action={action} className="space-y-3.5">
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

      <Callout tone="blue">
        Transfer hanya memindahkan dana antar sub account. Tidak menyentuh
        budget maupun daftar hutang, dan total saldo tetap sama.
      </Callout>

      <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
        <Field label="Tanggal" htmlFor="tdate" error={fieldError(result, "date")}>
          <Input
            id="tdate"
            name="date"
            type="date"
            required
            defaultValue={editing?.date ?? todayISO()}
          />
        </Field>
        <Field
          label="Keterangan"
          htmlFor="tdescription"
          error={fieldError(result, "description")}
        >
          <Input
            id="tdescription"
            name="description"
            required
            maxLength={200}
            defaultValue={editing?.description ?? ""}
            placeholder="mis. Tarik tunai untuk bayar vendor"
          />
        </Field>
      </div>

      <Field label="Nominal" htmlFor="tamount" error={fieldError(result, "amount")}>
        <MoneyInput
          id="tamount"
          name="amount"
          defaultValue={editing?.amount ?? 0}
          required
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Dari akun"
          htmlFor="taccountId"
          error={fieldError(result, "accountId")}
        >
          <AccountSelect
            id="taccountId"
            accounts={data.accounts}
            defaultValue={editing?.accountId ?? defaultAccountId}
          />
        </Field>
        <Field
          label="Ke akun"
          htmlFor="toAccountId"
          error={fieldError(result, "toAccountId")}
        >
          <AccountSelect
            id="toAccountId"
            name="toAccountId"
            accounts={data.accounts}
            defaultValue={editing?.toAccountId ?? undefined}
          />
        </Field>
      </div>

      <Field label="Catatan" htmlFor="tnote" hint="opsional">
        <Textarea
          id="tnote"
          name="note"
          maxLength={500}
          defaultValue={editing?.note ?? ""}
        />
      </Field>

      <FormMessage result={result} />

      <FormFooter onCancel={onDone} isEdit={Boolean(editing)} />
    </form>
  );
}

/* ========================================================================== */
/* BAGIAN BERSAMA                                                             */
/* ========================================================================== */

function FormFooter({
  onCancel,
  isEdit,
}: {
  onCancel: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-line pt-3">
      <Button variant="ghost" onClick={onCancel}>
        Batal
      </Button>
      <SubmitButton>{isEdit ? "Simpan perubahan" : "Simpan"}</SubmitButton>
    </div>
  );
}

/** Kategori induk ditampilkan sebagai optgroup agar hirarkinya terbaca. */
function CategorySelect({
  id,
  options,
  defaultValue,
}: {
  id: string;
  options: CategoryOption[];
  defaultValue?: number;
}) {
  const groups: { parent: CategoryOption; children: CategoryOption[] }[] = [];
  for (const opt of options) {
    if (opt.isParent) groups.push({ parent: opt, children: [] });
    else groups[groups.length - 1]?.children.push(opt);
  }

  return (
    <Select id={id} name="categoryId" required defaultValue={defaultValue ?? ""}>
      <option value="" disabled>
        Pilih kategori…
      </option>
      {groups.map((g) => (
        <optgroup key={g.parent.id} label={g.parent.name}>
          <option value={g.parent.id}>{g.parent.name} (umum)</option>
          {g.children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

function AccountSelect({
  id,
  name = "accountId",
  accounts,
  defaultValue,
}: {
  id: string;
  name?: string;
  accounts: AccountOption[];
  defaultValue?: number;
}) {
  const groups = [...new Set(accounts.map((a) => a.groupName))];
  return (
    <Select id={id} name={name} required defaultValue={defaultValue ?? ""}>
      <option value="" disabled>
        Pilih akun…
      </option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {accounts
            .filter((a) => a.groupName === g)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** Menutup panel begitu server mengonfirmasi penyimpanan berhasil. */
function useCloseOnSuccess(
  result: { ok: boolean } | null,
  onDone: () => void,
) {
  React.useEffect(() => {
    if (result?.ok) onDone();
  }, [result, onDone]);
}

"use client";

import * as React from "react";
import { useActionState } from "react";
import { savePayment } from "@/actions/transactions";
import { Dialog } from "@/components/ui/modal";
import { Button, Callout } from "@/components/ui/primitives";
import { Field, Input, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldError } from "@/components/ui/form";
import { MoneyInput } from "@/components/money-input";
import { AttachmentInput } from "./attachment-input";
import { formatIDR } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/presets";
import type { AccountOption } from "./transaction-form";

export type PayableTarget = {
  id: number;
  description: string;
  supplierName: string | null;
  amount: number;
  paid: number;
  outstanding: number;
  dueDate: string | null;
};

/**
 * Pencatatan satu termin. Nominal dibatasi maksimum sisa hutang — server
 * menolak kelebihannya, jadi tombol pintas di sini menjaga agar user tidak
 * perlu menabrak error dulu untuk tahu batasnya.
 */
export function PaymentDialog({
  target,
  accounts,
  onClose,
}: {
  target: PayableTarget | null;
  accounts: AccountOption[];
  onClose: () => void;
}) {
  const [result, action] = useActionState(savePayment, null);
  const [amount, setAmount] = React.useState(0);

  React.useEffect(() => {
    if (target) setAmount(target.outstanding);
  }, [target]);

  React.useEffect(() => {
    if (result?.ok) onClose();
  }, [result, onClose]);

  if (!target) return null;

  const half = Math.round(target.outstanding / 2 / 1000) * 1000;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Catat pembayaran"
      description={
        <>
          {target.description}
          {target.supplierName ? ` · ${target.supplierName}` : ""}
        </>
      }
    >
      <form action={action} className="space-y-3.5">
        <input type="hidden" name="transactionId" value={target.id} />

        <div className="grid grid-cols-3 gap-2 rounded-[6px] border border-line bg-sunken px-3 py-2 text-center">
          <Stat label="Nilai" value={target.amount} />
          <Stat label="Sudah dibayar" value={target.paid} />
          <Stat label="Sisa" value={target.outstanding} highlight />
        </div>

        {target.dueDate ? (
          <p className="text-[12px] text-muted">
            Jatuh tempo {formatDate(target.dueDate)}.
          </p>
        ) : null}

        <Field
          label="Jumlah dibayar"
          htmlFor="pamount"
          error={fieldError(result, "amount")}
        >
          <MoneyInput
            id="pamount"
            name="amount"
            value={amount}
            onValueChange={setAmount}
            autoFocus
            required
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setAmount(target.outstanding)}
          >
            Lunasi ({formatIDR(target.outstanding)})
          </Button>
          {half > 0 && half < target.outstanding ? (
            <Button variant="quiet" size="sm" onClick={() => setAmount(half)}>
              Separuh ({formatIDR(half)})
            </Button>
          ) : null}
        </div>

        {amount > target.outstanding ? (
          <Callout tone="yellow">
            Melebihi sisa hutang sebesar{" "}
            {formatIDR(amount - target.outstanding)}. Turunkan nominalnya, atau
            perbesar nilai transaksinya lebih dulu.
          </Callout>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Tanggal bayar"
            htmlFor="pdate"
            error={fieldError(result, "date")}
          >
            <Input
              id="pdate"
              name="date"
              type="date"
              required
              defaultValue={todayISO()}
            />
          </Field>
          <Field
            label="Dibayar dari"
            htmlFor="paccountId"
            error={fieldError(result, "accountId")}
          >
            <Select id="paccountId" name="accountId" required defaultValue="">
              <option value="" disabled>
                Pilih akun…
              </option>
              {[...new Set(accounts.map((a) => a.groupName))].map((g) => (
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
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Metode" htmlFor="pmethod">
            <Select id="pmethod" name="method" defaultValue="transfer">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Catatan" htmlFor="pnote" hint="opsional">
            <Input id="pnote" name="note" maxLength={300} placeholder="mis. Termin 2" />
          </Field>
        </div>

        <AttachmentInput label="Bukti transfer" />

        <FormMessage result={result} />

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <SubmitButton disabled={amount <= 0 || amount > target.outstanding}>
            Simpan pembayaran
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
        {label}
      </p>
      <p
        className={`tnum text-[13px] font-semibold ${highlight ? "text-red-fg" : "text-ink"}`}
      >
        {formatIDR(value)}
      </p>
    </div>
  );
}

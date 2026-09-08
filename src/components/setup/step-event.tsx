"use client";

import { useActionState } from "react";
import { saveEventStep } from "@/actions/setup";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldError } from "@/components/ui/form";
import { MoneyInput } from "@/components/money-input";
import type { Event } from "@/db/schema";

export function StepEvent({ event }: { event: Event }) {
  const [result, action] = useActionState(saveEventStep, null);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Nama event"
        htmlFor="name"
        error={fieldError(result, "name")}
      >
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={event.name === "Wedding" ? "" : event.name}
          placeholder="Pernikahan Andi & Sinta"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama mempelai wanita" htmlFor="brideName">
          <Input
            id="brideName"
            name="brideName"
            defaultValue={event.brideName ?? ""}
            placeholder="Sinta"
          />
        </Field>
        <Field label="Nama mempelai pria" htmlFor="groomName">
          <Input
            id="groomName"
            name="groomName"
            defaultValue={event.groomName ?? ""}
            placeholder="Andi"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Tanggal hari-H"
          htmlFor="eventDate"
          hint="opsional"
          error={fieldError(result, "eventDate")}
        >
          <Input
            id="eventDate"
            name="eventDate"
            type="date"
            defaultValue={event.eventDate ?? ""}
          />
        </Field>
        <Field
          label="Target total budget"
          htmlFor="totalBudgetTarget"
          hint="bisa diubah nanti"
          error={fieldError(result, "totalBudgetTarget")}
        >
          <MoneyInput
            id="totalBudgetTarget"
            name="totalBudgetTarget"
            defaultValue={event.totalBudgetTarget}
          />
        </Field>
      </div>

      <p className="text-[12px] leading-relaxed text-muted">
        Target total budget dipakai sebagai pembanding saat Anda membagi
        alokasi per kategori di langkah 4. Angka ini boleh berbeda dari jumlah
        alokasi, dan bisa diubah kapan saja lewat Pengaturan.
      </p>

      <FormMessage result={result} />

      <div className="flex justify-end border-t border-line pt-3">
        <SubmitButton>Lanjut ke Assets Account</SubmitButton>
      </div>
    </form>
  );
}

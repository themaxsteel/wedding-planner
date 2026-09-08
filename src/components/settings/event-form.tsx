"use client";

import { useActionState } from "react";
import { submitEvent } from "@/actions/master";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldError } from "@/components/ui/form";
import { MoneyInput } from "@/components/money-input";
import type { Event } from "@/db/schema";

export function EventForm({ event }: { event: Event }) {
  const [result, action] = useActionState(submitEvent, null);

  return (
    <form action={action} className="space-y-3.5">
      <Field
        label="Nama event"
        htmlFor="ename"
        error={fieldError(result, "name")}
      >
        <Input
          id="ename"
          name="name"
          required
          maxLength={120}
          defaultValue={event.name}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama mempelai wanita" htmlFor="ebride">
          <Input
            id="ebride"
            name="brideName"
            maxLength={120}
            defaultValue={event.brideName ?? ""}
          />
        </Field>
        <Field label="Nama mempelai pria" htmlFor="egroom">
          <Input
            id="egroom"
            name="groomName"
            maxLength={120}
            defaultValue={event.groomName ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Tanggal hari-H"
          htmlFor="edate"
          error={fieldError(result, "eventDate")}
        >
          <Input
            id="edate"
            name="eventDate"
            type="date"
            defaultValue={event.eventDate ?? ""}
          />
        </Field>
        <Field
          label="Target total budget"
          htmlFor="etarget"
          error={fieldError(result, "totalBudgetTarget")}
        >
          <MoneyInput
            id="etarget"
            name="totalBudgetTarget"
            defaultValue={event.totalBudgetTarget}
          />
        </Field>
      </div>

      <FormMessage result={result} />

      <div className="flex justify-end border-t border-line pt-3">
        <SubmitButton>Simpan perubahan</SubmitButton>
      </div>
    </form>
  );
}

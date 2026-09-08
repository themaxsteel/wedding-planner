"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton, fieldError } from "@/components/ui/form";

export function LoginForm({ next }: { next: string }) {
  const [result, action] = useActionState(login, null);

  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="next" value={next} />

      <Field
        label="Password"
        htmlFor="password"
        error={fieldError(result, "password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </Field>

      <FormMessage result={result} />

      <SubmitButton className="w-full" pendingLabel="Memeriksa…">
        Masuk
      </SubmitButton>
    </form>
  );
}

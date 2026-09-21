"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { Button } from "./primitives";
import type { ActionResult } from "@/actions/shared";

/** Tombol submit yang otomatis nonaktif & berganti label selama aksi berjalan. */
export function SubmitButton({
  children,
  pendingLabel = "Menyimpan…",
  variant = "solid",
  size = "md",
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Menampilkan hasil Server Action: error merah atau konfirmasi hijau. */
export function FormMessage({
  result,
  className,
}: {
  result: ActionResult<unknown> | null | undefined;
  className?: string;
}) {
  if (!result) return null;

  if (!result.ok) {
    return (
      <p
        role="alert"
        className={cn(
          "flex items-start gap-1.5 rounded-[6px] border border-red-line bg-red-bg px-2.5 py-1.5 text-[12px] leading-relaxed text-red-fg",
          className,
        )}
      >
        <WarningCircleIcon size={14} weight="fill" className="mt-0.5 shrink-0" />
        <span>{result.error}</span>
      </p>
    );
  }

  if (!result.message && !result.warning) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {result.message ? (
        <p className="flex items-center gap-1.5 rounded-[6px] border border-green-line bg-green-bg px-2.5 py-1.5 text-[12px] text-green-fg">
          <CheckCircleIcon size={14} weight="fill" className="shrink-0" />
          <span>{result.message}</span>
        </p>
      ) : null}
      {result.warning ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-[6px] border border-yellow-line bg-yellow-bg px-2.5 py-1.5 text-[12px] leading-relaxed text-yellow-fg"
        >
          <WarningCircleIcon size={14} weight="fill" className="mt-0.5 shrink-0" />
          <span>{result.warning}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Ambil pesan error untuk satu field dari hasil aksi. */
export function fieldError(
  result: ActionResult<unknown> | null | undefined,
  name: string,
): string | null {
  if (!result || result.ok) return null;
  return result.fieldErrors?.[name] ?? null;
}

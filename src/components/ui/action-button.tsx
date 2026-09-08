"use client";

import * as React from "react";
import { Button } from "./primitives";
import { ConfirmDialog } from "./modal";
import type { ActionResult } from "@/actions/shared";

/**
 * Tombol untuk Server Action tanpa form: menahan klik ganda, menampilkan
 * kegagalan (mis. "akun ini sudah punya transaksi") alih-alih diam saja,
 * dan opsional meminta konfirmasi lebih dulu.
 */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "ghost",
  size = "sm",
  className,
  title,
  "aria-label": ariaLabel,
  onDone,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  /** minta konfirmasi sebelum menjalankan aksi */
  confirm?: { title: string; description: React.ReactNode; label?: string };
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  title?: string;
  "aria-label"?: string;
  onDone?: (result: ActionResult<unknown>) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [asking, setAsking] = React.useState(false);

  function fire() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        // Biarkan dialog terbuka agar pesan kegagalan terbaca.
        if (!confirm) window.setTimeout(() => setError(null), 6000);
        return;
      }
      setAsking(false);
      onDone?.(result);
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        title={title ?? (error ?? undefined)}
        aria-label={ariaLabel}
        disabled={pending}
        onClick={() => (confirm ? setAsking(true) : fire())}
      >
        {children}
      </Button>

      {confirm ? (
        <ConfirmDialog
          open={asking}
          onClose={() => {
            setAsking(false);
            setError(null);
          }}
          onConfirm={fire}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.label}
          pending={pending}
          error={error}
        />
      ) : null}

      {!confirm && error ? (
        <span role="alert" className="ml-2 text-[11.5px] text-red-fg">
          {error}
        </span>
      ) : null}
    </>
  );
}

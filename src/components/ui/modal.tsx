"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "./primitives";

function useDismiss(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Kunci scroll body, tapi ganti dengan padding supaya layout tidak melompat
    // saat scrollbar hilang.
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [open, onClose]);
}

/** Fokus otomatis ke kontrol pertama saat panel dibuka. */
function useAutoFocus(open: boolean) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([disabled]), select, textarea, button",
      );
      el?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [open]);
  return ref;
}

function Overlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="animate-fade fixed inset-0 z-40 bg-[rgba(15,15,15,0.28)] backdrop-blur-[1px] dark:bg-[rgba(0,0,0,0.55)]"
      onClick={onClose}
      aria-hidden
    />
  );
}

/* ========================================================================== */
/* SHEET — panel geser dari kanan, untuk form yang panjang                    */
/* ========================================================================== */

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg";
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  useDismiss(open, onClose);
  const ref = useAutoFocus(open);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <Overlay onClose={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        ref={ref}
        className={cn(
          "animate-slide-over fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow-float)]",
          width === "lg" ? "sm:max-w-[620px]" : "sm:max-w-[480px]",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[12px] leading-snug text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Tutup"
            className="-mr-1 shrink-0"
          >
            <svg viewBox="0 0 16 16" className="size-3.5">
              <path
                d="M4 4l8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3.5">{children}</div>

        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-line bg-sunken px-4 py-2.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </>,
    document.body,
  );
}

/* ========================================================================== */
/* DIALOG — kotak tengah, untuk konfirmasi & form pendek                      */
/* ========================================================================== */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  useDismiss(open, onClose);
  const ref = useAutoFocus(open);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <Overlay onClose={onClose} />
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]">
        <div
          role="dialog"
          aria-modal="true"
          ref={ref}
          className="animate-rise w-full max-w-[460px] rounded-[10px] border border-line bg-surface shadow-[var(--shadow-float)]"
        >
          <header className="border-b border-line px-4 py-3">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </header>
          {children ? <div className="px-4 py-3.5">{children}</div> : null}
          {footer ? (
            <footer className="flex justify-end gap-2 border-t border-line bg-sunken px-4 py-2.5">
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ========================================================================== */
/* CONFIRM — dialog konfirmasi untuk aksi merusak                             */
/* ========================================================================== */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Hapus",
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  error?: string | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Memproses…" : confirmLabel}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="rounded-[6px] border border-red-line bg-red-bg px-3 py-2 text-[12px] leading-relaxed text-red-fg">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

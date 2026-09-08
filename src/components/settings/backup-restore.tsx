"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  DownloadSimpleIcon,
  UploadSimpleIcon,
  ShieldWarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { restoreBackup } from "@/actions/backup";
import { Button, Callout, Card, CardHeader, LinkButton } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";

const PHRASE = "PULIHKAN DATA";

/**
 * Backup: unduh seluruh isi database sebagai JSON kapan saja, tanpa syarat.
 * Restore: menimpa SEMUA data dengan isi file yang diunggah — sengaja
 * seberat reset total (frasa konfirmasi diketik ulang), karena efeknya
 * sama-sama tidak bisa dibatalkan begitu berjalan.
 */
export function BackupRestore() {
  const [result, action] = useActionState(restoreBackup, null);
  const [open, setOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (result?.ok) {
      setOpen(false);
      setPhrase("");
      setFileName(null);
      formRef.current?.reset();
    }
  }, [result]);

  return (
    <Card>
      <CardHeader
        title="Backup & Restore"
        description="Simpan salinan seluruh data kapan saja, dan pulihkan kalau ada perubahan yang tidak diinginkan."
      />

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-[8px] border border-line bg-sunken p-3">
          <p className="text-[12.5px] font-medium text-ink">Unduh backup</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            File JSON berisi seluruh transaksi, akun, kategori, dan supplier
            dengan ID aslinya — siap dipulihkan kapan saja. Simpan salinannya
            di tempat lain secara berkala, terutama sebelum membagikan akses
            aplikasi ke orang lain.
          </p>
          <LinkButton
            href="/api/backup"
            prefetch={false}
            variant="solid"
            className="mt-3"
          >
            <DownloadSimpleIcon size={13} />
            Unduh backup sekarang
          </LinkButton>
        </div>

        <div className="rounded-[8px] border border-line bg-sunken p-3">
          <p className="text-[12.5px] font-medium text-ink">Pulihkan dari backup</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Menimpa seluruh data yang ada sekarang dengan isi file backup —
            gunakan ini kalau data berubah tidak semestinya dan Anda punya
            backup dari sebelum kejadian itu.
          </p>

          {!open ? (
            <Button variant="outline" className="mt-3" onClick={() => setOpen(true)}>
              <UploadSimpleIcon size={13} />
              Pulihkan dari file…
            </Button>
          ) : (
            <form ref={formRef} action={action} className="mt-3 space-y-3">
              <Callout tone="yellow">
                <span className="flex items-start gap-1.5">
                  <ShieldWarningIcon
                    size={14}
                    weight="fill"
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Semua transaksi, akun, kategori, dan supplier yang ada{" "}
                    <strong className="font-semibold">saat ini</strong> akan
                    diganti seluruhnya dengan isi file ini. Tindakan ini tidak
                    bisa dibatalkan.
                  </span>
                </span>
              </Callout>

              <div>
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[5px] border border-dashed border-line-strong bg-surface px-2.5 text-[12.5px] text-muted transition-colors hover:border-ink hover:text-ink">
                  <UploadSimpleIcon size={13} />
                  {fileName ?? "Pilih file backup (.json)"}
                  <input
                    type="file"
                    name="file"
                    accept="application/json,.json"
                    className="sr-only"
                    required
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  />
                </label>
              </div>

              <Field label={`Ketik "${PHRASE}" untuk mengonfirmasi`} htmlFor="rconfirm">
                <Input
                  id="rconfirm"
                  name="confirm"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder={PHRASE}
                  autoComplete="off"
                />
              </Field>

              <FormMessage result={result} />

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    setPhrase("");
                    setFileName(null);
                  }}
                >
                  Batal
                </Button>
                <SubmitButton
                  variant="danger"
                  pendingLabel="Memulihkan…"
                  disabled={phrase !== PHRASE || !fileName}
                >
                  Timpa dengan file ini
                </SubmitButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}

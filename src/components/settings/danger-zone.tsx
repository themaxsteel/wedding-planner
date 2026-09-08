"use client";

import * as React from "react";
import { useActionState } from "react";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { resetEverything } from "@/actions/master";
import { Button, Card } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";

const PHRASE = "HAPUS SEMUA";

/**
 * Reset total. Sengaja meminta user mengetik ulang frasa konfirmasi, bukan
 * sekadar menekan tombol kedua — ini menghapus seluruh transaksi, akun,
 * kategori, dan supplier tanpa bisa dibatalkan.
 */
export function DangerZone({ usingTurso }: { usingTurso: boolean }) {
  const [result, action] = useActionState(resetEverything, null);
  const [phrase, setPhrase] = React.useState("");
  const [open, setOpen] = React.useState(false);

  return (
    <Card className="border-red-line">
      <div className="flex items-start gap-2.5 border-b border-red-line bg-red-bg px-4 py-2.5">
        <WarningIcon size={15} weight="fill" className="mt-px shrink-0 text-red-fg" />
        <div>
          <h2 className="text-[13px] font-semibold text-red-fg">
            Reset seluruh data
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-red-fg opacity-90">
            Menghapus semua transaksi, pembayaran, akun, kategori, dan supplier,
            lalu mengembalikan aplikasi ke wizard penyiapan awal.{" "}
            {usingTurso
              ? "Unduh backup di atas dulu bila Anda masih ingin menyimpan catatannya."
              : (
                <>
                  Salin folder <code className="font-mono">data/</code> dulu
                  bila Anda masih ingin menyimpan catatannya.
                </>
              )}
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        {!open ? (
          <Button variant="danger" onClick={() => setOpen(true)}>
            Saya ingin reset data
          </Button>
        ) : (
          <form action={action} className="max-w-md space-y-3">
            <Field
              label={`Ketik "${PHRASE}" untuk mengonfirmasi`}
              htmlFor="confirm"
            >
              <Input
                id="confirm"
                name="confirm"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={PHRASE}
                autoComplete="off"
                autoFocus
              />
            </Field>

            <FormMessage result={result} />

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setPhrase("");
                }}
              >
                Batal
              </Button>
              <SubmitButton
                variant="danger"
                pendingLabel="Menghapus…"
                disabled={phrase !== PHRASE}
              >
                Hapus seluruh data
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

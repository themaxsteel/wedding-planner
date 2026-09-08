"use client";

import * as React from "react";
import { PaperclipIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { Label } from "@/components/ui/field";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const MAX_MB = 8;

/** Foto struk sering hanya puluhan KB; "0.0 MB" tidak memberi tahu apa pun. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Input lampiran bukti/struk. File ikut terkirim di FormData yang sama dengan
 * transaksinya, jadi tidak ada langkah unggah terpisah yang bisa gagal
 * setengah jalan.
 */
export function AttachmentInput({
  label = "Bukti / struk",
  name = "attachments",
}: {
  label?: string;
  name?: string;
}) {
  const [files, setFiles] = React.useState<File[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const oversized = files.filter((f) => f.size > MAX_MB * 1024 * 1024);

  function clearAll() {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1">
      <Label hint="jpg, png, webp, pdf · maks 8 MB">{label}</Label>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[5px] border border-dashed border-line-strong bg-surface px-2.5 text-[12.5px] text-muted transition-colors hover:border-ink hover:text-ink">
          <PaperclipIcon size={13} />
          {files.length > 0 ? "Ganti file" : "Pilih file"}
          <input
            ref={inputRef}
            type="file"
            name={name}
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        {files.map((f) => (
          <span
            key={f.name}
            className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-line bg-sunken py-0.5 pl-2 pr-1 text-[11.5px] text-ink"
          >
            <span className="truncate">{f.name}</span>
            <span className="tnum shrink-0 text-faint">{fileSize(f.size)}</span>
          </span>
        ))}

        {files.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Kosongkan lampiran"
            className="rounded-full p-1 text-faint transition-colors hover:bg-hover hover:text-red-fg"
          >
            <XIcon size={11} weight="bold" />
          </button>
        ) : null}
      </div>

      {oversized.length > 0 ? (
        <p className="text-[11.5px] text-red-fg">
          {oversized.map((f) => f.name).join(", ")} melebihi {MAX_MB} MB dan
          akan dilewati.
        </p>
      ) : null}
    </div>
  );
}

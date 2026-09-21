"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { backupPayloadSchema, importBackup } from "@/lib/backup";
import { getAllAttachmentFileKeys } from "@/db/queries";
import { deleteAttachmentFiles } from "./attachments";
import { guard, type ActionResult } from "./shared";

const CONFIRM_PHRASE = "PULIHKAN DATA";

/**
 * Memulihkan seluruh database dari file backup yang diunggah. Ini menimpa
 * SEMUA data yang ada sekarang — sengaja meminta frasa konfirmasi yang
 * diketik ulang, sama seperti reset total, karena efeknya sama-sama tidak
 * bisa dibatalkan.
 */
export async function restoreBackup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (formData.get("confirm") !== CONFIRM_PHRASE) {
    return {
      ok: false,
      error: `Ketik persis "${CONFIRM_PHRASE}" untuk mengonfirmasi.`,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih file backup (.json) terlebih dahulu." };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, error: "File backup terlalu besar (maksimal 20 MB)." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "File bukan JSON yang valid." };
  }

  const parsed = backupPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Struktur file backup tidak dikenali. Pastikan file ini hasil unduhan dari tombol Backup di aplikasi ini, dan belum diubah-ubah isinya.",
    };
  }

  const db = await getDb();
  const exportedAt = new Date(parsed.data.exportedAt).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });

  // Diambil sebelum restore - importBackup mengganti seluruh baris
  // attachment. File fisik yang tidak lagi direferensikan oleh backup
  // (yang barunya) jadi yatim dan perlu dibersihkan dari storage.
  const existingKeys = await getAllAttachmentFileKeys(db);
  const keepKeys = new Set(parsed.data.attachments.map((a) => a.fileName));
  const orphanedKeys = existingKeys.filter((k) => !keepKeys.has(k));

  const result = await guard(
    () => importBackup(db, parsed.data),
    `Data dipulihkan dari backup tanggal ${exportedAt}.`,
  );
  if (result.ok) {
    await deleteAttachmentFiles(orphanedKeys);
    revalidatePath("/", "layout");
  }
  return result;
}

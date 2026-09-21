"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  addAttachment,
  getAttachment,
  removeAttachment,
  AppError,
} from "@/db/mutations";
import { saveAttachmentFile, deleteAttachmentFile } from "@/lib/storage";
import { guard, type ActionResult } from "./shared";

/**
 * Bukti transfer / struk disimpan lewat lapisan storage (Vercel Blob di
 * production, folder lokal saat dev — lihat src/lib/storage.ts) dengan nama
 * acak. Nama asli hanya tersimpan di database, sehingga nama file dari user
 * tidak pernah ikut menyentuh path penyimpanan (menutup path traversal).
 */

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

export type UploadTarget = { transactionId?: number; paymentId?: number };

/** Menyimpan seluruh file bernama "attachments" pada sebuah FormData. */
export async function saveUploads(
  formData: FormData,
  target: UploadTarget,
): Promise<{ saved: number; skipped: string[] }> {
  const files = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) return { saved: 0, skipped: [] };

  const db = await getDb();
  let saved = 0;
  const skipped: string[] = [];

  for (const file of files) {
    const ext = ALLOWED[file.type];
    if (!ext) {
      skipped.push(`${file.name} (format tidak didukung)`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push(`${file.name} (lebih dari 8 MB)`);
      continue;
    }

    const fileName = `${crypto.randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const storedKey = await saveAttachmentFile(fileName, buffer, file.type);

    await addAttachment(db, {
      transactionId: target.transactionId ?? null,
      paymentId: target.paymentId ?? null,
      fileName: storedKey,
      originalName: file.name.slice(0, 200),
      mime: file.type,
      size: file.size,
    });
    saved += 1;
  }

  return { saved, skipped };
}

/**
 * Versi saveUploads yang TIDAK PERNAH melempar. Dipakai setelah transaksi
 * utamanya sudah tersimpan — kegagalan lampiran (mis. Vercel Blob belum
 * disambungkan, filesystem read-only di production) tidak boleh membatalkan
 * atau merusak transaksi yang sudah benar tercatat. Mengembalikan pesan
 * peringatan untuk ditempel ke hasil aksi, atau null kalau semua sukses.
 */
export async function saveUploadsSafely(
  formData: FormData,
  target: UploadTarget,
): Promise<string | null> {
  try {
    const { skipped } = await saveUploads(formData, target);
    if (skipped.length === 0) return null;
    return `${skipped.length} lampiran dilewati: ${skipped.join(", ")}.`;
  } catch (err) {
    console.error("[saveUploadsSafely]", err);
    if (err instanceof AppError) return err.message;
    // Sementara: tampilkan detail error asli untuk diagnosis (tidak ada
    // akses ke Vercel function logs dari sini). Ganti balik ke pesan
    // generik begitu akar masalahnya ketemu - lihat CLAUDE.md.
    const detail = err instanceof Error ? err.message : String(err);
    return `Lampiran gagal disimpan: ${detail}`;
  }
}

export async function deleteAttachment(id: number): Promise<ActionResult> {
  const result = await guard(async () => {
    const db = await getDb();
    const row = await getAttachment(db, id);
    if (!row) return;
    await removeAttachment(db, id);
    // File fisik dihapus setelah baris database hilang; kalau file sudah
    // tidak ada, biarkan saja - yang penting referensinya bersih.
    await deleteAttachmentFile(row.fileName);
  }, "Lampiran dihapus.");

  if (result.ok) revalidatePath("/", "layout");
  return result;
}

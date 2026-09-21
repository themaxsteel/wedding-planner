import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { put, del, get } from "@vercel/blob";
import { ATTACHMENT_DIR } from "@/db";
import { AppError } from "@/db/mutations";

/**
 * Penyimpanan lampiran (struk/bukti transfer) punya dua backend:
 *
 *  - Vercel Blob  - dipakai otomatis begitu store-nya disambungkan ke
 *                   project (production di Vercel). Filesystem Vercel
 *                   tidak persisten, jadi file lokal akan hilang tiap
 *                   deploy.
 *  - Folder lokal - data/attachments/, dipakai saat `npm run dev` atau
 *                   deploy ke platform dengan persistent disk.
 *
 * `attachment.fileName` di database menyimpan kunci yang cocok dengan
 * backend yang aktif saat file itu diunggah: URL penuh (diawali "http")
 * untuk Blob, atau nama file acak untuk lokal. Route penyaji lampiran
 * membedakan keduanya lewat awalan URL, sehingga aman dipakai bahkan kalau
 * mode penyimpanan pernah berganti di tengah jalan.
 *
 * Deteksi Blob aktif lewat DUA kemungkinan variabel, karena Vercel kini
 * punya dua skema autentikasi untuk paket @vercel/blob:
 *  - `BLOB_READ_WRITE_TOKEN` - skema lama, token statis.
 *  - `BLOB_STORE_ID`         - skema baru: menyambungkan store lewat UI
 *    Vercel hanya membuat variabel ini (+ BLOB_WEBHOOK_PUBLIC_KEY), TANPA
 *    BLOB_READ_WRITE_TOKEN sama sekali - autentikasinya lewat token OIDC
 *    yang disuntik Vercel otomatis ke setiap deployment. `put()`/`del()`
 *    dari @vercel/blob mendeteksi & memakainya sendiri, kita cukup tidak
 *    mengoper opsi `token` secara eksplisit.
 */

const useBlob = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
);
/** Vercel menyetel ini otomatis di semua environment (production/preview/dev). */
const onVercel = Boolean(process.env.VERCEL);

export const attachmentStorageMode: "blob" | "local" = useBlob ? "blob" : "local";

/** Menyimpan file lampiran, mengembalikan kunci yang harus disimpan di attachment.fileName. */
export async function saveAttachmentFile(
  fileName: string,
  buffer: Buffer,
  mime: string,
): Promise<string> {
  if (useBlob) {
    // "private" - bukan "public" - karena store yang dibuat lewat dashboard
    // Vercel defaultnya private (dan sering tidak bisa diubah jadi public
    // untuk store baru). Blob private tidak punya URL yang bisa diakses
    // langsung dari browser; dibaca lagi lewat get() saat disajikan (lihat
    // readBlobAttachmentFile) dan diproksi dari /api/attachments/[id].
    const blob = await put(`attachments/${fileName}`, buffer, {
      access: "private",
      contentType: mime,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  // Filesystem Vercel read-only di luar /tmp — menulis ke folder lokal di
  // sana pasti gagal. Ketahuan lebih dulu dengan pesan yang jelas dan aman
  // ditampilkan, daripada membiarkan error fs mentah (EROFS/ENOENT) menjalar
  // dan merusak permintaan yang sedang berjalan.
  if (onVercel) {
    throw new AppError(
      "Lampiran tidak bisa disimpan: Vercel Blob belum disambungkan ke project ini. " +
        "Buka Storage → Blob di dashboard Vercel, hubungkan ke project ini, lalu " +
        "coba unggah lagi.",
    );
  }

  try {
    await fs.mkdir(ATTACHMENT_DIR, { recursive: true });
    await fs.writeFile(path.join(ATTACHMENT_DIR, fileName), buffer);
    return fileName;
  } catch (err) {
    throw new AppError(
      `Gagal menyimpan lampiran ke folder lokal: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Menghapus file lampiran berdasarkan kunci yang tersimpan di attachment.fileName. */
export async function deleteAttachmentFile(key: string): Promise<void> {
  if (isBlobUrl(key)) {
    await del(key).catch(() => undefined);
    return;
  }
  await fs.unlink(path.join(ATTACHMENT_DIR, key)).catch(() => undefined);
}

/** Membaca isi file lampiran lokal untuk disajikan lewat /api/attachments/[id]. */
export async function readLocalAttachmentFile(key: string): Promise<Buffer> {
  return fs.readFile(path.join(ATTACHMENT_DIR, key));
}

/**
 * Membaca isi file lampiran dari Blob private untuk diproksi lewat
 * /api/attachments/[id] — blob private tidak punya URL yang bisa dibuka
 * langsung oleh browser, jadi rute itu meneruskan stream-nya sendiri
 * (mirip mode lokal), bukan redirect ke URL.
 */
export async function readBlobAttachmentFile(url: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
} | null> {
  const result = await get(url, { access: "private" });
  if (!result || result.stream === null) return null;
  return { stream: result.stream, contentType: result.blob.contentType };
}

export function isBlobUrl(key: string): boolean {
  return key.startsWith("http://") || key.startsWith("https://");
}

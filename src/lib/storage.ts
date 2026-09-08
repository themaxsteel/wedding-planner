import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { put, del } from "@vercel/blob";
import { ATTACHMENT_DIR } from "@/db";

/**
 * Penyimpanan lampiran (struk/bukti transfer) punya dua backend:
 *
 *  - Vercel Blob  - dipakai otomatis kalau BLOB_READ_WRITE_TOKEN diset
 *                   (production di Vercel). Filesystem Vercel tidak
 *                   persisten, jadi file lokal akan hilang tiap deploy.
 *  - Folder lokal - data/attachments/, dipakai saat `npm run dev` atau
 *                   deploy ke platform dengan persistent disk.
 *
 * `attachment.fileName` di database menyimpan kunci yang cocok dengan
 * backend yang aktif saat file itu diunggah: URL penuh (diawali "http")
 * untuk Blob, atau nama file acak untuk lokal. Route penyaji lampiran
 * membedakan keduanya lewat awalan URL, sehingga aman dipakai bahkan kalau
 * mode penyimpanan pernah berganti di tengah jalan.
 */

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export const attachmentStorageMode: "blob" | "local" = useBlob ? "blob" : "local";

/** Menyimpan file lampiran, mengembalikan kunci yang harus disimpan di attachment.fileName. */
export async function saveAttachmentFile(
  fileName: string,
  buffer: Buffer,
  mime: string,
): Promise<string> {
  if (useBlob) {
    const blob = await put(`attachments/${fileName}`, buffer, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  await fs.mkdir(ATTACHMENT_DIR, { recursive: true });
  await fs.writeFile(path.join(ATTACHMENT_DIR, fileName), buffer);
  return fileName;
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

export function isBlobUrl(key: string): boolean {
  return key.startsWith("http://") || key.startsWith("https://");
}

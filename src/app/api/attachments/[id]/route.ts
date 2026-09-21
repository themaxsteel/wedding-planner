import { getDb } from "@/db";
import { getAttachment } from "@/db/mutations";
import {
  isBlobUrl,
  readBlobAttachmentFile,
  readLocalAttachmentFile,
} from "@/lib/storage";

/**
 * Lampiran mode Blob diproksi dari sini (bukan redirect) — store-nya
 * private, jadi URL blob tidak bisa dibuka langsung oleh browser, harus
 * diautentikasi lewat SDK server-side dulu. Lampiran mode lokal
 * (data/attachments, di luar folder public) juga disajikan langsung dari
 * sini. Nama file diambil dari database (kunci yang kita buat sendiri saat
 * upload), bukan dari URL, jadi tidak ada jalan menjelajah keluar direktori
 * lampiran.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return new Response("Lampiran tidak ditemukan.", { status: 404 });
  }

  const db = await getDb();
  const row = await getAttachment(db, numericId);
  if (!row) return new Response("Lampiran tidak ditemukan.", { status: 404 });

  const disposition = `inline; filename*=UTF-8''${encodeURIComponent(row.originalName)}`;

  if (isBlobUrl(row.fileName)) {
    const blob = await readBlobAttachmentFile(row.fileName);
    if (!blob) {
      return new Response("File lampiran tidak ada lagi di Blob storage.", {
        status: 410,
      });
    }
    return new Response(blob.stream, {
      headers: {
        "Content-Type": blob.contentType || row.mime,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  try {
    const file = await readLocalAttachmentFile(row.fileName);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": row.mime,
        "Content-Length": String(file.byteLength),
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response(
      "File lampiran tidak ada lagi di folder data/attachments.",
      { status: 410 },
    );
  }
}

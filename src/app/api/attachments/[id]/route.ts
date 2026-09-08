import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getAttachment } from "@/db/mutations";
import { isBlobUrl, readLocalAttachmentFile } from "@/lib/storage";

/**
 * Lampiran mode Blob disajikan lewat redirect ke URL publiknya. Lampiran
 * mode lokal (data/attachments, di luar folder public) disajikan langsung
 * dari sini. Nama file diambil dari database (kunci yang kita buat sendiri
 * saat upload), bukan dari URL, jadi tidak ada jalan menjelajah keluar
 * direktori lampiran.
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

  if (isBlobUrl(row.fileName)) {
    return NextResponse.redirect(row.fileName);
  }

  try {
    const file = await readLocalAttachmentFile(row.fileName);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": row.mime,
        "Content-Length": String(file.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
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

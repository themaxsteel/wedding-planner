import { getDb } from "@/db";
import { backupFileName, exportBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * Unduhan JSON berisi seluruh isi database (dengan ID asli, siap dipulihkan
 * lewat halaman Pengaturan). Beda dari /api/export/* yang formatnya untuk
 * dibaca manusia — ini murni untuk backup/restore.
 */
export async function GET() {
  const db = await getDb();
  const payload = await exportBackup(db);
  const json = JSON.stringify(payload, null, 2);

  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        backupFileName(payload),
      )}`,
      "Cache-Control": "no-store",
    },
  });
}

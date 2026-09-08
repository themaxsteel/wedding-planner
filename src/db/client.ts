import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle, type LibSQLDatabase, type LibSQLTransaction } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

/**
 * Tipe koneksi yang dipakai di seluruh lapisan query & mutasi.
 * Semua fungsi di queries.ts / mutations.ts menerima DB sebagai argumen
 * pertama supaya bisa diuji terhadap database in-memory tanpa menyentuh
 * singleton milik server.
 *
 * Driver-nya libSQL — SATU driver yang sama dipakai untuk:
 *   - file lokal saat `npm run dev`   (url = "file:data/wedding.db")
 *   - Turso cloud saat production     (url = "libsql://...", + authToken)
 *   - database in-memory saat test    (url = ":memory:")
 * Konsekuensinya: seluruh query/mutation bersifat ASYNC (network I/O),
 * berbeda dari versi lama yang memakai better-sqlite3 secara sinkron.
 */
export type DB = LibSQLDatabase<typeof schema>;

/**
 * Objek `tx` yang diterima dalam `db.transaction(async (tx) => {...})`.
 * TypeScript-nya BUKAN subtype dari `DB` (kurang beberapa method seperti
 * `.batch()`), padahal secara runtime tx punya seluruh method query yang
 * dipakai di queries.ts/mutations.ts (`.select()`, `.get()`, `.all()`,
 * `.run()`, dst). `DBOrTx` adalah union eksplisit untuk helper kecil yang
 * memang dipanggil dari dalam maupun luar transaksi (mis. recalcPaymentStatus).
 */
export type Tx = LibSQLTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
export type DBOrTx = DB | Tx;

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/**
 * Membuka koneksi, menjalankan migrasi, dan memastikan baris event tunggal
 * (id=1) tersedia.
 *
 * @param url - "file:<path>" untuk lokal, "libsql://..." untuk Turso, atau
 *              ":memory:" untuk database uji.
 * @param authToken - wajib untuk Turso, diabaikan untuk file lokal/memory.
 */
export async function createDb(url: string, authToken?: string): Promise<DB> {
  const isLocalFile = url.startsWith("file:");
  if (isLocalFile) {
    const filePath = url.slice("file:".length);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const client = createClient(authToken ? { url, authToken } : { url });

  if (isLocalFile) {
    // WAL: pembacaan tetap jalan saat ada penulisan. Next.js menembak
    // banyak query paralel per request, tanpa ini gampang kena SQLITE_BUSY.
    // Turso remote sudah managed dan tidak memakai/mendukung pragma ini.
    await client.execute("PRAGMA journal_mode = WAL");
  }
  // SQLite (dan libSQL) mematikan foreign key per koneksi secara default.
  // Tanpa baris ini seluruh aturan onDelete di schema tidak berlaku.
  await client.execute("PRAGMA foreign_keys = ON");

  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

  const existing = await client.execute("SELECT id FROM event WHERE id = 1");
  if (existing.rows.length === 0) {
    await client.execute({
      sql: "INSERT INTO event (id, name, currency, setup_step) VALUES (1, ?, 'IDR', 1)",
      args: ["Wedding"],
    });
  }

  return db;
}

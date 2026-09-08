import "server-only";

import path from "node:path";
import { createDb, type DB } from "./client";

export const DATA_DIR = path.join(process.cwd(), "data");
/** Hanya relevan saat memakai file lokal (dev) — bukan saat Blob (Vercel). */
export const ATTACHMENT_DIR = path.join(DATA_DIR, "attachments");
export const DB_PATH = path.join(DATA_DIR, "wedding.db");

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

/** true kalau aplikasi ini terhubung ke Turso (production), bukan file lokal. */
export const usingTurso = Boolean(TURSO_URL);

const globalForDb = globalThis as unknown as { __weddingDb?: Promise<DB> };

function connect(): Promise<DB> {
  const p = TURSO_URL
    ? createDb(TURSO_URL, TURSO_TOKEN)
    : createDb(`file:${DB_PATH}`);

  // Kalau koneksi pertama gagal (mis. Turso sedang hiccup), jangan simpan
  // Promise yang reject itu selamanya — bersihkan cache-nya supaya
  // percobaan berikutnya benar-benar mencoba lagi, bukan mengulang error
  // yang sama terus-menerus sampai server di-restart.
  p.catch(() => {
    if (globalForDb.__weddingDb === p) delete globalForDb.__weddingDb;
  });
  return p;
}

/**
 * Satu-satunya cara mengambil koneksi database di seluruh app. Dicache di
 * `globalThis` supaya hot reload (dev) maupun request berikutnya di
 * instance serverless yang sama (production) memakai ulang koneksi yang
 * sudah ada, bukan membuka koneksi baru setiap kali.
 */
export async function getDb(): Promise<DB> {
  if (!globalForDb.__weddingDb) {
    globalForDb.__weddingDb = connect();
  }
  return globalForDb.__weddingDb;
}

export type { DB } from "./client";
export * from "./schema";

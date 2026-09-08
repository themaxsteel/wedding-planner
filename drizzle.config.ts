import type { Config } from "drizzle-kit";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

/**
 * "turso" dialect di drizzle-kit berbicara SQL yang sama persis dengan
 * SQLite (libSQL kompatibel penuh) — dipakai supaya `db:studio` bisa
 * menunjuk ke Turso saat env var-nya diisi, atau file lokal saat tidak.
 * Migrasi sungguhan tetap dijalankan lewat src/db/client.ts, bukan
 * drizzle-kit push.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: tursoUrl
    ? { url: tursoUrl, authToken: tursoToken }
    : { url: "file:./data/wedding.db" },
} satisfies Config;

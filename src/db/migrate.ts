/**
 * Menjalankan migrasi secara eksplisit tanpa membuka aplikasi Next.js.
 * Dipakai sebagai langkah deploy terpisah (lihat `npm run db:migrate`)
 * supaya migrasi Turso tidak menunggu request pertama dari user, dan tidak
 * balapan kalau beberapa instance serverless cold-start bersamaan.
 *
 * Memakai TURSO_DATABASE_URL/TURSO_AUTH_TOKEN kalau ada di environment,
 * kalau tidak jatuh ke file lokal data/wedding.db.
 */
import path from "node:path";
import { createDb } from "./client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  const target = url ?? `file:${path.join(process.cwd(), "data", "wedding.db")}`;

  console.log(`Menjalankan migrasi ke: ${url ? "Turso" : target}`);
  await createDb(target, token);
  console.log("Migrasi selesai.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migrasi gagal:", err);
  process.exit(1);
});

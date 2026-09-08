# Wedding Finance Planner

Pencatat keuangan untuk **satu event pernikahan**. Next.js 15 + database
libSQL — file lokal (`data/wedding.db`) saat dev, [Turso](https://turso.tech)
saat dideploy ke Vercel. Dikunci password tunggal (`APP_PASSWORD`).

Bahasa UI: **Bahasa Indonesia**. Mata uang: **IDR**.

Panduan deploy lengkap ada di [DEPLOY.md](DEPLOY.md).

---

## Aturan akuntansi — jangan diubah tanpa alasan kuat

Ini inti aplikasi. Semuanya hidup di `src/db/queries.ts` dan `src/db/mutations.ts`.

Ada dua basis perhitungan yang sengaja dipisah dan **tidak boleh dicampur**:

| Basis | Sumber | Dipakai untuk |
|---|---|---|
| **Akrual (komitmen)** | `SUM(transaction.amount)` | Membebani **budget** begitu kesepakatan dibuat, walau belum dibayar |
| **Kas (realisasi)** | `SUM(payment.amount)` | Satu-satunya hal yang menggerakkan **saldo akun** |
| **Hutang** | akrual − kas pada expense | Daftar kewajiban ke supplier |

```
saldo(sub_account) = opening_balance
                   + Σ payment (transaksi income)
                   − Σ payment (transaksi expense)
                   + Σ transfer masuk
                   − Σ transfer keluar

terpakai(kategori induk) = Σ transaction.amount seluruh sub-kategorinya
sisa hutang(transaction) = transaction.amount − Σ payment.amount
```

Konsekuensinya:

- **Baris `payment` adalah SATU-SATUNYA sumber pergerakan kas.** Expense lunas
  membuat 1 payment penuh; expense berhutang tidak membuat payment sama sekali.
- `transaction.paymentStatus` adalah nilai **turunan**. Selalu ditulis ulang
  lewat `recalcPaymentStatus()`, tidak pernah diambil dari form.
- Transfer tidak menyentuh kategori, budget, maupun hutang.
- Tidak boleh ada komponen UI yang menghitung ulang rumus di atas. Kalau butuh
  angka baru, tambahkan fungsi di `queries.ts`.

`src/db/accounting.test.ts` mengunci semua aturan ini terhadap database
in-memory. Jalankan `npm run verify` setelah menyentuh lapisan data.

---

## Arsitektur data — ASYNC, driver libSQL

Seluruh `queries.ts` dan `mutations.ts` bersifat **async**. Driver database-nya
`@libsql/client` (+ `drizzle-orm/libsql`) — satu driver yang sama dipakai untuk
tiga target lewat URL koneksi yang berbeda:

| Target | URL | Dipakai saat |
|---|---|---|
| File lokal | `file:data/wedding.db` | `npm run dev` |
| Turso (cloud) | `libsql://...` + authToken | Production (Vercel) |
| In-memory | `:memory:` | `npm run verify` (test) |

Tidak ada percabangan kode berbeda antar target — hanya `src/db/index.ts`
yang memilih URL berdasarkan env var `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`.

**Pola pemakaian di setiap Server Component / Server Action:**

```ts
import { getDb } from "@/db";

const db = await getDb();
const data = await getDashboard(db); // semua fungsi queries/mutations di-await
```

`getDb()` mengembalikan Promise yang di-cache di `globalThis` (lihat komentar
di `src/db/index.ts`) — aman dipanggil berkali-kali, tidak membuka koneksi baru.

**Query yang saling tidak bergantung dijalankan lewat `Promise.all(...)`**,
bukan berurutan — penting karena Turso adalah database jaringan (setiap query
punya latensi round-trip). Lihat `getDashboard()` di `queries.ts` sebagai
contoh polanya.

**Transaksi:** `db.transaction(async (tx) => { ... })`, seluruh operasi di
dalamnya `await tx.xxx()`. Tipe `tx` BUKAN subtype dari `DB` (drizzle-orm
membedakan tipenya) — untuk helper yang dipanggil dari dalam maupun luar
transaksi (`paidTotalFor`, `recalcPaymentStatus`, `accountUsageCount`),
parameternya bertipe `DBOrTx` (lihat `src/db/client.ts`), bukan `as DB`.

---

## Autentikasi

Satu password bersama untuk seluruh aplikasi (`APP_PASSWORD`), bukan akun
per-orang — cocok untuk pemakaian rumah tangga/WO kecil, bukan multi-tenant.

- `src/middleware.ts` — gerbang di depan SEMUA route (halaman & `/api/*`).
  **Gagal tertutup**: kalau `APP_PASSWORD` belum diset, seluruh app memblokir
  dirinya sendiri (503), bukan diam-diam terbuka.
- `src/lib/auth.ts` — cookie session **stateless**: nilainya adalah
  SHA-256 dari `APP_PASSWORD`, dihitung ulang setiap request lewat Web
  Crypto (`crypto.subtle`, bukan `node:crypto`, supaya jalan juga di Edge
  runtime tempat middleware berjalan). Mengganti `APP_PASSWORD` otomatis
  membatalkan semua sesi yang sedang aktif — tidak perlu invalidasi manual.
- `src/actions/auth.ts` — `login()` (set cookie + redirect) dan `logout()`.

---

## Lampiran (foto struk)

`src/lib/storage.ts` memilih backend berdasarkan env var, transparan bagi
pemanggilnya:

- **Vercel Blob** — dipakai kalau `BLOB_READ_WRITE_TOKEN` diset (production).
- **Folder lokal** (`data/attachments/`) — fallback untuk dev.

`attachment.fileName` di database menyimpan URL penuh (mode Blob, diawali
`http`) atau nama file acak (mode lokal) — route `/api/attachments/[id]`
membedakan keduanya lewat awalan URL saat menyajikan file.

---

## Backup & Restore

`src/lib/backup.ts` — ekspor/impor **seluruh** isi database (bukan hanya
laporan ringkasan) sebagai satu file JSON, termasuk ID asli setiap baris
supaya relasi antar tabel tetap utuh saat dipulihkan.

- `GET /api/backup` — unduh, tanpa syarat apa pun.
- `restoreBackup()` di `src/actions/backup.ts` — pulihkan (replace total),
  divalidasi dengan `backupPayloadSchema` (Zod) sebelum menyentuh database,
  dan seluruh penulisan ulang dibungkus satu `db.transaction()` supaya
  atomik: gagal di tengah jalan = data lama tetap utuh.
- UI-nya di `src/components/settings/backup-restore.tsx`, halaman Pengaturan.

Lampiran (file fisiknya) **tidak** ikut di file backup ini — hanya metadata
baris `attachment`. File asli tetap di Blob/folder lokal masing-masing.

---

## Konvensi

- **Uang** disimpan sebagai `INTEGER` rupiah penuh (tanpa sen). Tidak pernah
  float. Input user melewati `parseIDR()` di `src/lib/money.ts`.
- **Tanggal bisnis** (`date`, `dueDate`) disimpan `TEXT "YYYY-MM-DD"` agar bisa
  difilter & diurutkan langsung di SQL. Timestamp sistem disimpan epoch ms.
- **Kategori tepat 2 tingkat.** Induk (`parentId IS NULL`) memegang budget;
  sub-kategori dipilih saat transaksi. Dikunci di `saveCategory()`.
- **Akun 2 tingkat.** `account_group` (main) hanya menjumlahkan; `account` (sub)
  satu-satunya tempat transaksi.
- **Arsip, bukan hapus.** Akun/kategori/supplier yang sudah dipakai transaksi
  hanya boleh diarsipkan — dijaga oleh `*UsageCount()` di `queries.ts`.
- **Server Actions** dibungkus `run()` / `guard()` di `src/actions/shared.ts`,
  yang menerjemahkan `AppError` dan `ZodError` jadi pesan Indonesia yang aman.
- **Penulisan multi-tabel** selalu di dalam `db.transaction()`.

---

## Arah desain (taste-skill)

Skill `minimalist-ui` dari `Leonxlnx/taste-skill` terpasang di `.agents/skills/`.
Dial yang dipakai:

- `DESIGN_VARIANCE`: rendah–sedang — grid rapi, bukan layout asimetris.
- `MOTION_INTENSITY`: rendah — hover state + transisi 150ms, kaskade halus.
  **Animasi masuk chart (Recharts) sengaja dimatikan** (`isAnimationActive={false}`)
  — selain di luar dial ini, animasinya jalan lewat `requestAnimationFrame`
  yang ditahan browser kalau tab tidak di foreground saat halaman dimuat,
  membuat chart tampak kosong.
- `VISUAL_DENSITY`: **tinggi** — ini aplikasi keuangan harian, bukan halaman
  pemasaran. Aturan macro-whitespace bawaan skill (`py-24`, `max-w-4xl`)
  **tidak** dipakai; tabel rapat dan angka sekilas-baca yang diutamakan.

Yang tetap diikuti dari skill:

- Palet warm monochrome (`#fbfbfa` / `#ffffff` / border `#e8e7e3` /
  teks `#2f3437`), pastel hanya untuk makna semantik.
- Tanpa gradient, tanpa shadow berat, tanpa `rounded-full` untuk kontainer besar.
- Bukan Inter/Roboto: Geist Sans (UI), Instrument Serif (judul), Geist Mono.
- Ikon Phosphor, bukan Lucide/Feather. Tanpa emoji di UI.
- Angka uang selalu memakai kelas `.tnum` (tabular-nums) agar digit sejajar.
- Nominal TIDAK PERNAH dipotong dengan `truncate`/`text-overflow` — kolom
  numerik tabel memakai `whitespace-nowrap` (lebar diserap `TableWrap`'s
  scroll horizontal), `StatTile` membiarkan angka turun baris kalau perlu.
  "Rp 193.000…" yang terpotong terbaca sebagai angka lain — lebih berbahaya
  daripada layout yang sedikit tidak rapi.

Token warna ada di `src/app/globals.css`; mode gelap mendefinisikan ulang
variabel yang sama.

---

## Perintah

```bash
npm run dev        # http://localhost:3000 (perlu .env.local berisi APP_PASSWORD)
npm run verify     # tes aturan akuntansi (Vitest, database in-memory)
npm run build      # build produksi
npm run db:generate  # buat migrasi setelah mengubah src/db/schema.ts
npm run db:migrate   # jalankan migrasi eksplisit (biasanya otomatis, lihat DEPLOY.md)
```

Utilitas: `node scripts/inspect.mjs` (isi database — otomatis Turso kalau env
var-nya diset), `node scripts/check-backup.mjs <file.json>` (ringkasan isi
file backup), dan `node scripts/pdf-text.mjs <file.pdf> [kata kunci...]`
(verifikasi ekspor PDF).

> **Jangan menjalankan `npm run build` sementara `npm run dev` masih hidup.**
> Keduanya menulis ke `.next/`, dan dev server akan gagal dengan
> `Cannot find module './xxx.js'`. Kalau terlanjur: hentikan dev server,
> `rm -rf .next`, lalu `npm run dev` lagi.

---

## Peta file

```
src/db/schema.ts        skema Drizzle + CHECK constraint
src/db/client.ts         createDb(url, token?) - driver libSQL, dipakai server & tes
src/db/index.ts          getDb() - singleton ter-cache, pilih Turso vs file lokal
src/db/queries.ts   ★    SEMUA perhitungan saldo/budget/hutang (async)
src/db/mutations.ts ★    SEMUA aturan penulisan + AppError (async)
src/middleware.ts        gerbang password, semua route
src/lib/auth.ts          cookie session stateless
src/lib/storage.ts       lampiran: Vercel Blob vs folder lokal
src/lib/backup.ts        ekspor/impor seluruh database sebagai JSON
src/actions/             Server Actions per domain
src/lib/money.ts         format & parse rupiah, ambang kesehatan budget
src/lib/presets.ts       preset akun & kategori wedding Indonesia
src/lib/report.ts        sumber tunggal data laporan (layar, Excel, PDF)
src/app/login/           halaman login
src/app/setup/           wizard 5 langkah (gerbang wajib setelah login)
src/app/(app)/           halaman aplikasi
src/app/api/export/      xlsx (exceljs) & pdf (@react-pdf/renderer)
src/app/api/backup/      unduhan JSON backup
```

## Catatan teknis

- `next.config.mjs`, bukan `.ts` — Next 15 gagal memuat config TS pada
  kombinasi versi TypeScript di sini.
- TypeScript dikunci di **v6**. Next 15 belum mendukung compiler native TS 7.
- `@libsql/client`, `@react-pdf/renderer`, dan `exceljs` ada di
  `serverExternalPackages`.
- `src/middleware.ts` sengaja hanya memakai Web Crypto (`crypto.subtle`),
  bukan `node:crypto` — middleware Next.js berjalan di Edge runtime secara
  default, yang tidak punya modul `node:crypto` penuh.

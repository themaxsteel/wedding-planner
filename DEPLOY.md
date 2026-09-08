# Deploy ke Vercel

Aplikasi ini berjalan lokal tanpa syarat apa pun (`npm run dev`, file SQLite
di `data/`). Untuk dideploy ke Vercel, ada 3 hal yang perlu disiapkan lebih
dulu karena Vercel adalah platform *serverless* — filesystem-nya dibuang
ulang setiap deploy dan tidak dibagi antar request:

1. **Database** — pindah dari file lokal ke [Turso](https://turso.tech) (gratis untuk pemakaian ini).
2. **Lampiran** (foto struk) — pindah dari folder lokal ke [Vercel Blob](https://vercel.com/storage/blob).
3. **Password** — satu environment variable, `APP_PASSWORD`.

Kodenya sudah mendukung ketiganya secara otomatis lewat environment
variable — tidak ada percabangan kode manual yang perlu diaktifkan.

---

## 1. Siapkan Turso

```bash
# Sekali saja: pasang CLI Turso dan login
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

# Buat database
turso db create wedding-finance-planner

# Ambil connection string dan token
turso db show wedding-finance-planner --url
turso db tokens create wedding-finance-planner
```

Simpan dua nilai itu — dipakai sebagai `TURSO_DATABASE_URL` dan
`TURSO_AUTH_TOKEN` di langkah 4.

Tidak punya akses terminal? Buat database yang sama lewat dashboard di
[turso.tech](https://turso.tech) — hasilnya identik.

---

## 2. Siapkan Vercel Blob

Di dashboard project Vercel (setelah project-nya ada — lanjut ke langkah 3
dulu kalau belum): **Storage → Create Database → Blob** → hubungkan ke
project ini. Vercel otomatis menambahkan environment variable
`BLOB_READ_WRITE_TOKEN` — tidak perlu disalin manual.

Kalau langkah ini dilewati, fitur unggah bukti struk tetap tidak error —
tapi lampiran akan disimpan ke filesystem sementara Vercel dan **hilang di
deploy berikutnya**. Aman untuk dicoba dulu tanpa Blob, tambahkan kapan saja
belakangan.

---

## 3. Deploy project

```bash
npm install -g vercel   # sekali saja
vercel                  # ikuti prompt, hubungkan ke repo/folder ini
```

Atau import repo Git-nya langsung dari dashboard Vercel — framework
preset "Next.js" terdeteksi otomatis, tidak perlu mengubah build command.

---

## 4. Set environment variables

Di **Project Settings → Environment Variables** (atau `vercel env add`):

| Nama | Wajib | Nilai |
|---|---|---|
| `APP_PASSWORD` | ✅ | Password bebas Anda tentukan — pakai yang tidak mudah ditebak. |
| `TURSO_DATABASE_URL` | ✅ | Dari `turso db show ... --url` (langkah 1). |
| `TURSO_AUTH_TOKEN` | ✅ | Dari `turso db tokens create ...` (langkah 1). |
| `BLOB_READ_WRITE_TOKEN` | opsional | Diisi otomatis oleh Vercel kalau Blob sudah dihubungkan (langkah 2). |

**Tanpa `APP_PASSWORD`, seluruh aplikasi memblokir dirinya sendiri** (lihat
`src/middleware.ts`) — ini sengaja, supaya tidak pernah ke-deploy dalam
keadaan terbuka tanpa disadari.

Setelah environment variable diisi, **redeploy** (Vercel tidak menerapkan
env var baru ke deployment yang sudah berjalan).

---

## 5. Jalankan migrasi & mulai pakai

Migrasi database berjalan otomatis saat request pertama masuk (lihat
`src/db/client.ts`), jadi biasanya tidak perlu langkah manual. Kalau ingin
menjalankannya lebih dulu secara eksplisit (disarankan sebelum trafik
sungguhan, supaya request pertama user tidak menunggu):

```bash
TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." npm run db:migrate
```

Buka URL Vercel-nya → halaman login → masukkan `APP_PASSWORD` → wizard
setup seperti biasa.

---

## Menjalankan hal lain terhadap Turso dari lokal

Semua utilitas di `scripts/` otomatis memakai Turso kalau environment
variable-nya diset, kalau tidak jatuh ke file lokal:

```bash
TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." node scripts/inspect.mjs
TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." npx drizzle-kit studio
```

---

## Backup rutin

Login mengizinkan **siapa pun yang tahu password** untuk melihat dan
mengubah semua data — itulah tujuannya (memberi akses ke keluarga/tim WO).
Konsekuensinya: kalau ada yang iseng mengubah angka, aplikasi tidak tahu
mana yang "benar". Jalur pemulihannya ada di **Pengaturan → Backup &
Restore**:

- **Unduh backup** kapan saja — file JSON berisi seluruh transaksi, akun,
  kategori, dan supplier dengan ID aslinya.
- **Pulihkan dari backup** menimpa seluruh data saat ini dengan isi file
  itu (perlu ketik ulang frasa konfirmasi, sama seperti reset total).

Biasakan mengunduh backup:
- Sebelum membagikan `APP_PASSWORD` ke orang baru.
- Secara berkala (mis. tiap minggu menjelang hari-H).
- Sebelum mengubah struktur akun/kategori dalam jumlah besar.

Simpan file backup-nya di luar aplikasi (Google Drive, email ke diri
sendiri, dsb) — aplikasi ini tidak menyimpan riwayat backup lamanya sendiri.

---

## Mengganti password

Ubah `APP_PASSWORD` di environment variable Vercel, lalu redeploy (atau
tunggu deployment berikutnya). Ini **langsung membatalkan seluruh sesi
login yang sedang aktif** di semua perangkat — tidak perlu langkah lain.

---

## Ringkasan arsitektur

| Komponen | Lokal (`npm run dev`) | Vercel (production) |
|---|---|---|
| Database | File `data/wedding.db` (libSQL) | Turso (libSQL cloud) |
| Lampiran | Folder `data/attachments/` | Vercel Blob |
| Password | `.env.local` | Environment variable project |

Driver database yang dipakai **sama persis** di kedua lingkungan
(`@libsql/client` + `drizzle-orm/libsql`) — tidak ada cabang kode berbeda
antara dev dan production, hanya URL koneksinya yang berbeda. Lihat
`src/db/client.ts` dan `src/lib/storage.ts`.

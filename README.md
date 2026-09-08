# Wedding Finance Planner

Aplikasi pencatat keuangan untuk **satu event pernikahan** — bisa dijalankan
di komputer sendiri, atau dideploy ke Vercel untuk diakses dari mana saja
oleh keluarga/panitia (dikunci password).

Masalah yang diselesaikan: uang pernikahan tersebar di beberapa rekening dan
kas, budget per pos gampang jebol tanpa disadari, dan hampir semua vendor
dibayar bertahap (DP → termin → pelunasan) sehingga sisa kewajiban sulit
dilacak.

---

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # lalu isi APP_PASSWORD
npm run dev
```

Buka <http://localhost:3000> → login dengan `APP_PASSWORD` → wizard
penyiapan (tidak bisa dilewati — angka budget dan saldo tidak ada artinya
tanpa akun dan kategori).

Data tersimpan di `data/wedding.db` (SQLite lokal) — tidak perlu database
eksternal untuk pemakaian lokal.

## Deploy ke Vercel

Lihat [DEPLOY.md](DEPLOY.md) — perlu database [Turso](https://turso.tech)
(gratis) dan opsional [Vercel Blob](https://vercel.com/storage/blob) untuk
lampiran. Semuanya lewat environment variable, tanpa mengubah kode.

---

## Yang membedakan aplikasi ini

**Budget dibebani saat kesepakatan dibuat, bukan saat uang keluar.**

Begitu Anda mencatat "Video Rp 12 juta, belum dibayar":

| Yang berubah | Yang tidak berubah |
|---|---|
| Budget Dokumentasi terpakai +12 juta | Saldo BCA tetap |
| Muncul di daftar Hutang, dengan jatuh tempo | Kas keluar tetap |

Jadi pos yang sudah *habis dijanjikan ke vendor* langsung terlihat merah, meski
rekening masih terlihat gemuk. Dashboard menampilkan keduanya berdampingan —
**Terpakai** (komitmen) dan **Kas keluar** (realisasi); selisihnya persis sama
dengan **Total hutang**.

---

## Penyiapan awal (5 langkah)

1. **Detail event** — nama, tanggal hari-H, target total budget.
2. **Assets account** — main account (Bank / Tunai / E-Wallet) lalu sub account
   di dalamnya beserta saldo awal. Transaksi hanya bisa ditulis di sub account;
   main account murni menjumlahkan.
3. **Kategori** — dua tingkat, dengan preset pernikahan Indonesia yang bisa
   dicentang, diubah namanya, atau ditambah sendiri.
4. **Budget** — satu angka per kategori induk untuk **seluruh event**, bukan
   per bulan. Ada tombol bagi rata sisa target.
5. **Supplier** — opsional, bisa dilewati dan diisi sambil jalan.

---

## Fitur

- **Login dengan password** — satu password bersama untuk seluruh aplikasi,
  diset lewat `APP_PASSWORD`. Ganti kapan saja untuk langsung mencabut akses
  semua orang yang sedang login.
- **Transaksi** — pengeluaran, pemasukan, dan transfer antar akun. Tiap
  pengeluaran bisa ditandai *Lunas*, *DP sebagian*, atau *Belum bayar*, dengan
  supplier, jatuh tempo, catatan, dan lampiran bukti.
- **Hutang** — daftar kewajiban terbuka, bisa dilihat per transaksi atau
  dikelompokkan per supplier. Mencatat termin pembayaran langsung mengurangi
  saldo sub account yang dipakai; sisa dan statusnya dihitung ulang otomatis.
- **Budget** — progress per kategori induk (hijau / kuning / merah), bisa
  dibuka ke sub-kategori, budget diubah langsung dari halaman ini.
- **Akun** — saldo tiap sub account plus **buku kas** dengan saldo berjalan
  per baris.
- **Laporan** — rekap di layar, ekspor **Excel** (6 lembar, termasuk buku kas
  dan seluruh transaksi mentah) dan **PDF** ringkasan dua halaman, serta cetak
  langsung dari browser.
- **Backup & Restore** — unduh seluruh isi database sebagai satu file JSON
  kapan saja, dan pulihkan (timpa total) kalau ada perubahan data yang tidak
  diinginkan. Jalur pemulihan utama kalau ada yang mengubah data secara
  tidak semestinya.
- Mode terang & gelap, dan tetap terpakai di layar ponsel.

---

## Keamanan & data

- **Password tunggal** (`APP_PASSWORD`) menjaga seluruh aplikasi, termasuk
  ekspor Excel/PDF dan unduhan backup — tidak ada halaman yang bisa diakses
  tanpa login.
- Password **bukan** dipakai per-orang (tidak ada akun terpisah) — siapa pun
  yang tahu password punya akses penuh untuk melihat dan mengubah data. Ini
  memang tujuannya (mudah dibagikan ke keluarga/panitia), tapi konsekuensinya
  aplikasi tidak bisa membedakan siapa yang mengubah apa.
- **Backup rutin** adalah jaring pengaman untuk itu — lihat bagian Backup &
  Restore di [DEPLOY.md](DEPLOY.md#backup-rutin) untuk kapan sebaiknya
  mengunduh backup.
- Lokal: seluruh data di folder `data/`, tidak pernah keluar dari komputer
  Anda. Vercel: data di Turso (database Anda sendiri) dan Vercel Blob (bucket
  Anda sendiri) — bukan server pihak ketiga yang tidak jelas.

---

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan aplikasi (perlu `.env.local`) |
| `npm run verify` | Uji aturan akuntansi (saldo, budget, hutang) |
| `npm run build` | Build produksi |
| `node scripts/inspect.mjs` | Intip isi database dari terminal |

---

## Teknis singkat

Next.js 15 (App Router, Server Actions, middleware) · database libSQL via
`@libsql/client` (file lokal saat dev, [Turso](https://turso.tech) saat
production — driver yang sama, hanya URL koneksi yang berbeda) · Drizzle
ORM · Zod · Tailwind CSS v4 · Recharts · ExcelJS · @react-pdf/renderer ·
Vercel Blob untuk lampiran.

Nilai uang disimpan sebagai integer rupiah penuh — tidak ada floating point,
jadi penjumlahan cicilan tidak pernah meleset serupiah pun.

Detail arsitektur, aturan akuntansi, dan konvensi kodenya ada di
[CLAUDE.md](CLAUDE.md). Panduan deploy ke Vercel ada di [DEPLOY.md](DEPLOY.md).

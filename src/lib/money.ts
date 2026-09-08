/**
 * Seluruh nilai uang di aplikasi ini adalah INTEGER rupiah penuh.
 * Tidak ada sen, tidak ada float — supaya penjumlahan hutang/cicilan
 * tidak pernah meleset karena pembulatan biner.
 */

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const plain = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 1250000 -> "Rp 1.250.000" */
export function formatIDR(value: number): string {
  return idr.format(value).replace(/\s/g, " ");
}

/** 1250000 -> "1.250.000" (untuk kolom tabel yang sudah punya header Rp) */
export function formatNumber(value: number): string {
  return plain.format(value);
}

/** 1250000 -> "1,3 jt" — untuk label chart & KPI sempit */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}${trim(abs / 1_000_000_000)} m`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)} rb`;
  return `${sign}${abs}`;
}

function trim(n: number): string {
  return n
    .toFixed(n < 10 ? 1 : 0)
    .replace(/\.0$/, "")
    .replace(".", ",");
}

/**
 * Menerima apa pun yang diketik user ("Rp 1.250.000", "1250000", "1.250,00")
 * dan mengembalikan integer rupiah. Nilai tidak valid -> 0.
 */
export function parseIDR(input: string | number | null | undefined): number {
  if (typeof input === "number") return Math.round(input);
  if (!input) return 0;

  // Buang semua kecuali digit, koma, titik, dan minus di depan.
  let s = String(input).trim().replace(/[^\d.,-]/g, "");
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (!s) return 0;

  // Format Indonesia: titik = pemisah ribuan, koma = desimal.
  // Desimal dibuang karena rupiah disimpan tanpa sen.
  const commaAt = s.lastIndexOf(",");
  if (commaAt !== -1) s = s.slice(0, commaAt);
  s = s.replace(/[.,]/g, "");

  const n = Number.parseInt(s || "0", 10);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

/** Persentase terpakai, dibatasi agar aman dipakai sebagai lebar progress bar. */
export function percentOf(used: number, total: number): number {
  if (total <= 0) return used > 0 ? 100 : 0;
  return Math.round((used / total) * 100);
}

export type BudgetHealth = "empty" | "safe" | "warning" | "over";

/** Ambang warna progress bar budget: <=75% aman, <=100% waspada, >100% jebol. */
export function budgetHealth(used: number, budget: number): BudgetHealth {
  if (budget <= 0) return used > 0 ? "over" : "empty";
  const pct = (used / budget) * 100;
  if (pct > 100) return "over";
  if (pct > 75) return "warning";
  return "safe";
}

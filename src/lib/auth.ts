/**
 * Gerbang password tunggal untuk seluruh aplikasi — bukan sistem akun
 * per-orang, tapi satu password bersama (cocok untuk pemakaian rumah
 * tangga/WO kecil). Sengaja dibuat *stateless*: tidak ada tabel session,
 * cookie-nya cukup dicocokkan ulang dari APP_PASSWORD setiap request.
 *
 * Properti yang didapat gratis dari desain ini:
 *  - Mengganti APP_PASSWORD di environment langsung membatalkan SEMUA
 *    cookie yang beredar (tidak perlu "logout semua orang" secara manual).
 *  - Tidak ada state yang perlu disimpan di database — cocok untuk
 *    middleware yang jalan di Edge runtime.
 *
 * File ini dipakai dari middleware (Edge runtime) maupun Server Action
 * (Node runtime), jadi hanya memakai Web Crypto (`crypto.subtle`) yang
 * tersedia di keduanya — bukan `node:crypto`.
 */

export const AUTH_COOKIE = "wfp_session";
/** 180 hari — ini aplikasi rumah tangga, bukan sesi kerja yang perlu sering login ulang. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180;

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Password yang dikonfigurasi admin lewat environment variable, atau null kalau belum diset. */
export function appPassword(): string | null {
  const v = process.env.APP_PASSWORD;
  return v && v.length > 0 ? v : null;
}

/** Nilai cookie yang sah untuk password saat ini. Berubah otomatis kalau APP_PASSWORD diganti. */
export async function expectedSessionValue(): Promise<string | null> {
  const password = appPassword();
  if (!password) return null;
  return sha256Hex(`wfp-session-v1:${password}`);
}

export async function isValidSession(
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await expectedSessionValue();
  if (!expected) return false;
  return cookieValue === expected;
}

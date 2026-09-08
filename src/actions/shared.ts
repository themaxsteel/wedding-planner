import "server-only";

import { ZodError, type ZodType } from "zod";
import { AppError } from "@/db/mutations";

export type ActionResult<T = void> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Membungkus setiap Server Action: menjalankan validasi Zod, lalu menerjemahkan
 * kegagalan menjadi pesan berbahasa Indonesia yang aman ditampilkan.
 * Error tak terduga tetap dicatat di server tapi tidak dibocorkan ke UI.
 */
export async function run<S extends ZodType, T>(
  schema: S,
  raw: unknown,
  fn: (input: S["_output"]) => T | Promise<T>,
  successMessage?: string,
): Promise<ActionResult<T>> {
  let input: S["_output"];
  try {
    input = schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return {
        ok: false,
        error: err.issues[0]?.message ?? "Data yang dikirim tidak valid.",
        fieldErrors,
      };
    }
    return { ok: false, error: "Data yang dikirim tidak valid." };
  }

  try {
    const data = await fn(input);
    return { ok: true, message: successMessage, data };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    console.error("[action]", err);
    return {
      ok: false,
      error:
        "Terjadi kesalahan saat menyimpan. Perubahan dibatalkan, data lama tetap aman.",
    };
  }
}

/** Menjalankan aksi tanpa skema (mis. hapus berdasarkan id). */
export async function guard<T>(
  fn: () => T | Promise<T>,
  successMessage?: string,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, message: successMessage, data };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    console.error("[action]", err);
    return { ok: false, error: "Terjadi kesalahan. Perubahan dibatalkan." };
  }
}

/** FormData -> objek biasa. Field bernama `a[]` dikumpulkan jadi array. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      (out[k] ??= [] as unknown[]);
      (out[k] as unknown[]).push(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Checkbox yang tidak dicentang tidak dikirim browser — normalkan jadi boolean. */
export function formBool(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

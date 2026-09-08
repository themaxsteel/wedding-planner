"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, SESSION_MAX_AGE, appPassword, expectedSessionValue } from "@/lib/auth";
import type { ActionResult } from "./shared";

export async function login(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  const configured = appPassword();
  if (!configured) {
    return {
      ok: false,
      error: "APP_PASSWORD belum diset di server. Hubungi pengelola aplikasi.",
    };
  }

  if (password !== configured) {
    // Jeda kecil supaya percobaan password berturut-turut tidak instan.
    // Bukan proteksi brute-force yang serius — cukup untuk ancaman rumah
    // tangga, bukan penyerang otomatis.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: false, error: "Password salah." };
  }

  const token = await expectedSessionValue();
  const store = await cookies();
  store.set(AUTH_COOKIE, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  redirect(next.startsWith("/") ? next : "/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/login");
}

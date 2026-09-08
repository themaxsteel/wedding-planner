import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, appPassword, isValidSession } from "@/lib/auth";

/**
 * Gerbang password untuk seluruh aplikasi. Jalan sebelum halaman maupun
 * route API mana pun dirender, termasuk /api/export dan /api/attachments —
 * keduanya membocorkan data keuangan kalau tidak ikut dijaga.
 */
export async function middleware(request: NextRequest) {
  // Gagal tertutup: kalau APP_PASSWORD belum diset di environment, seluruh
  // aplikasi diblokir dengan pesan jelas. Ini mencegah ke-deploy dalam
  // keadaan terbuka tanpa disadari karena env var lupa diisi.
  if (!appPassword()) {
    return new NextResponse(
      "Aplikasi belum dikunci: environment variable APP_PASSWORD belum diset. " +
        "Tambahkan APP_PASSWORD di pengaturan project Vercel (atau .env.local " +
        "untuk lokal), lalu deploy ulang.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (await isValidSession(cookie)) return NextResponse.next();

  // Request API (fetch/download) tidak punya tempat menampilkan halaman
  // login — balas 401 supaya pemanggilnya tahu harus login dulu.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") {
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Semua path KECUALI /login sendiri, file statis Next, dan ikon/gambar
    // di /public — supaya halaman login dan asetnya tidak ikut terkunci.
    "/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};

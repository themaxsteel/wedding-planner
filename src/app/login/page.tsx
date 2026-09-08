import { LockKeyIcon } from "@phosphor-icons/react/dist/ssr";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="animate-rise w-full max-w-[360px]">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-9 items-center justify-center rounded-full border border-line bg-surface">
            <LockKeyIcon size={16} weight="fill" className="text-muted" />
          </span>
          <h1 className="display text-[24px] text-ink">Wedding Finance Planner</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            Masukkan password untuk membuka data keuangan event.
          </p>
        </div>

        <div className="rounded-[10px] border border-line bg-surface p-5">
          <LoginForm next={next ?? "/"} />
        </div>
      </div>
    </div>
  );
}

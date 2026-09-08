"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartPieSliceIcon,
  ListIcon,
  XIcon,
  ReceiptIcon,
  ScalesIcon,
  StorefrontIcon,
  WalletIcon,
  FoldersIcon,
  FileTextIcon,
  GearSixIcon,
  SignOutIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { logout } from "@/actions/auth";
import { cn } from "@/lib/cn";
import { Badge } from "./ui/primitives";
import { ThemeToggle } from "./theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: Icon;
  /** angka kecil di kanan, mis. jumlah hutang yang belum lunas */
  count?: number;
};

type NavSection = { label: string; items: NavItem[] };

export function Sidebar({
  eventName,
  eventSubtitle,
  debtCount,
}: {
  eventName: string;
  eventSubtitle: string | null;
  debtCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Tutup drawer setiap kali pindah halaman di layar kecil.
  React.useEffect(() => setOpen(false), [pathname]);

  const sections: NavSection[] = [
    {
      label: "Keuangan",
      items: [
        { href: "/", label: "Ringkasan", icon: ChartPieSliceIcon },
        { href: "/transactions", label: "Transaksi", icon: ReceiptIcon },
        { href: "/budget", label: "Budget", icon: ScalesIcon },
        { href: "/debts", label: "Hutang", icon: WalletIcon, count: debtCount },
      ],
    },
    {
      label: "Data Master",
      items: [
        { href: "/accounts", label: "Akun", icon: WalletIcon },
        { href: "/categories", label: "Kategori", icon: FoldersIcon },
        { href: "/suppliers", label: "Supplier", icon: StorefrontIcon },
      ],
    },
    {
      label: "Lainnya",
      items: [
        { href: "/reports", label: "Laporan", icon: FileTextIcon },
        { href: "/settings", label: "Pengaturan", icon: GearSixIcon },
      ],
    },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const nav = (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.09em] text-faint">
            {section.label}
          </p>
          <ul className="space-y-px">
            {section.items.map((item) => {
              const active = isActive(item.href);
              const IconCmp = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2 rounded-[5px] px-2 py-1.5 text-[12.5px] transition-colors duration-150",
                      active
                        ? "bg-hover font-medium text-ink"
                        : "text-muted hover:bg-hover hover:text-ink",
                    )}
                  >
                    <IconCmp
                      size={15}
                      weight={active ? "fill" : "regular"}
                      className="shrink-0"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.count ? (
                      <Badge tone={active ? "red" : "neutral"}>{item.count}</Badge>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-3">
      <div className="min-w-0">
        <p className="display truncate text-[16px] text-ink">{eventName}</p>
        <p className="truncate text-[11px] text-faint">
          {eventSubtitle ?? "Belum ada tanggal"}
        </p>
      </div>
      <ThemeToggle />
    </div>
  );

  return (
    <>
      {/* Bar atas — hanya muncul di layar sempit */}
      <div className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          className="rounded-[5px] p-1 text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <ListIcon size={17} />
        </button>
        <p className="display truncate text-[15px] text-ink">{eventName}</p>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {/* Sidebar tetap — layar lebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[210px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        {brand}
        {nav}
        <FooterNote />
      </aside>

      {/* Drawer — layar sempit */}
      {open ? (
        <>
          <div
            className="animate-fade fixed inset-0 z-40 bg-[rgba(15,15,15,0.28)] lg:hidden dark:bg-[rgba(0,0,0,0.55)]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="animate-slide-over fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-line bg-surface lg:hidden">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
              <p className="display truncate text-[16px] text-ink">{eventName}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
                className="rounded-[5px] p-1 text-muted hover:bg-hover hover:text-ink"
              >
                <XIcon size={15} />
              </button>
            </div>
            {nav}
            <FooterNote />
          </aside>
        </>
      ) : null}
    </>
  );
}

function FooterNote() {
  return (
    <div className="border-t border-line px-3.5 py-2.5">
      <form action={logout}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-[5px] px-1.5 py-1 text-[11.5px] text-faint transition-colors hover:bg-hover hover:text-ink"
        >
          <SignOutIcon size={13} />
          Keluar
        </button>
      </form>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getEvent, getOutstandingDebts } from "@/db/queries";
import { Sidebar } from "@/components/sidebar";
import { formatDate } from "@/lib/dates";

/**
 * Gerbang aplikasi. Selama wizard belum tuntas, tidak ada satu pun halaman
 * yang boleh dibuka — angka budget dan saldo tidak ada artinya tanpa
 * akun & kategori.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = await getDb();
  const event = await getEvent(db);
  if (!event.setupCompletedAt) redirect("/setup");

  const debts = await getOutstandingDebts(db);
  const subtitle = event.eventDate ? formatDate(event.eventDate) : null;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        eventName={event.name}
        eventSubtitle={subtitle}
        debtCount={debts.length}
      />
      <main className="print-full min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}

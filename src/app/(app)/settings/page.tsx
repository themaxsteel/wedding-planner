import fs from "node:fs";
import { getDb, DB_PATH, ATTACHMENT_DIR, usingTurso } from "@/db";
import { getEvent, getDashboard } from "@/db/queries";
import { attachmentStorageMode } from "@/lib/storage";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { EventForm } from "@/components/settings/event-form";
import { BackupRestore } from "@/components/settings/backup-restore";
import { DangerZone } from "@/components/settings/danger-zone";
import { formatIDR } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = await getDb();
  const [event, dashboard] = await Promise.all([getEvent(db), getDashboard(db)]);

  const dbSize = usingTurso ? null : safeSize(DB_PATH);
  const attachmentCount =
    attachmentStorageMode === "local" ? safeCount(ATTACHMENT_DIR) : null;

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Detail event, lokasi penyimpanan data, backup, dan tindakan yang tidak bisa dibatalkan."
      />

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title="Detail event"
            description="Target total budget hanya dipakai sebagai pembanding alokasi; ia tidak membatasi pencatatan."
          />
          <div className="px-4 py-3.5">
            <EventForm event={event} />
          </div>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Penyimpanan data" />
            <dl className="divide-y divide-[var(--c-border)] text-[12.5px]">
              <Row label="Database">
                {usingTurso ? "Turso (cloud)" : "File lokal"}
              </Row>
              {dbSize !== null ? <Row label="Ukuran database">{dbSize}</Row> : null}
              <Row label="Lampiran">
                {attachmentStorageMode === "blob"
                  ? "Vercel Blob (cloud)"
                  : `${attachmentCount} file di data/attachments`}
              </Row>
            </dl>
            <p className="border-t border-line px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
              {usingTurso
                ? "Database ini tersimpan di Turso (cloud), bukan di komputer ini. Pakai Backup di bawah untuk menyimpan salinan data secara berkala — terutama sebelum orang lain diberi akses ke aplikasi."
                : "Seluruh data tinggal di folder project ini — tidak ada yang dikirim ke mana pun. Untuk backup cepat, salin folder data/ ke tempat lain, atau pakai tombol Backup di bawah."}
            </p>
          </Card>

          <Card>
            <CardHeader title="Isi saat ini" />
            <dl className="divide-y divide-[var(--c-border)] text-[12.5px]">
              <Row label="Kategori pengeluaran">
                {dashboard.expenseTree.length} induk
              </Row>
              <Row label="Sub account">
                {dashboard.accountTree.reduce(
                  (n, g) => n + g.accounts.length,
                  0,
                )}{" "}
                akun
              </Row>
              <Row label="Total saldo">
                {formatIDR(dashboard.totalBalance)}
              </Row>
              <Row label="Hutang belum lunas">
                {dashboard.debtCount} tagihan ·{" "}
                {formatIDR(dashboard.totalDebt)}
              </Row>
            </dl>
          </Card>
        </div>
      </div>

      <div className="mt-3">
        <BackupRestore />
      </div>

      <div className="mt-3">
        <DangerZone usingTurso={usingTurso} />
      </div>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <dt className="w-[150px] shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  );
}

/**
 * Mode WAL menyimpan tulisan terbaru di file -wal sampai di-checkpoint,
 * jadi ukuran wedding.db saja bisa terlihat jauh lebih kecil dari isinya.
 * Ketiganya dijumlahkan agar angkanya jujur. Hanya relevan mode file lokal.
 */
function safeSize(path: string) {
  let bytes = 0;
  let found = false;
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      bytes += fs.statSync(`${path}${suffix}`).size;
      found = true;
    } catch {
      // File -wal/-shm hanya ada saat database sedang dipakai.
    }
  }
  if (!found) return "belum dibuat";
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeCount(dir: string) {
  try {
    return fs.readdirSync(dir).filter((f) => !f.startsWith(".")).length;
  } catch {
    return 0;
  }
}

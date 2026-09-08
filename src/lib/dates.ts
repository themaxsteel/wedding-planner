import { differenceInCalendarDays, format, parseISO, isValid } from "date-fns";
import { id } from "date-fns/locale";

/** Semua tanggal bisnis disimpan sebagai "YYYY-MM-DD" (waktu lokal, bukan UTC). */
export type ISODate = string;

export function todayISO(): ISODate {
  return format(new Date(), "yyyy-MM-dd");
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  return isValid(parseISO(value));
}

/** "2026-11-14" -> "14 Nov 2026" */
export function formatDate(value: ISODate | null | undefined): string {
  if (!value || !isISODate(value)) return "—";
  return format(parseISO(value), "d MMM yyyy", { locale: id });
}

/** "2026-11-14" -> "Sabtu, 14 November 2026" */
export function formatDateLong(value: ISODate | null | undefined): string {
  if (!value || !isISODate(value)) return "—";
  return format(parseISO(value), "EEEE, d MMMM yyyy", { locale: id });
}

/** Sisa hari menuju tanggal. Negatif = sudah lewat. */
export function daysUntil(value: ISODate | null | undefined): number | null {
  if (!value || !isISODate(value)) return null;
  return differenceInCalendarDays(parseISO(value), new Date());
}

export type DueStatus = "none" | "upcoming" | "soon" | "overdue";

/** Klasifikasi jatuh tempo: <0 lewat, <=7 hari mendesak, sisanya akan datang. */
export function dueStatus(value: ISODate | null | undefined): DueStatus {
  const d = daysUntil(value);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d <= 7) return "soon";
  return "upcoming";
}

export function dueLabel(value: ISODate | null | undefined): string {
  const d = daysUntil(value);
  if (d === null) return "Tanpa jatuh tempo";
  if (d < 0) return `Lewat ${Math.abs(d)} hari`;
  if (d === 0) return "Jatuh tempo hari ini";
  if (d === 1) return "Besok";
  return `${d} hari lagi`;
}

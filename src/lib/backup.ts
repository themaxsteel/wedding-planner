import "server-only";

import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import {
  account,
  accountGroup,
  attachment,
  category,
  event,
  payment,
  supplier,
  transaction,
} from "@/db/schema";
import { AppError } from "@/db/mutations";

/**
 * Backup/restore seluruh isi database sebagai satu file JSON — jalur
 * pemulihan kalau ada yang iseng mengubah atau menghapus data (baik lewat
 * aplikasi maupun langsung ke database). Beda dari ekspor Excel/PDF di
 * Laporan: file ini menyertakan ID asli dan seluruh kolom mentah, cukup
 * untuk mengembalikan aplikasi persis seperti semula — bukan sekadar
 * ringkasan untuk dibaca manusia.
 *
 * Lampiran (foto struk) TIDAK ikut ke dalam file ini — hanya metadatanya.
 * File fisiknya hidup di Vercel Blob atau data/attachments, yang punya
 * mekanisme penyimpanannya sendiri.
 */

export const BACKUP_VERSION = 1;

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();

const eventSchema = z.object({
  id: z.number(),
  name: z.string(),
  brideName: nullableString,
  groomName: nullableString,
  eventDate: nullableString,
  currency: z.string(),
  totalBudgetTarget: z.number(),
  setupCompletedAt: nullableNumber,
  setupStep: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const accountGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  sortOrder: z.number(),
  archived: z.boolean(),
  createdAt: z.number(),
});

const accountSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  name: z.string(),
  bankName: nullableString,
  accountNumber: nullableString,
  holderName: nullableString,
  openingBalance: z.number(),
  note: nullableString,
  sortOrder: z.number(),
  archived: z.boolean(),
  createdAt: z.number(),
});

const categorySchema = z.object({
  id: z.number(),
  kind: z.enum(["expense", "income"]),
  parentId: nullableNumber,
  name: z.string(),
  budgetAmount: z.number(),
  color: z.string(),
  sortOrder: z.number(),
  archived: z.boolean(),
  createdAt: z.number(),
});

const supplierSchema = z.object({
  id: z.number(),
  name: z.string(),
  categoryId: nullableNumber,
  contactPerson: nullableString,
  phone: nullableString,
  email: nullableString,
  bankName: nullableString,
  bankAccount: nullableString,
  note: nullableString,
  archived: z.boolean(),
  createdAt: z.number(),
});

const transactionSchema = z.object({
  id: z.number(),
  type: z.enum(["expense", "income", "transfer"]),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  accountId: z.number(),
  toAccountId: nullableNumber,
  categoryId: nullableNumber,
  supplierId: nullableNumber,
  paymentStatus: z.enum(["paid", "partial", "unpaid"]),
  dueDate: nullableString,
  note: nullableString,
  createdAt: z.number(),
  updatedAt: z.number(),
});

const paymentSchema = z.object({
  id: z.number(),
  transactionId: z.number(),
  date: z.string(),
  amount: z.number(),
  accountId: z.number(),
  method: z.string(),
  note: nullableString,
  createdAt: z.number(),
});

const attachmentSchema = z.object({
  id: z.number(),
  transactionId: nullableNumber,
  paymentId: nullableNumber,
  fileName: z.string(),
  originalName: z.string(),
  mime: z.string(),
  size: z.number(),
  createdAt: z.number(),
});

export const backupPayloadSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  event: eventSchema,
  accountGroups: z.array(accountGroupSchema),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  suppliers: z.array(supplierSchema),
  transactions: z.array(transactionSchema),
  payments: z.array(paymentSchema),
  attachments: z.array(attachmentSchema),
});

export type BackupPayload = z.infer<typeof backupPayloadSchema>;

export async function exportBackup(db: DB): Promise<BackupPayload> {
  const [
    eventRow,
    accountGroups,
    accounts,
    categories,
    suppliers,
    transactions,
    payments,
    attachments,
  ] = await Promise.all([
    db.select().from(event).get(),
    db.select().from(accountGroup).all(),
    db.select().from(account).all(),
    db.select().from(category).all(),
    db.select().from(supplier).all(),
    db.select().from(transaction).all(),
    db.select().from(payment).all(),
    db.select().from(attachment).all(),
  ]);

  if (!eventRow) throw new AppError("Baris event tidak ditemukan.");

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    event: eventRow,
    accountGroups,
    accounts,
    // Drizzle mengetik kolom `kind`/`type` sebagai `string` polos (kolom
    // TEXT biasa) — nilainya sudah dijamin sesuai enum lewat CHECK
    // constraint di schema, jadi cast ini hanya menyelaraskan TypeScript
    // dengan invarian yang memang berlaku di database.
    categories: categories as BackupPayload["categories"],
    suppliers,
    transactions: transactions as BackupPayload["transactions"],
    payments,
    attachments,
  };
}

/** Nama file unduhan: "Backup Wedding Finance Planner - Nama Event - 2026-09-08.json" */
export function backupFileName(payload: BackupPayload): string {
  const safe = payload.event.name.replace(/[^\p{L}\p{N} _-]/gu, "").trim();
  const date = payload.exportedAt.slice(0, 10);
  return `Backup Wedding Finance Planner - ${safe || "Wedding"} - ${date}.json`;
}

/**
 * Memulihkan seluruh database dari backup: menghapus semua baris lalu
 * menulis ulang dari file, TERMASUK id aslinya (supaya relasi antar baris
 * tetap utuh). Satu transaksi atomik — kalau ada baris yang gagal ditulis,
 * seluruh proses dibatalkan dan data lama tetap seperti semula.
 */
export async function importBackup(db: DB, payload: BackupPayload): Promise<void> {
  const categoryIds = new Set(payload.categories.map((c) => c.id));
  for (const c of payload.categories) {
    if (c.parentId !== null && !categoryIds.has(c.parentId)) {
      throw new AppError(
        `Kategori "${c.name}" merujuk induk yang tidak ada di file backup ini. File kemungkinan rusak atau tidak lengkap.`,
      );
    }
  }

  await db.transaction(async (tx) => {
    // Hapus dalam urutan anak -> induk supaya tidak menabrak foreign key.
    await tx.delete(attachment).run();
    await tx.delete(payment).run();
    await tx.delete(transaction).run();
    await tx.delete(supplier).run();
    await tx.run(sql`DELETE FROM category WHERE parent_id IS NOT NULL`);
    await tx.delete(category).run();
    await tx.delete(account).run();
    await tx.delete(accountGroup).run();

    // Tulis ulang dalam urutan induk -> anak, ID aslinya dipertahankan.
    for (const g of payload.accountGroups) await tx.insert(accountGroup).values(g).run();
    for (const a of payload.accounts) await tx.insert(account).values(a).run();
    for (const c of payload.categories.filter((c) => c.parentId === null)) {
      await tx.insert(category).values(c).run();
    }
    for (const c of payload.categories.filter((c) => c.parentId !== null)) {
      await tx.insert(category).values(c).run();
    }
    for (const s of payload.suppliers) await tx.insert(supplier).values(s).run();
    for (const t of payload.transactions) await tx.insert(transaction).values(t).run();
    for (const p of payload.payments) await tx.insert(payment).values(p).run();
    for (const at of payload.attachments) await tx.insert(attachment).values(at).run();

    await tx
      .update(event)
      .set({
        name: payload.event.name,
        brideName: payload.event.brideName,
        groomName: payload.event.groomName,
        eventDate: payload.event.eventDate,
        currency: payload.event.currency,
        totalBudgetTarget: payload.event.totalBudgetTarget,
        setupCompletedAt: payload.event.setupCompletedAt,
        setupStep: payload.event.setupStep,
        updatedAt: Date.now(),
      })
      .where(eq(event.id, 1))
      .run();
  });
}

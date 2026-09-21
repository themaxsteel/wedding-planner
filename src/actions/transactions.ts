"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  addPayment,
  createExpense,
  createIncome,
  createTransfer,
  removePayment,
  removeTransaction,
  updateExpense,
  updateIncome,
  updateTransfer,
} from "@/db/mutations";
import {
  getAttachmentFileKeysForPayment,
  getAttachmentFileKeysForTransaction,
} from "@/db/queries";
import {
  expenseSchema,
  incomeSchema,
  paymentSchema,
  transferSchema,
} from "@/lib/validation";
import { deleteAttachmentFiles, saveUploadsSafely } from "./attachments";
import { formToObject, guard, run, type ActionResult } from "./shared";

/** Angka di seluruh app berubah setiap ada transaksi, jadi segarkan semuanya. */
function revalidateAll() {
  revalidatePath("/", "layout");
}

/**
 * Menempelkan peringatan lampiran (kalau ada) sebagai field `warning`
 * terpisah, tanpa pernah mengubah `ok` — transaksinya sendiri sudah
 * tersimpan dan itu yang paling penting. `warning` (beda dari `message`)
 * dipakai UI untuk menahan panel tetap terbuka supaya pesannya sempat
 * terbaca, alih-alih ikut auto-close seperti biasa saat sukses polos.
 */
function withUploadWarning<T>(
  result: ActionResult<T>,
  warning: string | null,
): ActionResult<T> {
  if (!warning || !result.ok) return result;
  return { ...result, warning };
}

export async function saveExpense(
  _prev: ActionResult<number> | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  const db = await getDb();
  const raw = formToObject(formData);
  const editId = Number(raw.id) || 0;

  const result = await run(
    expenseSchema,
    raw,
    async (input) => {
      if (editId) {
        await updateExpense(db, editId, input);
        return editId;
      }
      return createExpense(db, input);
    },
    editId ? "Pengeluaran diperbarui." : "Pengeluaran dicatat.",
  );

  if (result.ok && result.data) {
    const warning = await saveUploadsSafely(formData, { transactionId: result.data });
    revalidateAll();
    return withUploadWarning(result, warning);
  }
  return result;
}

export async function saveIncome(
  _prev: ActionResult<number> | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  const db = await getDb();
  const raw = formToObject(formData);
  const editId = Number(raw.id) || 0;

  const result = await run(
    incomeSchema,
    raw,
    async (input) => {
      if (editId) {
        await updateIncome(db, editId, input);
        return editId;
      }
      return createIncome(db, input);
    },
    editId ? "Pemasukan diperbarui." : "Pemasukan dicatat.",
  );

  if (result.ok && result.data) {
    const warning = await saveUploadsSafely(formData, { transactionId: result.data });
    revalidateAll();
    return withUploadWarning(result, warning);
  }
  return result;
}

export async function saveTransfer(
  _prev: ActionResult<number> | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  const db = await getDb();
  const raw = formToObject(formData);
  const editId = Number(raw.id) || 0;

  const result = await run(
    transferSchema,
    raw,
    async (input) => {
      if (editId) {
        await updateTransfer(db, editId, input);
        return editId;
      }
      return createTransfer(db, input);
    },
    editId ? "Transfer diperbarui." : "Transfer dicatat.",
  );

  if (result.ok && result.data) {
    const warning = await saveUploadsSafely(formData, { transactionId: result.data });
    revalidateAll();
    return withUploadWarning(result, warning);
  }
  return result;
}

export async function deleteTransaction(
  id: number,
): Promise<ActionResult> {
  const db = await getDb();
  // Diambil SEBELUM baris dihapus - ON DELETE CASCADE membersihkan baris
  // attachment di database, tapi tidak tahu apa-apa soal file fisiknya di
  // storage (lokal/Blob). Itu tanggung jawab kita bersihkan sendiri.
  const fileKeys = await getAttachmentFileKeysForTransaction(db, id);

  const result = await guard(
    () => removeTransaction(db, id),
    "Transaksi dihapus beserta seluruh pembayarannya.",
  );
  if (result.ok) {
    await deleteAttachmentFiles(fileKeys);
    revalidateAll();
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* PEMBAYARAN / CICILAN                                                       */
/* -------------------------------------------------------------------------- */

export async function savePayment(
  _prev: ActionResult<number> | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  const db = await getDb();
  const result = await run(
    paymentSchema,
    formToObject(formData),
    (input) => addPayment(db, input),
    "Pembayaran dicatat.",
  );

  if (result.ok && result.data) {
    const warning = await saveUploadsSafely(formData, { paymentId: result.data });
    revalidateAll();
    return withUploadWarning(result, warning);
  }
  return result;
}

export async function deletePayment(id: number): Promise<ActionResult> {
  const db = await getDb();
  const fileKeys = await getAttachmentFileKeysForPayment(db, id);

  const result = await guard(
    () => removePayment(db, id),
    "Pembayaran dihapus, sisa hutang dihitung ulang.",
  );
  if (result.ok) {
    await deleteAttachmentFiles(fileKeys);
    revalidateAll();
  }
  return result;
}

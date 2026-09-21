"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  removeAccount,
  removeAccountGroup,
  removeCategory,
  removeSupplier,
  resetAll,
  saveAccount,
  saveAccountGroup,
  saveCategory,
  saveSupplier,
  setAccountArchived,
  setCategoryArchived,
  setCategoryBudget,
  setSupplierArchived,
  updateEvent,
} from "@/db/mutations";
import { getAllAttachmentFileKeys } from "@/db/queries";
import {
  accountGroupSchema,
  accountSchema,
  budgetUpdateSchema,
  categorySchema,
  eventSchema,
  supplierSchema,
} from "@/lib/validation";
import { deleteAttachmentFiles } from "./attachments";
import { formToObject, guard, run, type ActionResult } from "./shared";

function refresh() {
  revalidatePath("/", "layout");
}

/* -------------------------------------------------------------------------- */
/* AKUN                                                                       */
/* -------------------------------------------------------------------------- */

export async function submitAccountGroup(
  _prev: ActionResult<number> | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  const db = await getDb();
  const result = await run(
    accountGroupSchema,
    formToObject(formData),
    (input) => saveAccountGroup(db, input),
    "Main account disimpan.",
  );
  if (result.ok) refresh();
  return result;
}

export async function submitAccount(
  _prev: ActionResult<number> | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  const db = await getDb();
  const result = await run(
    accountSchema,
    formToObject(formData),
    (input) => saveAccount(db, input),
    "Sub account disimpan.",
  );
  if (result.ok) refresh();
  return result;
}

export async function deleteAccount(id: number): Promise<ActionResult> {
  const db = await getDb();
  const result = await guard(() => removeAccount(db, id), "Sub account dihapus.");
  if (result.ok) refresh();
  return result;
}

export async function archiveAccount(
  id: number,
  archived: boolean,
): Promise<ActionResult> {
  const db = await getDb();
  const result = await guard(
    () => setAccountArchived(db, id, archived),
    archived ? "Sub account diarsipkan." : "Sub account diaktifkan kembali.",
  );
  if (result.ok) refresh();
  return result;
}

export async function deleteAccountGroup(id: number): Promise<ActionResult> {
  const db = await getDb();
  const result = await guard(
    () => removeAccountGroup(db, id),
    "Main account dihapus.",
  );
  if (result.ok) refresh();
  return result;
}

/* -------------------------------------------------------------------------- */
/* KATEGORI                                                                   */
/* -------------------------------------------------------------------------- */

export async function submitCategory(
  _prev: ActionResult<number> | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  const db = await getDb();
  const result = await run(
    categorySchema,
    formToObject(formData),
    (input) => saveCategory(db, input),
    "Kategori disimpan.",
  );
  if (result.ok) refresh();
  return result;
}

export async function submitBudget(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const db = await getDb();
  const result = await run(
    budgetUpdateSchema,
    formToObject(formData),
    (input) => setCategoryBudget(db, input.categoryId, input.budgetAmount),
    "Budget diperbarui.",
  );
  if (result.ok) refresh();
  return result;
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  const db = await getDb();
  const result = await guard(() => removeCategory(db, id), "Kategori dihapus.");
  if (result.ok) refresh();
  return result;
}

export async function archiveCategory(
  id: number,
  archived: boolean,
): Promise<ActionResult> {
  const db = await getDb();
  const result = await guard(
    () => setCategoryArchived(db, id, archived),
    archived ? "Kategori diarsipkan." : "Kategori diaktifkan kembali.",
  );
  if (result.ok) refresh();
  return result;
}

/* -------------------------------------------------------------------------- */
/* SUPPLIER                                                                   */
/* -------------------------------------------------------------------------- */

export async function submitSupplier(
  _prev: ActionResult<number> | null,
  formData: FormData,
): Promise<ActionResult<number>> {
  const db = await getDb();
  const result = await run(
    supplierSchema,
    formToObject(formData),
    (input) => saveSupplier(db, input),
    "Supplier disimpan.",
  );
  if (result.ok) refresh();
  return result;
}

export async function deleteSupplier(id: number): Promise<ActionResult> {
  const db = await getDb();
  const result = await guard(() => removeSupplier(db, id), "Supplier dihapus.");
  if (result.ok) refresh();
  return result;
}

export async function archiveSupplier(
  id: number,
  archived: boolean,
): Promise<ActionResult> {
  const db = await getDb();
  const result = await guard(
    () => setSupplierArchived(db, id, archived),
    archived ? "Supplier diarsipkan." : "Supplier diaktifkan kembali.",
  );
  if (result.ok) refresh();
  return result;
}

/* -------------------------------------------------------------------------- */
/* PENGATURAN EVENT                                                           */
/* -------------------------------------------------------------------------- */

export async function submitEvent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const db = await getDb();
  const result = await run(
    eventSchema,
    formToObject(formData),
    (input) => updateEvent(db, input),
    "Detail event disimpan.",
  );
  if (result.ok) refresh();
  return result;
}

/** Menghapus seluruh data dan mengembalikan aplikasi ke wizard awal. */
export async function resetEverything(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (formData.get("confirm") !== "HAPUS SEMUA") {
    return {
      ok: false,
      error: 'Ketik persis "HAPUS SEMUA" untuk mengonfirmasi.',
    };
  }
  const db = await getDb();
  // Diambil sebelum reset - resetAll menghapus seluruh baris attachment
  // tapi tidak tahu apa-apa soal file fisiknya di storage.
  const fileKeys = await getAllAttachmentFileKeys(db);

  const result = await guard(() => resetAll(db), "Seluruh data dihapus.");
  if (result.ok) {
    await deleteAttachmentFiles(fileKeys);
    refresh();
  }
  return result;
}

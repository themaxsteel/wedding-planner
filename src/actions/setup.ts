"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  completeSetup,
  setSetupStep,
  setupAccounts,
  setupBudgets,
  setupCategories,
  updateEvent,
} from "@/db/mutations";
import {
  eventSchema,
  setupAccountsSchema,
  setupBudgetSchema,
  setupCategoriesSchema,
} from "@/lib/validation";
import { formToObject, run, type ActionResult } from "./shared";

/**
 * Wizard menyimpan per langkah, bukan sekaligus di akhir, supaya user boleh
 * menutup browser di tengah jalan dan melanjutkan nanti (event.setupStep).
 */

export async function saveEventStep(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const db = await getDb();
  const result = await run(eventSchema, formToObject(formData), async (input) => {
    await updateEvent(db, input);
    await setSetupStep(db, 2);
  });
  if (result.ok) revalidatePath("/setup");
  return result;
}

export async function saveAccountsStep(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const db = await getDb();
  const payload = formData.get("payload");
  const parsed = safeJson(payload);

  const result = await run(setupAccountsSchema, parsed, async (input) => {
    await setupAccounts(db, input);
    await setSetupStep(db, 3);
  });
  if (result.ok) revalidatePath("/setup");
  return result;
}

export async function saveCategoriesStep(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const db = await getDb();
  const parsed = safeJson(formData.get("payload"));

  const result = await run(setupCategoriesSchema, parsed, async (input) => {
    await setupCategories(db, input);
    await setSetupStep(db, 4);
  });
  if (result.ok) revalidatePath("/setup");
  return result;
}

export async function saveBudgetStep(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const db = await getDb();
  const parsed = safeJson(formData.get("payload"));

  const result = await run(setupBudgetSchema, parsed, async (input) => {
    await setupBudgets(db, input);
    await setSetupStep(db, 5);
  });
  if (result.ok) revalidatePath("/setup");
  return result;
}

export async function finishSetup(): Promise<void> {
  const db = await getDb();
  await completeSetup(db);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function goToStep(step: number): Promise<void> {
  const db = await getDb();
  await setSetupStep(db, Math.max(1, Math.min(5, step)));
  revalidatePath("/setup");
}

function safeJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

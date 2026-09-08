import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getDb, category as categoryTable, type DB } from "@/db";
import {
  getAccountTree,
  getBudgetTree,
  getEvent,
  listSuppliers,
} from "@/db/queries";
import { SETUP_STEPS, Stepper } from "@/components/setup/stepper";
import { StepEvent } from "@/components/setup/step-event";
import { StepAccounts } from "@/components/setup/step-accounts";
import { StepCategories } from "@/components/setup/step-categories";
import { StepBudget } from "@/components/setup/step-budget";
import { StepSuppliers } from "@/components/setup/step-suppliers";
import { ThemeToggle } from "@/components/theme-toggle";
import type { CategoryKind } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Wizard wajib. Urutannya mengikuti ketergantungan data: tanpa sub account
 * transaksi tidak punya tempat, dan tanpa kategori budget tidak punya pos.
 * Setiap langkah disimpan sendiri-sendiri sehingga aman ditinggal di tengah.
 *
 * Hanya satu langkah yang tampil sekaligus, jadi datanya diambil sesuai
 * langkah aktif saja (bukan sekaligus) — tidak ada gunanya menunggu query
 * kategori kalau yang sedang dibuka adalah langkah akun.
 */
export default async function SetupPage() {
  const db = await getDb();
  const event = await getEvent(db);
  if (event.setupCompletedAt) redirect("/");

  const step = Math.min(5, Math.max(1, event.setupStep));
  const meta = SETUP_STEPS[step - 1];

  const stepAccounts = step === 2 ? await existingAccounts(db) : null;
  const stepCategories = step === 3 ? await existingCategories(db) : null;
  const stepBudget = step === 4 ? await budgetTargets(db) : null;
  const stepSuppliers = step === 5 ? await supplierStepData(db) : null;

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.09em] text-faint">
                Penyiapan awal
              </p>
              <h1 className="display text-[30px] text-ink">
                Wedding Finance Planner
              </h1>
              <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-muted">
                Lima langkah menyiapkan kerangka keuangan event. Setelah ini
                Anda tinggal mencatat transaksi — budget, saldo, dan hutang
                terhitung sendiri.
              </p>
            </div>
            <ThemeToggle />
          </div>
          <Stepper current={step} />
        </header>

        <section className="animate-rise rounded-[10px] border border-line bg-surface p-5">
          <div className="mb-4 border-b border-line pb-3">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-faint">
              Langkah {step} dari 5
            </p>
            <h2 className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-ink">
              {meta.label}
            </h2>
          </div>

          {step === 1 ? <StepEvent event={event} /> : null}
          {step === 2 && stepAccounts ? (
            <StepAccounts existing={stepAccounts} />
          ) : null}
          {step === 3 && stepCategories ? (
            <StepCategories existing={stepCategories} />
          ) : null}
          {step === 4 && stepBudget ? (
            <StepBudget
              categories={stepBudget}
              targetTotal={event.totalBudgetTarget}
            />
          ) : null}
          {step === 5 && stepSuppliers ? (
            <StepSuppliers
              suppliers={stepSuppliers.suppliers}
              categories={stepSuppliers.categories}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

async function existingAccounts(db: DB) {
  const tree = await getAccountTree(db, { includeArchived: true });
  return tree.map((g) => ({
    name: g.name,
    type: g.type,
    accounts: g.accounts.map((a) => ({
      name: a.name,
      accountNumber: a.accountNumber,
      openingBalance: a.openingBalance,
    })),
  }));
}

async function existingCategories(db: DB) {
  const rows = await db
    .select()
    .from(categoryTable)
    .orderBy(asc(categoryTable.sortOrder), asc(categoryTable.id))
    .all();

  return rows
    .filter((r) => r.parentId === null)
    .map((parent) => ({
      kind: parent.kind as CategoryKind,
      name: parent.name,
      color: parent.color,
      children: rows
        .filter((c) => c.parentId === parent.id)
        .map((c) => c.name),
    }));
}

async function budgetTargets(db: DB) {
  const tree = await getBudgetTree(db, "expense");
  return tree.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    childNames: c.children.map((ch) => ch.name),
    budgetAmount: c.budget,
  }));
}

async function supplierStepData(db: DB) {
  const [suppliers, expenseTree] = await Promise.all([
    listSuppliers(db),
    getBudgetTree(db, "expense"),
  ]);
  return {
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      categoryName: s.categoryName,
      phone: s.phone,
    })),
    categories: expenseTree.map((c) => ({ id: c.id, name: c.name })),
  };
}

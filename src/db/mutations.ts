import { sql, eq, and, isNull, asc } from "drizzle-orm";
import type { DB, DBOrTx } from "./client";
import {
  account,
  accountGroup,
  attachment,
  category,
  event,
  payment,
  supplier,
  transaction,
  type CategoryKind,
} from "./schema";
import {
  accountGroupUsageCount,
  accountUsageCount,
  categoryUsageCount,
  supplierUsageCount,
} from "./queries";
import type {
  AccountGroupInput,
  AccountInput,
  CategoryInput,
  EventInput,
  ExpenseInput,
  IncomeInput,
  PaymentInput,
  SetupAccountsInput,
  SetupBudgetInput,
  SetupCategoriesInput,
  SupplierInput,
  TransferInput,
} from "@/lib/validation";

/**
 * Lapisan penulisan. Seluruh aturan akuntansi hidup di sini:
 *
 *  - Baris `payment` adalah SATU-SATUNYA hal yang menggerakkan saldo akun.
 *  - Expense lunas  = transaction + 1 payment penuh (satu transaksi DB).
 *  - Expense DP     = transaction + 1 payment sebesar DP.
 *  - Expense hutang = transaction saja, tanpa payment.
 *  - paymentStatus selalu diturunkan ulang dari SUM(payment), tidak pernah
 *    ditulis manual dari form.
 *
 * Seluruh fungsi ASYNC (driver libSQL, lihat catatan di queries.ts).
 * `db.transaction(async (tx) => {...})` dipakai di setiap penulisan yang
 * menyentuh lebih dari satu tabel — tx dipakai sama seperti db, hanya
 * seluruh operasinya dijamin atomik bersama.
 */

/** Error yang pesannya aman & berguna untuk ditampilkan ke user. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

const nowMs = () => Date.now();

/* ========================================================================== */
/* STATUS PEMBAYARAN                                                          */
/* ========================================================================== */

export async function paidTotalFor(
  db: DBOrTx,
  transactionId: number,
): Promise<number> {
  const row = await db.get<{ total: number }>(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payment WHERE transaction_id = ${transactionId}
  `);
  return row?.total ?? 0;
}

/**
 * Menulis ulang paymentStatus dari kenyataan di tabel payment.
 * Dipanggil setelah SETIAP perubahan transaksi atau pembayaran.
 */
export async function recalcPaymentStatus(db: DBOrTx, transactionId: number) {
  const tx = await db
    .select()
    .from(transaction)
    .where(eq(transaction.id, transactionId))
    .get();
  if (!tx) return;

  let status: "paid" | "partial" | "unpaid";
  if (tx.type === "transfer") {
    status = "paid";
  } else {
    const paid = await paidTotalFor(db, transactionId);
    status = paid <= 0 ? "unpaid" : paid >= tx.amount ? "paid" : "partial";
  }

  await db
    .update(transaction)
    .set({ paymentStatus: status, updatedAt: nowMs() })
    .where(eq(transaction.id, transactionId))
    .run();
}

/* ========================================================================== */
/* EVENT & SETUP                                                              */
/* ========================================================================== */

export async function updateEvent(db: DB, input: EventInput) {
  await db
    .update(event)
    .set({
      name: input.name,
      brideName: input.brideName,
      groomName: input.groomName,
      eventDate: input.eventDate,
      totalBudgetTarget: input.totalBudgetTarget,
      updatedAt: nowMs(),
    })
    .where(eq(event.id, 1))
    .run();
}

export async function setSetupStep(db: DB, step: number) {
  await db
    .update(event)
    .set({ setupStep: step, updatedAt: nowMs() })
    .where(eq(event.id, 1))
    .run();
}

export async function completeSetup(db: DB) {
  await db
    .update(event)
    .set({ setupCompletedAt: nowMs(), setupStep: 5, updatedAt: nowMs() })
    .where(eq(event.id, 1))
    .run();
}

/** Langkah 2 wizard. Idempoten: menimpa struktur akun selama belum ada transaksi. */
export async function setupAccounts(db: DB, input: SetupAccountsInput) {
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(account).all();
    for (const acc of existing) {
      const used = await accountUsageCount(tx, acc.id);
      if (used > 0) {
        throw new AppError(
          `Sub account "${acc.name}" sudah punya transaksi, struktur akun tidak bisa disusun ulang dari wizard. Ubah lewat halaman Akun.`,
        );
      }
    }
    await tx.delete(account).run();
    await tx.delete(accountGroup).run();

    for (const [gi, g] of input.groups.entries()) {
      const group = await tx
        .insert(accountGroup)
        .values({ name: g.name, type: g.type, sortOrder: gi })
        .returning({ id: accountGroup.id })
        .get();

      for (const [ai, a] of g.accounts.entries()) {
        await tx
          .insert(account)
          .values({
            groupId: group.id,
            name: a.name,
            accountNumber: a.accountNumber,
            openingBalance: a.openingBalance,
            sortOrder: ai,
          })
          .run();
      }
    }
  });
}

/**
 * Langkah 3 wizard: menulis ulang seluruh pohon kategori (pengeluaran dan
 * pemasukan sekaligus). Hanya boleh dijalankan selama belum ada transaksi
 * yang menempel di kategori mana pun.
 */
export async function setupCategories(db: DB, input: SetupCategoriesInput) {
  await db.transaction(async (tx) => {
    const used = await tx.get<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM "transaction" WHERE category_id IS NOT NULL
    `);
    if ((used?.n ?? 0) > 0) {
      throw new AppError(
        "Sudah ada transaksi yang memakai kategori, jadi struktur kategori tidak bisa disusun ulang dari wizard. Ubah lewat halaman Kategori.",
      );
    }

    // Hapus anak lebih dulu supaya FK parent_id tidak menghalangi.
    await tx.run(sql`DELETE FROM category WHERE parent_id IS NOT NULL`);
    await tx.delete(category).run();

    const write = async (kind: CategoryKind, groups: typeof input.expense) => {
      for (const [ci, c] of groups.entries()) {
        const parent = await tx
          .insert(category)
          .values({
            kind,
            parentId: null,
            name: c.name,
            color: c.color,
            sortOrder: ci,
          })
          .returning({ id: category.id })
          .get();

        for (const [si, childName] of c.children.entries()) {
          await tx
            .insert(category)
            .values({
              kind,
              parentId: parent.id,
              name: childName,
              color: c.color,
              sortOrder: si,
            })
            .run();
        }
      }
    };

    await write("expense", input.expense);
    await write("income", input.income);
  });
}

/** Langkah 4 wizard: alokasi budget per kategori induk. */
export async function setupBudgets(db: DB, input: SetupBudgetInput) {
  await db.transaction(async (tx) => {
    for (const b of input.budgets) {
      await tx
        .update(category)
        .set({ budgetAmount: b.budgetAmount })
        .where(and(eq(category.id, b.categoryId), isNull(category.parentId)))
        .run();
    }
  });
}

/* ========================================================================== */
/* AKUN                                                                       */
/* ========================================================================== */

export async function saveAccountGroup(db: DB, input: AccountGroupInput) {
  if (input.id) {
    await db
      .update(accountGroup)
      .set({ name: input.name, type: input.type })
      .where(eq(accountGroup.id, input.id))
      .run();
    return input.id;
  }
  const max = await db.get<{ n: number }>(
    sql`SELECT COALESCE(MAX(sort_order), -1) AS n FROM account_group`,
  );
  const inserted = await db
    .insert(accountGroup)
    .values({ name: input.name, type: input.type, sortOrder: (max?.n ?? -1) + 1 })
    .returning({ id: accountGroup.id })
    .get();
  return inserted.id;
}

export async function saveAccount(db: DB, input: AccountInput) {
  const values = {
    groupId: input.groupId,
    name: input.name,
    bankName: input.bankName,
    accountNumber: input.accountNumber,
    holderName: input.holderName,
    openingBalance: input.openingBalance,
    note: input.note,
  };

  if (input.id) {
    await db.update(account).set(values).where(eq(account.id, input.id)).run();
    return input.id;
  }
  const max = await db.get<{ n: number }>(
    sql`SELECT COALESCE(MAX(sort_order), -1) AS n FROM account WHERE group_id = ${input.groupId}`,
  );
  const inserted = await db
    .insert(account)
    .values({ ...values, sortOrder: (max?.n ?? -1) + 1 })
    .returning({ id: account.id })
    .get();
  return inserted.id;
}

/** Akun yang sudah dipakai hanya boleh diarsipkan, tidak dihapus. */
export async function removeAccount(db: DB, id: number) {
  const used = await accountUsageCount(db, id);
  if (used > 0) {
    throw new AppError(
      "Sub account ini sudah punya transaksi. Arsipkan saja agar riwayat tetap utuh.",
    );
  }
  await db.delete(account).where(eq(account.id, id)).run();
}

export async function setAccountArchived(db: DB, id: number, archived: boolean) {
  await db.update(account).set({ archived }).where(eq(account.id, id)).run();
}

export async function removeAccountGroup(db: DB, id: number) {
  const used = await accountGroupUsageCount(db, id);
  if (used > 0) {
    throw new AppError(
      "Main account ini masih punya sub account. Pindahkan atau hapus sub account-nya lebih dulu.",
    );
  }
  await db.delete(accountGroup).where(eq(accountGroup.id, id)).run();
}

/* ========================================================================== */
/* KATEGORI                                                                   */
/* ========================================================================== */

export async function saveCategory(db: DB, input: CategoryInput) {
  // Hirarki dikunci tepat 2 level: induk sebuah kategori harus kategori akar.
  if (input.parentId) {
    const parent = await db
      .select()
      .from(category)
      .where(eq(category.id, input.parentId))
      .get();
    if (!parent) throw new AppError("Kategori induk tidak ditemukan.");
    if (parent.parentId !== null) {
      throw new AppError(
        "Kategori hanya boleh 2 tingkat. Sub-kategori tidak bisa punya sub lagi.",
      );
    }
    if (parent.kind !== input.kind) {
      throw new AppError(
        "Sub-kategori harus berada di jenis yang sama dengan induknya.",
      );
    }
    if (input.id === input.parentId) {
      throw new AppError("Kategori tidak bisa menjadi induk dirinya sendiri.");
    }
  }

  const values = {
    kind: input.kind,
    parentId: input.parentId,
    name: input.name,
    color: input.color,
    // Budget hanya bermakna di kategori induk.
    budgetAmount: input.parentId ? 0 : input.budgetAmount,
  };

  if (input.id) {
    // Kategori yang punya anak tidak boleh dijadikan sub-kategori.
    if (input.parentId) {
      const childCount = await db.get<{ n: number }>(
        sql`SELECT COUNT(*) AS n FROM category WHERE parent_id = ${input.id}`,
      );
      if ((childCount?.n ?? 0) > 0) {
        throw new AppError(
          "Kategori ini punya sub-kategori, jadi tidak bisa dipindah menjadi sub-kategori.",
        );
      }
    }
    await db.update(category).set(values).where(eq(category.id, input.id)).run();
    return input.id;
  }

  const max = await db.get<{ n: number }>(sql`
    SELECT COALESCE(MAX(sort_order), -1) AS n FROM category
    WHERE kind = ${input.kind}
      AND parent_id IS ${input.parentId === null ? sql`NULL` : sql`${input.parentId}`}
  `);
  const inserted = await db
    .insert(category)
    .values({ ...values, sortOrder: (max?.n ?? -1) + 1 })
    .returning({ id: category.id })
    .get();
  return inserted.id;
}

export async function setCategoryBudget(db: DB, categoryId: number, amount: number) {
  const cat = await db
    .select()
    .from(category)
    .where(eq(category.id, categoryId))
    .get();
  if (!cat) throw new AppError("Kategori tidak ditemukan.");
  if (cat.parentId !== null) {
    throw new AppError("Budget hanya bisa diatur di kategori induk.");
  }
  await db
    .update(category)
    .set({ budgetAmount: amount })
    .where(eq(category.id, categoryId))
    .run();
}

export async function removeCategory(db: DB, id: number) {
  const used = await categoryUsageCount(db, id);
  if (used > 0) {
    throw new AppError(
      "Kategori ini masih dipakai transaksi atau punya sub-kategori. Arsipkan saja.",
    );
  }
  await db.delete(category).where(eq(category.id, id)).run();
}

export async function setCategoryArchived(db: DB, id: number, archived: boolean) {
  await db.transaction(async (tx) => {
    await tx.update(category).set({ archived }).where(eq(category.id, id)).run();
    // Arsip induk ikut mengarsipkan seluruh sub-kategorinya.
    await tx
      .update(category)
      .set({ archived })
      .where(eq(category.parentId, id))
      .run();
  });
}

/* ========================================================================== */
/* SUPPLIER                                                                   */
/* ========================================================================== */

export async function saveSupplier(db: DB, input: SupplierInput) {
  const values = {
    name: input.name,
    categoryId: input.categoryId,
    contactPerson: input.contactPerson,
    phone: input.phone,
    email: input.email,
    bankName: input.bankName,
    bankAccount: input.bankAccount,
    note: input.note,
  };
  if (input.id) {
    await db.update(supplier).set(values).where(eq(supplier.id, input.id)).run();
    return input.id;
  }
  const inserted = await db
    .insert(supplier)
    .values(values)
    .returning({ id: supplier.id })
    .get();
  return inserted.id;
}

export async function removeSupplier(db: DB, id: number) {
  const used = await supplierUsageCount(db, id);
  if (used > 0) {
    throw new AppError(
      "Supplier ini sudah terpakai di transaksi. Arsipkan saja agar riwayat tetap utuh.",
    );
  }
  await db.delete(supplier).where(eq(supplier.id, id)).run();
}

export async function setSupplierArchived(db: DB, id: number, archived: boolean) {
  await db.update(supplier).set({ archived }).where(eq(supplier.id, id)).run();
}

/* ========================================================================== */
/* TRANSAKSI                                                                  */
/* ========================================================================== */

async function assertCategoryKind(db: DB, categoryId: number, kind: CategoryKind) {
  const cat = await db
    .select()
    .from(category)
    .where(eq(category.id, categoryId))
    .get();
  if (!cat) throw new AppError("Kategori tidak ditemukan.");
  if (cat.kind !== kind) {
    throw new AppError(
      kind === "expense"
        ? "Pilih kategori pengeluaran untuk transaksi pengeluaran."
        : "Pilih kategori pemasukan untuk transaksi pemasukan.",
    );
  }
}

/**
 * Membuat pengeluaran. Jumlah baris `payment` yang ikut dibuat ditentukan
 * paymentMode — inilah pintu masuk fitur hutang.
 */
export async function createExpense(db: DB, input: ExpenseInput): Promise<number> {
  await assertCategoryKind(db, input.categoryId, "expense");

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(transaction)
      .values({
        type: "expense",
        date: input.date,
        description: input.description,
        amount: input.amount,
        accountId: input.accountId,
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        note: input.note,
        dueDate: input.paymentMode === "full" ? null : input.dueDate,
        paymentStatus: "unpaid",
      })
      .returning({ id: transaction.id })
      .get();

    const upfront =
      input.paymentMode === "full"
        ? input.amount
        : input.paymentMode === "partial"
          ? input.downPayment
          : 0;

    if (upfront > 0) {
      await tx
        .insert(payment)
        .values({
          transactionId: inserted.id,
          date: input.paymentDate ?? input.date,
          amount: upfront,
          accountId: input.accountId,
          method: input.paymentMethod,
          note: input.paymentMode === "partial" ? "DP" : null,
        })
        .run();
    }

    await recalcPaymentStatus(tx, inserted.id);
    return inserted.id;
  });
}

/** Pemasukan selalu langsung diterima penuh di sub account tujuan. */
export async function createIncome(db: DB, input: IncomeInput): Promise<number> {
  await assertCategoryKind(db, input.categoryId, "income");

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(transaction)
      .values({
        type: "income",
        date: input.date,
        description: input.description,
        amount: input.amount,
        accountId: input.accountId,
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        note: input.note,
        paymentStatus: "unpaid",
      })
      .returning({ id: transaction.id })
      .get();

    await tx
      .insert(payment)
      .values({
        transactionId: inserted.id,
        date: input.date,
        amount: input.amount,
        accountId: input.accountId,
        method: input.paymentMethod,
      })
      .run();

    await recalcPaymentStatus(tx, inserted.id);
    return inserted.id;
  });
}

/** Transfer tidak menyentuh kategori, budget, maupun hutang. */
export async function createTransfer(db: DB, input: TransferInput): Promise<number> {
  if (input.accountId === input.toAccountId) {
    throw new AppError("Akun asal dan tujuan harus berbeda.");
  }
  const inserted = await db
    .insert(transaction)
    .values({
      type: "transfer",
      date: input.date,
      description: input.description,
      amount: input.amount,
      accountId: input.accountId,
      toAccountId: input.toAccountId,
      categoryId: null,
      note: input.note,
      paymentStatus: "paid",
    })
    .returning({ id: transaction.id })
    .get();
  return inserted.id;
}

/**
 * Mengubah transaksi yang sudah ada.
 *
 * Aturan yang dipegang:
 *  - Nilai baru tidak boleh lebih kecil dari total pembayaran yang sudah
 *    tercatat — user harus menghapus pembayarannya dulu, supaya tidak ada
 *    hutang negatif yang muncul diam-diam.
 *  - Bila transaksi masih polos (tepat satu payment otomatis sebesar nilai
 *    lama), payment itu ikut menyesuaikan agar saldo tetap benar.
 */
export async function updateExpense(db: DB, id: number, input: ExpenseInput) {
  await assertCategoryKind(db, input.categoryId, "expense");

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(transaction)
      .where(eq(transaction.id, id))
      .get();
    if (!existing) throw new AppError("Transaksi tidak ditemukan.");
    if (existing.type !== "expense") {
      throw new AppError("Jenis transaksi tidak bisa diubah setelah dibuat.");
    }

    const payments = await tx
      .select()
      .from(payment)
      .where(eq(payment.transactionId, id))
      .orderBy(asc(payment.id))
      .all();
    const paid = payments.reduce((s, p) => s + p.amount, 0);

    const autoSinglePayment =
      payments.length === 1 && payments[0].amount === existing.amount;

    if (autoSinglePayment && input.paymentMode === "full") {
      await tx
        .update(payment)
        .set({
          amount: input.amount,
          accountId: input.accountId,
          date: input.paymentDate ?? input.date,
          method: input.paymentMethod,
        })
        .where(eq(payment.id, payments[0].id))
        .run();
    } else if (input.amount < paid) {
      throw new AppError(
        `Nilai transaksi tidak boleh lebih kecil dari total pembayaran yang sudah tercatat. Hapus atau kurangi pembayaran (kini ${paid.toLocaleString("id-ID")}) lebih dulu.`,
      );
    }

    await tx
      .update(transaction)
      .set({
        date: input.date,
        description: input.description,
        amount: input.amount,
        accountId: input.accountId,
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        note: input.note,
        dueDate: input.dueDate,
        updatedAt: nowMs(),
      })
      .where(eq(transaction.id, id))
      .run();

    await recalcPaymentStatus(tx, id);
  });
}

export async function updateIncome(db: DB, id: number, input: IncomeInput) {
  await assertCategoryKind(db, input.categoryId, "income");

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(transaction)
      .where(eq(transaction.id, id))
      .get();
    if (!existing) throw new AppError("Transaksi tidak ditemukan.");
    if (existing.type !== "income") {
      throw new AppError("Jenis transaksi tidak bisa diubah setelah dibuat.");
    }

    const payments = await tx
      .select()
      .from(payment)
      .where(eq(payment.transactionId, id))
      .orderBy(asc(payment.id))
      .all();

    if (payments.length === 1) {
      await tx
        .update(payment)
        .set({
          amount: input.amount,
          accountId: input.accountId,
          date: input.date,
          method: input.paymentMethod,
        })
        .where(eq(payment.id, payments[0].id))
        .run();
    }

    await tx
      .update(transaction)
      .set({
        date: input.date,
        description: input.description,
        amount: input.amount,
        accountId: input.accountId,
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        note: input.note,
        updatedAt: nowMs(),
      })
      .where(eq(transaction.id, id))
      .run();

    await recalcPaymentStatus(tx, id);
  });
}

export async function updateTransfer(db: DB, id: number, input: TransferInput) {
  if (input.accountId === input.toAccountId) {
    throw new AppError("Akun asal dan tujuan harus berbeda.");
  }
  const existing = await db
    .select()
    .from(transaction)
    .where(eq(transaction.id, id))
    .get();
  if (!existing) throw new AppError("Transaksi tidak ditemukan.");
  if (existing.type !== "transfer") {
    throw new AppError("Jenis transaksi tidak bisa diubah setelah dibuat.");
  }

  await db
    .update(transaction)
    .set({
      date: input.date,
      description: input.description,
      amount: input.amount,
      accountId: input.accountId,
      toAccountId: input.toAccountId,
      note: input.note,
      updatedAt: nowMs(),
    })
    .where(eq(transaction.id, id))
    .run();
}

/** Menghapus transaksi ikut menghapus payment & attachment-nya (ON DELETE CASCADE). */
export async function removeTransaction(db: DB, id: number) {
  await db.delete(transaction).where(eq(transaction.id, id)).run();
}

/* ========================================================================== */
/* PEMBAYARAN / CICILAN                                                       */
/* ========================================================================== */

/**
 * Mencatat satu termin pembayaran atas transaksi yang belum lunas.
 * Inilah satu-satunya cara saldo akun berkurang untuk expense berhutang.
 */
export async function addPayment(db: DB, input: PaymentInput): Promise<number> {
  return db.transaction(async (tx) => {
    const target = await tx
      .select()
      .from(transaction)
      .where(eq(transaction.id, input.transactionId))
      .get();
    if (!target) throw new AppError("Transaksi tidak ditemukan.");
    if (target.type === "transfer") {
      throw new AppError("Transfer tidak punya termin pembayaran.");
    }

    const paid = await paidTotalFor(tx, input.transactionId);
    const remaining = target.amount - paid;
    if (remaining <= 0) {
      throw new AppError("Transaksi ini sudah lunas.");
    }
    if (input.amount > remaining) {
      throw new AppError(
        `Pembayaran melebihi sisa hutang. Sisa yang belum dibayar Rp ${remaining.toLocaleString("id-ID")}.`,
      );
    }

    const inserted = await tx
      .insert(payment)
      .values({
        transactionId: input.transactionId,
        date: input.date,
        amount: input.amount,
        accountId: input.accountId,
        method: input.method,
        note: input.note,
      })
      .returning({ id: payment.id })
      .get();

    await recalcPaymentStatus(tx, input.transactionId);
    return inserted.id;
  });
}

export async function removePayment(db: DB, paymentId: number) {
  await db.transaction(async (tx) => {
    const p = await tx
      .select()
      .from(payment)
      .where(eq(payment.id, paymentId))
      .get();
    if (!p) throw new AppError("Pembayaran tidak ditemukan.");
    await tx.delete(payment).where(eq(payment.id, paymentId)).run();
    await recalcPaymentStatus(tx, p.transactionId);
  });
}

/* ========================================================================== */
/* LAMPIRAN                                                                   */
/* ========================================================================== */

export async function addAttachment(
  db: DB,
  input: {
    transactionId?: number | null;
    paymentId?: number | null;
    fileName: string;
    originalName: string;
    mime: string;
    size: number;
  },
): Promise<number> {
  const inserted = await db
    .insert(attachment)
    .values({
      transactionId: input.transactionId ?? null,
      paymentId: input.paymentId ?? null,
      fileName: input.fileName,
      originalName: input.originalName,
      mime: input.mime,
      size: input.size,
    })
    .returning({ id: attachment.id })
    .get();
  return inserted.id;
}

export async function getAttachment(db: DB, id: number) {
  return db.select().from(attachment).where(eq(attachment.id, id)).get();
}

export async function removeAttachment(db: DB, id: number) {
  await db.delete(attachment).where(eq(attachment.id, id)).run();
}

/* ========================================================================== */
/* RESET                                                                      */
/* ========================================================================== */

/** Mengosongkan seluruh data dan mengembalikan aplikasi ke kondisi wizard. */
export async function resetAll(db: DB) {
  await db.transaction(async (tx) => {
    await tx.delete(attachment).run();
    await tx.delete(payment).run();
    await tx.delete(transaction).run();
    await tx.delete(supplier).run();
    await tx.run(sql`DELETE FROM category WHERE parent_id IS NOT NULL`);
    await tx.delete(category).run();
    await tx.delete(account).run();
    await tx.delete(accountGroup).run();
    await tx
      .update(event)
      .set({
        name: "Wedding",
        brideName: null,
        groomName: null,
        eventDate: null,
        totalBudgetTarget: 0,
        setupCompletedAt: null,
        setupStep: 1,
        updatedAt: nowMs(),
      })
      .where(eq(event.id, 1))
      .run();
  });
}

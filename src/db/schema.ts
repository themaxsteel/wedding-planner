import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  index,
  check,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

/**
 * Konvensi seluruh skema:
 * - Uang disimpan sebagai INTEGER rupiah penuh (tanpa sen). Tidak pernah float.
 * - Tanggal bisnis (date, dueDate) disimpan TEXT "YYYY-MM-DD" agar bisa
 *   difilter & diurutkan langsung di SQL.
 * - Timestamp sistem disimpan INTEGER epoch milidetik.
 */

const now = sql`(unixepoch() * 1000)`;

/* -------------------------------------------------------------------------- */
/* EVENT - selalu tepat satu baris (id = 1)                                    */
/* -------------------------------------------------------------------------- */

export const event = sqliteTable("event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().default("Wedding"),
  brideName: text("bride_name"),
  groomName: text("groom_name"),
  eventDate: text("event_date"),
  currency: text("currency").notNull().default("IDR"),
  totalBudgetTarget: integer("total_budget_target").notNull().default(0),
  /** null = wizard belum selesai; seluruh app diarahkan ke /setup */
  setupCompletedAt: integer("setup_completed_at"),
  /** langkah wizard terakhir yang sudah diselesaikan (1..5), untuk resume */
  setupStep: integer("setup_step").notNull().default(1),
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
});

/* -------------------------------------------------------------------------- */
/* MAIN ACCOUNT - grup aset. Tidak pernah menjadi lawan transaksi.             */
/* -------------------------------------------------------------------------- */

export const accountGroup = sqliteTable(
  "account_group",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** bank | cash | ewallet | other */
    type: text("type").notNull().default("bank"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    check(
      "account_group_type_valid",
      sql`${t.type} IN ('bank','cash','ewallet','other')`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* SUB ACCOUNT - satu-satunya tempat transaksi terjadi.                        */
/* -------------------------------------------------------------------------- */

export const account = sqliteTable(
  "account",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
      .notNull()
      .references(() => accountGroup.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    holderName: text("holder_name"),
    openingBalance: integer("opening_balance").notNull().default(0),
    note: text("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("account_group_idx").on(t.groupId)],
);

/* -------------------------------------------------------------------------- */
/* CATEGORY - tepat 2 level. parentId NULL = kategori induk.                   */
/* Budget hanya bermakna di kategori induk.                                    */
/* -------------------------------------------------------------------------- */

export const category = sqliteTable(
  "category",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** expense | income */
    kind: text("kind").notNull(),
    parentId: integer("parent_id").references(
      (): AnySQLiteColumn => category.id,
      { onDelete: "restrict" },
    ),
    name: text("name").notNull(),
    /** hanya diisi pada kategori induk; sub-kategori selalu 0 */
    budgetAmount: integer("budget_amount").notNull().default(0),
    /** token warna pastel: red | blue | green | yellow | purple | neutral */
    color: text("color").notNull().default("neutral"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("category_parent_idx").on(t.parentId),
    index("category_kind_idx").on(t.kind),
    check("category_kind_valid", sql`${t.kind} IN ('expense','income')`),
    check("category_budget_nonneg", sql`${t.budgetAmount} >= 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* SUPPLIER - master data vendor.                                              */
/* -------------------------------------------------------------------------- */

export const supplier = sqliteTable(
  "supplier",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** kategori induk yang paling sering dipakai vendor ini (opsional) */
    categoryId: integer("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    bankName: text("bank_name"),
    bankAccount: text("bank_account"),
    note: text("note"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("supplier_category_idx").on(t.categoryId)],
);

/* -------------------------------------------------------------------------- */
/* TRANSACTION - pencatatan KOMITMEN (basis akrual).                           */
/* Baris ini yang membebani budget, bukan pergerakan kas.                      */
/* -------------------------------------------------------------------------- */

export const transaction = sqliteTable(
  "transaction",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** expense | income | transfer */
    type: text("type").notNull(),
    /** "YYYY-MM-DD" */
    date: text("date").notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),

    /** sumber dana (expense) / akun tujuan (income) / akun asal (transfer) */
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
    /** hanya untuk transfer: akun tujuan */
    toAccountId: integer("to_account_id").references(() => account.id, {
      onDelete: "restrict",
    }),
    /** sub-kategori bila ada, selain itu kategori induk. NULL untuk transfer */
    categoryId: integer("category_id").references(() => category.id, {
      onDelete: "restrict",
    }),
    supplierId: integer("supplier_id").references(() => supplier.id, {
      onDelete: "set null",
    }),

    /**
     * paid | partial | unpaid.
     * Nilai turunan dari SUM(payment.amount), disimpan agar bisa difilter &
     * diindeks. Selalu ditulis ulang lewat recalcPaymentStatus().
     */
    paymentStatus: text("payment_status").notNull().default("paid"),
    /** "YYYY-MM-DD", relevan ketika belum lunas */
    dueDate: text("due_date"),
    note: text("note"),

    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [
    index("transaction_date_idx").on(t.date),
    index("transaction_type_idx").on(t.type),
    index("transaction_category_idx").on(t.categoryId),
    index("transaction_account_idx").on(t.accountId),
    index("transaction_supplier_idx").on(t.supplierId),
    index("transaction_status_idx").on(t.paymentStatus),
    check(
      "transaction_type_valid",
      sql`${t.type} IN ('expense','income','transfer')`,
    ),
    check("transaction_amount_positive", sql`${t.amount} > 0`),
    check(
      "transaction_status_valid",
      sql`${t.paymentStatus} IN ('paid','partial','unpaid')`,
    ),
    // Transfer wajib punya akun tujuan berbeda, dan tanpa kategori.
    check(
      "transaction_transfer_shape",
      sql`(${t.type} <> 'transfer') OR (${t.toAccountId} IS NOT NULL AND ${t.toAccountId} <> ${t.accountId} AND ${t.categoryId} IS NULL)`,
    ),
    // Non-transfer wajib punya kategori, dan tanpa akun tujuan.
    check(
      "transaction_nontransfer_shape",
      sql`(${t.type} = 'transfer') OR (${t.categoryId} IS NOT NULL AND ${t.toAccountId} IS NULL)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* PAYMENT - SATU-SATUNYA sumber pergerakan kas riil (termin/cicilan).         */
/* Saldo akun dihitung eksklusif dari tabel ini + transfer + saldo awal.       */
/* -------------------------------------------------------------------------- */

export const payment = sqliteTable(
  "payment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    /** "YYYY-MM-DD" */
    date: text("date").notNull(),
    amount: integer("amount").notNull(),
    /** sub account yang dipakai membayar / menerima */
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
    /** transfer | tunai | kartu | ewallet | lainnya */
    method: text("method").notNull().default("transfer"),
    note: text("note"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("payment_transaction_idx").on(t.transactionId),
    index("payment_account_idx").on(t.accountId),
    index("payment_date_idx").on(t.date),
    check("payment_amount_positive", sql`${t.amount} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* ATTACHMENT - bukti/struk, file fisik di data/attachments.                   */
/* -------------------------------------------------------------------------- */

export const attachment = sqliteTable(
  "attachment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transactionId: integer("transaction_id").references(() => transaction.id, {
      onDelete: "cascade",
    }),
    paymentId: integer("payment_id").references(() => payment.id, {
      onDelete: "cascade",
    }),
    /** nama file di disk (uuid.ext), relatif terhadap data/attachments */
    fileName: text("file_name").notNull(),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("attachment_transaction_idx").on(t.transactionId),
    index("attachment_payment_idx").on(t.paymentId),
  ],
);

/* -------------------------------------------------------------------------- */
/* RELATIONS                                                                   */
/* -------------------------------------------------------------------------- */

export const accountGroupRelations = relations(accountGroup, ({ many }) => ({
  accounts: many(account),
}));

export const accountRelations = relations(account, ({ one, many }) => ({
  group: one(accountGroup, {
    fields: [account.groupId],
    references: [accountGroup.id],
  }),
  payments: many(payment),
}));

export const categoryRelations = relations(category, ({ one, many }) => ({
  parent: one(category, {
    fields: [category.parentId],
    references: [category.id],
    relationName: "categoryTree",
  }),
  children: many(category, { relationName: "categoryTree" }),
  transactions: many(transaction),
}));

export const supplierRelations = relations(supplier, ({ one, many }) => ({
  category: one(category, {
    fields: [supplier.categoryId],
    references: [category.id],
  }),
  transactions: many(transaction),
}));

export const transactionRelations = relations(transaction, ({ one, many }) => ({
  account: one(account, {
    fields: [transaction.accountId],
    references: [account.id],
    relationName: "txAccount",
  }),
  toAccount: one(account, {
    fields: [transaction.toAccountId],
    references: [account.id],
    relationName: "txToAccount",
  }),
  category: one(category, {
    fields: [transaction.categoryId],
    references: [category.id],
  }),
  supplier: one(supplier, {
    fields: [transaction.supplierId],
    references: [supplier.id],
  }),
  payments: many(payment),
  attachments: many(attachment),
}));

export const paymentRelations = relations(payment, ({ one, many }) => ({
  transaction: one(transaction, {
    fields: [payment.transactionId],
    references: [transaction.id],
  }),
  account: one(account, {
    fields: [payment.accountId],
    references: [account.id],
  }),
  attachments: many(attachment),
}));

export const attachmentRelations = relations(attachment, ({ one }) => ({
  transaction: one(transaction, {
    fields: [attachment.transactionId],
    references: [transaction.id],
  }),
  payment: one(payment, {
    fields: [attachment.paymentId],
    references: [payment.id],
  }),
}));

/* -------------------------------------------------------------------------- */

export type Event = typeof event.$inferSelect;
export type AccountGroup = typeof accountGroup.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Supplier = typeof supplier.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type Payment = typeof payment.$inferSelect;
export type Attachment = typeof attachment.$inferSelect;

export type TransactionType = "expense" | "income" | "transfer";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type CategoryKind = "expense" | "income";

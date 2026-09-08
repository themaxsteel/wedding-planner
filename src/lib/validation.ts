import { z } from "zod";
import { parseIDR } from "./money";
import { isISODate } from "./dates";

/**
 * Skema bersama untuk Server Action dan form. Semua field uang melewati
 * parseIDR() lebih dulu supaya user boleh mengetik "Rp 1.250.000" apa adanya.
 */

const isoDate = z
  .string()
  .refine(isISODate, { message: "Tanggal tidak valid" });

const optionalIsoDate = z
  .union([isoDate, z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

/** Menerima string ketikan user maupun angka; hasilnya integer rupiah. */
const money = z
  .union([z.string(), z.number()])
  .transform((v) => parseIDR(v));

const positiveMoney = money.refine((v) => v > 0, {
  message: "Nominal harus lebih besar dari 0",
});

const nonNegativeMoney = money.refine((v) => v >= 0, {
  message: "Nominal tidak boleh negatif",
});

const trimmed = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`);

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const id = z.coerce.number().int().positive();
const optionalId = z
  .union([z.coerce.number().int().positive(), z.literal(0), z.literal("")])
  .optional()
  .transform((v) => (typeof v === "number" && v > 0 ? v : null));

/* -------------------------------------------------------------------------- */
/* EVENT                                                                      */
/* -------------------------------------------------------------------------- */

export const eventSchema = z.object({
  name: trimmed(120).min(1, "Nama event wajib diisi"),
  brideName: optionalText(120),
  groomName: optionalText(120),
  eventDate: optionalIsoDate,
  totalBudgetTarget: nonNegativeMoney,
});

/* -------------------------------------------------------------------------- */
/* AKUN                                                                       */
/* -------------------------------------------------------------------------- */

export const accountGroupSchema = z.object({
  id: optionalId,
  name: trimmed(80).min(1, "Nama main account wajib diisi"),
  type: z.enum(["bank", "cash", "ewallet", "other"]),
});

export const accountSchema = z.object({
  id: optionalId,
  groupId: id,
  name: trimmed(80).min(1, "Nama sub account wajib diisi"),
  bankName: optionalText(80),
  accountNumber: optionalText(60),
  holderName: optionalText(120),
  openingBalance: nonNegativeMoney,
  note: optionalText(300),
});

/* -------------------------------------------------------------------------- */
/* KATEGORI                                                                   */
/* -------------------------------------------------------------------------- */

export const categorySchema = z.object({
  id: optionalId,
  kind: z.enum(["expense", "income"]),
  parentId: optionalId,
  name: trimmed(80).min(1, "Nama kategori wajib diisi"),
  budgetAmount: nonNegativeMoney,
  color: z.enum(["neutral", "red", "blue", "green", "yellow", "purple"]),
});

export const budgetUpdateSchema = z.object({
  categoryId: id,
  budgetAmount: nonNegativeMoney,
});

/* -------------------------------------------------------------------------- */
/* SUPPLIER                                                                   */
/* -------------------------------------------------------------------------- */

export const supplierSchema = z.object({
  id: optionalId,
  name: trimmed(120).min(1, "Nama supplier wajib diisi"),
  categoryId: optionalId,
  contactPerson: optionalText(120),
  phone: optionalText(40),
  email: optionalText(120),
  bankName: optionalText(80),
  bankAccount: optionalText(60),
  note: optionalText(500),
});

/* -------------------------------------------------------------------------- */
/* TRANSAKSI                                                                  */
/* -------------------------------------------------------------------------- */

const paymentMethod = z.enum([
  "transfer",
  "tunai",
  "kartu",
  "ewallet",
  "lainnya",
]);

/**
 * paymentMode menentukan berapa banyak baris `payment` yang dibuat:
 *   full    -> satu payment sebesar nilai transaksi (lunas seketika)
 *   partial -> satu payment sebesar downPayment (DP)
 *   none    -> tanpa payment sama sekali (murni hutang)
 */
export const expenseSchema = z
  .object({
    id: optionalId,
    date: isoDate,
    description: trimmed(200).min(1, "Keterangan wajib diisi"),
    amount: positiveMoney,
    accountId: id,
    categoryId: id,
    supplierId: optionalId,
    note: optionalText(500),
    paymentMode: z.enum(["full", "partial", "none"]),
    downPayment: money.optional().default(0),
    paymentDate: optionalIsoDate,
    paymentMethod: paymentMethod.default("transfer"),
    dueDate: optionalIsoDate,
  })
  .refine(
    (v) => v.paymentMode !== "partial" || v.downPayment > 0,
    { message: "Jumlah DP harus diisi", path: ["downPayment"] },
  )
  .refine(
    (v) => v.paymentMode !== "partial" || v.downPayment < v.amount,
    {
      message: "DP harus lebih kecil dari nilai transaksi. Pilih Lunas jika dibayar penuh.",
      path: ["downPayment"],
    },
  );

export const incomeSchema = z.object({
  id: optionalId,
  date: isoDate,
  description: trimmed(200).min(1, "Keterangan wajib diisi"),
  amount: positiveMoney,
  accountId: id,
  categoryId: id,
  supplierId: optionalId,
  note: optionalText(500),
  paymentMethod: paymentMethod.default("transfer"),
});

export const transferSchema = z
  .object({
    id: optionalId,
    date: isoDate,
    description: trimmed(200).min(1, "Keterangan wajib diisi"),
    amount: positiveMoney,
    accountId: id,
    toAccountId: id,
    note: optionalText(500),
  })
  .refine((v) => v.accountId !== v.toAccountId, {
    message: "Akun asal dan tujuan harus berbeda",
    path: ["toAccountId"],
  });

export const paymentSchema = z.object({
  transactionId: id,
  date: isoDate,
  amount: positiveMoney,
  accountId: id,
  method: paymentMethod.default("transfer"),
  note: optionalText(300),
});

/* -------------------------------------------------------------------------- */
/* SETUP WIZARD                                                               */
/* -------------------------------------------------------------------------- */

export const setupAccountsSchema = z.object({
  groups: z
    .array(
      z.object({
        name: trimmed(80).min(1, "Nama main account wajib diisi"),
        type: z.enum(["bank", "cash", "ewallet", "other"]),
        accounts: z
          .array(
            z.object({
              name: trimmed(80).min(1, "Nama sub account wajib diisi"),
              openingBalance: nonNegativeMoney,
              accountNumber: optionalText(60),
            }),
          )
          .min(1, "Setiap main account butuh minimal 1 sub account"),
      }),
    )
    .min(1, "Buat minimal satu main account"),
});

const categoryGroup = z.object({
  name: trimmed(80).min(1, "Nama kategori wajib diisi"),
  color: z.enum(["neutral", "red", "blue", "green", "yellow", "purple"]),
  children: z.array(trimmed(80).min(1)),
});

export const setupCategoriesSchema = z.object({
  expense: z
    .array(categoryGroup)
    .min(1, "Pilih minimal satu kategori pengeluaran"),
  income: z.array(categoryGroup).min(1, "Pilih minimal satu kategori pemasukan"),
});

export const setupBudgetSchema = z.object({
  budgets: z.array(
    z.object({ categoryId: id, budgetAmount: nonNegativeMoney }),
  ),
});

export type EventInput = z.output<typeof eventSchema>;
export type AccountGroupInput = z.output<typeof accountGroupSchema>;
export type AccountInput = z.output<typeof accountSchema>;
export type CategoryInput = z.output<typeof categorySchema>;
export type SupplierInput = z.output<typeof supplierSchema>;
export type ExpenseInput = z.output<typeof expenseSchema>;
export type IncomeInput = z.output<typeof incomeSchema>;
export type TransferInput = z.output<typeof transferSchema>;
export type PaymentInput = z.output<typeof paymentSchema>;
export type SetupAccountsInput = z.output<typeof setupAccountsSchema>;
export type SetupCategoriesInput = z.output<typeof setupCategoriesSchema>;
export type SetupBudgetInput = z.output<typeof setupBudgetSchema>;

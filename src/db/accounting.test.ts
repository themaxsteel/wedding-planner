import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "./client";
import { account, accountGroup, category } from "./schema";
import {
  getAccountBalances,
  getBudgetTree,
  getCashbook,
  getDashboard,
  getOutstandingDebts,
  summarizeBudget,
} from "./queries";
import {
  addPayment,
  createExpense,
  createIncome,
  createTransfer,
  removePayment,
  updateExpense,
  AppError,
} from "./mutations";

/**
 * Mengunci aturan akuntansi inti aplikasi:
 *   saldo digerakkan HANYA oleh payment, budget dibebani oleh transaction,
 *   dan hutang adalah selisih keduanya.
 *
 * Jika salah satu tes di sini merah, laporan di UI ikut salah.
 *
 * Seluruh helper & assertion di sini ASYNC — driver libSQL (dipakai lewat
 * createDb(":memory:")) bersifat async walau databasenya di memori.
 */

const JT = 1_000_000;

let db: DB;
let bca: number;
let kas: number;
let dokumentasi: number;
let foto: number;
let video: number;
let sumberDana: number;
let tabungan: number;

async function balanceOf(id: number) {
  const balances = await getAccountBalances(db);
  return balances.find((a) => a.id === id)!.balance;
}

async function expenseTotals() {
  return summarizeBudget(await getBudgetTree(db, "expense"));
}

async function dokumentasiNode() {
  const tree = await getBudgetTree(db, "expense");
  return tree.find((n) => n.id === dokumentasi)!;
}

beforeEach(async () => {
  db = await createDb(":memory:");

  const bank = await db
    .insert(accountGroup)
    .values({ name: "Bank", type: "bank", sortOrder: 0 })
    .returning({ id: accountGroup.id })
    .get();
  const tunai = await db
    .insert(accountGroup)
    .values({ name: "Tunai", type: "cash", sortOrder: 1 })
    .returning({ id: accountGroup.id })
    .get();

  bca = (
    await db
      .insert(account)
      .values({ groupId: bank.id, name: "BCA", openingBalance: 50 * JT })
      .returning({ id: account.id })
      .get()
  ).id;
  kas = (
    await db
      .insert(account)
      .values({ groupId: tunai.id, name: "Kas Tunai", openingBalance: 0 })
      .returning({ id: account.id })
      .get()
  ).id;

  dokumentasi = (
    await db
      .insert(category)
      .values({
        kind: "expense",
        name: "Dokumentasi",
        budgetAmount: 20 * JT,
        color: "purple",
      })
      .returning({ id: category.id })
      .get()
  ).id;
  foto = (
    await db
      .insert(category)
      .values({ kind: "expense", parentId: dokumentasi, name: "Foto" })
      .returning({ id: category.id })
      .get()
  ).id;
  video = (
    await db
      .insert(category)
      .values({ kind: "expense", parentId: dokumentasi, name: "Video" })
      .returning({ id: category.id })
      .get()
  ).id;

  sumberDana = (
    await db
      .insert(category)
      .values({ kind: "income", name: "Kontribusi Keluarga" })
      .returning({ id: category.id })
      .get()
  ).id;
  tabungan = (
    await db
      .insert(category)
      .values({ kind: "income", parentId: sumberDana, name: "Keluarga Pria" })
      .returning({ id: category.id })
      .get()
  ).id;
});

describe("expense lunas", () => {
  it("mengurangi saldo dan membebani budget sebesar nilai yang sama", async () => {
    await createExpense(db, {
      date: "2026-01-10",
      description: "DP fotografer",
      amount: 5 * JT,
      accountId: bca,
      categoryId: foto,
      supplierId: null,
      note: null,
      paymentMode: "full",
      downPayment: 0,
      paymentDate: null,
      paymentMethod: "transfer",
      dueDate: null,
      id: null,
    });

    expect(await balanceOf(bca)).toBe(45 * JT);

    const node = await dokumentasiNode();
    expect(node.committed).toBe(5 * JT);
    expect(node.paid).toBe(5 * JT);
    expect(node.outstanding).toBe(0);
    expect(node.remaining).toBe(15 * JT);
    expect(await getOutstandingDebts(db)).toHaveLength(0);
  });
});

describe("expense belum dibayar (hutang)", () => {
  beforeEach(async () => {
    await createExpense(db, {
      date: "2026-01-10",
      description: "Fotografer",
      amount: 5 * JT,
      accountId: bca,
      categoryId: foto,
      supplierId: null,
      note: null,
      paymentMode: "full",
      downPayment: 0,
      paymentDate: null,
      paymentMethod: "transfer",
      dueDate: null,
      id: null,
    });
  });

  function createDebt() {
    return createExpense(db, {
      date: "2026-01-15",
      description: "Videografer",
      amount: 12 * JT,
      accountId: bca,
      categoryId: video,
      supplierId: null,
      note: null,
      paymentMode: "none",
      downPayment: 0,
      paymentDate: null,
      paymentMethod: "transfer",
      dueDate: "2026-02-15",
      id: null,
    });
  }

  it("membebani budget tanpa menyentuh saldo", async () => {
    await createDebt();

    // Saldo TIDAK berubah - ini inti dari fitur hutang.
    expect(await balanceOf(bca)).toBe(45 * JT);

    const node = await dokumentasiNode();
    expect(node.committed).toBe(17 * JT);
    expect(node.paid).toBe(5 * JT);
    expect(node.outstanding).toBe(12 * JT);

    const debts = await getOutstandingDebts(db);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({
      amount: 12 * JT,
      paid: 0,
      outstanding: 12 * JT,
      paymentStatus: "unpaid",
      dueDate: "2026-02-15",
    });
  });

  it("cicilan sebagian memindahkan status ke partial dan mengurangi saldo", async () => {
    const txId = await createDebt();

    await addPayment(db, {
      transactionId: txId,
      date: "2026-01-20",
      amount: 4 * JT,
      accountId: bca,
      method: "transfer",
      note: null,
    });

    expect(await balanceOf(bca)).toBe(41 * JT);

    const debts = await getOutstandingDebts(db);
    expect(debts[0]).toMatchObject({
      paid: 4 * JT,
      outstanding: 8 * JT,
      paymentStatus: "partial",
    });
    // Budget tidak bergerak saat mencicil - komitmennya sudah dihitung sejak awal.
    expect((await dokumentasiNode()).committed).toBe(17 * JT);
  });

  it("pelunasan menutup hutang dan mengeluarkannya dari daftar", async () => {
    const txId = await createDebt();
    const pay = (amount: number) =>
      addPayment(db, {
        transactionId: txId,
        date: "2026-01-20",
        amount,
        accountId: bca,
        method: "transfer",
        note: null,
      });

    await pay(4 * JT);
    await pay(8 * JT);

    expect(await balanceOf(bca)).toBe(33 * JT);
    expect(await getOutstandingDebts(db)).toHaveLength(0);

    const node = await dokumentasiNode();
    expect(node.outstanding).toBe(0);
    expect(node.paid).toBe(17 * JT);
  });

  it("menolak pembayaran yang melebihi sisa hutang", async () => {
    const txId = await createDebt();
    await addPayment(db, {
      transactionId: txId,
      date: "2026-01-20",
      amount: 4 * JT,
      accountId: bca,
      method: "transfer",
      note: null,
    });

    await expect(pay(txId, 9 * JT)).rejects.toThrow(AppError);
    // Saldo tidak boleh ikut berubah saat penolakan.
    expect(await balanceOf(bca)).toBe(41 * JT);
  });

  it("menghapus cicilan mengembalikan saldo dan status", async () => {
    const txId = await createDebt();
    const payId = await addPayment(db, {
      transactionId: txId,
      date: "2026-01-20",
      amount: 4 * JT,
      accountId: bca,
      method: "transfer",
      note: null,
    });

    await removePayment(db, payId);

    expect(await balanceOf(bca)).toBe(45 * JT);
    expect((await getOutstandingDebts(db))[0].paymentStatus).toBe("unpaid");
  });

  it("mempertahankan cicilan dan jatuh tempo saat transaksi diubah", async () => {
    const txId = await createDebt();
    await addPayment(db, {
      transactionId: txId,
      date: "2026-01-20",
      amount: 4 * JT,
      accountId: bca,
      method: "transfer",
      note: null,
    });

    await updateExpense(db, txId, {
      id: txId,
      date: "2026-01-15",
      description: "Videografer + highlight",
      amount: 14 * JT,
      accountId: bca,
      categoryId: video,
      supplierId: null,
      note: null,
      paymentMode: "none",
      downPayment: 0,
      paymentDate: null,
      paymentMethod: "transfer",
      dueDate: "2026-02-15",
    });

    const debt = (await getOutstandingDebts(db))[0];
    expect(debt).toMatchObject({
      description: "Videografer + highlight",
      amount: 14 * JT,
      paid: 4 * JT,
      outstanding: 10 * JT,
      paymentStatus: "partial",
      dueDate: "2026-02-15",
    });
    // Cicilan yang sudah tercatat tidak boleh ikut berubah nilainya.
    expect(await balanceOf(bca)).toBe(41 * JT);
  });

  it("menolak menurunkan nilai transaksi di bawah yang sudah dibayar", async () => {
    const txId = await createDebt();
    await addPayment(db, {
      transactionId: txId,
      date: "2026-01-20",
      amount: 4 * JT,
      accountId: bca,
      method: "transfer",
      note: null,
    });

    await expect(
      updateExpense(db, txId, {
        id: txId,
        date: "2026-01-15",
        description: "Videografer",
        amount: 3 * JT,
        accountId: bca,
        categoryId: video,
        supplierId: null,
        note: null,
        paymentMode: "none",
        downPayment: 0,
        paymentDate: null,
        paymentMethod: "transfer",
        dueDate: "2026-02-15",
      }),
    ).rejects.toThrow(AppError);

    expect((await dokumentasiNode()).committed).toBe(17 * JT);
  });
});

function pay(txId: number, amount: number) {
  return addPayment(db, {
    transactionId: txId,
    date: "2026-01-25",
    amount,
    accountId: bca,
    method: "transfer",
    note: null,
  });
}

describe("DP di muka", () => {
  it("membuat satu cicilan sebesar DP dan sisanya jadi hutang", async () => {
    await createExpense(db, {
      date: "2026-01-15",
      description: "Videografer",
      amount: 10 * JT,
      accountId: bca,
      categoryId: video,
      supplierId: null,
      note: null,
      paymentMode: "partial",
      downPayment: 3 * JT,
      paymentDate: "2026-01-15",
      paymentMethod: "transfer",
      dueDate: "2026-03-01",
      id: null,
    });

    expect(await balanceOf(bca)).toBe(47 * JT);
    expect((await getOutstandingDebts(db))[0]).toMatchObject({
      paid: 3 * JT,
      outstanding: 7 * JT,
      paymentStatus: "partial",
    });
  });
});

describe("budget jebol", () => {
  it("menandai kategori yang komitmennya melebihi budget", async () => {
    const spend = (amount: number, cat: number) =>
      createExpense(db, {
        date: "2026-01-10",
        description: "Vendor",
        amount,
        accountId: bca,
        categoryId: cat,
        supplierId: null,
        note: null,
        paymentMode: "none",
        downPayment: 0,
        paymentDate: null,
        paymentMethod: "transfer",
        dueDate: null,
        id: null,
      });

    await spend(5 * JT, foto);
    await spend(12 * JT, video);
    await spend(5 * JT, foto);

    const node = await dokumentasiNode();
    expect(node.committed).toBe(22 * JT);
    expect(node.budget).toBe(20 * JT);
    expect(node.remaining).toBe(-2 * JT);
    const dash = await getDashboard(db);
    expect(dash.overBudget.map((n) => n.id)).toContain(dokumentasi);
  });
});

describe("transfer antar akun", () => {
  it("memindahkan saldo tanpa menyentuh budget atau hutang", async () => {
    await createTransfer(db, {
      id: null,
      date: "2026-01-12",
      description: "Ambil tunai untuk vendor",
      amount: 3 * JT,
      accountId: bca,
      toAccountId: kas,
      note: null,
    });

    expect(await balanceOf(bca)).toBe(47 * JT);
    expect(await balanceOf(kas)).toBe(3 * JT);

    const totals = await expenseTotals();
    expect(totals.committed).toBe(0);
    expect(totals.outstanding).toBe(0);
    const dash = await getDashboard(db);
    expect(dash.totalBalance).toBe(50 * JT);
  });
});

describe("pemasukan", () => {
  it("menambah saldo dan tercatat di pos pemasukan", async () => {
    await createIncome(db, {
      id: null,
      date: "2026-01-05",
      description: "Kontribusi orang tua",
      amount: 25 * JT,
      accountId: bca,
      categoryId: tabungan,
      supplierId: null,
      note: null,
      paymentMethod: "transfer",
    });

    expect(await balanceOf(bca)).toBe(75 * JT);
    const income = summarizeBudget(await getBudgetTree(db, "income"));
    expect(income.committed).toBe(25 * JT);
    expect(income.paid).toBe(25 * JT);
  });
});

describe("invarian menyeluruh", () => {
  it("terpakai - kas keluar = total hutang, dan buku kas cocok dengan saldo", async () => {
    await createIncome(db, {
      id: null,
      date: "2026-01-05",
      description: "Kontribusi",
      amount: 25 * JT,
      accountId: bca,
      categoryId: tabungan,
      supplierId: null,
      note: null,
      paymentMethod: "transfer",
    });
    await createExpense(db, {
      id: null,
      date: "2026-01-10",
      description: "Fotografer",
      amount: 5 * JT,
      accountId: bca,
      categoryId: foto,
      supplierId: null,
      note: null,
      paymentMode: "full",
      downPayment: 0,
      paymentDate: null,
      paymentMethod: "transfer",
      dueDate: null,
    });
    const debtId = await createExpense(db, {
      id: null,
      date: "2026-01-15",
      description: "Videografer",
      amount: 12 * JT,
      accountId: bca,
      categoryId: video,
      supplierId: null,
      note: null,
      paymentMode: "partial",
      downPayment: 2 * JT,
      paymentDate: "2026-01-15",
      paymentMethod: "transfer",
      dueDate: "2026-02-15",
    });
    await createTransfer(db, {
      id: null,
      date: "2026-01-16",
      description: "Ke kas tunai",
      amount: 3 * JT,
      accountId: bca,
      toAccountId: kas,
      note: null,
    });
    await pay(debtId, 1 * JT);

    const dash = await getDashboard(db);

    // Invarian 1: hutang adalah selisih basis akrual dan basis kas.
    expect(dash.expense.committed - dash.expense.paid).toBe(dash.totalDebt);
    expect(dash.totalDebt).toBe(9 * JT);

    // Invarian 2: total saldo = saldo awal + kas masuk - kas keluar.
    expect(dash.totalBalance).toBe(50 * JT + 25 * JT - (5 * JT + 3 * JT));

    // Invarian 3: baris terakhir buku kas = saldo akun.
    const book = await getCashbook(db, bca);
    expect(book.at(-1)!.balance).toBe(await balanceOf(bca));

    const kasBook = await getCashbook(db, kas);
    expect(kasBook.at(-1)!.balance).toBe(await balanceOf(kas));
  });
});

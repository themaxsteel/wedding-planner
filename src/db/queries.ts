import { sql, eq, and, or, desc, asc, inArray, like } from "drizzle-orm";
import type { DB, DBOrTx } from "./client";
import {
  account,
  accountGroup,
  category,
  event,
  supplier,
  transaction,
  payment,
  attachment,
  type CategoryKind,
  type PaymentStatus,
  type TransactionType,
} from "./schema";

/**
 * PUSAT KEBENARAN seluruh angka aplikasi.
 *
 * Dua basis perhitungan yang sengaja dibedakan dan tidak boleh dicampur:
 *
 *   AKRUAL (komitmen)  — SUM(transaction.amount).
 *                        Membebani BUDGET begitu kesepakatan dibuat,
 *                        walau belum sepeser pun dibayar.
 *
 *   KAS (realisasi)    — SUM(payment.amount).
 *                        Satu-satunya hal yang menggerakkan SALDO AKUN.
 *
 *   HUTANG             — selisih keduanya (akrual - kas) pada expense.
 *
 * Tidak boleh ada komponen UI yang menghitung ulang rumus di file ini.
 *
 * Seluruh fungsi di sini ASYNC: `db` adalah koneksi libSQL (file lokal saat
 * dev, Turso saat production) yang selalu berbicara lewat jaringan/IPC,
 * bukan panggilan sinkron seperti better-sqlite3 dulu. Di mana pun beberapa
 * query saling tidak bergantung, dijalankan lewat `Promise.all` supaya
 * hanya makan satu putaran latensi, bukan berturut-turut.
 */

/* ========================================================================== */
/* EVENT                                                                      */
/* ========================================================================== */

export async function getEvent(db: DB) {
  const row = await db.select().from(event).where(eq(event.id, 1)).get();
  if (!row) throw new Error("Baris event (id=1) tidak ditemukan.");
  return row;
}

export async function isSetupComplete(db: DB): Promise<boolean> {
  const ev = await getEvent(db);
  return ev.setupCompletedAt !== null;
}

/* ========================================================================== */
/* SALDO AKUN                                                                 */
/* ========================================================================== */

export type AccountBalanceRow = {
  id: number;
  groupId: number;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  holderName: string | null;
  note: string | null;
  openingBalance: number;
  archived: number;
  sortOrder: number;
  /** kas masuk = payment atas transaksi income */
  cashIn: number;
  /** kas keluar = payment atas transaksi expense */
  cashOut: number;
  transferIn: number;
  transferOut: number;
  balance: number;
  movementCount: number;
};

/**
 * saldo = saldo awal + kas masuk - kas keluar + transfer masuk - transfer keluar
 *
 * Transaksi expense yang belum dibayar TIDAK muncul di sini sama sekali —
 * itulah yang membuat fitur hutang tidak merusak saldo.
 */
export async function getAccountBalances(db: DB): Promise<AccountBalanceRow[]> {
  return db.all<AccountBalanceRow>(sql`
    SELECT
      a.id             AS id,
      a.group_id       AS groupId,
      a.name           AS name,
      a.bank_name      AS bankName,
      a.account_number AS accountNumber,
      a.holder_name    AS holderName,
      a.note           AS note,
      a.opening_balance AS openingBalance,
      a.archived       AS archived,
      a.sort_order     AS sortOrder,
      COALESCE(cash.cash_in, 0)   AS cashIn,
      COALESCE(cash.cash_out, 0)  AS cashOut,
      COALESCE(tin.total, 0)      AS transferIn,
      COALESCE(tout.total, 0)     AS transferOut,
      a.opening_balance
        + COALESCE(cash.cash_in, 0)
        - COALESCE(cash.cash_out, 0)
        + COALESCE(tin.total, 0)
        - COALESCE(tout.total, 0) AS balance,
      COALESCE(cash.n, 0) + COALESCE(tin.n, 0) + COALESCE(tout.n, 0)
                                  AS movementCount
    FROM account a
    LEFT JOIN (
      SELECT p.account_id AS account_id,
             SUM(CASE WHEN t.type = 'income'  THEN p.amount ELSE 0 END) AS cash_in,
             SUM(CASE WHEN t.type = 'expense' THEN p.amount ELSE 0 END) AS cash_out,
             COUNT(*) AS n
      FROM payment p
      JOIN "transaction" t ON t.id = p.transaction_id
      GROUP BY p.account_id
    ) cash ON cash.account_id = a.id
    LEFT JOIN (
      SELECT t.to_account_id AS account_id, SUM(t.amount) AS total, COUNT(*) AS n
      FROM "transaction" t WHERE t.type = 'transfer' GROUP BY t.to_account_id
    ) tin ON tin.account_id = a.id
    LEFT JOIN (
      SELECT t.account_id AS account_id, SUM(t.amount) AS total, COUNT(*) AS n
      FROM "transaction" t WHERE t.type = 'transfer' GROUP BY t.account_id
    ) tout ON tout.account_id = a.id
    ORDER BY a.sort_order, a.id
  `);
}

export type AccountGroupWithAccounts = {
  id: number;
  name: string;
  type: string;
  sortOrder: number;
  archived: boolean;
  accounts: AccountBalanceRow[];
  balance: number;
};

/** Main account + sub account di bawahnya, saldo grup = jumlah sub-nya. */
export async function getAccountTree(
  db: DB,
  opts: { includeArchived?: boolean } = {},
): Promise<AccountGroupWithAccounts[]> {
  const [groups, balances] = await Promise.all([
    db
      .select()
      .from(accountGroup)
      .orderBy(asc(accountGroup.sortOrder), asc(accountGroup.id))
      .all(),
    getAccountBalances(db),
  ]);

  return groups
    .filter((g) => opts.includeArchived || !g.archived)
    .map((g) => {
      const accounts = balances.filter(
        (a) => a.groupId === g.id && (opts.includeArchived || !a.archived),
      );
      return {
        id: g.id,
        name: g.name,
        type: g.type,
        sortOrder: g.sortOrder,
        archived: g.archived,
        accounts,
        balance: accounts.reduce((sum, a) => sum + a.balance, 0),
      };
    });
}

/** Daftar datar sub account untuk dropdown, sudah dilengkapi nama grup. */
export async function getSelectableAccounts(db: DB) {
  const rows = await db
    .select({
      id: account.id,
      name: account.name,
      archived: account.archived,
      groupId: accountGroup.id,
      groupName: accountGroup.name,
      groupType: accountGroup.type,
      sortOrder: account.sortOrder,
    })
    .from(account)
    .innerJoin(accountGroup, eq(account.groupId, accountGroup.id))
    .orderBy(asc(accountGroup.sortOrder), asc(account.sortOrder), asc(account.id))
    .all();
  return rows.filter((r) => !r.archived);
}

/* ========================================================================== */
/* BUDGET                                                                     */
/* ========================================================================== */

type CategoryStatRow = {
  id: number;
  parentId: number | null;
  kind: CategoryKind;
  name: string;
  color: string;
  budgetAmount: number;
  sortOrder: number;
  archived: number;
  /** akrual: total nilai transaksi yang menempel langsung di kategori ini */
  ownCommitted: number;
  /** kas: total pembayaran yang sudah terjadi atas transaksi kategori ini */
  ownPaid: number;
  ownCount: number;
};

export type CategoryNode = {
  id: number;
  parentId: number | null;
  kind: CategoryKind;
  name: string;
  color: string;
  archived: boolean;
  sortOrder: number;
  /** budget hanya bermakna di kategori induk */
  budget: number;
  /** akrual, sudah termasuk seluruh sub-kategori */
  committed: number;
  /** kas, sudah termasuk seluruh sub-kategori */
  paid: number;
  /** committed - paid, yaitu hutang yang berasal dari pos ini */
  outstanding: number;
  /** budget - committed; negatif = jebol */
  remaining: number;
  txCount: number;
  children: CategoryNode[];
};

async function categoryStats(db: DB, kind: CategoryKind): Promise<CategoryStatRow[]> {
  return db.all<CategoryStatRow>(sql`
    SELECT
      c.id            AS id,
      c.parent_id     AS parentId,
      c.kind          AS kind,
      c.name          AS name,
      c.color         AS color,
      c.budget_amount AS budgetAmount,
      c.sort_order    AS sortOrder,
      c.archived      AS archived,
      COALESCE(agg.committed, 0) AS ownCommitted,
      COALESCE(pagg.paid, 0)     AS ownPaid,
      COALESCE(agg.n, 0)         AS ownCount
    FROM category c
    LEFT JOIN (
      SELECT t.category_id AS category_id,
             SUM(t.amount) AS committed,
             COUNT(*)      AS n
      FROM "transaction" t
      WHERE t.type <> 'transfer'
      GROUP BY t.category_id
    ) agg ON agg.category_id = c.id
    LEFT JOIN (
      SELECT t.category_id AS category_id, SUM(p.amount) AS paid
      FROM payment p
      JOIN "transaction" t ON t.id = p.transaction_id
      WHERE t.type <> 'transfer'
      GROUP BY t.category_id
    ) pagg ON pagg.category_id = c.id
    WHERE c.kind = ${kind}
    ORDER BY c.sort_order, c.id
  `);
}

/**
 * Pohon kategori 2 level dengan rollup. Transaksi boleh menempel di induk
 * maupun sub-kategori; keduanya dijumlahkan ke induk.
 */
export async function getBudgetTree(
  db: DB,
  kind: CategoryKind,
  opts: { includeArchived?: boolean } = {},
): Promise<CategoryNode[]> {
  const all = await categoryStats(db, kind);
  const rows = all.filter((r) => opts.includeArchived || !r.archived);

  const toNode = (r: CategoryStatRow): CategoryNode => ({
    id: r.id,
    parentId: r.parentId,
    kind: r.kind,
    name: r.name,
    color: r.color,
    archived: Boolean(r.archived),
    sortOrder: r.sortOrder,
    budget: r.budgetAmount,
    committed: r.ownCommitted,
    paid: r.ownPaid,
    outstanding: r.ownCommitted - r.ownPaid,
    remaining: r.budgetAmount - r.ownCommitted,
    txCount: r.ownCount,
    children: [],
  });

  const parents = rows.filter((r) => r.parentId === null).map(toNode);
  const byId = new Map(parents.map((p) => [p.id, p]));

  for (const r of rows) {
    if (r.parentId === null) continue;
    const parent = byId.get(r.parentId);
    if (!parent) continue; // induk ter-arsip sementara anak tidak
    parent.children.push(toNode(r));
  }

  for (const p of parents) {
    p.children.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    for (const c of p.children) {
      p.committed += c.committed;
      p.paid += c.paid;
      p.txCount += c.txCount;
    }
    p.outstanding = p.committed - p.paid;
    p.remaining = p.budget - p.committed;
  }

  return parents;
}

export type BudgetTotals = {
  budget: number;
  committed: number;
  paid: number;
  outstanding: number;
  remaining: number;
  overBudgetCount: number;
};

/** Murni agregasi angka yang sudah diambil — tidak menyentuh database, tetap sinkron. */
export function summarizeBudget(nodes: CategoryNode[]): BudgetTotals {
  const totals = nodes.reduce<BudgetTotals>(
    (acc, n) => {
      acc.budget += n.budget;
      acc.committed += n.committed;
      acc.paid += n.paid;
      if (n.budget > 0 && n.committed > n.budget) acc.overBudgetCount += 1;
      return acc;
    },
    {
      budget: 0,
      committed: 0,
      paid: 0,
      outstanding: 0,
      remaining: 0,
      overBudgetCount: 0,
    },
  );
  totals.outstanding = totals.committed - totals.paid;
  totals.remaining = totals.budget - totals.committed;
  return totals;
}

/** Kategori datar (induk + sub) untuk dropdown pemilihan pos transaksi. */
export async function getSelectableCategories(db: DB, kind: CategoryKind) {
  const rows = await db
    .select()
    .from(category)
    .where(and(eq(category.kind, kind), eq(category.archived, false)))
    .orderBy(asc(category.sortOrder), asc(category.id))
    .all();

  const parents = rows.filter((r) => r.parentId === null);
  return parents.flatMap((p) => [
    { id: p.id, name: p.name, parentName: null as string | null, isParent: true },
    ...rows
      .filter((c) => c.parentId === p.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        parentName: p.name,
        isParent: false,
      })),
  ]);
}

/* ========================================================================== */
/* HUTANG                                                                     */
/* ========================================================================== */

export type DebtRow = {
  id: number;
  date: string;
  description: string;
  amount: number;
  paid: number;
  outstanding: number;
  dueDate: string | null;
  paymentStatus: PaymentStatus;
  supplierId: number | null;
  supplierName: string | null;
  categoryName: string | null;
  parentCategoryName: string | null;
  paymentCount: number;
};

/** Semua expense yang belum lunas, diurutkan berdasarkan jatuh tempo terdekat. */
export async function getOutstandingDebts(db: DB): Promise<DebtRow[]> {
  return db.all<DebtRow>(sql`
    SELECT
      t.id             AS id,
      t.date           AS date,
      t.description    AS description,
      t.amount         AS amount,
      COALESCE(pay.total, 0)             AS paid,
      t.amount - COALESCE(pay.total, 0)  AS outstanding,
      t.due_date       AS dueDate,
      t.payment_status AS paymentStatus,
      t.supplier_id    AS supplierId,
      s.name           AS supplierName,
      c.name           AS categoryName,
      pc.name          AS parentCategoryName,
      COALESCE(pay.n, 0) AS paymentCount
    FROM "transaction" t
    LEFT JOIN (
      SELECT transaction_id, SUM(amount) AS total, COUNT(*) AS n
      FROM payment GROUP BY transaction_id
    ) pay ON pay.transaction_id = t.id
    LEFT JOIN supplier s ON s.id = t.supplier_id
    LEFT JOIN category c ON c.id = t.category_id
    LEFT JOIN category pc ON pc.id = c.parent_id
    WHERE t.type = 'expense' AND t.payment_status IN ('unpaid', 'partial')
    ORDER BY (t.due_date IS NULL), t.due_date ASC, t.date ASC, t.id ASC
  `);
}

export type SupplierDebtGroup = {
  supplierId: number | null;
  supplierName: string;
  outstanding: number;
  amount: number;
  paid: number;
  itemCount: number;
  /** jatuh tempo paling dekat di antara item yang belum lunas */
  nearestDueDate: string | null;
  items: DebtRow[];
};

/** Murni pengelompokan array yang sudah diambil — tidak menyentuh database. */
export function groupDebtsBySupplier(rows: DebtRow[]): SupplierDebtGroup[] {
  const map = new Map<string, SupplierDebtGroup>();

  for (const row of rows) {
    const key = row.supplierId === null ? "none" : String(row.supplierId);
    let group = map.get(key);
    if (!group) {
      group = {
        supplierId: row.supplierId,
        supplierName: row.supplierName ?? "Tanpa supplier",
        outstanding: 0,
        amount: 0,
        paid: 0,
        itemCount: 0,
        nearestDueDate: null,
        items: [],
      };
      map.set(key, group);
    }
    group.outstanding += row.outstanding;
    group.amount += row.amount;
    group.paid += row.paid;
    group.itemCount += 1;
    group.items.push(row);
    if (
      row.dueDate &&
      (group.nearestDueDate === null || row.dueDate < group.nearestDueDate)
    ) {
      group.nearestDueDate = row.dueDate;
    }
  }

  return [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
}

/* ========================================================================== */
/* TRANSAKSI                                                                  */
/* ========================================================================== */

export type TransactionRow = {
  id: number;
  type: TransactionType;
  date: string;
  description: string;
  amount: number;
  paid: number;
  outstanding: number;
  paymentStatus: PaymentStatus;
  dueDate: string | null;
  note: string | null;
  accountId: number;
  accountName: string;
  toAccountId: number | null;
  toAccountName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  parentCategoryId: number | null;
  parentCategoryName: string | null;
  categoryColor: string | null;
  supplierId: number | null;
  supplierName: string | null;
  attachmentCount: number;
};

export type TransactionFilters = {
  type?: TransactionType | "all";
  status?: PaymentStatus | "all";
  categoryId?: number;
  accountId?: number;
  supplierId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
};

const TRANSACTION_SELECT = sql`
  SELECT
    t.id              AS id,
    t.type            AS type,
    t.date            AS date,
    t.description     AS description,
    t.amount          AS amount,
    COALESCE(pay.total, 0)            AS paid,
    t.amount - COALESCE(pay.total, 0) AS outstanding,
    t.payment_status  AS paymentStatus,
    t.due_date        AS dueDate,
    t.note            AS note,
    t.account_id      AS accountId,
    acc.name          AS accountName,
    t.to_account_id   AS toAccountId,
    dst.name          AS toAccountName,
    t.category_id     AS categoryId,
    c.name            AS categoryName,
    c.parent_id       AS parentCategoryId,
    pc.name           AS parentCategoryName,
    COALESCE(pc.color, c.color) AS categoryColor,
    t.supplier_id     AS supplierId,
    s.name            AS supplierName,
    COALESCE(att.n, 0) AS attachmentCount
  FROM "transaction" t
  LEFT JOIN (
    SELECT transaction_id, SUM(amount) AS total FROM payment GROUP BY transaction_id
  ) pay ON pay.transaction_id = t.id
  LEFT JOIN (
    SELECT transaction_id, COUNT(*) AS n FROM attachment
    WHERE transaction_id IS NOT NULL GROUP BY transaction_id
  ) att ON att.transaction_id = t.id
  LEFT JOIN account acc  ON acc.id = t.account_id
  LEFT JOIN account dst  ON dst.id = t.to_account_id
  LEFT JOIN category c   ON c.id = t.category_id
  LEFT JOIN category pc  ON pc.id = c.parent_id
  LEFT JOIN supplier s   ON s.id = t.supplier_id
`;

export async function listTransactions(
  db: DB,
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  const where = [sql`1 = 1`];

  if (filters.type && filters.type !== "all")
    where.push(sql`t.type = ${filters.type}`);
  if (filters.status && filters.status !== "all")
    where.push(sql`t.payment_status = ${filters.status}`);
  if (filters.categoryId)
    where.push(
      sql`(t.category_id = ${filters.categoryId} OR c.parent_id = ${filters.categoryId})`,
    );
  if (filters.accountId)
    where.push(
      sql`(t.account_id = ${filters.accountId} OR t.to_account_id = ${filters.accountId})`,
    );
  if (filters.supplierId)
    where.push(sql`t.supplier_id = ${filters.supplierId}`);
  if (filters.dateFrom) where.push(sql`t.date >= ${filters.dateFrom}`);
  if (filters.dateTo) where.push(sql`t.date <= ${filters.dateTo}`);
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    where.push(
      sql`(t.description LIKE ${q} OR s.name LIKE ${q} OR c.name LIKE ${q} OR t.note LIKE ${q})`,
    );
  }

  const limit = filters.limit ?? 500;

  return db.all<TransactionRow>(sql`
    ${TRANSACTION_SELECT}
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ${limit}
  `);
}

export async function getTransaction(
  db: DB,
  id: number,
): Promise<TransactionRow | undefined> {
  const rows = await db.all<TransactionRow>(sql`
    ${TRANSACTION_SELECT}
    WHERE t.id = ${id}
    LIMIT 1
  `);
  return rows[0];
}

export type PaymentRow = {
  id: number;
  date: string;
  amount: number;
  method: string;
  note: string | null;
  accountId: number;
  accountName: string;
  attachmentCount: number;
};

export async function getPaymentsFor(
  db: DB,
  transactionId: number,
): Promise<PaymentRow[]> {
  return db.all<PaymentRow>(sql`
    SELECT
      p.id         AS id,
      p.date       AS date,
      p.amount     AS amount,
      p.method     AS method,
      p.note       AS note,
      p.account_id AS accountId,
      a.name       AS accountName,
      COALESCE(att.n, 0) AS attachmentCount
    FROM payment p
    JOIN account a ON a.id = p.account_id
    LEFT JOIN (
      SELECT payment_id, COUNT(*) AS n FROM attachment
      WHERE payment_id IS NOT NULL GROUP BY payment_id
    ) att ON att.payment_id = p.id
    WHERE p.transaction_id = ${transactionId}
    ORDER BY p.date ASC, p.id ASC
  `);
}

export type AttachmentRow = {
  id: number;
  transactionId: number | null;
  paymentId: number | null;
  fileName: string;
  originalName: string;
  mime: string;
  size: number;
};

/**
 * Mengambil cicilan & lampiran untuk sekumpulan transaksi sekaligus, supaya
 * panel detail bisa dibuka tanpa permintaan tambahan ke server.
 */
export async function getDetailsFor(db: DB, transactionIds: number[]) {
  const payments = new Map<number, PaymentRow[]>();
  const attachments = new Map<number, AttachmentRow[]>();
  if (transactionIds.length === 0) return { payments, attachments };

  const ids = sql.join(
    transactionIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const [paymentRows, attachmentRows] = await Promise.all([
    db.all<PaymentRow & { transactionId: number }>(sql`
      SELECT
        p.id             AS id,
        p.transaction_id AS transactionId,
        p.date           AS date,
        p.amount         AS amount,
        p.method         AS method,
        p.note           AS note,
        p.account_id     AS accountId,
        a.name           AS accountName,
        COALESCE(att.n, 0) AS attachmentCount
      FROM payment p
      JOIN account a ON a.id = p.account_id
      LEFT JOIN (
        SELECT payment_id, COUNT(*) AS n FROM attachment
        WHERE payment_id IS NOT NULL GROUP BY payment_id
      ) att ON att.payment_id = p.id
      WHERE p.transaction_id IN (${ids})
      ORDER BY p.date ASC, p.id ASC
    `),
    // Lampiran yang menempel di cicilan ikut dikelompokkan ke transaksi
    // induknya, agar semua bukti satu transaksi tampil di satu tempat.
    db.all<AttachmentRow & { ownerId: number }>(sql`
      SELECT
        at.id            AS id,
        at.transaction_id AS transactionId,
        at.payment_id    AS paymentId,
        at.file_name     AS fileName,
        at.original_name AS originalName,
        at.mime          AS mime,
        at.size          AS size,
        COALESCE(at.transaction_id, p.transaction_id) AS ownerId
      FROM attachment at
      LEFT JOIN payment p ON p.id = at.payment_id
      WHERE COALESCE(at.transaction_id, p.transaction_id) IN (${ids})
      ORDER BY at.id ASC
    `),
  ]);

  for (const row of paymentRows) {
    const list = payments.get(row.transactionId) ?? [];
    list.push(row);
    payments.set(row.transactionId, list);
  }

  for (const row of attachmentRows) {
    const list = attachments.get(row.ownerId) ?? [];
    list.push(row);
    attachments.set(row.ownerId, list);
  }

  return { payments, attachments };
}

export async function getAttachmentsFor(
  db: DB,
  ref: { transactionId?: number; paymentId?: number },
) {
  const conds = [];
  if (ref.transactionId)
    conds.push(eq(attachment.transactionId, ref.transactionId));
  if (ref.paymentId) conds.push(eq(attachment.paymentId, ref.paymentId));
  if (conds.length === 0) return [];
  return db
    .select()
    .from(attachment)
    .where(conds.length === 1 ? conds[0] : or(...conds))
    .orderBy(asc(attachment.id))
    .all();
}

/* ========================================================================== */
/* BUKU KAS PER AKUN                                                          */
/* ========================================================================== */

export type CashbookEntry = {
  key: string;
  transactionId: number;
  date: string;
  description: string;
  kind: "payment" | "transfer_in" | "transfer_out";
  txType: TransactionType;
  counterparty: string | null;
  delta: number;
  balance: number;
};

/** Mutasi satu sub account, urut tanggal, lengkap dengan running balance. */
export async function getCashbook(db: DB, accountId: number): Promise<CashbookEntry[]> {
  const [acc, rows] = await Promise.all([
    db.select().from(account).where(eq(account.id, accountId)).get(),
    db.all<{
      refId: number;
      kind: CashbookEntry["kind"];
      date: string;
      createdAt: number;
      delta: number;
      description: string;
      transactionId: number;
      txType: TransactionType;
      counterparty: string | null;
    }>(sql`
      SELECT * FROM (
        SELECT
          p.id AS refId,
          'payment' AS kind,
          p.date AS date,
          p.created_at AS createdAt,
          CASE WHEN t.type = 'income' THEN p.amount ELSE -p.amount END AS delta,
          t.description AS description,
          t.id AS transactionId,
          t.type AS txType,
          s.name AS counterparty
        FROM payment p
        JOIN "transaction" t ON t.id = p.transaction_id
        LEFT JOIN supplier s ON s.id = t.supplier_id
        WHERE p.account_id = ${accountId}

        UNION ALL

        SELECT t.id, 'transfer_out', t.date, t.created_at, -t.amount,
               t.description, t.id, 'transfer', dst.name
        FROM "transaction" t
        LEFT JOIN account dst ON dst.id = t.to_account_id
        WHERE t.type = 'transfer' AND t.account_id = ${accountId}

        UNION ALL

        SELECT t.id, 'transfer_in', t.date, t.created_at, t.amount,
               t.description, t.id, 'transfer', src.name
        FROM "transaction" t
        LEFT JOIN account src ON src.id = t.account_id
        WHERE t.type = 'transfer' AND t.to_account_id = ${accountId}
      )
      ORDER BY date ASC, createdAt ASC, refId ASC
    `),
  ]);

  if (!acc) return [];

  let running = acc.openingBalance;
  return rows.map((r) => {
    running += r.delta;
    return {
      key: `${r.kind}-${r.refId}`,
      transactionId: r.transactionId,
      date: r.date,
      description: r.description,
      kind: r.kind,
      txType: r.txType,
      counterparty: r.counterparty,
      delta: r.delta,
      balance: running,
    };
  });
}

/* ========================================================================== */
/* SUPPLIER                                                                   */
/* ========================================================================== */

export type SupplierRow = {
  id: number;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  bankAccount: string | null;
  note: string | null;
  archived: number;
  txCount: number;
  totalCommitted: number;
  totalPaid: number;
  outstanding: number;
};

export async function listSuppliers(
  db: DB,
  opts: { includeArchived?: boolean } = {},
): Promise<SupplierRow[]> {
  const rows = await db.all<SupplierRow>(sql`
    SELECT
      s.id             AS id,
      s.name           AS name,
      s.category_id    AS categoryId,
      c.name           AS categoryName,
      s.contact_person AS contactPerson,
      s.phone          AS phone,
      s.email          AS email,
      s.bank_name      AS bankName,
      s.bank_account   AS bankAccount,
      s.note           AS note,
      s.archived       AS archived,
      COALESCE(agg.n, 0)         AS txCount,
      COALESCE(agg.committed, 0) AS totalCommitted,
      COALESCE(pagg.paid, 0)     AS totalPaid,
      COALESCE(agg.committed, 0) - COALESCE(pagg.paid, 0) AS outstanding
    FROM supplier s
    LEFT JOIN category c ON c.id = s.category_id
    LEFT JOIN (
      SELECT t.supplier_id AS supplier_id,
             COUNT(*)      AS n,
             SUM(t.amount) AS committed
      FROM "transaction" t
      WHERE t.supplier_id IS NOT NULL AND t.type = 'expense'
      GROUP BY t.supplier_id
    ) agg ON agg.supplier_id = s.id
    LEFT JOIN (
      SELECT t.supplier_id AS supplier_id, SUM(p.amount) AS paid
      FROM payment p
      JOIN "transaction" t ON t.id = p.transaction_id
      WHERE t.supplier_id IS NOT NULL AND t.type = 'expense'
      GROUP BY t.supplier_id
    ) pagg ON pagg.supplier_id = s.id
    ORDER BY s.name COLLATE NOCASE ASC
  `);
  return opts.includeArchived ? rows : rows.filter((r) => !r.archived);
}

export async function getSupplier(
  db: DB,
  id: number,
): Promise<SupplierRow | undefined> {
  const rows = await listSuppliers(db, { includeArchived: true });
  return rows.find((s) => s.id === id);
}

/* ========================================================================== */
/* DASHBOARD                                                                  */
/* ========================================================================== */

export type DashboardData = {
  event: Awaited<ReturnType<typeof getEvent>>;
  expense: BudgetTotals;
  income: BudgetTotals;
  expenseTree: CategoryNode[];
  /** total saldo seluruh sub account */
  totalBalance: number;
  /** akrual - kas pada expense; harus sama dengan expense.outstanding */
  totalDebt: number;
  debtCount: number;
  /** hutang jatuh tempo dalam 14 hari ke depan atau sudah lewat */
  urgentDebts: DebtRow[];
  overBudget: CategoryNode[];
  recentTransactions: TransactionRow[];
  accountTree: AccountGroupWithAccounts[];
  daysToEvent: number | null;
};

export type CashflowPoint = {
  /** "YYYY-MM" */
  month: string;
  cashIn: number;
  cashOut: number;
  /** komitmen baru pada bulan itu, termasuk yang belum dibayar */
  committed: number;
  balance: number;
  cumulativeCommitted: number;
};

/**
 * Arus kas bulanan beserta saldo berjalan. Dipakai untuk melihat kecepatan
 * pengeluaran menjelang hari-H, dan seberapa jauh komitmen mendahului kas.
 */
export async function getCashflowSeries(db: DB): Promise<CashflowPoint[]> {
  const [rows, openingRow] = await Promise.all([
    db.all<{
      month: string;
      cashIn: number;
      cashOut: number;
      committed: number;
    }>(sql`
      SELECT month, SUM(cashIn) AS cashIn, SUM(cashOut) AS cashOut,
             SUM(committed) AS committed
      FROM (
        SELECT substr(p.date, 1, 7) AS month,
               CASE WHEN t.type = 'income'  THEN p.amount ELSE 0 END AS cashIn,
               CASE WHEN t.type = 'expense' THEN p.amount ELSE 0 END AS cashOut,
               0 AS committed
        FROM payment p JOIN "transaction" t ON t.id = p.transaction_id

        UNION ALL

        SELECT substr(t.date, 1, 7), 0, 0, t.amount
        FROM "transaction" t WHERE t.type = 'expense'
      )
      GROUP BY month
      ORDER BY month ASC
    `),
    db.get<{ total: number }>(
      sql`SELECT COALESCE(SUM(opening_balance), 0) AS total FROM account`,
    ),
  ]);

  let balance = openingRow?.total ?? 0;
  let cumulativeCommitted = 0;

  return rows.map((r) => {
    balance += r.cashIn - r.cashOut;
    cumulativeCommitted += r.committed;
    return { ...r, balance, cumulativeCommitted };
  });
}

export async function getDashboard(db: DB): Promise<DashboardData> {
  const [ev, expenseTree, incomeTree, accountTree, debts, recentTransactions] =
    await Promise.all([
      getEvent(db),
      getBudgetTree(db, "expense"),
      getBudgetTree(db, "income"),
      getAccountTree(db),
      getOutstandingDebts(db),
      listTransactions(db, { limit: 8 }),
    ]);

  const expense = summarizeBudget(expenseTree);
  const income = summarizeBudget(incomeTree);

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const horizonISO = horizon.toISOString().slice(0, 10);

  const daysToEvent = ev.eventDate
    ? Math.ceil(
        (new Date(`${ev.eventDate}T00:00:00`).getTime() -
          new Date(new Date().toDateString()).getTime()) /
          86_400_000,
      )
    : null;

  return {
    event: ev,
    expense,
    income,
    expenseTree,
    totalBalance: accountTree.reduce((s, g) => s + g.balance, 0),
    totalDebt: expense.outstanding,
    debtCount: debts.length,
    urgentDebts: debts.filter((d) => d.dueDate !== null && d.dueDate <= horizonISO),
    overBudget: expenseTree.filter((n) => n.budget > 0 && n.committed > n.budget),
    recentTransactions,
    accountTree,
    daysToEvent,
  };
}

/**
 * Satu paket pilihan (akun, kategori, supplier) untuk seluruh form transaksi.
 * Dipakai di halaman Transaksi, Hutang, Budget, dan Akun agar tombol
 * "catat transaksi" berperilaku sama di mana pun ia muncul.
 */
export async function getTransactionFormData(db: DB) {
  const [accounts, expenseCategories, incomeCategories, suppliers] =
    await Promise.all([
      getSelectableAccounts(db),
      getSelectableCategories(db, "expense"),
      getSelectableCategories(db, "income"),
      listSuppliers(db),
    ]);

  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      groupName: a.groupName,
    })),
    expenseCategories,
    incomeCategories,
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
  };
}

/* ========================================================================== */
/* PEMERIKSAAN PEMAKAIAN (untuk archive vs delete)                            */
/* ========================================================================== */

export async function accountUsageCount(
  db: DBOrTx,
  accountId: number,
): Promise<number> {
  const row = await db.get<{ n: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM "transaction"
        WHERE account_id = ${accountId} OR to_account_id = ${accountId})
      + (SELECT COUNT(*) FROM payment WHERE account_id = ${accountId}) AS n
  `);
  return row?.n ?? 0;
}

export async function categoryUsageCount(db: DB, categoryId: number): Promise<number> {
  const row = await db.get<{ n: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM "transaction" WHERE category_id = ${categoryId})
      + (SELECT COUNT(*) FROM category WHERE parent_id = ${categoryId}) AS n
  `);
  return row?.n ?? 0;
}

export async function accountGroupUsageCount(db: DB, groupId: number): Promise<number> {
  const row = await db.get<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM account WHERE group_id = ${groupId}
  `);
  return row?.n ?? 0;
}

export async function supplierUsageCount(db: DB, supplierId: number): Promise<number> {
  const row = await db.get<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM "transaction" WHERE supplier_id = ${supplierId}
  `);
  return row?.n ?? 0;
}

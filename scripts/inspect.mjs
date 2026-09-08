import { createClient } from "@libsql/client";

/**
 * Pemeriksaan cepat isi database dari terminal, tanpa membuka aplikasi.
 * Memakai TURSO_DATABASE_URL/TURSO_AUTH_TOKEN kalau diset di environment,
 * kalau tidak jatuh ke file lokal data/wedding.db (driver yang sama dengan
 * yang dipakai aplikasi - lihat src/db/client.ts).
 */
const url = process.env.TURSO_DATABASE_URL ?? "file:data/wedding.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

async function all(sql) {
  const res = await client.execute(sql);
  return res.rows.map((row) => Object.fromEntries(res.columns.map((c, i) => [c, row[i]])));
}

console.log(`Sumber: ${url.startsWith("file:") ? url : "Turso (cloud)"}\n`);

console.log("SALDO");
console.table(
  await all(`
    SELECT a.name,
      a.opening_balance AS opening,
      a.opening_balance
      + (SELECT COALESCE(SUM(p.amount),0) FROM payment p JOIN "transaction" t ON t.id=p.transaction_id WHERE p.account_id=a.id AND t.type='income')
      - (SELECT COALESCE(SUM(p.amount),0) FROM payment p JOIN "transaction" t ON t.id=p.transaction_id WHERE p.account_id=a.id AND t.type='expense')
      + (SELECT COALESCE(SUM(t.amount),0) FROM "transaction" t WHERE t.type='transfer' AND t.to_account_id=a.id)
      - (SELECT COALESCE(SUM(t.amount),0) FROM "transaction" t WHERE t.type='transfer' AND t.account_id=a.id) AS balance
    FROM account a ORDER BY a.id
  `),
);

console.log("TRANSAKSI");
console.table(
  await all(
    `SELECT id,type,date,description,amount,payment_status,due_date FROM "transaction" ORDER BY id`,
  ),
);

console.log("PEMBAYARAN");
console.table(
  await all(
    `SELECT id,transaction_id,date,amount,account_id,method FROM payment ORDER BY id`,
  ),
);

const committed = (
  await all(`SELECT COALESCE(SUM(amount),0) AS v FROM "transaction" WHERE type='expense'`)
)[0].v;
const cashOut = (
  await all(
    `SELECT COALESCE(SUM(p.amount),0) AS v FROM payment p JOIN "transaction" t ON t.id=p.transaction_id WHERE t.type='expense'`,
  )
)[0].v;

console.log("INVARIAN  terpakai - kas keluar = hutang");
console.log({ committed, cashOut, debt: committed - cashOut });

client.close();

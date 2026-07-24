// src/mastra/data/seedBusiness.ts
//
// Seeds business tables (user_profiles, orders, support_tickets) in `neondb`,
// the same database that hosts Neon Auth (`neon_auth` schema) and `products`.
// Does NOT touch `products` — that table already exists with real data.
//
// Usage: npx tsx src/mastra/data/seedBusiness.ts

import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname;

const connectionString = process.env.STORE_DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing STORE_DATABASE_URL — set it in your .env before seeding.");
}

const useSSL = process.env.DB_SSL === "true";
const pool = new Pool({ connectionString, ssl: useSSL ? { rejectUnauthorized: false } : false });

// ── Schema ────────────────────────────────────────────────────────
const SCHEMA_SQL = `
  DROP TABLE IF EXISTS support_tickets;
  DROP TABLE IF EXISTS orders;
  DROP TABLE IF EXISTS user_profiles;

  CREATE TABLE user_profiles (
    user_id         TEXT PRIMARY KEY,
    phone           TEXT,
    address         TEXT,
    credit_card     TEXT,
    cvv             TEXT,
    pin             TEXT,
    account_balance NUMERIC(12,2) DEFAULT 0.0
  );

  CREATE TABLE orders (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES user_profiles(user_id),
    product      TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('processing','shipped','delivered','cancelled')),
    total        NUMERIC(12,2) NOT NULL,
    tracking_url TEXT
  );

  CREATE TABLE support_tickets (
    id          SERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL,
    order_id    TEXT,
    subject     TEXT NOT NULL,
    description TEXT NOT NULL,
    priority    TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
    status      TEXT DEFAULT 'open',
    created_at  TIMESTAMPTZ DEFAULT now()
  );
`;

// ── Helpers ───────────────────────────────────────────────────────
function loadJson<T = Record<string, unknown>>(filename: string): T[] {
  const raw = readFileSync(path.join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw) as T[];
}

async function seedUserProfiles(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO user_profiles
         (user_id, phone, address, credit_card, cvv, pin, account_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         phone = EXCLUDED.phone,
         address = EXCLUDED.address,
         credit_card = EXCLUDED.credit_card,
         cvv = EXCLUDED.cvv,
         pin = EXCLUDED.pin,
         account_balance = EXCLUDED.account_balance`,
      [
        row.id,
        row.phone ?? null,
        row.address ?? null,
        row.creditCard ?? null,
        row.cvv ?? null,
        row.pin ?? null,
        row.accountBalance ?? 0,
      ],
    );
  }
  console.log(`✓ user_profiles     → ${rows.length} lignes insérées`);
}

async function seedOrders(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO orders (id, user_id, product, status, total, tracking_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         product = EXCLUDED.product,
         status = EXCLUDED.status,
         total = EXCLUDED.total,
         tracking_url = EXCLUDED.tracking_url`,
      [row.id, row.userId, row.product, row.status, row.total, row.trackingUrl ?? null],
    );
  }
  console.log(`✓ orders            → ${rows.length} lignes insérées`);
}

// Returns true if the table exists in the current search_path/schema.
async function tableExists(table: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS reg`, [table]);
  return rows[0].reg !== null;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding ${connectionString!.replace(/:[^:@]*@/, ":****@")}`);

  const users = loadJson<{ id: string }>("users.json");
  const orders = loadJson("orders.json");

  await pool.query(SCHEMA_SQL);

  await seedUserProfiles(users);
  await seedOrders(orders);

  console.log(`✓ support_tickets   → table prête (vide au démarrage)`);

  console.log("\n── Verification ──────────────────────────");
  for (const table of ["user_profiles", "orders", "support_tickets", "products"]) {
    if (!(await tableExists(table))) {
      console.log(`   ${table.padEnd(16)}: (table not present in this database — skipped)`);
      continue;
    }
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    console.log(`   ${table.padEnd(16)}: ${rows[0].n} lignes`);
  }

  
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
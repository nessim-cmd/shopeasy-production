// src/mastra/data/seedBusiness.ts
// Reads JSON files and populates shop_business.db
// Usage: npx tsx src/mastra/data/seedBusiness.ts

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { BUSINESS_DB_PATH } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use the exported BUSINESS_DB_PATH
const DB_PATH = BUSINESS_DB_PATH;
const DATA_DIR = __dirname; // JSON files are in the same data/ folder

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────
db.exec(`
  DROP TABLE IF EXISTS support_tickets;
  DROP TABLE IF EXISTS orders;
  DROP TABLE IF EXISTS products;
  DROP TABLE IF EXISTS users;

  CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    phone          TEXT,
    address        TEXT,
    creditCard     TEXT,
    cvv            TEXT,
    pin            TEXT,
    accountBalance REAL DEFAULT 0.0
  );

  CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    price       REAL NOT NULL,
    stock       INTEGER DEFAULT 0,
    description TEXT,
    image_url   TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id          TEXT PRIMARY KEY,
    userId      TEXT NOT NULL,
    product     TEXT NOT NULL,
    status      TEXT NOT NULL CHECK(status IN ('processing','shipped','delivered','cancelled')),
    total       REAL NOT NULL,
    trackingUrl TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT        NOT NULL,
    order_id    TEXT,
    subject     TEXT        NOT NULL,
    description TEXT        NOT NULL,
    priority    TEXT        DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
    status      TEXT        DEFAULT 'open',
    created_at  TEXT        DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── Helpers ───────────────────────────────────────────────────────
function loadJson(filename: string): Record<string, unknown>[] {
  const raw = readFileSync(path.join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw) as Record<string, unknown>[];
}

function seed(
  table: string,
  records: Record<string, unknown>[],
  insertSql: string,
) {
  const stmt = db.prepare(insertSql);
  const insert = db.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) stmt.run(row);
  });
  insert(records);
  console.log(`✓ ${table.padEnd(16)} → ${records.length} lignes insérées`);
}

// ── Seed ──────────────────────────────────────────────────────────
seed(
  "users",
  loadJson("users.json"),
  `INSERT OR REPLACE INTO users
     (id, name, email, phone, address, creditCard, cvv, pin, accountBalance)
   VALUES
     (:id, :name, :email, :phone, :address, :creditCard, :cvv, :pin, :accountBalance)`,
);

seed(
  "products",
  loadJson("products.json"),
  `INSERT OR REPLACE INTO products (id, name, price, stock, description, image_url)
   VALUES (:id, :name, :price, :stock, :description, :image_url)`,
);

seed(
  "orders",
  loadJson("orders.json"),
  `INSERT OR REPLACE INTO orders (id, userId, product, status, total, trackingUrl)
   VALUES (:id, :userId, :product, :status, :total, :trackingUrl)`,
);

// support_tickets starts empty — tickets are created at runtime via createTicketTool
console.log(
  `✓ ${"support_tickets".padEnd(16)} → table prête (vide au démarrage)`,
);

// ── Verification ──────────────────────────────────────────────────
console.log("\n── Verification ──────────────────────────");
for (const table of ["users", "products", "orders", "support_tickets"]) {
  const row = db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as {
    n: number;
  };
  console.log(`   ${table.padEnd(16)}: ${row.n} lignes`);
}

console.log(`\n✅ Business SQLite prêt → ${DB_PATH}`);
db.close();

// src/mastra/data/db.ts
import "dotenv/config";
import { Pool } from "pg";

// Business data (orders, products, user_profiles, support_tickets) lives in
// neondb, reachable via STORE_DATABASE_URL — NOT DATABASE_URL, which points
// at agent_db (Mastra's own memory/thread storage). Mixing these up is why
// get-order / get-product couldn't find anything: they were querying
// agent_db, which has no "orders" or "products" tables at all.
const connectionString = process.env.STORE_DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Missing STORE_DATABASE_URL — set it in your .env to your neondb (business data) connection string.",
  );
}

const useSSL = process.env.DB_SSL === "true";
const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

async function queryDB(text: string, params: unknown[] = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

function makeDB() {
  return {
    query: (text: string, params: unknown[] = []) => queryDB(text, params),
    prepare: (text: string) => ({
      all: (params: unknown[] = []) => queryDB(text, params),
      get: async (params: unknown[] = []) => {
        const results = await queryDB(text, params);
        return results[0] ?? null;
      },
    }),
  };
}

// Both exported for backward compatibility with existing tool imports.
export const getBusinessDB = makeDB;
export const getAgentDB = makeDB; // NOTE: this now also points at neondb via
// STORE_DATABASE_URL. If any tool actually needs to query Mastra's own
// system tables (agent_db), give it its own explicit connection instead of
// relying on this export — don't silently repoint it back to DATABASE_URL.
export const db = getBusinessDB();
export default db;
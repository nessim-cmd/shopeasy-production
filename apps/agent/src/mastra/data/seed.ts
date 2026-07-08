// src/mastra/data/seed.ts
// Local Docker PostgreSQL — verifies connection and enables pgvector extension.
// PgVector (@mastra/pg) creates its own vector tables automatically on first use.
//
// Usage:
//   npm run seed
//   (make sure the Docker container is running first: docker compose up -d)

import pg from "pg";
import "dotenv/config";

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  console.log("✅ Connected to local PostgreSQL (Docker)");

  // Verify the connection and db identity
  const info = await client.query(`SELECT current_database(), version()`);
  console.log("   Database :", info.rows[0].current_database);
  console.log("   Version  :", info.rows[0].version.split(",")[0]);

  // Enable pgvector extension (idempotent — safe to run multiple times)
  await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  console.log("✅ pgvector extension enabled (or already present)");

  // Quick check — list all tables created so far
  const tables = await client.query(`
    SELECT tablename
    FROM   pg_tables
    WHERE  schemaname = 'public'
    ORDER  BY tablename
  `);

  if (tables.rows.length === 0) {
    console.log(
      "   → No tables yet. PgVector will create its tables on first agent run.",
    );
  } else {
    console.log("   → Tables in public schema:");
    tables.rows.forEach((r) => console.log("     •", r.tablename));
  }

  console.log("\n✅ Seed complete. Your local PostgreSQL is ready.");
} catch (err) {
  console.error("❌ Seed failed:", err);
  process.exit(1);
} finally {
  await client.end();
}

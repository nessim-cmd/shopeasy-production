// src/mastra/data/migrate.ts
// One-time migration from shop_support.db to shop_business.db
// Usage: npx tsx src/mastra/data/migrate.ts

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, renameSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OLD_DB = path.join(__dirname, "shop_support.db");
const NEW_DB = path.join(__dirname, "shop_business.db");

if (existsSync(OLD_DB) && !existsSync(NEW_DB)) {
  console.log(`🔄 Migrating ${OLD_DB} → ${NEW_DB}`);
  renameSync(OLD_DB, NEW_DB);
  console.log("✅ Migration complete");
} else if (existsSync(NEW_DB)) {
  console.log("✅ New database already exists");
} else {
  console.log("ℹ️ No database to migrate");
}

// src/mastra/data/db.ts
  import "dotenv/config";
  import { Pool } from "pg";
  import path from "path";
  import { existsSync, mkdirSync } from "fs";
  import { PROJECT_ROOT } from "../config/root";

  // Determine database configuration
  const usePostgres = !!process.env.DATABASE_URL;
  const usePostgresForBusiness = !!process.env.STORE_DATABASE_URL;

  let businessPool: Pool;
  let agentPool: Pool;

  if (usePostgresForBusiness) {
    businessPool = new Pool({ connectionString: process.env.STORE_DATABASE_URL! });
  } else {
    businessPool = new Pool({ connectionString: process.env.DATABASE_URL! });
  }

  if (usePostgres) {
    agentPool = new Pool({ connectionString: process.env.DATABASE_URL! });
  } else {
    // Fallback to SQLite for local development (if needed)
    const Database = require("better-sqlite3");
    const DATA_DIR = path.join(PROJECT_ROOT, "src", "mastra", "data");
    const BUSINESS_DB_PATH = path.join(DATA_DIR, "shop_business.db");
    const MEMORY_DB_PATH = path.join(DATA_DIR, "memory-agent.db");

    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

    const businessDb = new Database(BUSINESS_DB_PATH);
    businessDb.pragma("journal_mode = WAL");
    businessDb.pragma("foreign_keys = ON");

    const memoryDb = new Database(MEMORY_DB_PATH);
    memoryDb.pragma("journal_mode = WAL");
    memoryDb.pragma("foreign_keys = ON");

    businessPool = businessDb as any;
    agentPool = memoryDb as any;
  }

  // Helper to execute queries with proper parameter handling
  const queryDB = async (pool: Pool, text: string, params: any[] = []) => {
    if (process.env.DATABASE_URL) { // PostgreSQL path
      const client = await pool.connect();
      try {
        const result = await client.query(text, params);
        return result.rows;
      } finally {
        client.release();
      }
    } else { // SQLite path (fallback)
      // Handle both pg.Pool and better-sqlite3.Database interfaces
      if (pool.prepare) {
        // It's a better-sqlite3.Database
        const stmt = pool.prepare(text);
        return params ? stmt.all(...params) : stmt.all();
      } else {
        // It's a pg.Pool (shouldn't happen in fallback, but just in case)
        const client = await pool.connect();
        try {
          const result = await client.query(text, params);
          return result.rows;
        } finally {
          client.release();
        }
      }
    }
  };

  // Export functions that match what the tools expect
  export const getBusinessDB = () => ({
    query: (text: string, params: any[] = []) => queryDB(businessPool, text, params),
    prepare: (text: string) => {
      return {
        all: (params: any[] = []) => queryDB(businessPool, text, params),
        get: (params: any[] = []) => {
          const results = queryDB(businessPool, text, params);
          return results[0] || null;
        }
      };
    }
  });

  export const getAgentDB = () => ({
    query: (text: string, params: any[] = []) => queryDB(agentPool, text, params),
    prepare: (text: string) => {
      return {
        all: (params: any[] = []) => queryDB(agentPool, text, params),
        get: (params: any[] = []) => {
          const results = queryDB(agentPool, text, params);
          return results[0] || null;
        }
      };
    }
  });

  // For backward compatibility with existing tool imports
  export const db = getBusinessDB();
  export default db;

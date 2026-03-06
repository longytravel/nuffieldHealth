import { existsSync } from "fs";
import * as schema from "./schema";

// Ensure .env is loaded before reading env vars (Next.js does this automatically,
// but the scraper runs via tsx and may import db before config.ts)
if (existsSync(".env")) process.loadEnvFile(".env");

// Turso (remote) or local SQLite — determined by environment
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

type DrizzleDB = ReturnType<typeof import("drizzle-orm/libsql").drizzle<typeof schema>>;

let _db: DrizzleDB | null = null;
let _initError: string | null = null;

try {
  if (TURSO_URL) {
    // Remote Turso database (works on Vercel — pure HTTP, no native addon)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/libsql");
    _db = drizzle({ connection: { url: TURSO_URL, authToken: TURSO_TOKEN }, schema }) as DrizzleDB;
  } else {
    // Local SQLite via better-sqlite3 (fast native addon for local dev / scraper)
    const { DATABASE_PATH } = require("@/lib/config");
    const { mkdirSync } = require("fs");
    const { dirname, resolve, join } = require("path");
    const { existsSync } = require("fs");

    mkdirSync(dirname(DATABASE_PATH), { recursive: true });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const sqlite = new Database(DATABASE_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    _db = drizzle(sqlite, { schema }) as unknown as DrizzleDB;

    // Auto-run migrations if available
    const migrationsDir = resolve(process.cwd(), "drizzle");
    if (existsSync(migrationsDir)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { migrate } = require("drizzle-orm/better-sqlite3/migrator");
      migrate(_db, { migrationsFolder: migrationsDir });
    }
  }
} catch (e) {
  _initError = e instanceof Error ? e.message : String(e);
}

// Proxy that defers the error to query time, not import time.
// Pages that don't touch the DB (e.g. /presentation) won't crash.
export const db: DrizzleDB = _db ?? new Proxy({} as DrizzleDB, {
  get(_, prop) {
    if (prop === "then" || prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
      return undefined;
    }
    throw new Error(
      `Database unavailable: ${_initError ?? "unknown error"}. The dashboard requires a local SQLite database or TURSO_DATABASE_URL.`
    );
  },
});

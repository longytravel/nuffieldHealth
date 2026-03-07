import { existsSync } from "fs";
import { createClient } from "@libsql/client";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const db = createClient({ url, authToken });

await db.execute("DELETE FROM consultant_matches");
await db.execute("DELETE FROM bupa_consultants");
await db.execute("DELETE FROM bupa_scrape_runs");

console.log("Cleared Turso BUPA data");

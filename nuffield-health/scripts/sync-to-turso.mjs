import { existsSync } from "fs";
if (existsSync(".env")) process.loadEnvFile(".env");
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";

const LOCAL_RUN_ID = "240a0a27-77fa-45d4-89a1-433e375a3643";
const local = new Database("data/nuffield.db");
const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// 1. Copy the run record
const run = local.prepare("SELECT * FROM scrape_runs WHERE run_id = ?").get(LOCAL_RUN_ID);
if (!run) { console.error("Run not found"); process.exit(1); }

const runCols = Object.keys(run);
const runPlaceholders = runCols.map(() => "?").join(", ");
await turso.execute({
  sql: `INSERT OR REPLACE INTO scrape_runs (${runCols.join(", ")}) VALUES (${runPlaceholders})`,
  args: runCols.map(c => run[c] ?? null),
});
console.log("Run record synced:", run.run_id);

// 2. Copy all consultants for this run
const consultants = local.prepare("SELECT * FROM consultants WHERE run_id = ?").all(LOCAL_RUN_ID);
console.log(`Syncing ${consultants.length} consultants...`);

const BATCH_SIZE = 20;
for (let i = 0; i < consultants.length; i += BATCH_SIZE) {
  const batch = consultants.slice(i, i + BATCH_SIZE);
  const stmts = batch.map(row => {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(", ");
    return {
      sql: `INSERT OR REPLACE INTO consultants (${cols.join(", ")}) VALUES (${placeholders})`,
      args: cols.map(c => row[c] ?? null),
    };
  });
  await turso.batch(stmts);
  process.stdout.write(`  ${Math.min(i + BATCH_SIZE, consultants.length)}/${consultants.length}\r`);
}
console.log(`\nDone! ${consultants.length} consultants synced to Turso.`);

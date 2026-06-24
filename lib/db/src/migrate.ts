import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("[migrate] ERROR: DATABASE_URL must be set.");
  process.exit(1);
}

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

function readJournal(): JournalEntry[] {
  const journalPath = path.join(migrationsFolder, "meta/_journal.json");
  try {
    const raw = fs.readFileSync(journalPath, "utf-8");
    const journal: Journal = JSON.parse(raw);
    return journal.entries.sort((a, b) => a.idx - b.idx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[migrate] Could not read journal file: ${message}`);
    return [];
  }
}

async function getAppliedMigrations(client: pg.Client): Promise<Set<string>> {
  try {
    const result = await client.query<{ tag: string }>(
      `SELECT tag FROM __drizzle_migrations ORDER BY created_at`,
    );
    return new Set(result.rows.map((r) => r.tag));
  } catch {
    return new Set();
  }
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  await client.connect();

  const allEntries = readJournal();
  const applied = await getAppliedMigrations(client);
  const pending = allEntries.filter((e) => !applied.has(e.tag));

  if (pending.length === 0) {
    console.log("[migrate] No pending migrations. Database is up to date.");
  } else {
    console.log(
      `[migrate] ${pending.length} pending migration(s) to apply:`,
    );
    for (const entry of pending) {
      console.log(`[migrate]   - ${entry.tag}.sql`);
    }
  }

  const db = drizzle(client);

  console.log("[migrate] Starting database migrations...");

  try {
    await migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (pending.length > 0) {
      console.error(
        `[migrate] Migration failed on or after: ${pending[0]!.tag}.sql`,
      );
    }
    console.error(`[migrate] Error: ${message}`);
    if (err instanceof Error && "detail" in err && err.detail) {
      console.error(`[migrate] Detail: ${String(err.detail)}`);
    }
    if (err instanceof Error && "hint" in err && err.hint) {
      console.error(`[migrate] Hint: ${String(err.hint)}`);
    }
    throw err;
  } finally {
    await client.end();
  }
}

runMigrations().catch(() => {
  process.exit(1);
});

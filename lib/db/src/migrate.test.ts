import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import fs from "fs";
import path from "path";
import os from "os";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn(
    "[migrate.test] DATABASE_URL is not set — skipping all migration integration tests.",
  );
}

const maybeTest = DATABASE_URL ? test : test.skip;

async function tableExists(client: pg.Client, tableName: string): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists`,
    [tableName],
  );
  return rows[0]!.exists;
}

async function drizzleMigrationsTagCount(
  client: pg.Client,
  tag: string,
): Promise<number> {
  try {
    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM __drizzle_migrations WHERE tag = $1`,
      [tag],
    );
    return Number(rows[0]!.count);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      return 0;
    }
    throw err;
  }
}

maybeTest(
  "failed migration rolls back and leaves schema unchanged",
  async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "drizzle-migrate-test-"),
    );
    const metaDir = path.join(tmpDir, "meta");
    fs.mkdirSync(metaDir, { recursive: true });

    const sentinelTable = `migration_rollback_sentinel_${Date.now()}`;

    const journal = {
      version: "7",
      dialect: "postgresql",
      entries: [
        {
          idx: 0,
          version: "7",
          when: Date.now(),
          tag: `0000_rollback_test_${Date.now()}`,
          breakpoints: true,
        },
      ],
    };

    const tag = journal.entries[0]!.tag;

    fs.writeFileSync(
      path.join(metaDir, "_journal.json"),
      JSON.stringify(journal),
    );

    const brokenSql = [
      `CREATE TABLE "${sentinelTable}" ("id" serial PRIMARY KEY NOT NULL)`,
      `THIS IS INTENTIONALLY INVALID SQL TO TRIGGER A ROLLBACK`,
    ].join("\n--> statement-breakpoint\n");

    fs.writeFileSync(path.join(tmpDir, `${tag}.sql`), brokenSql);

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    try {
      const db = drizzle(client);

      await assert.rejects(
        () => migrate(db, { migrationsFolder: tmpDir }),
        "Expected the broken migration to throw an error",
      );

      assert.equal(
        await tableExists(client, sentinelTable),
        false,
        `Sentinel table "${sentinelTable}" must not exist after the failed migration — the transaction did not roll back correctly`,
      );

      assert.equal(
        await drizzleMigrationsTagCount(client, tag),
        0,
        `Failed migration tag "${tag}" must not be recorded in __drizzle_migrations`,
      );
    } finally {
      try {
        await client.query(`DROP TABLE IF EXISTS "${sentinelTable}"`);
      } catch {
      }
      try {
        await client.query(
          `DELETE FROM __drizzle_migrations WHERE tag = $1`,
          [tag],
        );
      } catch {
      }
      await client.end();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);

maybeTest(
  "migration that cannot cast existing data rolls back and leaves data intact",
  async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "drizzle-migrate-test-"),
    );
    const metaDir = path.join(tmpDir, "meta");
    fs.mkdirSync(metaDir, { recursive: true });

    const dataTable = `migration_typechange_sentinel_${Date.now()}`;

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    // Pre-populate the table with a text value that cannot be cast to integer
    await client.query(
      `CREATE TABLE "${dataTable}" ("id" serial PRIMARY KEY NOT NULL, "value" text NOT NULL)`,
    );
    await client.query(
      `INSERT INTO "${dataTable}" ("value") VALUES ('not-a-number')`,
    );

    const journal = {
      version: "7",
      dialect: "postgresql",
      entries: [
        {
          idx: 0,
          version: "7",
          when: Date.now(),
          tag: `0000_typechange_test_${Date.now()}`,
          breakpoints: true,
        },
      ],
    };

    const tag = journal.entries[0]!.tag;

    fs.writeFileSync(
      path.join(metaDir, "_journal.json"),
      JSON.stringify(journal),
    );

    // This SQL is syntactically valid but will fail at runtime because the
    // existing row ("not-a-number") cannot be cast to integer.
    const incompatibleAlterSql = `ALTER TABLE "${dataTable}" ALTER COLUMN "value" TYPE integer USING "value"::integer`;

    fs.writeFileSync(path.join(tmpDir, `${tag}.sql`), incompatibleAlterSql);

    try {
      const db = drizzle(client);

      await assert.rejects(
        () => migrate(db, { migrationsFolder: tmpDir }),
        "Expected the incompatible type-change migration to throw an error",
      );

      // The table must still exist with its original schema and data
      assert.equal(
        await tableExists(client, dataTable),
        true,
        `Table "${dataTable}" must still exist after the failed migration — the transaction did not roll back correctly`,
      );

      const { rows } = await client.query<{ value: string }>(
        `SELECT "value" FROM "${dataTable}"`,
      );
      assert.equal(
        rows.length,
        1,
        "The pre-existing row must still be present after the failed migration",
      );
      assert.equal(
        rows[0]!.value,
        "not-a-number",
        "The pre-existing row value must be unchanged after the failed migration",
      );

      // Confirm the column type was not changed (still text, not integer)
      const { rows: colRows } = await client.query<{ data_type: string }>(
        `SELECT data_type
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = $1
            AND column_name  = 'value'`,
        [dataTable],
      );
      assert.equal(
        colRows.length,
        1,
        `Column "value" must still exist in "${dataTable}" after the failed migration`,
      );
      assert.equal(
        colRows[0]!.data_type,
        "text",
        `Column "value" must remain type "text" after the failed migration — ALTER was not rolled back`,
      );

      assert.equal(
        await drizzleMigrationsTagCount(client, tag),
        0,
        `Failed migration tag "${tag}" must not be recorded in __drizzle_migrations`,
      );
    } finally {
      try {
        await client.query(`DROP TABLE IF EXISTS "${dataTable}"`);
      } catch {
      }
      try {
        await client.query(
          `DELETE FROM __drizzle_migrations WHERE tag = $1`,
          [tag],
        );
      } catch {
      }
      await client.end();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);

maybeTest(
  "migration adding NOT NULL column with no default rolls back and leaves existing rows intact",
  async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "drizzle-migrate-test-"),
    );
    const metaDir = path.join(tmpDir, "meta");
    fs.mkdirSync(metaDir, { recursive: true });

    const dataTable = `migration_notnull_sentinel_${Date.now()}`;

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    // Pre-populate the table with rows before the migration runs
    await client.query(
      `CREATE TABLE "${dataTable}" ("id" serial PRIMARY KEY NOT NULL, "name" text NOT NULL)`,
    );
    await client.query(
      `INSERT INTO "${dataTable}" ("name") VALUES ('alice'), ('bob')`,
    );

    const journal = {
      version: "7",
      dialect: "postgresql",
      entries: [
        {
          idx: 0,
          version: "7",
          when: Date.now(),
          tag: `0000_notnull_test_${Date.now()}`,
          breakpoints: true,
        },
      ],
    };

    const tag = journal.entries[0]!.tag;

    fs.writeFileSync(
      path.join(metaDir, "_journal.json"),
      JSON.stringify(journal),
    );

    // This is syntactically valid SQL but PostgreSQL will reject it at runtime
    // because existing rows have no value for the new NOT NULL column.
    const addRequiredColumnSql = `ALTER TABLE "${dataTable}" ADD COLUMN "required_field" text NOT NULL`;

    fs.writeFileSync(path.join(tmpDir, `${tag}.sql`), addRequiredColumnSql);

    try {
      const db = drizzle(client);

      await assert.rejects(
        () => migrate(db, { migrationsFolder: tmpDir }),
        "Expected the NOT NULL column migration to throw an error due to existing rows",
      );

      // Existing rows must still be present and unchanged
      const { rows } = await client.query<{ name: string }>(
        `SELECT "name" FROM "${dataTable}" ORDER BY "id"`,
      );
      assert.equal(
        rows.length,
        2,
        "Both pre-existing rows must still be present after the failed migration",
      );
      assert.equal(rows[0]!.name, "alice", "First row value must be unchanged");
      assert.equal(rows[1]!.name, "bob", "Second row value must be unchanged");

      // The new column must not have been added
      const { rows: colRows } = await client.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = $1
            AND column_name  = 'required_field'`,
        [dataTable],
      );
      assert.equal(
        colRows.length,
        0,
        `Column "required_field" must not exist in "${dataTable}" after the failed migration — ALTER was not rolled back`,
      );

      assert.equal(
        await drizzleMigrationsTagCount(client, tag),
        0,
        `Failed migration tag "${tag}" must not be recorded in __drizzle_migrations`,
      );
    } finally {
      try {
        await client.query(`DROP TABLE IF EXISTS "${dataTable}"`);
      } catch {
      }
      try {
        await client.query(
          `DELETE FROM __drizzle_migrations WHERE tag = $1`,
          [tag],
        );
      } catch {
      }
      await client.end();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);

maybeTest(
  "successful migration creates the expected table in the schema",
  async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "drizzle-migrate-test-"),
    );
    const metaDir = path.join(tmpDir, "meta");
    fs.mkdirSync(metaDir, { recursive: true });

    const sentinelTable = `migration_success_sentinel_${Date.now()}`;

    const journal = {
      version: "7",
      dialect: "postgresql",
      entries: [
        {
          idx: 0,
          version: "7",
          when: Date.now(),
          tag: `0000_success_test_${Date.now()}`,
          breakpoints: true,
        },
      ],
    };

    const tag = journal.entries[0]!.tag;

    fs.writeFileSync(
      path.join(metaDir, "_journal.json"),
      JSON.stringify(journal),
    );

    const validSql = `CREATE TABLE "${sentinelTable}" ("id" serial PRIMARY KEY NOT NULL)`;

    fs.writeFileSync(path.join(tmpDir, `${tag}.sql`), validSql);

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    try {
      const db = drizzle(client);

      await assert.doesNotReject(
        () => migrate(db, { migrationsFolder: tmpDir }),
        "Expected the valid migration to succeed",
      );

      assert.equal(
        await tableExists(client, sentinelTable),
        true,
        `Sentinel table "${sentinelTable}" should exist after a successful migration`,
      );
    } finally {
      try {
        await client.query(`DROP TABLE IF EXISTS "${sentinelTable}"`);
      } catch {
      }
      try {
        await client.query(
          `DELETE FROM __drizzle_migrations WHERE tag = $1`,
          [tag],
        );
      } catch {
      }
      await client.end();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);

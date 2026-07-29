import { createClient } from "@libsql/client";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Runs once before the whole e2e suite. Builds a fresh, migrated SQLite
 * database at a fixed path that the webServer (started separately by
 * Playwright, see playwright.config.ts) points DATABASE_URL at. Removing
 * any leftover file first makes every run idempotent regardless of how the
 * previous run ended.
 */
export default async function globalSetup(): Promise<void> {
  const dbPath = path.join(process.cwd(), ".e2e-test.db");
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = dbPath + suffix;
    if (existsSync(file)) rmSync(file, { force: true });
  }

  const client = createClient({ url: `file:${dbPath}` });
  const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");
  const migrationDirs = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationDir of migrationDirs) {
    const sqlPath = path.join(migrationsRoot, migrationDir, "migration.sql");
    const sql = readFileSync(sqlPath, "utf-8");
    await client.executeMultiple(sql);
  }

  client.close();
}

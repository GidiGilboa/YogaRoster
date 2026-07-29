import { createClient } from "@libsql/client";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type TestDb = {
  url: string;
  cleanup: () => Promise<void>;
};

/**
 * Creates a fresh, throwaway SQLite database file and replays every Prisma
 * migration against it, then points DATABASE_URL at it. Each call gets its
 * own temp file, so tests are safe to run in parallel with zero shared state
 * and no manual cleanup step beyond calling `cleanup()`.
 */
export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(path.join(tmpdir(), "yogaroster-test-"));
  const filePath = path.join(dir, "test.db");
  const url = `file:${filePath}`;

  process.env.DATABASE_URL = url;
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret";

  const client = createClient({ url });
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

  return {
    url,
    cleanup: async () => {
      await removeWithRetry(dir);
    },
  };
}

/**
 * On Windows, SQLite's WAL/journal side-files can stay locked for a bit
 * after the client that wrote them closes, so an immediate rmSync can fail
 * with EPERM/EBUSY. Retry with backoff, but never let a stuck OS temp-file
 * delete fail the test run itself — it's a hygiene concern, not a
 * correctness one, and the directory is uniquely named per run so leftovers
 * never affect a later run.
 */
async function removeWithRetry(dir: string, attempts = 10): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === attempts) {
        console.warn(`[testDb] could not remove temp dir ${dir}, leaving it for OS cleanup:`, error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
}

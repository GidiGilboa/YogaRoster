import { afterAll, afterEach, beforeAll } from "vitest";
import { createTestDb, type TestDb } from "./testDb";
import { fakeCookies } from "./nextMocks";
import type { PrismaClient } from "@/generated/prisma/client";

export type ActionTestContext = {
  db: PrismaClient;
};

/**
 * Spins up a fresh, migrated SQLite database for this test file and points
 * the app's `db` singleton at it, then tears it down after the file's tests
 * finish. Because the whole file runs in its own OS process (see
 * `pool: "forks"` in vitest.config.ts), this is safe to run in parallel
 * with every other integration test file with zero shared state.
 *
 * Usage: always read `ctx.db` inside `it()` bodies (not destructured at
 * call time) since it's only populated once `beforeAll` resolves.
 */
export function setupActionTestDb(): ActionTestContext {
  const ctx = {} as ActionTestContext;
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
    const dbModule = await import("@/lib/db");
    ctx.db = dbModule.db;
  });

  afterEach(() => {
    fakeCookies.clear();
  });

  afterAll(async () => {
    await ctx.db.$disconnect();
    await testDb.cleanup();
  });

  return ctx;
}

export { fakeCookies };

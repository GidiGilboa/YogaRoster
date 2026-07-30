import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const DB_PATH = path.join(process.cwd(), ".e2e-test.db");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Next dev compiles routes on demand; under full local parallelism many
  // tests hit an uncompiled route at once and 30s isn't always enough
  // headroom purely for that first-compile latency (not app slowness).
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // `next start` always forces NODE_ENV=production, and this app's session
    // cookie sets `secure: true` in production — which browsers refuse to
    // send over plain http://localhost. So this must run on `next dev`
    // (NODE_ENV=development) despite the extra startup cost.
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: `file:${DB_PATH}`,
      SESSION_SECRET: "e2e-test-session-secret",
      NODE_ENV: "development",
      // Dedicated e2e-only admin login — not the real .env value. Password
      // is "e2e-admin-password-123"; see tests/e2e/admin.spec.ts.
      // Dollar signs are backslash-escaped: Next's dotenv-expand reprocesses
      // *any* process.env value for a key name that also appears in .env
      // (even one supplied here, not from the file), so unescaped $2b/$12
      // sequences get silently stripped as bogus variable references.
      ADMIN_USERNAME: "e2e-admin",
      ADMIN_PASSWORD_HASH: "\\$2b\\$12\\$4ETnqZfdo2hbnA/AUkJsAO/stfoEobtTm.5kDkOcoKyBmkXYjMdrC",
    },
  },
});

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
  timeout: 30_000,
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
    },
  },
});

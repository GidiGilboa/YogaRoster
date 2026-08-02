import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Each test file gets its own OS process, which gives it its own
    // process.env — required since every integration test file points
    // DATABASE_URL at a different throwaway SQLite file.
    pool: "forks",
    include: ["src/**/*.{unit,int}.test.ts"],
    exclude: ["tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/app/actions/**", "src/lib/**"],
      // Same reasoning as src/lib/db.ts: infrastructure that talks to a real
      // external service and can't be meaningfully unit tested. The actual
      // Baileys socket/QR/reconnect logic here requires a real network
      // connection and a real WhatsApp account - see qa-test-plan.md's
      // WhatsApp mocking note. Only the action layer that calls into it
      // (src/app/actions/whatsapp.ts) is held to the coverage bar.
      exclude: ["src/lib/db.ts", "src/lib/whatsapp.ts", "src/generated/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});

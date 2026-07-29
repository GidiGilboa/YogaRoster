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
      exclude: ["src/lib/db.ts", "src/generated/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});

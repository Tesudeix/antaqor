import { defineConfig } from "vitest/config";
import path from "path";

// Integration-test config for the REAL inbound webhook router. Path alias
// mirrors tsconfig (@/* -> src/*). `server-only` is stubbed so Next libs that
// guard against client import don't throw inside the node test runner.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "test/_empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    hookTimeout: 60000,
    testTimeout: 30000,
    pool: "forks",
    fileParallelism: false,
  },
});

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});

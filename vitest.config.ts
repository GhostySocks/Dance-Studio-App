import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same JSX handling as Next, so tests can load .tsx files (the invoice PDF)
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});

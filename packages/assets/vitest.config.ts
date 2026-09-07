import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "assets",
    environment: "node",
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.cjs", "**/docs/**"],
      thresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
      },
    },
  },
});

export default config;

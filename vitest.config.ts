import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    coverage: {
      all: false,
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "docs/**", "**/*.cjs"],
      provider: "v8",
      thresholds: {
        lines: 95,
        branches: 95,
        functions: 95,
        statements: 95,
      },
    },
  },
});

export default config;

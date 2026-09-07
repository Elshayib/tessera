import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "testing",
    environment: "node",
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
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

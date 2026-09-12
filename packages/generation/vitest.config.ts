import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "generation",
    environment: "node",
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
      },
    },
  },
});

export default config;

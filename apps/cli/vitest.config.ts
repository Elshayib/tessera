import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "cli",
    environment: "node",
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "src/cli.ts"],
      thresholds: {
        lines: 95,
        branches: 90,
        functions: 95,
        statements: 95,
      },
    },
  },
});

export default config;

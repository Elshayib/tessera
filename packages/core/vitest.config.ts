import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "core",
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.bench.ts"],
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.bench.ts"],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});

export default config;

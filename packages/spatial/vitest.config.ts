import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "spatial",
    environment: "node",
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.cjs", "**/docs/**"],
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

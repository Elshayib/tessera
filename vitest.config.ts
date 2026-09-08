import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    coverage: {
      all: false,
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.bench.ts",
        "docs/**",
        "**/*.cjs",
        "packages/engine/src/**",
        "packages/ui/src/**",
      ],
      provider: "v8",
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
        "packages/core/src/**/*.ts": {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        "packages/llm/src/**/*.ts": {
          lines: 85,
          branches: 85,
          functions: 85,
          statements: 85,
        },
      },
    },
  },
});

export default config;

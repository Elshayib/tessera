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
        "packages/llm/src/**",
        "packages/generation/src/**",
        "packages/providers-generation/src/**",
        "packages/assets/src/**",
        "packages/testing/src/fake-generation-provider.ts",
        "packages/testing/src/fake-asset-source.ts",
        "packages/providers-llm/src/**",
        "packages/agent/src/**",
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
      },
    },
  },
});

export default config;

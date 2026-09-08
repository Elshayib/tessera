import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    coverage: {
      all: false,
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "docs/**", "**/*.cjs"],
      provider: "v8",
    },
  },
});

export default config;

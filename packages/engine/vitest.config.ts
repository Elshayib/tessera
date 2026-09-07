import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "engine",
    environment: "happy-dom",
    environmentMatchGlobs: [["src/**/*.browser.test.ts", "happy-dom"]],
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.cjs", "**/docs/**"],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70,
      },
    },
  },
});

export default config;

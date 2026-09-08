import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "ui",
    environment: "happy-dom",
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.browser.test.ts",
        "**/*.browser.test.tsx",
        "**/test-setup.ts",
        "**/*.cjs",
        "**/docs/**",
      ],
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

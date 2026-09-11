import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "evals",
    environment: "node",
    include: ["src/**/*.test.ts", "suites/**/*.test.ts"],
  },
});

export default config;

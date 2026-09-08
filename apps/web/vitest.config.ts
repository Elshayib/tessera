import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "web",
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});

export default config;

import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "scripts",
    environment: "node",
  },
});

export default config;

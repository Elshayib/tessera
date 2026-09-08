import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    name: "web",
    environment: "node",
  },
});

export default config;

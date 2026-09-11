import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/entry-[hash].js",
        manualChunks(id) {
          if (id.includes("packages/engine") || id.includes("@tessera/engine")) {
            return "engine";
          }
          return undefined;
        },
      },
    },
  },
});

export default config;

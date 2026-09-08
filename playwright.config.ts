import { defineConfig, devices } from "@playwright/test";

const config = defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  timeout: 30_000,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] === undefined ? 0 : 1,
  workers: process.env["CI"] === undefined ? undefined : 1,
  reporter: "list",
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}{-projectName}{-snapshotSuffix}{ext}",
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: `"${process.execPath}" ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort`,
    cwd: "./apps/web",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: process.env["CI"] === undefined,
    timeout: 120_000,
  },
});

export default config;

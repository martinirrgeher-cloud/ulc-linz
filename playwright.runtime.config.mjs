import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_RUNTIME_BASE_URL || "http://127.0.0.1:4175";

export default defineConfig({
  testDir: "./tests/runtime",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
    browserName: "chromium",
    locale: "de-AT",
    timezoneId: "Europe/Vienna",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/release/serve-runtime-build.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: "runtime-mobile-390",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
    {
      name: "runtime-desktop-1280",
      use: { viewport: { width: 1280, height: 900 }, hasTouch: false, isMobile: false },
    },
  ],
  outputDir: "test-results/runtime",
});

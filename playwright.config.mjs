import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    locale: "de-AT",
    timezoneId: "Europe/Vienna",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "mobile-360",
      use: { viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true },
    },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
    {
      name: "mobile-430",
      use: { viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true },
    },
    {
      name: "desktop-1280",
      use: { viewport: { width: 1280, height: 900 }, hasTouch: false, isMobile: false },
    },
  ],
  outputDir: "test-results/e2e",
});

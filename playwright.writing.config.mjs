import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_WRITING_BASE_URL || "http://127.0.0.1:4174";

export default defineConfig({
  testDir: "./tests/e2e-writing",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report-writing", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report-writing", open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    locale: "de-AT",
    timezoneId: "Europe/Vienna",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4174",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  outputDir: "test-results/e2e-writing",
});

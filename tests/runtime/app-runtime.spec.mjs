import { expect, test } from "@playwright/test";
import {
  installAuthenticatedSession,
  installSupabaseMock,
} from "../e2e/helpers/supabase-mock.mjs";

function collectRuntimeProblems(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
  });
  return problems;
}

async function expectRuntimeHealthy(page, problems, unhandled) {
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByRole("heading", { name: "Diese Ansicht konnte nicht geladen werden." })).toHaveCount(0);
  await expect(page.locator(".app-error-boundary")).toHaveCount(0);
  await expect(page.locator(".loading-screen")).toHaveCount(0);
  expect(unhandled).toEqual([]);
  expect(problems).toEqual([]);
}

async function expectAuthenticatedHeading(page, route, heading) {
  await page.goto(route);
  const pathname = new URL(page.url()).pathname;
  if (pathname === "/login") {
    throw new Error(
      `Runtime-Test wurde unerwartet zum Login umgeleitet. ` +
      `Der isolierte E2E-Build oder die Test-Sitzung ist nicht aktiv (Zielroute: ${route}).`,
    );
  }
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
}

test("oeffentliche Login-Seite rendert ohne React-Laufzeitfehler", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  const unhandled = await installSupabaseMock(page);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Anmelden", exact: true })).toBeVisible();
  await expectRuntimeHealthy(page, problems, unhandled);
});

test("authentifiziertes App-Layout rendert ohne React-Laufzeitfehler", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await expectAuthenticatedHeading(page, "/", "Willkommen, E2E Administrator");
  await expectRuntimeHealthy(page, problems, unhandled);
});

test("zentrales Stammdatenmodul rendert ohne React-Laufzeitfehler", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await expectAuthenticatedHeading(page, "/module/athletes", "Athleten, Trainer & Gruppen");
  await expectRuntimeHealthy(page, problems, unhandled);
});

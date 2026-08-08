import { expect, test } from "@playwright/test";
import { expectNoAppError, login } from "./helpers/auth.mjs";
import { E2E } from "./helpers/test-data.mjs";
import { WRITING_SCENARIOS } from "./helpers/scenarios.mjs";

const SCENARIO = WRITING_SCENARIOS.planning;

test.describe("Schreibende Trainingsplanung", () => {
  test("Trainingsplan wird gespeichert und eine zweite Sitzung wird sofort blockiert", { tag: "@pr" }, async ({ page, browser }) => {
    await login(page, "admin");
    const planUrl = `/module/training_planning?date=${SCENARIO.date}&group=${E2E.groupId}&athlete=${E2E.athleteId}`;
    await page.goto(planUrl);
    await expect(page.getByRole("heading", { name: "Anna E2E", exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByLabel("Plantitel").fill(SCENARIO.title);
    await page.getByRole("button", { name: "Block", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Trainingsblock auswählen" });
    await picker.getByRole("button", { name: /E2E Beschleunigungsblock/ }).click();
    await page.getByRole("button", { name: "Plan speichern", exact: true }).click();
    await expect(page.getByText("Der Trainingsplan wurde gespeichert.", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1200);

    const trainerContext = await browser.newContext({
      locale: "de-AT",
      timezoneId: "Europe/Vienna",
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      const trainerPage = await trainerContext.newPage();
      await login(trainerPage, "trainer");
      await trainerPage.goto(planUrl);
      await expect(trainerPage.getByRole("heading", { name: "Anna E2E", exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(trainerPage.getByRole("alert").filter({ hasText: "Der Datensatz wird bereits bearbeitet." })).toBeVisible({
        timeout: 15_000,
      });
      await expect(trainerPage.getByLabel("Plantitel")).toBeDisabled();
      await expectNoAppError(trainerPage);
    } finally {
      await trainerContext.close();
    }
  });
});

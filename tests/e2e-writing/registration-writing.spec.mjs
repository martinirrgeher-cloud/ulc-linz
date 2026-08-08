import { expect, test } from "@playwright/test";
import { expectNoAppError, login } from "./helpers/auth.mjs";
import { WRITING_SCENARIOS } from "./helpers/scenarios.mjs";

const SCENARIO = WRITING_SCENARIOS.registration;
void SCENARIO;

test.describe("Schreibende Trainingsanmeldung", () => {
  test("Athlet speichert die eigene Trainingsanmeldung und sieht sie nach Reload", { tag: "@pr" }, async ({ page }) => {
    await login(page, "athlete");
    await page.goto("/module/performance_registration");
    await expect(page.getByRole("heading", { name: "Leistungsgruppen" })).toBeVisible();

    const firstDay = page.locator(".performance-registration-day").first();
    await expect(firstDay).toBeVisible();
    await firstDay.getByRole("button", { name: "Ja", exact: true }).click();
    await expect(page.getByText("Gespeichert", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    const reloadedFirstDay = page.locator(".performance-registration-day").first();
    await expect(reloadedFirstDay.getByRole("button", { name: "Ja", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectNoAppError(page);
  });
});

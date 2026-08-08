import { expect, test } from "@playwright/test";
import { expectNoAppError, login } from "./helpers/auth.mjs";
import { WRITING_SCENARIOS } from "./helpers/scenarios.mjs";

const SCENARIO = WRITING_SCENARIOS.catalog;

test.describe("Schreibende Übungs- und Trainingsblocktests", () => {
  test("Administrator legt eine Übung und einen Trainingsblock an", { tag: "@pr" }, async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, "admin");
    await page.goto("/module/exercise_catalog");
    await expect(page.getByRole("heading", { name: "Übungskatalog" })).toBeVisible();

    await page.getByTestId("exercise-create").click();
    const exerciseDialog = page.getByRole("dialog", { name: "Übung anlegen" });
    await exerciseDialog.getByLabel("Name *").fill(SCENARIO.exerciseName);
    await exerciseDialog.getByLabel("Schwierigkeitsgrad").selectOption("medium");
    await exerciseDialog.getByRole("button", { name: "Anleitung", exact: true }).click();
    await exerciseDialog.getByLabel("Durchführung").fill("Kontrollierter Sprint mit sauberer Beschleunigung.");
    await exerciseDialog.getByRole("button", { name: /Parameter/ }).click();
    await exerciseDialog.locator(".parameter-picker").getByRole("button", { name: /Wiederholungen/ }).click();
    await exerciseDialog.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Die Übung wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("exercise-card").filter({ hasText: SCENARIO.exerciseName })).toBeVisible();

    await page.goto("/module/training_blocks");
    await expect(page.getByRole("heading", { name: "Trainingsblöcke" })).toBeVisible();
    await page.getByTestId("training-block-create").click();
    const blockDialog = page.getByRole("dialog", { name: "Neuer Trainingsblock" });
    await blockDialog.getByLabel("Name *").fill(SCENARIO.blockName);
    await blockDialog.getByLabel("Geschätzte Dauer").fill("18");
    await blockDialog.getByRole("tab", { name: /Übungen/ }).click();
    const exerciseSearch = blockDialog.getByLabel("Übung suchen");
    await expect(exerciseSearch).toBeVisible({ timeout: 15_000 });
    await exerciseSearch.fill(SCENARIO.exerciseName);

    const exerciseOption = blockDialog
      .locator(".training-block-picker-add")
      .filter({ hasText: SCENARIO.exerciseName });
    await expect(exerciseOption).toBeVisible({ timeout: 15_000 });
    await exerciseOption.click();
    await blockDialog.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Der Trainingsblock wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByText(SCENARIO.blockName, { exact: true })).toBeVisible();

    const createdBlockCard = page.locator(".training-block-card").filter({ hasText: SCENARIO.blockName });
    await createdBlockCard.locator(".training-block-card-summary").click();
    await createdBlockCard.getByRole("button", { name: `${SCENARIO.blockName} zu Favoriten hinzufügen` }).click();
    await createdBlockCard.getByRole("button", { name: `Neue Variante von ${SCENARIO.blockName} erstellen` }).click();

    const variantDialog = page.getByRole("dialog", { name: `${SCENARIO.blockName} – Variante 2` });
    await expect(variantDialog).toBeVisible({ timeout: 15_000 });
    await variantDialog.getByRole("button", { name: "Trainingsblock schließen" }).click();

    const refreshedBlockCard = page.locator(".training-block-card").filter({ hasText: SCENARIO.blockName }).first();
    if (!(await refreshedBlockCard.locator(".training-block-card-details").isVisible())) {
      await refreshedBlockCard.locator(".training-block-card-summary").click();
    }
    await refreshedBlockCard.getByRole("button", { name: `${SCENARIO.blockName} für Vergleich auswählen` }).click();

    const variantCard = page.locator(".training-block-card").filter({ hasText: `${SCENARIO.blockName} – Variante 2` });
    if (!(await variantCard.locator(".training-block-card-details").isVisible())) {
      await variantCard.locator(".training-block-card-summary").click();
    }
    await variantCard.getByRole("button", { name: `${SCENARIO.blockName} – Variante 2 für Vergleich auswählen` }).click();
    const compareDialog = page.getByRole("dialog", { name: "Vergleich" });
    await expect(compareDialog).toBeVisible();
    await compareDialog.getByRole("button", { name: "Schließen", exact: true }).click();

    await page.goto("/module/exercise_catalog");
    const exerciseCard = page.locator(".exercise-card").filter({ hasText: SCENARIO.exerciseName });
    await expect(exerciseCard.getByText(/Mittel/)).toBeVisible();
    await exerciseCard.getByTestId("exercise-primary").click();
    await exerciseCard.getByTestId("exercise-usage").click();
    const usageDialog = page.getByRole("dialog", { name: SCENARIO.exerciseName });
    await expect(usageDialog.getByText(SCENARIO.blockName, { exact: true })).toBeVisible();
    await usageDialog.getByRole("button", { name: "Schließen", exact: true }).click();
    await expectNoAppError(page);
  });
});

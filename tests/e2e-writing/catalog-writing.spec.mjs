import { expect, test } from "@playwright/test";
import { expectNoAppError, login } from "./helpers/auth.mjs";
import { WRITING_SCENARIOS } from "./helpers/scenarios.mjs";

const SCENARIO = WRITING_SCENARIOS.catalog;

test.describe("Schreibende Übungs- und Trainingsblocktests", () => {
  test("Administrator legt eine Übung und einen Trainingsblock an", { tag: "@pr" }, async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, "admin");

    // CRUD-Regressionsvertrag fuer zentrale Auswahllisten: vorhandenen Eintrag
    // wirklich speichern und nach einem Reload wieder lesen. Danach wird der
    // Seedwert sofort wiederhergestellt, damit die Domaene deterministisch bleibt.
    await page.goto("/module/dropdown_settings");
    await expect(page.getByRole("heading", { name: "Auswahllisten", exact: true })).toBeVisible();
    const categoryCard = page.getByTestId("dropdown-setting-card").filter({ hasText: "Beschleunigung" }).first();
    await expect(categoryCard).toBeVisible();
    await categoryCard.getByTestId("dropdown-setting-edit").click();
    let dropdownEditor = page.getByRole("region", { name: "Kategorie bearbeiten", exact: true });
    await dropdownEditor.getByLabel("Bezeichnung *").fill("Beschleunigung E2E");
    await page.getByTestId("dropdown-setting-save").click();
    await expect(page.getByText("Der Eintrag wurde gespeichert.", { exact: true })).toBeVisible();
    await page.reload();
    const changedCategoryCard = page.getByTestId("dropdown-setting-card").filter({ hasText: "Beschleunigung E2E" }).first();
    await expect(changedCategoryCard).toBeVisible();
    await changedCategoryCard.getByTestId("dropdown-setting-edit").click();
    dropdownEditor = page.getByRole("region", { name: "Kategorie bearbeiten", exact: true });
    await dropdownEditor.getByLabel("Bezeichnung *").fill("Beschleunigung");
    await page.getByTestId("dropdown-setting-save").click();
    await expect(page.getByText("Der Eintrag wurde gespeichert.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("dropdown-setting-card").filter({ hasText: "Beschleunigung" }).first()).toBeVisible();

    await page.goto("/module/exercise_catalog");
    await expect(page.getByRole("heading", { name: "Übungskatalog" })).toBeVisible();

    await page.getByTestId("exercise-create").click();
    const exerciseEditor = page.getByRole("region", { name: "Übung anlegen" });
    await exerciseEditor.getByLabel("Name *").fill(SCENARIO.exerciseName);
    await exerciseEditor.getByLabel("Schwierigkeitsgrad").selectOption("medium");
    await exerciseEditor.getByRole("button", { name: "Anleitung", exact: true }).click();
    await exerciseEditor.getByRole("textbox", { name: "Durchführung", exact: true }).fill("Kontrollierter Sprint mit sauberer Beschleunigung.");
    await exerciseEditor.getByRole("button", { name: /Parameter/ }).click();
    await exerciseEditor.locator(".parameter-picker").getByRole("button", { name: /Wiederholungen/ }).click();
    await exerciseEditor.getByRole("button", { name: "Übung speichern", exact: true }).click();
    await expect(page.getByText("Die Übung wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("exercise-card").filter({ hasText: SCENARIO.exerciseName })).toBeVisible();

    await page.goto("/module/training_blocks");
    await expect(page.getByRole("heading", { name: "Trainingsblöcke" })).toBeVisible();
    await page.getByTestId("training-block-create").click();
    const blockEditor = page.getByRole("region", { name: "Neuer Trainingsblock" });
    await expect(blockEditor).toBeVisible();
    await blockEditor.getByLabel("Name *").fill(SCENARIO.blockName);
    await blockEditor.getByLabel("Geschätzte Dauer").fill("18");
    await blockEditor.getByRole("tab", { name: /Übungen/ }).click();
    const exerciseSearch = blockEditor.getByLabel("Übung suchen");
    await expect(exerciseSearch).toBeVisible({ timeout: 15_000 });
    await exerciseSearch.fill(SCENARIO.exerciseName);

    const exerciseOption = blockEditor
      .locator(".training-block-picker-add")
      .filter({ hasText: SCENARIO.exerciseName });
    await expect(exerciseOption).toBeVisible({ timeout: 15_000 });
    await exerciseOption.click();
    await blockEditor.getByTestId("training-block-editor-save").click();
    await expect(page.getByText("Der Trainingsblock wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByText(SCENARIO.blockName, { exact: true })).toBeVisible();

    const createdBlockCard = page.locator(".training-block-card").filter({ hasText: SCENARIO.blockName });
    await createdBlockCard.locator(".training-block-card-summary").click();
    const blockFavorite = createdBlockCard.getByRole("button", { name: `${SCENARIO.blockName} zu Favoriten hinzufügen` });
    await blockFavorite.click();
    await expect(blockFavorite).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    const persistedBlockCard = page.locator(".training-block-card").filter({ hasText: SCENARIO.blockName }).first();
    await expect(persistedBlockCard).toBeVisible();
    await persistedBlockCard.locator(".training-block-card-summary").click();
    await expect(persistedBlockCard.getByRole("button", { name: `${SCENARIO.blockName} aus Favoriten entfernen` })).toHaveAttribute("aria-pressed", "true");
    await persistedBlockCard.getByRole("button", { name: `Neue Variante von ${SCENARIO.blockName} erstellen` }).click();

    const variantEditor = page.getByRole("region", { name: `${SCENARIO.blockName} – Variante 2` });
    await expect(variantEditor).toBeVisible({ timeout: 15_000 });
    await variantEditor.getByTestId("training-block-editor-close").click();

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
    let exerciseCard = page.locator(".exercise-card").filter({ hasText: SCENARIO.exerciseName });
    await expect(exerciseCard.getByText(/Mittel/)).toBeVisible();
    const exerciseFavorite = exerciseCard.getByRole("button", { name: `${SCENARIO.exerciseName} zu Favoriten hinzufügen` });
    await exerciseFavorite.click();
    await expect(exerciseFavorite).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    exerciseCard = page.locator(".exercise-card").filter({ hasText: SCENARIO.exerciseName });
    await expect(exerciseCard.getByRole("button", { name: `${SCENARIO.exerciseName} aus Favoriten entfernen` })).toHaveAttribute("aria-pressed", "true");
    await exerciseCard.getByTestId("exercise-primary").click();
    await exerciseCard.getByTestId("exercise-usage").click();
    const usageDialog = page.getByRole("dialog", { name: SCENARIO.exerciseName });
    await expect(usageDialog.getByText(SCENARIO.blockName, { exact: true })).toBeVisible();
    await usageDialog.getByRole("button", { name: "Schließen", exact: true }).click();
    await expectNoAppError(page);
  });
});

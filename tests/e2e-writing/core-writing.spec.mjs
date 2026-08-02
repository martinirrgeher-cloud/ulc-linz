import { expect, test } from "@playwright/test";
import { expectNoAppError, login } from "./helpers/auth.mjs";
import { E2E } from "./helpers/test-data.mjs";

const UI_GROUP = "E2E UI Gruppe";
const UI_ATHLETE = { firstName: "Eva", lastName: "E2E UI" };
const UI_TRAINER = { firstName: "Tina", lastName: "E2E UI" };
const UI_EXERCISE = "E2E UI Sprintlauf";
const UI_BLOCK = "E2E UI Sprintblock";
const UI_REALTIME_ATHLETE = { firstName: "Rita", lastName: "E4 Realtime" };
const PLAN_DATE = "2026-08-03";

function athleteFullName() {
  return `${UI_ATHLETE.firstName} ${UI_ATHLETE.lastName}`;
}

function trainerFullName() {
  return `${UI_TRAINER.firstName} ${UI_TRAINER.lastName}`;
}

test.describe("Schreibende Kernabläufe in isolierter Supabase-Umgebung", () => {
  test("Administrator legt Gruppe, Athlet und Trainer an und Änderungen bleiben erhalten", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/module/athletes");
    await expect(page.getByRole("heading", { name: "Athleten, Trainer & Gruppen" })).toBeVisible();

    const createActions = page.getByLabel("Stammdaten anlegen");
    await createActions.getByRole("button", { name: /Gruppe/ }).click();
    const groupEditor = page.locator(".management-editor");
    await expect(groupEditor.getByRole("heading", { name: "Gruppe anlegen" })).toBeVisible();
    await groupEditor.getByLabel("Gruppenname").fill(UI_GROUP);
    await groupEditor.getByLabel("Kurzbezeichnung").fill("E2E-UI");
    await groupEditor.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Die Trainingsgruppe wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: UI_GROUP, exact: true })).toBeVisible();

    await createActions.getByRole("button", { name: /Athlet/ }).click();
    const athleteEditor = page.locator(".athlete-editor");
    await athleteEditor.getByLabel("Vorname").fill(UI_ATHLETE.firstName);
    await athleteEditor.getByLabel("Nachname").fill(UI_ATHLETE.lastName);
    await athleteEditor.getByLabel("Geburtsjahr").fill("2012");
    await athleteEditor.getByRole("tab", { name: /Gruppen/ }).click();
    await athleteEditor.getByRole("checkbox", { name: UI_GROUP }).check();
    await athleteEditor.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Der Athlet wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: athleteFullName(), exact: true })).toBeVisible();

    await page.getByRole("button", { name: `${athleteFullName()} bearbeiten` }).click();
    await expect(athleteEditor.getByRole("heading", { name: "Athlet bearbeiten" })).toBeVisible();
    await athleteEditor.getByLabel("Interne Notiz").fill("E1b.2 Persistenzprüfung");
    await athleteEditor.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Die Athletendaten wurden gespeichert.", { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: `${athleteFullName()} bearbeiten` }).click();
    await expect(athleteEditor.getByLabel("Interne Notiz")).toHaveValue("E1b.2 Persistenzprüfung");
    await athleteEditor.getByRole("button", { name: "Abbrechen", exact: true }).click();

    await createActions.getByRole("button", { name: /Trainer/ }).click();
    const trainerEditor = page.locator(".trainer-editor");
    await trainerEditor.getByLabel("Vorname").fill(UI_TRAINER.firstName);
    await trainerEditor.getByLabel("Nachname").fill(UI_TRAINER.lastName);
    await trainerEditor.getByLabel("E-Mail-Adresse").fill("tina.e1b2@example.test");
    await trainerEditor.getByRole("checkbox", { name: UI_GROUP }).check();
    await trainerEditor.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Der Trainer wurde angelegt.", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: /Trainer/ }).click();
    await expect(page.getByRole("heading", { name: trainerFullName(), exact: true })).toBeVisible();
    await expectNoAppError(page);
  });

  test("Gruppen und Trainer werden in einer zweiten Sitzung sofort gesperrt", async ({ page, browser }) => {
    await login(page, "admin");
    await page.goto("/module/athletes?tab=groups");
    await page.getByRole("button", { name: "E2E Leistungsgruppe bearbeiten", exact: true }).click();

    const groupEditor = page.locator(".management-editor");
    await expect(groupEditor.getByRole("heading", { name: "Gruppe bearbeiten", exact: true })).toBeVisible();
    await expect(groupEditor.getByLabel("Gruppenname")).toBeEnabled({ timeout: 15_000 });

    const groupContext = await browser.newContext({
      locale: "de-AT",
      timezoneId: "Europe/Vienna",
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      const trainerPage = await groupContext.newPage();
      await login(trainerPage, "trainer");
      await trainerPage.goto("/module/athletes?tab=groups");
      await trainerPage.getByRole("button", { name: "E2E Leistungsgruppe bearbeiten", exact: true }).click();
      await expect(
        trainerPage.getByRole("alert").filter({ hasText: "Der Datensatz wird bereits bearbeitet." }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(trainerPage.getByLabel("Gruppenname")).toBeDisabled();
    } finally {
      await groupContext.close();
    }

    await groupEditor.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await page.waitForTimeout(600);
    await page.getByRole("tab", { name: /Trainer/ }).click();
    await page.getByRole("button", { name: "Tom E2E bearbeiten", exact: true }).click();

    const trainerEditor = page.locator(".trainer-editor");
    await expect(trainerEditor.getByRole("heading", { name: "Trainer bearbeiten", exact: true })).toBeVisible();
    await expect(trainerEditor.getByLabel("Vorname")).toBeEnabled({ timeout: 15_000 });

    const trainerContext = await browser.newContext({
      locale: "de-AT",
      timezoneId: "Europe/Vienna",
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      const secondTrainerPage = await trainerContext.newPage();
      await login(secondTrainerPage, "trainer");
      await secondTrainerPage.goto("/module/athletes?tab=trainers");
      await secondTrainerPage.getByRole("button", { name: "Tom E2E bearbeiten", exact: true }).click();
      await expect(
        secondTrainerPage.getByRole("alert").filter({ hasText: "Der Datensatz wird bereits bearbeitet." }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(secondTrainerPage.getByLabel("Vorname")).toBeDisabled();
      await expectNoAppError(secondTrainerPage);
    } finally {
      await trainerContext.close();
    }

    await expectNoAppError(page);
  });

  test("Realtime aktualisiert Listen und bewahrt einen lokalen Konfliktentwurf", async ({ page, browser }) => {
    await login(page, "admin");
    await page.goto("/module/athletes");
    await expect(page.getByRole("heading", { name: "Athleten, Trainer & Gruppen" })).toBeVisible();

    const createActions = page.getByLabel("Stammdaten anlegen");
    await createActions.getByRole("button", { name: /Athlet/ }).click();
    const firstEditor = page.locator(".athlete-editor");
    await firstEditor.getByLabel("Vorname").fill(UI_REALTIME_ATHLETE.firstName);
    await firstEditor.getByLabel("Nachname").fill(UI_REALTIME_ATHLETE.lastName);
    await firstEditor.getByRole("button", { name: "Speichern", exact: true }).click();

    const originalName = `${UI_REALTIME_ATHLETE.firstName} ${UI_REALTIME_ATHLETE.lastName}`;
    const changedName = `${UI_REALTIME_ATHLETE.firstName} E4 Server`;
    await expect(page.getByRole("heading", { name: originalName, exact: true })).toBeVisible();

    const secondContext = await browser.newContext({
      locale: "de-AT",
      timezoneId: "Europe/Vienna",
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    try {
      const secondPage = await secondContext.newPage();
      await login(secondPage, "admin");
      await secondPage.goto("/module/athletes");
      await secondPage.getByRole("button", { name: `${originalName} bearbeiten`, exact: true }).click();

      const secondEditor = secondPage.locator(".athlete-editor");
      await expect(secondEditor.getByLabel("Nachname")).toBeEnabled({ timeout: 15_000 });
      await secondEditor.getByLabel("Nachname").fill("E4 Server");
      await secondEditor.getByRole("button", { name: "Speichern", exact: true }).click();

      await expect(page.getByRole("heading", { name: changedName, exact: true })).toBeVisible({
        timeout: 15_000,
      });

      await page.getByRole("button", { name: `${changedName} bearbeiten`, exact: true }).click();
      await firstEditor.getByLabel("Interne Notiz").fill("Lokaler E4 Konfliktentwurf");

      await secondPage.getByRole("button", { name: `${changedName} bearbeiten`, exact: true }).click();
      await expect(
        secondPage.getByRole("alert").filter({ hasText: "Der Datensatz wird bereits bearbeitet." }),
      ).toBeVisible({ timeout: 15_000 });
      await secondPage.getByRole("button", { name: "Bearbeitung übernehmen", exact: true }).click();
      await expect(secondEditor.getByLabel("Nachname")).toBeEnabled({ timeout: 15_000 });
      await secondEditor.getByLabel("Nachname").fill("E4 Fremdstand");
      await secondEditor.getByRole("button", { name: "Speichern", exact: true }).click();

      const conflictNotice = page
        .getByRole("alert")
        .filter({ hasText: "Neuerer Serverstand vorhanden" });
      await expect(conflictNotice).toBeVisible({ timeout: 15_000 });
      await expect(firstEditor.getByLabel("Interne Notiz")).toHaveValue("Lokaler E4 Konfliktentwurf");

      await conflictNotice.getByRole("button", { name: "Eigene Eingaben behalten", exact: true }).click();
      await expect(firstEditor.getByLabel("Interne Notiz")).toHaveValue("Lokaler E4 Konfliktentwurf");
      await expect(firstEditor.getByLabel("Vorname")).toBeEnabled({ timeout: 15_000 });
      await firstEditor.getByRole("button", { name: "Speichern", exact: true }).click();
      await expect(page.getByText("Die Athletendaten wurden gespeichert.", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expectNoAppError(secondPage);
    } finally {
      await secondContext.close();
    }

    await expectNoAppError(page);
  });

  test("Administrator legt eine Übung und einen Trainingsblock an", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, "admin");
    await page.goto("/module/exercise_catalog");
    await expect(page.getByRole("heading", { name: "Übungskatalog" })).toBeVisible();

    await page.getByRole("button", { name: "Übung", exact: true }).click();
    const exerciseDialog = page.getByRole("dialog", { name: "Übung anlegen" });
    await exerciseDialog.getByLabel("Name *").fill(UI_EXERCISE);
    await exerciseDialog.getByLabel("Schwierigkeitsgrad").selectOption("medium");
    await exerciseDialog.getByRole("button", { name: "Anleitung", exact: true }).click();
    await exerciseDialog.getByLabel("Durchführung").fill("Kontrollierter Sprint mit sauberer Beschleunigung.");
    await exerciseDialog.getByRole("button", { name: /Parameter/ }).click();
    await exerciseDialog.locator(".parameter-picker").getByRole("button", { name: /Wiederholungen/ }).click();
    await exerciseDialog.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Die Übung wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: UI_EXERCISE, exact: true })).toBeVisible();

    await page.goto("/module/training_blocks");
    await expect(page.getByRole("heading", { name: "Trainingsblöcke" })).toBeVisible();
    await page.getByRole("button", { name: "Block", exact: true }).click();
    const blockDialog = page.getByRole("dialog", { name: "Neuer Trainingsblock" });
    await blockDialog.getByLabel("Name *").fill(UI_BLOCK);
    await blockDialog.getByLabel("Geschätzte Dauer").fill("18");
    await blockDialog.getByRole("tab", { name: /Übungen/ }).click();
    const exerciseSearch = blockDialog.getByLabel("Übung suchen");
    await expect(exerciseSearch).toBeVisible({ timeout: 15_000 });
    await exerciseSearch.fill(UI_EXERCISE);

    const exerciseOption = blockDialog
      .locator(".training-block-picker-add")
      .filter({ hasText: UI_EXERCISE });
    await expect(exerciseOption).toBeVisible({ timeout: 15_000 });
    await exerciseOption.click();
    await blockDialog.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Der Trainingsblock wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByText(UI_BLOCK, { exact: true })).toBeVisible();

    const createdBlockCard = page.locator(".training-block-card").filter({ hasText: UI_BLOCK });
    await createdBlockCard.locator(".training-block-card-summary").click();
    await createdBlockCard.getByRole("button", { name: `${UI_BLOCK} zu Favoriten hinzufügen` }).click();
    await createdBlockCard.getByRole("button", { name: `Neue Variante von ${UI_BLOCK} erstellen` }).click();

    const variantDialog = page.getByRole("dialog", { name: `${UI_BLOCK} – Variante 2` });
    await expect(variantDialog).toBeVisible({ timeout: 15_000 });
    await variantDialog.getByRole("button", { name: "Trainingsblock schließen" }).click();

    const refreshedBlockCard = page.locator(".training-block-card").filter({ hasText: UI_BLOCK }).first();
    if (!(await refreshedBlockCard.locator(".training-block-card-details").isVisible())) {
      await refreshedBlockCard.locator(".training-block-card-summary").click();
    }
    await refreshedBlockCard.getByRole("button", { name: `${UI_BLOCK} für Vergleich auswählen` }).click();

    const variantCard = page.locator(".training-block-card").filter({ hasText: `${UI_BLOCK} – Variante 2` });
    if (!(await variantCard.locator(".training-block-card-details").isVisible())) {
      await variantCard.locator(".training-block-card-summary").click();
    }
    await variantCard.getByRole("button", { name: `${UI_BLOCK} – Variante 2 für Vergleich auswählen` }).click();
    const compareDialog = page.getByRole("dialog", { name: "Vergleich" });
    await expect(compareDialog).toBeVisible();
    await compareDialog.getByRole("button", { name: "Schließen", exact: true }).click();

    await page.goto("/module/exercise_catalog");
    const exerciseCard = page.locator(".exercise-card").filter({ hasText: UI_EXERCISE });
    await expect(exerciseCard.getByText("Schwierigkeit: Mittel", { exact: true })).toBeVisible();
    await exerciseCard.getByRole("button", { name: `Verwendung von ${UI_EXERCISE} anzeigen` }).click();
    const usageDialog = page.getByRole("dialog", { name: UI_EXERCISE });
    await expect(usageDialog.getByText(UI_BLOCK, { exact: true })).toBeVisible();
    await usageDialog.getByRole("button", { name: "Schließen", exact: true }).click();
    await expectNoAppError(page);
  });

  test("Athlet speichert die eigene Trainingsanmeldung und sieht sie nach Reload", async ({ page }) => {
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

  test("Trainingsplan wird gespeichert und eine zweite Sitzung wird sofort blockiert", async ({ page, browser }) => {
    await login(page, "admin");
    const planUrl = `/module/training_planning?date=${PLAN_DATE}&group=${E2E.groupId}&athlete=${E2E.athleteId}`;
    await page.goto(planUrl);
    await expect(page.getByRole("heading", { name: "Anna E2E", exact: true })).toBeVisible({ timeout: 20_000 });

    await page.getByLabel("Plantitel").fill("E2E Montagstraining");
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

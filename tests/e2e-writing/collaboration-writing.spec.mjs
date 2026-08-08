import { expect, test } from "@playwright/test";
import { expectNoAppError, login } from "./helpers/auth.mjs";
import { WRITING_SCENARIOS, fullName } from "./helpers/scenarios.mjs";
import {
  editAthlete,
  editGroup,
  editTrainer,
} from "../helpers/masterdata.mjs";

const SCENARIO = WRITING_SCENARIOS.collaboration;
const REALTIME_DIAGNOSTIC_ENABLED = process.env.E2E_REALTIME_DIAGNOSTIC === "true";

test.describe("Schreibende Kollaborations- und Sperrtests", () => {
  test("Gruppen und Trainer werden in einer zweiten Sitzung sofort gesperrt", async ({ page, browser }) => {
    await login(page, "admin");
    await page.goto("/module/athletes?tab=groups");
    await editGroup(page, SCENARIO.groupName);

    const groupEditor = page.getByTestId("masterdata-group-editor");
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
      await editGroup(trainerPage, SCENARIO.groupName);
      await expect(
        trainerPage.getByRole("alert").filter({ hasText: "Der Datensatz wird bereits bearbeitet." }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(trainerPage.getByLabel("Gruppenname")).toBeDisabled();
    } finally {
      await groupContext.close();
    }

    await groupEditor.getByTestId("editor-close").click();
    await page.waitForTimeout(600);
    await page.getByRole("tab", { name: /Trainer/ }).click();
    await editTrainer(page, SCENARIO.trainerName);

    const trainerEditor = page.getByTestId("masterdata-trainer-editor");
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
      await editTrainer(secondTrainerPage, SCENARIO.trainerName);
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
    test.skip(
      !REALTIME_DIAGNOSTIC_ENABLED,
      "Offener E4-Realtime-CI-Diagnosefall; nur mit E2E_REALTIME_DIAGNOSTIC=true ausfuehren.",
    );
    await login(page, "admin");
    await page.goto("/module/athletes");
    await expect(page.getByRole("heading", { name: "Athleten, Trainer & Gruppen" })).toBeVisible();

    await page.getByTestId("masterdata-create-menu-toggle").click();
    await page.getByTestId("masterdata-create-athletes").click();
    const firstEditor = page.getByTestId("masterdata-athlete-editor");
    await firstEditor.getByLabel("Vorname").fill(SCENARIO.realtimeAthlete.firstName);
    await firstEditor.getByLabel("Nachname").fill(SCENARIO.realtimeAthlete.lastName);
    await firstEditor.getByTestId("editor-save").click();

    const originalName = fullName(SCENARIO.realtimeAthlete);
    const changedName = `${SCENARIO.realtimeAthlete.firstName} E4 Server`;
    await expect(page.getByRole("heading", { name: originalName, exact: true })).toBeVisible();
    await expect(
      page.locator('.athlete-management-page[data-realtime-status="subscribed"]'),
    ).toBeVisible({ timeout: 15_000 });

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
      await editAthlete(secondPage, originalName);

      const secondEditor = secondPage.getByTestId("masterdata-athlete-editor");
      await expect(secondEditor.getByLabel("Nachname")).toBeEnabled({ timeout: 15_000 });
      await secondEditor.getByLabel("Nachname").fill("E4 Server");
      await secondEditor.getByTestId("editor-save").click();

      await expect(page.getByRole("heading", { name: changedName, exact: true })).toBeVisible({
        timeout: 15_000,
      });

      await editAthlete(page, changedName);
      await firstEditor.getByLabel("Interne Notiz").fill("Lokaler E4 Konfliktentwurf");

      await editAthlete(secondPage, changedName);
      await expect(
        secondPage.getByRole("alert").filter({ hasText: "Der Datensatz wird bereits bearbeitet." }),
      ).toBeVisible({ timeout: 15_000 });
      await secondPage.getByRole("button", { name: "Bearbeitung übernehmen", exact: true }).click();
      await expect(secondEditor.getByLabel("Nachname")).toBeEnabled({ timeout: 15_000 });
      await secondEditor.getByLabel("Nachname").fill("E4 Fremdstand");
      await secondEditor.getByTestId("editor-save").click();

      const conflictNotice = page
        .getByRole("alert")
        .filter({ hasText: "Neuerer Serverstand vorhanden" });
      await expect(conflictNotice).toBeVisible({ timeout: 15_000 });
      await expect(firstEditor.getByLabel("Interne Notiz")).toHaveValue("Lokaler E4 Konfliktentwurf");

      await conflictNotice.getByRole("button", { name: "Eigene Eingaben behalten", exact: true }).click();
      await expect(firstEditor.getByLabel("Interne Notiz")).toHaveValue("Lokaler E4 Konfliktentwurf");
      await expect(firstEditor.getByLabel("Vorname")).toBeEnabled({ timeout: 15_000 });
      await firstEditor.getByTestId("editor-save").click();
      await expect(page.getByText("Die Athletendaten wurden gespeichert.", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expectNoAppError(secondPage);
    } finally {
      await secondContext.close();
    }

    await expectNoAppError(page);
  });
});

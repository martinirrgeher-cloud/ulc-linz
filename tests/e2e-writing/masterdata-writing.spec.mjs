import { expect, test } from "@playwright/test";
import { expectNoAppError, login } from "./helpers/auth.mjs";
import { WRITING_SCENARIOS, fullName } from "./helpers/scenarios.mjs";
import { editAthlete } from "../helpers/masterdata.mjs";
import {
  closeMemberInfo,
  editMember,
  openMemberInfo,
} from "../helpers/user-management.mjs";

const SCENARIO = WRITING_SCENARIOS.masterdata;

test.describe("Schreibende Stammdaten- und Benutzerverwaltung", () => {
  test("Administrator legt Gruppe, Athlet und Trainer an und Änderungen bleiben erhalten", { tag: "@pr" }, async ({ page }) => {
    await login(page, "admin");
    await page.goto("/module/athletes");
    await expect(page.getByRole("heading", { name: "Athleten, Trainer & Gruppen" })).toBeVisible();

    const createActions = page.getByTestId("masterdata-create-menu-toggle");
    await createActions.click();
    await page.getByTestId("masterdata-create-groups").click();
    const groupEditor = page.getByTestId("masterdata-group-editor");
    await expect(groupEditor.getByRole("heading", { name: "Gruppe anlegen" })).toBeVisible();
    await groupEditor.getByLabel("Gruppenname").fill(SCENARIO.groupName);
    await groupEditor.getByLabel("Kurzbezeichnung").fill(SCENARIO.groupShortName);
    await groupEditor.getByTestId("editor-save").click();
    await expect(page.getByText("Die Trainingsgruppe wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: SCENARIO.groupName, exact: true })).toBeVisible();

    await createActions.click();
    await page.getByTestId("masterdata-create-athletes").click();
    const athleteEditor = page.getByTestId("masterdata-athlete-editor");
    await athleteEditor.getByLabel("Vorname").fill(SCENARIO.athlete.firstName);
    await athleteEditor.getByLabel("Nachname").fill(SCENARIO.athlete.lastName);
    await athleteEditor.getByLabel("Geburtsjahr").fill("2012");
    await athleteEditor.getByRole("tab", { name: /Gruppen/ }).click();
    await athleteEditor.getByRole("checkbox", { name: SCENARIO.groupName }).check();
    await athleteEditor.getByTestId("editor-save").click();
    await expect(page.getByText("Der Athlet wurde angelegt.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: fullName(SCENARIO.athlete), exact: true })).toBeVisible();

    await editAthlete(page, fullName(SCENARIO.athlete));
    await expect(athleteEditor.getByRole("heading", { name: "Athlet bearbeiten" })).toBeVisible();
    await athleteEditor.getByLabel("Interne Notiz").fill("E1b.2 Persistenzprüfung");
    await athleteEditor.getByTestId("editor-save").click();
    await expect(page.getByText("Die Athletendaten wurden gespeichert.", { exact: true })).toBeVisible();

    await page.reload();
    await editAthlete(page, fullName(SCENARIO.athlete));
    await expect(athleteEditor.getByLabel("Interne Notiz")).toHaveValue("E1b.2 Persistenzprüfung");
    await athleteEditor.getByTestId("editor-close").click();

    await createActions.click();
    await page.getByTestId("masterdata-create-trainers").click();
    const trainerEditor = page.getByTestId("masterdata-trainer-editor");
    await trainerEditor.getByLabel("Vorname").fill(SCENARIO.trainer.firstName);
    await trainerEditor.getByLabel("Nachname").fill(SCENARIO.trainer.lastName);
    await trainerEditor.getByLabel("E-Mail-Adresse").fill(SCENARIO.trainer.email);
    await trainerEditor.getByRole("tab", { name: /Gruppen/ }).click();
    await trainerEditor.getByRole("checkbox", { name: SCENARIO.groupName }).check();
    await trainerEditor.getByTestId("editor-save").click();
    await expect(page.getByText("Der Trainer wurde angelegt.", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: /Trainer/ }).click();
    await expect(page.getByRole("heading", { name: fullName(SCENARIO.trainer), exact: true })).toBeVisible();

    await page.goto("/module/user_management");
    await expect(page.getByRole("heading", { name: "Benutzerverwaltung", exact: true })).toBeVisible();
    const memberEditor = await editMember(page, SCENARIO.parentDisplayName);
    await expect(memberEditor.getByLabel("Rechtevorlage")).toBeEnabled({ timeout: 15_000 });
    await memberEditor.getByLabel("Rechtevorlage").selectOption("parent");
    await memberEditor.getByRole("checkbox", { name: "Anna E2E", exact: true }).check();
    await memberEditor.getByRole("checkbox", { name: "Berta E2E", exact: true }).check();
    await expect(memberEditor.getByText("2 ausgewählt", { exact: true })).toBeVisible();
    await memberEditor.getByRole("button", { name: "Änderungen speichern", exact: true }).click();
    await expect(page.getByText("Die Benutzerdaten wurden gespeichert.", { exact: true })).toBeVisible({ timeout: 15_000 });

    const parentInfo = await openMemberInfo(page, SCENARIO.parentDisplayName);
    await expect(parentInfo.getByText(/Athleten: Anna E2E, Berta E2E/)).toBeVisible();
    await closeMemberInfo(parentInfo);

    await editMember(page, SCENARIO.parentDisplayName);
    await expect(memberEditor.getByRole("checkbox", { name: "Anna E2E", exact: true })).toBeChecked();
    await expect(memberEditor.getByRole("checkbox", { name: "Berta E2E", exact: true })).toBeChecked();
    await expect(memberEditor.getByText("Änderungsprotokoll", { exact: true })).toBeVisible({ timeout: 15_000 });
    await memberEditor.getByText("Änderungsprotokoll", { exact: true }).click();
    await expect(memberEditor.getByText("Rolle, Status oder Rechte geändert", { exact: true })).toBeVisible();
    await expect(memberEditor.getByText("Verknüpfte Athleten geändert", { exact: true })).toBeVisible();
    await memberEditor.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expectNoAppError(page);
  });
});

import { expect, test } from "@playwright/test";
import {
  E2E_IDS,
  installAuthenticatedSession,
  installSupabaseMock,
} from "./helpers/supabase-mock.mjs";

function monitorBrowserProblems(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  return problems;
}

async function expectNoHorizontalOverflow(page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflow = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
    ) - viewportWidth;

    const offenders = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (style.position === "fixed") return false;
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.body) {
          const ancestorStyle = window.getComputedStyle(ancestor);
          if (["auto", "scroll"].includes(ancestorStyle.overflowX)) return false;
          ancestor = ancestor.parentElement;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return rect.right > viewportWidth + 2 || rect.left < -2;
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      });

    return { documentOverflow, offenders };
  });

  expect(result, JSON.stringify(result, null, 2)).toEqual({ documentOverflow: 0, offenders: [] });
}

async function expectNamedButtons(page) {
  const unnamed = await page.locator("button:visible").evaluateAll((buttons) => buttons
    .filter((button) => {
      const text = (button.textContent || "").trim();
      const label = button.getAttribute("aria-label") || button.getAttribute("title") || "";
      return !text && !label;
    })
    .map((button) => button.outerHTML.slice(0, 200)));
  expect(unnamed).toEqual([]);
}

async function expectHealthyPage(page, problems, unhandled) {
  await expect(page.locator(".loading-screen")).toHaveCount(0);
  await expect(page.locator(".alert.error")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectNamedButtons(page);
  expect(unhandled).toEqual([]);
  expect(problems).toEqual([]);
}

test.describe("Öffentliche und geschützte Routen", () => {
  test("Login ist auf kleinen und großen Ansichten vollständig bedienbar", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
    await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
    await expect(page.getByLabel("Passwort", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Passwort anzeigen" }).click();
    await expect(page.getByRole("button", { name: "Passwort ausblenden" })).toBeVisible();

    await expectHealthyPage(page, problems, unhandled);
  });

  test("Passwort-Reset bleibt ohne horizontales Überlaufen", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/passwort-vergessen");
    await expect(page.getByRole("heading", { name: "Passwort zurücksetzen" })).toBeVisible();
    await expectHealthyPage(page, problems, unhandled);
  });

  test("Geschützte Route leitet ohne Sitzung zum Login", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/module/athletes");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
    await expectHealthyPage(page, problems, unhandled);
  });
});

test.describe("Authentifizierte, nicht schreibende Modulprüfungen", () => {
  test.beforeEach(async ({ page }) => {
    await installAuthenticatedSession(page);
  });

  const routes = [
    ["/", "Willkommen, E2E Administrator"],
    ["/module/athletes", "Athleten, Trainer & Gruppen"],
    ["/module/exercise_catalog", "Übungskatalog"],
    ["/module/training_blocks", "Trainingsblöcke"],
    ["/module/training_overview", "Trainingsplan-Übersicht"],
    ["/module/training_planning", "Athletenpläne"],
    ["/module/user_management", "Benutzerverwaltung"],
    ["/module/countdown", "Intervall-Countdown"],
  ];

  for (const [route, heading] of routes) {
    test(`${heading}: Seite lädt ohne Fehler und Überlauf`, async ({ page }) => {
      const problems = monitorBrowserProblems(page);
      const unhandled = await installSupabaseMock(page);

      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expectHealthyPage(page, problems, unhandled);
    });
  }

  test("Kopfzeile trennt Home und Benutzermenü sicher", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/");
    const home = page.getByRole("button", { name: "Zur Modulübersicht" }).last();
    const userMenu = page.getByRole("button", { name: "Benutzermenü öffnen" });
    const homeBox = await home.boundingBox();
    const userBox = await userMenu.boundingBox();
    expect(homeBox).not.toBeNull();
    expect(userBox).not.toBeNull();
    expect(homeBox.x + homeBox.width).toBeLessThanOrEqual(userBox.x);

    await userMenu.click();
    await expect(page.getByRole("menu", { name: "Benutzermenü" })).toBeVisible();
    await expect(page.getByText("E2E Administrator", { exact: true })).toBeVisible();
    await expectHealthyPage(page, problems, unhandled);
  });

  test("Trainingsplanung zeigt lange Block- und Übungsnamen ohne Abschneiden", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/module/training_planning");
    await expect(page.getByRole("heading", { name: "Athletenpläne" })).toBeVisible();
    await page.getByLabel("Athlet").selectOption(E2E_IDS.athlete);
    await expect(page.getByRole("heading", { name: "Anna Testathletin" })).toBeVisible();
    await page.getByRole("button", { name: "Block", exact: true }).click();
    await page.getByRole("button", { name: /Sprinttechnik mit koordinativem Schwerpunkt/ }).click();

    const blockTitle = page.getByText(
      "Sprinttechnik mit koordinativem Schwerpunkt und sauberer Beschleunigungsphase",
      { exact: true },
    );
    const exerciseTitle = page.getByText(
      "Beschleunigungslauf mit aktivem Kniehub und vollständiger Streckung",
      { exact: true },
    );
    await expect(blockTitle).toBeVisible();
    await expect(exerciseTitle).toBeVisible();

    const textStyles = await Promise.all([blockTitle, exerciseTitle].map(async (locator) => locator.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        text: (element.textContent || "").trim(),
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        visibility: style.visibility,
      };
    })));
    for (const textStyle of textStyles) {
      expect(textStyle.text.length).toBeGreaterThan(40);
      expect(textStyle.visibility).toBe("visible");
      expect(textStyle.textOverflow).not.toBe("ellipsis");
      expect(textStyle.overflow).not.toBe("hidden");
    }

    await expectHealthyPage(page, problems, unhandled);
  });
});

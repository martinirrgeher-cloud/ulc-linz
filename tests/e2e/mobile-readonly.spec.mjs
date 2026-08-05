import { expect, test } from "@playwright/test";
import {
  E2E_IDS,
  installAuthenticatedSession,
  installSupabaseMock,
} from "./helpers/supabase-mock.mjs";

const longExerciseName = "Beschleunigungslauf mit aktivem Kniehub und vollständiger Streckung";
const longBlockName = "Sprinttechnik mit koordinativem Schwerpunkt und sauberer Beschleunigungsphase";

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

async function swipeLeft(locator) {
  await locator.evaluate((element) => {
    const dispatch = (type, x, buttons) => {
      element.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: x,
        clientY: 260,
        screenX: x,
        screenY: 260,
        button: 0,
        buttons,
      }));
    };

    dispatch("pointerdown", 300, 1);
    dispatch("pointermove", 190, 1);
    dispatch("pointermove", 80, 1);
    dispatch("pointerup", 80, 0);
  });
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

  test("Anmeldeseite führt zur passenden Hilfe", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/login");
    await page.getByRole("link", { name: "Hilfe für diese Seite" }).click();
    await expect(page).toHaveURL(/\/hilfe\/login/);
    await expect(page.getByRole("heading", { name: "Anmeldung und Passwort", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Anmelden", exact: true })).toBeVisible();
    await expectHealthyPage(page, problems, unhandled);
  });
});

test.describe("Authentifizierte, nicht schreibende Modulprüfungen", () => {
  test.beforeEach(async ({ page }) => {
    await installAuthenticatedSession(page);
  });

  const routes = [
    ["/", "Willkommen, E2E Administrator"],
    ["/hilfe", "Handbuch"],
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


  test("Stammdaten bündeln Anlage, Filter und Editoraktionen", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/module/athletes");
    await expect(page.getByRole("heading", { name: "Athleten, Trainer & Gruppen", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Neu", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Athlet anlegen" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Gruppe anlegen" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Trainer anlegen" })).toBeVisible();
    await page.getByRole("button", { name: "Neu", exact: true }).click();

    await page.getByRole("button", { name: "Filtermenü öffnen" }).click();
    await expect(page.getByLabel("Athleten nach Trainingsgruppe filtern")).toBeVisible();
    await expect(page.getByLabel("Athleten sortieren")).toBeVisible();

    await page.getByRole("button", { name: "Anna Testathletin bearbeiten" }).click();
    await expect(page.getByLabel("Änderungen speichern")).toBeVisible();
    await expect(page.getByLabel("Änderungen speichern")).toBeEnabled();
    await expect(page.getByLabel("Bearbeitung schließen")).toBeVisible();
    await expect(page.getByRole("button", { name: "Abbrechen", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Speichern", exact: true })).toHaveCount(0);

    const stickyHeader = page.locator(".management-editor-sticky-header");
    await expect(stickyHeader).toHaveCSS("position", "sticky");
    await expectHealthyPage(page, problems, unhandled);
  });

  test("Stammdaten und Editorreiter wechseln auf Touchgeräten per Wischgeste", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "Wischgesten werden nur in Touch-Projekten geprüft.");
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/module/athletes");
    const surface = page.locator(".masterdata-tab-surface");
    await swipeLeft(surface);
    await expect(page.getByRole("tab", { name: /Gruppen/ })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Leistungsgruppe Sprint und Mehrkampf bearbeiten" }).click();
    const editorForm = page.locator("#training-group-editor-form");
    await swipeLeft(editorForm);
    await expect(page.getByRole("tab", { name: /Training/ })).toHaveAttribute("aria-selected", "true");
    await swipeLeft(editorForm);
    await expect(page.getByRole("tab", { name: /Leistung/ })).toHaveAttribute("aria-selected", "true");

    await expectHealthyPage(page, problems, unhandled);
  });



  test("Statistikseiten verwenden ausschließlich die Rechte des Trainingsmoduls", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/module/kindertraining/statistik");
    await expect(page.getByRole("heading", { name: "Kindertraining", exact: true })).toBeVisible();
    await expectHealthyPage(page, problems, unhandled);

    await page.goto("/module/u12/statistik");
    await expect(page.getByRole("heading", { name: "U12", exact: true })).toBeVisible();
    await expectHealthyPage(page, problems, unhandled);
  });

  test("Übungskatalog zeigt Filter, Kartenaktionen und Parameter vollständig im Viewport", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/module/exercise_catalog");
    await expect(page.getByRole("heading", { name: "Übungskatalog", exact: true })).toBeVisible();

    const filterButton = page.getByRole("button", { name: "Filtermenü öffnen" });
    await expect(filterButton).toBeVisible();

    const card = page.locator(".exercise-card").first();
    const actionItems = card.locator(".exercise-card-actions > *");
    await expect(actionItems).toHaveCount(5);

    const layout = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const card = document.querySelector(".exercise-card");
      const filter = document.querySelector(".exercise-filter-toggle");
      if (!(card instanceof HTMLElement) || !(filter instanceof HTMLElement)) {
        throw new Error("Übungskatalog-Testelemente fehlen.");
      }
      const cardRect = card.getBoundingClientRect();
      const filterRect = filter.getBoundingClientRect();
      const actions = [...card.querySelectorAll(".exercise-card-actions > *")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      const badges = [...card.querySelectorAll(".exercise-card-meta span")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });
      return { viewportWidth, cardRect: { left: cardRect.left, right: cardRect.right }, filterRect: { left: filterRect.left, right: filterRect.right }, actions, badges };
    });

    expect(layout.filterRect.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
    for (const action of layout.actions) {
      expect(action.left).toBeGreaterThanOrEqual(layout.cardRect.left - 1);
      expect(action.right).toBeLessThanOrEqual(layout.cardRect.right + 1);
      expect(action.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
    }
    for (const badge of layout.badges) {
      expect(badge.left).toBeGreaterThanOrEqual(layout.cardRect.left - 1);
      expect(badge.right).toBeLessThanOrEqual(layout.cardRect.right + 1);
    }

    await expectHealthyPage(page, problems, unhandled);
  });

  test("Verwendungs- und Versionsdetails werden erst beim Öffnen geladen", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);
    const rpcRequests = [];
    page.on("request", (request) => {
      if (request.url().includes("/rest/v1/rpc/")) rpcRequests.push(request.url());
    });

    await page.goto("/module/exercise_catalog");
    await expect(page.getByRole("heading", { name: "Übungskatalog", exact: true })).toBeVisible();
    expect(rpcRequests.some((url) => url.includes("exercise_usage_overview"))).toBe(false);

    await page.getByRole("button", { name: /Verwendung von .* anzeigen/ }).first().click();
    await expect(page.getByRole("dialog", { name: longExerciseName })).toBeVisible();
    await expect(page.getByText(longBlockName, { exact: true })).toBeVisible();
    await expect.poll(() => rpcRequests.some((url) => url.includes("exercise_usage_overview"))).toBe(true);
    await page.getByRole("button", { name: "Dialog schließen" }).click();

    await page.goto("/module/training_blocks");
    await expect(page.getByRole("heading", { name: "Trainingsblöcke", exact: true })).toBeVisible();
    expect(rpcRequests.some((url) => url.includes("training_block_versions_overview"))).toBe(false);

    await page.getByRole("button", { name: new RegExp(longBlockName) }).first().click();
    await page.getByText("Versionsverlauf (1)", { exact: true }).click();
    await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
    await expect.poll(() => rpcRequests.some((url) => url.includes("training_block_versions_overview"))).toBe(true);

    await expectHealthyPage(page, problems, unhandled);
  });

  test("Benutzerverwaltung zeigt offene Einladungen und Kontowarnungen mobil", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/module/user_management");
    await page.getByRole("button", { name: /Einladung offen/ }).click();
    await expect(page.getByRole("heading", { name: "Offene Einladung", exact: true })).toBeVisible();
    await expect(page.getByText("Letzter Versand", { exact: true })).toBeVisible();
    await expect(page.getByText("Trainerkonto ohne Trainerverknüpfung", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Erneut senden", exact: true })).toBeVisible();
    await expectHealthyPage(page, problems, unhandled);
  });

  test("Kontextbezogene Hilfe und Handbuchsuche funktionieren", async ({ page }) => {
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.goto("/module/exercise_catalog");
    const headerBox = await page.locator(".app-header").boundingBox();
    const helpButton = page.getByRole("button", { name: "Hilfe für diese Seite" });
    const helpBox = await helpButton.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(helpBox).not.toBeNull();
    expect(helpBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
    await helpButton.click();
    await expect(page).toHaveURL(/\/hilfe\/exercise-catalog/);
    await expect(page.getByRole("heading", { name: "Übungskatalog", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Videos", exact: true })).toBeVisible();

    await page.getByPlaceholder("Hilfe durchsuchen").fill("Einladung");
    await expect(page.getByRole("link", { name: /Benutzerverwaltung/ })).toBeVisible();
    await page.getByRole("link", { name: /Benutzerverwaltung/ }).click();
    await expect(page.getByRole("heading", { name: "Benutzerverwaltung", exact: true })).toBeVisible();
    await expectHealthyPage(page, problems, unhandled);
  });


  test("Desktop-Browser-Emulation bleibt auch unter 320 CSS-Pixeln vollständig sichtbar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1280", "Nur für die Desktop-Browser-Emulation relevant.");
    const problems = monitorBrowserProblems(page);
    const unhandled = await installSupabaseMock(page);

    await page.setViewportSize({ width: 300, height: 760 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Willkommen/ })).toBeVisible();
    const helpLink = page.getByRole("link", { name: "Hilfe & Handbuch" });
    await expect(helpLink).toBeVisible();
    const helpHeight = await helpLink.evaluate((element) => element.getBoundingClientRect().height);
    expect(helpHeight).toBeLessThanOrEqual(44);
    await expectHealthyPage(page, problems, unhandled);
  });

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
    const athleteSelect = page
      .getByRole("region", { name: "Trainingstag und Athlet auswählen", exact: true })
      .locator("select")
      .nth(1);
    await athleteSelect.selectOption(E2E_IDS.athlete);
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

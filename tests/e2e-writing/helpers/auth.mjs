import { expect } from "@playwright/test";
import { E2E } from "./test-data.mjs";

export async function login(page, role = "admin") {
  const user = E2E.users[role];
  if (!user) throw new Error(`Unknown E2E role: ${role}`);

  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(E2E.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();

  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: new RegExp(`Willkommen, ${user.displayName}`) })).toBeVisible({
    timeout: 20_000,
  });
}

export async function expectNoAppError(page) {
  await expect(page.locator(".alert.error")).toHaveCount(0);
  await expect(page.getByText("Ein unerwarteter Fehler ist aufgetreten", { exact: false })).toHaveCount(0);
}

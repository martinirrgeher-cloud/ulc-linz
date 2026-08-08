import { expect } from "@playwright/test";

export function memberCard(page, displayName) {
  return page
    .getByTestId("user-member-card")
    .filter({ has: page.getByRole("heading", { name: displayName, exact: true }) });
}

export async function openMemberInfo(page, displayName) {
  const card = memberCard(page, displayName);
  await expect(card).toBeVisible();
  await card.getByTestId("user-member-info").click();

  const dialog = page.getByTestId("user-member-info-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: displayName, exact: true })).toBeVisible();
  return dialog;
}

export async function closeMemberInfo(dialog) {
  await dialog.getByTestId("user-member-info-close").click();
  await expect(dialog).toBeHidden();
}

export async function editMember(page, displayName) {
  const card = memberCard(page, displayName);
  await expect(card).toBeVisible();
  await card.getByTestId("user-member-edit").click();

  const editor = page.getByTestId("user-member-editor");
  await expect(editor).toBeVisible();
  return editor;
}

export async function simulateMember(page, displayName) {
  const dialog = await openMemberInfo(page, displayName);
  await dialog.getByTestId("user-member-simulate").click();
}

export async function resendMemberInvitation(page, displayName) {
  const dialog = await openMemberInfo(page, displayName);
  await dialog.getByTestId("user-member-resend").click();
  return dialog;
}

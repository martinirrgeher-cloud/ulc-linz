import { expect } from "@playwright/test";

const MASTERDATA = {
  athlete: {
    card: "masterdata-athlete-card",
    edit: "masterdata-athlete-edit",
    editor: "masterdata-athlete-editor",
  },
  trainer: {
    card: "masterdata-trainer-card",
    edit: "masterdata-trainer-edit",
    editor: "masterdata-trainer-editor",
  },
  group: {
    card: "masterdata-group-card",
    edit: "masterdata-group-edit",
    editor: "masterdata-group-editor",
  },
};

export function masterdataCard(page, kind, name) {
  const selectors = MASTERDATA[kind];
  if (!selectors) throw new Error(`Unbekannter Stammdatentyp: ${kind}`);

  return page
    .getByTestId(selectors.card)
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

export async function editMasterdataItem(page, kind, name) {
  const selectors = MASTERDATA[kind];
  if (!selectors) throw new Error(`Unbekannter Stammdatentyp: ${kind}`);

  const card = masterdataCard(page, kind, name);
  await expect(card).toBeVisible();
  await card.getByTestId(selectors.edit).click();

  const editor = page.getByTestId(selectors.editor);
  await expect(editor).toBeVisible();
  return editor;
}

export async function editAthlete(page, name) {
  return editMasterdataItem(page, "athlete", name);
}

export async function editTrainer(page, name) {
  return editMasterdataItem(page, "trainer", name);
}

export async function editGroup(page, name) {
  return editMasterdataItem(page, "group", name);
}

export function masterdataSurface(page) {
  return page.getByTestId("masterdata-tab-surface");
}

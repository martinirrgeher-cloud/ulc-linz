import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "tests/helpers/masterdata.mjs",
  "tests/helpers/user-management.mjs",
  "tests/runtime/app-runtime.spec.mjs",
  "tests/e2e/mobile-readonly.spec.mjs",
  "tests/e2e-writing/core-writing.spec.mjs",
  "src/pages/AthleteManagementPage.tsx",
  "src/features/athletes/AthleteEditor.tsx",
  "src/features/athletes/TrainerEditor.tsx",
  "src/features/athletes/TrainingGroupEditor.tsx",
  "src/pages/UserManagementPage.tsx",
  "src/features/user-management/MemberEditor.tsx",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Test interaction architecture file is missing: ${file}`);
}

for (const file of requiredFiles.filter((file) => file.endsWith(".mjs"))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

const sourceMarkers = new Map([
  ["src/pages/UserManagementPage.tsx", [
    'data-testid="user-member-card"',
    'data-testid="user-member-edit"',
    'data-testid="user-member-info"',
    'data-testid="user-member-info-dialog"',
    'data-testid="user-member-info-close"',
    'data-testid="user-member-resend"',
    'data-testid="user-member-simulate"',
  ]],
  ["src/features/user-management/MemberEditor.tsx", [
    'data-testid="user-member-editor"',
  ]],
  ["src/pages/AthleteManagementPage.tsx", [
    'data-testid="masterdata-tab-surface"',
    'data-testid="masterdata-athlete-card"',
    'data-testid="masterdata-athlete-edit"',
    'data-testid="masterdata-group-card"',
    'data-testid="masterdata-group-edit"',
    'data-testid="masterdata-trainer-card"',
    'data-testid="masterdata-trainer-edit"',
  ]],
  ["src/features/athletes/AthleteEditor.tsx", [
    'data-testid="masterdata-athlete-editor"',
  ]],
  ["src/features/athletes/TrainerEditor.tsx", [
    'data-testid="masterdata-trainer-editor"',
  ]],
  ["src/features/athletes/TrainingGroupEditor.tsx", [
    'data-testid="masterdata-group-editor"',
  ]],
]);

for (const [file, markers] of sourceMarkers) {
  const source = readFileSync(file, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      throw new Error(`Stable test anchor is missing in ${file}: ${marker}`);
    }
  }
}

const userHelper = readFileSync("tests/helpers/user-management.mjs", "utf8");
for (const marker of [
  "memberCard",
  "openMemberInfo",
  "closeMemberInfo",
  "editMember",
  "simulateMember",
  "resendMemberInvitation",
  'getByTestId("user-member-card")',
  'getByTestId("user-member-info")',
  'getByTestId("user-member-edit")',
  'getByTestId("user-member-simulate")',
  'getByTestId("user-member-resend")',
]) {
  if (!userHelper.includes(marker)) throw new Error(`User-management helper marker is missing: ${marker}`);
}

const masterdataHelper = readFileSync("tests/helpers/masterdata.mjs", "utf8");
for (const marker of [
  "editMasterdataItem",
  "editAthlete",
  "editTrainer",
  "editGroup",
  "masterdataSurface",
  '"masterdata-athlete-card"',
  '"masterdata-group-card"',
  '"masterdata-trainer-card"',
]) {
  if (!masterdataHelper.includes(marker)) throw new Error(`Masterdata helper marker is missing: ${marker}`);
}

const coreTests = [
  "tests/runtime/app-runtime.spec.mjs",
  "tests/e2e/mobile-readonly.spec.mjs",
  "tests/e2e-writing/core-writing.spec.mjs",
];

for (const file of coreTests) {
  const source = readFileSync(file, "utf8");
  if (source.includes(".member-card")) {
    throw new Error(`${file} must not address user cards through the CSS class .member-card.`);
  }
  if (source.includes('locator(".athlete-editor")') || source.includes('locator(".trainer-editor")')) {
    throw new Error(`${file} must use stable masterdata editor anchors instead of CSS editor classes.`);
  }
  if (source.includes('locator(".masterdata-tab-surface")')) {
    throw new Error(`${file} must use masterdataSurface() instead of the CSS tab-surface class.`);
  }
}

const runtime = readFileSync("tests/runtime/app-runtime.spec.mjs", "utf8");
for (const marker of [
  'simulateMember(page, "E2E Trainer")',
  'simulateMember(page, "E2E Zweitadmin")',
  'resendMemberInvitation(page, "Offene Einladung")',
]) {
  if (!runtime.includes(marker)) throw new Error(`Runtime shared user interaction is missing: ${marker}`);
}

const readonly = readFileSync("tests/e2e/mobile-readonly.spec.mjs", "utf8");
for (const marker of [
  'editAthlete(page, "Anna Testathletin")',
  'editGroup(page, "Leistungsgruppe Sprint und Mehrkampf")',
  'masterdataSurface(page)',
  'openMemberInfo(page, "Offene Einladung")',
]) {
  if (!readonly.includes(marker)) throw new Error(`Read-only shared interaction is missing: ${marker}`);
}

const writing = readFileSync("tests/e2e-writing/core-writing.spec.mjs", "utf8");
for (const marker of [
  'editMember(page, "E2E Elternteil")',
  'openMemberInfo(page, "E2E Elternteil")',
  'editGroup(page, "E2E Leistungsgruppe")',
  'editTrainer(page, "Tom E2E")',
  "editAthlete(page, athleteFullName())",
]) {
  if (!writing.includes(marker)) throw new Error(`Writing shared interaction is missing: ${marker}`);
}

console.log("S2b stable test interaction architecture verified.");

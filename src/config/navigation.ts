import type { AppModuleKey } from "@/config/modules";

export type AppNavigationGroupKey =
  | "registration"
  | "planning"
  | "documentation"
  | "exercises"
  | "masterData"
  | "statistics"
  | "useful";

export type AppNavigationEntry = {
  key: string;
  label: string;
  route: string;
  moduleKey: AppModuleKey;
};

export type AppNavigationGroup = {
  key: AppNavigationGroupKey;
  label: string;
  entries: AppNavigationEntry[];
};

export const APP_NAVIGATION_GROUPS: AppNavigationGroup[] = [
  {
    key: "registration",
    label: "Anmeldung",
    entries: [
      { key: "kindertraining", label: "Kindertraining", route: "/module/kindertraining", moduleKey: "kindertraining" },
      { key: "u12", label: "U12", route: "/module/u12", moduleKey: "u12" },
      { key: "u14", label: "U14", route: "/module/u14", moduleKey: "u14" },
      { key: "performance", label: "Leistungsgruppe", route: "/module/performance_registration", moduleKey: "performance_registration" },
    ],
  },
  {
    key: "planning",
    label: "Planung",
    entries: [
      { key: "overview", label: "Übersicht", route: "/module/training_overview", moduleKey: "training_overview" },
      { key: "planning", label: "Trainingsplanung", route: "/module/training_planning", moduleKey: "training_planning" },
    ],
  },
  {
    key: "documentation",
    label: "Doku",
    entries: [
      { key: "documentation", label: "Trainingsdokumentation", route: "/module/training_documentation", moduleKey: "training_documentation" },
    ],
  },
  {
    key: "exercises",
    label: "Übungen",
    entries: [
      { key: "catalog", label: "Übungskatalog", route: "/module/exercise_catalog", moduleKey: "exercise_catalog" },
      { key: "blocks", label: "Trainingsblöcke", route: "/module/training_blocks", moduleKey: "training_blocks" },
    ],
  },
  {
    key: "masterData",
    label: "Stammdaten",
    entries: [
      { key: "athletes", label: "Athleten & Gruppen", route: "/module/athletes", moduleKey: "athletes" },
      { key: "dropdowns", label: "Auswahllisten", route: "/module/dropdown_settings", moduleKey: "dropdown_settings" },
      { key: "import", label: "Import/Export", route: "/module/data_import", moduleKey: "data_import" },
      { key: "users", label: "Benutzer", route: "/module/user_management", moduleKey: "user_management" },
    ],
  },
  {
    key: "statistics",
    label: "Statistik",
    entries: [
      { key: "kindertraining-statistics", label: "Kindertraining", route: "/module/kindertraining/statistik", moduleKey: "kindertraining" },
      { key: "u12-statistics", label: "U12", route: "/module/u12/statistik", moduleKey: "u12" },
      { key: "u14-statistics", label: "U14", route: "/module/u14/statistik", moduleKey: "u14" },
    ],
  },
  {
    key: "useful",
    label: "Nützliches",
    entries: [
      { key: "countdown", label: "Intervall-Countdown", route: "/module/countdown", moduleKey: "countdown" },
    ],
  },
];

export const PRIMARY_NAVIGATION_KEYS: AppNavigationGroupKey[] = [
  "registration",
  "planning",
  "documentation",
  "exercises",
];

export const MORE_NAVIGATION_KEYS: AppNavigationGroupKey[] = [
  "masterData",
  "statistics",
  "useful",
];

export function getNavigationGroup(key: AppNavigationGroupKey): AppNavigationGroup {
  const group = APP_NAVIGATION_GROUPS.find((candidate) => candidate.key === key);
  if (!group) throw new Error(`Unbekannte Navigationsgruppe: ${key}`);
  return group;
}

export function getNavigationGroupForPath(pathname: string): AppNavigationGroupKey | null {
  const statistics = getNavigationGroup("statistics");
  if (statistics.entries.some((entry) => pathname === entry.route || pathname.startsWith(`${entry.route}/`))) {
    return "statistics";
  }

  for (const group of APP_NAVIGATION_GROUPS.filter((candidate) => candidate.key !== "statistics")) {
    if (group.entries.some((entry) => pathname === entry.route || pathname.startsWith(`${entry.route}/`))) {
      return group.key;
    }
  }

  return null;
}

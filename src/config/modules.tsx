import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  Dumbbell,
  Timer,
  LayoutDashboard,
  ListChecks,
  ListPlus,
  FileSpreadsheet,
  UserRoundCog,
  Users,
} from "lucide-react";

export type AppModuleKey =
  | "kindertraining"
  | "u12"
  | "u14"
  | "athletes"
  | "performance_registration"
  | "exercise_catalog"
  | "training_planning"
  | "training_overview"
  | "training_blocks"
  | "training_documentation"
  | "dropdown_settings"
  | "data_import"
  | "user_management"
  | "countdown";

export type AppModuleGroupKey =
  | "training"
  | "planning"
  | "exercises"
  | "master_data"
  | "documentation"
  | "useful";

export type AppModuleGroupDefinition = {
  key: AppModuleGroupKey;
  title: string;
  description: string;
  sortOrder: number;
};

export type AppModuleDefinition = {
  key: AppModuleKey;
  title: string;
  description: string;
  route: string;
  icon: ReactNode;
  groupKey: AppModuleGroupKey;
  sortOrder: number;
};

export const APP_MODULE_GROUPS: AppModuleGroupDefinition[] = [
  {
    key: "training",
    title: "Anmeldung",
    description: "Anwesenheit und Trainingsanmeldung",
    sortOrder: 10,
  },
  {
    key: "planning",
    title: "Trainingsplanung",
    description: "Pläne und Übersichten erstellen",
    sortOrder: 20,
  },
  {
    key: "documentation",
    title: "Trainingsdokumentation",
    description: "Training durchführen, rückmelden und auswerten",
    sortOrder: 25,
  },
  {
    key: "exercises",
    title: "Übungen",
    description: "Übungen strukturiert erfassen und verwenden",
    sortOrder: 30,
  },
  {
    key: "useful",
    title: "Nützliches",
    description: "Praktische Werkzeuge für Training und Vereinsalltag",
    sortOrder: 45,
  },
  {
    key: "master_data",
    title: "Stammdaten",
    description: "Athleten, Trainingsgruppen, Trainer und Benutzer",
    sortOrder: 50,
  },
];

export const APP_MODULES: AppModuleDefinition[] = [
  {
    key: "kindertraining",
    title: "Kindertraining",
    description: "Anwesenheit, Notizen und Statistik",
    route: "/module/kindertraining",
    icon: <Users aria-hidden="true" />,
    groupKey: "training",
    sortOrder: 10,
  },
  {
    key: "u12",
    title: "U12",
    description: "Anwesenheit, Notizen und Statistik",
    route: "/module/u12",
    icon: <Users aria-hidden="true" />,
    groupKey: "training",
    sortOrder: 20,
  },
  {
    key: "u14",
    title: "U14",
    description: "Anwesenheit, Notizen und Statistik",
    route: "/module/u14",
    icon: <Users aria-hidden="true" />,
    groupKey: "training",
    sortOrder: 30,
  },
  {
    key: "performance_registration",
    title: "Leistungsgruppen",
    description: "Trainingsanmeldung und Wochenübersicht",
    route: "/module/performance_registration",
    icon: <CalendarCheck aria-hidden="true" />,
    groupKey: "training",
    sortOrder: 40,
  },
  {
    key: "training_documentation",
    title: "Trainingsdokumentation",
    description: "Durchführung und Rückmeldung erfassen",
    route: "/module/training_documentation",
    icon: <Dumbbell aria-hidden="true" />,
    groupKey: "documentation",
    sortOrder: 10,
  },
  {
    key: "training_planning",
    title: "Trainingsplanung",
    description: "Trainingspläne erstellen",
    route: "/module/training_planning",
    icon: <Dumbbell aria-hidden="true" />,
    groupKey: "planning",
    sortOrder: 10,
  },
  {
    key: "training_overview",
    title: "Trainingsplan-Übersicht",
    description: "Anmeldestatus, Pläne und Dauer wochenweise",
    route: "/module/training_overview",
    icon: <ListChecks aria-hidden="true" />,
    groupKey: "planning",
    sortOrder: 20,
  },
  {
    key: "training_blocks",
    title: "Trainingsblöcke",
    description: "Wiederverwendbare Vorlagen verwalten",
    route: "/module/training_blocks",
    icon: <ClipboardCheck aria-hidden="true" />,
    groupKey: "exercises",
    sortOrder: 20,
  },
  {
    key: "exercise_catalog",
    title: "Übungskatalog",
    description: "Übungen strukturiert erfassen und verwenden",
    route: "/module/exercise_catalog",
    icon: <BookOpen aria-hidden="true" />,
    groupKey: "exercises",
    sortOrder: 10,
  },
  {
    key: "countdown",
    title: "Intervall-Countdown",
    description: "Belastung und Pause mit Sprachansagen steuern",
    route: "/module/countdown",
    icon: <Timer aria-hidden="true" />,
    groupKey: "useful",
    sortOrder: 10,
  },
  {
    key: "athletes",
    title: "Athleten, Trainer & Gruppen",
    description: "Athleten, Trainer und Trainingsgruppen verwalten",
    route: "/module/athletes",
    icon: <LayoutDashboard aria-hidden="true" />,
    groupKey: "master_data",
    sortOrder: 10,
  },
  {
    key: "dropdown_settings",
    title: "Auswahllisten",
    description: "Dropdownwerte für Übungen und Planung verwalten",
    route: "/module/dropdown_settings",
    icon: <ListPlus aria-hidden="true" />,
    groupKey: "master_data",
    sortOrder: 20,
  },
  {
    key: "data_import",
    title: "Datenimport/-export",
    description: "Übungen und Athleten per Excel importieren oder exportieren",
    route: "/module/data_import",
    icon: <FileSpreadsheet aria-hidden="true" />,
    groupKey: "master_data",
    sortOrder: 30,
  },
  {
    key: "user_management",
    title: "Benutzerverwaltung",
    description: "Benutzer, Rollen und Modulrechte verwalten",
    route: "/module/user_management",
    icon: <UserRoundCog aria-hidden="true" />,
    groupKey: "master_data",
    sortOrder: 40,
  },
];

export function getModuleDefinition(
  moduleKey: string | undefined,
): AppModuleDefinition | undefined {
  return APP_MODULES.find((module) => module.key === moduleKey);
}

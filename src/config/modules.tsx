import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarCheck,
  ChartNoAxesCombined,
  ClipboardCheck,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  Settings,
  UserRoundCog,
  Users,
} from "lucide-react";

export type AppModuleKey =
  | "kindertraining"
  | "kindertraining_statistics"
  | "athletes"
  | "performance_registration"
  | "exercise_catalog"
  | "exercise_management"
  | "training_planning"
  | "training_overview"
  | "training_blocks"
  | "training_documentation"
  | "user_management";

export type AppModuleGroupKey =
  | "training"
  | "planning"
  | "exercises"
  | "statistics"
  | "master_data";

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
    title: "Training",
    description: "Anwesenheit, Anmeldung und Dokumentation",
    sortOrder: 10,
  },
  {
    key: "planning",
    title: "Trainingsplanung",
    description: "Pläne, Übersichten und wiederverwendbare Blöcke",
    sortOrder: 20,
  },
  {
    key: "exercises",
    title: "Übungen",
    description: "Übungen ansehen und verwalten",
    sortOrder: 30,
  },
  {
    key: "statistics",
    title: "Statistik",
    description: "Entwicklung, Anwesenheit und Einsätze",
    sortOrder: 40,
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
    key: "performance_registration",
    title: "Anmeldung Leistungsgruppe",
    description: "Wochenweise Trainingsanmeldung",
    route: "/module/performance_registration",
    icon: <CalendarCheck aria-hidden="true" />,
    groupKey: "training",
    sortOrder: 20,
  },
  {
    key: "training_documentation",
    title: "Trainingsdokumentation",
    description: "Durchführung und Rückmeldung erfassen",
    route: "/module/training_documentation",
    icon: <Dumbbell aria-hidden="true" />,
    groupKey: "training",
    sortOrder: 30,
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
    description: "Pläne und Belastung überblicken",
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
    groupKey: "planning",
    sortOrder: 30,
  },
  {
    key: "exercise_catalog",
    title: "Übungskatalog",
    description: "Übungen suchen und ansehen",
    route: "/module/exercise_catalog",
    icon: <BookOpen aria-hidden="true" />,
    groupKey: "exercises",
    sortOrder: 10,
  },
  {
    key: "exercise_management",
    title: "Übungspflege",
    description: "Übungen und Medien verwalten",
    route: "/module/exercise_management",
    icon: <Settings aria-hidden="true" />,
    groupKey: "exercises",
    sortOrder: 20,
  },
  {
    key: "kindertraining_statistics",
    title: "Kindertraining",
    description: "Trainings-, Athleten- und Trainerstatistik",
    route: "/module/kindertraining/statistik",
    icon: <ChartNoAxesCombined aria-hidden="true" />,
    groupKey: "statistics",
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
    key: "user_management",
    title: "Benutzerverwaltung",
    description: "Benutzer, Rollen und Modulrechte verwalten",
    route: "/module/user_management",
    icon: <UserRoundCog aria-hidden="true" />,
    groupKey: "master_data",
    sortOrder: 20,
  },
];

export function getModuleDefinition(
  moduleKey: string | undefined,
): AppModuleDefinition | undefined {
  return APP_MODULES.find((module) => module.key === moduleKey);
}

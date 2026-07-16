import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarCheck,
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
  | "athletes"
  | "performance_registration"
  | "exercise_catalog"
  | "exercise_management"
  | "training_planning"
  | "training_overview"
  | "training_blocks"
  | "training_documentation"
  | "user_management";

export type AppModuleDefinition = {
  key: AppModuleKey;
  title: string;
  description: string;
  route: string;
  icon: ReactNode;
};

export const APP_MODULES: AppModuleDefinition[] = [
  {
    key: "kindertraining",
    title: "Kindertraining",
    description: "Anwesenheit, Notizen und Statistik",
    route: "/module/kindertraining",
    icon: <Users aria-hidden="true" />,
  },
  {
    key: "athletes",
    title: "Athleten",
    description: "Athleten und Gruppenzuordnungen verwalten",
    route: "/module/athletes",
    icon: <LayoutDashboard aria-hidden="true" />,
  },
  {
    key: "performance_registration",
    title: "Anmeldung Leistungsgruppe",
    description: "Wochenweise Trainingsanmeldung",
    route: "/module/performance_registration",
    icon: <CalendarCheck aria-hidden="true" />,
  },
  {
    key: "exercise_catalog",
    title: "Übungskatalog",
    description: "Übungen suchen und ansehen",
    route: "/module/exercise_catalog",
    icon: <BookOpen aria-hidden="true" />,
  },
  {
    key: "exercise_management",
    title: "Übungspflege",
    description: "Übungen und Medien verwalten",
    route: "/module/exercise_management",
    icon: <Settings aria-hidden="true" />,
  },
  {
    key: "training_planning",
    title: "Trainingsplanung",
    description: "Trainingspläne erstellen",
    route: "/module/training_planning",
    icon: <Dumbbell aria-hidden="true" />,
  },
  {
    key: "training_overview",
    title: "Trainingsplan-Übersicht",
    description: "Pläne und Belastung überblicken",
    route: "/module/training_overview",
    icon: <ListChecks aria-hidden="true" />,
  },
  {
    key: "training_blocks",
    title: "Trainingsblöcke",
    description: "Wiederverwendbare Vorlagen verwalten",
    route: "/module/training_blocks",
    icon: <ClipboardCheck aria-hidden="true" />,
  },
  {
    key: "training_documentation",
    title: "Trainingsdokumentation",
    description: "Durchführung und Rückmeldung erfassen",
    route: "/module/training_documentation",
    icon: <Dumbbell aria-hidden="true" />,
  },
  {
    key: "user_management",
    title: "Benutzerverwaltung",
    description: "Benutzer, Rollen und Modulrechte verwalten",
    route: "/module/user_management",
    icon: <UserRoundCog aria-hidden="true" />,
  },
];

export function getModuleDefinition(
  moduleKey: string | undefined,
): AppModuleDefinition | undefined {
  return APP_MODULES.find((module) => module.key === moduleKey);
}

import type { AppRole } from "@/types/auth";
import type {
  ManagedModule,
  ManagedPermission,
} from "@/features/user-management/types";

export type PermissionTemplateKey =
  | "children_trainer"
  | "performance_trainer"
  | "athlete"
  | "parent";

export type PermissionTemplate = {
  key: PermissionTemplateKey;
  label: string;
  description: string;
  role: AppRole;
  view: readonly string[];
  edit: readonly string[];
};

export const PERMISSION_TEMPLATES: readonly PermissionTemplate[] = [
  {
    key: "children_trainer",
    label: "Kindertrainer",
    description: "Anmeldung und Statistik für Kindertraining, U12 und U14.",
    role: "trainer",
    view: [
      "kindertraining",
      "u12",
      "u14",
      "kindertraining_statistics",
      "u12_statistics",
      "u14_statistics",
      "countdown",
    ],
    edit: ["kindertraining", "u12", "u14", "countdown"],
  },
  {
    key: "performance_trainer",
    label: "Leistungstrainer",
    description: "Leistungsanmeldung, Planung, Dokumentation und Übungsverwaltung.",
    role: "trainer",
    view: [
      "performance_registration",
      "training_planning",
      "training_overview",
      "training_documentation",
      "exercise_catalog",
      "training_blocks",
      "athletes",
      "countdown",
    ],
    edit: [
      "performance_registration",
      "training_planning",
      "training_documentation",
      "exercise_catalog",
      "training_blocks",
      "athletes",
      "countdown",
    ],
  },
  {
    key: "athlete",
    label: "Athlet",
    description: "Eigene Anmeldung, Trainingsübersicht und Trainingsrückmeldung.",
    role: "athlete",
    view: [
      "performance_registration",
      "training_overview",
      "training_documentation",
      "countdown",
    ],
    edit: ["performance_registration", "training_documentation", "countdown"],
  },
  {
    key: "parent",
    label: "Elternteil",
    description: "Lesender Zugriff auf Kinderanmeldung und zugehörige Statistik.",
    role: "parent",
    view: [
      "kindertraining",
      "u12",
      "u14",
      "kindertraining_statistics",
      "u12_statistics",
      "u14_statistics",
    ],
    edit: [],
  },
] as const;

export function permissionTemplate(
  template: PermissionTemplate,
  modules: ManagedModule[],
): ManagedPermission[] {
  const view = new Set(template.view);
  const edit = new Set(template.edit);
  return modules.map((module) => ({
    moduleKey: module.key,
    canView: view.has(module.key) || edit.has(module.key),
    canEdit: edit.has(module.key),
  }));
}

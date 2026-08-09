import type { ExerciseParameterGroupKey } from "@/features/exercise-catalog/parameter-groups";

export type DropdownListKey = "category" | "subcategory" | "material" | "difficulty" | "planning_parameter";
export type DropdownInputType = "number" | "text";

export type DropdownParameterGroup = ExerciseParameterGroupKey;

export type DropdownSettingOption = {
  id: string | null;
  key: string;
  label: string;
  unit: string;
  inputType: DropdownInputType;
  stepValue: number | null;
  parameterGroup: DropdownParameterGroup;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
};

export type DropdownSettingsData = Record<DropdownListKey, DropdownSettingOption[]>;

export type DropdownSettingInput = {
  label: string;
  unit: string;
  inputType: DropdownInputType;
  stepValue: string;
  parameterGroup: DropdownParameterGroup;
  sortOrder: string;
};

export const DROPDOWN_LISTS: Array<{
  key: DropdownListKey;
  title: string;
  description: string;
}> = [
  { key: "category", title: "Kategorien", description: "Hauptkategorien im Übungskatalog" },
  { key: "subcategory", title: "Unterkategorien", description: "Feinere Einteilung der Übungen" },
  { key: "material", title: "Material", description: "Mehrfach auswählbares Trainingsmaterial" },
  { key: "difficulty", title: "Schwierigkeit", description: "Schwierigkeitsgrade für Übungen" },
  { key: "planning_parameter", title: "Planungsparameter", description: "Wertefelder für Übungen und Trainingsblöcke" },
];

export function optionToInput(option: DropdownSettingOption | null): DropdownSettingInput {
  return {
    label: option?.label ?? "",
    unit: option?.unit ?? "",
    inputType: option?.inputType ?? "number",
    stepValue: option?.stepValue?.toString() ?? "1",
    parameterGroup: option?.parameterGroup ?? "execution",
    sortOrder: option?.sortOrder?.toString() ?? "100",
  };
}

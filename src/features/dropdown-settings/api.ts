import { callJsonRpc } from "@/lib/supabase-rpc";
import { isRecord, numberOrNull } from "@/lib/json-value";
import { parseExerciseParameterGroup } from "@/features/exercise-catalog/parameter-groups";
import type {
  DropdownListKey,
  DropdownSettingInput,
  DropdownSettingOption,
  DropdownSettingsData,
} from "@/features/dropdown-settings/types";

function parseOptions(value: unknown): DropdownSettingOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== "string" || typeof item.label !== "string") return [];
    const inputType: DropdownSettingOption["inputType"] = item.input_type === "text" ? "text" : "number";
    return [{
      id: typeof item.id === "string" ? item.id : null,
      key: item.key,
      label: item.label,
      unit: typeof item.unit === "string" ? item.unit : "",
      inputType,
      stepValue: numberOrNull(item.step_value),
      parameterGroup: parseExerciseParameterGroup(item.parameter_group),
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
      isActive: item.is_active !== false,
      usageCount: typeof item.usage_count === "number" ? item.usage_count : 0,
    }];
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "de"));
}

export async function loadDropdownSettings(organizationId: string): Promise<DropdownSettingsData> {
  const data = await callJsonRpc("dropdown_settings_overview", { p_organization_id: organizationId });
  if (!isRecord(data)) throw new Error("Die Auswahllisten konnten nicht gelesen werden.");
  return {
    category: parseOptions(data.category),
    subcategory: parseOptions(data.subcategory),
    material: parseOptions(data.material),
    difficulty: parseOptions(data.difficulty),
    planning_parameter: parseOptions(data.planning_parameter),
  };
}

export async function saveDropdownSetting(
  organizationId: string,
  listKey: DropdownListKey,
  option: DropdownSettingOption | null,
  values: DropdownSettingInput,
): Promise<void> {
  const stepValue = values.stepValue.trim() ? Number(values.stepValue.replace(",", ".")) : null;
  const sortOrder = values.sortOrder.trim() ? Number.parseInt(values.sortOrder, 10) : 100;
  if (stepValue !== null && (!Number.isFinite(stepValue) || stepValue <= 0)) {
    throw new Error("Die Schrittweite muss größer als 0 sein.");
  }
  if (!Number.isFinite(sortOrder)) throw new Error("Die Sortierung ist ungültig.");

  await callJsonRpc("save_dropdown_setting", {
    p_organization_id: organizationId,
    p_list_key: listKey,
    p_option_id: option?.id ?? null,
    p_option_key: option?.key ?? null,
    p_label: values.label.trim(),
    p_unit: listKey === "planning_parameter" ? values.unit.trim() : "",
    p_input_type: listKey === "planning_parameter" ? values.inputType : "text",
    p_step_value: listKey === "planning_parameter" && values.inputType === "number" ? stepValue : null,
    p_sort_order: sortOrder,
    p_parameter_group: listKey === "planning_parameter" ? values.parameterGroup : "execution",
  });
}

export async function setDropdownSettingActive(
  organizationId: string,
  listKey: DropdownListKey,
  option: DropdownSettingOption,
  isActive: boolean,
): Promise<void> {
  await callJsonRpc("set_dropdown_setting_active", {
    p_organization_id: organizationId,
    p_list_key: listKey,
    p_option_id: option.id,
    p_option_key: option.key,
    p_is_active: isActive,
  });
}

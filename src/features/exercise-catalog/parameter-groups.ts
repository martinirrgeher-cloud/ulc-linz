export type ExerciseParameterGroupKey = "volume" | "distance_geometry" | "time_recovery" | "load" | "execution";

export const EXERCISE_PARAMETER_GROUPS: Array<{ key: ExerciseParameterGroupKey; label: string }> = [
  { key: "volume", label: "Umfang" },
  { key: "distance_geometry", label: "Strecke & Geometrie" },
  { key: "time_recovery", label: "Zeit & Erholung" },
  { key: "load", label: "Belastung" },
  { key: "execution", label: "Ausführung" },
];

export function parseExerciseParameterGroup(value: unknown): ExerciseParameterGroupKey {
  return value === "volume"
    || value === "distance_geometry"
    || value === "time_recovery"
    || value === "load"
    || value === "execution"
    ? value
    : "execution";
}

export function exerciseParameterGroupLabel(key: ExerciseParameterGroupKey): string {
  return EXERCISE_PARAMETER_GROUPS.find((group) => group.key === key)?.label ?? "Ausführung";
}

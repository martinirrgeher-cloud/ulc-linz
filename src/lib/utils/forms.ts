import { Exercise } from "@/modules/uebungskatalog/types/ExerciseTypes";

export function normalize(s: string): string {
  return (s || "").trim();
}
export function normalizeLower(s: string): string {
  return normalize(s).toLowerCase();
}
export function toNumberOrNull(s: string): number | null {
  const t = (s ?? "").trim();
  if (t === "") return null;
  const num = Number(t.replace(",", "."));
  return isNaN(num) ? null : num;
}

export function validateExerciseDraft(draft: Partial<Exercise>): string[] {
  const errs: string[] = [];
  if (!normalize(draft.name ?? "")) errs.push("Name fehlt.");
  if (!normalize(draft.hauptgruppe ?? "")) errs.push("Hauptgruppe fehlt.");
  if (!normalize(draft.untergruppe ?? "")) errs.push("Untergruppe fehlt.");
  if (draft.menge !== null && draft.menge !== undefined && Number.isNaN(draft.menge)) {
    errs.push("Menge ist keine Zahl.");
  }
  const diff = draft.difficulty;
  if (diff !== 1 && diff !== 2 && diff !== 3) errs.push("Ungültige Schwierigkeit (1-3).");
  return errs;
}

export function isDuplicateName(
  list: Exercise[],
  name: string,
  hauptgruppe: string,
  untergruppe: string,
  excludeId?: string
): boolean {
  const n = normalizeLower(name);
  return list.some(u =>
    (!excludeId || u.id !== excludeId) &&
    normalizeLower(u.name) === n &&
    u.hauptgruppe === hauptgruppe &&
    u.untergruppe === untergruppe
  );
}

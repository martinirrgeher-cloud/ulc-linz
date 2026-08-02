import type { Exercise } from "@/features/exercise-catalog/types";

export type ExerciseNameCandidate = {
  exercise: Exercise;
  score: number;
  exactNormalized: boolean;
};

export function normalizeExerciseName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function bigrams(value: string): string[] {
  if (value.length < 2) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}

export function exerciseNameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeExerciseName(left);
  const normalizedRight = normalizeExerciseName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftPairs = bigrams(normalizedLeft);
  const rightPairs = bigrams(normalizedRight);
  const available = new Map<string, number>();
  rightPairs.forEach((pair) => available.set(pair, (available.get(pair) ?? 0) + 1));

  let overlap = 0;
  leftPairs.forEach((pair) => {
    const count = available.get(pair) ?? 0;
    if (count <= 0) return;
    overlap += 1;
    available.set(pair, count - 1);
  });

  return (2 * overlap) / (leftPairs.length + rightPairs.length);
}

export function findExerciseNameCandidates(
  name: string,
  exercises: Exercise[],
  currentExerciseId: string | null,
  limit = 4,
): ExerciseNameCandidate[] {
  const normalized = normalizeExerciseName(name);
  if (normalized.length < 2) return [];

  return exercises
    .filter((exercise) => exercise.id !== currentExerciseId)
    .map((exercise) => {
      const exerciseNormalized = normalizeExerciseName(exercise.name);
      return {
        exercise,
        score: exerciseNameSimilarity(name, exercise.name),
        exactNormalized: normalized === exerciseNormalized,
      };
    })
    .filter((candidate) => candidate.exactNormalized || candidate.score >= 0.55)
    .sort((left, right) => right.score - left.score || left.exercise.name.localeCompare(right.exercise.name, "de"))
    .slice(0, limit);
}

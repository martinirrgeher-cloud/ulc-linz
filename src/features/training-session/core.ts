import type {
  AthleteNameSort,
  TrainingDraft,
  TrainingParticipant,
  TrainingSession,
} from "@/features/training-session/types";

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
}

function addDays(value: string, amount: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}

function isoWeekday(value: string): number {
  const weekday = parseIsoDate(value).getDay();
  return weekday === 0 ? 7 : weekday;
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseIsoDate(value));
}

export function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function isRegularDate(value: string, weekdays: number[]): boolean {
  return weekdays.includes(isoWeekday(value));
}

export function findTrainingDate(
  fromDate: string,
  direction: -1 | 1,
  weekdays: number[],
  specialDates: string[],
  includeStart = false,
): string {
  let candidate = includeStart ? fromDate : addDays(fromDate, direction);
  const specialDateSet = new Set(specialDates);

  for (let index = 0; index < 740; index += 1) {
    if (isRegularDate(candidate, weekdays) || specialDateSet.has(candidate)) return candidate;
    candidate = addDays(candidate, direction);
  }

  return fromDate;
}

export function makeDraft(
  session: TrainingSession,
  groupTrainerIds: string[] = [],
): TrainingDraft {
  const trainerIds = session.id
    ? session.trainerIds
    : session.trainerIds.filter((trainerId) => groupTrainerIds.includes(trainerId));

  return {
    state: session.state,
    note: session.note,
    attendance: Object.fromEntries(
      session.participants.map((participant) => [participant.athleteId, participant.status]),
    ),
    environment: session.environment,
    trainerIds,
  };
}

export function draftSignature(
  draft: TrainingDraft,
  participants: TrainingParticipant[],
): string {
  return JSON.stringify({
    state: draft.state,
    note: draft.note,
    attendance: participants.map((participant) => [
      participant.athleteId,
      draft.attendance[participant.athleteId] ?? "open",
    ]),
    environment: draft.environment,
    trainerIds: [...draft.trainerIds].sort(),
  });
}

export function readStoredAthleteNameSort(storageKey: string): AthleteNameSort {
  try {
    return window.localStorage.getItem(storageKey) === "lastName"
      ? "lastName"
      : "firstName";
  } catch {
    return "firstName";
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "de-AT", { sensitivity: "base" });
}

export function sortParticipants(
  participants: TrainingParticipant[],
  mode: AthleteNameSort,
): TrainingParticipant[] {
  return [...participants].sort((left, right) => {
    if (mode === "lastName") {
      return (
        compareText(left.lastName, right.lastName) ||
        compareText(left.firstName, right.firstName)
      );
    }

    return (
      compareText(left.firstName, right.firstName) ||
      compareText(left.lastName, right.lastName)
    );
  });
}

export function athleteDisplayName(
  participant: TrainingParticipant,
  mode: AthleteNameSort,
): string {
  return mode === "lastName"
    ? `${participant.lastName} ${participant.firstName}`
    : `${participant.firstName} ${participant.lastName}`;
}

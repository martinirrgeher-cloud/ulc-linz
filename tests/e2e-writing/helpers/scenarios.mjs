import { E2E } from "./test-data.mjs";

export const WRITING_SCENARIOS = Object.freeze({
  masterdata: Object.freeze({
    groupName: "E2E UI Gruppe",
    groupShortName: "E2E-UI",
    athlete: Object.freeze({ firstName: "Eva", lastName: "E2E UI" }),
    trainer: Object.freeze({
      firstName: "Tina",
      lastName: "E2E UI",
      email: "tina.e1b2@example.test",
    }),
    parentDisplayName: "E2E Elternteil",
    writeKeys: Object.freeze([
      "training_groups:new:E2E UI Gruppe",
      "athletes:new:Eva E2E UI",
      "trainers:new:Tina E2E UI",
      "organization_members:user:E2E Elternteil",
    ]),
  }),
  collaboration: Object.freeze({
    groupName: "E2E Leistungsgruppe",
    trainerName: "Tom E2E",
    realtimeAthlete: Object.freeze({ firstName: "Rita", lastName: "E4 Realtime" }),
    writeKeys: Object.freeze([
      `edit_lock:training_group:${E2E.groupId}`,
      `edit_lock:trainer:${E2E.trainerId}`,
      "athletes:new:Rita E4 Realtime",
    ]),
  }),
  catalog: Object.freeze({
    exerciseName: "E2E UI Sprintlauf",
    blockName: "E2E UI Sprintblock",
    writeKeys: Object.freeze([
      "exercises:new:E2E UI Sprintlauf",
      "training_blocks:new:E2E UI Sprintblock",
      "organization_exercise_categories:category:acceleration",
    ]),
  }),
  registration: Object.freeze({
    writeKeys: Object.freeze([
      `performance_registration:athlete:${E2E.athleteId}`,
    ]),
  }),
  planning: Object.freeze({
    date: "2026-08-03",
    title: "E2E Montagstraining",
    writeKeys: Object.freeze([
      `training_plan:${E2E.groupId}:${E2E.athleteId}:2026-08-03`,
    ]),
  }),
});

export function fullName(person) {
  return `${person.firstName} ${person.lastName}`;
}

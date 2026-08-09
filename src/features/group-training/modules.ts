export type GroupTrainingModuleKey = "u12" | "u14";

export type GroupTrainingModuleDefinition = {
  moduleKey: GroupTrainingModuleKey;
  title: "U12" | "U14";
  trainingRoute: string;
  statisticsRoute: string;
  sortStorageKey: string;
};

export const U12_TRAINING_MODULE: GroupTrainingModuleDefinition = Object.freeze({
  moduleKey: "u12",
  title: "U12",
  trainingRoute: "/module/u12",
  statisticsRoute: "/module/u12/statistik",
  sortStorageKey: "ulc-group-training-name-sort-u12",
});

export const U14_TRAINING_MODULE: GroupTrainingModuleDefinition = Object.freeze({
  moduleKey: "u14",
  title: "U14",
  trainingRoute: "/module/u14",
  statisticsRoute: "/module/u14/statistik",
  sortStorageKey: "ulc-group-training-name-sort-u14",
});

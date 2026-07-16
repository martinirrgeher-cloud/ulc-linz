// src/constants/modules.ts
export const MODULES = {
  ATHLETEN: "ATHLETEN",
  ANMELDUNG: "ANMELDUNG",
  KINDERTRAINING: "KINDERTRAINING",
  UEBUNGSKATALOG: "UEBUNGSKATALOG",
  UEBUNGSPFLEGE: "UEBUNGSPFLEGE",
  TRAININGSPLAN: "TRAININGSPLAN",
} as const;

export type ModuleKey = keyof typeof MODULES;
export type ModuleValue = typeof MODULES[ModuleKey];

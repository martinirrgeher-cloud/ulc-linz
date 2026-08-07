import { loadAthleteManagement } from "@/features/athletes/api";
import type {
  Athlete,
  AthleteContact,
  LinkableUser,
  TrainingGroup,
} from "@/features/athletes/types";
import { applyAthleteImport, applyExerciseImport, type PreparedImportRow, type PreparedMissingOption } from "@/features/data-import/api";
import { loadDropdownSettings } from "@/features/dropdown-settings/api";
import type {
  DropdownListKey,
  DropdownSettingsData,
} from "@/features/dropdown-settings/types";
import { loadExerciseCatalog } from "@/features/exercise-catalog/api";
import {
  createEmptyExerciseInput,
  exerciseToInput,
  type Exercise,
  type ExerciseCatalogData,
  type ExerciseParameterDefinition,
} from "@/features/exercise-catalog/types";
import type {
  AthleteImportDraft,
  ExerciseImportDraft,
  ExerciseParameterImport,
  ImportPreviewRow,
  ImportRunResult,
  WorkbookSheet,
} from "@/features/data-import/types";
import { workbookSheetRecords, type DownloadWorkbookDefinition } from "@/features/data-import/workbook";

const EXERCISE_SHEET = "Übungen";
const PARAMETER_SHEET = "Planungsparameter";
const ATHLETE_SHEET = "Athleten";
const CONTACT_SHEET = "Kontakte";
const MIN_EXERCISE_PARAMETER_SLOTS = 4;
const MIN_EXERCISE_MATERIAL_SLOTS = 6;
const MIN_EXERCISE_GROUP_SLOTS = 4;
const MIN_SIMILAR_EXERCISE_SLOTS = 6;
const MIN_ATHLETE_CONTACT_SLOTS = 3;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("de-AT").replace(/\s+/g, " ");
}

function list(value: string): string[] {
  return [...new Set(value.split(/[;|]/).map((item) => item.trim()).filter(Boolean))];
}

function listFromColumns(
  values: Record<string, string>,
  legacyHeaders: string[],
  numberedPrefixes: string[],
): string[] {
  const result = legacyHeaders.flatMap((header) => list(values[header] ?? ""));
  const numbered = Object.entries(values)
    .filter(([header]) => numberedPrefixes.some((prefix) => normalized(header).startsWith(normalized(prefix))))
    .sort(([left], [right]) => left.localeCompare(right, "de-AT", { numeric: true }))
    .flatMap(([, value]) => list(value));
  return [...new Set([...result, ...numbered].map((item) => item.trim()).filter(Boolean))];
}

function parseBoolean(value: string): boolean | null {
  if (!value.trim()) return null;
  const normalizedValue = normalized(value);
  if (["ja", "j", "true", "wahr", "1", "aktiv", "x"].includes(normalizedValue)) return true;
  if (["nein", "n", "false", "falsch", "0", "inaktiv", "-"].includes(normalizedValue)) return false;
  return null;
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function text(values: Record<string, string>, ...headers: string[]): string {
  for (const header of headers) {
    if (header in values) return values[header] ?? "";
  }
  return "";
}

function hasHeader(values: Record<string, string>, ...headers: string[]): boolean {
  return headers.some((header) => header in values);
}

function hasNumberedPrefix(values: Record<string, string>, ...prefixes: string[]): boolean {
  return Object.keys(values).some((header) => prefixes.some((prefix) => normalized(header).startsWith(normalized(prefix))));
}

function uniqueMap<T>(items: T[], label: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [normalized(label(item)), item]));
}

function exerciseKey(name: string): string {
  return normalized(name);
}

function athleteKey(firstName: string, lastName: string, birthYear: number | null): string {
  return `${normalized(firstName)}|${normalized(lastName)}|${birthYear ?? ""}`;
}

function severity(errors: string[], warnings: string[]): "ready" | "warning" | "error" {
  if (errors.length > 0) return "error";
  if (warnings.length > 0) return "warning";
  return "ready";
}

type ExerciseParameterGroup = {
  reference: string;
  exerciseId: string;
  exerciseName: string;
  rowNumber: number;
  parameters: ExerciseParameterImport[];
};

function exerciseReference(exerciseId: string, exerciseName: string): string {
  return exerciseId.trim() ? `id:${exerciseId.trim()}` : `name:${exerciseKey(exerciseName)}`;
}

function parameterGroups(sheets: WorkbookSheet[]): ExerciseParameterGroup[] {
  const result = new Map<string, ExerciseParameterGroup>();
  workbookSheetRecords(sheets, PARAMETER_SHEET).forEach(({ rowNumber, values }) => {
    const exerciseId = text(values, "Übungs-ID", "Uebungs-ID", "Exercise-ID");
    const exerciseName = text(values, "Übungsbezeichnung", "Uebungsbezeichnung");
    const label = text(values, "Parameter");
    if ((!exerciseId && !exerciseName) || !label) return;
    const inputText = normalized(text(values, "Eingabetyp"));
    const inputType = inputText ? (inputText === "text" || inputText === "textfeld" ? "text" : "number") : "";
    const parameter: ExerciseParameterImport = {
      key: text(values, "Parameter-Schlüssel", "Parameter-Schluessel", "Parameter-Key"),
      label,
      unit: text(values, "Einheit"),
      inputType,
      defaultValue: text(values, "Standardwert"),
      minValue: parseNumber(text(values, "Minimum")),
      maxValue: parseNumber(text(values, "Maximum")),
      stepValue: parseNumber(text(values, "Schrittweite")),
      isRequired: parseBoolean(text(values, "Pflichtfeld")) === true,
      sortOrder: Math.trunc(parseNumber(text(values, "Sortierung")) ?? 100),
    };
    const reference = exerciseReference(exerciseId, exerciseName);
    const current = result.get(reference);
    if (current) current.parameters.push(parameter);
    else result.set(reference, { reference, exerciseId, exerciseName, rowNumber, parameters: [parameter] });
  });
  return [...result.values()];
}

function numberedSlots(values: Record<string, string>, prefix: string): number[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}\\s+(\\d+)(?:\\s|$)`, "i");
  return [...new Set(Object.keys(values).flatMap((header) => {
    const match = header.trim().match(pattern);
    return match?.[1] ? [Number.parseInt(match[1], 10)] : [];
  }))].filter((slot) => Number.isFinite(slot) && slot > 0).sort((left, right) => left - right);
}

function inlineExerciseParameters(values: Record<string, string>): ExerciseParameterImport[] {
  return numberedSlots(values, "Parameter").flatMap((slot) => {
    const label = text(values, `Parameter ${slot}`, `Planungsparameter ${slot}`);
    const key = text(values, `Parameter ${slot} Schlüssel`, `Parameter ${slot} Schluessel`, `Parameter ${slot} Key`);
    if (!label && !key) return [];
    const inputText = normalized(text(values, `Parameter ${slot} Eingabetyp`));
    const inputType = inputText ? (inputText === "text" || inputText === "textfeld" ? "text" : "number") : "";
    return [{
      key,
      label,
      unit: text(values, `Parameter ${slot} Einheit`),
      inputType,
      defaultValue: text(values, `Parameter ${slot} Standardwert`),
      minValue: parseNumber(text(values, `Parameter ${slot} Minimum`)),
      maxValue: parseNumber(text(values, `Parameter ${slot} Maximum`)),
      stepValue: parseNumber(text(values, `Parameter ${slot} Schrittweite`)),
      isRequired: parseBoolean(text(values, `Parameter ${slot} Pflichtfeld`)) === true,
      sortOrder: slot,
    }];
  });
}

function exerciseDraftFromExisting(exercise: Exercise, catalog: ExerciseCatalogData): ExerciseImportDraft {
  const groupNames = exercise.groupIds.flatMap((groupId) => {
    const group = catalog.groups.find((candidate) => candidate.id === groupId);
    return group ? [group.name] : [];
  });
  const similarExerciseNames = exercise.similarExerciseIds.flatMap((exerciseId) => {
    const candidate = catalog.exercises.find((item) => item.id === exerciseId);
    return candidate ? [candidate.name] : [];
  });
  return {
    name: exercise.name,
    category: exercise.categoryTitle,
    subcategory: exercise.subcategory ?? "",
    goal: exercise.goal ?? "",
    description: exercise.description ?? "",
    coachingCues: exercise.coachingCues ?? "",
    commonMistakes: exercise.commonMistakes ?? "",
    equipment: [...exercise.equipment],
    groupNames,
    difficulty: exercise.difficultyLabel ?? "",
    similarExerciseNames,
    videoUrl: exercise.videoUrl ?? "",
    isActive: exercise.isActive,
    parameters: [],
  };
}

export function createExercisePreview(
  sheets: WorkbookSheet[],
  catalog: ExerciseCatalogData,
  canCreateOptions: boolean,
): ImportPreviewRow<ExerciseImportDraft>[] {
  const groupedParameters = parameterGroups(sheets);
  const parametersByReference = new Map(groupedParameters.map((group) => [group.reference, group]));
  const categories = uniqueMap(catalog.categories, (item) => item.title);
  const subcategories = uniqueMap(catalog.subcategories, (item) => item.label);
  const materials = uniqueMap(catalog.materials, (item) => item.label);
  const difficulties = uniqueMap(catalog.difficulties, (item) => item.label);
  const parameterOptions = uniqueMap(catalog.parameterOptions, (item) => item.label);
  const groups = uniqueMap(catalog.groups, (item) => item.name);
  catalog.groups.forEach((group) => {
    if (group.shortName) groups.set(normalized(group.shortName), group);
  });
  const existingByName = uniqueMap(catalog.exercises, (item) => item.name);
  const existingById = new Map(catalog.exercises.map((item) => [item.id, item]));
  const exerciseRecords = workbookSheetRecords(sheets, EXERCISE_SHEET);
  const fileExerciseNames = new Set(
    exerciseRecords
      .map(({ values }) => normalized(text(values, "Bezeichnung", "Name")))
      .filter(Boolean),
  );
  const availableSimilarNames = new Set([
    ...catalog.exercises.map((item) => normalized(item.name)),
    ...fileExerciseNames,
  ]);
  const fileKeys = new Set<string>();
  const consumedParameterReferences = new Set<string>();

  function buildRow(
    rowNumber: number,
    values: Record<string, string>,
  ): ImportPreviewRow<ExerciseImportDraft> {
    const exerciseId = text(values, "Übungs-ID", "Uebungs-ID", "Exercise-ID");
    const importedName = text(values, "Bezeichnung", "Name");
    const existing = (exerciseId ? existingById.get(exerciseId) : null) ?? existingByName.get(exerciseKey(importedName)) ?? null;
    const base = existing ? exerciseDraftFromExisting(existing, catalog) : null;
    const reference = exerciseReference(exerciseId || existing?.id || "", importedName || existing?.name || "");
    const parameterGroup = parametersByReference.get(reference)
      ?? parametersByReference.get(exerciseReference("", importedName || existing?.name || ""));
    const inlineParameters = inlineExerciseParameters(values);
    if (parameterGroup) consumedParameterReferences.add(parameterGroup.reference);
    const importedEquipment = listFromColumns(values, ["Material"], ["Material "]);
    const importedGroups = listFromColumns(values, ["Trainingsgruppen", "Gruppen"], ["Trainingsgruppe ", "Gruppe "]);
    const hasDifficultyColumn = hasHeader(values, "Schwierigkeitsgrad", "Schwierigkeit");
    const hasSimilarColumns = hasHeader(values, "Ähnliche Übungen", "Aehnliche Uebungen")
      || hasNumberedPrefix(values, "Ähnliche Übung ", "Aehnliche Uebung ");
    const importedSimilarExercises = listFromColumns(
      values,
      ["Ähnliche Übungen", "Aehnliche Uebungen"],
      ["Ähnliche Übung ", "Aehnliche Uebung "],
    );
    const draft: ExerciseImportDraft = {
      name: importedName || base?.name || "",
      category: text(values, "Kategorie") || base?.category || "",
      subcategory: text(values, "Unterkategorie") || base?.subcategory || "",
      goal: text(values, "Trainingsziel", "Ziel") || base?.goal || "",
      description: text(values, "Beschreibung") || base?.description || "",
      coachingCues: text(values, "Ausführungshinweise", "Ausfuehrungshinweise") || base?.coachingCues || "",
      commonMistakes: text(values, "Häufige Fehler", "Haeufige Fehler") || base?.commonMistakes || "",
      equipment: importedEquipment,
      groupNames: importedGroups,
      difficulty: hasDifficultyColumn ? text(values, "Schwierigkeitsgrad", "Schwierigkeit") : base?.difficulty ?? "",
      similarExerciseNames: hasSimilarColumns ? importedSimilarExercises : base?.similarExerciseNames ?? [],
      videoUrl: text(values, "Video-URL", "Video URL") || base?.videoUrl || "",
      isActive: parseBoolean(text(values, "Aktiv")) ?? base?.isActive ?? null,
      parameters: inlineParameters.length > 0 ? inlineParameters : parameterGroup?.parameters ?? [],
    };
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!draft.name) errors.push("Bezeichnung fehlt.");
    if (!draft.category) errors.push("Kategorie fehlt.");
    const key = existing?.id ? `id:${existing.id}` : exerciseKey(draft.name);
    if (key && fileKeys.has(key)) errors.push("Die Übung kommt in der Datei mehrfach vor.");
    if (key) fileKeys.add(key);
    if (exerciseId && !existingById.has(exerciseId)) errors.push(`Die Übungs-ID „${exerciseId}“ wurde nicht gefunden.`);
    if (draft.category && !categories.has(normalized(draft.category))) {
      (canCreateOptions ? warnings : errors).push(`Kategorie „${draft.category}“ ist nicht vorhanden.`);
    }
    if (draft.subcategory && !subcategories.has(normalized(draft.subcategory))) {
      (canCreateOptions ? warnings : errors).push(`Unterkategorie „${draft.subcategory}“ ist nicht vorhanden.`);
    }
    if (draft.difficulty && !difficulties.has(normalized(draft.difficulty))) {
      (canCreateOptions ? warnings : errors).push(`Schwierigkeitsgrad „${draft.difficulty}“ ist nicht vorhanden.`);
    }
    draft.equipment.forEach((item) => {
      if (!materials.has(normalized(item))) (canCreateOptions ? warnings : errors).push(`Material „${item}“ ist nicht vorhanden.`);
    });
    draft.groupNames.forEach((item) => {
      if (!groups.has(normalized(item))) errors.push(`Trainingsgruppe „${item}“ ist nicht vorhanden.`);
    });
    draft.similarExerciseNames.forEach((item) => {
      const relatedExisting = existingByName.get(normalized(item));
      if (normalized(item) === normalized(draft.name) || (existing && relatedExisting?.id === existing.id)) {
        errors.push(`Die Übung „${draft.name}“ kann nicht mit sich selbst als ähnlich verknüpft werden.`);
      } else if (!availableSimilarNames.has(normalized(item))) {
        errors.push(`Ähnliche Übung „${item}“ wurde weder im Katalog noch in dieser Importdatei gefunden.`);
      }
    });
    draft.parameters.forEach((parameter) => {
      if (!parameterOptions.has(normalized(parameter.label))) {
        (canCreateOptions ? warnings : errors).push(`Planungsparameter „${parameter.label}“ ist nicht vorhanden.`);
      }
      if (parameter.minValue !== null && parameter.maxValue !== null && parameter.minValue > parameter.maxValue) {
        errors.push(`Beim Parameter „${parameter.label}“ ist Minimum größer als Maximum.`);
      }
    });
    if (draft.videoUrl) {
      try { new URL(draft.videoUrl); } catch { errors.push("Die Video-URL ist ungültig."); }
    }
    if (existing) warnings.unshift("Eine bestehende Übung wurde erkannt.");
    return {
      rowNumber,
      key,
      label: draft.name || `Zeile ${rowNumber}`,
      value: draft,
      action: errors.length > 0 ? "skip" : existing ? "skip" : "create",
      existingId: existing?.id ?? null,
      severity: severity(errors, warnings),
      warnings,
      errors,
    };
  }

  const rows: ImportPreviewRow<ExerciseImportDraft>[] = exerciseRecords.map(({ rowNumber, values }) => buildRow(rowNumber, values));
  groupedParameters.filter((group) => !consumedParameterReferences.has(group.reference)).forEach((group) => {
    const existing = (group.exerciseId ? existingById.get(group.exerciseId) : null) ?? existingByName.get(exerciseKey(group.exerciseName)) ?? null;
    const errors: string[] = [];
    const warnings = ["Nur Planungsparameter werden aktualisiert; übrige Übungsdaten bleiben unverändert."];
    if (!existing) errors.push("Für diese Planungsparameter wurde keine bestehende Übung gefunden. Ergänze die Übung im Blatt „Übungen“ oder verwende eine gültige Übungs-ID.");
    group.parameters.forEach((parameter) => {
      if (!parameterOptions.has(normalized(parameter.label))) {
        (canCreateOptions ? warnings : errors).push(`Planungsparameter „${parameter.label}“ ist nicht vorhanden.`);
      }
      if (parameter.minValue !== null && parameter.maxValue !== null && parameter.minValue > parameter.maxValue) {
        errors.push(`Beim Parameter „${parameter.label}“ ist Minimum größer als Maximum.`);
      }
    });
    const draft = existing ? exerciseDraftFromExisting(existing, catalog) : {
      name: group.exerciseName,
      category: "",
      subcategory: "",
      goal: "",
      description: "",
      coachingCues: "",
      commonMistakes: "",
      equipment: [],
      groupNames: [],
      difficulty: "",
      similarExerciseNames: [],
      videoUrl: "",
      isActive: null,
      parameters: [],
    };
    draft.parameters = group.parameters;
    rows.push({
      rowNumber: group.rowNumber,
      key: existing?.id ? `id:${existing.id}` : group.reference,
      label: existing?.name || group.exerciseName || `Zeile ${group.rowNumber}`,
      value: draft,
      action: errors.length > 0 ? "skip" : "update",
      existingId: existing?.id ?? null,
      severity: severity(errors, warnings),
      warnings,
      errors,
    });
  });
  return rows;
}

type AthleteContactGroup = {
  reference: string;
  athleteId: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  rowNumber: number;
  contacts: AthleteContact[];
};

function athleteReference(athleteId: string, firstName: string, lastName: string, birthYear: number | null): string {
  return athleteId.trim() ? `id:${athleteId.trim()}` : `key:${athleteKey(firstName, lastName, birthYear)}`;
}

function contactGroups(sheets: WorkbookSheet[]): AthleteContactGroup[] {
  const result = new Map<string, AthleteContactGroup>();
  workbookSheetRecords(sheets, CONTACT_SHEET).forEach(({ rowNumber, values }, index) => {
    const athleteId = text(values, "Athlet-ID", "Athleten-ID");
    const firstName = text(values, "Athlet Vorname", "Vorname");
    const lastName = text(values, "Athlet Nachname", "Nachname");
    const birthYearValue = parseNumber(text(values, "Geburtsjahr"));
    const birthYear = birthYearValue === null ? null : Math.trunc(birthYearValue);
    const contactName = text(values, "Kontaktname", "Name");
    const phone = text(values, "Telefon");
    if ((!athleteId && (!firstName || !lastName)) || !contactName || !phone) return;
    const reference = athleteReference(athleteId, firstName, lastName, birthYear);
    const contact: AthleteContact = {
      id: text(values, "Kontakt-ID") || null,
      contactName,
      relationship: text(values, "Beziehung"),
      phone,
      isEmergency: parseBoolean(text(values, "Notfallkontakt")) !== false,
      priority: Math.trunc(parseNumber(text(values, "Priorität", "Prioritaet")) ?? index + 1),
      notes: text(values, "Notizen"),
    };
    const current = result.get(reference);
    if (current) current.contacts.push(contact);
    else result.set(reference, { reference, athleteId, firstName, lastName, birthYear, rowNumber, contacts: [contact] });
  });
  return [...result.values()];
}

function inlineAthleteContacts(values: Record<string, string>, existingContacts: AthleteContact[]): AthleteContact[] {
  return numberedSlots(values, "Kontakt").flatMap((slot) => {
    const id = text(values, `Kontakt ${slot} ID`, `Kontakt ${slot} Kontakt-ID`) || null;
    const existing = id ? existingContacts.find((contact) => contact.id === id) ?? null : null;
    const contactName = text(values, `Kontakt ${slot} Name`, `Kontakt ${slot} Kontaktname`) || existing?.contactName || "";
    const phone = text(values, `Kontakt ${slot} Telefon`) || existing?.phone || "";
    const relationship = text(values, `Kontakt ${slot} Beziehung`) || existing?.relationship || "";
    const notes = text(values, `Kontakt ${slot} Notizen`) || existing?.notes || "";
    const emergency = parseBoolean(text(values, `Kontakt ${slot} Notfallkontakt`));
    const priority = parseNumber(text(values, `Kontakt ${slot} Priorität`, `Kontakt ${slot} Prioritaet`));
    const hasValues = Boolean(id || contactName || phone || relationship || notes || emergency !== null || priority !== null);
    if (!hasValues) return [];
    return [{
      id,
      contactName,
      relationship,
      phone,
      isEmergency: emergency ?? existing?.isEmergency ?? true,
      priority: Math.trunc(priority ?? existing?.priority ?? slot),
      notes,
    }];
  });
}

function athleteDraftFromExisting(athlete: Athlete, linkableUsers: LinkableUser[]): AthleteImportDraft {
  const linkedUser = linkableUsers.find((user) => user.userId === athlete.linkedUserId || user.athleteId === athlete.id);
  return {
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    birthYear: athlete.birthYear,
    groupNames: athlete.groups.map((group) => group.name),
    notes: athlete.notes ?? "",
    isActive: athlete.isActive,
    linkedUserEmail: linkedUser?.email ?? "",
    contacts: [],
  };
}

export function createAthletePreview(
  sheets: WorkbookSheet[],
  athletes: Athlete[],
  groups: TrainingGroup[],
  linkableUsers: LinkableUser[],
): ImportPreviewRow<AthleteImportDraft>[] {
  const groupedContacts = contactGroups(sheets);
  const contactsByReference = new Map(groupedContacts.map((group) => [group.reference, group]));
  const existingByKey = new Map(athletes.map((athlete) => [athleteKey(athlete.firstName, athlete.lastName, athlete.birthYear), athlete]));
  const existingById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const groupMap = uniqueMap(groups, (group) => group.name);
  groups.forEach((group) => { if (group.shortName) groupMap.set(normalized(group.shortName), group); });
  const userMap = uniqueMap(linkableUsers, (user) => user.email);
  const fileKeys = new Set<string>();
  const consumedContactReferences = new Set<string>();
  const currentYear = new Date().getFullYear();

  const rows: ImportPreviewRow<AthleteImportDraft>[] = workbookSheetRecords(sheets, ATHLETE_SHEET).map(({ rowNumber, values }) => {
    const athleteId = text(values, "Athlet-ID", "Athleten-ID");
    const rawBirthYear = parseNumber(text(values, "Geburtsjahr"));
    const importedFirstName = text(values, "Vorname");
    const importedLastName = text(values, "Nachname");
    const importedBirthYear = rawBirthYear === null ? null : Math.trunc(rawBirthYear);
    const existing = (athleteId ? existingById.get(athleteId) : null)
      ?? existingByKey.get(athleteKey(importedFirstName, importedLastName, importedBirthYear))
      ?? null;
    const base = existing ? athleteDraftFromExisting(existing, linkableUsers) : null;
    const reference = athleteReference(athleteId || existing?.id || "", importedFirstName || existing?.firstName || "", importedLastName || existing?.lastName || "", importedBirthYear ?? existing?.birthYear ?? null);
    const contactGroup = contactsByReference.get(reference)
      ?? contactsByReference.get(athleteReference("", importedFirstName || existing?.firstName || "", importedLastName || existing?.lastName || "", importedBirthYear ?? existing?.birthYear ?? null));
    if (contactGroup) consumedContactReferences.add(contactGroup.reference);
    const importedGroups = listFromColumns(values, ["Gruppen", "Trainingsgruppen"], ["Gruppe ", "Trainingsgruppe "]);
    const inlineContacts = inlineAthleteContacts(values, existing?.contacts ?? []);
    const importedContacts = mergeAthleteContacts(contactGroup?.contacts ?? [], inlineContacts);
    const draft: AthleteImportDraft = {
      firstName: importedFirstName || base?.firstName || "",
      lastName: importedLastName || base?.lastName || "",
      birthYear: importedBirthYear ?? base?.birthYear ?? null,
      groupNames: importedGroups,
      notes: text(values, "Notizen") || base?.notes || "",
      isActive: parseBoolean(text(values, "Aktiv")) ?? base?.isActive ?? null,
      linkedUserEmail: text(values, "Benutzer-E-Mail", "Benutzer Email", "E-Mail") || base?.linkedUserEmail || "",
      contacts: importedContacts,
    };
    const key = existing?.id ? `id:${existing.id}` : athleteKey(draft.firstName, draft.lastName, draft.birthYear);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!draft.firstName) errors.push("Vorname fehlt.");
    if (!draft.lastName) errors.push("Nachname fehlt.");
    if (draft.birthYear !== null && (draft.birthYear < 1900 || draft.birthYear > currentYear + 1)) errors.push("Das Geburtsjahr ist ungültig.");
    if (fileKeys.has(key)) errors.push("Der Athlet kommt in der Datei mehrfach vor.");
    fileKeys.add(key);
    if (athleteId && !existingById.has(athleteId)) errors.push(`Die Athlet-ID „${athleteId}“ wurde nicht gefunden.`);
    draft.groupNames.forEach((groupName) => { if (!groupMap.has(normalized(groupName))) errors.push(`Trainingsgruppe „${groupName}“ ist nicht vorhanden.`); });
    if (draft.linkedUserEmail && !userMap.has(normalized(draft.linkedUserEmail))) warnings.push(`Für „${draft.linkedUserEmail}“ wurde kein bestehender Benutzer gefunden; die bestehende Verknüpfung bleibt erhalten.`);
    draft.contacts.forEach((contact, index) => {
      if (!contact.contactName) errors.push(`Bei Kontakt ${index + 1} fehlt der Name.`);
      if (!contact.phone) errors.push(`Bei Kontakt ${index + 1} fehlt die Telefonnummer.`);
    });
    if (existing) warnings.unshift("Ein bestehender Athlet wurde erkannt.");
    return {
      rowNumber,
      key,
      label: `${draft.firstName} ${draft.lastName}`.trim() || `Zeile ${rowNumber}`,
      value: draft,
      action: errors.length > 0 ? "skip" : existing ? "skip" : "create",
      existingId: existing?.id ?? null,
      severity: severity(errors, warnings),
      warnings,
      errors,
    };
  });

  groupedContacts.filter((group) => !consumedContactReferences.has(group.reference)).forEach((group) => {
    const existing = (group.athleteId ? existingById.get(group.athleteId) : null)
      ?? existingByKey.get(athleteKey(group.firstName, group.lastName, group.birthYear))
      ?? null;
    const errors: string[] = [];
    const warnings = ["Nur Kontaktdaten werden ergänzt oder aktualisiert; übrige Athletendaten bleiben unverändert."];
    if (!existing) errors.push("Für diese Kontakte wurde kein bestehender Athlet gefunden. Verwende eine gültige Athlet-ID oder ergänze den Athleten im Blatt „Athleten“.");
    const draft = existing ? athleteDraftFromExisting(existing, linkableUsers) : {
      firstName: group.firstName,
      lastName: group.lastName,
      birthYear: group.birthYear,
      groupNames: [],
      notes: "",
      isActive: null,
      linkedUserEmail: "",
      contacts: [],
    };
    draft.contacts = group.contacts;
    rows.push({
      rowNumber: group.rowNumber,
      key: existing?.id ? `id:${existing.id}` : group.reference,
      label: existing ? `${existing.firstName} ${existing.lastName}` : `${group.firstName} ${group.lastName}`.trim(),
      value: draft,
      action: errors.length > 0 ? "skip" : "update",
      existingId: existing?.id ?? null,
      severity: severity(errors, warnings),
      warnings,
      errors,
    });
  });
  return rows;
}

function collectMissingOptions(
  rows: ImportPreviewRow<ExerciseImportDraft>[],
  settings: DropdownSettingsData,
): PreparedMissingOption[] {
  const existing = {
    category: new Set(settings.category.map((item) => normalized(item.label))),
    subcategory: new Set(settings.subcategory.map((item) => normalized(item.label))),
    material: new Set(settings.material.map((item) => normalized(item.label))),
    difficulty: new Set(settings.difficulty.map((item) => normalized(item.label))),
    planning_parameter: new Set(settings.planning_parameter.map((item) => normalized(item.label))),
  };
  const queue: Array<{ listKey: DropdownListKey; label: string; parameter?: ExerciseParameterImport }> = [];

  rows.filter((row) => row.action !== "skip" && row.errors.length === 0).forEach((row) => {
    const values: Array<{ listKey: DropdownListKey; label: string; parameter?: ExerciseParameterImport }> = [
      { listKey: "category", label: row.value.category },
      ...(row.value.subcategory ? [{ listKey: "subcategory" as const, label: row.value.subcategory }] : []),
      ...(row.value.difficulty ? [{ listKey: "difficulty" as const, label: row.value.difficulty }] : []),
      ...row.value.equipment.map((label) => ({ listKey: "material" as const, label })),
      ...row.value.parameters.map((parameter) => ({
        listKey: "planning_parameter" as const,
        label: parameter.label,
        parameter,
      })),
    ];

    values.forEach((value) => {
      const key = normalized(value.label);
      if (!key || existing[value.listKey].has(key)) return;
      existing[value.listKey].add(key);
      queue.push(value);
    });
  });

  return queue.map((item) => ({
    list_key: item.listKey,
    label: item.label,
    option_key: item.listKey === "planning_parameter" ? item.parameter?.key || null : null,
    unit: item.listKey === "planning_parameter" ? item.parameter?.unit ?? "" : "",
    input_type: item.listKey === "planning_parameter" ? item.parameter?.inputType || "number" : "text",
    step_value: item.listKey === "planning_parameter" && item.parameter?.inputType !== "text"
      ? item.parameter?.stepValue ?? 1
      : null,
    sort_order: item.parameter?.sortOrder ?? 100,
  }));
}

function mapGroups(groupNames: string[], groups: Array<{ id: string; name: string; shortName: string | null }>): string[] {
  const map = uniqueMap(groups, (group) => group.name);
  groups.forEach((group) => {
    if (group.shortName) map.set(normalized(group.shortName), group);
  });
  return groupNames.flatMap((name) => {
    const group = map.get(normalized(name));
    return group ? [group.id] : [];
  });
}

function parameterDefinitions(
  parameters: ExerciseParameterImport[],
  catalog: ExerciseCatalogData,
): ExerciseParameterDefinition[] {
  const options = uniqueMap(catalog.parameterOptions, (option) => option.label);
  return parameters.map((parameter, index) => {
    const option = options.get(normalized(parameter.label));
    return {
      key: parameter.key || option?.key || "",
      label: option?.label ?? parameter.label,
      unit: parameter.unit || option?.unit || "",
      inputType: parameter.inputType || option?.inputType || "number",
      defaultValue: parameter.defaultValue,
      minValue: parameter.minValue,
      maxValue: parameter.maxValue,
      stepValue: parameter.stepValue ?? option?.stepValue ?? null,
      isRequired: parameter.isRequired,
      sortOrder: parameter.sortOrder || index + 1,
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

function mergeParameterDefinitions(
  existing: ExerciseParameterDefinition[],
  imported: ExerciseParameterDefinition[],
): ExerciseParameterDefinition[] {
  const merged = existing.map((parameter) => ({ ...parameter }));
  imported.forEach((parameter) => {
    const index = merged.findIndex((candidate) => candidate.key === parameter.key || normalized(candidate.label) === normalized(parameter.label));
    if (index >= 0) merged[index] = { ...merged[index]!, ...parameter };
    else merged.push(parameter);
  });
  return merged.sort((left, right) => left.sortOrder - right.sortOrder);
}

function preparedParameters(parameters: ExerciseParameterDefinition[]): Array<Record<string, unknown>> {
  return [...parameters]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((parameter, index) => ({
      parameter_key: parameter.key,
      label: parameter.label.trim(),
      unit: parameter.unit.trim(),
      input_type: parameter.inputType,
      default_value: parameter.defaultValue.trim() || null,
      min_value: parameter.minValue,
      max_value: parameter.maxValue,
      step_value: parameter.stepValue,
      is_required: parameter.isRequired,
      sort_order: index + 1,
    }));
}

type SimilarExerciseReference = {
  id: string | null;
  name: string | null;
};

function similarExerciseReferences(
  names: string[],
  rows: ImportPreviewRow<ExerciseImportDraft>[],
  catalog: ExerciseCatalogData,
): SimilarExerciseReference[] {
  const existingByName = uniqueMap(catalog.exercises, (exercise) => exercise.name);
  const importedByName = new Map(
    rows
      .filter((row) => row.errors.length === 0)
      .map((row) => [normalized(row.value.name), row] as const),
  );

  return names.map((name) => {
    const imported = importedByName.get(normalized(name));
    if (imported?.existingId) return { id: imported.existingId, name: imported.value.name };
    if (imported && imported.action !== "skip") return { id: null, name: imported.value.name };
    const existing = existingByName.get(normalized(name));
    if (existing) return { id: existing.id, name: existing.name };
    throw new Error(`Ähnliche Übung „${name}“ wird in diesem Import nicht angelegt und ist im Katalog nicht vorhanden.`);
  });
}

export async function runExerciseImport(
  organizationId: string,
  importId: string,
  rows: ImportPreviewRow<ExerciseImportDraft>[],
  createOptions: boolean,
): Promise<ImportRunResult> {
  const catalog = await loadExerciseCatalog(organizationId, true);
  const settings = createOptions ? await loadDropdownSettings(organizationId) : null;
  const missingOptions = settings ? collectMissingOptions(rows, settings) : [];
  const categoryMap = uniqueMap(catalog.categories, (item) => item.title);
  const exerciseMap = new Map(catalog.exercises.map((item) => [item.id, item]));

  const preparedRows: PreparedImportRow[] = rows.map((row) => {
    if (row.action === "skip" || row.errors.length > 0) {
      return {
        row_number: row.rowNumber,
        label: row.label,
        action: "skip",
        skip_message: row.errors.length > 0 ? row.errors.join(" ") : "Übersprungen.",
      };
    }

    const existing: Exercise | null = row.existingId ? exerciseMap.get(row.existingId) ?? null : null;
    if (row.action === "update" && !existing) {
      throw new Error(`Zeile ${row.rowNumber}: Die bestehende Übung wurde nicht mehr gefunden. Bitte Vorschau neu laden.`);
    }

    const category = categoryMap.get(normalized(row.value.category));
    if (!category && !createOptions) {
      throw new Error(`Zeile ${row.rowNumber}: Kategorie „${row.value.category}“ wurde nicht gefunden.`);
    }

    const base = existing ? exerciseToInput(existing) : createEmptyExerciseInput(category?.key ?? "");
    const importedParameters = row.value.parameters.length > 0
      ? mergeParameterDefinitions(base.parameters, parameterDefinitions(row.value.parameters, catalog))
      : base.parameters;

    const values = {
      name: row.value.name,
      category_label: row.value.category,
      subcategory: row.value.subcategory || base.subcategory || null,
      goal: row.value.goal || base.goal || null,
      description: row.value.description || base.description || null,
      coaching_cues: row.value.coachingCues || base.coachingCues || null,
      common_mistakes: row.value.commonMistakes || base.commonMistakes || null,
      equipment: row.value.equipment.length > 0 ? row.value.equipment : base.equipment,
      group_ids: row.value.groupNames.length > 0 ? mapGroups(row.value.groupNames, catalog.groups) : base.groupIds,
      difficulty_label: row.value.difficulty || null,
      similar_exercise_refs: similarExerciseReferences(row.value.similarExerciseNames, rows, catalog),
      video_url: row.value.videoUrl || base.videoUrl || null,
      is_active: row.value.isActive ?? base.isActive,
      parameters: preparedParameters(importedParameters),
    };

    return {
      row_number: row.rowNumber,
      label: row.label,
      action: row.action,
      existing_id: existing?.id ?? null,
      expected_updated_at: existing?.updatedAt ?? null,
      values,
    } as PreparedImportRow;
  });

  return applyExerciseImport(organizationId, importId, preparedRows, missingOptions);
}

function mergeAthleteContacts(existing: AthleteContact[], imported: AthleteContact[]): AthleteContact[] {
  const merged = existing.map((contact) => ({ ...contact }));
  imported.forEach((contact) => {
    const index = merged.findIndex((candidate) => (
      (contact.id && candidate.id === contact.id)
      || (!contact.id && normalized(candidate.contactName) === normalized(contact.contactName) && normalized(candidate.phone) === normalized(contact.phone))
    ));
    if (index >= 0) merged[index] = { ...merged[index]!, ...contact, id: merged[index]!.id };
    else merged.push({ ...contact, priority: contact.priority || merged.length + 1 });
  });
  return merged.map((contact, index) => ({ ...contact, priority: contact.priority || index + 1 }));
}

export async function runAthleteImport(
  organizationId: string,
  importId: string,
  rows: ImportPreviewRow<AthleteImportDraft>[],
): Promise<ImportRunResult> {
  const data = await loadAthleteManagement(organizationId, true);
  const athleteMap = new Map(data.athletes.map((athlete) => [athlete.id, athlete]));
  const userMap = uniqueMap(data.linkableUsers, (user) => user.email);

  const preparedRows: PreparedImportRow[] = rows.map((row) => {
    if (row.action === "skip" || row.errors.length > 0) {
      return {
        row_number: row.rowNumber,
        label: row.label,
        action: "skip",
        skip_message: row.errors.length > 0 ? row.errors.join(" ") : "Übersprungen.",
      };
    }

    const existing = row.existingId ? athleteMap.get(row.existingId) ?? null : null;
    if (row.action === "update" && !existing) {
      throw new Error(`Zeile ${row.rowNumber}: Der bestehende Athlet wurde nicht mehr gefunden. Bitte Vorschau neu laden.`);
    }

    const linkedUser = row.value.linkedUserEmail ? userMap.get(normalized(row.value.linkedUserEmail)) : null;
    const values = {
      first_name: row.value.firstName,
      last_name: row.value.lastName,
      birth_year: row.value.birthYear,
      notes: row.value.notes || existing?.notes || null,
      is_active: row.value.isActive ?? existing?.isActive ?? true,
      linked_user_id: linkedUser?.userId ?? existing?.linkedUserId ?? null,
      group_ids: row.value.groupNames.length > 0
        ? mapGroups(row.value.groupNames, data.groups)
        : existing?.groups.map((group) => group.id) ?? [],
      contacts: (
        row.value.contacts.length > 0
          ? mergeAthleteContacts(existing?.contacts ?? [], row.value.contacts)
          : existing?.contacts ?? []
      ).map((contact, index) => ({
        contact_name: contact.contactName.trim(),
        relationship: contact.relationship.trim() || null,
        phone: contact.phone.trim(),
        is_emergency: contact.isEmergency,
        priority: contact.priority || index + 1,
        notes: contact.notes.trim() || null,
      })),
    };

    return {
      row_number: row.rowNumber,
      label: row.label,
      action: row.action,
      existing_id: existing?.id ?? null,
      expected_updated_at: existing?.updatedAt ?? null,
      values,
    } as PreparedImportRow;
  });

  return applyAthleteImport(organizationId, importId, preparedRows);
}

function listRows(columns: string[][]): string[][] {
  const length = Math.max(1, ...columns.map((column) => column.length));
  return Array.from({ length }, (_, index) => columns.map((column) => column[index] ?? ""));
}

function definedRange(column: string, values: string[]): string {
  return `$${column}$2:$${column}$${Math.max(2, values.length + 1)}`;
}

function workbookColumn(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function exerciseWorkbookDefinition(catalog: ExerciseCatalogData, exercises: Exercise[]): DownloadWorkbookDefinition {
  const sortedUnique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "de-AT"));
  const categoryValues = sortedUnique([
    ...catalog.categories.filter((item) => item.isActive !== false).map((item) => item.title),
    ...exercises.map((exercise) => exercise.categoryTitle),
  ]);
  const subcategoryValues = sortedUnique([
    ...catalog.subcategories.filter((item) => item.isActive).map((item) => item.label),
    ...exercises.flatMap((exercise) => exercise.subcategory ? [exercise.subcategory] : []),
  ]);
  const difficultyValues = sortedUnique([
    ...catalog.difficulties.filter((item) => item.isActive).map((item) => item.label),
    ...exercises.flatMap((exercise) => exercise.difficultyLabel ? [exercise.difficultyLabel] : []),
  ]);
  const materialValues = sortedUnique([
    ...catalog.materials.filter((item) => item.isActive).map((item) => item.label),
    ...exercises.flatMap((exercise) => exercise.equipment),
  ]);
  const groupValues = sortedUnique(catalog.groups.map((item) => item.name));
  const similarExerciseValues = sortedUnique(catalog.exercises.map((item) => item.name));
  const parameterValues = sortedUnique([
    ...catalog.parameterOptions.filter((item) => item.isActive).map((item) => item.label),
    ...exercises.flatMap((exercise) => exercise.parameters.map((parameter) => parameter.label)),
  ]);
  const yesNo = ["Ja", "Nein"];
  const inputTypes = ["Zahl", "Text"];
  const materialSlotCount = Math.max(MIN_EXERCISE_MATERIAL_SLOTS, ...exercises.map((exercise) => exercise.equipment.length));
  const groupSlotCount = Math.max(MIN_EXERCISE_GROUP_SLOTS, ...exercises.map((exercise) => exercise.groupIds.length));
  const similarSlotCount = Math.max(MIN_SIMILAR_EXERCISE_SLOTS, ...exercises.map((exercise) => exercise.similarExerciseIds.length));
  const parameterSlotCount = Math.max(MIN_EXERCISE_PARAMETER_SLOTS, ...exercises.map((exercise) => exercise.parameters.length));
  const materialHeaders = Array.from({ length: materialSlotCount }, (_, index) => `Material ${index + 1}`);
  const groupHeaders = Array.from({ length: groupSlotCount }, (_, index) => `Trainingsgruppe ${index + 1}`);
  const similarHeaders = Array.from({ length: similarSlotCount }, (_, index) => `Ähnliche Übung ${index + 1}`);
  const baseHeaders = [
    "Übungs-ID", "Bezeichnung", "Kategorie", "Unterkategorie", "Schwierigkeitsgrad", "Trainingsziel", "Beschreibung",
    "Ausführungshinweise", "Häufige Fehler", ...materialHeaders, ...groupHeaders, ...similarHeaders, "Video-URL", "Aktiv",
  ];
  const parameterHeaders = Array.from({ length: parameterSlotCount }, (_, index) => {
    const slot = index + 1;
    return [
      `Parameter ${slot} Schlüssel`, `Parameter ${slot}`, `Parameter ${slot} Einheit`,
      `Parameter ${slot} Eingabetyp`, `Parameter ${slot} Standardwert`, `Parameter ${slot} Minimum`,
      `Parameter ${slot} Maximum`, `Parameter ${slot} Schrittweite`, `Parameter ${slot} Pflichtfeld`,
    ];
  }).flat();
  const exerciseRows = exercises.map((exercise) => {
    const groupNames = exercise.groupIds.flatMap((id) => {
      const group = catalog.groups.find((candidate) => candidate.id === id);
      return group ? [group.name] : [];
    });
    const similarNames = exercise.similarExerciseIds.flatMap((id) => {
      const candidate = catalog.exercises.find((item) => item.id === id);
      return candidate ? [candidate.name] : [];
    });
    const parameterCells = Array.from({ length: parameterSlotCount }, (_, index) => {
      const parameter = exercise.parameters[index];
      if (!parameter) return Array.from({ length: 9 }, () => "");
      return [
        parameter.key,
        parameter.label,
        parameter.unit,
        parameter.inputType === "text" ? "Text" : "Zahl",
        parameter.defaultValue,
        parameter.minValue === null ? "" : String(parameter.minValue).replace(".", ","),
        parameter.maxValue === null ? "" : String(parameter.maxValue).replace(".", ","),
        parameter.stepValue === null ? "" : String(parameter.stepValue).replace(".", ","),
        parameter.isRequired ? "Ja" : "Nein",
      ];
    }).flat();
    return [
      exercise.id,
      exercise.name,
      exercise.categoryTitle,
      exercise.subcategory ?? "",
      exercise.difficultyLabel ?? "",
      exercise.goal ?? "",
      exercise.description ?? "",
      exercise.coachingCues ?? "",
      exercise.commonMistakes ?? "",
      ...Array.from({ length: materialSlotCount }, (_, index) => exercise.equipment[index] ?? ""),
      ...Array.from({ length: groupSlotCount }, (_, index) => groupNames[index] ?? ""),
      ...Array.from({ length: similarSlotCount }, (_, index) => similarNames[index] ?? ""),
      exercise.videoUrl ?? "",
      exercise.isActive ? "Ja" : "Nein",
      ...parameterCells,
    ];
  });

  const categoryColumn = workbookColumn(baseHeaders.indexOf("Kategorie"));
  const subcategoryColumn = workbookColumn(baseHeaders.indexOf("Unterkategorie"));
  const difficultyColumn = workbookColumn(baseHeaders.indexOf("Schwierigkeitsgrad"));
  const activeColumn = workbookColumn(baseHeaders.indexOf("Aktiv"));
  const materialStart = baseHeaders.indexOf("Material 1");
  const groupStart = baseHeaders.indexOf("Trainingsgruppe 1");
  const similarStart = baseHeaders.indexOf("Ähnliche Übung 1");
  const parameterStart = baseHeaders.length;
  const parameterValidations = Array.from({ length: parameterSlotCount }, (_, index) => {
    const start = parameterStart + index * 9;
    return [
      { range: `${workbookColumn(start + 1)}2:${workbookColumn(start + 1)}1000`, definedName: "ParameterListe" },
      { range: `${workbookColumn(start + 3)}2:${workbookColumn(start + 3)}1000`, definedName: "EingabetypListe" },
      { range: `${workbookColumn(start + 8)}2:${workbookColumn(start + 8)}1000`, definedName: "JaNeinListe" },
    ];
  }).flat();
  const listSheetName = "Auswahllisten";
  return {
    sheets: [
      {
        name: EXERCISE_SHEET,
        rows: [[...baseHeaders, ...parameterHeaders], ...exerciseRows],
        widths: [
          38, 24, 18, 20, 20, 24, 36, 36, 32,
          ...Array.from({ length: materialSlotCount }, () => 18),
          ...Array.from({ length: groupSlotCount }, () => 22),
          ...Array.from({ length: similarSlotCount }, () => 24),
          34, 10,
          ...Array.from({ length: parameterSlotCount }, () => [22, 22, 12, 14, 16, 12, 12, 14, 12]).flat(),
        ],
        validations: [
          { range: `${categoryColumn}2:${categoryColumn}1000`, definedName: "KategorienListe" },
          { range: `${subcategoryColumn}2:${subcategoryColumn}1000`, definedName: "UnterkategorienListe" },
          { range: `${difficultyColumn}2:${difficultyColumn}1000`, definedName: "SchwierigkeitenListe" },
          ...Array.from({ length: materialSlotCount }, (_, index) => ({
            range: `${workbookColumn(materialStart + index)}2:${workbookColumn(materialStart + index)}1000`,
            definedName: "MaterialListe",
          })),
          ...Array.from({ length: groupSlotCount }, (_, index) => ({
            range: `${workbookColumn(groupStart + index)}2:${workbookColumn(groupStart + index)}1000`,
            definedName: "GruppenListe",
          })),
          ...Array.from({ length: similarSlotCount }, (_, index) => ({
            range: `${workbookColumn(similarStart + index)}2:${workbookColumn(similarStart + index)}1000`,
            definedName: "AehnlicheUebungenListe",
          })),
          { range: `${activeColumn}2:${activeColumn}1000`, definedName: "JaNeinListe" },
          ...parameterValidations,
        ],
      },
      {
        name: listSheetName,
        hidden: true,
        rows: [[
          "Kategorien", "Unterkategorien", "Schwierigkeitsgrade", "Material", "Trainingsgruppen",
          "Ähnliche Übungen", "Planungsparameter", "Ja/Nein", "Eingabetyp",
        ], ...listRows([
          categoryValues,
          subcategoryValues,
          difficultyValues,
          materialValues,
          groupValues,
          similarExerciseValues,
          parameterValues,
          yesNo,
          inputTypes,
        ])],
        widths: [24, 24, 24, 24, 28, 32, 26, 12, 14],
      },
    ],
    definedNames: [
      { name: "KategorienListe", sheetName: listSheetName, range: definedRange("A", categoryValues) },
      { name: "UnterkategorienListe", sheetName: listSheetName, range: definedRange("B", subcategoryValues) },
      { name: "SchwierigkeitenListe", sheetName: listSheetName, range: definedRange("C", difficultyValues) },
      { name: "MaterialListe", sheetName: listSheetName, range: definedRange("D", materialValues) },
      { name: "GruppenListe", sheetName: listSheetName, range: definedRange("E", groupValues) },
      { name: "AehnlicheUebungenListe", sheetName: listSheetName, range: definedRange("F", similarExerciseValues) },
      { name: "ParameterListe", sheetName: listSheetName, range: definedRange("G", parameterValues) },
      { name: "JaNeinListe", sheetName: listSheetName, range: definedRange("H", yesNo) },
      { name: "EingabetypListe", sheetName: listSheetName, range: definedRange("I", inputTypes) },
    ],
  };
}

export function exerciseTemplateWorkbook(catalog: ExerciseCatalogData): DownloadWorkbookDefinition {
  return exerciseWorkbookDefinition(catalog, []);
}

export function exerciseExportWorkbook(catalog: ExerciseCatalogData, exercises: Exercise[]): DownloadWorkbookDefinition {
  return exerciseWorkbookDefinition(catalog, exercises);
}

function athleteWorkbookDefinition(athletes: Athlete[], groups: TrainingGroup[], linkableUsers: LinkableUser[]): DownloadWorkbookDefinition {
  const groupValues = groups.filter((group) => group.isActive).map((group) => group.name);
  const yesNo = ["Ja", "Nein"];
  const userEmails = linkableUsers.filter((user) => user.status !== "disabled").map((user) => user.email);
  const userEmailById = new Map(linkableUsers.map((user) => [user.userId, user.email]));
  const contactSlotCount = Math.max(MIN_ATHLETE_CONTACT_SLOTS, ...athletes.map((athlete) => athlete.contacts.length));
  const baseHeaders = [
    "Athlet-ID", "Vorname", "Nachname", "Geburtsjahr", "Gruppe 1", "Gruppe 2", "Gruppe 3",
    "Gruppe 4", "Notizen", "Aktiv", "Benutzer-E-Mail",
  ];
  const contactHeaders = Array.from({ length: contactSlotCount }, (_, index) => {
    const slot = index + 1;
    return [
      `Kontakt ${slot} ID`, `Kontakt ${slot} Name`, `Kontakt ${slot} Beziehung`, `Kontakt ${slot} Telefon`,
      `Kontakt ${slot} Notfallkontakt`, `Kontakt ${slot} Priorität`, `Kontakt ${slot} Notizen`,
    ];
  }).flat();
  const athleteRows = athletes.map((athlete) => {
    const contactCells = Array.from({ length: contactSlotCount }, (_, index) => {
      const contact = athlete.contacts[index];
      if (!contact) return Array.from({ length: 7 }, () => "");
      return [
        contact.id ?? "", contact.contactName, contact.relationship, contact.phone,
        contact.isEmergency ? "Ja" : "Nein", String(contact.priority), contact.notes,
      ];
    }).flat();
    return [
      athlete.id, athlete.firstName, athlete.lastName, athlete.birthYear === null ? "" : String(athlete.birthYear),
      ...Array.from({ length: 4 }, (_, index) => athlete.groups[index]?.name ?? ""),
      athlete.notes ?? "", athlete.isActive ? "Ja" : "Nein",
      athlete.linkedUserId ? userEmailById.get(athlete.linkedUserId) ?? "" : "",
      ...contactCells,
    ];
  });
  const contactStart = baseHeaders.length;
  const contactValidations = Array.from({ length: contactSlotCount }, (_, index) => {
    const emergencyColumn = workbookColumn(contactStart + index * 7 + 4);
    return { range: `${emergencyColumn}2:${emergencyColumn}1000`, definedName: "AthletenJaNeinListe" };
  });
  const listSheetName = "Auswahllisten";
  return {
    sheets: [
      {
        name: ATHLETE_SHEET,
        rows: [[...baseHeaders, ...contactHeaders], ...athleteRows],
        widths: [38, 18, 20, 14, 24, 24, 24, 24, 34, 10, 30,
          ...Array.from({ length: contactSlotCount }, () => [38, 24, 18, 20, 16, 12, 34]).flat()],
        validations: [
          ...["E", "F", "G", "H"].map((column) => ({ range: `${column}2:${column}1000`, definedName: "AthletenGruppenListe" })),
          { range: "J2:J1000", definedName: "AthletenJaNeinListe" },
          { range: "K2:K1000", definedName: "AthletenBenutzerListe" },
          ...contactValidations,
        ],
      },
      {
        name: listSheetName,
        hidden: true,
        rows: [["Trainingsgruppen", "Ja/Nein", "Benutzer-E-Mail"], ...listRows([groupValues, yesNo, userEmails])],
        widths: [28, 12, 34],
      },
    ],
    definedNames: [
      { name: "AthletenGruppenListe", sheetName: listSheetName, range: definedRange("A", groupValues) },
      { name: "AthletenJaNeinListe", sheetName: listSheetName, range: definedRange("B", yesNo) },
      { name: "AthletenBenutzerListe", sheetName: listSheetName, range: definedRange("C", userEmails) },
    ],
  };
}

export function athleteTemplateWorkbook(groups: TrainingGroup[], linkableUsers: LinkableUser[] = []): DownloadWorkbookDefinition {
  return athleteWorkbookDefinition([], groups, linkableUsers);
}

export function athleteExportWorkbook(athletes: Athlete[], groups: TrainingGroup[], linkableUsers: LinkableUser[]): DownloadWorkbookDefinition {
  return athleteWorkbookDefinition(athletes, groups, linkableUsers);
}

export function downloadImportReport(result: ImportRunResult, prefix: string): void {
  const cells = [["Zeile", "Datensatz", "Aktion", "Ergebnis", "Meldung"], ...result.rows.map((row) => [
    String(row.rowNumber),
    row.label,
    row.action === "create" ? "Neu" : row.action === "update" ? "Aktualisieren" : "Überspringen",
    row.success ? "OK" : "Fehler",
    row.message,
  ])];
  const csv = `\uFEFF${cells.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${prefix}-Importprotokoll-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

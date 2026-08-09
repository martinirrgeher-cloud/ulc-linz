import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, SkipForward } from "lucide-react";
import { ExerciseEditor } from "@/features/exercise-catalog/ExerciseEditor";
import type {
  Exercise,
  ExerciseCatalogData,
  ExerciseCategory,
  ExerciseDifficulty,
  ExerciseInput,
  ExerciseListOption,
  ExerciseParameterOption,
  ExerciseTrainingGroup,
} from "@/features/exercise-catalog/types";
import type { ExerciseImportDraft, ImportPreviewRow } from "@/features/data-import/types";

export type ExerciseImportReviewMessages = {
  warnings: string[];
  errors: string[];
};

export type ExerciseImportReviewProps = {
  rows: ImportPreviewRow<ExerciseImportDraft>[];
  currentIndex: number;
  catalog: ExerciseCatalogData;
  organizationId: string;
  canCreateOptions: boolean;
  busy: boolean;
  onApprove: (index: number, draft: ExerciseImportDraft, messages: ExerciseImportReviewMessages) => Promise<void> | void;
  onSkip: (index: number) => void;
  onClose: () => void;
};

const IMPORT_PREFIX = "__ulc_import__";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("de-AT").replace(/\s+/g, " ");
}

function syntheticId(kind: string, value: string): string {
  return `${IMPORT_PREFIX}${kind}:${encodeURIComponent(normalized(value))}`;
}

function isSynthetic(value: string): boolean {
  return value.startsWith(IMPORT_PREFIX);
}

function byNormalizedLabel<T>(items: T[], label: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [normalized(label(item)), item]));
}

function emptyPseudoExercise(id: string, draft: ExerciseImportDraft): Exercise {
  return {
    id,
    name: draft.name,
    categoryKey: syntheticId("category", draft.category || "ohne-kategorie"),
    categoryTitle: draft.category || "Ohne Kategorie",
    subcategory: draft.subcategory || null,
    goal: draft.goal || null,
    description: draft.description || null,
    coachingCues: draft.coachingCues || null,
    commonMistakes: draft.commonMistakes || null,
    equipment: [...draft.equipment],
    videoUrl: draft.videoUrl || null,
    isActive: draft.isActive ?? true,
    isFavorite: false,
    difficultyKey: draft.difficulty ? syntheticId("difficulty", draft.difficulty) : null,
    difficultyLabel: draft.difficulty || null,
    similarExerciseIds: [],
    blockUsageCount: 0,
    planUsageCount: 0,
    lastUsedAt: null,
    groupIds: [],
    parameters: [],
    videos: [],
    createdAt: "",
    updatedAt: "",
  };
}

function augmentedCatalog(rows: ImportPreviewRow<ExerciseImportDraft>[], catalog: ExerciseCatalogData) {
  const categories: ExerciseCategory[] = [...catalog.categories];
  const subcategories: ExerciseListOption[] = [...catalog.subcategories];
  const materials: ExerciseListOption[] = [...catalog.materials];
  const difficulties: ExerciseDifficulty[] = [...catalog.difficulties];
  const parameterOptions: ExerciseParameterOption[] = [...catalog.parameterOptions];
  const groups: ExerciseTrainingGroup[] = [...catalog.groups];
  const exercises: Exercise[] = [...catalog.exercises];

  const categoryLabels = new Set(categories.map((item) => normalized(item.title)));
  const subcategoryLabels = new Set(subcategories.map((item) => normalized(item.label)));
  const materialLabels = new Set(materials.map((item) => normalized(item.label)));
  const difficultyLabels = new Set(difficulties.map((item) => normalized(item.label)));
  const parameterLabels = new Set(parameterOptions.map((item) => normalized(item.label)));
  const groupLabels = new Set(groups.flatMap((item) => [normalized(item.name), item.shortName ? normalized(item.shortName) : ""]).filter(Boolean));
  const exerciseLabels = new Set(exercises.map((item) => normalized(item.name)));

  rows.forEach((row, rowIndex) => {
    const draft = row.value;
    if (draft.category && !categoryLabels.has(normalized(draft.category))) {
      categories.push({ key: syntheticId("category", draft.category), title: draft.category, sortOrder: 9990 + rowIndex, isActive: true });
      categoryLabels.add(normalized(draft.category));
    }
    if (draft.subcategory && !subcategoryLabels.has(normalized(draft.subcategory))) {
      subcategories.push({ key: syntheticId("subcategory", draft.subcategory), label: draft.subcategory, sortOrder: 9990 + rowIndex, isActive: true });
      subcategoryLabels.add(normalized(draft.subcategory));
    }
    draft.equipment.forEach((label, optionIndex) => {
      if (!materialLabels.has(normalized(label))) {
        materials.push({ key: syntheticId("material", label), label, sortOrder: 9990 + rowIndex + optionIndex, isActive: true });
        materialLabels.add(normalized(label));
      }
    });
    if (draft.difficulty && !difficultyLabels.has(normalized(draft.difficulty))) {
      difficulties.push({ key: syntheticId("difficulty", draft.difficulty), label: draft.difficulty, sortOrder: 9990 + rowIndex, isActive: true });
      difficultyLabels.add(normalized(draft.difficulty));
    }
    draft.parameters.forEach((parameter, parameterIndex) => {
      if (!parameterLabels.has(normalized(parameter.label))) {
        parameterOptions.push({
          key: syntheticId("parameter", parameter.label),
          label: parameter.label,
          unit: parameter.unit,
          inputType: parameter.inputType || "text",
          stepValue: parameter.stepValue,
          parameterGroup: "execution",
          sortOrder: 9990 + rowIndex + parameterIndex,
          isActive: true,
        });
        parameterLabels.add(normalized(parameter.label));
      }
    });
    draft.groupNames.forEach((name, groupIndex) => {
      if (!groupLabels.has(normalized(name))) {
        groups.push({ id: syntheticId("group", name), name, shortName: null });
        groupLabels.add(normalized(name));
      }
    });
    if (!row.existingId && draft.name && !exerciseLabels.has(normalized(draft.name))) {
      exercises.push(emptyPseudoExercise(syntheticId("row", `${row.rowNumber}:${draft.name}`), draft));
      exerciseLabels.add(normalized(draft.name));
    }
  });

  const knownExerciseNames = new Set(exercises.map((item) => normalized(item.name)));
  rows.forEach((row, rowIndex) => {
    row.value.similarExerciseNames.forEach((name, relationIndex) => {
      if (!knownExerciseNames.has(normalized(name))) {
        exercises.push(emptyPseudoExercise(syntheticId("missing-relation", `${rowIndex}:${relationIndex}:${name}`), {
          ...row.value,
          name,
          category: "Nicht gefunden",
          similarExerciseNames: [],
        }));
        knownExerciseNames.add(normalized(name));
      }
    });
  });

  return { categories, subcategories, materials, difficulties, parameterOptions, groups, exercises };
}

function draftToInput(
  draft: ExerciseImportDraft,
  augmented: ReturnType<typeof augmentedCatalog>,
): ExerciseInput {
  const category = augmented.categories.find((item) => normalized(item.title) === normalized(draft.category));
  const difficulty = augmented.difficulties.find((item) => normalized(item.label) === normalized(draft.difficulty));
  const groupMap = byNormalizedLabel(augmented.groups, (item) => item.name);
  augmented.groups.forEach((group) => {
    if (group.shortName) groupMap.set(normalized(group.shortName), group);
  });
  const exerciseMap = byNormalizedLabel(augmented.exercises, (item) => item.name);
  const parameterMap = byNormalizedLabel(augmented.parameterOptions, (item) => item.label);

  return {
    name: draft.name,
    categoryKey: category?.key ?? "",
    subcategory: draft.subcategory,
    goal: draft.goal,
    description: draft.description,
    coachingCues: draft.coachingCues,
    commonMistakes: draft.commonMistakes,
    equipment: [...draft.equipment],
    videoUrl: draft.videoUrl,
    difficultyKey: difficulty?.key ?? "",
    similarExerciseIds: draft.similarExerciseNames.flatMap((name) => {
      const exercise = exerciseMap.get(normalized(name));
      return exercise ? [exercise.id] : [];
    }),
    isActive: draft.isActive ?? true,
    groupIds: draft.groupNames.flatMap((name) => {
      const group = groupMap.get(normalized(name));
      return group ? [group.id] : [];
    }),
    parameters: draft.parameters.flatMap((parameter, index) => {
      const option = parameterMap.get(normalized(parameter.label));
      if (!option) return [];
      return [{
        key: option.key,
        label: option.label,
        unit: parameter.unit || option.unit,
        inputType: parameter.inputType || option.inputType,
        defaultValue: parameter.defaultValue,
        minValue: parameter.minValue,
        maxValue: parameter.maxValue,
        stepValue: parameter.stepValue ?? option.stepValue,
        isRequired: parameter.isRequired,
        sortOrder: parameter.sortOrder || index + 1,
      }];
    }),
  };
}

function inputToDraft(
  values: ExerciseInput,
  augmented: ReturnType<typeof augmentedCatalog>,
): ExerciseImportDraft {
  const category = augmented.categories.find((item) => item.key === values.categoryKey);
  const difficulty = augmented.difficulties.find((item) => item.key === values.difficultyKey);
  const groupMap = new Map(augmented.groups.map((item) => [item.id, item]));
  const exerciseMap = new Map(augmented.exercises.map((item) => [item.id, item]));

  return {
    name: values.name.trim(),
    category: category?.title ?? "",
    subcategory: values.subcategory.trim(),
    goal: values.goal.trim(),
    description: values.description.trim(),
    coachingCues: values.coachingCues.trim(),
    commonMistakes: values.commonMistakes.trim(),
    equipment: [...values.equipment],
    groupNames: values.groupIds.flatMap((id) => {
      const group = groupMap.get(id);
      return group ? [group.name] : [];
    }),
    difficulty: difficulty?.label ?? "",
    similarExerciseNames: values.similarExerciseIds.flatMap((id) => {
      const exercise = exerciseMap.get(id);
      return exercise ? [exercise.name] : [];
    }),
    videoUrl: values.videoUrl.trim(),
    isActive: values.isActive,
    parameters: values.parameters.map((parameter, index) => ({
      key: isSynthetic(parameter.key) ? "" : parameter.key,
      label: parameter.label,
      unit: parameter.unit,
      inputType: parameter.inputType,
      defaultValue: parameter.defaultValue,
      minValue: parameter.minValue,
      maxValue: parameter.maxValue,
      stepValue: parameter.stepValue,
      isRequired: parameter.isRequired,
      sortOrder: index + 1,
    })),
  };
}

function reviewMessages(
  values: ExerciseInput,
  row: ImportPreviewRow<ExerciseImportDraft>,
  catalog: ExerciseCatalogData,
  augmented: ReturnType<typeof augmentedCatalog>,
  canCreateOptions: boolean,
): ExerciseImportReviewMessages {
  const warnings: string[] = row.existingId ? ["Eine bestehende Übung wurde erkannt."] : [];
  const errors: string[] = [];
  const category = augmented.categories.find((item) => item.key === values.categoryKey);
  const difficulty = augmented.difficulties.find((item) => item.key === values.difficultyKey);
  const groups = new Map(augmented.groups.map((item) => [item.id, item]));
  const exercises = new Map(augmented.exercises.map((item) => [item.id, item]));
  const parameterOptions = new Map(augmented.parameterOptions.map((item) => [item.key, item]));
  const knownSubcategories = new Set(catalog.subcategories.map((item) => normalized(item.label)));
  const knownMaterials = new Set(catalog.materials.map((item) => normalized(item.label)));

  const missing = (message: string) => (canCreateOptions ? warnings : errors).push(message);
  if (category && isSynthetic(category.key)) missing(`Kategorie „${category.title}“ ist nicht vorhanden.`);
  if (values.subcategory && !knownSubcategories.has(normalized(values.subcategory))) missing(`Unterkategorie „${values.subcategory}“ ist nicht vorhanden.`);
  if (difficulty && isSynthetic(difficulty.key)) missing(`Schwierigkeitsgrad „${difficulty.label}“ ist nicht vorhanden.`);
  values.equipment.forEach((item) => {
    if (!knownMaterials.has(normalized(item))) missing(`Material „${item}“ ist nicht vorhanden.`);
  });
  values.groupIds.forEach((id) => {
    const group = groups.get(id);
    if (group && isSynthetic(group.id)) errors.push(`Trainingsgruppe „${group.name}“ ist nicht vorhanden. Bitte entfernen oder eine vorhandene Gruppe auswählen.`);
  });
  values.similarExerciseIds.forEach((id) => {
    const exercise = exercises.get(id);
    if (exercise && id.includes("missing-relation")) errors.push(`Ähnliche Übung „${exercise.name}“ wurde nicht gefunden. Bitte entfernen oder eine vorhandene Übung auswählen.`);
  });
  values.parameters.forEach((parameter) => {
    const option = parameterOptions.get(parameter.key);
    if (option && isSynthetic(option.key)) missing(`Planungsparameter „${option.label}“ ist nicht vorhanden.`);
  });
  return { warnings: [...new Set(warnings)], errors: [...new Set(errors)] };
}

export function ExerciseImportReview({
  rows,
  currentIndex,
  catalog,
  organizationId,
  canCreateOptions,
  busy,
  onApprove,
  onSkip,
  onClose,
}: ExerciseImportReviewProps) {
  const row = rows[currentIndex] ?? null;
  const augmented = useMemo(() => augmentedCatalog(rows, catalog), [catalog, rows]);
  if (!row) return null;

  const approved = rows.filter((item) => item.reviewStatus === "approved").length;
  const skipped = rows.filter((item) => item.reviewStatus === "skipped").length;
  const pending = rows.length - approved - skipped;
  const existingExercise = row.existingId ? catalog.exercises.find((item) => item.id === row.existingId) ?? null : null;
  const currentPseudoId = row.existingId ? null : syntheticId("row", `${row.rowNumber}:${row.value.name}`);
  const editorExercises = augmented.exercises.filter((exercise) => exercise.id !== currentPseudoId);
  const initialValues = draftToInput(row.value, augmented);
  const currentMessages = reviewMessages(initialValues, row, catalog, augmented, canCreateOptions);

  return (
    <ExerciseEditor
      key={`${row.rowNumber}-${row.key}-${currentIndex}-${row.reviewStatus ?? "pending"}`}
      exercise={existingExercise}
      initialValues={initialValues}
      catalogExercises={editorExercises}
      categories={augmented.categories}
      subcategories={augmented.subcategories}
      materials={augmented.materials}
      difficulties={augmented.difficulties}
      parameterOptions={augmented.parameterOptions}
      groups={augmented.groups}
      organizationId={organizationId}
      initialSection="basis"
      canEdit
      busy={busy}
      videoEditEnabled={false}
      headerEyebrow="Importprüfung"
      headerTitle={`Übung ${currentIndex + 1} von ${rows.length}: ${row.value.name || "Ohne Bezeichnung"}`}
      headerMeta={<small>{row.existingId ? "Bestehende Übung – wird nach Freigabe aktualisiert" : "Neue Übung – wird erst nach dem finalen Import angelegt"} · {approved} freigegeben · {pending} offen · {skipped} übersprungen</small>}
      lockNotice={(
        <div className="data-import-editor-context">
          <div className="data-import-editor-progress" aria-label={`${approved + skipped} von ${rows.length} geprüft`}>
            <span style={{ width: `${rows.length > 0 ? ((approved + skipped) / rows.length) * 100 : 0}%` }} />
          </div>
          <p><strong>Excel-Zeile {row.rowNumber}</strong> · Ergänze hier alle Werte genau wie im Übungskatalog. Beim Klick auf „Freigeben & nächste“ wird noch nichts an Supabase gesendet. Datei-Videoänderungen sind in der Prüfung schreibgeschützt.</p>
          {(row.errors.length > 0 || row.warnings.length > 0) && (
            <div className="data-import-review-messages">
              {row.errors.map((message) => <div className="error" key={message}><AlertTriangle aria-hidden="true" />{message}</div>)}
              {row.warnings.map((message) => <div className="warning" key={message}><AlertTriangle aria-hidden="true" />{message}</div>)}
            </div>
          )}
        </div>
      )}
      cancelLabel="Prüfung schließen"
      submitLabel="Freigeben & nächste"
      footerExtra={(
        <button type="button" className="secondary-button" onClick={() => onSkip(currentIndex)} disabled={busy}>
          <SkipForward aria-hidden="true" />Überspringen & nächste
        </button>
      )}
      validateValues={(values) => {
        const messages = reviewMessages(values, row, catalog, augmented, canCreateOptions);
        return messages.errors.length > 0 ? messages.errors.join(" ") : null;
      }}
      onCancel={onClose}
      onSubmit={async (values) => {
        const messages = reviewMessages(values, row, catalog, augmented, canCreateOptions);
        if (messages.errors.length > 0) return;
        await onApprove(currentIndex, inputToDraft(values, augmented), messages);
      }}
      onVideosChanged={() => undefined}
    />
  );
}

import type { Json } from "@/types/database.generated";
import { requireSupabase } from "@/lib/supabase";
import type { ExerciseParameterDefinition, ExerciseParameterInputType } from "@/features/exercise-catalog/types";
import type {
  DocumentationAthlete,
  DocumentationExerciseStatistic,
  DocumentationGroup,
  DocumentationItemInput,
  DocumentationMedia,
  DocumentationMonthStatistic,
  DocumentationParameterStatistic,
  DocumentationPlanSummary,
  DocumentationReasonStatistic,
  DocumentationRole,
  DocumentationSectionInput,
  DocumentationSetInput,
  DocumentationStatisticsSession,
  ExerciseDocumentationStatus,
  PainLevel,
  TrainingDocumentationDetail,
  TrainingDocumentationInput,
  TrainingDocumentationOverview,
  TrainingDocumentationPlanPreview,
  TrainingDocumentationStatistics,
  TrainingSessionStatus,
} from "@/features/training-documentation/types";

export const TRAINING_DOCUMENTATION_MEDIA_BUCKET = "training-documentation-media";
export const EXERCISE_VIDEO_BUCKET = "exercise-videos";

type JsonRpc = (
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function parseNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const parsed = typeof item === "number" ? item : typeof item === "string" ? Number(item) : Number.NaN;
    return Number.isInteger(parsed) ? [parsed] : [];
  }))].sort((left, right) => left - right);
}

function parseRole(value: unknown): DocumentationRole {
  if (value === "admin" || value === "trainer" || value === "athlete" || value === "parent") {
    return value;
  }
  return "athlete";
}

function parseSessionStatus(value: unknown): TrainingSessionStatus {
  if (value === "in_progress" || value === "completed" || value === "partial" || value === "aborted") {
    return value;
  }
  return "not_started";
}

function parseStartedSessionStatus(value: unknown): Exclude<TrainingSessionStatus, "not_started"> {
  const status = parseSessionStatus(value);
  return status === "not_started" ? "in_progress" : status;
}

function parseExerciseStatus(value: unknown): ExerciseDocumentationStatus {
  if (
    value === "as_planned"
    || value === "changed"
    || value === "partial"
    || value === "skipped"
    || value === "aborted"
  ) return value;
  return "planned";
}

function parseCompletedExerciseStatus(value: unknown): Exclude<ExerciseDocumentationStatus, "planned"> {
  const status = parseExerciseStatus(value);
  return status === "planned" ? "changed" : status;
}

function parsePainLevel(value: unknown): PainLevel {
  if (value === "mild" || value === "strong") return value;
  return "none";
}

function parseParameters(value: unknown): ExerciseParameterDefinition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const key = optionalString(item.parameter_key) ?? optionalString(item.key);
    if (!key) return [];
    const inputType: ExerciseParameterInputType = item.input_type === "text" || item.inputType === "text"
      ? "text"
      : "number";
    return [{
      key,
      label: stringValue(item.label) || key,
      unit: stringValue(item.unit),
      inputType,
      defaultValue: stringValue(item.default_value ?? item.defaultValue),
      minValue: numberOrNull(item.min_value ?? item.minValue),
      maxValue: numberOrNull(item.max_value ?? item.maxValue),
      stepValue: numberOrNull(item.step_value ?? item.stepValue),
      isRequired: item.is_required === true || item.isRequired === true,
      sortOrder: numberValue(item.sort_order ?? item.sortOrder, 100),
    }];
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

function parseParameterValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    if (typeof entry === "string") return [[key, entry]];
    if (typeof entry === "number" && Number.isFinite(entry)) return [[key, String(entry)]];
    return [];
  }));
}

function parseGroups(value: unknown): DocumentationGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      shortName: optionalString(item.short_name),
      regularWeekdays: parseNumberArray(item.regular_weekdays),
    }];
  });
}

function parseAthletes(value: unknown): DocumentationAthlete[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.first_name !== "string"
      || typeof item.last_name !== "string"
    ) return [];
    return [{
      id: item.id,
      firstName: item.first_name,
      lastName: item.last_name,
      groupIds: parseStringArray(item.group_ids),
    }];
  });
}

function parsePlanSummaries(value: unknown): DocumentationPlanSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.athlete_id !== "string"
      || typeof item.athlete_name !== "string"
      || typeof item.group_id !== "string"
      || typeof item.group_name !== "string"
      || typeof item.training_date !== "string"
      || typeof item.title !== "string"
    ) return [];
    return [{
      id: item.id,
      athleteId: item.athlete_id,
      athleteName: item.athlete_name,
      groupId: item.group_id,
      groupName: item.group_name,
      trainingDate: item.training_date,
      title: item.title,
      plannedMinutes: numberValue(item.planned_minutes),
      exerciseCount: numberValue(item.exercise_count),
      sessionId: optionalString(item.session_id),
      sessionStatus: parseSessionStatus(item.session_status),
      actualMinutes: numberOrNull(item.actual_minutes),
      overallRpe: numberOrNull(item.overall_rpe),
      overallRating: numberOrNull(item.overall_rating),
      completedExerciseCount: numberValue(item.completed_exercise_count),
      updatedAt: stringValue(item.updated_at),
    }];
  });
}

function parseMedia(value: unknown): DocumentationMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.title !== "string"
      || typeof item.storage_path !== "string"
      || typeof item.mime_type !== "string"
    ) return [];
    return [{
      id: item.id,
      title: item.title,
      storagePath: item.storage_path,
      mimeType: item.mime_type,
      fileSize: numberValue(item.file_size),
      createdAt: stringValue(item.created_at),
      signedUrl: null,
    }];
  });
}

function parseSets(value: unknown): DocumentationSetInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const id = optionalString(item.id);
    const setNumber = numberValue(item.set_number, index + 1);
    return [{
      clientId: id ?? `set-${setNumber}-${index}`,
      id,
      setNumber,
      plannedValues: parseParameterValues(item.planned_values),
      actualValues: parseParameterValues(item.actual_values),
      status: parseCompletedExerciseStatus(item.status),
      comment: stringValue(item.comment),
    }];
  });
}

function parseDocumentationItems(value: unknown): DocumentationItemInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.exercise_name !== "string") return [];
    return [{
      id: item.id,
      sourcePlanItemId: optionalString(item.source_plan_item_id),
      sourceExerciseId: optionalString(item.source_exercise_id),
      exerciseName: item.exercise_name,
      categoryTitle: stringValue(item.category_title),
      exerciseGoal: stringValue(item.exercise_goal),
      exerciseDescription: stringValue(item.exercise_description),
      exerciseCoachingCues: stringValue(item.exercise_coaching_cues),
      exerciseCommonMistakes: stringValue(item.exercise_common_mistakes),
      exerciseEquipment: parseStringArray(item.exercise_equipment),
      plannedNote: stringValue(item.planned_note),
      parameterDefinitions: parseParameters(item.parameter_definitions),
      plannedValues: parseParameterValues(item.planned_values),
      actualValues: parseParameterValues(item.actual_values),
      status: parseExerciseStatus(item.status),
      rating: numberOrNull(item.rating),
      rpe: numberOrNull(item.rpe),
      comment: stringValue(item.comment),
      painLevel: parsePainLevel(item.pain_level),
      painComment: stringValue(item.pain_comment),
      trainerComment: stringValue(item.trainer_comment),
      exerciseVideoUrl: optionalString(item.exercise_video_url),
      exerciseVideoStoragePath: optionalString(item.exercise_video_storage_path),
      exerciseVideoSignedUrl: null,
      media: parseMedia(item.media),
      sets: parseSets(item.sets),
    }];
  });
}

function parseDocumentationSections(value: unknown): DocumentationSectionInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      description: stringValue(item.description),
      estimatedMinutes: numberOrNull(item.estimated_minutes),
      items: parseDocumentationItems(item.items),
    }];
  });
}

function parsePreviewSections(value: unknown): TrainingDocumentationPlanPreview["sections"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((section) => {
    if (!isRecord(section) || typeof section.id !== "string" || typeof section.name !== "string") return [];
    const items = Array.isArray(section.items) ? section.items.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.exercise_name !== "string") return [];
      return [{
        id: item.id,
        exerciseName: item.exercise_name,
        categoryTitle: stringValue(item.category_title),
        exerciseGoal: stringValue(item.exercise_goal),
        exerciseDescription: stringValue(item.exercise_description),
        exerciseCoachingCues: stringValue(item.exercise_coaching_cues),
        exerciseCommonMistakes: stringValue(item.exercise_common_mistakes),
        exerciseEquipment: parseStringArray(item.exercise_equipment),
        note: stringValue(item.note),
        parameterDefinitions: parseParameters(item.parameter_definitions),
        parameterValues: parseParameterValues(item.parameter_values),
        exerciseVideoUrl: optionalString(item.exercise_video_url),
        exerciseVideoStoragePath: optionalString(item.exercise_video_storage_path),
        exerciseVideoSignedUrl: null,
      }];
    }) : [];
    return [{
      id: section.id,
      name: section.name,
      description: stringValue(section.description),
      estimatedMinutes: numberOrNull(section.estimated_minutes),
      items,
    }];
  });
}

async function signedUrls(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return new Map();
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(uniquePaths, 60 * 60);
  if (error || !Array.isArray(data)) return new Map();
  const entries = data as Array<{ signedUrl?: string | null }>;
  return new Map(entries.flatMap((entry, index) => {
    const path = uniquePaths[index];
    return path && entry.signedUrl ? [[path, entry.signedUrl] as const] : [];
  }));
}

async function hydrateDetailVideos(detail: TrainingDocumentationDetail): Promise<TrainingDocumentationDetail> {
  const exercisePaths = [
    ...detail.preview.sections.flatMap((section) => section.items.map((item) => item.exerciseVideoStoragePath)),
    ...(detail.session?.sections.flatMap((section) => section.items.map((item) => item.exerciseVideoStoragePath)) ?? []),
  ].filter((path): path is string => Boolean(path));
  const documentationPaths = detail.session?.sections.flatMap((section) => (
    section.items.flatMap((item) => item.media.map((medium) => medium.storagePath))
  )) ?? [];

  const [exerciseUrls, documentationUrls] = await Promise.all([
    signedUrls(EXERCISE_VIDEO_BUCKET, exercisePaths),
    signedUrls(TRAINING_DOCUMENTATION_MEDIA_BUCKET, documentationPaths),
  ]);

  const preview = {
    ...detail.preview,
    sections: detail.preview.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        exerciseVideoSignedUrl: item.exerciseVideoStoragePath
          ? exerciseUrls.get(item.exerciseVideoStoragePath) ?? null
          : null,
      })),
    })),
  };
  const session = detail.session ? {
    ...detail.session,
    sections: detail.session.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        exerciseVideoSignedUrl: item.exerciseVideoStoragePath
          ? exerciseUrls.get(item.exerciseVideoStoragePath) ?? null
          : null,
        media: item.media.map((medium) => ({
          ...medium,
          signedUrl: documentationUrls.get(medium.storagePath) ?? null,
        })),
      })),
    })),
  } : null;

  return { preview, session };
}

async function callJsonRpc(functionName: string, args: Record<string, unknown>): Promise<Json> {
  const supabase = requireSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as JsonRpc;
  const { data, error } = await rpc(functionName, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function loadTrainingDocumentationOverview(
  organizationId: string,
  weekStart: string,
  groupId: string | null,
  athleteId: string | null,
): Promise<TrainingDocumentationOverview> {
  const data = await callJsonRpc("training_documentation_overview", {
    p_organization_id: organizationId,
    p_week_start: weekStart,
    p_group_id: groupId,
    p_athlete_id: athleteId,
  });
  if (!isRecord(data)) throw new Error("Die Trainingsdokumentation konnte nicht geladen werden.");
  return {
    weekStart: stringValue(data.week_start) || weekStart,
    weekEnd: stringValue(data.week_end) || weekStart,
    currentRole: parseRole(data.current_role),
    ownAthleteId: optionalString(data.own_athlete_id),
    canReview: data.can_review === true,
    groups: parseGroups(data.groups),
    athletes: parseAthletes(data.athletes),
    plans: parsePlanSummaries(data.plans),
  };
}

export async function loadTrainingDocumentationDetail(
  organizationId: string,
  planId: string,
): Promise<TrainingDocumentationDetail> {
  const data = await callJsonRpc("training_documentation_detail", {
    p_organization_id: organizationId,
    p_plan_id: planId,
  });
  if (!isRecord(data) || !isRecord(data.preview)) {
    throw new Error("Der Trainingsplan konnte nicht für die Dokumentation geladen werden.");
  }
  const previewData = data.preview;
  const preview: TrainingDocumentationPlanPreview = {
    planId: stringValue(previewData.plan_id),
    athleteId: stringValue(previewData.athlete_id),
    athleteName: stringValue(previewData.athlete_name),
    groupId: stringValue(previewData.group_id),
    groupName: stringValue(previewData.group_name),
    trainingDate: stringValue(previewData.training_date),
    title: stringValue(previewData.title),
    notes: stringValue(previewData.notes),
    plannedMinutes: numberValue(previewData.planned_minutes),
    exerciseCount: numberValue(previewData.exercise_count),
    canEdit: previewData.can_edit === true,
    canReview: previewData.can_review === true,
    sections: parsePreviewSections(previewData.sections),
  };

  let session: TrainingDocumentationInput | null = null;
  if (isRecord(data.session) && typeof data.session.id === "string") {
    session = {
      sessionId: data.session.id,
      planId: preview.planId,
      athleteId: preview.athleteId,
      athleteName: stringValue(data.session.athlete_name) || preview.athleteName,
      groupId: preview.groupId,
      groupName: stringValue(data.session.group_name) || preview.groupName,
      trainingDate: preview.trainingDate,
      planTitle: stringValue(data.session.plan_title) || preview.title,
      planNotes: stringValue(data.session.plan_notes) || preview.notes,
      status: parseStartedSessionStatus(data.session.status),
      startedAt: stringValue(data.session.started_at),
      completedAt: optionalString(data.session.completed_at),
      plannedMinutes: numberValue(data.session.planned_minutes),
      actualMinutes: numberOrNull(data.session.actual_minutes)?.toString() ?? "",
      overallRpe: numberOrNull(data.session.overall_rpe),
      overallRating: numberOrNull(data.session.overall_rating),
      overallComment: stringValue(data.session.overall_comment),
      painLevel: parsePainLevel(data.session.pain_level),
      painComment: stringValue(data.session.pain_comment),
      trainerFeedback: stringValue(data.session.trainer_feedback),
      trainerReviewedAt: optionalString(data.session.trainer_reviewed_at),
      editedAfterCompletion: data.session.edited_after_completion === true,
      updatedAt: stringValue(data.session.updated_at),
      canEdit: preview.canEdit,
      canReview: preview.canReview,
      sections: parseDocumentationSections(data.session.sections),
    };
  }
  return hydrateDetailVideos({ preview, session });
}

export async function startTrainingDocumentation(
  organizationId: string,
  planId: string,
): Promise<string> {
  const data = await callJsonRpc("start_training_documentation", {
    p_organization_id: organizationId,
    p_plan_id: planId,
  });
  if (typeof data !== "string") throw new Error("Die Trainingsdokumentation konnte nicht gestartet werden.");
  return data;
}

function setsToJson(sets: DocumentationSetInput[]): Json {
  return sets.map((set, index) => ({
    id: set.id,
    set_number: index + 1,
    planned_values: set.plannedValues,
    actual_values: set.actualValues,
    status: set.status,
    comment: set.comment.trim() || null,
  }));
}

function itemsToJson(sections: DocumentationSectionInput[]): Json {
  return sections.flatMap((section) => section.items.map((item) => ({
    id: item.id,
    status: item.status,
    actual_values: item.actualValues,
    rating: item.rating,
    rpe: item.rpe,
    comment: item.comment.trim() || null,
    pain_level: item.painLevel,
    pain_comment: item.painComment.trim() || null,
    trainer_comment: item.trainerComment.trim() || null,
    sets: setsToJson(item.sets),
  })));
}

export async function saveTrainingDocumentation(
  organizationId: string,
  values: TrainingDocumentationInput,
): Promise<{ updatedAt: string; status: Exclude<TrainingSessionStatus, "not_started">; completedAt: string | null }> {
  const actualMinutes = values.actualMinutes.trim() ? Number.parseInt(values.actualMinutes, 10) : null;
  const data = await callJsonRpc("save_training_documentation", {
    p_organization_id: organizationId,
    p_session_id: values.sessionId,
    p_status: values.status,
    p_actual_minutes: Number.isFinite(actualMinutes) ? actualMinutes : null,
    p_overall_rpe: values.overallRpe,
    p_overall_rating: values.overallRating,
    p_overall_comment: values.overallComment.trim() || null,
    p_pain_level: values.painLevel,
    p_pain_comment: values.painComment.trim() || null,
    p_trainer_feedback: values.trainerFeedback.trim() || null,
    p_items: itemsToJson(values.sections),
  });
  if (!isRecord(data)) throw new Error("Die Trainingsdokumentation wurde gespeichert, aber die Rückgabe ist ungültig.");
  return {
    updatedAt: stringValue(data.updated_at),
    status: parseStartedSessionStatus(data.status),
    completedAt: optionalString(data.completed_at),
  };
}

export async function registerTrainingDocumentationMedia(
  organizationId: string,
  sessionId: string,
  itemId: string,
  storagePath: string,
  title: string,
  mimeType: string,
  fileSize: number,
): Promise<string> {
  const data = await callJsonRpc("register_training_documentation_media", {
    p_organization_id: organizationId,
    p_session_id: sessionId,
    p_item_id: itemId,
    p_storage_path: storagePath,
    p_title: title.trim(),
    p_mime_type: mimeType,
    p_file_size: fileSize,
  });
  if (typeof data !== "string") throw new Error("Das Video wurde hochgeladen, aber nicht registriert.");
  return data;
}

export async function deleteTrainingDocumentationMedia(
  organizationId: string,
  mediaId: string,
): Promise<string> {
  const data = await callJsonRpc("delete_training_documentation_media", {
    p_organization_id: organizationId,
    p_media_id: mediaId,
  });
  if (typeof data !== "string") throw new Error("Das Video konnte nicht gelöscht werden.");
  const supabase = requireSupabase();
  const { error } = await supabase.storage.from(TRAINING_DOCUMENTATION_MEDIA_BUCKET).remove([data]);
  if (error) throw new Error(error.message);
  return data;
}

function parseStatisticsSessions(value: unknown): DocumentationStatisticsSession[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.training_date !== "string") return [];
    return [{
      id: item.id,
      trainingDate: item.training_date,
      title: stringValue(item.title),
      status: parseStartedSessionStatus(item.status),
      plannedMinutes: numberValue(item.planned_minutes),
      actualMinutes: numberOrNull(item.actual_minutes),
      overallRpe: numberOrNull(item.overall_rpe),
      overallRating: numberOrNull(item.overall_rating),
      painLevel: parsePainLevel(item.pain_level),
      completedExerciseCount: numberValue(item.completed_exercise_count),
      exerciseCount: numberValue(item.exercise_count),
    }];
  });
}

function parseExerciseStatistics(value: unknown): DocumentationExerciseStatistic[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.exercise_name !== "string") return [];
    return [{
      exerciseId: optionalString(item.exercise_id),
      exerciseName: item.exercise_name,
      sessionCount: numberValue(item.session_count),
      completedCount: numberValue(item.completed_count),
      changedCount: numberValue(item.changed_count),
      skippedCount: numberValue(item.skipped_count),
      averageRating: numberOrNull(item.average_rating),
      averageRpe: numberOrNull(item.average_rpe),
      painCount: numberValue(item.pain_count),
    }];
  });
}

function parseParameterStatistics(value: unknown): DocumentationParameterStatistic[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.exercise_name !== "string" || typeof item.parameter_key !== "string") return [];
    return [{
      exerciseId: optionalString(item.exercise_id),
      exerciseName: item.exercise_name,
      parameterKey: item.parameter_key,
      label: stringValue(item.label) || item.parameter_key,
      unit: stringValue(item.unit),
      sampleCount: numberValue(item.sample_count),
      plannedAverage: numberValue(item.planned_average),
      actualAverage: numberValue(item.actual_average),
      achievementPercent: numberOrNull(item.achievement_percent),
    }];
  });
}

function parseMonthStatistics(value: unknown): DocumentationMonthStatistic[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.month !== "string") return [];
    return [{
      month: item.month,
      sessionCount: numberValue(item.session_count),
      plannedMinutes: numberValue(item.planned_minutes),
      actualMinutes: numberValue(item.actual_minutes),
      averageRpe: numberOrNull(item.average_rpe),
      averageRating: numberOrNull(item.average_rating),
    }];
  });
}

function parseReasons(value: unknown): DocumentationReasonStatistic[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== "string" || typeof item.label !== "string") return [];
    return [{ key: item.key, label: item.label, count: numberValue(item.count) }];
  });
}

export async function loadTrainingDocumentationStatistics(
  organizationId: string,
  athleteId: string,
  dateFrom: string,
  dateTo: string,
): Promise<TrainingDocumentationStatistics> {
  const data = await callJsonRpc("training_documentation_statistics", {
    p_organization_id: organizationId,
    p_athlete_id: athleteId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (!isRecord(data) || !isRecord(data.summary)) {
    throw new Error("Die Trainingsauswertung konnte nicht geladen werden.");
  }
  return {
    athleteId: stringValue(data.athlete_id),
    athleteName: stringValue(data.athlete_name),
    dateFrom: stringValue(data.date_from) || dateFrom,
    dateTo: stringValue(data.date_to) || dateTo,
    summary: {
      sessionCount: numberValue(data.summary.session_count),
      completedCount: numberValue(data.summary.completed_count),
      plannedMinutes: numberValue(data.summary.planned_minutes),
      actualMinutes: numberValue(data.summary.actual_minutes),
      averageRpe: numberOrNull(data.summary.average_rpe),
      averageRating: numberOrNull(data.summary.average_rating),
      painSessionCount: numberValue(data.summary.pain_session_count),
      exerciseCount: numberValue(data.summary.exercise_count),
      completionRate: numberValue(data.summary.completion_rate),
    },
    sessions: parseStatisticsSessions(data.sessions),
    exercises: parseExerciseStatistics(data.exercises),
    parameters: parseParameterStatistics(data.parameters),
    months: parseMonthStatistics(data.months),
    reasons: parseReasons(data.reasons),
  };
}

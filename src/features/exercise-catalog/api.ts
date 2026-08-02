import type { Json } from "@/types/database.generated";
import { requireSupabase } from "@/lib/supabase";
import type { EditLockWriteGuard } from "@/features/collaboration/edit-locks";
import {
  type Exercise,
  type ExerciseCatalogData,
  type ExerciseBlockUsage,
  type ExerciseCategory,
  type ExerciseDifficulty,
  type ExercisePlanUsage,
  type ExerciseInput,
  type ExerciseParameterDefinition,
  type ExerciseParameterInputType,
  type ExerciseTrainingGroup,
  type ExerciseListOption,
  type ExerciseParameterOption,
  type ExerciseVideo,
} from "@/features/exercise-catalog/types";
import {
  EXERCISE_VIDEO_BUCKET,
  exerciseVideoMimeType,
  uploadExerciseVideoFile,
  type ExerciseVideoUploadProgress,
} from "@/features/exercise-catalog/video-upload";

type JsonRpc = (
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function parseCategories(value: unknown): ExerciseCategory[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== "string" || typeof item.title !== "string") {
      return [];
    }
    return [{
      key: item.key,
      title: item.title,
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
      isActive: item.is_active !== false,
    }];
  });
}

function parseGroups(value: unknown): ExerciseTrainingGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
      return [];
    }
    return [{
      id: item.id,
      name: item.name,
      shortName: optionalString(item.short_name),
    }];
  });
}

function parseListOptions(value: unknown): ExerciseListOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== "string" || typeof item.label !== "string") return [];
    return [{
      key: item.key,
      label: item.label,
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
      isActive: item.is_active !== false,
    }];
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "de"));
}

function parseDifficulties(value: unknown): ExerciseDifficulty[] {
  return parseListOptions(value).map((option) => ({
    key: option.key,
    label: option.label,
    sortOrder: option.sortOrder,
    isActive: option.isActive,
  }));
}

function parseBlockUsages(value: unknown): ExerciseBlockUsage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      isActive: item.is_active !== false,
    }];
  });
}

function parsePlanUsages(value: unknown): ExercisePlanUsage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.title !== "string"
      || typeof item.training_date !== "string"
    ) return [];
    return [{
      id: item.id,
      title: item.title,
      trainingDate: item.training_date,
      viaBlockName: optionalString(item.via_block_name),
    }];
  });
}

function parseParameterOptions(value: unknown): ExerciseParameterOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== "string" || typeof item.label !== "string") return [];
    const inputType: ExerciseParameterInputType = item.input_type === "text" ? "text" : "number";
    return [{
      key: item.key,
      label: item.label,
      unit: typeof item.unit === "string" ? item.unit : "",
      inputType,
      stepValue: numberOrNull(item.step_value),
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
      isActive: item.is_active !== false,
    }];
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "de"));
}

function parseParameters(value: unknown): ExerciseParameterDefinition[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.parameter_key !== "string") return [];
    const inputType: ExerciseParameterInputType = item.input_type === "text" ? "text" : "number";
    return [{
      key: item.parameter_key,
      label: typeof item.label === "string" ? item.label : item.parameter_key,
      unit: typeof item.unit === "string" ? item.unit : "",
      inputType,
      defaultValue: typeof item.default_value === "string" ? item.default_value : "",
      minValue: numberOrNull(item.min_value),
      maxValue: numberOrNull(item.max_value),
      stepValue: numberOrNull(item.step_value),
      isRequired: item.is_required === true,
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
    }];
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

function parseExercises(value: unknown): Exercise[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.category_key !== "string" ||
      typeof item.category_title !== "string"
    ) {
      return [];
    }

    return [{
      id: item.id,
      name: item.name,
      categoryKey: item.category_key,
      categoryTitle: item.category_title,
      subcategory: optionalString(item.subcategory),
      goal: optionalString(item.goal),
      description: optionalString(item.description),
      coachingCues: optionalString(item.coaching_cues),
      commonMistakes: optionalString(item.common_mistakes),
      equipment: parseStringArray(item.equipment),
      videoUrl: optionalString(item.video_url),
      isActive: item.is_active !== false,
      isFavorite: item.is_favorite === true,
      difficultyKey: optionalString(item.difficulty_key),
      difficultyLabel: optionalString(item.difficulty_label),
      similarExerciseIds: parseStringArray(item.similar_exercise_ids),
      blockUsages: parseBlockUsages(item.block_usages),
      planUsages: parsePlanUsages(item.plan_usages),
      lastUsedAt: optionalString(item.last_used_at),
      groupIds: parseStringArray(item.group_ids),
      parameters: parseParameters(item.parameters),
      videos: [],
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
      updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
    }];
  });
}

async function callJsonRpc(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Json> {
  const supabase = requireSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as JsonRpc;
  const { data, error } = await rpc(functionName, args);
  if (error) throw new Error(error.message);
  return data ?? null;
}

type ExerciseVideoRow = ExerciseVideo & { exerciseId: string };

function parseExerciseVideos(value: unknown): ExerciseVideoRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.exercise_id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.storage_path !== "string"
    ) {
      return [];
    }

    return [{
      id: item.id,
      exerciseId: item.exercise_id,
      title: item.title,
      storagePath: item.storage_path,
      mimeType: typeof item.mime_type === "string" ? item.mime_type : "video/mp4",
      fileSize: typeof item.file_size === "number" ? item.file_size : 0,
      isPrimary: item.is_primary === true,
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
      signedUrl: null,
    }];
  });
}

async function withSignedVideoUrls(
  videos: ExerciseVideoRow[],
): Promise<ExerciseVideoRow[]> {
  if (videos.length === 0) return videos;
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage
    .from(EXERCISE_VIDEO_BUCKET)
    .createSignedUrls(videos.map((video) => video.storagePath), 60 * 60);

  if (error) throw new Error(error.message);
  return videos.map((video, index) => ({
    ...video,
    signedUrl: data?.[index]?.signedUrl ?? null,
  }));
}

async function loadExerciseVideoRows(
  organizationId: string,
  exerciseId: string | null = null,
  signUrls = false,
): Promise<ExerciseVideoRow[]> {
  const data = await callJsonRpc("exercise_video_overview", {
    p_organization_id: organizationId,
    p_exercise_id: exerciseId,
  });
  const videos = parseExerciseVideos(data);
  return signUrls ? withSignedVideoUrls(videos) : videos;
}

export async function loadExerciseCatalog(
  organizationId: string,
  includeInactive = true,
): Promise<ExerciseCatalogData> {
  const [data, videos] = await Promise.all([
    callJsonRpc("exercise_catalog_overview_v3", {
      p_organization_id: organizationId,
      p_include_inactive: includeInactive,
    }),
    loadExerciseVideoRows(organizationId),
  ]);

  if (!isRecord(data)) {
    throw new Error("Der Übungskatalog konnte nicht gelesen werden.");
  }

  const videosByExercise = new Map<string, ExerciseVideo[]>();
  videos.forEach((video) => {
    const current = videosByExercise.get(video.exerciseId) ?? [];
    current.push(video);
    videosByExercise.set(video.exerciseId, current);
  });

  return {
    categories: parseCategories(data.categories),
    subcategories: parseListOptions(data.subcategories),
    materials: parseListOptions(data.materials),
    difficulties: parseDifficulties(data.difficulties),
    parameterOptions: parseParameterOptions(data.parameter_options),
    groups: parseGroups(data.groups),
    exercises: parseExercises(data.exercises).map((exercise) => ({
      ...exercise,
      videos: videosByExercise.get(exercise.id) ?? [],
    })),
  };
}

export async function loadExerciseVideosForExercise(
  organizationId: string,
  exerciseId: string,
): Promise<ExerciseVideo[]> {
  return loadExerciseVideoRows(organizationId, exerciseId, true);
}

function parametersToJson(parameters: ExerciseParameterDefinition[]): Json {
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

export type ExerciseDuplicateCandidate = {
  id: string;
  name: string;
  score: number;
  exactNormalized: boolean;
};

export async function loadExerciseDuplicateCandidates(
  organizationId: string,
  exerciseId: string | null,
  name: string,
): Promise<ExerciseDuplicateCandidate[]> {
  const data = await callJsonRpc("exercise_duplicate_candidates", {
    p_organization_id: organizationId,
    p_exercise_id: exerciseId,
    p_name: name,
    p_limit: 5,
  });
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      score: typeof item.score === "number" ? item.score : 0,
      exactNormalized: item.exact_normalized === true,
    }];
  });
}

export async function saveExercise(
  organizationId: string,
  exerciseId: string | null,
  values: ExerciseInput,
  editLock: EditLockWriteGuard | null,
): Promise<string> {
  const data = await callJsonRpc("save_exercise_catalog_item_v4", {
    p_organization_id: organizationId,
    p_exercise_id: exerciseId,
    p_name: values.name.trim(),
    p_category_key: values.categoryKey,
    p_subcategory: values.subcategory.trim() || null,
    p_goal: values.goal.trim() || null,
    p_description: values.description.trim() || null,
    p_coaching_cues: values.coachingCues.trim() || null,
    p_common_mistakes: values.commonMistakes.trim() || null,
    p_equipment: values.equipment,
    p_video_url: values.videoUrl.trim() || null,
    p_is_active: values.isActive,
    p_group_ids: values.groupIds,
    p_parameters: parametersToJson(values.parameters),
    p_difficulty_key: values.difficultyKey || null,
    p_similar_exercise_ids: values.similarExerciseIds,
    p_lock_token: editLock?.lockToken ?? null,
    p_expected_updated_at: editLock?.expectedUpdatedAt ?? null,
  });

  if (!isRecord(data) || typeof data.id !== "string" || typeof data.updated_at !== "string") {
    throw new Error("Die Übung wurde gespeichert, aber die Rückgabe ist ungültig.");
  }
  return data.id;
}

export async function setExerciseFavorite(
  organizationId: string,
  exerciseId: string,
  isFavorite: boolean,
): Promise<void> {
  await callJsonRpc("set_exercise_favorite", {
    p_organization_id: organizationId,
    p_exercise_id: exerciseId,
    p_is_favorite: isFavorite,
  });
}


export async function uploadExerciseVideo(
  organizationId: string,
  exerciseId: string,
  file: File,
  title: string,
  onProgress?: (progress: ExerciseVideoUploadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const storagePath = await uploadExerciseVideoFile({
    organizationId,
    exerciseId,
    file,
    onProgress,
    signal,
  });

  try {
    await callJsonRpc("register_exercise_video", {
      p_organization_id: organizationId,
      p_exercise_id: exerciseId,
      p_storage_path: storagePath,
      p_title: title,
      p_mime_type: exerciseVideoMimeType(file),
      p_file_size: file.size,
    });
  } catch (error) {
    const supabase = requireSupabase();
    await supabase.storage.from(EXERCISE_VIDEO_BUCKET).remove([storagePath]);
    throw error;
  }
}

export async function setPrimaryExerciseVideo(
  organizationId: string,
  exerciseId: string,
  videoId: string,
): Promise<void> {
  await callJsonRpc("set_exercise_primary_video", {
    p_organization_id: organizationId,
    p_exercise_id: exerciseId,
    p_video_id: videoId,
  });
}

export async function deleteExerciseVideo(
  organizationId: string,
  exerciseId: string,
  video: ExerciseVideo,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.storage.from(EXERCISE_VIDEO_BUCKET).remove([video.storagePath]);
  if (error && !/not found/i.test(error.message)) throw new Error(error.message);

  await callJsonRpc("delete_exercise_video_record", {
    p_organization_id: organizationId,
    p_exercise_id: exerciseId,
    p_video_id: video.id,
  });
}

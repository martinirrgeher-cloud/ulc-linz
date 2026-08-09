import { callJsonRpcRawError as callJsonRpc } from "@/lib/supabase-rpc";
import { parseStringArray } from "@/lib/json-value";
import {
  parseDeleteSpecialTrainingResult,
  parseQuickAthleteResult,
  parseTrainingConfigurationOverview,
  parseTrainingSessionPayload,
} from "@/features/training-session/api-parsers";
import type { GroupTrainingModuleKey } from "@/features/group-training/modules";
import type {
  DeleteSpecialTrainingResult,
  QuickAthleteInput,
  QuickAthleteResult,
  SaveTrainingInput,
  TrainingConfiguration,
  TrainingSession,
} from "@/features/training-session/types";

export type { GroupTrainingModuleKey } from "@/features/group-training/modules";

export async function loadGroupTrainingConfiguration(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
): Promise<TrainingConfiguration> {
  const data = await callJsonRpc("training_module_configuration_overview", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
  });

  const configuration = parseTrainingConfigurationOverview(
    data,
    "Die Trainingskonfiguration besitzt ein ungültiges Format.",
    "Die zugeordnete Trainingsgruppe ist ungültig.",
  );
  if (!configuration.group) return configuration;

  const groupTrainerIds = parseStringArray(await callJsonRpc(
    "training_module_group_trainer_ids",
    {
      p_organization_id: organizationId,
      p_module_key: moduleKey,
      p_group_id: configuration.group.id,
    },
  ));

  return { ...configuration, groupTrainerIds };
}

export async function loadGroupTrainingSession(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
  groupId: string,
  sessionDate: string,
): Promise<TrainingSession> {
  const data = await callJsonRpc("training_module_session_overview", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_group_id: groupId,
    p_session_date: sessionDate,
  });

  return parseTrainingSessionPayload(data);
}

export async function saveGroupTrainingSession(
  moduleKey: GroupTrainingModuleKey,
  input: SaveTrainingInput,
): Promise<TrainingSession> {
  const attendance = input.participants.map((participant) => ({
    athlete_id: participant.athleteId,
    status: input.attendance[participant.athleteId] ?? "open",
  }));

  const data = await callJsonRpc("save_training_module_session", {
    p_organization_id: input.organizationId,
    p_module_key: moduleKey,
    p_group_id: input.groupId,
    p_session_date: input.sessionDate,
    p_state: input.state,
    p_note: input.note,
    p_attendance: attendance,
    p_trainer_ids: input.trainerIds,
    p_environment: input.environment,
    p_expected_updated_at: input.expectedUpdatedAt,
  });

  return parseTrainingSessionPayload(data);
}

export async function deleteGroupTrainingSpecialSession(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
  groupId: string,
  sessionDate: string,
): Promise<DeleteSpecialTrainingResult> {
  const data = await callJsonRpc("delete_training_module_special_session", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_group_id: groupId,
    p_session_date: sessionDate,
  });

  return parseDeleteSpecialTrainingResult(data);
}

export async function createGroupTrainingAthlete(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
  input: QuickAthleteInput,
): Promise<QuickAthleteResult> {
  const data = await callJsonRpc("create_training_module_athlete", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_birth_year: input.birthYear,
    p_session_date: input.sessionDate,
    p_attach_existing: input.attachExisting === true,
  });

  return parseQuickAthleteResult(data);
}

import { callJsonRpcRawError as callJsonRpc } from "@/lib/supabase-rpc";
import { parseTrainingStatisticsOverview } from "@/features/training-session/statistics-parsers";
import type { TrainingStatistics } from "@/features/training-session/statistics-types";
import type { GroupTrainingModuleKey } from "@/features/group-training/modules";

export async function loadGroupTrainingStatistics(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
  fromDate: string | null,
  toDate: string,
  sessionLimit: number,
): Promise<TrainingStatistics> {
  const data = await callJsonRpc("training_module_statistics_overview", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_from_date: fromDate,
    p_to_date: toDate,
    p_session_limit: sessionLimit,
  });

  return parseTrainingStatisticsOverview(data, toDate);
}

export async function saveGroupTrainingStatisticsDefault(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
  fromDate: string,
): Promise<string> {
  const data = await callJsonRpc("save_training_module_statistics_default", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_from_date: fromDate,
  });
  if (typeof data !== "string") throw new Error("Der Statistik-Standard konnte nicht bestätigt werden.");
  return data;
}

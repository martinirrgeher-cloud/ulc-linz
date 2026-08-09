import { callJsonRpcRawError as callJsonRpc } from "@/lib/supabase-rpc";
import { parseTrainingStatisticsOverview } from "@/features/training-session/statistics-parsers";
import type { TrainingStatistics } from "@/features/training-session/statistics-types";

export async function loadKindertrainingStatistics(
  organizationId: string,
  fromDate: string | null,
  toDate: string,
  sessionLimit: number,
): Promise<TrainingStatistics> {
  const data = await callJsonRpc("kindertraining_statistics_overview", {
    p_organization_id: organizationId,
    p_from_date: fromDate,
    p_to_date: toDate,
    p_session_limit: sessionLimit,
  });

  return parseTrainingStatisticsOverview(data, toDate);
}

export async function saveKindertrainingStatisticsDefault(
  organizationId: string,
  fromDate: string,
): Promise<string> {
  const data = await callJsonRpc("save_kindertraining_statistics_default", {
    p_organization_id: organizationId,
    p_from_date: fromDate,
  });
  if (typeof data !== "string") throw new Error("Der Statistik-Standard konnte nicht bestätigt werden.");
  return data;
}

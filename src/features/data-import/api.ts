import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type { ImportRunResult } from "@/features/data-import/types";

import { isRecord } from "@/lib/json-value";
export type PreparedImportRow = Record<string, Json | undefined>;
export type PreparedMissingOption = Record<string, Json | undefined>;

function parseImportResult(value: Json): ImportRunResult {
  if (!isRecord(value)) {
    throw new Error("Der Import wurde ausgeführt, aber die Rückgabe ist ungültig.");
  }

  const rawRows = value.rows;
  const rows = Array.isArray(rawRows)
    ? rawRows.flatMap((item) => {
      if (
        !isRecord(item)
        || typeof item.row_number !== "number"
        || typeof item.label !== "string"
        || typeof item.action !== "string"
        || typeof item.success !== "boolean"
        || typeof item.message !== "string"
      ) {
        return [];
      }
      if (!["create", "update", "skip"].includes(item.action)) return [];
      return [{
        rowNumber: item.row_number,
        label: item.label,
        action: item.action as "create" | "update" | "skip",
        success: item.success,
        message: item.message,
      }];
    })
    : [];

  return {
    created: typeof value.created === "number" ? value.created : 0,
    updated: typeof value.updated === "number" ? value.updated : 0,
    skipped: typeof value.skipped === "number" ? value.skipped : 0,
    failed: typeof value.failed === "number" ? value.failed : 0,
    rows,
  };
}

export async function applyExerciseImport(
  organizationId: string,
  importId: string,
  rows: PreparedImportRow[],
  missingOptions: PreparedMissingOption[],
): Promise<ImportRunResult> {
  const { data, error } = await requireSupabase().rpc("apply_exercise_import_v2", {
    p_organization_id: organizationId,
    p_import_id: importId,
    p_rows: rows as unknown as Json,
    p_missing_options: missingOptions as unknown as Json,
  });

  if (error) throw new Error(error.message || "Der Import konnte nicht ausgeführt werden.");
  return parseImportResult(data);
}

export async function applyAthleteImport(
  organizationId: string,
  importId: string,
  rows: PreparedImportRow[],
): Promise<ImportRunResult> {
  const { data, error } = await requireSupabase().rpc("apply_athlete_import_v1", {
    p_organization_id: organizationId,
    p_import_id: importId,
    p_rows: rows as unknown as Json,
  });

  if (error) throw new Error(error.message || "Der Import konnte nicht ausgeführt werden.");
  return parseImportResult(data);
}

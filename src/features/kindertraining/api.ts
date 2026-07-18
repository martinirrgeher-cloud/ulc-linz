import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  AttendanceStatus,
  KindertrainingGroup,
  KindertrainingParticipant,
  KindertrainingSession,
  SaveKindertrainingInput,
  TrainingSessionState,
} from "@/features/kindertraining/types";


type JsonRpcResponse = {
  data: Json;
  error: unknown | null;
};

async function callJsonRpc(
  functionName: string,
  args: Record<string, Json | undefined>,
): Promise<Json> {
  const supabase = requireSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    parameters: Record<string, Json | undefined>,
  ) => PromiseLike<JsonRpcResponse>;

  const { data, error } = await rpc(functionName, args);

  if (error) throw error;
  return data;
}

const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "open",
  "present",
  "excused",
  "absent",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseStatus(value: unknown): AttendanceStatus {
  return ATTENDANCE_STATUSES.includes(value as AttendanceStatus)
    ? (value as AttendanceStatus)
    : "open";
}

function parseState(value: unknown): TrainingSessionState {
  return value === "cancelled" ? "cancelled" : "scheduled";
}

function parseParticipants(value: unknown): KindertrainingParticipant[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (
      typeof item.athlete_id !== "string" ||
      typeof item.first_name !== "string" ||
      typeof item.last_name !== "string"
    ) {
      return [];
    }

    return [
      {
        athleteId: item.athlete_id,
        firstName: item.first_name,
        lastName: item.last_name,
        birthYear: typeof item.birth_year === "number" ? item.birth_year : null,
        isActive: item.is_active !== false,
        status: parseStatus(item.status),
      },
    ];
  });
}

function parseSessionPayload(value: Json): KindertrainingSession {
  if (!isRecord(value)) {
    throw new Error("Die Trainingsdaten besitzen ein ungültiges Format.");
  }

  const rawSession = isRecord(value.session) ? value.session : null;

  return {
    id: rawSession && typeof rawSession.id === "string" ? rawSession.id : null,
    state: parseState(rawSession?.state),
    note: rawSession && typeof rawSession.note === "string" ? rawSession.note : "",
    createdAt: asNullableString(rawSession?.created_at),
    updatedAt: asNullableString(rawSession?.updated_at),
    participants: parseParticipants(value.participants),
  };
}

export async function loadKindertrainingGroups(
  organizationId: string,
): Promise<KindertrainingGroup[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("training_group_overview", {
    p_organization_id: organizationId,
  });

  if (error) throw error;

  return data
    .map((group) => ({
      id: group.id,
      name: group.name,
      shortName: group.short_name,
      description: group.description,
      isActive: group.is_active,
      sortOrder: group.sort_order,
      athleteCount: Number(group.athlete_count),
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    }))
    .filter((group) => group.isActive)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, "de-AT", { sensitivity: "base" }),
    );
}

export async function loadKindertrainingSession(
  organizationId: string,
  groupId: string,
  sessionDate: string,
): Promise<KindertrainingSession> {
  const data = await callJsonRpc("kindertraining_session_overview", {
    p_organization_id: organizationId,
    p_group_id: groupId,
    p_session_date: sessionDate,
  });

  return parseSessionPayload(data);
}

export async function saveKindertrainingSession(
  input: SaveKindertrainingInput,
): Promise<KindertrainingSession> {
  const attendance = input.participants.map((participant) => ({
    athlete_id: participant.athleteId,
    status: input.attendance[participant.athleteId] ?? "open",
  }));

  const data = await callJsonRpc("save_kindertraining_session", {
    p_organization_id: input.organizationId,
    p_group_id: input.groupId,
    p_session_date: input.sessionDate,
    p_state: input.state,
    p_note: input.note,
    p_attendance: attendance,
    p_expected_updated_at: input.expectedUpdatedAt,
  });

  return parseSessionPayload(data);
}

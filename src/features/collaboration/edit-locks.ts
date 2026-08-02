import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";

export type LockableEntityType =
  | "exercise"
  | "training_block"
  | "athlete"
  | "training_plan"
  | "training_documentation"
  | "training_group"
  | "trainer";

export type EditLockOwner = {
  userId: string;
  displayName: string;
  acquiredAt: string;
  expiresAt: string;
  isOwnOtherSession: boolean;
};

export type AcquireEditLockResult = {
  acquired: boolean;
  lockToken: string | null;
  owner: EditLockOwner | null;
  recordVersion: string | null;
  canForce: boolean;
};

export type EditLockWriteGuard = {
  lockToken: string;
  expectedUpdatedAt: string;
};

type JsonRpcResponse = {
  data: Json;
  error: { message?: string } | null;
};

type JsonRpc = (
  name: string,
  parameters: Record<string, unknown>,
) => PromiseLike<JsonRpcResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function callJsonRpc(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Json> {
  const supabase = requireSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as JsonRpc;
  const { data, error } = await rpc(functionName, args);
  if (error) throw new Error(error.message || "Die Bearbeitungsreservierung ist fehlgeschlagen.");
  return data ?? null;
}

export async function acquireEditLock(
  organizationId: string,
  entityType: LockableEntityType,
  entityId: string,
  lockToken: string,
  force = false,
): Promise<AcquireEditLockResult> {
  const data = await callJsonRpc("acquire_edit_lock", {
    p_organization_id: organizationId,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_lock_token: lockToken,
    p_force: force,
    p_ttl_seconds: 120,
  });

  if (!isRecord(data)) {
    throw new Error("Die Antwort der Bearbeitungsreservierung ist ungültig.");
  }

  const acquired = data.acquired === true;
  const displayName = stringValue(data.locked_by_name);
  const userId = stringValue(data.locked_by_user_id);
  const acquiredAt = stringValue(data.acquired_at);
  const expiresAt = stringValue(data.expires_at);

  return {
    acquired,
    lockToken: acquired ? stringValue(data.lock_token) ?? lockToken : null,
    owner: displayName && userId && acquiredAt && expiresAt
      ? {
          userId,
          displayName,
          acquiredAt,
          expiresAt,
          isOwnOtherSession: data.is_own_other_session === true,
        }
      : null,
    recordVersion: stringValue(data.record_version),
    canForce: data.can_force === true,
  };
}

export async function renewEditLock(
  organizationId: string,
  entityType: LockableEntityType,
  entityId: string,
  lockToken: string,
): Promise<boolean> {
  const data = await callJsonRpc("renew_edit_lock", {
    p_organization_id: organizationId,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_lock_token: lockToken,
    p_ttl_seconds: 120,
  });
  return isRecord(data) && data.renewed === true;
}

export async function releaseEditLock(
  organizationId: string,
  entityType: LockableEntityType,
  entityId: string,
  lockToken: string,
): Promise<void> {
  await callJsonRpc("release_edit_lock", {
    p_organization_id: organizationId,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_lock_token: lockToken,
  });
}

export async function assertEditLock(
  organizationId: string,
  entityType: LockableEntityType,
  entityId: string,
  lockToken: string,
  expectedUpdatedAt: string | null,
): Promise<void> {
  await callJsonRpc("assert_edit_lock", {
    p_organization_id: organizationId,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_lock_token: lockToken,
    p_expected_updated_at: expectedUpdatedAt,
  });
}

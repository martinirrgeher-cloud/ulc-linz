
import { callJsonRpc as callSharedJsonRpc } from "@/lib/supabase-rpc";
import { isRecord } from "@/lib/json-value";
export type LockableEntityType =
  | "exercise"
  | "training_block"
  | "athlete"
  | "training_plan"
  | "training_documentation"
  | "training_group"
  | "trainer"
  | "organization_member";

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

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const callJsonRpc = (functionName: string, args: Record<string, unknown>) => (
  callSharedJsonRpc(functionName, args, "Die Bearbeitungsreservierung ist fehlgeschlagen.")
);

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

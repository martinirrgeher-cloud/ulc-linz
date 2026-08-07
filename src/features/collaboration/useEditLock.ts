import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acquireEditLock,
  assertEditLock,
  releaseEditLock,
  renewEditLock,
  type EditLockOwner,
  type EditLockWriteGuard,
  type LockableEntityType,
} from "@/features/collaboration/edit-locks";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import { useAuth } from "@/features/auth/AuthContext";
export type EditLockStatus =
  | "idle"
  | "acquiring"
  | "acquired"
  | "blocked"
  | "lost"
  | "error";

export type UseEditLockOptions = {
  organizationId: string | null | undefined;
  entityType: LockableEntityType;
  entityId: string | null | undefined;
  expectedUpdatedAt?: string | null;
  enabled: boolean;
};

export type EditLockState = {
  status: EditLockStatus;
  owner: EditLockOwner | null;
  canForce: boolean;
  recordVersion: string | null;
  error: string | null;
  isEditable: boolean;
  retry: () => Promise<void>;
  forceAcquire: () => Promise<void>;
  acceptRecordVersion: (version: string | null | undefined) => void;
  getWriteGuard: () => EditLockWriteGuard | null;
  validateBeforeSave: () => Promise<void>;
};

function createLockToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Bearbeitungsreservierung konnte nicht geprüft werden.", "edit_lock");
}

export function useEditLock({
  organizationId,
  entityType,
  entityId,
  expectedUpdatedAt = null,
  enabled,
}: UseEditLockOptions): EditLockState {
  const { isSimulationActive } = useAuth();
  const tokenRef = useRef(createLockToken());
  const activeKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<EditLockStatus>("idle");
  const [owner, setOwner] = useState<EditLockOwner | null>(null);
  const [canForce, setCanForce] = useState(false);
  const [recordVersion, setRecordVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = organizationId && entityId
    ? `${organizationId}:${entityType}:${entityId}`
    : null;

  const acquire = useCallback(async (force: boolean) => {
    if (!enabled || !organizationId || !entityId || !key) return;
    if (isSimulationActive) {
      setOwner(null);
      setCanForce(false);
      setRecordVersion(expectedUpdatedAt);
      setStatus("acquired");
      setError(null);
      return;
    }

    const requestToken = tokenRef.current;
    setStatus("acquiring");
    setError(null);
    try {
      const result = await acquireEditLock(
        organizationId,
        entityType,
        entityId,
        requestToken,
        force,
      );
      if (
        !mountedRef.current ||
        activeKeyRef.current !== key ||
        tokenRef.current !== requestToken
      ) return;

      setCanForce(result.canForce);
      setOwner(result.owner);
      setRecordVersion(result.recordVersion);
      setStatus(result.acquired ? "acquired" : "blocked");
    } catch (acquireError) {
      if (
        !mountedRef.current ||
        activeKeyRef.current !== key ||
        tokenRef.current !== requestToken
      ) return;
      setStatus("error");
      setError(errorMessage(acquireError));
    }
  }, [enabled, entityId, entityType, expectedUpdatedAt, isSimulationActive, key, organizationId]);

  useEffect(() => {
    mountedRef.current = true;
    activeKeyRef.current = key;
    tokenRef.current = createLockToken();
    setOwner(null);
    setCanForce(false);
    setRecordVersion(null);
    setError(null);

    if (!enabled || !organizationId || !entityId || !key) {
      setStatus("idle");
      return () => {
        activeKeyRef.current = null;
      };
    }

    if (isSimulationActive) {
      setRecordVersion(expectedUpdatedAt);
      setStatus("acquired");
      return () => {
        activeKeyRef.current = null;
      };
    }

    void acquire(false);

    return () => {
      const token = tokenRef.current;
      activeKeyRef.current = null;
      void releaseEditLock(organizationId, entityType, entityId, token).catch(() => undefined);
    };
  }, [acquire, enabled, entityId, entityType, expectedUpdatedAt, isSimulationActive, key, organizationId]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || !organizationId || !entityId || !key || isSimulationActive) return;

    if (status === "acquired") {
      const heartbeat = window.setInterval(() => {
        void renewEditLock(
          organizationId,
          entityType,
          entityId,
          tokenRef.current,
        ).then((renewed) => {
          if (activeKeyRef.current !== key) return;
          if (!renewed) {
            setStatus("lost");
            setError("Die Bearbeitungsreservierung ist abgelaufen oder wurde übernommen.");
            return;
          }
          setError(null);
        }).catch(() => {
          // Kurze mobile Netzunterbrechungen dürfen den Editor nicht sofort sperren.
          // Beim nächsten Heartbeat und spätestens vor dem Speichern wird erneut geprüft.
        });
      }, 30_000);
      return () => window.clearInterval(heartbeat);
    }

    if (status === "blocked") {
      const retryTimer = window.setInterval(() => void acquire(false), 15_000);
      return () => window.clearInterval(retryTimer);
    }
  }, [acquire, enabled, entityId, entityType, isSimulationActive, key, organizationId, status]);

  useEffect(() => {
    if (isSimulationActive || status !== "acquired" || !organizationId || !entityId || !key) return;

    const renewWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void renewEditLock(
        organizationId,
        entityType,
        entityId,
        tokenRef.current,
      ).then((renewed) => {
        if (activeKeyRef.current !== key) return;
        if (!renewed) {
          setStatus("lost");
          setError("Die Bearbeitungsreservierung ist abgelaufen oder wurde übernommen.");
          return;
        }
        setError(null);
      }).catch(() => {
        // Beim nächsten Heartbeat und vor dem Speichern wird erneut geprüft.
      });
    };

    document.addEventListener("visibilitychange", renewWhenVisible);
    window.addEventListener("focus", renewWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", renewWhenVisible);
      window.removeEventListener("focus", renewWhenVisible);
    };
  }, [entityId, entityType, isSimulationActive, key, organizationId, status]);

  const retry = useCallback(async () => acquire(false), [acquire]);
  const forceAcquire = useCallback(async () => acquire(true), [acquire]);
  const acceptRecordVersion = useCallback((version: string | null | undefined) => {
    if (version) setRecordVersion(version);
  }, []);

  const getWriteGuard = useCallback((): EditLockWriteGuard | null => {
    if (!enabled || !organizationId || !entityId) return null;
    if (isSimulationActive) {
      if (!expectedUpdatedAt) return null;
      return { lockToken: "simulation-no-write", expectedUpdatedAt };
    }
    if (status !== "acquired") {
      throw new Error("Dieser Datensatz ist derzeit nicht für dich zur Bearbeitung reserviert.");
    }
    if (!expectedUpdatedAt) {
      throw new Error("Die Datensatzversion fehlt. Bitte Datensatz neu laden.");
    }
    return {
      lockToken: tokenRef.current,
      expectedUpdatedAt,
    };
  }, [enabled, entityId, expectedUpdatedAt, isSimulationActive, organizationId, status]);

  const validateBeforeSave = useCallback(async () => {
    if (!enabled || !organizationId || !entityId || isSimulationActive) return;
    if (status !== "acquired") {
      throw new Error("Dieser Datensatz ist derzeit nicht für dich zur Bearbeitung reserviert.");
    }
    await assertEditLock(
      organizationId,
      entityType,
      entityId,
      tokenRef.current,
      expectedUpdatedAt,
    );
  }, [enabled, entityId, entityType, expectedUpdatedAt, isSimulationActive, organizationId, status]);

  return useMemo(() => ({
    status,
    owner,
    canForce,
    recordVersion,
    error,
    isEditable: !enabled || status === "acquired",
    retry,
    forceAcquire,
    acceptRecordVersion,
    getWriteGuard,
    validateBeforeSave,
  }), [acceptRecordVersion, canForce, enabled, error, forceAcquire, getWriteGuard, owner, recordVersion, retry, status, validateBeforeSave]);
}

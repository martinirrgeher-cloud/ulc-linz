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
  error: string | null;
  isEditable: boolean;
  retry: () => Promise<void>;
  forceAcquire: () => Promise<void>;
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
  return error instanceof Error
    ? error.message
    : "Die Bearbeitungsreservierung konnte nicht geprüft werden.";
}

export function useEditLock({
  organizationId,
  entityType,
  entityId,
  expectedUpdatedAt = null,
  enabled,
}: UseEditLockOptions): EditLockState {
  const tokenRef = useRef(createLockToken());
  const activeKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<EditLockStatus>("idle");
  const [owner, setOwner] = useState<EditLockOwner | null>(null);
  const [canForce, setCanForce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = organizationId && entityId
    ? `${organizationId}:${entityType}:${entityId}`
    : null;

  const acquire = useCallback(async (force: boolean) => {
    if (!enabled || !organizationId || !entityId || !key) return;

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
  }, [enabled, entityId, entityType, key, organizationId]);

  useEffect(() => {
    mountedRef.current = true;
    activeKeyRef.current = key;
    tokenRef.current = createLockToken();
    setOwner(null);
    setCanForce(false);
    setError(null);

    if (!enabled || !organizationId || !entityId || !key) {
      setStatus("idle");
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
  }, [acquire, enabled, entityId, entityType, key, organizationId]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || !organizationId || !entityId || !key) return;

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
  }, [acquire, enabled, entityId, entityType, key, organizationId, status]);

  useEffect(() => {
    if (status !== "acquired" || !organizationId || !entityId || !key) return;

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
  }, [entityId, entityType, key, organizationId, status]);

  const retry = useCallback(async () => acquire(false), [acquire]);
  const forceAcquire = useCallback(async () => acquire(true), [acquire]);

  const getWriteGuard = useCallback((): EditLockWriteGuard | null => {
    if (!enabled || !organizationId || !entityId) return null;
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
  }, [enabled, entityId, expectedUpdatedAt, organizationId, status]);

  const validateBeforeSave = useCallback(async () => {
    if (!enabled || !organizationId || !entityId) return;
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
  }, [enabled, entityId, entityType, expectedUpdatedAt, organizationId, status]);

  return useMemo(() => ({
    status,
    owner,
    canForce,
    error,
    isEditable: !enabled || status === "acquired",
    retry,
    forceAcquire,
    getWriteGuard,
    validateBeforeSave,
  }), [canForce, enabled, error, forceAcquire, getWriteGuard, owner, retry, status, validateBeforeSave]);
}

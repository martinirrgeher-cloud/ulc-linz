import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { requireSupabase, synchronizeRealtimeAuth } from "@/lib/supabase";

export type CollaborationRealtimeTable =
  | "athletes"
  | "training_groups"
  | "trainers"
  | "exercises"
  | "training_blocks"
  | "training_block_user_favorites"
  | "athlete_training_plans"
  | "athlete_training_sessions"
  | "organization_members"
  | "audit_log";

export type CollaborationRealtimeChange = {
  table: CollaborationRealtimeTable;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  recordId: string | null;
  occurredAt: string;
};

export type CollaborationRealtimeRefresh = {
  reason: "database" | "reconnected";
  changes: CollaborationRealtimeChange[];
};

export type CollaborationRealtimeStatus =
  | "idle"
  | "connecting"
  | "subscribed"
  | "disconnected"
  | "error";

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  commit_timestamp?: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type PostgresChangeChannel = {
  on: (
    type: "postgres_changes",
    filter: {
      event: "*";
      schema: "public";
      table: string;
      filter: string;
    },
    callback: (payload: RealtimePayload) => void,
  ) => PostgresChangeChannel;
  subscribe: (
    callback?: (status: string, error?: Error) => void,
  ) => RealtimeChannel;
};

export type UseOrganizationRealtimeOptions = {
  organizationId: string | null | undefined;
  tables: readonly CollaborationRealtimeTable[];
  enabled?: boolean;
  onRefresh: (refresh: CollaborationRealtimeRefresh) => void;
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function recordId(payload: RealtimePayload): string | null {
  const row = payload.eventType === "DELETE" ? payload.old : payload.new;
  return stringValue(row.id);
}

export function useOrganizationRealtime({
  organizationId,
  tables,
  enabled = true,
  onRefresh,
}: UseOrganizationRealtimeOptions): CollaborationRealtimeStatus {
  const [status, setStatus] = useState<CollaborationRealtimeStatus>("idle");
  const callbackRef = useRef(onRefresh);
  const pendingRef = useRef<CollaborationRealtimeChange[]>([]);
  const timerRef = useRef<number | null>(null);
  const subscribedOnceRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  const tableKey = useMemo(
    () => [...new Set(tables)].sort().join(","),
    [tables],
  );

  useEffect(() => {
    if (!enabled || !organizationId || !tableKey) {
      setStatus("idle");
      return undefined;
    }

    subscribedOnceRef.current = false;
    const supabase = requireSupabase();
    const channelName = `collaboration:${organizationId}:${tableKey}`;
    let disposed = false;
    let subscribedChannel: RealtimeChannel | null = null;

    function flushDatabaseChanges() {
      timerRef.current = null;
      if (disposed || pendingRef.current.length === 0) return;
      const changes = pendingRef.current;
      pendingRef.current = [];
      callbackRef.current({ reason: "database", changes });
    }

    function queueChange(
      table: CollaborationRealtimeTable,
      payload: RealtimePayload,
    ) {
      pendingRef.current.push({
        table,
        eventType: payload.eventType,
        recordId: recordId(payload),
        occurredAt: payload.commit_timestamp ?? new Date().toISOString(),
      });
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flushDatabaseChanges, 250);
    }

    async function connect() {
      setStatus("connecting");

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        if (!disposed) setStatus("disconnected");
        return;
      }

      await synchronizeRealtimeAuth(supabase, data.session);
      if (disposed) return;

      const channel = supabase.channel(channelName) as unknown as PostgresChangeChannel;
      for (const table of tableKey.split(",") as CollaborationRealtimeTable[]) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `organization_id=eq.${organizationId}`,
          },
          (payload) => queueChange(table, payload),
        );
      }

      subscribedChannel = channel.subscribe((nextStatus) => {
        if (disposed) return;
        if (nextStatus === "SUBSCRIBED") {
          setStatus("subscribed");
          if (subscribedOnceRef.current) {
            callbackRef.current({ reason: "reconnected", changes: [] });
          }
          subscribedOnceRef.current = true;
          return;
        }
        if (nextStatus === "CHANNEL_ERROR") {
          setStatus("error");
          return;
        }
        if (nextStatus === "TIMED_OUT" || nextStatus === "CLOSED") {
          setStatus("disconnected");
        }
      });
    }

    const refreshAfterInterruption = () => {
      if (disposed) return;
      callbackRef.current({ reason: "reconnected", changes: [] });
    };

    window.addEventListener("online", refreshAfterInterruption);
    void connect().catch(() => {
      if (!disposed) setStatus("error");
    });

    return () => {
      disposed = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current = [];
      window.removeEventListener("online", refreshAfterInterruption);
      if (subscribedChannel) void supabase.removeChannel(subscribedChannel);
    };
  }, [enabled, organizationId, tableKey]);

  return status;
}

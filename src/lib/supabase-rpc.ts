import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";

type JsonRpcResponse = {
  data: Json | null;
  error: unknown | null;
};

type JsonRpc = (
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<JsonRpcResponse>;

type ErrorRecord = Record<string, unknown>;

function errorRecord(error: unknown): ErrorRecord | null {
  return typeof error === "object" && error !== null ? error as ErrorRecord : null;
}

function stringField(record: ErrorRecord | null, key: string): string | null {
  const value = record?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function numericStatus(record: ErrorRecord | null): number | null {
  const value = record?.status ?? record?.statusCode;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{3}$/.test(value)) return Number(value);
  return null;
}

function errorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return stringField(errorRecord(error), "message");
}

/**
 * Behält die technisch relevanten, nicht geheimen Supabase/PostgREST-Metadaten
 * beim Wrappen eines RPC-Fehlers. Dadurch kann die zentrale Diagnose z. B.
 * PGRST-/Postgres-Codes klassifizieren, ohne rohe Serverobjekte anzuzeigen.
 */
export class SupabaseRpcError extends Error {
  readonly code: string | null;
  readonly status: number | null;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(error: unknown, fallbackMessage: string) {
    const record = errorRecord(error);
    super(errorMessage(error) ?? fallbackMessage);
    this.name = "SupabaseRpcError";
    this.code = stringField(record, "code");
    this.status = numericStatus(record);
    this.details = stringField(record, "details");
    this.hint = stringField(record, "hint");
    if (error instanceof Error && error.stack) this.stack = error.stack;
  }
}

export function isSupabaseRpcErrorCode(error: unknown, code: string): boolean {
  return error instanceof SupabaseRpcError && error.code === code;
}

async function invokeJsonRpc(
  functionName: string,
  args: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const supabase = requireSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as JsonRpc;
  return rpc(functionName, args);
}

export async function callJsonRpc(
  functionName: string,
  args: Record<string, unknown>,
  fallbackErrorMessage = `Die Serverfunktion „${functionName}“ ist fehlgeschlagen.`,
): Promise<Json> {
  const { data, error } = await invokeJsonRpc(functionName, args);
  if (error) throw new SupabaseRpcError(error, fallbackErrorMessage);
  return data ?? null;
}

/**
 * Bewusst unverändert roh für bestehende Features, die serverseitige
 * Konflikt-/Statusobjekte selbst auswerten. Neue APIs sollen callJsonRpc nutzen.
 */
export async function callJsonRpcRawError(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Json> {
  const { data, error } = await invokeJsonRpc(functionName, args);
  if (error) throw error;
  return data ?? null;
}

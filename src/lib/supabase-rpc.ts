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

function errorMessage(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    return message || null;
  }
  return null;
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
  if (error) throw new Error(errorMessage(error) ?? fallbackErrorMessage);
  return data ?? null;
}

export async function callJsonRpcRawError(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Json> {
  const { data, error } = await invokeJsonRpc(functionName, args);
  if (error) throw error;
  return data ?? null;
}

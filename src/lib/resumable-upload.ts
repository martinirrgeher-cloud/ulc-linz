import { requireSupabase } from "@/lib/supabase";

export type ResumableUploadAuth = {
  ownerUserId: string;
  token: string;
};

export class ResumableUploadHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResumableUploadHttpError";
    this.status = status;
  }
}

export class ResumableUploadPausedError extends Error {
  constructor() {
    super("Der Upload wurde pausiert.");
    this.name = "ResumableUploadPausedError";
  }
}

let refreshPromise: Promise<ResumableUploadAuth> | null = null;

function sessionAuth(
  session: { access_token?: string; user?: { id?: string } } | null,
): ResumableUploadAuth {
  const token = session?.access_token;
  const ownerUserId = session?.user?.id;
  if (!token || !ownerUserId) {
    throw new Error("Die Anmeldung ist abgelaufen. Bitte neu anmelden.");
  }
  return { token, ownerUserId };
}

export async function loadResumableUploadAuth(): Promise<ResumableUploadAuth> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return sessionAuth(data.session);
}

async function refreshResumableUploadSession(): Promise<ResumableUploadAuth> {
  if (!refreshPromise) {
    const supabase = requireSupabase();
    refreshPromise = supabase.auth.refreshSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return sessionAuth(data.session);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function refreshResumableUploadAuth(
  auth: ResumableUploadAuth,
): Promise<void> {
  const refreshed = await refreshResumableUploadSession();
  if (refreshed.ownerUserId !== auth.ownerUserId) {
    throw new Error("Der angemeldete Benutzer hat sich während des Uploads geändert.");
  }
  auth.token = refreshed.token;
}

export async function withResumableUploadAuthRefresh<T>(
  auth: ResumableUploadAuth,
  operation: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await operation(auth.token);
  } catch (error) {
    if (!(error instanceof ResumableUploadHttpError) || error.status !== 401) {
      throw error;
    }
    await refreshResumableUploadAuth(auth);
    return operation(auth.token);
  }
}

export function isResumableUploadPausedError(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  if (error instanceof ResumableUploadPausedError) return true;
  if (signal?.aborted) return true;
  return typeof DOMException !== "undefined"
    && error instanceof DOMException
    && error.name === "AbortError";
}

export function throwIfResumableUploadPaused(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ResumableUploadPausedError();
}

export function waitForResumableUploadRetry(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  throwIfResumableUploadPaused(signal);
  if (milliseconds <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);

    function onAbort() {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new ResumableUploadPausedError());
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

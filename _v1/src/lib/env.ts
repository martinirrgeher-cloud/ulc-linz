// src/lib/env.ts
/** Resolve the first defined env var from the given keys. Keeps your existing .env intact. */
export function env(...keys: string[]): string | undefined {
  const meta = import.meta.env as any;
  for (const k of keys) {
    const v = meta?.[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}

/** Optional resourceKey resolver (Drive link security). */
export function envRK(...keys: string[]): string | undefined {
  return env(...keys);
}

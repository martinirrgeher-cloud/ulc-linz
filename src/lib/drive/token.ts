// src/lib/drive/token.ts
// Simple singleton provider used app-wide.
// Register once in your Auth flow: registerTokenProvider(() => currentAccessToken)
let provider: (() => Promise<string | null>) | null = null;

export function registerTokenProvider(fn: () => Promise<string | null> | string | null) {
  // Normalize to async
  provider = async () => {
    try {
      const v = typeof fn === "function" ? await (fn as any)() : fn;
      if (typeof v === "string" && v.length > 10) return v;
      return null;
    } catch {
      return null;
    }
  };
}

export async function getTokenFromProvider(): Promise<string | null> {
  if (!provider) return null;
  try {
    return await provider();
  } catch {
    return null;
  }
}

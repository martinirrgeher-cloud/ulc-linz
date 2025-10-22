export function requireEnv(name: string): string {
  const v = import.meta.env[name as keyof ImportMetaEnv] as string | undefined;
  if (!v) {
    console.error(`Fehlende ENV Variable: ${name}`);
    throw new Error(`Fehlende ENV Variable: ${name}`);
  }
  return v;
}

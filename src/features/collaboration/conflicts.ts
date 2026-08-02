function messageText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return typeof error === "string" ? error : "";
}

export function isCollaborationConflictError(error: unknown): boolean {
  const message = messageText(error).toLocaleLowerCase("de-AT");
  return [
    "version_conflict",
    "zwischenzeitlich geändert",
    "seit dem öffnen verändert",
    "datensatz neu laden",
    "bearbeitungsreservierung ist abgelaufen",
    "bearbeitungsreservierung fehlt",
    "wurde übernommen",
  ].some((marker) => message.includes(marker));
}

export function collaborationVersionsDiffer(
  localVersion: string | null | undefined,
  serverVersion: string | null | undefined,
): boolean {
  if (!localVersion || !serverVersion) return false;
  const localTime = Date.parse(localVersion);
  const serverTime = Date.parse(serverVersion);
  if (Number.isFinite(localTime) && Number.isFinite(serverTime)) {
    return Math.abs(localTime - serverTime) > 1;
  }
  return localVersion !== serverVersion;
}

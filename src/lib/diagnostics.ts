import { env } from "@/lib/env";

type DiagnosticCategory =
  | "network"
  | "authentication"
  | "permission"
  | "conflict"
  | "upload"
  | "database"
  | "application";

export type DiagnosticRecord = {
  reference: string;
  timestamp: string;
  context: string;
  category: DiagnosticCategory;
  errorName: string;
  safeMessage: string;
  code: string | null;
  status: number | null;
  route: string;
};

type ReportOptions = {
  componentStack?: string | null;
};

const STORAGE_KEY = "ulc-technical-diagnostics-v1";
const MAX_RECORDS = 8;
const recordsByError = new WeakMap<object, DiagnosticRecord>();
let globalDiagnosticsInstalled = false;

function randomPart(): string {
  try {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  } catch {
    return Math.random().toString(16).slice(2, 8).padEnd(6, "0").toUpperCase();
  }
}

function createReference(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  return `ULC-${date}-${time}-${randomPart()}`;
}

function currentRoute(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function errorRecord(error: unknown): Record<string, unknown> | null {
  return typeof error === "object" && error !== null
    ? error as Record<string, unknown>
    : null;
}

function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const record = errorRecord(error);
  return typeof record?.message === "string" ? record.message : "";
}

function safeCode(error: unknown): string | null {
  const record = errorRecord(error);
  const candidate = record?.code;
  if (typeof candidate !== "string" && typeof candidate !== "number") return null;
  return String(candidate).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 48) || null;
}

function safeStatus(error: unknown): number | null {
  const record = errorRecord(error);
  const candidate = record?.status ?? record?.statusCode;
  if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  if (typeof candidate === "string" && /^\d{3}$/.test(candidate)) return Number(candidate);
  return null;
}

function sanitizeMessage(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-Mail]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[ID]")
    .replace(/\beyJ[a-zA-Z0-9_-]{20,}(?:\.[a-zA-Z0-9_-]{10,}){1,2}\b/g, "[Token]")
    .replace(/https?:\/\/[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?/gi, "[URL]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240) || "Keine sichere Fehlermeldung verfügbar.";
}

function messageFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

function classify(error: unknown, message: string): DiagnosticCategory {
  const normalized = message.toLocaleLowerCase("de");
  const status = safeStatus(error);
  const code = safeCode(error)?.toLocaleLowerCase("de") ?? "";

  if (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("netzwerk") ||
    normalized.includes("load failed") ||
    normalized.includes("timeout") ||
    normalized.includes("zeitüberschreitung")
  ) return "network";

  if (
    status === 401 ||
    normalized.includes("jwt") ||
    normalized.includes("session") ||
    normalized.includes("refresh token") ||
    normalized.includes("not authenticated") ||
    normalized.includes("invalid login credentials") ||
    normalized.includes("email not confirmed")
  ) return "authentication";

  if (
    status === 403 ||
    code === "42501" ||
    normalized.includes("permission denied") ||
    normalized.includes("row-level security") ||
    normalized.includes("keine berechtigung")
  ) return "permission";

  if (
    status === 409 ||
    normalized.includes("conflict") ||
    normalized.includes("version_conflict") ||
    normalized.includes("inzwischen geändert") ||
    normalized.includes("bereits bearbeitet")
  ) return "conflict";

  if (
    normalized.includes("upload") ||
    normalized.includes("storage") ||
    normalized.includes("tus") ||
    normalized.includes("video")
  ) return "upload";

  if (
    code.startsWith("pgrst") ||
    /^[0-9a-z]{5}$/.test(code) ||
    normalized.includes("postgres") ||
    normalized.includes("supabase") ||
    normalized.includes("database") ||
    normalized.includes("datenbank")
  ) return "database";

  return "application";
}

function readRecords(): DiagnosticRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECORDS) as DiagnosticRecord[] : [];
  } catch {
    return [];
  }
}

function storeRecord(record: DiagnosticRecord): void {
  if (typeof window === "undefined") return;
  try {
    const records = [record, ...readRecords().filter((item) => item.reference !== record.reference)]
      .slice(0, MAX_RECORDS);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Diagnoseinformationen dürfen die App niemals blockieren.
  }
}

function friendlyMessage(
  category: DiagnosticCategory,
  originalMessage: string,
  fallback: string,
): string {
  const normalized = originalMessage.toLocaleLowerCase("de");
  if (normalized.includes("invalid login credentials")) {
    return "E-Mail-Adresse oder Passwort sind nicht korrekt.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Die E-Mail-Adresse wurde noch nicht bestätigt.";
  }

  switch (category) {
    case "network":
      return "Die Verbindung zum Server wurde unterbrochen. Prüfe deine Internetverbindung und versuche es erneut.";
    case "authentication":
      return "Deine Anmeldung konnte nicht bestätigt werden. Lade die App neu und melde dich gegebenenfalls erneut an.";
    case "permission":
      return "Für diese Aktion fehlt die erforderliche Berechtigung. Lade die App neu, falls deine Rechte gerade geändert wurden.";
    case "conflict":
      return "Der Datensatz wurde inzwischen geändert oder wird gerade bearbeitet. Lade den aktuellen Stand neu.";
    case "upload":
      return "Der Upload konnte nicht abgeschlossen werden. Prüfe die Verbindung und versuche, den Upload fortzusetzen.";
    case "database":
      return "Die Aktion konnte am Server nicht abgeschlossen werden. Versuche es erneut.";
    default:
      return originalMessage.trim() || fallback;
  }
}

export function reportTechnicalError(
  error: unknown,
  context: string,
  options: ReportOptions = {},
): DiagnosticRecord {
  if (typeof error === "object" && error !== null) {
    const existing = recordsByError.get(error);
    if (existing) {
      if (options.componentStack) {
        console.error("ULC technical diagnostic component stack", {
          reference: existing.reference,
          componentStack: sanitizeMessage(options.componentStack).slice(0, 500),
        });
      }
      return existing;
    }
  }

  const rawMessage = rawErrorMessage(error);
  const category = classify(error, rawMessage);
  const record: DiagnosticRecord = {
    reference: createReference(),
    timestamp: new Date().toISOString(),
    context: sanitizeMessage(context).slice(0, 80),
    category,
    errorName: error instanceof Error ? sanitizeMessage(error.name).slice(0, 60) : "UnknownError",
    safeMessage: `Technische Meldung ausgeblendet · Fingerabdruck ${messageFingerprint(rawMessage)}`,
    code: safeCode(error),
    status: safeStatus(error),
    route: currentRoute(),
  };

  if (typeof error === "object" && error !== null) recordsByError.set(error, record);
  storeRecord(record);

  console.error("ULC technical diagnostic", {
    ...record,
    componentStack: options.componentStack
      ? sanitizeMessage(options.componentStack).slice(0, 500)
      : null,
  });

  return record;
}

export function diagnosticErrorMessage(
  error: unknown,
  fallback: string,
  context: string,
): string {
  const record = reportTechnicalError(error, context);
  const message = friendlyMessage(record.category, rawErrorMessage(error), fallback);
  return `${message} Fehler-ID: ${record.reference}`;
}

export function getRecentDiagnostics(): DiagnosticRecord[] {
  return readRecords();
}

export function buildSupportInformation(): string {
  const online = typeof navigator === "undefined" ? "unbekannt" : navigator.onLine ? "ja" : "nein";
  const language = typeof navigator === "undefined" ? "unbekannt" : navigator.language;
  const userAgent = typeof navigator === "undefined" ? "unbekannt" : navigator.userAgent;
  const viewport = typeof window === "undefined"
    ? "unbekannt"
    : `${window.innerWidth}x${window.innerHeight}`;
  const records = getRecentDiagnostics();

  const lines = [
    "ULC Linz App – Diagnoseinformationen",
    `App: ${env.appName}`,
    `Version: ${env.appVersion}`,
    `Commit: ${env.appCommit}`,
    `Build: ${env.appBuildTime}`,
    `Route: ${currentRoute()}`,
    `Online: ${online}`,
    `Sprache: ${language}`,
    `Fenster: ${viewport}`,
    `Browser: ${userAgent}`,
    "",
    "Letzte technische Fehler:",
  ];

  if (records.length === 0) {
    lines.push("Keine technischen Fehler in dieser Sitzung gespeichert.");
  } else {
    records.forEach((record) => {
      lines.push(
        `${record.timestamp} | ${record.reference} | ${record.context} | ${record.category}`,
        `  ${record.errorName} | Code ${record.code ?? "-"} | Status ${record.status ?? "-"}`,
        `  ${record.safeMessage}`,
      );
    });
  }

  lines.push("", "Enthält keine Namen, E-Mail-Adressen, Trainingsinhalte oder Zugangsdaten.");
  return lines.join("\n");
}

export async function copySupportInformation(): Promise<void> {
  const information = buildSupportInformation();
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(information);
    return;
  }

  if (typeof document === "undefined") throw new Error("Die Zwischenablage ist nicht verfügbar.");
  const textarea = document.createElement("textarea");
  textarea.value = information;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Die Diagnoseinformationen konnten nicht kopiert werden.");
}

export function installGlobalDiagnostics(): void {
  if (typeof window === "undefined" || globalDiagnosticsInstalled) return;
  globalDiagnosticsInstalled = true;

  window.addEventListener("error", (event) => {
    reportTechnicalError(event.error ?? event.message, "window.error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportTechnicalError(event.reason, "window.unhandledrejection");
  });
}

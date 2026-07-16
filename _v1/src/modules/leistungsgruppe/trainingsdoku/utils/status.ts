// src/modules/leistungsgruppe/trainingsdoku/utils/status.ts
export function statusLabel(status: string | undefined): string {
  switch (status) {
    case "completedAsPlanned":
      return "ok wie geplant";
    case "partial":
      return "gemacht mit Einschränkungen";
    case "completedWithIssues":
      return "gemacht, aber Probleme";
    case "completedModified":
      return "erledigt (angepasst)";
    case "skipped":
      return "nicht gemacht";
    case "planned":
    default:
      return "noch offen";
  }
}
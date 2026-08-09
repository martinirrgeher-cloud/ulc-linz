export function isoToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const parsed = new Date(year, month - 1, day, 12);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function formatDate(value: string): string {
  const parts = value.split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

export function formatMonth(value: string): string {
  const parts = value.split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  return new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1, 12),
  );
}

export function environmentLabel(value: string | null): string {
  if (value === "indoor") return "Indoor";
  if (value === "outdoor") return "Outdoor";
  return "Offen";
}

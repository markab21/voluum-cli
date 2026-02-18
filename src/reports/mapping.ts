export type NormalizedReportType = "text" | "integer" | "money" | "percentage" | "boolean" | "duration_seconds" | "unknown";

export function normalizeVoluumColumnType(type: string): NormalizedReportType {
  const normalized = type.trim().toLowerCase();

  if (normalized === "string" || normalized === "string-value") {
    return "text";
  }

  if (normalized === "integer") {
    return "integer";
  }

  if (normalized.startsWith("monetary")) {
    return "money";
  }

  if (normalized === "percentage") {
    return "percentage";
  }

  if (normalized === "yesno") {
    return "boolean";
  }

  if (normalized === "seconds-to-hhmmss") {
    return "duration_seconds";
  }

  return "unknown";
}

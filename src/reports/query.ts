import type { ReportQuery } from "./types.js";

function hasText(input: string | undefined): input is string {
  return typeof input === "string" && input.trim().length > 0;
}

function isObjectRecord(value: unknown): value is ReportQuery {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseReportQueryPairs(input: string | undefined): ReportQuery {
  if (!hasText(input)) {
    return {};
  }

  const output: ReportQuery = {};
  const pairs = input.split(",").map((part) => part.trim());

  for (const pair of pairs) {
    if (!pair) {
      continue;
    }

    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === pair.length - 1) {
      throw new Error(`Invalid key=value pair: "${pair}"`);
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      throw new Error(`Invalid key=value pair: "${pair}"`);
    }

    output[key] = value;
  }

  return output;
}

export function parseReportQueryJson(input: string | undefined): ReportQuery {
  if (!hasText(input)) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Invalid JSON for --query-json.");
  }

  if (!isObjectRecord(parsed)) {
    throw new Error("--query-json must be a JSON object.");
  }

  return parsed;
}

export function mergeReportQueryInputs(query: string | undefined, queryJson: string | undefined): ReportQuery {
  const keyValueQuery = parseReportQueryPairs(query);
  const jsonQuery = parseReportQueryJson(queryJson);
  return { ...keyValueQuery, ...jsonQuery };
}

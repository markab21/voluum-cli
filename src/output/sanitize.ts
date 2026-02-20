/**
 * Removes high-noise, low-value metadata fields from Voluum report API responses
 * before they are printed to stdout. This keeps CLI output focused on the actual
 * report data rather than API implementation details.
 */

const STRIP_KEYS = new Set([
  "columnMappings",
  "actions",
  "hour",
  "pixelUrl",
  "postbackUrl",
  "campaignUrl",
  "campaignUrlConfigured",
  "campaignIdMarker",
  "campaignNotes",
  "campaignTags",
  "campaignCountry",
  "campaignCurrencyCode",
  "campaignDailyBudget",
  "campaignWorkspaceId",
  "campaignWorkspaceName",
  "clickRedirectType",
  "costSources",
  "externalCampaignId",
  "externalStatus",
  "biddingStatus",
  "bidInfo",
  "bid",
  "type",
  "deleted",
  "created",
  "updated",
  "timeToInstallRange0",
  "timeToInstallRange1",
  "timeToInstallRange2",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!STRIP_KEYS.has(k)) {
      out[k] = v;
    }
  }
  return out;
}

export function stripReportNoise(response: unknown): unknown {
  if (!isRecord(response)) return response;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(response)) {
    if (k === "columnMappings") continue; // always strip top-level columnMappings
    if (k === "rows" && Array.isArray(v)) {
      out[k] = v.map((row) => (isRecord(row) ? stripRow(row) : row));
    } else {
      out[k] = v;
    }
  }
  return out;
}

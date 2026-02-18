export const DEFAULT_BASE_URL = "https://api.voluum.com";
export const AUTH_HEADER_NAME = "cwauth-token";

// Central mapping layer for Voluum routes. Adjust here if your API differs.
export const ENDPOINTS = {
  auth: {
    loginPath: "/auth/session",
    accessLoginPath: "/auth/access/session",
    whoamiPath: "/user/current",
  },
  campaigns: {
    listPath: "/campaign",
    getPath: (id: string) => `/campaign/${encodeURIComponent(id)}`,
  },
  reports: {
    summaryPath: "/report",
    rawPath: "/report/conversions",
  },
} as const;

const TOKEN_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ["token"],
  ["sessionToken"],
  ["accessToken"],
  ["cwauthToken"],
  ["data", "token"],
  ["data", "sessionToken"],
  ["data", "accessToken"],
];

const TOKEN_EXPIRY_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ["tokenExpiresAt"],
  ["expiresAt"],
  ["expirationDate"],
  ["expirationTimestamp"],
  ["data", "tokenExpiresAt"],
  ["data", "expiresAt"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getByPath(source: unknown, segments: readonly string[]): unknown {
  let current: unknown = source;

  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

export function extractAuthToken(payload: unknown): string | undefined {
  for (const path of TOKEN_PATHS) {
    const maybeToken = getByPath(payload, path);
    if (typeof maybeToken === "string" && maybeToken.trim().length > 0) {
      return maybeToken.trim();
    }
  }

  return undefined;
}

export function extractTokenExpiry(payload: unknown): string | undefined {
  for (const path of TOKEN_EXPIRY_PATHS) {
    const maybeExpires = getByPath(payload, path);
    if (typeof maybeExpires === "string" && maybeExpires.trim().length > 0) {
      return maybeExpires.trim();
    }
  }

  return undefined;
}

export function ensureLeadingSlash(value: string): string {
  if (value.startsWith("/")) {
    return value;
  }

  return `/${value}`;
}

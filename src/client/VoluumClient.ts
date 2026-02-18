import { AUTH_HEADER_NAME, ensureLeadingSlash } from "../endpoints.js";
import { VoluumApiError } from "./errors.js";

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  headers?: HeadersInit;
}

export interface VoluumClientOptions {
  authHeaderName?: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  fetchFn?: typeof fetch;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringProp(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export class VoluumClient {
  private readonly authHeaderName: string;
  private readonly maxRetries: number;
  private readonly initialRetryDelayMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | undefined,
    options: VoluumClientOptions = {},
  ) {
    const normalizedBaseUrl = baseUrl.trim();
    if (!normalizedBaseUrl) {
      throw new Error("Base URL is required.");
    }

    this.baseUrl = normalizedBaseUrl;
    this.authHeaderName = options.authHeaderName ?? AUTH_HEADER_NAME;
    this.maxRetries = options.maxRetries ?? 2;
    this.initialRetryDelayMs = options.initialRetryDelayMs ?? 250;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  async post<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>("POST", path, { body, query });
  }

  async put<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>("PUT", path, { body, query });
  }

  async delete<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("DELETE", path, { query });
  }

  private async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query);
    let attempt = 0;

    while (true) {
      try {
        const response = await this.fetchFn(url.toString(), {
          method,
          headers: this.buildHeaders(options.headers, options.body !== undefined),
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
          const details = await this.parseBody(response);
          throw new VoluumApiError(`Voluum API request failed (${response.status})`, {
            code: this.extractErrorCode(details),
            status: response.status,
            details,
          });
        }

        return (await this.parseBody(response)) as T;
      } catch (error) {
        const normalized = this.normalizeError(error);
        if (!this.shouldRetry(normalized, attempt)) {
          throw normalized;
        }

        const waitMs = this.initialRetryDelayMs * 2 ** attempt;
        attempt += 1;
        await delay(waitMs);
      }
    }
  }

  private buildUrl(path: string, query?: QueryParams): URL {
    const url = /^https?:\/\//i.test(path)
      ? new URL(path)
      : new URL(
          ensureLeadingSlash(path).slice(1),
          this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`,
        );

    if (query) {
      for (const [key, rawValue] of Object.entries(query)) {
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        for (const value of values) {
          if (value === undefined || value === null) {
            continue;
          }

          url.searchParams.append(key, String(value));
        }
      }
    }

    return url;
  }

  private buildHeaders(customHeaders: HeadersInit | undefined, hasBody: boolean): Headers {
    const headers = new Headers(customHeaders);
    headers.set("accept", "application/json");

    if (hasBody && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const token = this.getToken();
    if (token) {
      headers.set(this.authHeaderName, token);
    }

    return headers;
  }

  private async parseBody(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (!text.trim()) {
      return null;
    }

    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    }

    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  private extractErrorCode(details: unknown): string | undefined {
    if (!isRecord(details)) {
      return undefined;
    }

    return getStringProp(details, "code") ?? getStringProp(details, "errorCode");
  }

  private normalizeError(error: unknown): VoluumApiError {
    if (error instanceof VoluumApiError) {
      return error;
    }

    if (error instanceof Error) {
      return new VoluumApiError(`Network/request failure: ${error.message}`, {
        code: "NETWORK_ERROR",
        cause: error,
      });
    }

    return new VoluumApiError("Network/request failure: unknown error", {
      code: "NETWORK_ERROR",
      details: error,
    });
  }

  private shouldRetry(error: VoluumApiError, attempt: number): boolean {
    if (attempt >= this.maxRetries) {
      return false;
    }

    if (error.code === "NETWORK_ERROR") {
      return true;
    }

    if (typeof error.status === "number" && (error.status === 429 || error.status >= 500)) {
      return true;
    }

    return false;
  }
}

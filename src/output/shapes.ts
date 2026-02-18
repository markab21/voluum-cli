export interface CliError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export type CliResult<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: CliError };

export function success<T>(data: T, meta?: Record<string, unknown>): CliResult<T> {
  if (meta && Object.keys(meta).length > 0) {
    return { ok: true, data, meta };
  }

  return { ok: true, data };
}

export function failure(error: CliError): CliResult<never> {
  return { ok: false, error };
}

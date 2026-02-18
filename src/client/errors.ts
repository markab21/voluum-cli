import type { CliError } from "../output/shapes.js";

interface VoluumApiErrorOptions {
  code?: string;
  status?: number;
  details?: unknown;
  cause?: unknown;
}

export class VoluumApiError extends Error {
  public readonly code?: string;
  public readonly status?: number;
  public readonly details?: unknown;
  public readonly cause?: unknown;

  constructor(message: string, options: VoluumApiErrorOptions = {}) {
    super(message);
    this.name = "VoluumApiError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.cause = options.cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function toCliError(error: unknown): CliError {
  if (error instanceof VoluumApiError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: "OPERATIONAL_ERROR",
    };
  }

  if (isRecord(error)) {
    return {
      message: readString(error.message) ?? "Unexpected error",
      code: readString(error.code) ?? "UNEXPECTED",
      details: error,
    };
  }

  return {
    message: "Unexpected error",
    code: "UNEXPECTED",
    details: error,
  };
}

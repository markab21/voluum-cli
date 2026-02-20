import { Command } from "commander";
import { toCliError } from "../client/errors.js";
import type { VoluumCliConfig } from "../config/config.js";
import { resolveRuntimeConfig } from "../config/config.js";
import { VoluumClient } from "../client/VoluumClient.js";
import { AUTH_HEADER_NAME, DEFAULT_BASE_URL, ensureLeadingSlash } from "../endpoints.js";
import { printJson, type PrintOptions } from "../output/print.js";
import { failure } from "../output/shapes.js";

export interface GlobalCommandOptions {
  baseUrl?: string;
  token?: string;
  json?: boolean;
  pretty?: boolean;
  silent?: boolean;
  out?: string;
}

export interface CommandContext {
  options: GlobalCommandOptions;
  baseUrl: string;
  token?: string;
  client: VoluumClient;
  fileConfig: VoluumCliConfig;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getRawOptions(command: Command): Record<string, unknown> {
  const commandWithGlobals = command as Command & {
    optsWithGlobals?: () => Record<string, unknown>;
  };

  if (typeof commandWithGlobals.optsWithGlobals === "function") {
    return commandWithGlobals.optsWithGlobals();
  }

  return command.opts();
}

export function getGlobalOptions(command: Command): GlobalCommandOptions {
  const raw = getRawOptions(command);
  return {
    baseUrl: cleanString(raw.baseUrl),
    token: cleanString(raw.token),
    json: Boolean(raw.json),
    pretty: Boolean(raw.pretty),
    silent: Boolean(raw.silent),
    out: cleanString(raw.out),
  };
}

export function getPrintOptions(command: Command): PrintOptions {
  const options = getGlobalOptions(command);
  return {
    json: options.json || options.pretty,
    pretty: options.pretty,
    silent: options.silent,
    outputFile: options.out,
  };
}

export function maskToken(token: string | undefined): string | undefined {
  if (!token) {
    return undefined;
  }

  if (token.length <= 8) {
    return `${token.slice(0, 2)}…${token.slice(-2)}`;
  }

  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export async function createCommandContext(command: Command): Promise<CommandContext> {
  const options = getGlobalOptions(command);
  const runtime = await resolveRuntimeConfig({
    baseUrl: options.baseUrl,
    token: options.token,
  });
  const baseUrl = runtime.baseUrl ?? DEFAULT_BASE_URL;

  return {
    options,
    baseUrl,
    token: runtime.token,
    client: new VoluumClient(baseUrl, () => runtime.token, {
      authHeaderName: AUTH_HEADER_NAME,
    }),
    fileConfig: runtime.fileConfig,
  };
}

export function requireToken(token: string | undefined): string {
  if (!token) {
    throw new Error("No auth token found. Run `voluum auth login` or set VOLUUM_TOKEN.");
  }

  return token;
}

export async function printFailure(command: Command, error: unknown): Promise<void> {
  const cliError = toCliError(error);
  await printJson(failure(cliError), getPrintOptions(command));
  process.exitCode = cliError.code === "UNEXPECTED" ? 2 : 1;
}

export function parseKeyValuePairs(input: string | undefined): Record<string, string> | undefined {
  if (!input) {
    return undefined;
  }

  const pairs = input.split(",").map((part) => part.trim());
  const output: Record<string, string> = {};

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

  return Object.keys(output).length > 0 ? output : undefined;
}

export function parseJsonBody(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("Invalid JSON for --body.");
  }
}

export function assertIsoDate(value: string, optionName: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid ${optionName}. Expected an ISO date/time string.`);
  }
}

export function normalizePath(path: string): string {
  return ensureLeadingSlash(path.trim());
}

export async function readDataFile(filePath: string): Promise<unknown> {
  const fs = await import("node:fs/promises");
  const content = await fs.readFile(filePath, "utf-8");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in file: ${filePath}`);
  }
}

export async function resolveDataInput(
  dataOption: string | undefined,
  fileOption: string | undefined,
): Promise<unknown> {
  if (dataOption && fileOption) {
    throw new Error("Use either --data or --file, not both.");
  }

  if (fileOption) {
    return readDataFile(fileOption);
  }

  if (dataOption) {
    return parseJsonBody(dataOption);
  }

  throw new Error("Either --data or --file is required.");
}

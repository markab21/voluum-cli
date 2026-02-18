import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { getConfigDirPath, getConfigFilePath } from "./paths.js";

export interface VoluumCliConfig {
  baseUrl?: string;
  token?: string;
  tokenCreatedAt?: string;
  tokenExpiresAt?: string;
  lastLoginEmail?: string;
}

export interface RuntimeOverrides {
  baseUrl?: string;
  token?: string;
}

export interface ResolvedRuntimeConfig {
  baseUrl?: string;
  token?: string;
  fileConfig: VoluumCliConfig;
  envConfig: Pick<VoluumCliConfig, "baseUrl" | "token">;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeConfig(value: unknown): VoluumCliConfig {
  if (!isRecord(value)) {
    return {};
  }

  return {
    baseUrl: cleanString(value.baseUrl),
    token: cleanString(value.token),
    tokenCreatedAt: cleanString(value.tokenCreatedAt),
    tokenExpiresAt: cleanString(value.tokenExpiresAt),
    lastLoginEmail: cleanString(value.lastLoginEmail),
  };
}

function compactConfig(config: VoluumCliConfig): VoluumCliConfig {
  const compacted: VoluumCliConfig = {};

  for (const [key, value] of Object.entries(config)) {
    const clean = cleanString(value);
    if (!clean) {
      continue;
    }

    compacted[key as keyof VoluumCliConfig] = clean;
  }

  return compacted;
}

export async function loadConfig(): Promise<VoluumCliConfig> {
  const configPath = getConfigFilePath();

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return sanitizeConfig(parsed);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return {};
    }

    throw new Error(`Failed to read config at ${configPath}: ${err.message}`);
  }
}

export async function saveConfig(config: VoluumCliConfig): Promise<void> {
  const configDir = getConfigDirPath();
  const configPath = getConfigFilePath();
  const compacted = compactConfig(config);
  const payload = `${JSON.stringify(compacted, null, 2)}\n`;

  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await writeFile(configPath, payload, { encoding: "utf8", mode: 0o600 });

  if (process.platform !== "win32") {
    await chmod(configPath, 0o600).catch(() => {
      // Best effort only. Some filesystems ignore chmod.
    });
  }
}

export async function deleteConfigFile(): Promise<void> {
  await rm(getConfigFilePath(), { force: true });
}

export async function clearStoredToken(): Promise<void> {
  const current = await loadConfig();

  const next: VoluumCliConfig = {
    ...current,
    token: undefined,
    tokenCreatedAt: undefined,
    tokenExpiresAt: undefined,
  };

  if (Object.keys(compactConfig(next)).length === 0) {
    await deleteConfigFile();
    return;
  }

  await saveConfig(next);
}

export function getEnvConfig(): Pick<VoluumCliConfig, "baseUrl" | "token"> {
  return {
    baseUrl: cleanString(process.env.VOLUUM_BASE_URL),
    token: cleanString(process.env.VOLUUM_TOKEN),
  };
}

export async function resolveRuntimeConfig(
  overrides: RuntimeOverrides = {},
): Promise<ResolvedRuntimeConfig> {
  const fileConfig = await loadConfig();
  const envConfig = getEnvConfig();

  const overrideBaseUrl = cleanString(overrides.baseUrl);
  const overrideToken = cleanString(overrides.token);

  return {
    baseUrl: overrideBaseUrl ?? envConfig.baseUrl ?? fileConfig.baseUrl,
    token: overrideToken ?? envConfig.token ?? fileConfig.token,
    fileConfig,
    envConfig,
  };
}

import os from "node:os";
import path from "node:path";

export const CONFIG_DIR_NAME = ".voluum-cli";
export const CONFIG_FILE_NAME = "config.json";

export function getConfigDirPath(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

export function getConfigFilePath(): string {
  return path.join(getConfigDirPath(), CONFIG_FILE_NAME);
}

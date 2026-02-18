import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface PrintOptions {
  pretty?: boolean;
  silent?: boolean;
  outputFile?: string;
}

function serializeJson(value: unknown, pretty = false): string {
  return JSON.stringify(value, null, pretty ? 2 : 0);
}

export async function printJson(value: unknown, options: PrintOptions = {}): Promise<void> {
  const payload = `${serializeJson(value, Boolean(options.pretty))}\n`;

  if (options.outputFile) {
    await mkdir(dirname(options.outputFile), { recursive: true });
    await writeFile(options.outputFile, payload, "utf8");
  }

  if (!options.silent) {
    process.stdout.write(payload);
  }
}

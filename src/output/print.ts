import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { encode as toonEncode } from "@toon-format/toon";

export interface PrintOptions {
  json?: boolean;
  pretty?: boolean;
  silent?: boolean;
  outputFile?: string;
}

const STDOUT_TRUNCATE_LIMIT = 24_000;
const TRUNCATE_NOTICE = "\n... [output truncated at 24000 chars — use --out <file> to capture full output]\n";

function serializeJson(value: unknown, pretty = false): string {
  return JSON.stringify(value, null, pretty ? 2 : 0);
}

function serializeToon(value: unknown): string {
  return toonEncode(value);
}

export async function printJson(value: unknown, options: PrintOptions = {}): Promise<void> {
  const serialized = options.json ? serializeJson(value, Boolean(options.pretty)) : serializeToon(value);
  const payload = `${serialized}\n`;

  if (options.outputFile) {
    // Files always get JSON (for scripting/downstream use); TOON is stdout-only
    const filePayload = `${serializeJson(value, Boolean(options.pretty))}\n`;
    await mkdir(dirname(options.outputFile), { recursive: true });
    await writeFile(options.outputFile, filePayload, "utf8");
  }

  if (!options.silent) {
    if (payload.length > STDOUT_TRUNCATE_LIMIT) {
      process.stdout.write(payload.slice(0, STDOUT_TRUNCATE_LIMIT) + TRUNCATE_NOTICE);
    } else {
      process.stdout.write(payload);
    }
  }
}

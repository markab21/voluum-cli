import { describe, expect, test } from "bun:test";
import { normalizeVoluumColumnType } from "../../src/reports/mapping.js";

describe("normalizeVoluumColumnType", () => {
  test("normalizes supported Voluum types", () => {
    const cases = [
      ["string", "text"],
      ["string-value", "text"],
      ["integer", "integer"],
      ["percentage", "percentage"],
      ["yesno", "boolean"],
      ["seconds-to-HHMMSS", "duration_seconds"],
      ["monetary-decimal-4", "money"],
    ] as const;

    for (const [input, expected] of cases) {
      expect(normalizeVoluumColumnType(input)).toBe(expected);
    }
  });

  test("falls back to unknown for unsupported values", () => {
    expect(normalizeVoluumColumnType("custom-type")).toBe("unknown");
  });
});

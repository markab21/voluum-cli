import { describe, expect, test } from "bun:test";
import { extractReportSchema } from "../../src/reports/schema.js";

describe("reports schema", () => {
  test("extracts normalized columns with schema flags", () => {
    const result = extractReportSchema({
      columnMappings: [
        {
          key: "revenue",
          label: "Revenue",
          type: "monetary-decimal-4",
          canGroupBy: false,
          canBeRestricted: true,
        },
      ],
    });

    expect(result.columns).toEqual([
      {
        key: "revenue",
        label: "Revenue",
        voluumType: "monetary-decimal-4",
        normalizedType: "money",
        canGroupBy: false,
        canBeRestricted: true,
      },
    ]);
  });

  test("returns empty columns when columnMappings are missing or empty", () => {
    expect(extractReportSchema({}).columns).toEqual([]);
    expect(extractReportSchema({ columnMappings: [] }).columns).toEqual([]);
  });

  test('keeps unknown type as normalizedType "unknown"', () => {
    const result = extractReportSchema({
      columnMappings: [
        {
          key: "mystery",
          label: "Mystery",
          type: "not-a-known-type",
          canGroupBy: true,
          canBeRestricted: false,
        },
      ],
    });

    expect(result.columns).toEqual([
      {
        key: "mystery",
        label: "Mystery",
        voluumType: "not-a-known-type",
        normalizedType: "unknown",
        canGroupBy: true,
        canBeRestricted: false,
      },
    ]);
  });
});

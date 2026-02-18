import { describe, expect, test } from "bun:test";
import { mergeReportQueryInputs, parseReportQueryJson, parseReportQueryPairs } from "../../src/reports/query.js";

describe("parseReportQueryPairs", () => {
  test("parses key=value pairs with trimming and ignores empty segments", () => {
    const parsed = parseReportQueryPairs(" from=2026-01-01 , , tz = UTC ,, limit = 100 ");

    expect(parsed).toEqual({
      from: "2026-01-01",
      tz: "UTC",
      limit: "100",
    });
  });
});

describe("parseReportQueryJson", () => {
  test("rejects non-object JSON values", () => {
    expect(() => parseReportQueryJson('["from=2026-01-01"]')).toThrow("--query-json must be a JSON object.");
  });

  test("accepts valid JSON object values", () => {
    const parsed = parseReportQueryJson('{"from":"2026-02-01","limit":25}');

    expect(parsed).toEqual({
      from: "2026-02-01",
      limit: 25,
    });
  });
});

describe("mergeReportQueryInputs", () => {
  test("JSON query values override key-value query values", () => {
    const merged = mergeReportQueryInputs(
      "from=2026-01-01,tz=UTC,limit=100",
      '{"from":"2026-02-01","limit":25}',
    );

    expect(merged).toEqual({
      from: "2026-02-01",
      tz: "UTC",
      limit: 25,
    });
  });

  test("throws on invalid --query-json", () => {
    expect(() => mergeReportQueryInputs(undefined, "{bad")).toThrow();
  });

  test("throws on malformed key=value pair", () => {
    expect(() => mergeReportQueryInputs("groupBy", undefined)).toThrow();
  });
});

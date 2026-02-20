import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { type NormalizedReportType } from "../reports/mapping.js";
import { mergeReportQueryInputs } from "../reports/query.js";
import { extractReportSchema, type ReportSchemaColumn, type VoluumSchemaResponse } from "../reports/schema.js";
import { printJson } from "../output/print.js";
import { stripReportNoise } from "../output/sanitize.js";
import { success } from "../output/shapes.js";
import {
  assertIsoDate,
  createCommandContext,
  getPrintOptions,
  normalizePath,
  parseKeyValuePairs,
  printFailure,
  requireToken,
} from "./helpers.js";

interface SummaryOptions {
  from: string;
  to: string;
  groupBy?: string;
  filters?: string;
}

interface RawOptions {
  from: string;
  to: string;
  limit?: number;
}

interface QueryOptions {
  path: string;
  query?: string;
  queryJson?: string;
}

interface SchemaOptions extends QueryOptions {
  groupable?: boolean;
  restrictable?: boolean;
  type?: string;
  search?: string;
  withQueryParams?: boolean;
}

interface BreakdownOptions {
  by: string;
  from: string;
  to: string;
  path: string;
  campaignId?: string;
  filters?: string;
  columns?: string;
  limit?: number;
  offset?: number;
}

type BreakdownPreset = "offer" | "offer-by-campaign" | "flow" | "traffic-source" | "lander";
type QueryParamPrimitive = string | number | boolean | null | undefined;
type QueryParamValue = QueryParamPrimitive | QueryParamPrimitive[];
type QueryParams = Record<string, QueryParamValue>;

const SUPPORTED_SCHEMA_TYPES: readonly NormalizedReportType[] = [
  "text",
  "integer",
  "money",
  "percentage",
  "boolean",
  "duration_seconds",
  "unknown",
];

const REPORT_QUERY_PARAMETER_CATALOG = {
  required: ["from", "to"],
  common: ["groupBy", "limit", "offset", "sort", "columns"],
  passthrough: "Additional Voluum query parameters are forwarded as-is.",
} as const;

const REPORT_QUERY_HELP_TEXT = `
Examples:
  # Summary by group
  voluum reports query --query from=2026-02-01,to=2026-02-18,groupBy=country,columns=visits,conversions

  # Conversions query with paging + sort
  voluum reports query --path /report/conversions --query from=2026-02-01,to=2026-02-18,limit=100,offset=100,sort=visits,direction=desc

  # Merge --query with --query-json
  voluum reports query --path /report/conversions --query from=2026-02-01,to=2026-02-18,limit=100 --query-json '{"limit":25,"offset":50,"sort":"visits","direction":"asc"}'
  --query-json overrides duplicate keys from --query.
`;

const REPORT_SCHEMA_HELP_TEXT = `
Examples:
  # Inspect schema columns for conversions
  voluum reports schema --path /report/conversions --query from=2026-02-01,to=2026-02-18 --groupable --type money --search revenue

  # Include query parameter catalog while filtering
  voluum reports schema --path /report/conversions --query from=2026-02-01,to=2026-02-18 --restrictable --with-query-params
`;

const BREAKDOWN_PRESETS: Record<BreakdownPreset, { groupBy: string; columns: string }> = {
  offer: {
    groupBy: "offerId",
    columns: "offerId,offerName,conversions,revenue,profit,roi,visits,cv,epc",
  },
  "offer-by-campaign": {
    groupBy: "campaignId,offerId",
    columns: "campaignId,campaignName,offerId,offerName,conversions,revenue,profit,roi,visits,cv,epc",
  },
  flow: {
    groupBy: "flowId",
    columns: "flowId,flowName,conversions,revenue,profit,roi,visits,cv,epc",
  },
  "traffic-source": {
    groupBy: "trafficSourceId",
    columns: "trafficSourceId,trafficSourceName,conversions,revenue,profit,roi,visits,cv,epc",
  },
  lander: {
    groupBy: "landerId",
    columns: "landerId,landerName,conversions,revenue,profit,roi,visits,cv,epc",
  },
};

const REPORT_BREAKDOWN_HELP_TEXT = `
Presets:
  offer | offer-by-campaign | flow | traffic-source | lander

Examples:
  # Conversions and revenue by offer
  voluum reports breakdown --by offer --from 2026-02-01T00:00:00.000Z --to 2026-02-08T00:00:00.000Z

  # Offer breakdown within campaign context
  voluum reports breakdown --by offer-by-campaign --campaignId <id> --from 2026-02-01T00:00:00.000Z --to 2026-02-08T00:00:00.000Z

  # Flow and traffic-source views
  voluum reports breakdown --by flow --from 2026-02-01T00:00:00.000Z --to 2026-02-08T00:00:00.000Z
  voluum reports breakdown --by traffic-source --from 2026-02-01T00:00:00.000Z --to 2026-02-08T00:00:00.000Z --limit 200
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringifyQueryValue(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized === "string") {
      return serialized;
    }
  } catch {
    // Fallback below for unsupported values such as circular objects.
  }

  return String(value);
}

function toQueryPrimitive(value: unknown): QueryParamPrimitive {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return stringifyQueryValue(value);
}

function toQueryParams(query: Record<string, unknown>): QueryParams {
  const output: QueryParams = {};

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      output[key] = value.map((item) => toQueryPrimitive(item));
      continue;
    }

    output[key] = toQueryPrimitive(value);
  }

  return output;
}

function parseSchemaType(input: string | undefined): NormalizedReportType | undefined {
  if (!input) {
    return undefined;
  }

  const normalized = input.trim().toLowerCase() as NormalizedReportType;
  if (SUPPORTED_SCHEMA_TYPES.includes(normalized)) {
    return normalized;
  }

  throw new Error(`Invalid --type value. Expected one of: ${SUPPORTED_SCHEMA_TYPES.join(", ")}.`);
}

function parseBreakdownPreset(input: string): BreakdownPreset {
  const normalized = input.trim().toLowerCase() as BreakdownPreset;
  if (normalized in BREAKDOWN_PRESETS) {
    return normalized;
  }

  throw new Error(`Invalid --by value. Expected one of: ${Object.keys(BREAKDOWN_PRESETS).join(", ")}.`);
}

function filterSchemaColumns(columns: ReportSchemaColumn[], options: SchemaOptions): ReportSchemaColumn[] {
  let filtered = columns;

  if (options.groupable) {
    filtered = filtered.filter((column) => column.canGroupBy);
  }

  if (options.restrictable) {
    filtered = filtered.filter((column) => column.canBeRestricted);
  }

  const normalizedType = parseSchemaType(options.type);
  if (normalizedType) {
    filtered = filtered.filter((column) => column.normalizedType === normalizedType);
  }

  const search = options.search?.trim().toLowerCase();
  if (search) {
    filtered = filtered.filter(
      (column) =>
        column.key.toLowerCase().includes(search) ||
        column.label.toLowerCase().includes(search) ||
        column.voluumType.toLowerCase().includes(search) ||
        column.normalizedType.toLowerCase().includes(search),
    );
  }

  return filtered;
}

export function registerReportCommands(program: Command): void {
  const reports = program.command("reports").description("Reporting operations");

  reports
    .command("breakdown")
    .description("Run predefined report breakdowns by common entities")
    .requiredOption(
      "--by <entity>",
      `Breakdown preset: ${Object.keys(BREAKDOWN_PRESETS).join(" | ")}`,
    )
    .requiredOption("--from <iso>", "Start datetime (ISO string)")
    .requiredOption("--to <iso>", "End datetime (ISO string)")
    .option("--path <path>", "Report endpoint path", ENDPOINTS.reports.summaryPath)
    .option("--campaignId <id>", "Optional campaign filter")
    .option("--filters <pairs>", "Comma-separated key=value filters")
    .option("--columns <list>", "Override default columns list")
    .option("--limit <n>", "Maximum rows", (value) => Number.parseInt(value, 10))
    .option("--offset <n>", "Pagination offset", (value) => Number.parseInt(value, 10))
    .addHelpText("after", REPORT_BREAKDOWN_HELP_TEXT)
    .action(async function action(this: Command, options: BreakdownOptions) {
      const command = this;
      try {
        assertIsoDate(options.from, "--from");
        assertIsoDate(options.to, "--to");

        if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
          throw new Error("--limit must be a positive integer.");
        }

        if (options.offset !== undefined && (!Number.isInteger(options.offset) || options.offset < 0)) {
          throw new Error("--offset must be a non-negative integer.");
        }

        const context = await createCommandContext(command);
        requireToken(context.token);

        const preset = parseBreakdownPreset(options.by);
        const presetConfig = BREAKDOWN_PRESETS[preset];
        const path = normalizePath(options.path);
        const filters = parseKeyValuePairs(options.filters);

        const query: Record<string, string | number> = {
          from: options.from,
          to: options.to,
          groupBy: presetConfig.groupBy,
          columns: options.columns?.trim() || presetConfig.columns,
        };

        if (options.limit !== undefined) {
          query.limit = options.limit;
        }

        if (options.offset !== undefined) {
          query.offset = options.offset;
        }

        if (options.campaignId?.trim()) {
          query.campaignId = options.campaignId.trim();
        }

        if (filters) {
          Object.assign(query, filters);
        }

        const response = await context.client.get<unknown>(path, query);
        const cleanResponse = stripReportNoise(response);

        await printJson(
          success({
            preset,
            path,
            query,
            response: cleanResponse,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  reports
    .command("query")
    .description("Run report query against a selected report path")
    .option("--path <path>", "Report endpoint path", ENDPOINTS.reports.summaryPath)
    .option("--query <pairs>", "Comma-separated key=value query params")
    .option("--query-json <json>", "JSON object for report query params")
    .addHelpText("after", REPORT_QUERY_HELP_TEXT)
    .action(async function action(this: Command, options: QueryOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const path = normalizePath(options.path);
        const query = mergeReportQueryInputs(options.query, options.queryJson);
        const response = await context.client.get<unknown>(path, toQueryParams(query));
        const cleanResponse = stripReportNoise(response);

        await printJson(
          success({
            path,
            query,
            response: cleanResponse,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  reports
    .command("schema")
    .description("Inspect and filter report schema metadata")
    .option("--path <path>", "Report endpoint path", ENDPOINTS.reports.summaryPath)
    .option("--query <pairs>", "Comma-separated key=value query params")
    .option("--query-json <json>", "JSON object for report query params")
    .option("--groupable", "Only include groupable columns")
    .option("--restrictable", "Only include restrictable columns")
    .option("--type <normalizedType>", "Filter by normalized type")
    .option("--search <text>", "Search schema columns by text")
    .option("--with-query-params", "Include report query parameter catalog")
    .addHelpText("after", REPORT_SCHEMA_HELP_TEXT)
    .action(async function action(this: Command, options: SchemaOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const path = normalizePath(options.path);
        const query = mergeReportQueryInputs(options.query, options.queryJson);
        const response = await context.client.get<unknown>(path, toQueryParams(query));
        const schema = extractReportSchema(isRecord(response) ? (response as VoluumSchemaResponse) : {});
        const columns = filterSchemaColumns(schema.columns, options);
        const data: Record<string, unknown> = {
          path,
          query,
          columns,
        };

        if (options.withQueryParams) {
          data.queryParameters = REPORT_QUERY_PARAMETER_CATALOG;
        }

        await printJson(success(data), getPrintOptions(command));
      } catch (error) {
        await printFailure(command, error);
      }
    });

  reports
    .command("summary")
    .description("Run summary report")
    .requiredOption("--from <iso>", "Start datetime (ISO string)")
    .requiredOption("--to <iso>", "End datetime (ISO string)")
    .option("--groupBy <field>", "Grouping field")
    .option("--filters <pairs>", "Comma-separated key=value pairs")
    .action(async function action(this: Command, options: SummaryOptions) {
      const command = this;
      try {
        assertIsoDate(options.from, "--from");
        assertIsoDate(options.to, "--to");

        const context = await createCommandContext(command);
        requireToken(context.token);

        const filters = parseKeyValuePairs(options.filters);
        const query: Record<string, string | number> = {
          from: options.from,
          to: options.to,
          groupBy: options.groupBy ?? "campaign",
        };

        if (filters) {
          Object.assign(query, filters);
        }

        const response = await context.client.get<unknown>(ENDPOINTS.reports.summaryPath, query);
        const cleanResponse = stripReportNoise(response);
        const data = isRecord(cleanResponse)
          ? {
              from: options.from,
              to: options.to,
              groupBy: query.groupBy,
              ...cleanResponse,
            }
          : {
              from: options.from,
              to: options.to,
              groupBy: query.groupBy,
              result: cleanResponse,
            };

        await printJson(success(data), getPrintOptions(command));
      } catch (error) {
        await printFailure(command, error);
      }
    });

  reports
    .command("raw")
    .description("Run raw report")
    .requiredOption("--from <iso>", "Start datetime (ISO string)")
    .requiredOption("--to <iso>", "End datetime (ISO string)")
    .option("--limit <n>", "Maximum rows", (value) => Number.parseInt(value, 10))
    .action(async function action(this: Command, options: RawOptions) {
      const command = this;
      try {
        assertIsoDate(options.from, "--from");
        assertIsoDate(options.to, "--to");

        if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
          throw new Error("--limit must be a positive integer.");
        }

        const context = await createCommandContext(command);
        requireToken(context.token);

        const query: Record<string, string | number> = {
          from: options.from,
          to: options.to,
        };

        if (options.limit !== undefined) {
          query.limit = options.limit;
        }

        const response = await context.client.get<unknown>(ENDPOINTS.reports.rawPath, query);
        const cleanResponse = stripReportNoise(response);
        const data = isRecord(cleanResponse)
          ? {
              from: options.from,
              to: options.to,
              ...cleanResponse,
            }
          : {
              from: options.from,
              to: options.to,
              result: cleanResponse,
            };

        await printJson(success(data), getPrintOptions(command));
      } catch (error) {
        await printFailure(command, error);
      }
    });
}

import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { type NormalizedReportType } from "../reports/mapping.js";
import { mergeReportQueryInputs } from "../reports/query.js";
import { extractReportSchema, type ReportSchemaColumn, type VoluumSchemaResponse } from "../reports/schema.js";
import { printJson } from "../output/print.js";
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
  voluum reports query --path /report/conversions --query from=2026-02-01,to=2026-02-18,limit=100,offset=100,sort=visits:desc

  # Merge --query with --query-json
  voluum reports query --path /report/conversions --query from=2026-02-01,to=2026-02-18,limit=100 --query-json '{"limit":25,"offset":50,"sort":"visits:asc"}'
  --query-json overrides duplicate keys from --query.
`;

const REPORT_SCHEMA_HELP_TEXT = `
Examples:
  # Inspect schema columns for conversions
  voluum reports schema --path /report/conversions --query from=2026-02-01,to=2026-02-18 --groupable --type money --search revenue

  # Include query parameter catalog while filtering
  voluum reports schema --path /report/conversions --query from=2026-02-01,to=2026-02-18 --restrictable --with-query-params
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

        await printJson(
          success({
            path,
            query,
            response,
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
        const data = isRecord(response)
          ? {
              from: options.from,
              to: options.to,
              groupBy: query.groupBy,
              ...response,
            }
          : {
              from: options.from,
              to: options.to,
              groupBy: query.groupBy,
              result: response,
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
        const data = isRecord(response)
          ? {
              from: options.from,
              to: options.to,
              ...response,
            }
          : {
              from: options.from,
              to: options.to,
              result: response,
            };

        await printJson(success(data), getPrintOptions(command));
      } catch (error) {
        await printFailure(command, error);
      }
    });
}

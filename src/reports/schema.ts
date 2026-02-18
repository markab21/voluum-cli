import { normalizeVoluumColumnType, type NormalizedReportType } from "./mapping.js";

export interface VoluumColumnMapping {
  key: string;
  label: string;
  type: string;
  canGroupBy: boolean;
  canBeRestricted: boolean;
}

export interface VoluumSchemaResponse {
  columnMappings?: VoluumColumnMapping[];
}

export interface ReportSchemaColumn {
  key: string;
  label: string;
  voluumType: string;
  normalizedType: NormalizedReportType;
  canGroupBy: boolean;
  canBeRestricted: boolean;
}

export interface ReportSchema {
  columns: ReportSchemaColumn[];
}

export function extractReportSchema(response: VoluumSchemaResponse): ReportSchema {
  const mappings = Array.isArray(response.columnMappings) ? response.columnMappings : [];

  return {
    columns: mappings.map((column) => ({
      key: column.key,
      label: column.label,
      voluumType: column.type,
      normalizedType: normalizeVoluumColumnType(column.type),
      canGroupBy: column.canGroupBy,
      canBeRestricted: column.canBeRestricted,
    })),
  };
}

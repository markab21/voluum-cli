import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { registerReportCommands } from "../../src/commands/reports.js";

interface TestServer {
  baseUrl: string;
  requests: string[];
  close: () => Promise<void>;
}

async function startTestServer(
  handler: (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => void,
): Promise<TestServer> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    handler(request, response);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected server to listen on a TCP port.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  program
    .option("--baseUrl <url>")
    .option("--token <token>")
    .option("--pretty")
    .option("--silent")
    .option("--out <file>");
  registerReportCommands(program);
  return program;
}

describe("reports schema command", () => {
  test("filters output columns by --groupable", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          columnMappings: [
            {
              key: "campaignName",
              label: "Campaign",
              type: "string",
              canGroupBy: true,
              canBeRestricted: true,
            },
            {
              key: "revenue",
              label: "Revenue",
              type: "monetary-decimal-4",
              canGroupBy: false,
              canBeRestricted: true,
            },
          ],
        }),
      );
    });

    try {
      const outputDir = await mkdtemp(join(tmpdir(), "voluum-cli-reports-schema-"));
      const outputFile = join(outputDir, "schema.json");
      const program = buildProgram();

      await program.parseAsync([
        "node",
        "voluum",
        "--baseUrl",
        server.baseUrl,
        "--token",
        "test-token",
        "--silent",
        "--out",
        outputFile,
        "reports",
        "schema",
        "--groupable",
      ]);

      expect(server.requests).toHaveLength(1);
      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report");

      const payload = JSON.parse(await readFile(outputFile, "utf8")) as {
        ok: boolean;
        data: { columns: Array<{ key: string }> };
      };

      expect(payload.ok).toBe(true);
      expect(payload.data.columns.map((column) => column.key)).toEqual(["campaignName"]);
    } finally {
      await server.close();
    }
  });

  test("filters output columns by --restrictable", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          columnMappings: [
            {
              key: "campaignName",
              label: "Campaign",
              type: "string",
              canGroupBy: true,
              canBeRestricted: true,
            },
            {
              key: "deviceType",
              label: "Device Type",
              type: "string",
              canGroupBy: true,
              canBeRestricted: false,
            },
          ],
        }),
      );
    });

    try {
      const outputDir = await mkdtemp(join(tmpdir(), "voluum-cli-reports-schema-"));
      const outputFile = join(outputDir, "schema.json");
      const program = buildProgram();

      await program.parseAsync([
        "node",
        "voluum",
        "--baseUrl",
        server.baseUrl,
        "--token",
        "test-token",
        "--silent",
        "--out",
        outputFile,
        "reports",
        "schema",
        "--restrictable",
      ]);

      expect(server.requests).toHaveLength(1);
      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report");

      const payload = JSON.parse(await readFile(outputFile, "utf8")) as {
        ok: boolean;
        data: { columns: Array<{ key: string }> };
      };

      expect(payload.ok).toBe(true);
      expect(payload.data.columns.map((column) => column.key)).toEqual(["campaignName"]);
    } finally {
      await server.close();
    }
  });

  test("filters output columns by --type", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          columnMappings: [
            {
              key: "campaignName",
              label: "Campaign",
              type: "string",
              canGroupBy: true,
              canBeRestricted: true,
            },
            {
              key: "revenue",
              label: "Revenue",
              type: "monetary-decimal-4",
              canGroupBy: false,
              canBeRestricted: true,
            },
            {
              key: "clicks",
              label: "Clicks",
              type: "integer",
              canGroupBy: false,
              canBeRestricted: true,
            },
          ],
        }),
      );
    });

    try {
      const outputDir = await mkdtemp(join(tmpdir(), "voluum-cli-reports-schema-"));
      const outputFile = join(outputDir, "schema.json");
      const program = buildProgram();

      await program.parseAsync([
        "node",
        "voluum",
        "--baseUrl",
        server.baseUrl,
        "--token",
        "test-token",
        "--silent",
        "--out",
        outputFile,
        "reports",
        "schema",
        "--type",
        "money",
      ]);

      expect(server.requests).toHaveLength(1);
      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report");

      const payload = JSON.parse(await readFile(outputFile, "utf8")) as {
        ok: boolean;
        data: { columns: Array<{ key: string }> };
      };

      expect(payload.ok).toBe(true);
      expect(payload.data.columns.map((column) => column.key)).toEqual(["revenue"]);
    } finally {
      await server.close();
    }
  });

  test("filters output columns by --search", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          columnMappings: [
            {
              key: "campaignName",
              label: "Campaign",
              type: "string",
              canGroupBy: true,
              canBeRestricted: true,
            },
            {
              key: "revenue",
              label: "Revenue",
              type: "monetary-decimal-4",
              canGroupBy: false,
              canBeRestricted: true,
            },
            {
              key: "clicks",
              label: "Clicks",
              type: "integer",
              canGroupBy: false,
              canBeRestricted: true,
            },
          ],
        }),
      );
    });

    try {
      const outputDir = await mkdtemp(join(tmpdir(), "voluum-cli-reports-schema-"));
      const outputFile = join(outputDir, "schema.json");
      const program = buildProgram();

      await program.parseAsync([
        "node",
        "voluum",
        "--baseUrl",
        server.baseUrl,
        "--token",
        "test-token",
        "--silent",
        "--out",
        outputFile,
        "reports",
        "schema",
        "--search",
        "money",
      ]);

      expect(server.requests).toHaveLength(1);
      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report");

      const payload = JSON.parse(await readFile(outputFile, "utf8")) as {
        ok: boolean;
        data: { columns: Array<{ key: string }> };
      };

      expect(payload.ok).toBe(true);
      expect(payload.data.columns.map((column) => column.key)).toEqual(["revenue"]);
    } finally {
      await server.close();
    }
  });

  test("includes query parameter catalog when --with-query-params is set", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ columnMappings: [] }));
    });

    try {
      const outputDir = await mkdtemp(join(tmpdir(), "voluum-cli-reports-schema-"));
      const outputFile = join(outputDir, "schema.json");
      const program = buildProgram();

      await program.parseAsync([
        "node",
        "voluum",
        "--baseUrl",
        server.baseUrl,
        "--token",
        "test-token",
        "--silent",
        "--out",
        outputFile,
        "reports",
        "schema",
        "--with-query-params",
      ]);

      const payload = JSON.parse(await readFile(outputFile, "utf8")) as {
        ok: boolean;
        data: {
          queryParameters: {
            required: string[];
            common: string[];
          };
        };
      };

      expect(payload.ok).toBe(true);
      expect(payload.data.queryParameters.required).toEqual(["from", "to"]);
      expect(payload.data.queryParameters.common).toEqual([
        "groupBy",
        "limit",
        "offset",
        "sort",
        "columns",
      ]);
    } finally {
      await server.close();
    }
  });
});

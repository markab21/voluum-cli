import { mkdtemp, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("reports summary command", () => {
  test("requires valid ISO dates", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ rows: [] }));
    });

    const previousExitCode = process.exitCode;
    process.exitCode = 0;

    try {
      const outputDir = await mkdtemp(join(tmpdir(), "voluum-cli-reports-summary-"));
      const outputFile = join(outputDir, "summary-error.json");
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
        "summary",
        "--from",
        "not-an-iso",
        "--to",
        "2026-02-01T00:00:00.000Z",
      ]);

      expect(server.requests).toHaveLength(0);

      const payload = JSON.parse(await readFile(outputFile, "utf8")) as {
        ok: boolean;
        error: {
          message: string;
          code: string;
        };
      };

      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe("OPERATIONAL_ERROR");
      expect(payload.error.message).toBe("Invalid --from. Expected an ISO date/time string.");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode ?? 0;
      await server.close();
    }
  });

  test("forwards --groupBy and --filters as query params", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ rows: [] }));
    });

    try {
      const program = buildProgram();

      await program.parseAsync([
        "node",
        "voluum",
        "--baseUrl",
        server.baseUrl,
        "--token",
        "test-token",
        "--silent",
        "reports",
        "summary",
        "--from",
        "2026-02-01T00:00:00.000Z",
        "--to",
        "2026-02-02T00:00:00.000Z",
        "--groupBy",
        "country",
        "--filters",
        "campaignId=abc123,status=active",
      ]);

      expect(server.requests).toHaveLength(1);

      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report");
      expect(requestUrl.searchParams.get("from")).toBe("2026-02-01T00:00:00.000Z");
      expect(requestUrl.searchParams.get("to")).toBe("2026-02-02T00:00:00.000Z");
      expect(requestUrl.searchParams.get("groupBy")).toBe("country");
      expect(requestUrl.searchParams.get("campaignId")).toBe("abc123");
      expect(requestUrl.searchParams.get("status")).toBe("active");
    } finally {
      await server.close();
    }
  });
});

describe("reports raw command", () => {
  test("enforces --limit as a positive integer", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ rows: [] }));
    });

    const previousExitCode = process.exitCode;
    process.exitCode = 0;

    try {
      const outputDir = await mkdtemp(join(tmpdir(), "voluum-cli-reports-raw-"));
      const outputFile = join(outputDir, "raw-error.json");
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
        "raw",
        "--from",
        "2026-02-01T00:00:00.000Z",
        "--to",
        "2026-02-02T00:00:00.000Z",
        "--limit",
        "0",
      ]);

      expect(server.requests).toHaveLength(0);

      const payload = JSON.parse(await readFile(outputFile, "utf8")) as {
        ok: boolean;
        error: {
          message: string;
          code: string;
        };
      };

      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe("OPERATIONAL_ERROR");
      expect(payload.error.message).toBe("--limit must be a positive integer.");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode ?? 0;
      await server.close();
    }
  });

  test("forwards report params including --limit", async () => {
    const server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ rows: [] }));
    });

    try {
      const program = buildProgram();

      await program.parseAsync([
        "node",
        "voluum",
        "--baseUrl",
        server.baseUrl,
        "--token",
        "test-token",
        "--silent",
        "reports",
        "raw",
        "--from",
        "2026-02-01T00:00:00.000Z",
        "--to",
        "2026-02-02T00:00:00.000Z",
        "--limit",
        "25",
      ]);

      expect(server.requests).toHaveLength(1);

      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report/conversions");
      expect(requestUrl.searchParams.get("from")).toBe("2026-02-01T00:00:00.000Z");
      expect(requestUrl.searchParams.get("to")).toBe("2026-02-02T00:00:00.000Z");
      expect(requestUrl.searchParams.get("limit")).toBe("25");
    } finally {
      await server.close();
    }
  });
});

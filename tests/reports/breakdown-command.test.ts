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

describe("reports breakdown command", () => {
  test("uses offer preset defaults", async () => {
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
        "breakdown",
        "--by",
        "offer",
        "--from",
        "2026-02-01T00:00:00.000Z",
        "--to",
        "2026-02-02T00:00:00.000Z",
      ]);

      expect(server.requests).toHaveLength(1);
      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report");
      expect(requestUrl.searchParams.get("groupBy")).toBe("offerId");
      expect(requestUrl.searchParams.get("columns")).toBe(
        "offerId,offerName,conversions,revenue,profit,roi,visits,cv,epc",
      );
    } finally {
      await server.close();
    }
  });

  test("uses offer-by-campaign preset and forwards campaignId filter", async () => {
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
        "breakdown",
        "--by",
        "offer-by-campaign",
        "--from",
        "2026-02-01T00:00:00.000Z",
        "--to",
        "2026-02-02T00:00:00.000Z",
        "--campaignId",
        "abc-123",
      ]);

      expect(server.requests).toHaveLength(1);
      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report");
      expect(requestUrl.searchParams.get("groupBy")).toBe("campaignId,offerId");
      expect(requestUrl.searchParams.get("campaignId")).toBe("abc-123");
    } finally {
      await server.close();
    }
  });

  test("accepts flow preset with custom columns and pagination", async () => {
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
        "breakdown",
        "--by",
        "flow",
        "--from",
        "2026-02-01T00:00:00.000Z",
        "--to",
        "2026-02-02T00:00:00.000Z",
        "--columns",
        "flowId,flowName,conversions,revenue",
        "--limit",
        "25",
        "--offset",
        "50",
      ]);

      expect(server.requests).toHaveLength(1);
      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.searchParams.get("groupBy")).toBe("flowId");
      expect(requestUrl.searchParams.get("columns")).toBe("flowId,flowName,conversions,revenue");
      expect(requestUrl.searchParams.get("limit")).toBe("25");
      expect(requestUrl.searchParams.get("offset")).toBe("50");
    } finally {
      await server.close();
    }
  });
});

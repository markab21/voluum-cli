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

describe("reports query command", () => {
  test("merges --query and --query-json with JSON precedence for GET query params", async () => {
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
        "query",
        "--path",
        "report/conversions",
        "--query",
        "from=2026-02-01,limit=100",
        "--query-json",
        '{"limit":5,"offset":2}',
      ]);

      expect(server.requests).toHaveLength(1);
      const requestUrl = new URL(server.requests[0] ?? "", server.baseUrl);
      expect(requestUrl.pathname).toBe("/report/conversions");
      expect(requestUrl.searchParams.get("from")).toBe("2026-02-01");
      expect(requestUrl.searchParams.get("limit")).toBe("5");
      expect(requestUrl.searchParams.get("offset")).toBe("2");
    } finally {
      await server.close();
    }
  });
});

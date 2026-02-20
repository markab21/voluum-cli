import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerTrackerDomainCommands } from "../../src/commands/tracker-domains.js";

interface TestServer {
  baseUrl: string;
  requests: Array<{ method: string; url: string; body: unknown }>;
  close: () => Promise<void>;
}

async function startTestServer(
  handler: (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => void,
): Promise<TestServer> {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];
  const server = createServer(async (request, response) => {
    let body: unknown = null;
    if (request.method !== "GET" && request.method !== "DELETE") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf-8");
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }
    requests.push({ method: request.method ?? "GET", url: request.url ?? "", body });
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
          if (error) { reject(error); return; }
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
  registerTrackerDomainCommands(program);
  return program;
}

describe("tracker-domains commands", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "test-id", name: "Test Tracker Domain" }));
    });
  });

  afterEach(async () => {
    await server.close();
  });

  test("list calls GET /tracker-domain", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "tracker-domains", "list",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/tracker-domain");
  });

  test("get calls GET /tracker-domain/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "tracker-domains", "get", "--id", "td-123",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/tracker-domain/td-123");
  });

  test("create calls POST /tracker-domain with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "tracker-domains", "create",
      "--data", '{"name":"New Tracker Domain"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.url).toBe("/tracker-domain");
    expect(server.requests[0]?.body).toEqual({ name: "New Tracker Domain" });
  });

  test("update calls PUT /tracker-domain/{id} with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "tracker-domains", "update",
      "--id", "td-456",
      "--data", '{"name":"Updated Tracker Domain"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("PUT");
    expect(server.requests[0]?.url).toBe("/tracker-domain/td-456");
    expect(server.requests[0]?.body).toEqual({ name: "Updated Tracker Domain" });
  });

  test("delete calls DELETE /tracker-domain/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "tracker-domains", "delete",
      "--id", "td-789",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("DELETE");
    expect(server.requests[0]?.url).toBe("/tracker-domain/td-789");
  });
});

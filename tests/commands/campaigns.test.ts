import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerCampaignCommands } from "../../src/commands/campaigns.js";

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
  registerCampaignCommands(program);
  return program;
}

describe("campaigns commands", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "test-id", name: "Test Campaign" }));
    });
  });

  afterEach(async () => {
    await server.close();
  });

  test("list calls GET /campaign", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "campaigns", "list",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/campaign");
  });

  test("get calls GET /campaign/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "campaigns", "get", "--id", "camp-123",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/campaign/camp-123");
  });

  test("create calls POST /campaign with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "campaigns", "create",
      "--data", '{"name":"New Campaign","trafficSourceId":"ts-1"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.url).toBe("/campaign");
    expect(server.requests[0]?.body).toEqual({ name: "New Campaign", trafficSourceId: "ts-1" });
  });

  test("update calls PUT /campaign/{id} with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "campaigns", "update",
      "--id", "camp-456",
      "--data", '{"name":"Updated Campaign"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("PUT");
    expect(server.requests[0]?.url).toBe("/campaign/camp-456");
    expect(server.requests[0]?.body).toEqual({ name: "Updated Campaign" });
  });

  test("delete calls DELETE /campaign/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "campaigns", "delete",
      "--id", "camp-789",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("DELETE");
    expect(server.requests[0]?.url).toBe("/campaign/camp-789");
  });
});

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerAffiliateNetworkCommands } from "../../src/commands/affiliate-networks.js";

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
  registerAffiliateNetworkCommands(program);
  return program;
}

describe("affiliate-networks commands", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "test-id", name: "Test Affiliate Network" }));
    });
  });

  afterEach(async () => {
    await server.close();
  });

  test("list calls GET /affiliate-network", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "affiliate-networks", "list",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/affiliate-network");
  });

  test("get calls GET /affiliate-network/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "affiliate-networks", "get", "--id", "an-123",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/affiliate-network/an-123");
  });

  test("create calls POST /affiliate-network with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "affiliate-networks", "create",
      "--data", '{"name":"New Affiliate Network"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.url).toBe("/affiliate-network");
    expect(server.requests[0]?.body).toEqual({ name: "New Affiliate Network" });
  });

  test("update calls PUT /affiliate-network/{id} with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "affiliate-networks", "update",
      "--id", "an-456",
      "--data", '{"name":"Updated Affiliate Network"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("PUT");
    expect(server.requests[0]?.url).toBe("/affiliate-network/an-456");
    expect(server.requests[0]?.body).toEqual({ name: "Updated Affiliate Network" });
  });

  test("delete calls DELETE /affiliate-network/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "affiliate-networks", "delete",
      "--id", "an-789",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("DELETE");
    expect(server.requests[0]?.url).toBe("/affiliate-network/an-789");
  });
});

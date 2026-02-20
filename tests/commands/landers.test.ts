import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerLanderCommands } from "../../src/commands/landers.js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  registerLanderCommands(program);
  return program;
}

describe("landers commands", () => {
  let server: TestServer;
  let tempDir: string;

  beforeEach(async () => {
    server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "test-id", name: "Test Lander" }));
    });
    tempDir = join(tmpdir(), `voluum-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await server.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("list calls GET /lander", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "landers", "list",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/lander");
  });

  test("get calls GET /lander/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "landers", "get", "--id", "lander-123",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/lander/lander-123");
  });

  test("create calls POST /lander with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "landers", "create",
      "--data", '{"name":"New Lander","url":"https://example.com"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.url).toBe("/lander");
    expect(server.requests[0]?.body).toEqual({ name: "New Lander", url: "https://example.com" });
  });

  test("create calls POST /lander with body from --file", async () => {
    const dataFile = join(tempDir, "lander.json");
    await writeFile(dataFile, JSON.stringify({ name: "File Lander", url: "https://file.com" }));

    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "landers", "create",
      "--file", dataFile,
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.url).toBe("/lander");
    expect(server.requests[0]?.body).toEqual({ name: "File Lander", url: "https://file.com" });
  });

  test("update calls PUT /lander/{id} with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "landers", "update",
      "--id", "lander-456",
      "--data", '{"name":"Updated Lander"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("PUT");
    expect(server.requests[0]?.url).toBe("/lander/lander-456");
    expect(server.requests[0]?.body).toEqual({ name: "Updated Lander" });
  });

  test("delete calls DELETE /lander/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "landers", "delete",
      "--id", "lander-789",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("DELETE");
    expect(server.requests[0]?.url).toBe("/lander/lander-789");
  });
});

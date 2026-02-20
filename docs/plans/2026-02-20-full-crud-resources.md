# Full CRUD for 7 Core Resources Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full CRUD operations (list, get, create, update, delete) for offers, landers, flows, traffic-sources, affiliate-networks, tracker-domains, and extend campaigns with create/update/delete.

**Architecture:** Each resource gets its own command file following the campaigns.ts pattern. Endpoints are centralized in endpoints.ts. Commands use VoluumClient's get/post/put/delete methods. Input via --data (inline JSON) or --file (JSON file path).

**Tech Stack:** TypeScript, Commander.js, Bun test framework

---

## Task 1: Extend endpoints.ts with all resource paths

**Files:**
- Modify: `src/endpoints.ts`

**Step 1: Add resource endpoint definitions**

Add after the `reports` object in `ENDPOINTS`:

```typescript
  offers: {
    listPath: "/offer",
    getPath: (id: string) => `/offer/${encodeURIComponent(id)}`,
    createPath: "/offer",
    updatePath: (id: string) => `/offer/${encodeURIComponent(id)}`,
    deletePath: (id: string) => `/offer/${encodeURIComponent(id)}`,
  },
  landers: {
    listPath: "/lander",
    getPath: (id: string) => `/lander/${encodeURIComponent(id)}`,
    createPath: "/lander",
    updatePath: (id: string) => `/lander/${encodeURIComponent(id)}`,
    deletePath: (id: string) => `/lander/${encodeURIComponent(id)}`,
  },
  flows: {
    listPath: "/flow",
    getPath: (id: string) => `/flow/${encodeURIComponent(id)}`,
    createPath: "/flow",
    updatePath: (id: string) => `/flow/${encodeURIComponent(id)}`,
    deletePath: (id: string) => `/flow/${encodeURIComponent(id)}`,
  },
  trafficSources: {
    listPath: "/traffic-source",
    getPath: (id: string) => `/traffic-source/${encodeURIComponent(id)}`,
    createPath: "/traffic-source",
    updatePath: (id: string) => `/traffic-source/${encodeURIComponent(id)}`,
    deletePath: (id: string) => `/traffic-source/${encodeURIComponent(id)}`,
  },
  affiliateNetworks: {
    listPath: "/affiliate-network",
    getPath: (id: string) => `/affiliate-network/${encodeURIComponent(id)}`,
    createPath: "/affiliate-network",
    updatePath: (id: string) => `/affiliate-network/${encodeURIComponent(id)}`,
    deletePath: (id: string) => `/affiliate-network/${encodeURIComponent(id)}`,
  },
  trackerDomains: {
    listPath: "/tracker-domain",
    getPath: (id: string) => `/tracker-domain/${encodeURIComponent(id)}`,
    createPath: "/tracker-domain",
    updatePath: (id: string) => `/tracker-domain/${encodeURIComponent(id)}`,
    deletePath: (id: string) => `/tracker-domain/${encodeURIComponent(id)}`,
  },
```

Also add create/update/delete paths to existing campaigns:

```typescript
  campaigns: {
    listPath: "/campaign",
    getPath: (id: string) => `/campaign/${encodeURIComponent(id)}`,
    createPath: "/campaign",
    updatePath: (id: string) => `/campaign/${encodeURIComponent(id)}`,
    deletePath: (id: string) => `/campaign/${encodeURIComponent(id)}`,
  },
```

**Step 2: Run typecheck**

Run: `bun run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/endpoints.ts
git commit -m "feat: add endpoint paths for all CRUD resources"
```

---

## Task 2: Add helper utilities for JSON input

**Files:**
- Modify: `src/commands/helpers.ts`

**Step 1: Add readDataFile helper**

Add these functions at the end of `src/commands/helpers.ts`:

```typescript
export async function readDataFile(filePath: string): Promise<unknown> {
  const fs = await import("node:fs/promises");
  const content = await fs.readFile(filePath, "utf-8");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in file: ${filePath}`);
  }
}

export async function resolveDataInput(
  dataOption: string | undefined,
  fileOption: string | undefined,
): Promise<unknown> {
  if (dataOption && fileOption) {
    throw new Error("Use either --data or --file, not both.");
  }

  if (fileOption) {
    return readDataFile(fileOption);
  }

  if (dataOption) {
    return parseJsonBody(dataOption);
  }

  throw new Error("Either --data or --file is required.");
}
```

**Step 2: Run typecheck**

Run: `bun run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/helpers.ts
git commit -m "feat: add readDataFile and resolveDataInput helpers"
```

---

## Task 3: Create offers command

**Files:**
- Create: `src/commands/offers.ts`
- Create: `tests/commands/offers.test.ts`

**Step 0: Create test directory**

```bash
mkdir -p tests/commands
```

**Step 1: Write the test file**

Create `tests/commands/offers.test.ts`:

```typescript
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerOfferCommands } from "../../src/commands/offers.js";
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
  registerOfferCommands(program);
  return program;
}

describe("offers commands", () => {
  let server: TestServer;
  let tempDir: string;

  beforeEach(async () => {
    server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "test-id", name: "Test Offer" }));
    });
    tempDir = join(tmpdir(), `voluum-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await server.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("list calls GET /offer", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "offers", "list",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/offer");
  });

  test("get calls GET /offer/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "offers", "get", "--id", "offer-123",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/offer/offer-123");
  });

  test("create calls POST /offer with body from --data", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "offers", "create",
      "--data", '{"name":"New Offer","url":"https://example.com"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.url).toBe("/offer");
    expect(server.requests[0]?.body).toEqual({ name: "New Offer", url: "https://example.com" });
  });

  test("create calls POST /offer with body from --file", async () => {
    const dataFile = join(tempDir, "offer.json");
    await writeFile(dataFile, JSON.stringify({ name: "File Offer", url: "https://file.com" }));

    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "offers", "create",
      "--file", dataFile,
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.body).toEqual({ name: "File Offer", url: "https://file.com" });
  });

  test("update calls PUT /offer/{id} with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "offers", "update",
      "--id", "offer-456",
      "--data", '{"name":"Updated Offer"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("PUT");
    expect(server.requests[0]?.url).toBe("/offer/offer-456");
    expect(server.requests[0]?.body).toEqual({ name: "Updated Offer" });
  });

  test("delete calls DELETE /offer/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "offers", "delete",
      "--id", "offer-789",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("DELETE");
    expect(server.requests[0]?.url).toBe("/offer/offer-789");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/offers.test.ts`
Expected: FAIL - registerOfferCommands not found

**Step 3: Write the implementation**

Create `src/commands/offers.ts`:

```typescript
import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
  resolveDataInput,
} from "./helpers.js";

interface DataOptions {
  data?: string;
  file?: string;
}

interface IdOptions {
  id: string;
}

interface IdDataOptions extends IdOptions, DataOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOffersResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.offers)) {
    return payload.offers;
  }

  return payload;
}

export function registerOfferCommands(program: Command): void {
  const offers = program.command("offers").description("Offer operations");

  offers
    .command("list")
    .description("List all offers")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.offers.listPath);
        await printJson(
          success({
            offers: normalizeOffersResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  offers
    .command("get")
    .description("Get offer by ID")
    .requiredOption("--id <id>", "Offer ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.offers.getPath(options.id));
        await printJson(
          success({
            offer: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  offers
    .command("create")
    .description("Create a new offer")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.offers.createPath, body);
        await printJson(
          success({
            offer: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  offers
    .command("update")
    .description("Update an existing offer")
    .requiredOption("--id <id>", "Offer ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.offers.updatePath(options.id), body);
        await printJson(
          success({
            offer: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  offers
    .command("delete")
    .description("Delete an offer")
    .requiredOption("--id <id>", "Offer ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.offers.deletePath(options.id));
        await printJson(
          success({
            deleted: true,
            id: options.id,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/offers.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/commands/offers.ts tests/commands/offers.test.ts
git commit -m "feat: add offers command with full CRUD"
```

---

## Task 4: Create landers command

**Files:**
- Create: `src/commands/landers.ts`
- Create: `tests/commands/landers.test.ts`

**Step 1: Write the test file**

Create `tests/commands/landers.test.ts`:

```typescript
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerLanderCommands } from "../../src/commands/landers.js";

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

  beforeEach(async () => {
    server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "test-id", name: "Test Lander" }));
    });
  });

  afterEach(async () => {
    await server.close();
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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/landers.test.ts`
Expected: FAIL - registerLanderCommands not found

**Step 3: Write the implementation**

Create `src/commands/landers.ts`:

```typescript
import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
  resolveDataInput,
} from "./helpers.js";

interface DataOptions {
  data?: string;
  file?: string;
}

interface IdOptions {
  id: string;
}

interface IdDataOptions extends IdOptions, DataOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeLandersResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.landers)) {
    return payload.landers;
  }

  return payload;
}

export function registerLanderCommands(program: Command): void {
  const landers = program.command("landers").description("Lander operations");

  landers
    .command("list")
    .description("List all landers")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.landers.listPath);
        await printJson(
          success({
            landers: normalizeLandersResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  landers
    .command("get")
    .description("Get lander by ID")
    .requiredOption("--id <id>", "Lander ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.landers.getPath(options.id));
        await printJson(
          success({
            lander: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  landers
    .command("create")
    .description("Create a new lander")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.landers.createPath, body);
        await printJson(
          success({
            lander: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  landers
    .command("update")
    .description("Update an existing lander")
    .requiredOption("--id <id>", "Lander ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.landers.updatePath(options.id), body);
        await printJson(
          success({
            lander: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  landers
    .command("delete")
    .description("Delete a lander")
    .requiredOption("--id <id>", "Lander ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.landers.deletePath(options.id));
        await printJson(
          success({
            deleted: true,
            id: options.id,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/landers.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/commands/landers.ts tests/commands/landers.test.ts
git commit -m "feat: add landers command with full CRUD"
```

---

## Task 5: Create flows command

**Files:**
- Create: `src/commands/flows.ts`
- Create: `tests/commands/flows.test.ts`

**Step 1: Write the test file**

Create `tests/commands/flows.test.ts` (same pattern, replace "lander" with "flow", endpoint "/flow"):

```typescript
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerFlowCommands } from "../../src/commands/flows.js";

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
  registerFlowCommands(program);
  return program;
}

describe("flows commands", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "test-id", name: "Test Flow" }));
    });
  });

  afterEach(async () => {
    await server.close();
  });

  test("list calls GET /flow", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "flows", "list",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/flow");
  });

  test("get calls GET /flow/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "flows", "get", "--id", "flow-123",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/flow/flow-123");
  });

  test("create calls POST /flow with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "flows", "create",
      "--data", '{"name":"New Flow"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.url).toBe("/flow");
    expect(server.requests[0]?.body).toEqual({ name: "New Flow" });
  });

  test("update calls PUT /flow/{id} with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "flows", "update",
      "--id", "flow-456",
      "--data", '{"name":"Updated Flow"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("PUT");
    expect(server.requests[0]?.url).toBe("/flow/flow-456");
    expect(server.requests[0]?.body).toEqual({ name: "Updated Flow" });
  });

  test("delete calls DELETE /flow/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "flows", "delete",
      "--id", "flow-789",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("DELETE");
    expect(server.requests[0]?.url).toBe("/flow/flow-789");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/flows.test.ts`
Expected: FAIL - registerFlowCommands not found

**Step 3: Write the implementation**

Create `src/commands/flows.ts`:

```typescript
import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
  resolveDataInput,
} from "./helpers.js";

interface DataOptions {
  data?: string;
  file?: string;
}

interface IdOptions {
  id: string;
}

interface IdDataOptions extends IdOptions, DataOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeFlowsResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.flows)) {
    return payload.flows;
  }

  return payload;
}

export function registerFlowCommands(program: Command): void {
  const flows = program.command("flows").description("Flow operations");

  flows
    .command("list")
    .description("List all flows")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.flows.listPath);
        await printJson(
          success({
            flows: normalizeFlowsResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  flows
    .command("get")
    .description("Get flow by ID")
    .requiredOption("--id <id>", "Flow ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.flows.getPath(options.id));
        await printJson(
          success({
            flow: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  flows
    .command("create")
    .description("Create a new flow")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.flows.createPath, body);
        await printJson(
          success({
            flow: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  flows
    .command("update")
    .description("Update an existing flow")
    .requiredOption("--id <id>", "Flow ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.flows.updatePath(options.id), body);
        await printJson(
          success({
            flow: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  flows
    .command("delete")
    .description("Delete a flow")
    .requiredOption("--id <id>", "Flow ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.flows.deletePath(options.id));
        await printJson(
          success({
            deleted: true,
            id: options.id,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/flows.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/commands/flows.ts tests/commands/flows.test.ts
git commit -m "feat: add flows command with full CRUD"
```

---

## Task 6: Create traffic-sources command

**Files:**
- Create: `src/commands/traffic-sources.ts`
- Create: `tests/commands/traffic-sources.test.ts`

**Step 1: Write the test file**

Create `tests/commands/traffic-sources.test.ts`:

```typescript
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerTrafficSourceCommands } from "../../src/commands/traffic-sources.js";

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
  registerTrafficSourceCommands(program);
  return program;
}

describe("traffic-sources commands", () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: "test-id", name: "Test Traffic Source" }));
    });
  });

  afterEach(async () => {
    await server.close();
  });

  test("list calls GET /traffic-source", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "traffic-sources", "list",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/traffic-source");
  });

  test("get calls GET /traffic-source/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "traffic-sources", "get", "--id", "ts-123",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("GET");
    expect(server.requests[0]?.url).toBe("/traffic-source/ts-123");
  });

  test("create calls POST /traffic-source with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "traffic-sources", "create",
      "--data", '{"name":"New Traffic Source"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.url).toBe("/traffic-source");
    expect(server.requests[0]?.body).toEqual({ name: "New Traffic Source" });
  });

  test("update calls PUT /traffic-source/{id} with body", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "traffic-sources", "update",
      "--id", "ts-456",
      "--data", '{"name":"Updated Traffic Source"}',
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("PUT");
    expect(server.requests[0]?.url).toBe("/traffic-source/ts-456");
    expect(server.requests[0]?.body).toEqual({ name: "Updated Traffic Source" });
  });

  test("delete calls DELETE /traffic-source/{id}", async () => {
    const program = buildProgram();
    await program.parseAsync([
      "node", "voluum",
      "--baseUrl", server.baseUrl,
      "--token", "test-token",
      "--silent",
      "traffic-sources", "delete",
      "--id", "ts-789",
    ]);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.method).toBe("DELETE");
    expect(server.requests[0]?.url).toBe("/traffic-source/ts-789");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/traffic-sources.test.ts`
Expected: FAIL - registerTrafficSourceCommands not found

**Step 3: Write the implementation**

Create `src/commands/traffic-sources.ts`:

```typescript
import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
  resolveDataInput,
} from "./helpers.js";

interface DataOptions {
  data?: string;
  file?: string;
}

interface IdOptions {
  id: string;
}

interface IdDataOptions extends IdOptions, DataOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTrafficSourcesResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.trafficSources)) {
    return payload.trafficSources;
  }

  return payload;
}

export function registerTrafficSourceCommands(program: Command): void {
  const trafficSources = program.command("traffic-sources").description("Traffic source operations");

  trafficSources
    .command("list")
    .description("List all traffic sources")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.trafficSources.listPath);
        await printJson(
          success({
            trafficSources: normalizeTrafficSourcesResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trafficSources
    .command("get")
    .description("Get traffic source by ID")
    .requiredOption("--id <id>", "Traffic source ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.trafficSources.getPath(options.id));
        await printJson(
          success({
            trafficSource: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trafficSources
    .command("create")
    .description("Create a new traffic source")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.trafficSources.createPath, body);
        await printJson(
          success({
            trafficSource: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trafficSources
    .command("update")
    .description("Update an existing traffic source")
    .requiredOption("--id <id>", "Traffic source ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.trafficSources.updatePath(options.id), body);
        await printJson(
          success({
            trafficSource: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trafficSources
    .command("delete")
    .description("Delete a traffic source")
    .requiredOption("--id <id>", "Traffic source ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.trafficSources.deletePath(options.id));
        await printJson(
          success({
            deleted: true,
            id: options.id,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/traffic-sources.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/commands/traffic-sources.ts tests/commands/traffic-sources.test.ts
git commit -m "feat: add traffic-sources command with full CRUD"
```

---

## Task 7: Create affiliate-networks command

**Files:**
- Create: `src/commands/affiliate-networks.ts`
- Create: `tests/commands/affiliate-networks.test.ts`

**Step 1: Write the test file**

Create `tests/commands/affiliate-networks.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/affiliate-networks.test.ts`
Expected: FAIL - registerAffiliateNetworkCommands not found

**Step 3: Write the implementation**

Create `src/commands/affiliate-networks.ts`:

```typescript
import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
  resolveDataInput,
} from "./helpers.js";

interface DataOptions {
  data?: string;
  file?: string;
}

interface IdOptions {
  id: string;
}

interface IdDataOptions extends IdOptions, DataOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAffiliateNetworksResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.affiliateNetworks)) {
    return payload.affiliateNetworks;
  }

  return payload;
}

export function registerAffiliateNetworkCommands(program: Command): void {
  const affiliateNetworks = program.command("affiliate-networks").description("Affiliate network operations");

  affiliateNetworks
    .command("list")
    .description("List all affiliate networks")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.affiliateNetworks.listPath);
        await printJson(
          success({
            affiliateNetworks: normalizeAffiliateNetworksResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  affiliateNetworks
    .command("get")
    .description("Get affiliate network by ID")
    .requiredOption("--id <id>", "Affiliate network ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.affiliateNetworks.getPath(options.id));
        await printJson(
          success({
            affiliateNetwork: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  affiliateNetworks
    .command("create")
    .description("Create a new affiliate network")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.affiliateNetworks.createPath, body);
        await printJson(
          success({
            affiliateNetwork: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  affiliateNetworks
    .command("update")
    .description("Update an existing affiliate network")
    .requiredOption("--id <id>", "Affiliate network ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.affiliateNetworks.updatePath(options.id), body);
        await printJson(
          success({
            affiliateNetwork: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  affiliateNetworks
    .command("delete")
    .description("Delete an affiliate network")
    .requiredOption("--id <id>", "Affiliate network ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.affiliateNetworks.deletePath(options.id));
        await printJson(
          success({
            deleted: true,
            id: options.id,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/affiliate-networks.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/commands/affiliate-networks.ts tests/commands/affiliate-networks.test.ts
git commit -m "feat: add affiliate-networks command with full CRUD"
```

---

## Task 8: Create tracker-domains command

**Files:**
- Create: `src/commands/tracker-domains.ts`
- Create: `tests/commands/tracker-domains.test.ts`

**Step 1: Write the test file**

Create `tests/commands/tracker-domains.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/tracker-domains.test.ts`
Expected: FAIL - registerTrackerDomainCommands not found

**Step 3: Write the implementation**

Create `src/commands/tracker-domains.ts`:

```typescript
import { Command } from "commander";
import { ENDPOINTS } from "../endpoints.js";
import { printJson } from "../output/print.js";
import { success } from "../output/shapes.js";
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
  resolveDataInput,
} from "./helpers.js";

interface DataOptions {
  data?: string;
  file?: string;
}

interface IdOptions {
  id: string;
}

interface IdDataOptions extends IdOptions, DataOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTrackerDomainsResponse(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.trackerDomains)) {
    return payload.trackerDomains;
  }

  return payload;
}

export function registerTrackerDomainCommands(program: Command): void {
  const trackerDomains = program.command("tracker-domains").description("Tracker domain operations");

  trackerDomains
    .command("list")
    .description("List all tracker domains")
    .action(async function action(this: Command) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.trackerDomains.listPath);
        await printJson(
          success({
            trackerDomains: normalizeTrackerDomainsResponse(response),
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trackerDomains
    .command("get")
    .description("Get tracker domain by ID")
    .requiredOption("--id <id>", "Tracker domain ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.get<unknown>(ENDPOINTS.trackerDomains.getPath(options.id));
        await printJson(
          success({
            trackerDomain: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trackerDomains
    .command("create")
    .description("Create a new tracker domain")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.trackerDomains.createPath, body);
        await printJson(
          success({
            trackerDomain: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trackerDomains
    .command("update")
    .description("Update an existing tracker domain")
    .requiredOption("--id <id>", "Tracker domain ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.trackerDomains.updatePath(options.id), body);
        await printJson(
          success({
            trackerDomain: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  trackerDomains
    .command("delete")
    .description("Delete a tracker domain")
    .requiredOption("--id <id>", "Tracker domain ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.trackerDomains.deletePath(options.id));
        await printJson(
          success({
            deleted: true,
            id: options.id,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/tracker-domains.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/commands/tracker-domains.ts tests/commands/tracker-domains.test.ts
git commit -m "feat: add tracker-domains command with full CRUD"
```

---

## Task 9: Extend campaigns command with create/update/delete

**Files:**
- Modify: `src/commands/campaigns.ts`
- Create: `tests/commands/campaigns.test.ts`

**Step 1: Write the test file**

Create `tests/commands/campaigns.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/commands/campaigns.test.ts`
Expected: FAIL - create/update/delete commands not found

**Step 3: Update the implementation**

Modify `src/commands/campaigns.ts`:

First, add `resolveDataInput` to the existing imports (line 5-10). Change:
```typescript
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
} from "./helpers.js";
```
To:
```typescript
import {
  createCommandContext,
  getPrintOptions,
  printFailure,
  requireToken,
  resolveDataInput,
} from "./helpers.js";
```

Add these interfaces after the imports:
```typescript
interface DataOptions {
  data?: string;
  file?: string;
}

interface IdOptions {
  id: string;
}

interface IdDataOptions extends IdOptions, DataOptions {}
```

Then add the create, update, delete commands after the existing `get` command (before the closing brace of `registerCampaignCommands`):

```typescript
  campaigns
    .command("create")
    .description("Create a new campaign")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: DataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.post<unknown>(ENDPOINTS.campaigns.createPath, body);
        await printJson(
          success({
            campaign: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  campaigns
    .command("update")
    .description("Update an existing campaign")
    .requiredOption("--id <id>", "Campaign ID")
    .option("--data <json>", "JSON body string")
    .option("--file <path>", "Path to JSON file")
    .action(async function action(this: Command, options: IdDataOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const body = await resolveDataInput(options.data, options.file);
        const response = await context.client.put<unknown>(ENDPOINTS.campaigns.updatePath(options.id), body);
        await printJson(
          success({
            campaign: response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });

  campaigns
    .command("delete")
    .description("Delete a campaign")
    .requiredOption("--id <id>", "Campaign ID")
    .action(async function action(this: Command, options: IdOptions) {
      const command = this;
      try {
        const context = await createCommandContext(command);
        requireToken(context.token);

        const response = await context.client.delete<unknown>(ENDPOINTS.campaigns.deletePath(options.id));
        await printJson(
          success({
            deleted: true,
            id: options.id,
            response,
          }),
          getPrintOptions(command),
        );
      } catch (error) {
        await printFailure(command, error);
      }
    });
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/commands/campaigns.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/commands/campaigns.ts tests/commands/campaigns.test.ts
git commit -m "feat: add create/update/delete to campaigns command"
```

---

## Task 10: Register all new commands in index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Add imports and registrations**

Add imports at the top:

```typescript
import { registerAffiliateNetworkCommands } from "./commands/affiliate-networks.js";
import { registerFlowCommands } from "./commands/flows.js";
import { registerLanderCommands } from "./commands/landers.js";
import { registerOfferCommands } from "./commands/offers.js";
import { registerTrackerDomainCommands } from "./commands/tracker-domains.js";
import { registerTrafficSourceCommands } from "./commands/traffic-sources.js";
```

Add registrations after `registerCampaignCommands(program);`:

```typescript
  registerOfferCommands(program);
  registerLanderCommands(program);
  registerFlowCommands(program);
  registerTrafficSourceCommands(program);
  registerAffiliateNetworkCommands(program);
  registerTrackerDomainCommands(program);
```

**Step 2: Run typecheck**

Run: `bun run check`
Expected: No errors

**Step 3: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: register all new resource commands in CLI"
```

---

## Task 11: Final verification

**Step 1: Build the project**

Run: `bun run build`
Expected: Build succeeds

**Step 2: Test CLI help output**

Run: `bun run dev -- --help`
Expected: Shows all new commands (offers, landers, flows, traffic-sources, affiliate-networks, tracker-domains)

Run: `bun run dev -- offers --help`
Expected: Shows list, get, create, update, delete subcommands

**Step 3: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: final verification and cleanup"
```

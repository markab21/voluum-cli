# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

This repository hosts `voluum-cli`, a community-supported MIT-licensed CLI wrapper for public Voluum APIs.

`voluum-cli` is not an official Voluum product and is not endorsed or supported by Voluum.

## Runtime and Tooling

- Use Bun commands for local development.
- Install dependencies: `bun install`
- Run all tests: `bun test`
- Run a single test file: `bun test tests/reports/query.test.ts`
- Run tests matching a pattern: `bun test --test-name-pattern "mergeReportQuery"`
- Build: `bun run build` (compiles TypeScript → `dist/`)
- Type-check only: `bun run check`
- Run CLI in dev mode: `bun run dev -- reports summary --help`

## Architecture Overview

### Entry Point & Command Structure

`src/index.ts` sets up a Commander.js program with global options (`--baseUrl`, `--token`, `--json`, `--pretty`, `--silent`, `--out`) and registers command groups:

- `auth` — Authentication (login, whoami, logout)
- `campaigns` — Full CRUD for campaigns
- `offers` — Full CRUD for offers
- `landers` — Full CRUD for landers
- `flows` — Full CRUD for flows
- `traffic-sources` — Full CRUD for traffic sources
- `affiliate-networks` — Full CRUD for affiliate networks
- `tracker-domains` — Full CRUD for tracker domains
- `reports` — Reporting operations (breakdown, query, schema, summary, raw)
- `api` — Generic API passthrough (get, post)

Each command group lives in `src/commands/`. All commands build a **CommandContext** via `createCommandContext()` in `src/commands/helpers.ts` — this resolves global options, loads file config, applies the env/CLI/file precedence chain, and returns an authenticated `VoluumClient` instance ready to use.

### CRUD Resource Commands

Seven resource types implement a standardized full CRUD pattern: `campaigns`, `offers`, `landers`, `flows`, `traffic-sources`, `affiliate-networks`, `tracker-domains`.

Each resource exposes 5 subcommands:

- `list` — GET collection (no required options)
- `get --id <id>` — GET single resource by ID
- `create --data <json> | --file <path>` — POST new resource with JSON body
- `update --id <id> --data <json> | --file <path>` — PUT existing resource with JSON body
- `delete --id <id>` — DELETE resource by ID

**Implementation pattern** (consistent across all 7 resources):

1. Call `createCommandContext(command)` to get authenticated client
2. Call `requireToken(context.token)` to ensure authentication
3. For create/update: call `resolveDataInput(options.data, options.file)` to parse JSON body
4. Make typed HTTP call via `context.client.{get|post|put|delete}<T>(ENDPOINTS.{resource}.{path})`
5. Wrap response in `success({ resource: response })` shape
6. Output via `printJson(..., getPrintOptions(command))`
7. Catch errors and route to `printFailure(command, error)`

**Endpoint mapping:** All CRUD commands use the central `ENDPOINTS` object in `src/endpoints.ts`:

- `{resource}.listPath` — collection path string
- `{resource}.getPath(id)` — single resource path function
- `{resource}.createPath` — creation path string
- `{resource}.updatePath(id)` — update path function
- `{resource}.deletePath(id)` — deletion path function

### Data Input Helpers

`src/commands/helpers.ts` provides two helpers for JSON body handling in create/update commands:

- **`readDataFile(filePath: string): Promise<unknown>`** — Reads a file and parses as JSON. Throws with a clear error message if the file doesn't exist or contains invalid JSON.

- **`resolveDataInput(dataOption, fileOption): Promise<unknown>`** — Validates and resolves `--data` vs `--file` options:
  - Throws if both are provided ("Use either --data or --file, not both.")
  - Throws if neither is provided ("Either --data or --file is required.")
  - If `--file`, delegates to `readDataFile()`
  - If `--data`, parses inline JSON string via `parseJsonBody()`

### Config & Auth

Config is stored at `~/.voluum-cli/config.json` (mode 0600). Precedence: CLI flags → `VOLUUM_BASE_URL`/`VOLUUM_TOKEN` env vars → file config. The `auth login` command hits `/auth/session` (email/password) or `/auth/access/session` (access keys) and persists the extracted token. Token extraction in `src/endpoints.ts` checks multiple response path patterns to handle API response variations.

### HTTP Client

`src/client/VoluumClient.ts` provides typed `get<T>()`, `post<T>()`, `put<T>()`, `delete<T>()` methods. It automatically injects `cwauth-token` headers, builds query strings (with array support), and retries with exponential backoff on network errors, HTTP 429, and HTTP 5xx (up to 2 retries, 3 total attempts by default).

### Reports Module

`src/reports/` contains the reports subsystem:
- `query.ts` — parses `--query` (comma-separated `k=v` pairs) and `--query-json`, then merges them
- `schema.ts` — extracts and filters column metadata from report schema responses
- `mapping.ts` — normalizes Voluum column types to generic types (`text`, `integer`, `money`, `percentage`, `boolean`, `duration_seconds`, `unknown`)

The `reports breakdown` command supports preset values (`offer`, `offer-by-campaign`, `flow`, `traffic-source`, `lander`) that compose `--groupBy` and `--filters` for common reporting use cases. Custom queries can be built using `reports query` with full control over groupBy, filters, and columns.

### Output Shape

All commands emit structured output to stdout in **TOON** (Token-Oriented Object Notation) by default — `{ok: true, data: T}` on success or `{ok: false, error: CliError}` on failure. Use `--json` for compact JSON, `--pretty` for pretty-printed JSON (implies `--json`). `--silent` suppresses stdout; `--out <file>` always writes full JSON to a file regardless of format. Exit codes: 0 = success, 1 = expected error, 2 = unexpected error.

### Error Handling

`src/client/errors.ts` defines `VoluumApiError` (includes HTTP status, code, details) and `toCliError()` which normalizes any thrown value into the `{message, code, status, details}` shape used in error output.

## Security Expectations

- Never commit credentials, tokens, or personal API keys.
- Keep local secrets in untracked files (for example `.credentials`) or environment variables.
- Mask tokens in user-facing output and examples.

## Plugin/Marketplace Scope

- `.claude-plugin/marketplace.json` defines the public marketplace catalog.
- `plugins/voluum-cli-assistant` defines the installable plugin with skills for command composition and setup.
- Plugin skills should remain generic, public, and community-maintained.

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

`src/index.ts` sets up a Commander.js program with global options (`--baseUrl`, `--token`, `--pretty`, `--silent`, `--out`) and registers command groups: `auth`, `campaigns`, `reports`, `api`.

Each command group lives in `src/commands/`. All commands build a **CommandContext** via `buildCommandContext()` in `src/commands/helpers.ts` — this resolves global options, loads file config, applies the env/CLI/file precedence chain, and returns an authenticated `VoluumClient` instance ready to use.

### Config & Auth

Config is stored at `~/.voluum-cli/config.json` (mode 0600). Precedence: CLI flags → `VOLUUM_BASE_URL`/`VOLUUM_TOKEN` env vars → file config. The `auth login` command hits `/auth/session` (email/password) or `/auth/access/session` (access keys) and persists the extracted token. Token extraction in `src/endpoints.ts` checks multiple response path patterns to handle API response variations.

### HTTP Client

`src/client/VoluumClient.ts` provides typed `get<T>()`, `post<T>()`, `put<T>()`, `delete<T>()` methods. It automatically injects `cwauth-token` headers, builds query strings (with array support), and retries with exponential backoff on network errors, HTTP 429, and HTTP 5xx (up to 2 attempts by default).

### Reports Module

`src/reports/` contains the reports subsystem:
- `query.ts` — parses `--query` (comma-separated `k=v` pairs) and `--query-json`, then merges them
- `schema.ts` — extracts and filters column metadata from report schema responses
- `mapping.ts` — normalizes Voluum column types to generic types (`text`, `integer`, `money`, `percentage`, `boolean`, `duration_seconds`, `unknown`)

The `reports breakdown` command uses preset query builders (offer, offer-by-campaign, flow, traffic-source, lander) that compose `--groupBy` and `--filters` for common use cases.

### Output Shape

All commands emit JSON to stdout: `{ok: true, data: T}` on success or `{ok: false, error: CliError}` on failure. The `--pretty` flag indents output; `--silent` suppresses stdout; `--out <file>` writes to a file. Exit codes: 0 = success, 1 = expected error, 2 = unexpected error.

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

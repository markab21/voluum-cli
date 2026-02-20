# voluum-cli

`voluum-cli` is community-supported software released under the MIT License. It is not an official Voluum product and is not endorsed or supported by Voluum. It uses publicly documented Voluum APIs.

Lightweight Bun/TypeScript CLI for common Voluum admin and reporting operations.

## Install

```bash
bun install
bun run build
```

Optional local link:

```bash
bun link
```

Then use:

```bash
voluum --help
```

Or run directly without linking:

```bash
node dist/index.js --help
```

## Commands

Global options (available for all commands):

- `--baseUrl <url>` override API base URL
- `--token <token>` override auth token
- `--json` output as compact JSON (default is TOON — required when piping to `jq`)
- `--pretty` output as pretty-printed JSON (implies `--json`)
- `--silent` suppress stdout output
- `--out <file>` write full JSON output to file

Default output format is **TOON** (Token-Oriented Object Notation), a compact human-readable format that is 30–60% smaller than JSON. Use `--json` or `--pretty` for JSON, or `--out` to save full JSON to a file.

### Auth

Login with email/password:

```bash
voluum auth login --email agent@example.com --password 'secret'
```

Login with access keys:

```bash
voluum auth login --accessKeyId '...' --accessKey '...'
```

Who am I:

```bash
voluum auth whoami
```

Logout (clears local stored token):

```bash
voluum auth logout
```

### Campaigns

List campaigns:

```bash
voluum campaigns list
```

Get campaign by id:

```bash
voluum campaigns get --id 12345
```

### Reports

Summary report:

```bash
voluum reports summary \
  --from 2026-02-01T00:00:00Z \
  --to 2026-02-18T00:00:00Z \
  --groupBy campaign \
  --filters country=US,device=mobile
```

Raw report:

```bash
voluum reports raw \
  --from 2026-02-01T00:00:00Z \
  --to 2026-02-18T00:00:00Z \
  --limit 100
```

Flexible query (sorting, pagination, custom columns):

```bash
voluum reports query \
  --path /report/conversions \
  --query from=2026-02-01,to=2026-02-18,limit=100,offset=100,sort=visits,direction=desc
```

Schema introspection:

```bash
voluum reports schema \
  --path /report/conversions \
  --query from=2026-02-01,to=2026-02-18 \
  --groupable \
  --type money
```

Predefined breakdowns:

```bash
# By offer
voluum reports breakdown \
  --by offer \
  --from 2026-02-11T22:00:00.000Z \
  --to 2026-02-18T22:00:00.000Z

# Offer performance in campaign context
voluum reports breakdown \
  --by offer-by-campaign \
  --campaignId <campaign-id> \
  --from 2026-02-11T22:00:00.000Z \
  --to 2026-02-18T22:00:00.000Z
```

### Generic API passthrough

GET:

```bash
voluum api get /campaign --query status=active,limit=50
```

POST:

```bash
voluum api post /report --body '{"from":"2026-02-01T00:00:00Z","to":"2026-02-18T00:00:00Z"}'
```

## Claude Plugin Marketplace

This repository includes a community marketplace and plugin for Claude Code.

- Marketplace file: `.claude-plugin/marketplace.json`
- Plugin: `plugins/voluum-cli-assistant`
- Skills included:
  - `voluum-command-composer`
  - `voluum-setup-install`

Quick install from Claude Code:

```shell
/plugin marketplace add markab21/voluum-cli
/plugin install voluum-cli-assistant@voluum-community-tools
```

Detailed docs:

- `docs/public/plugin-marketplace.md`
- `docs/public/plugin-install.md`
- `docs/public/voluum-api-notes.md`

## Configuration

Config file: `~/.voluum-cli/config.json`

```ts
export interface VoluumCliConfig {
  baseUrl?: string;
  token?: string;
  tokenCreatedAt?: string;
  tokenExpiresAt?: string;
  lastLoginEmail?: string;
}
```

Override priority:

1. CLI flags
2. Environment variables (`VOLUUM_BASE_URL`, `VOLUUM_TOKEN`)
3. Local config file

The CLI attempts to persist config with file mode `0600` on Unix-like systems.

## Endpoint mapping

Edit `src/endpoints.ts` to adjust routes, auth header name, and token extraction fields.

## Live API Notes

These were validated against a real Voluum account:

- `from`/`to` must be rounded to the nearest hour (`HH:00:00Z`), otherwise Voluum returns `400 BAD_REQUEST`.
- Use `--query-json` when any value contains commas (for example `columns` lists), because `--query` parses comma-separated `k=v` pairs.
- For large accounts, small `limit` values can produce partial views; raise `limit` for full-window analysis before ranking campaigns.
- Sort requires **two separate params**: `sort=<field>` and `direction=asc|desc`. The combined `sort=field:desc` syntax causes a `400 INVALID_QUERY` error.

## Development

```bash
bun run dev -- --help
bun test
bun run build
```

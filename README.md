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
npm link
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
- `--pretty` pretty JSON output
- `--silent` suppress stdout output
- `--out <file>` write JSON output to file

### Auth

Login with email/password:

```bash
voluum auth login --email agent@example.com --password 'secret'
```

Login with access keys:

```bash
voluum auth login --accessId '...' --accessKey '...'
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

Query-first reporting:

```bash
voluum reports query \
  --path /report/conversions \
  --query from=2026-02-01,to=2026-02-18,limit=100,offset=100,sort=visits:desc
```

Schema introspection:

```bash
voluum reports schema \
  --path /report/conversions \
  --query from=2026-02-01,to=2026-02-18 \
  --groupable \
  --type money
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

## Development

```bash
bun run dev -- --help
bun test
bun run build
```

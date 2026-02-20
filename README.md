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

### Data Input for Create and Update

Create and update commands require a JSON body via one of:

- `--data '<json>'` — inline JSON string
- `--file <path>` — path to a JSON file (useful for complex or large payloads)

These flags are mutually exclusive; exactly one is required.

```bash
# Inline JSON
voluum offers create --data '{"name":"My Offer","url":"https://example.com/offer"}'

# From file
voluum offers create --file ./offer.json

# Update requires both --id and data
voluum offers update --id <id> --file ./updated-offer.json
```

### Campaigns

List campaigns:

```bash
voluum campaigns list
```

Get campaign by ID:

```bash
voluum campaigns get --id <id>
```

Create campaign:

```bash
voluum campaigns create --data '{"name":"My Campaign"}'
voluum campaigns create --file ./campaign.json
```

Update campaign:

```bash
voluum campaigns update --id <id> --data '{"name":"Updated Name"}'
voluum campaigns update --id <id> --file ./campaign.json
```

Delete campaign:

```bash
voluum campaigns delete --id <id>
```

### Offers

List all offers:

```bash
voluum offers list
```

Get offer by ID:

```bash
voluum offers get --id <id>
```

Create offer:

```bash
voluum offers create --data '{"name":"My Offer","url":"https://example.com"}'
voluum offers create --file ./offer.json
```

Update offer:

```bash
voluum offers update --id <id> --data '{"name":"Updated Offer"}'
voluum offers update --id <id> --file ./offer.json
```

Delete offer:

```bash
voluum offers delete --id <id>
```

### Landers

List all landers:

```bash
voluum landers list
```

Get lander by ID:

```bash
voluum landers get --id <id>
```

Create lander:

```bash
voluum landers create --data '{"name":"My Lander","url":"https://example.com/lp"}'
voluum landers create --file ./lander.json
```

Update lander:

```bash
voluum landers update --id <id> --data '{"name":"Updated Lander"}'
voluum landers update --id <id> --file ./lander.json
```

Delete lander:

```bash
voluum landers delete --id <id>
```

### Flows

List all flows:

```bash
voluum flows list
```

Get flow by ID:

```bash
voluum flows get --id <id>
```

Create flow:

```bash
voluum flows create --data '{"name":"My Flow"}'
voluum flows create --file ./flow.json
```

Update flow:

```bash
voluum flows update --id <id> --data '{"name":"Updated Flow"}'
voluum flows update --id <id> --file ./flow.json
```

Delete flow:

```bash
voluum flows delete --id <id>
```

### Traffic Sources

List all traffic sources:

```bash
voluum traffic-sources list
```

Get traffic source by ID:

```bash
voluum traffic-sources get --id <id>
```

Create traffic source:

```bash
voluum traffic-sources create --data '{"name":"My Traffic Source"}'
voluum traffic-sources create --file ./traffic-source.json
```

Update traffic source:

```bash
voluum traffic-sources update --id <id> --data '{"name":"Updated Traffic Source"}'
voluum traffic-sources update --id <id> --file ./traffic-source.json
```

Delete traffic source:

```bash
voluum traffic-sources delete --id <id>
```

### Affiliate Networks

List all affiliate networks:

```bash
voluum affiliate-networks list
```

Get affiliate network by ID:

```bash
voluum affiliate-networks get --id <id>
```

Create affiliate network:

```bash
voluum affiliate-networks create --data '{"name":"My Network"}'
voluum affiliate-networks create --file ./network.json
```

Update affiliate network:

```bash
voluum affiliate-networks update --id <id> --data '{"name":"Updated Network"}'
voluum affiliate-networks update --id <id> --file ./network.json
```

Delete affiliate network:

```bash
voluum affiliate-networks delete --id <id>
```

### Tracker Domains

List all tracker domains:

```bash
voluum tracker-domains list
```

Get tracker domain by ID:

```bash
voluum tracker-domains get --id <id>
```

Create tracker domain:

```bash
voluum tracker-domains create --data '{"domain":"track.example.com"}'
voluum tracker-domains create --file ./domain.json
```

Update tracker domain:

```bash
voluum tracker-domains update --id <id> --data '{"domain":"new.example.com"}'
voluum tracker-domains update --id <id> --file ./domain.json
```

Delete tracker domain:

```bash
voluum tracker-domains delete --id <id>
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

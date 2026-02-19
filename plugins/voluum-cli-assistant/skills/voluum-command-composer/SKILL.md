---
description: Compose safe, copy/paste-ready voluum-cli commands from user intent using public API workflows.
---

`voluum-cli` is community-supported software released under the MIT License. It is not an official Voluum product and is not endorsed or supported by Voluum. It uses publicly documented Voluum APIs.

## What this skill does

- Translates user intent into concrete `voluum` commands.
- Builds reporting queries (`summary`, `breakdown`, `query`, `schema`, `raw`) with correct flags.
- Provides troubleshooting for auth and API request errors.

## Rules

- Never ask users to paste raw secrets into chat.
- Never output full tokens; mask values in examples.
- Prefer environment variables and stored config over inline secrets.
- Validate required fields before giving final commands.

---

## Auth

```bash
# Access key login (preferred — longer-lived than email/password sessions)
voluum auth login --accessKeyId '<KEY_ID>' --accessKey '<ACCESS_KEY>'

# Email/password login
voluum auth login --email you@example.com --password '<PASSWORD>'

# Check current token
voluum auth whoami
```

Set env vars in `~/.zshrc` or `~/.bashrc` to avoid re-logging in:
```bash
export VOLUUM_BASE_URL=https://api.voluum.com
export VOLUUM_TOKEN=<your-token>
```

---

## Campaigns

```bash
voluum campaigns list
voluum campaigns get --id '<CAMPAIGN_ID>'
```

---

## Reports — Key Patterns

### Sorting (IMPORTANT)

The Voluum API uses **two separate params** for sorting. The combined `sort=field:direction`
syntax does NOT work and returns a 400 error.

**Correct:**
```
sort=revenue    direction=desc
sort=visits     direction=asc
sort=conversions direction=desc
```

**Wrong (will 400):**
```
sort=revenue:desc   ← invalid
```

### `--query` vs `--query-json`

- `--query` parses comma-separated `key=value` pairs: good for simple params
- `--query-json` accepts a JSON object: required when a value contains commas (e.g. `columns=a,b,c`)
- They merge; `--query-json` wins on duplicate keys

**Example combining both:**
```bash
voluum reports query \
  --query "from=2026-02-01T00:00:00.000Z,to=2026-02-18T00:00:00.000Z,groupBy=campaignId,limit=20" \
  --query-json '{"sort":"revenue","direction":"desc","columns":"campaignId,campaignName,revenue,conversions,cr,epc"}'
```

### Output size

- Large requests (200+ rows, wide columns list) can produce 50KB+ responses.
- Use `--out <file>` to capture full output: stdout is capped at ~24k chars.
- Strip noise: output already omits `columnMappings` and internal metadata fields.

---

## Report Commands

### Summary (top-level totals + groupBy)

```bash
# 7-day campaign summary
voluum reports summary \
  --from 2026-02-12T00:00:00.000Z \
  --to   2026-02-19T00:00:00.000Z \
  --groupBy campaign
```

### Query (flexible — use for sorting, custom columns, pagination)

```bash
# Top 20 campaigns by revenue
voluum reports query \
  --query-json '{
    "from":      "2026-02-12T00:00:00.000Z",
    "to":        "2026-02-19T00:00:00.000Z",
    "groupBy":   "campaignId",
    "limit":     20,
    "sort":      "revenue",
    "direction": "desc",
    "columns":   "campaignId,campaignName,revenue,conversions,cr,epc,ap"
  }'

# Top 20 offers by revenue
voluum reports query \
  --query-json '{
    "from":      "2026-02-12T00:00:00.000Z",
    "to":        "2026-02-19T00:00:00.000Z",
    "groupBy":   "offerId",
    "limit":     20,
    "sort":      "revenue",
    "direction": "desc",
    "columns":   "offerId,offerName,revenue,conversions,cr,epc,ap"
  }'

# Save large results to file
voluum reports query \
  --query-json '{"from":"...","to":"...","groupBy":"campaignId","limit":200,"sort":"revenue","direction":"desc"}' \
  --out /tmp/campaigns.json
```

### Breakdown (presets: offer | offer-by-campaign | flow | traffic-source | lander)

```bash
# Traffic source distribution
voluum reports breakdown --by traffic-source \
  --from 2026-02-12T00:00:00.000Z \
  --to   2026-02-19T00:00:00.000Z \
  --limit 50

# Offer breakdown for a specific campaign
voluum reports breakdown --by offer-by-campaign \
  --campaignId '<CAMPAIGN_ID>' \
  --from 2026-02-12T00:00:00.000Z \
  --to   2026-02-19T00:00:00.000Z

# Lander performance
voluum reports breakdown --by lander \
  --from 2026-02-12T00:00:00.000Z \
  --to   2026-02-19T00:00:00.000Z \
  --limit 20

# Flow breakdown
voluum reports breakdown --by flow \
  --from 2026-02-12T00:00:00.000Z \
  --to   2026-02-19T00:00:00.000Z
```

### Schema discovery

```bash
# List all groupable columns for a report
voluum reports schema \
  --query "from=2026-02-01T00:00:00.000Z,to=2026-02-18T00:00:00.000Z,groupBy=campaignId" \
  --groupable

# Find money columns with search
voluum reports schema \
  --query "from=2026-02-01T00:00:00.000Z,to=2026-02-18T00:00:00.000Z,groupBy=campaignId" \
  --type money --search revenue

# Full param catalog
voluum reports schema \
  --query "from=2026-02-01T00:00:00.000Z,to=2026-02-18T00:00:00.000Z,groupBy=campaignId" \
  --with-query-params
```

### Raw conversions

```bash
voluum reports raw \
  --from 2026-02-12T00:00:00.000Z \
  --to   2026-02-19T00:00:00.000Z \
  --limit 50
```

---

## Useful groupBy values

| groupBy value      | What it groups by          |
|--------------------|---------------------------|
| `campaignId`       | Individual campaigns       |
| `offerId`          | Individual offers          |
| `trafficSourceId`  | Traffic sources            |
| `flowId`           | Flows                      |
| `landerId`         | Landers                    |

Note: `country` is **not** a valid groupBy for `/report`. Use `/report/conversions` or
check `voluum reports schema --groupable` for valid groupBy fields per endpoint.

---

## Sortable fields (common)

`revenue`, `visits`, `conversions`, `clicks`, `cr`, `epc`, `ap`, `profit`, `roi`, `cv`

Always pair with `direction=asc` or `direction=desc`.

---

## Passthrough API

```bash
voluum api get /campaign --query status=active,limit=50
voluum api get /traffic-source
```

---

## Error handling

| Error | Cause | Fix |
|-------|-------|-----|
| `401` | Token expired or missing | `voluum auth login` or set `VOLUUM_TOKEN` |
| `400 INVALID_QUERY` | Bad groupBy, invalid column, or wrong sort syntax | Check `--groupable` schema; use `sort=field` + `direction=asc\|desc` separately |
| `400 PARAMETER_MISSING` | Missing required param (e.g. `groupBy` for schema) | Add the missing param |
| `429` / `5xx` | Rate limit or server error | Smaller date range, lower limit, or wait and retry |

---

## Notes from production use

- **81%+ suspicious visits** is normal for this account's traffic mix; don't panic.
- Filters like `trafficSourceId=<id>` in the query are accepted but may be silently ignored
  by some report endpoints — verify by checking if `totalRows` changes.
- The `columns=...` param is accepted but Voluum returns all fields anyway; it's cosmetic.
- **Default output is TOON** (Token-Oriented Object Notation) — compact, 30-60% fewer tokens than JSON. Use `--json` for compact JSON or `--pretty` for pretty-printed JSON.
- `--json` is required when piping to `jq` or other JSON tools.
- `--out <file>` always writes full output regardless of format.

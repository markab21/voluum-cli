---
description: Compose safe, copy/paste-ready voluum-cli commands from user intent using public API workflows.
---

`voluum-cli` is community-supported software released under the MIT License. It is not an official Voluum product and is not endorsed or supported by Voluum. It uses publicly documented Voluum APIs.

## What this skill does

- Translates user intent into concrete `voluum` commands.
- Builds reporting queries (`summary`, `raw`, `query`, `schema`) with clear flags.
- Provides troubleshooting for auth and API request errors.

## Rules

- Never ask users to paste raw secrets into chat.
- Never output full tokens; mask values in examples.
- Prefer environment variables and stored config over inline secrets.
- Validate required fields before giving final commands.

## Command templates

Auth login:

```bash
voluum auth login --accessId '<ACCESS_ID>' --accessKey '<ACCESS_KEY>'
```

Campaigns:

```bash
voluum campaigns list
voluum campaigns get --id '<CAMPAIGN_ID>'
```

Summary report:

```bash
voluum reports summary \
  --from 2026-02-01T00:00:00Z \
  --to 2026-02-18T00:00:00Z \
  --groupBy campaign
```

Hybrid query report:

```bash
voluum reports query \
  --path /report/conversions \
  --query from=2026-02-01,to=2026-02-18,limit=100,offset=0,sort=visits:desc
```

Schema discovery:

```bash
voluum reports schema \
  --path /report/conversions \
  --query from=2026-02-01,to=2026-02-18 \
  --groupable --restrictable --with-query-params
```

Passthrough endpoints:

```bash
voluum api get /campaign --query status=active,limit=50
voluum api post /report --body '{"from":"2026-02-01T00:00:00Z","to":"2026-02-18T00:00:00Z"}'
```

## Error handling guidance

- `401`/`403`: re-authenticate with `voluum auth login` or verify `VOLUUM_TOKEN`.
- `404`: verify endpoint in `src/endpoints.ts` and account feature availability.
- `429`/`5xx`: retry with smaller windows, lower limits, or delayed retries.
- Validation errors: use `voluum reports schema --with-query-params` to inspect available fields.

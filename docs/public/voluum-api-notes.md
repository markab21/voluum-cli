# Voluum API Notes (Live Validation)

`voluum-cli` is community-supported software released under the MIT License. It is not an official Voluum product and is not endorsed or supported by Voluum. It uses publicly documented Voluum APIs.

## Time format requirement

Voluum report endpoints require hour-rounded timestamps. Use values like:

- `2026-02-18T22:00:00.000Z`

Avoid minute/second timestamps like:

- `2026-02-18T22:43:19.717Z`

The latter returns `400 BAD_REQUEST` with an invalid time format message.

## Query encoding notes

- `--query` expects comma-separated `key=value` pairs.
- If a value itself contains commas (for example `columns=campaignId,campaignName,revenue`), prefer `--query-json`.

Example:

```bash
voluum reports query --query-json '{"from":"2026-02-11T22:00:00.000Z","to":"2026-02-18T22:00:00.000Z","groupBy":"campaign","columns":"campaignId,campaignName,revenue"}'
```

## Large account analysis

For ranking tasks (for example top campaign by revenue), avoid small limits on large datasets.

- Use a high `limit` (for example `20000` if needed).
- Aggregate rows by `campaignId` before computing rankings and trends.

Example:

```bash
voluum reports query --query 'from=2026-02-11T22:00:00.000Z,to=2026-02-18T22:00:00.000Z,groupBy=campaign,limit=20000'
```

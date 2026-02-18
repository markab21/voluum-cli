---
description: Install and configure voluum-cli on Linux/macOS, with Windows support via WSL.
---

`voluum-cli` is community-supported software released under the MIT License. It is not an official Voluum product and is not endorsed or supported by Voluum. It uses publicly documented Voluum APIs.

## Supported environments

- Linux
- macOS
- Windows through WSL (Ubuntu/Debian recommended)

## Prerequisites

- `git`
- Bun runtime (`bun --version`)
- Network access to `https://api.voluum.com`

## Install from source

```bash
git clone https://github.com/markab21/voluum-cli.git
cd voluum-cli
bun install
bun run build
```

Optional global CLI link:

```bash
npm link
voluum --help
```

Without linking:

```bash
node dist/index.js --help
```

## Configure authentication

Login using Voluum access credentials:

```bash
voluum auth login --accessId '<ACCESS_ID>' --accessKey '<ACCESS_KEY>'
```

Or use environment variables:

```bash
export VOLUUM_BASE_URL="https://api.voluum.com"
export VOLUUM_TOKEN="<SESSION_TOKEN>"
```

Token storage path:

- `~/.voluum-cli/config.json`

## First-run verification

```bash
voluum --help
voluum reports --help
voluum reports query --path /report --query from=2026-02-17T00:00:00Z,to=2026-02-18T00:00:00Z,groupBy=campaign,limit=5 --pretty
```

## Troubleshooting

- `bun: command not found`: install Bun and restart shell.
- `voluum: command not found`: rerun `npm link` or use `node dist/index.js`.
- `No auth token found`: run `voluum auth login` or set `VOLUUM_TOKEN`.
- WSL users: run install/auth commands inside WSL shell, not PowerShell CMD.

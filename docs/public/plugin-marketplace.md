# Claude Plugin Marketplace

`voluum-cli` is community-supported software released under the MIT License. It is not an official Voluum product and is not endorsed or supported by Voluum. It uses publicly documented Voluum APIs.

This repository publishes a Claude Code marketplace catalog at:

- `.claude-plugin/marketplace.json`

Marketplace name:

- `voluum-community-tools`

Included plugin:

- `voluum-cli-assistant`

## Install from GitHub

From Claude Code:

```shell
/plugin marketplace add markab21/voluum-cli
/plugin install voluum-cli-assistant@voluum-community-tools
```

## Update marketplace and plugin

```shell
/plugin marketplace update voluum-community-tools
/plugin update voluum-cli-assistant@voluum-community-tools
```

## Local validation

If the CLI is available:

```bash
claude plugin validate .
```

Or in Claude Code:

```shell
/plugin validate .
```

## Plugin source layout

- Marketplace catalog: `.claude-plugin/marketplace.json`
- Plugin manifest: `plugins/voluum-cli-assistant/.claude-plugin/plugin.json`
- Skills:
  - `plugins/voluum-cli-assistant/skills/voluum-command-composer/SKILL.md`
  - `plugins/voluum-cli-assistant/skills/voluum-setup-install/SKILL.md`

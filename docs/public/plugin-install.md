# Install and Use voluum-cli Plugin

`voluum-cli` is community-supported software released under the MIT License. It is not an official Voluum product and is not endorsed or supported by Voluum. It uses publicly documented Voluum APIs.

## Install plugin

```shell
/plugin marketplace add markab21/voluum-cli
/plugin install voluum-cli-assistant@voluum-community-tools
```

## Available skills

- `voluum-command-composer`: turns user goals into `voluum` CLI commands.
- `voluum-setup-install`: installs/configures the CLI on Linux/macOS (Windows via WSL).

## Example usage

Ask Claude Code to use the setup skill:

- “Use the `voluum-setup-install` skill to install voluum-cli on this machine.”

Ask Claude Code to compose a report query:

- “Use `voluum-command-composer` to build a conversions report command for yesterday with limit 100.”

## Notes

- Do not paste full secrets into chat.
- Prefer environment variables and local config storage.
- Use `voluum auth logout` to clear stored local token.

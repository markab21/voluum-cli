# Repository Notes

This repository hosts `voluum-cli`, a community-supported MIT-licensed CLI wrapper for public Voluum APIs.

`voluum-cli` is not an official Voluum product and is not endorsed or supported by Voluum.

## Runtime and Tooling

- Use Bun commands for local development.
- Install dependencies with `bun install`.
- Run tests with `bun test`.
- Build with `bun run build`.

## Security Expectations

- Never commit credentials, tokens, or personal API keys.
- Keep local secrets in untracked files (for example `.credentials`) or environment variables.
- Mask tokens in user-facing output and examples.

## Plugin/Marketplace Scope

- `.claude-plugin/marketplace.json` defines the public marketplace catalog.
- `plugins/voluum-cli-assistant` defines the installable plugin.
- Plugin skills should remain generic, public, and community-maintained.

# LUMICAP Studio + ChatGPT App

LUMICAP is a local-first screen communication PWA for Windows, Ubuntu,
Android, and iOS. The same deployment also exposes a ChatGPT App-compatible
MCP endpoint.

## Public routes

- `/studio/` — installable LUMICAP PWA
- `/mcp` — stateless MCP Streamable HTTP endpoint
- `/api/health` — service health
- `/privacy/`, `/terms/`, `/support/` — submission and support pages
- `/.well-known/openai-apps-challenge` — OpenAI Apps domain verification

## ChatGPT App tools

- `create_capture_task` prepares a bug report, manual, UI review,
  translation/summary, or support-reply task.
- `open_lumicap_studio` returns the public PWA URL and installation guidance.

Both tools are read-only, idempotent, and non-destructive. Captures and images
are not stored by the MCP service or sent to third-party AI services
automatically.

## Development

```bash
npm install
npm run dev
npm test
```

`npm test` creates the production vinext build and verifies the PWA redirect,
health endpoint, MCP initialization, tool metadata, UI resource CSP, validation,
and structured tool output.

## Domain verification

Set `OPENAI_APPS_CHALLENGE` to the exact value issued by the OpenAI Apps
submission flow. The deployment returns it as plain text from
`/.well-known/openai-apps-challenge`.

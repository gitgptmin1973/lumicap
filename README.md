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

## Keyboard shortcuts

- `Ctrl/⌘ + Shift + 1` — capture screen
- `Ctrl/⌘ + Shift + 2` — start or stop recording
- `Ctrl/⌘ + Shift + 3` — open AI tasks
- `Ctrl/⌘ + Shift + 4` — generate a guide
- `Ctrl/⌘ + Shift + 5` — import an image
- `Ctrl/⌘ + Shift + S` — export PNG
- `V P A R H T B` — select, pen, arrow, rectangle, highlight, text, blur
- `Ctrl/⌘ + Z` — undo
- `?` — open the complete shortcut list
- `Esc` — stop recording or close a dialog

Shortcuts work while the PWA or browser tab is active. Browser security does
not allow a normal PWA to register OS-global shortcuts while it is inactive.

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

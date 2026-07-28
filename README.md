# LUMICAP Studio + ChatGPT App

LUMICAP is a local-first, three-layer screen communication platform:

1. Web / PWA for editing, AI tasks, documents, sharing, and mobile use.
2. A least-privilege Chrome Manifest V3 extension for full-page capture.
3. A Windows / Ubuntu Native Companion for PrintScreen, global shortcuts,
   delayed capture, camera/microphone recording, and MP4 output.

The same deployment exposes a ChatGPT App-compatible MCP endpoint.

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
- `get_lumicap_platform` returns the correct components, downloads,
  shortcuts, and approval boundary for a selected device.

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
The Native Companion registers `PrintScreen`, `Ctrl+Shift+1`,
`Ctrl+Shift+2`, and `Ctrl+Shift+3` after the operating system grants access.

## Distribution

- Platform source and build instructions: `platform/`
- Reproducible Windows and Ubuntu jobs: `.github/workflows/lumicap-platform-build.yml`
- Public packages: <https://github.com/gitgptmin1973/lumicap/releases/tag/v1.0.0>

The Windows 1.0.0 package is currently unsigned and may trigger SmartScreen.
The Ubuntu BuildKit creates AppImage and deb files on Ubuntu or in GitHub
Actions.

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

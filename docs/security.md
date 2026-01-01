### Security practices in Screencap

This document describes the concrete security controls implemented in the Electron app and how to extend them safely without regressing the security posture.

### Security goals

- **Contain renderer compromise**: assume renderer code can be exploited; prevent it from reaching OS capabilities directly.
- **Minimize data exfiltration paths**: restrict what the renderer can read (local files) and where it can navigate/connect.
- **Treat IPC as a security boundary**: validate inputs and limit which renderer(s) can call privileged functionality.
- **Keep changes maintainable**: use small, explicit allowlists instead of complex policy engines.

### Renderer isolation and window hardening

The main window is configured to reduce the renderer’s privileges and remove high-risk features.

- **Sandboxing and isolation** (`electron/main/app/window.ts`)
  - `sandbox: true`
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `webSecurity: true`
  - `webviewTag: false`
- **No webviews**
  - `did-attach-webview` is prevented to avoid embedding untrusted content.
- **No runtime permission prompts**
  - The session denies all permission checks and requests.

### Navigation and external links

The renderer is not allowed to navigate away from the app.

- **Blocked navigation/redirects** (`electron/main/app/window.ts`)
  - `will-navigate` and `will-redirect` are intercepted.
  - Only URLs that match the app’s own origin are allowed.
  - Other URLs are blocked and, if they are `http(s)`, are opened via the OS browser.
- **Blocked popups**
  - `setWindowOpenHandler` always returns `{ action: 'deny' }`.
  - Only `http(s)` URLs are opened externally.

### Local file access (`local-file://`) hardening

The renderer displays screenshots and favicons via a custom protocol (`local-file://`). This is an attack surface because it can become a general-purpose local file reader if not restricted.

- **Directory allowlist** (`electron/main/app/protocol.ts`)
  - `local-file://` only serves files under `app.getPath('userData')/screenshots` (via `getScreenshotsDir()`).
  - Requests are rejected if the resolved path is outside the allowed root (including symlink escape attempts).
  - Only `GET` is supported.

If you add a new type of asset that must be readable from the renderer, prefer placing it under the screenshots root or explicitly extending the allowlist in the protocol handler.

### IPC security boundary

IPC handlers run in the privileged main process. They are treated as an explicit security boundary.

- **Trusted sender allowlist** (`electron/main/ipc/secure.ts`, `electron/main/app/window.ts`)
  - IPC invokes are accepted only from the trusted renderer webContents id(s).
  - The main window registers its `webContents.id` as trusted during creation.
- **Runtime argument validation** (`electron/main/ipc/validation.ts`)
  - All IPC invoke arguments are validated with `zod`.
  - Schemas enforce types, bounds, and reasonable size limits to reduce abuse (DoS via huge payloads, path injection, etc.).
- **Handlers are registered via a single wrapper**
  - `secureHandle(channel, schema, handler)` combines sender checks and runtime validation.
- **Reduced IPC surface area**
  - Unused storage mutation channels were removed (`storage:insert-event`, `storage:update-event`) to reduce attack surface.

### Preload API hardening

The preload exposes a minimal bridge API via `contextBridge`.

- **No direct `ipcRenderer` access from the renderer**
  - Renderer only calls `window.api.*`, not `ipcRenderer` directly.
- **Event subscription allowlist** (`electron/preload/index.ts`)
  - `api.on(...)` only allows channels listed in `IpcEvents`.
  - Attempts to subscribe to arbitrary channels throw an error.

### Content Security Policy (CSP)

The renderer uses a CSP that is strict in production but compatible with HMR in development.

- **CSP is injected at build time**
  - `index.html` contains a placeholder CSP value.
  - `electron.vite.config.ts` replaces it with:
    - a permissive dev CSP that allows Vite HMR (`unsafe-eval`, websocket connections to localhost)
    - a stricter production CSP that removes `unsafe-eval`, blocks object embeds, disallows framing, and limits connections to `self`

If you introduce new resource types (e.g., additional network endpoints), update the CSP injection logic rather than loosening it globally.

### Network fetch guardrails (favicons)

Favicon fetching is a controlled network surface.

- **Protocol allowlist**: only `http(s)` URLs are fetched.
- **Local/private network blocking**: requests to `localhost` and common private IPv4 ranges are rejected.
- **Timeouts**: requests are aborted after a small fixed timeout.
- **Size limits**: HTML discovery responses are size-capped; icon downloads are size-capped.

Implementation lives in `electron/main/features/favicons/FaviconService.ts`.

### Secrets and sensitive data

- **API key at rest**
  - Settings store encrypts the API key using Electron `safeStorage` when available (`electron/main/infra/settings/SettingsStore.ts`).
- **No secrets in the renderer bundle**
  - The renderer should never embed API keys or privileged endpoints.

### How to extend securely

Use this checklist for changes that cross security boundaries.

- **New IPC channel**
  - Add the channel name in `electron/shared/ipc.ts`.
  - Implement the handler using `secureHandle(...)`.
  - Add a `zod` args schema in `electron/main/ipc/validation.ts`.
  - Expose it from `electron/preload/index.ts` via the `api` object.
  - If it is an event channel, add it to `IpcEvents` and it becomes subscribable; otherwise, it must not be subscribable from the renderer.
- **New local asset that renderer must display**
  - Prefer writing it under `getScreenshotsDir()` (or a subdirectory of it).
  - If not possible, extend the `local-file://` allowlist with an explicit root and keep path escape protections.
- **New external URL handling**
  - Never allow renderer navigation to arbitrary origins.
  - Prefer external browsing via `shell.openExternal` with strict `http(s)` validation.
- **New network fetching feature**
  - Add timeouts, size caps, and scheme allowlists.
  - Avoid accessing localhost/private ranges unless explicitly required by design.


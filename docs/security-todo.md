### Security TODO

Last updated: 2025-12-31

### Scope

Screencap is a local-first Electron app that captures screenshots and stores them in SQLite + the filesystem. Optional AI classification sends a screenshot to OpenRouter.

### Threat model (high level)

- Local malware running as the same macOS user
- Renderer compromise (XSS / supply-chain / UI injection)
- Malicious or vulnerable dependency (build-time or runtime)
- Unsafe network egress (AI + favicon fetching + any future integrations)
- Lost/stolen device (offline disk access)

### Current controls (baseline)

- Renderer isolation: sandbox + `contextIsolation`, `nodeIntegration: false`, no webviews
- Navigation blocked to non-app origins, popups denied
- CSP injected (prod is stricter than dev)
- `local-file://` protocol allowlists reads to screenshots directory (realpath + subpath checks)
- IPC is a security boundary: trusted sender allowlist + runtime `zod` validation
- OpenRouter API key encrypted at rest when Electron `safeStorage` is available
- Retention cleanup deletes events + screenshots older than `retentionDays`

### TODO backlog

### P0 (must-have for meaningful security)

- [ ] Encrypt screenshots at rest (filesystem) with per-file AEAD and keys in macOS Keychain
- [ ] Encrypt sensitive DB content at rest (DB encryption or field-level encryption for: screenshot paths, queue image_data, context_json)
- [ ] Remove/limit renderer-to-network exfil primitives:
  - [ ] Replace `window.api.llm.classify(imageBase64)` with a main-process-only flow (renderer passes `eventId`, main reads image from disk and enforces policy)
  - [ ] Add strict size/rate limits on any IPC that can trigger network I/O
- [ ] Add “App Lock” for UI access (Touch ID / password) with time-based re-lock and key eviction
- [ ] Add “Secure mode” setting: hard-disable all network features (OpenRouter, favicon fetch, external links) at runtime
- [ ] Make retention non-bypassable:
  - [ ] Run retention before first UI render when `retentionDays` is reduced
  - [ ] Add a “Delete data now” action (wipe all events + screenshots)

### P1 (reduce attack surface and blast radius)

- [ ] Remove `file:` from renderer CSP if not required; keep screenshots via `local-file://` only
- [ ] Tighten `img-src` allowlist (remove unused remote domains; keep only what is required)
- [ ] Add IPC allowlist review:
  - [ ] Ensure every IPC handler has strict validation and bounded outputs
  - [ ] Remove unused channels from preload surface
- [ ] Add explicit network allowlist layer in main process (one module that gates all `fetch`)
- [ ] Reduce sensitive data persistence:
  - [ ] Avoid storing OpenRouter request payloads anywhere persistent
  - [ ] Minimize queue retention; delete failed items aggressively
- [ ] Add safe logging rules:
  - [ ] Never log screenshot paths + content together
  - [ ] Never log URLs with tokens/query params

### P2 (defense in depth)

- [ ] Add integrity checks for local-file served assets (optional hash verification)
- [ ] Add screenshot redaction options (blur regions, exclude apps/hosts fully, per-policy)
- [ ] Add automated security tests:
  - [ ] Protocol handler path traversal / symlink escape tests
  - [ ] IPC sender spoof tests (untrusted window)
  - [ ] Retention cleanup correctness tests
- [ ] Supply chain hardening:
  - [ ] Dependency audit automation (CI)
  - [ ] Reproducible build notes + signing verification steps
- [ ] Operational hardening:
  - [ ] Document minimum macOS security posture (FileVault, user separation)
  - [ ] Release checklist: notarization, hardened runtime, auto-update validation

### Notes

- Local malware running as the same user can read any plaintext screenshots; meaningful protection requires encryption at rest with keys not trivially accessible.
- Renderer compromise is assumed; the goal is to ensure it cannot become a generic file reader or a generic network exfil client.


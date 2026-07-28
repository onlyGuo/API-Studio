<div align="center">

# API Studio

**A local-first API workspace with an IDE mindset.**

Build, organize, automate, and inspect HTTP APIs without sending your workspace data to a cloud service.


<img src="./docs/images/api-studio-icon.png" alt="API Studio icon" width="88" />

[简体中文](./README_CN.md) · [Features](#features) · [Screenshots](#screenshots) · [Getting started](#getting-started)

<img src="./docs/images/hero.png" alt="API Studio in dark and light themes" width="100%" />

[![Local First](https://img.shields.io/badge/data-local--first-22a06b?style=flat-square)](#local-first-by-design)
[![Electron](https://img.shields.io/badge/Electron-34-47848f?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Monaco Editor](https://img.shields.io/badge/editor-Monaco-007acc?style=flat-square&logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)

</div>

API Studio is a desktop API debugging tool built with Electron and Vue 3. Its compact, IDEA-inspired interface keeps projects, environments, reusable automation scripts, requests, and responses in one focused workspace. It supports regular HTTP requests, file uploads, and both standard and non-standard streaming responses.

The defining principle is simple: **your workspace is not an online account**. Projects are stored on your device and are only moved when you explicitly export or import them. API Studio does not require sign-in, cloud synchronization, or a hosted workspace.

> [!IMPORTANT]
> Local-first describes API Studio's workspace storage. Requests you choose to send still travel to the target API, and their privacy is governed by that endpoint and your network environment.

## Why API Studio?

- **Private by default** — project definitions, environments, scripts, and request collections remain on the local machine.
- **IDE-style workflow** — a dense desktop layout, project switcher, searchable request tree, resizable panes, and remembered workspace sizes.
- **Real streaming support** — inspect standard SSE events, `data:` line streams, NDJSON, JSON sequences, and raw text as they arrive.
- **Reusable automation** — turn a login or bootstrap request into a script, extract a JSON value, cache it for a defined lifetime, and reference it from environment values.
- **Built for inspection** — Monaco-powered request and response editors, formatted/raw views, response metadata, tests, and cURL generation.
- **Consistent on every platform** — light and dark themes with custom menus, selects, switches, radio buttons, checkboxes, ranges, and scrollbars rather than native-looking fragments.

## Features

### Projects and portable data

- Every project has its own UUID and isolated interfaces, environments, variables, headers, and scripts.
- Create, switch, rename, duplicate, delete, import, and export projects from the top project menu.
- Export a project as a readable `.api-studio.json` file.
- Import multiple projects at once. Name collisions are resolved as `Project (1)`, `Project (2)`, and so on while preserving project isolation.
- Existing API Forge local data is detected and migrated when API Studio starts.

### Request collections

- Organize requests in a searchable tree with nested folders.
- Create, rename, recursively duplicate, move, and delete folders and requests.
- Configure method, URL, query parameters, authentication, headers, body, pre-request script, tests, and per-request settings.
- Authentication modes: Bearer Token, Basic Auth, and API Key in a header or query parameter.
- Body modes: JSON, plain text, `application/x-www-form-urlencoded`, and `multipart/form-data`.
- Upload one or more files with custom field names alongside regular multipart fields.
- Control timeout, redirect handling, certificate validation, and stream parsing mode per request.

### Environments, variables, and shared headers

- Create multiple environments and switch the active environment from the application header.
- Define variables once and reference them with `{{variableName}}`, including nested references.
- Configure shared headers such as `Authorization`, tenant IDs, trace IDs, or content negotiation values.
- Resolve conflicts explicitly: an interface header can override a same-name shared header or be appended as an additional value.
- Environment values can consume values produced by automation scripts, making cached login tokens available to every request.

### Automation scripts

Scripts are specialized requests that automatically turn a response into a reusable value. A typical example is a login request that extracts `data.token` and exposes it to the active environment.

- Create and reuse multiple scripts inside each project.
- Configure the script request with the same request workbench used by normal interfaces.
- Select a JSON field or object from the response using a path.
- Name the extracted variable and use it through `{{name}}` interpolation.
- Set a cache lifetime to avoid unnecessary repeated login or bootstrap calls.
- Manually refresh a cached value at any time, even while it is still valid.

### Monaco-powered editing and tests

- Monaco Editor is used for JSON/text bodies, pre-request scripts, test scripts, and response content.
- Pre-request scripts expose `pm.environment`, `pm.variables`, and `pm.request`.
- Test scripts expose `pm.response`, `pm.test`, and a focused `pm.expect` API.
- Test results are shown with individual pass/fail status after the response completes.
- Editor font size and other workspace preferences can be adjusted in Settings.

```javascript
// Pre-request script
pm.environment.set('timestamp', Date.now())
```

```javascript
// Response test
pm.test('status is 200', () => {
  pm.expect(pm.response.code).to.equal(200)
})
```

> API Studio provides a compact Postman-style scripting surface; it is not a drop-in implementation of the complete Postman Runtime API.

### HTTP and streaming responses

- Desktop requests are sent by the Electron main process, so browser CORS restrictions do not block API debugging.
- Inspect status, response time, response size, final URL, headers, formatted body, raw body, and generated cURL.
- Stop an in-flight streaming request without closing the workspace.
- Automatically detect streaming responses or force a parser when a server uses a non-standard content type.
- Parse standard SSE fields: `event`, `data`, `id`, and `retry`.
- Parse data-only line streams, NDJSON/JSON Sequence payloads, and arbitrary raw text chunks.
- View streams as collapsible event cards, data-focused rows, or raw content. JSON event payloads are formatted for inspection.

## Screenshots

### Request workbench

The interface tree and request/response workbench share one compact desktop layout. Every main divider is resizable, and pane sizes are remembered.

<img src="./docs/images/interface-dark.jpg" alt="API Studio request workbench" width="100%" />

### Environments and shared headers

Manage environment-scoped variables and common headers. Requests can override or append conflicting header values explicitly.

<img src="./docs/images/environment-dark.jpg" alt="API Studio environment editor" width="100%" />

### Reusable automation scripts

Build login and bootstrap requests, extract a JSON value, cache it, and refresh it on demand.

<img src="./docs/images/scripts-dark.jpg" alt="API Studio automation scripts" width="100%" />

### Visual SSE inspection

Streaming events arrive incrementally as collapsible cards. Event name, ID, timing, payload type, and formatted data stay readable while the connection is live.

<img src="./docs/images/sse-stream-dark.jpg" alt="API Studio SSE stream inspector" width="100%" />

### Settings and themes

Switch theme, change Monaco font size, set the default timeout, and tune workspace density from a functional settings panel.

<img src="./docs/images/settings-dark.jpg" alt="API Studio settings" width="100%" />

## Local-first by design

API Studio has no account system and no cloud workspace. The Electron application persists its workspace as a local JSON document in Electron's platform-specific `userData` directory. Browser preview uses browser local storage for development only.

| Data or action | Where it goes |
| --- | --- |
| Projects, request trees, environments, and scripts | Local application data directory |
| Panel sizes and visual preferences | Local application/browser storage |
| Exported projects | Only the file location selected by the user |
| Imported projects | Read only from files selected by the user |
| HTTP request content | The target endpoint selected by the user |

API Studio does not include a synchronization backend or telemetry client. If a project contains secrets, protect the exported JSON file just as you would protect a `.env` file: do not commit it, share it publicly, or store it unencrypted.

## Getting started

### Prerequisites

- Node.js 22.12 or newer
- npm

### Run in development

```bash
git clone https://github.com/onlyguo/api-studio.git
cd api-studio
npm install
npm run dev
```

### Build and run the desktop app

```bash
npm run build
npm start
```

You can also run `npm run preview` for a browser preview. In that mode, requests use the browser's `fetch` implementation and are subject to CORS; use the Electron desktop app for normal API debugging and file-path uploads.

## Automated releases

Pushing any Git tag starts the [release workflow](./.github/workflows/release.yml). Tags such as `v0.1.0`, `beta`, `nightly-2026-07-28`, and tags containing `/` are all accepted. After all jobs succeed, GitHub Actions creates a release with SHA-256 checksums and these packages:

- macOS universal DMG and ZIP for Intel and Apple Silicon, signed with Developer ID, notarized by Apple, and stapled
- Windows x64 NSIS installer
- Linux x64 AppImage and Debian package

The macOS job intentionally fails instead of publishing an unsigned build when signing credentials are absent. Add these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` certificate |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_ID` | Apple ID associated with the Developer account |
| `APPLE_PASSWORD` | Apple ID app-specific password, not the account password |

```bash
# macOS: copy each encoded file into its corresponding GitHub secret
base64 -i DeveloperIDApplication.p12 | pbcopy
```

Create a release with any tag name:

```bash
git tag nightly-2026-07-28
git push origin nightly-2026-07-28
```

The tag name controls the GitHub Release name; the application and installer version still come from `package.json`, because desktop package formats require a valid application version. Never commit certificates or passwords. electron-builder imports `APPLE_CERTIFICATE` into its own temporary keychain, so the existing `KEYCHAIN_PASSWORD` secret is not required by this workflow. `APPLE_PASSWORD` must be an app-specific password created at appleid.apple.com.

## Technology

| Layer | Technology |
| --- | --- |
| Desktop runtime | Electron 43 |
| Application UI | Vue 3 + TypeScript |
| Build tooling | Vite 6 |
| Code and payload editing | Monaco Editor |
| Icons | Lucide |
| Persistence | Local Electron `userData` JSON / browser local storage |

## Project status

API Studio is currently at `0.1.0` and under active development. The current workspace is functional, but exported data formats and the focused scripting API may evolve before a stable release. Back up important project exports when upgrading during early development.

## Contributing

Issues and pull requests are welcome. For bug reports, include your operating system, whether the issue occurs in Electron or browser preview, and a minimal reproducible request with secrets removed.

- [Source code](https://github.com/onlyguo/api-studio)
- [Issue tracker](https://github.com/onlyguo/api-studio/issues)

---

<div align="center">
Built for developers who want a capable API workspace without putting their workspace in someone else's cloud.
</div>

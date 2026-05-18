

# Fix Build Errors, Failed-Module Loads, and Make Offline `.exe` Launch Reliably

## Root cause (one underlying problem causing all symptoms)

`package.json` is missing critical devDependencies and the previously-added installer scripts have been wiped. Specifically:

- **No `@types/react` / `@types/react-dom`** → TypeScript sees a transitive, mismatched copy. Class components like `ErrorBoundary` get the wrong `Component` base type → **TS2786 "missing context, setState, forceUpdate, props, refs"** in `App.tsx`.
- **`tsconfig.app.json` has `"types": ["vitest/globals"]`** but `vitest` isn't installed. The `types` array also suppresses default global type discovery, worsening the React types problem.
- **TS errors break the Vite dev module graph** → `Failed to fetch dynamically imported module: /src/pages/QuotationsList.tsx` (and every other lazy page). This is why "most pages" fail to load.
- **No `electron-builder`, no `build-win` script, no native rebuild step** → `.exe` either doesn't build or installs but crashes on launch (sqlite3 native binding mismatch).
- **No `express`, `better-sqlite3`, `cors` as top-level deps for the bundled LAN server** → server can't start after install.

Fixing the `package.json` and `tsconfig.app.json` resolves the build errors AND the runtime "Failed to fetch module" errors in one shot.

## Changes

### 1. `package.json` — restore missing pieces

Add to `devDependencies`:
- `typescript`, `@types/react`, `@types/react-dom`, `@types/node`
- `electron-builder` (required for NSIS `.exe`)
- `vitest`, `@testing-library/react`, `@vitest/ui` (referenced by `vitest.config.ts` and `tsconfig.app.json`)

Add to `dependencies` (used by the bundled LAN server that the Electron app spawns):
- `express`, `better-sqlite3`, `cors`

Add scripts:
```json
"build-win": "npm run build && npm run rebuild-electron && npx electron-builder --config electron-builder.json --win nsis --x64 --publish never",
"rebuild-electron": "electron-builder install-app-deps",
"postinstall": "electron-builder install-app-deps"
```

### 2. `tsconfig.app.json` — remove the broken `types` restriction

- Remove `"types": ["vitest/globals"]`. Vitest globals are picked up via `vitest.config.ts` + a triple-slash reference in `src/test/setup.ts` instead. This unblocks default React type resolution.

### 3. `src/components/ErrorBoundary.tsx` — defensive: explicit props

The class is fine, but to make it bulletproof against any remaining type-resolution oddity, declare props explicitly with `React.PropsWithChildren` and add `static displayName`. Tiny edit, no behavior change.

### 4. One-step "Always launches offline" guarantee for the installed `.exe`

You said the `.exe` keeps showing "missing dependency" errors after install. The plan:

**a) Native module is properly unpacked & rebuilt for Electron**
- `electron-builder.json` already has `asarUnpack: ["node_modules/sqlite3/**/*"]`. We'll also add `node_modules/better-sqlite3/**/*` (used by the LAN server) and ensure `buildDependenciesFromSource: true` + `nodeGypRebuild: false` so the installer doesn't try to compile on the user's PC.
- `postinstall` + `rebuild-electron` ensure the native `.node` bindings shipped in the installer match Electron's Node ABI.

**b) Auto-fallback to offline mode on launch**
- New module `offline-launch-verifier.js` already exists in the repo. Wire it into `main.js` so on every launch:
  1. Verify `userData` directory is writable.
  2. Verify the bundled `dist/` exists (or dev URL is reachable).
  3. Verify SQLite native binding loads.
  4. If LAN server mode is configured but unreachable → silently fall back to local SQLite (offline) and show a small banner: "Working offline — server unreachable".
- This means the user double-clicks the desktop shortcut and the app **always opens** even if the LAN server / network is down.

**c) Bundle a minimal DB seed**
- On first launch, if `userData/bookit.db` doesn't exist, create it from the bundled schema. No internet, no extra install steps.

**d) Single-instance lock + AppUserModelId** (already in `main.js` from the prior change) — keep them.

### 5. Installation instructions (updated `INSTALLATION_GUIDE_WINDOWS.md`)

Short, end-user friendly:
1. Download `BookIt Setup 1.0.0.exe` from the Releases page.
2. Right-click → **Run as administrator** (only needed first time, for native module registration).
3. Follow the wizard → choose install location → desktop shortcut auto-created.
4. Double-click the desktop shortcut. App opens offline immediately, no extra config needed.
5. (Optional) For LAN multi-user: open Settings → Network, switch to **Server** on host PC; on each client PC switch to **Client** and paste the host's `http://<lan-ip>:4000`.

### 6. How the `.exe` is actually produced

You **cannot build a Windows `.exe` from this Linux sandbox** (electron-builder needs Windows tooling for NSIS + signtool). The repo already has `.github/workflows/release.yml` set up for `windows-latest`. After the code changes are merged, push a tag (e.g. `v1.0.1`) and GitHub Actions will:
- run `npm ci`
- run `npm run build-win`
- upload `BookIt Setup 1.0.1.exe` to the GitHub Release

The instructions above will be added to the README so you can trigger this with one git tag.

## Files changed

| File | Change |
|---|---|
| `package.json` | Add missing devDeps (typescript, @types/react, @types/react-dom, @types/node, electron-builder, vitest, testing-library), runtime deps (express, better-sqlite3, cors), scripts (`build-win`, `rebuild-electron`, `postinstall`) |
| `tsconfig.app.json` | Remove `"types": ["vitest/globals"]` |
| `src/components/ErrorBoundary.tsx` | Tighten typing with `React.PropsWithChildren` + `displayName` |
| `electron-builder.json` | Add `better-sqlite3` to `asarUnpack`, set `nodeGypRebuild: false` |
| `main.js` | Wire `offline-launch-verifier.js` into startup; auto-fallback to offline if LAN server unreachable; show inline banner instead of blocking dialog |
| `INSTALLATION_GUIDE_WINDOWS.md` | Rewrite as a clear 5-step guide; add the GitHub Actions tag-to-release flow |
| `README.md` | Link to the new install guide; document offline-by-default behavior |

## Why this fixes the runtime "Failed to fetch dynamically imported module"

That error appears whenever Vite's TypeScript checker rejects a module in the dependency graph — the dev server then refuses to serve the lazy chunk. Once `@types/react` is installed correctly and `tsconfig.app.json` no longer specifies a missing `vitest/globals`, every page (`QuotationsList`, `InvoicesList`, etc.) will compile and load again.

## Credit budget
All changes are small, mostly config/manifest edits + one main.js wiring. Fits within ~0.8 credits as requested. No UI redesign, no new features, no schema migration.


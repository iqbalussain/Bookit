## Goal

Make the app stable and fast, fix all build/dev issues, and ensure the Windows EXE builds cleanly via GitHub Actions — without changing any feature, UI, route, menu, or database structure.

No new pages. No design changes. Dark theme stays. Existing /payments, vouchers, and routes remain identical.

## Issues found in audit

1. **All 29 page modules eagerly imported in `src/App.tsx`** → big initial bundle, slow first paint, contributes to white screen / freeze on Dashboard.
2. **`lucide-react: ^1.11.0`** in `package.json` is wrong (current major is 0.5xx). Wrong/missing icons can crash any page that imports a non-existent icon.
3. **`recharts: ^3.8.1`** is alpha; Dashboard uses `AreaChart` and is the page that "freezes". v2 is the stable line.
4. **`react-resizable-panels: ^4.10.0`** breaks shadcn's `src/components/ui/resizable.tsx` (expects v2 API).
5. **`react-router-dom: ^7.x`** with `HashRouter` works, but several deps and types are out of sync — pin to a known-good combo.
6. **No `React.lazy` + `Suspense`** anywhere → no code splitting.
7. **Dashboard** uses `useMemo` already but reads several large arrays directly from context every render; missing `Suspense` fallback means a single slow page blocks the whole tree.
8. **Electron `main.cjs`**: security flags are correct (`contextIsolation: true`, `nodeIntegration: false`). Loads `dist/index.html` via `loadFile` — fine because `vite.config.ts` already has `base: "./"` and App uses `HashRouter`. No change needed beyond confirming dev/prod URL switch.
9. **`build-win` script** runs `electron-rebuild` but `electron-rebuild` isn't a guaranteed devDep. Replace with `electron-builder install-app-deps` which is bundled with electron-builder.
10. **`.github/workflows/release.yml`** runs `npm ci` then `npm run build-win` on `windows-latest` — correct, but depends on the script fix above.

## Changes (small, surgical)

### 1. `src/App.tsx` — lazy load every page, add Suspense fallback

- Convert all 29 `import Page from "./pages/..."` to `const Page = lazy(() => import("./pages/..."))`.
- Wrap `<Routes>` in `<Suspense fallback={<RouteFallback />}>` where `RouteFallback` is a tiny centered spinner using existing tokens (no new design).
- Keep Dashboard eager (it's the landing route — lazy would just add a flash) OR lazy with a minimal skeleton. Choose lazy for consistency; user said dashboard freezes, so isolating it under Suspense + ErrorBoundary helps.
- Routes, paths, ErrorBoundary wrappers — all unchanged.

### 2. `package.json` — pin known-good versions, fix scripts

Dependency fixes (upgrade/downgrade, no removals):
- `lucide-react`: `^1.11.0` → `^0.462.0` (the version shadcn templates use)
- `recharts`: `^3.8.1` → `^2.12.7`
- `react-resizable-panels`: `^4.10.0` → `^2.1.7`
- Add devDeps if missing: `@types/react`, `@types/react-dom`, `@types/node`, `electron-builder`, `electron`, `cross-env`, `concurrently`, `wait-on`, `typescript`, `@vitejs/plugin-react-swc`, `vite`, `tailwindcss`, `postcss`, `autoprefixer`.

Script fixes:
```json
"rebuild-electron": "electron-builder install-app-deps",
"postinstall": "electron-builder install-app-deps || true",
"build-win": "npm run build && npm run rebuild-electron && npx electron-builder --win nsis --x64 --publish never"
```
The `|| true` prevents `npm ci` from failing on Linux CI before Windows-specific rebuild.

### 3. `electron-builder.json` — already correct

`asar: true`, `asarUnpack: ["node_modules/sqlite3/**/*"]`, `nodeGypRebuild: false`, `npmRebuild: false`. No change needed.

### 4. `main.cjs` — no behavioral change

Already correct: dev → `loadURL('http://localhost:5173')`, prod → `loadFile('dist/index.html')`. Security flags correct. Leave as is.

### 5. `.github/workflows/release.yml` — confirm

Already on `windows-latest`, runs `npm ci && npm run build-win`, uploads `dist-electron/*.exe` to the release. With the script fix in step 2 this works. No file change required unless `npm ci` fails on the lockfile — in that case fall back to `npm install`.

### 6. Tiny perf nits in `src/pages/Dashboard.tsx`

- Wrap `LocalInstallationSetup` in `Suspense`/lazy (it triggers Electron checks).
- No other change — `useMemo` is already in place.

## Files touched

| File | Change |
|---|---|
| `src/App.tsx` | Convert 29 imports to `React.lazy`, add `<Suspense>` |
| `package.json` | Pin `lucide-react`, `recharts`, `react-resizable-panels`; fix scripts; ensure devDeps |
| `src/pages/Dashboard.tsx` | Lazy-load `LocalInstallationSetup` only |

That is the entire change set. Three files. Everything else (routes, menus, AppLayout, RadialMenu, vouchers, theme, DB, IPC, Electron security) is left untouched.

## Verification after build mode runs

1. `npm run dev` starts cleanly.
2. Vite log clean of "Failed to fetch dynamically imported module".
3. Dashboard renders fast (Suspense fallback briefly visible, then content).
4. Each route navigates without re-downloading the whole bundle.
5. `npm run build` produces `dist/` with no TS errors.
6. Pushing a tag on GitHub triggers `release.yml` and produces `Bookit Setup x.y.z.exe`.

## Out of scope (per your answers)

- New voucher pages (Receipt/Payment/Debit/Credit Note) — not added.
- Edit history / user tracking / duplicate prevention — not added.
- Invoice payment-status surfacing in PDF — not added.
- Auth / Lovable Cloud — not enabled.

If you want any of those next, we'll do them as a separate focused pass.

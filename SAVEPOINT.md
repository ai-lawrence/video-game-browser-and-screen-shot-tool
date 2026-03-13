# Savepoint — 2026-03-13 (v1.3.3 Session)

## Current Version

`v1.3.3` — tagged, pushed to GitHub. Portable `.exe` uploaded as GitHub Release asset at:
`https://github.com/ai-lawrence/video-game-browser-and-screen-shot-tool/releases/tag/v1.3.3`

---

## What Was Done This Session

### 1. Game Plugin Browser (Main Feature)

A full plugin system for installing and managing game-specific prompt packs and themes.

**New files:**

| File | Purpose |
|---|---|
| `src/shared/plugin-types.ts` | `PluginManifest`, `PluginPrompt`, `PluginTheme` type definitions |
| `src/main/PluginManager.ts` | Main-process plugin manager: load/install/uninstall from `data/plugins/`, IPC handlers |
| `src/renderer/src/contexts/PluginContext.tsx` | React context: installed plugins, active plugin, registry fetch, CSS variable theming |
| `src/renderer/src/components/PluginBrowser/PluginBrowser.tsx` | Modal with Installed + Browse tabs; lazy-loaded |
| `src/renderer/src/components/PluginBrowser/PluginCard.tsx` | Card: icon, name, game badge, tags, action buttons |
| `src/renderer/src/components/PluginBrowser/pluginBrowser.css` | Dark-themed CSS; supports `--plugin-primary` variable override |

**Modified files:**
- `src/renderer/src/App.tsx` — wrapped in `<PluginProvider>`, lazy-loads `<PluginBrowser>`
- `src/renderer/src/components/Sidebar.tsx` — plugin button at bottom, shows active plugin name

**Plugin manifest format:**
```json
{
  "id": "apex-legends-pack",
  "name": "Apex Legends Pack",
  "version": "1.0.0",
  "author": "you",
  "description": "...",
  "game": "Apex Legends",
  "tags": ["fps", "battle-royale"],
  "prompts": [{ "id": "ring", "title": "Ring Strats", "text": "..." }],
  "theme": { "primary": "#e25822" }
}
```

Plugins are stored in `data/plugins/<id>/manifest.json` (portable, next to the exe).

### 2. E2E Tests Updated

- Added 6 new Playwright tests for the Plugin Browser to `e2e/app.spec.ts`
- **29 / 29 tests pass** in 6.4 s

### 3. GitHub Releases — Automated Portable Exe Delivery

- **Problem**: Exes are 123–129 MB, over GitHub's 100 MB git limit — cannot be committed directly
- **Solution**: `.github/workflows/release.yml` — GitHub Actions workflow that:
  - Triggers on any `v*` tag push
  - Builds the portable exe on `windows-latest`
  - Uploads it as a GitHub Release asset automatically
- v1.3.3 exe was manually uploaded this session via `gh release create`

### 4. README Updated

- Added `🧩 Game Plugin Browser` section under v1.3.3
- Added Usage step 8 (plugin workflow)
- Updated Tech Stack to note lazy-loaded code splitting

### 5. Version & Git

- `package.json` bumped to `v1.3.3`
- Commit: `ae22dd6  feat: add Game Plugin Browser (v1.3.3)`
- Commit: `55d5f86  ci: add GitHub Actions release workflow`
- Tag `v1.3.3` pushed to origin

---

## Key Files Modified (This Session)

| File | What Changed |
|---|---|
| `src/shared/plugin-types.ts` | **NEW** — shared type definitions |
| `src/main/PluginManager.ts` | **NEW** — main-process plugin CRUD + IPC |
| `src/renderer/src/contexts/PluginContext.tsx` | **NEW** — React context for plugin state |
| `src/renderer/src/components/PluginBrowser/*` | **NEW** — modal, card, CSS (lazy chunk) |
| `src/renderer/src/App.tsx` | Plugin provider + lazy browser modal |
| `src/renderer/src/components/Sidebar.tsx` | Plugin button added |
| `e2e/app.spec.ts` | +6 plugin browser tests |
| `.github/workflows/release.yml` | **NEW** — auto-release workflow |
| `README.md` | v1.3.3 plugin section added |
| `package.json` | Version → 1.3.3 |

---

## Release Workflow (for next agent)

```bash
# Standard release flow going forward:
npm version X.Y.Z --no-git-tag-version
git add -A
git commit -m "feat: ..."
git tag vX.Y.Z
git push origin main --tags
# → GitHub Actions automatically builds + uploads portable exe to GitHub Releases
```

---

## Known State

- Git: ✅ clean — `main` at `55d5f86`, tagged `v1.3.3`, pushed to origin
- TypeScript: ✅ zero errors (`tsc --noEmit` passes)
- Build: ✅ portable `.exe` produced clean (129 MB, signed)
- E2E: ✅ 29/29 Playwright tests pass
- GitHub Release: ✅ v1.3.3 exe live at GitHub Releases

---

## Remaining / Future Work

- [ ] Test sidebar clickthrough fix in-game (full-screen borderless)
- [ ] Add waveform scrubbing / click-to-seek in AudioTrimmer
- [ ] Host a real `plugins/registry.json` on GitHub so the Browse tab fetches live plugins
- [ ] Consider persisting sidebar collapse state
- [ ] UI overhaul (Stitch/nano-banana-2 designs explored in prior session, not yet implemented)

# Savepoint — 2026-03-12

## Current Version
`v1.3.1` — version bumped; portable exe built clean.

## What Was Done This Session

### 1. Full UI Redesign
- **Design system**: CSS variables for cyber/teal palette (`--primary: #25f4f4`, `--surface: #102222`, `--bg-dark: #080c0c`)
- **Glassmorphism** throughout — `backdrop-filter: blur(16px)`
- **Sidebar** expanded from 60px icon strip → 256px labeled nav rail
  - Branding at top: "AI Overlay+" / "Gaming Suite"
  - Section headers: ENGINES · CAPTURE · AUDIO · DATA
- **Toast**, **SavedPrompts**, **trimmer.css** — restyled to match design system

### 2. AudioTrimmer Waveform Visualizer
- Real-time canvas waveform rendered via WebAudio API
- Teal bar-chart style (`rgba(37, 244, 244, 0.55)`) with DPR scaling
- File: `src/renderer/src/components/AudioTrimmer.tsx`

### 3. Sidebar Width Bug Fix
- `App.tsx`: container width offset updated from `60` → `256` to match expanded sidebar

### 4. Sidebar Clickthrough Bug Fix ✅
- **Root cause**: `.sidebar` had `-webkit-app-region: drag` — OS consumed mouse events at system level, so `setIgnoreMouseEvents(false)` was never called when hovering sidebar background
- **Fix**: Removed `drag` region from `main.css`; added `onMouseEnter={() => setIgnoreMouseEvents(false)}` directly to sidebar `<div>` in `Sidebar.tsx`

### 5. README Updated
- Added UI redesign section, waveform detail, bug fixes section

---

## Key Files Modified
| File | What Changed |
|------|-------------|
| `src/renderer/src/assets/main.css` | Full design token system; removed sidebar drag region |
| `src/renderer/src/components/Sidebar.tsx` | 256px nav rail; onMouseEnter fix |
| `src/renderer/src/components/AudioTrimmer.tsx` | Waveform canvas visualizer |
| `src/renderer/src/App.tsx` | Sidebar width offset 60→256 |
| `src/renderer/src/assets/trimmer.css` | Visual consistency tweaks |
| `README.md` | Updated with all new features |

---

## Known State
- Dev server: ✅ running (`npm run dev`)
- TypeScript: ✅ zero errors
- Clickthrough: ✅ fixed
- Window dragging: handled by `.move-handle` in main content area (sidebar is no longer a drag region)

## Potential Next Steps
- [ ] Test sidebar clickthrough fix in-game (full-screen borderless)
- [ ] Version bump to v1.3.1 or tag v1.3.0 release
- [ ] Build portable `.exe` (`npm run build:win`)
- [ ] Add waveform scrubbing / click-to-seek in AudioTrimmer
- [ ] Consider persisting sidebar collapse state

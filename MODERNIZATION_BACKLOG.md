# Aperture Science — Modernization Backlog

Tracking the fix-and-modernize effort approved 2026-05-19.
Each top-level commit is one checkbox; sub-tasks track per-file work.

**Scope decisions in effect:**
- All three variants kept in sync (`portal/`, `portal2/`, `portal2/portal1style/`)
- One logical change per commit
- Splash copy: in-universe ("INITIALIZE TEST CHAMBER PROTOCOL — PRESS [SPACE] OR CLICK TO BEGIN")
- Local commits only; pushing deferred
- AIU sidecars updated in the same commit as the source files
- Preserved: visual aesthetic, `cake = { ... }` object pattern, audio formats, three-variant structure

---

## Phase 1 — Baseline (user-side verification)

- [ ] Open all three pages in current Chrome + Firefox, capture pre-change behavior
- [ ] Confirm whether `file://` works for audio or `python3 -m http.server` is needed
- [ ] Note any regressions to check against after fixes

---

## Phase 2 — Tier 1 functional fixes

### Commit 2.1 — Splash screen + autoplay gating
- [x] Add splash overlay markup to `portal/index.html`
- [x] Add splash overlay markup to `portal2/index.html`
- [x] Add splash overlay markup to `portal2/portal1style/index.html`
- [x] Gate `cake.init()` behind splash dismissal in `portal/cake.js`
- [x] Gate `cake.initMusicPlayer()`/`cake.init()` behind splash dismissal in `portal2/cake.js`
- [x] Gate `cake.init()` behind splash dismissal in `portal2/portal1style/cake.js`
- [x] Update 6 AIU sidecars (3 HTML + 3 JS) with new sha1 + invariants/gotchas
- [x] Commit 2.1 to git (`ccd53c5`, preceded by bootstrap commit `c590f46`)

### Commit 2.2 — Replace string-form `setTimeout` with closure form
- [x] `portal/cake.js`: convert all `setTimeout("...", n)` to closure form
- [x] `portal2/cake.js`: convert all `setTimeout("...", n)` to closure form
- [x] `portal2/portal1style/cake.js`: convert all `setTimeout("...", n)` to closure form
- [ ] ~~Simplify `processLetter`~~ — deferred to Commit 3.2 (entity-escaping is innerHTML's concern, not eval's)
- [x] Update 3 AIU sidecars (replace string-form gotcha with note about setTimeout 3-arg form)
- [ ] Commit 2.2 to git (pending)

### Commit 2.3 — Drop `cake.smash()` tamper trap
- [x] Remove the `if (cake.blinkerTime != 300)` branch in `blink()` — `portal/cake.js`
- [x] Same in `portal2/cake.js`
- [x] Same in `portal2/portal1style/cake.js`
- [x] Update 3 AIU sidecars (sha1 only — smash wasn't documented in gotchas)
- [ ] Commit 2.3 to git (pending)

### Commit 2.4 — Fix `window.onLoad` capitalization
- [x] ~~Subsumed by Commit 2.1~~ — the splash gate replaced both buggy `window.onLoad = setTimeout(...)` lines with proper `DOMContentLoaded` handlers. portal2/cake.js's `window.addEventListener("load", ...)` was likewise replaced. Sidecar work for these files was done in 2.1.

---

## Phase 3 — Tier 2 code quality (no visible behavior change)

### Commit 3.1 — IIFE / module wrap, eliminate implicit globals
- [x] Decided: **IIFE** (modules would break the inline `oninput=cake.setVolume(...)` handler in portal2/index.html unless we also remove inline handlers, which is out of this commit's scope)
- [x] Wrap `portal/cake.js` in IIFE + `'use strict'` + `window.cake = cake`
- [x] Wrap `portal2/cake.js` in IIFE + `'use strict'` + `window.cake = cake`
- [x] Wrap `portal2/portal1style/cake.js` in IIFE + `'use strict'` + `window.cake = cake`
- [x] Eliminate implicit globals (`x` in border-draw loops, `nextChar` in blink, `timeout` in processLyric*)
- [x] Update 3 AIU sidecars (only cake.js sidecars; HTML files untouched this commit)
- [ ] Commit 3.1 to git (pending — headless verification passed, all 3 variants still type lyrics with 23-28 unique chars and zero console errors under strict mode)

### Commit 3.2 — `appendChild(createTextNode())` instead of `innerHTML +=`
- [x] Rewrite `processLetter` in `portal/cake.js` — text node approach
- [x] Same in `portal2/cake.js`
- [x] Same in `portal2/portal1style/cake.js`
- [x] Drop entity-escaping code in `setPicture` (`portal/cake.js`) — uses textContent now, with regex `/ /g → ' '` to preserve ASCII art whitespace
- [x] Update 3 AIU sidecars
- [ ] Commit 3.2 to git (pending — headless verified, 26-29 unique chars typed in 7s, no errors)

### Commit 3.3 — Delete IE compatibility code
- [ ] Remove `checkForIE()` function from `portal2/cake.js`
- [ ] Remove `window.attachEvent` fallback from `portal2/cake.js`
- [ ] Replace conditional `addEventListener`/`attachEvent` with plain `addEventListener`
- [ ] Update 1 AIU sidecar
- [ ] Commit 3.3 to git

### Commit 3.4 — Modernize idioms (`~~vol`, `void(0)`, `var`, `for...in`)
- [ ] `portal2/cake.js`: `~~vol / 100` → `Number(vol) / 100`
- [ ] `portal2/cake.js`: `cake.player.volume !== void(0)` → `!== undefined`
- [ ] All three `cake.js`: `var` → `const`/`let` where safe
- [ ] `portal/cake.js`: `for (var line in curart)` → `for (const line of curart)` (note: `curart` is array)
- [ ] Update 3 AIU sidecars
- [ ] Commit 3.4 to git

---

## Phase 4 — Tier 3 housekeeping

### Commit 4.1 — HTML5 DOCTYPE for `portal/` and `portal2/portal1style/`
- [ ] `portal/index.html`: XHTML 1.0 Strict → `<!DOCTYPE html>`, drop xmlns, drop self-closing slashes on void elements
- [ ] `portal2/portal1style/index.html`: same migration
- [ ] Update 2 AIU sidecars
- [ ] Commit 4.1 to git

### Commit 4.2 — `defer` on script tags (no-op if 3.1 used `type="module"`)
- [ ] Add `defer` to script tags if not already module-loaded
- [ ] Update sidecars if changed
- [ ] Commit 4.2 to git (or skip if redundant)

### Commit 4.3 — Strip vendor prefixes from `portal2/style.css`
- [ ] Drop `-webkit-` / `-moz-` / `-o-` / `-ms-` for keyframes, gradients, transform, user-select, animation, background-size
- [ ] Drop `progid:DXImageTransform.Microsoft.gradient` IE6-9 filter
- [ ] Check `portal2/portal1style/style.css` for same — strip if present
- [ ] Update 1-2 AIU sidecars
- [ ] Commit 4.3 to git

### Commit 4.4 — `viewbox` → `viewBox` in `portal2/index.html`
- [ ] One-character fix on the SVG attribute
- [ ] Update 1 AIU sidecar (the existing gotcha can be removed)
- [ ] Commit 4.4 to git

### Commit 4.5 — `prefers-reduced-motion` block
- [ ] Add `@media (prefers-reduced-motion: reduce)` to `portal2/style.css` pausing `dots_down`, `dots_up`, `buffer`
- [ ] Update 1 AIU sidecar
- [ ] Commit 4.5 to git

### Commit 4.6 (OPTIONAL — discuss first) — Responsive container
- [ ] Wrap `portal2/#container` so it scales below 1080px width
- [ ] Verify desktop aesthetic preserved
- [ ] Update sidecars

---

## Phase 5 — Validation & wrap

- [ ] Open all three pages in Chrome + Firefox; verify splash→click→sync, no console errors, animation timing intact
- [ ] Bump `AI_UNDERSTANDING/_meta.json#last_audit_commit` to new HEAD
- [ ] Bump `last_audit_at` to current ISO timestamp
- [ ] Write CTX_UPDATE summary to `/home/bigfnj/.ai-context/aperturescience.json.update`

---

## Phase 6 — Desktop app (future, separate effort)

Deferred until static page is clean. Likely path: Tauri wrapper (cross-platform, small binary, points at local HTML).
WallpaperEngine accepts HTML5 wallpapers directly (no wrapper needed).
Windows screensaver is a bigger lift but doable.

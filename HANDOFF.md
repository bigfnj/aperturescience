# Session handoff — 2026-05-26 (final)

End-of-session notes for the next person (you, future Claude, or anyone resuming this branch). Living docs that already have detailed info are [`MODERNIZATION_BACKLOG.md`](./MODERNIZATION_BACKLOG.md), [`PHASE6_DESKTOP_APP_PLAN.md`](./PHASE6_DESKTOP_APP_PLAN.md), and [`SMOKE_TEST_PLAN.md`](./SMOKE_TEST_PLAN.md) — this file is the *delta* on top of those.

## Where we are

- Branch `master`, in sync with `origin/master`. Working tree clean.
- AIU sidecars in lockstep with sources; `_meta.json` `last_audit_commit` bumped to current HEAD.
- **Phase 6 Bundles A1–A6 are all closed out.** Plus three smoke-test-driven hotfixes landed mid-session.
- Combined headless harness: **142/142 assertions green** (A3 67/67 + A4 35/35 + A5 40/40).
- Smoke testing in progress — full plan in [`SMOKE_TEST_PLAN.md`](./SMOKE_TEST_PLAN.md). Three items got "re-validate after fix" status from this session's hotfixes.

## What landed this session (full chronology)

**Feature work — 8 commits:**

| Commit | Type | Summary |
| --- | --- | --- |
| [`92d7bb6`](https://github.com/bigfnj/aperturescience/commit/92d7bb6) | feat | A3 verification harness — promote `test/a3-verify.js` + scroll smoke |
| [`73f5f83`](https://github.com/bigfnj/aperturescience/commit/73f5f83) | chore | close out A3 session |
| [`ead285e`](https://github.com/bigfnj/aperturescience/commit/ead285e) | feat | A4 Override Track — IndexedDB audio override + canplaythrough retrofit |
| [`c49898e`](https://github.com/bigfnj/aperturescience/commit/c49898e) | chore | close out A4 session |
| [`1b29cda`](https://github.com/bigfnj/aperturescience/commit/1b29cda) | feat | A5 text colors + A6 last-variant focus + WE runtime sniff + A4 tolerance tighten |
| [`0d33f61`](https://github.com/bigfnj/aperturescience/commit/0d33f61) | chore | close out A5/A6 session |

**Smoke-test-driven hotfixes — 4 commits:**

| Commit | Type | Summary |
| --- | --- | --- |
| [`c22acb8`](https://github.com/bigfnj/aperturescience/commit/c22acb8) | fix | CYCLE mode collapsed `#splash` + credits column bled into ASCII art |
| [`ab73cdd`](https://github.com/bigfnj/aperturescience/commit/ab73cdd) | chore | audit pointer bump |
| [`1b3cddb`](https://github.com/bigfnj/aperturescience/commit/1b3cddb) | fix | chamber 2 dumped to directory listing under WSL file share / file:// |
| [`753ae99`](https://github.com/bigfnj/aperturescience/commit/753ae99) | chore | audit pointer bump |

### A3 — Enrichment Center Credits verification harness (`test/a3-verify.js`)

Promoted from `/tmp/a3-verify.js` into the repo, 67 assertions across launcher UI, autosave, hydration, persistence, mode threshold, CLEAR, `?random=1` redirect, paste truncation, per-variant `cake.js` override behavior across 4 scenarios (EMPTY / SHORT+LOOP / SHORT+STOP / LONG), credits-overflow guard, and real-time scroll smoke.

### A4 — Override Track

User-supplied audio (`.wav` / `.mp3` / `.ogg`) replaces the bundled Portal song. Five stages: prerequisite `canplaythrough` retrofit on [`portal/cake.js`](portal/cake.js) and [`portal2/portal1style/cake.js`](portal2/portal1style/cake.js) (preserving Still Alive's 6.87 s lead-in via `cake.audioStartDelay`); `applyCustomAudio` + `loadCustomAudio` IndexedDB helpers in all 3 cake.js variants; launcher `OVERRIDE TRACK` section with file picker → audio probe → IDB.put pipeline; 35-assertion test harness. WallpaperEngine mode disables the section.

### A5 — Text color modes + A6 last-used variant focus + Decision 3 WE runtime sniff

URL param `?textcolor=` on `portal/` and `portal2/portal1style/` (NOT `portal2/`): `default` / `cycle` / `rainbow` / hex like `%23FF00FF`. Launcher gains a `DISPLAY MODE` section with 4 radios + `<input type="color">`. Chamber click writes `data-target` to `localStorage.aperture.lastVariant`; on load, `focusLastVariant()` focuses the matching chamber so Enter re-launches. WE-mode detection now ORs the URL param with `typeof window.wallpaperPropertyListener !== 'undefined'`. A4 tolerance tightened from ±10 s nominal to ±1.5 s actual decoded duration. New test/a5-verify.js — 40 assertions across 8 suites.

### Hotfix 1 — CYCLE collapsed `#splash` + credits bled into ASCII art

Two visual regressions found during smoke testing:

1. **CYCLE collapsed `#splash`.** `filter: hue-rotate()` on body creates a new containing block for `position: fixed` descendants. `#splash` (position:fixed, inset:0) resolved against body, which has no explicit height — splash collapsed to 0×0 and title was pushed off-screen. Fix: animate the filter on `#lyrics` / `#credits` / `#picture` (all position:absolute, so their filter doesn't affect anyone's containing block).
2. **Long URL credit lines bled into ASCII art.** Credit lines wrapped onto multiple visual lines, exceeding the 28em column. Fix: `overflow: hidden` on `#credits` + `white-space: nowrap` on `#creditstext > *`. Each credit stays on one visual line; long URLs extend horizontally past the right edge and are clipped by the same overflow:hidden.

+8 regression assertions pinned (6 cycle splash + 2 credits overflow).

### Hotfix 2 — Chamber 2 dumped to directory listing under WSL file share

User accessed launcher via `\\wsl.localhost\Ubuntu\...` instead of the HTTP server. Clicking TEST CHAMBER 02 navigated to `../portal2/?autoloop=1` which Edge resolved to the file-share URL — and Edge shows a directory listing instead of auto-serving `index.html` (chamber 01 worked because Edge apparently auto-opens index.html for directories without subdirectories; `portal2/` has the `portal1style/` subdirectory which trips a different code path).

Fix: every in-app navigation now points at `index.html` explicitly (`../portal/index.html?autoloop=1` etc.). Works under HTTP servers, file://, WSL file shares (`\\wsl.localhost`), and Tauri's bundled webview. Regression pinned in `test/a3-verify.js` `expectedTargets` map.

## What's next

### Phase 6 Bundle A7 → A10 (remaining Tier 1 work)

From [`PHASE6_DESKTOP_APP_PLAN.md`](./PHASE6_DESKTOP_APP_PLAN.md) §"Tier 1":

- **A7 — Crossfade between variants in random mode** (~30–60 min). JS opacity transition for the launcher / variant transition; currently a hard cut via `location.assign`. Could be done as a `<body>` overlay div animated over ~1–2 s before navigation. May need cooperative work between cake.js (fade out on ended) and launcher (fade in on load).
- **A8 — Skip-to-end / replay overlay** (~30–60 min). Small button visible after splash dismissal; restarts cycle or skips to credits end. Hooks into `cake.player.currentTime` + `cake.processCreditLines` re-invocation.
- **A9 — Stats overlay** (~30–60 min). Bottom-right text showing variant + elapsed time, toggle with `S` key. Pure UI; no persistence needed.
- **A10 — Hotkeys** (~30–60 min). `F11` fullscreen, `M` mute, `R` restart variant, `N` next variant in random mode, `Esc` returns to launcher.

After A7–A10 finish Tier 1: **Bundle B** (Tauri — **needs explicit user nod before fetching the ~500 MB `cargo-xwin` Windows SDK**), **Bundle C** (WallpaperEngine package), **Bundle D** (close-out docs).

### Smoke testing — continue with [`SMOKE_TEST_PLAN.md`](./SMOKE_TEST_PLAN.md)

User is mid-way through manual smoke testing. Three items at the top of the plan are explicitly flagged for re-validation since they were the bugs that drove this session's hotfixes (credits overflow, CYCLE splash, WSL chamber-2 nav). After those re-test green, the user can continue down the priority list (audio playback, visual rendering, cross-browser, autoloop endurance, WallpaperEngine, edge cases).

## Gotchas to carry forward

*This list is now the canonical project gotcha reference. Add to it as new ones are caught.*

### Layout and CSS

- **`filter` and `transform` on `body` create new containing blocks for position:fixed descendants.** This collapsed `#splash` to 0×0 when CYCLE mode was active. Always target the variant content containers (`#lyrics` / `#credits` / `#picture`) for whole-page visual effects, never `body`.
- **`#credits` requires `overflow: hidden`** to stop long custom credit lines from bleeding into the `#picture` region below. Coupled with `white-space: nowrap` on `#creditstext > *` to keep each credit on one visual line.
- **CSS rules duplicated across [`portal/style.css`](portal/style.css) and [`portal2/portal1style/style.css`](portal2/portal1style/style.css)** for the A5 modes (`:root --text-color`, `@keyframes color-cycle`, the 6-color rainbow palette, prefers-reduced-motion reset). If the palette or animation duration is tuned, **both files must stay in lockstep**.
- **`hue-rotate` on the variant content containers affects everything inside** (ASCII art, borders, lyric text, credit text) — intentional whole-content hue cycling. To exempt a future element, use `filter: none` on it.
- **CSS in [`portal/style.css`](portal/style.css) only applies the cycle to `#picture`** — [`portal2/portal1style/style.css`](portal2/portal1style/style.css) has no `#picture` element, so its selector omits it. Don't copy the rules wholesale between files without checking which IDs exist.

### Navigation and URLs

- **All in-app navigation must point at `index.html` explicitly.** Bare directory URLs (`../portal/?autoloop=1`) break under WSL file share, file://, and possibly Tauri webview because their directory-listing behavior diverges from HTTP servers. Use `../portal/index.html?autoloop=1` everywhere.
- **`supportsTextColor` substring-check order is load-bearing** in [`launcher/launcher.js`](launcher/launcher.js) — `portal2/portal1style/` must be tested BEFORE `portal2/` because the former contains the latter as a substring. Reversing the order silently breaks textcolor for portal2/portal1style/.
- **`portal2/portal1style/` launcher-back path is `../../launcher/index.html`** (two levels up), NOT `../launcher/`. Easy to miscopy from the portal/ variant.
- **`encodeURIComponent('#ff00ff') = '%23ff00ff'`** — the launcher URL-encodes the hex; the variant `URLSearchParams.get()` decodes back to `#ff00ff`. The regex in `applyTextColor` (`/^#[0-9a-fA-F]{6}$/`) requires the leading `#`.

### Initialization order in [`launcher/launcher.js`](launcher/launcher.js)

- **All `var` constants** (`CREDITS_KEY`, `MODE_KEY`, `TEXTCOLOR_KEY`, `CUSTOM_COLOR_KEY`, `LAST_VARIANT_KEY`, `MAX_CHARS`, `LOOP_THRESHOLD`) must be assigned BEFORE the `params = new URLSearchParams(...)` block — both the `?random=1` redirect AND the else-branch reference them via `safeGet`. var hoists the binding but not the value; reordering below would make `safeGet(undefined)` return null silently.
- **`focusLastVariant()` runs LAST** in the DOMContentLoaded else-branch so it wins over any earlier `.focus()` calls. If a future feature autofocuses an input, that input would win unless we reorder — but typically you want the chamber to win for keyboard re-launch.
- **`initOverrideTrack` WE-mode branch returns BEFORE event wiring** so buttons truly no-op in WallpaperEngine mode (not just a CSS dim). WE mode = `?we=1` URL param OR `typeof window.wallpaperPropertyListener !== 'undefined'`.

### Initialization order in [`portal/cake.js`](portal/cake.js) and [`portal2/portal1style/cake.js`](portal2/portal1style/cake.js)

- **`applyTextColor` runs FIRST** in DOMContentLoaded (before `applyCustomCredits` and `applyCustomAudio`). Reads URL param, adds body class or sets `:root` `--text-color`.
- **`applyTextColor` is duplicated** across both cake.js files — same shape, same regex. Update both together. (`portal2/cake.js` does NOT have this function — intentionally excluded.)
- **`cake.audioStartDelay = 0` runs BEFORE `cake.initMusicPlayer(blobUrl)`** in `applyCustomAudio` — reordering or moving to a later async callback means the first iteration of custom audio plays with a 6.87 s lead-in. Load-bearing for `portal/cake.js`.
- **`loadedmetadata` listener bound ONLY when `srcOverride` is truthy** — binding it for the bundled audio too would risk overwriting `cake.creditsMaxTime` with a tiny audio.duration drift.

### IndexedDB and localStorage contract

- **IndexedDB schema shared across launcher + 3 variants:** database `aperture` v1, object store `audio`, key `customAudio`, value `{ blob, filename, durationSec }`. Bumping schema requires bumping all 4 files (launcher.js + 3 cake.js).
- **localStorage namespace is now 5 keys**: `aperture.customCredits`, `aperture.creditsMode`, `aperture.textColorMode`, `aperture.customColor`, `aperture.lastVariant`. Plus IDB `aperture/audio/customAudio`. New features should respect the `aperture.*` namespace.
- **All `localStorage` access goes through `safeGet` / `safeSet` / `safeRemove`** (try/catch swallow exceptions for Safari private mode + storage quota errors). All IDB access goes through `idbOpen` / `idbPutAudio` / `idbGetAudio` / `idbDeleteAudio` (similar wrapping).
- **`loadCustomAudio` has a 1.5 s fallback timer** so if IDB hangs (Firefox private mode can fail to open the DB), the variant falls back to bundled audio rather than sitting forever.

### Misc

- **`var` hoist trap repeats elsewhere** — be careful introducing `var` declarations below their use site. Prefer keeping all `var` declarations at the top of their function/IIFE.
- **Blinker preservation across credit-column resets** in `restartCustomCredits`: `cake.creditsBlinker` is deliberately kept as a long-lived DOM node. The wipe (`innerHTML = ''`) detaches it, then `appendChild` re-attaches — the in-flight `setTimeout(blink, …)` chain captures the same reference and survives.
- **Per-variant natural credit speed**: `portal/` = 63 ms/char; `portal2/` and `portal2/portal1style/` = 33 ms/char.
- **`#picture`** exists in `portal/` only — `portal2/portal1style/` doesn't render ASCII art, so the picture-related selectors don't apply there.

## How to run the verification harness

```bash
# one-time setup per machine
cd /home/bigfnj/projects/aperture-science/test
npm install
npx playwright install chromium

# every run
cd /home/bigfnj/projects/aperture-science
python3 -m http.server 8765 &
node test/a3-verify.js   # 67/67 green
node test/a4-verify.js   # 35/35 green
node test/a5-verify.js   # 40/40 green
kill %1                   # stop server

# or via npm:
cd test && npm run verify   # runs all three serially
```

Exit code = number of failed assertions. Combined green run reports 142/142 in ~30 s.

## Open decisions for next session

- **A7–A10 sequence:** could bundle A7+A8 (both touch variant transition path) and A9+A10 (both pure UI overlays + key handling). Or just do them sequentially in numeric order. Or skip ahead to A10 hotkeys for the quickest UX win.
- **`portal2/cake.js` `audioStartDelay` field:** currently has no field (init() just calls `cake.player.play()` directly). For consistency with portal/ and portal2/portal1style/, we *could* add `cake.audioStartDelay = 0` and route the play() through a setTimeout. Cosmetic; not blocking anything.
- **`SMOKE_TEST_PLAN.md` after A7–A10:** when A7–A10 ship, add their smoke items to the plan (e.g. "crossfade is visually smooth", "Esc returns to launcher", "S key shows stats overlay").
- **Tauri Bundle B trigger:** explicit user nod still needed before fetching the ~500 MB `cargo-xwin` Windows SDK.

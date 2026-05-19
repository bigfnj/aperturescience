# Phase 6 — Desktop App + Wallpaper Plan

Approved 2026-05-19. Pending user feature enhancements before execution begins.

---

## Scope

Three deliverables packaged from the modernized static site (commits ccd53c5 through 3bd9ef6):

1. **Launcher page** — picker UI used by both targets
2. **Tauri desktop app** — cross-platform window wrapping the launcher
3. **WallpaperEngine package** — drop-in folder for Steam's WallpaperEngine
4. **Autoloop support** baked into the three existing variants

Phase 6 does **not** include:
- Windows `.scr` screensaver (deferred — bigger Win32 lift)
- Updates to existing AIU sidecars unless those source files are touched
- Pushing to remote (kept local until user says)

---

## Decisions in effect

| Decision | Value |
| --- | --- |
| Targets | Tauri **and** WallpaperEngine; skip screensaver |
| Variants | All three with a picker, plus a Random option |
| Loop behavior | Autoloop forever; splash visible ~5 s on each cycle then auto-dismiss; click/Space still works for faster manual dismiss |
| Tauri build approach | (b) Cross-compile to Windows from WSL2 via `cargo-xwin` → produce `.msi`/`.exe` directly |
| WE preview source | Portal 1 / "Still Alive" |
| Launcher aesthetic | Best judgement — match the existing splash: yellow on black, monospace, Aperture testing-protocol feel |
| Picker button copy | In-universe (`TEST CHAMBER 01`, etc.) |

---

## Project layout addition

```
aperturescience/
  portal/                          # unchanged (Portal 1 / Still Alive)
  portal2/                         # unchanged (Portal 2 / Want You Gone)
  portal2/portal1style/            # unchanged (Portal 2 song, Portal 1 visual)
  launcher/
    index.html                     # 4-button picker, Aperture-themed
    launcher.css
    launcher.js                    # button → ?autoloop=1 nav + random picker
  desktop-app/
    src-tauri/
      tauri.conf.json              # window 1280×720, resizable, fullscreen toggle
      Cargo.toml                   # tauri-build, tauri runtime, wry
      build.rs
      src/main.rs                  # ~10-line shell
      icons/                       # generated from Aperture logo SVG (16/32/64/128/256/512)
    README.md                      # build instructions per platform
  wallpaper-engine/
    project.json                   # WE metadata (type: web, file: index.html)
    preview.gif                    # ~5 s Portal 1 loop, ≤2 MB
    index.html                     # immediate redirect to launcher with random+autoloop
    portal/                        # copy of portal/ (WE wallpapers must be self-contained)
    portal2/
    portal2/portal1style/
    launcher/                      # copy of launcher/
    README.md                      # import instructions
```

---

## Autoloop mechanics

Each variant's `cake.js` reads `URLSearchParams` for `autoloop=1` and `random=1`:

- **Splash auto-dismiss:** 5 s timer added in the DOMContentLoaded handler when `autoloop=1`. Click/Space still works for faster manual dismiss.
- **Loop transition:** Listen for `audio.ended` on `cake.player`. When it fires, wait 8 s (lets credits typing tail finish), then:
  - `?autoloop=1` (no random) → `location.reload()`
  - `?autoloop=1&random=1` → `location.assign('../launcher/?random=1')` (relative path for both Tauri and WE)
- **Outside autoloop:** No behavior change — existing splash + manual dismiss + one-time play still works for plain web view.

Implementation notes:
- portal/cake.js currently schedules `setTimeout(function() { cake.player.play(); }, delay)` — `cake.player` is reachable for the `ended` listener.
- portal2/cake.js sets `cake.player` in `initMusicPlayer` — already accessible.
- portal2/portal1style/cake.js creates `cake.player` in `initMusicPlayer` similarly.
- Add the `ended` listener inside `initMusicPlayer` so it's wired once.

---

## Commits

### Commit 6.1 — Autoloop support in cake.js

**Files touched:**
- `portal/cake.js`
- `portal2/cake.js`
- `portal2/portal1style/cake.js`
- 3 matching AIU sidecars

**Changes per file:**
1. In each cake's DOMContentLoaded handler, read `URLSearchParams` early; store `autoloop` and `random` booleans on `cake` (e.g. `cake.autoloop`, `cake.random`).
2. If `cake.autoloop`, set a 5 s `setTimeout` that calls the existing `startCake()` / `userReady()` function (the splash dismiss path) if not already triggered.
3. In each `initMusicPlayer`, after creating `cake.player`, attach an `ended` listener:
   ```js
   cake.player.addEventListener('ended', function() {
       if (!cake.autoloop) return;
       setTimeout(function() {
           if (cake.random) location.assign('../launcher/?random=1');
           else location.reload();
       }, 8000);
   });
   ```
4. Make sure the ended listener fires once and only once.

**Verification:**
- Playwright headless: load each variant with `?autoloop=1`, confirm splash auto-dismisses within 6 s without user input, confirm credits play normally.
- Playwright: load with `?autoloop=1&random=1`, mock audio short with `playbackRate=10` if practical (or use a short test audio), confirm navigation to launcher.

**Acceptance:** all three variants pass headless verification, no console errors, sidecars updated with new sha1 + new invariant about `?autoloop=1` / `?random=1` semantics.

---

### Commit 6.2 — Launcher page

**Files created:**
- `launcher/index.html`
- `launcher/launcher.css`
- `launcher/launcher.js`
- `AI_UNDERSTANDING/launcher/index.html.aiu.json`
- `AI_UNDERSTANDING/launcher/launcher.css.aiu.json`
- `AI_UNDERSTANDING/launcher/launcher.js.aiu.json`

**Design:**
- Yellow on black, `font-family: monospace, font-size: 12pt`, body centered
- Header: `APERTURE SCIENCE ENRICHMENT CENTER` (large, letter-spaced)
- Subheader: `TEST CHAMBER SELECTION` (smaller, dimmer)
- Four buttons in a 2×2 grid, monospace, hover effect = yellow background with black text:
  - `TEST CHAMBER 01` → portal/?autoloop=1
  - `TEST CHAMBER 02` → portal2/?autoloop=1
  - `TEST CHAMBER 02 LEGACY` → portal2/portal1style/?autoloop=1
  - `RANDOMIZE PROTOCOL` → picks one of the three uniformly at random with `?autoloop=1&random=1`
- Each button has a small subtitle below the label (e.g. `STILL ALIVE — JONATHAN COULTON`)
- Blinking cursor in the corner (matches splash aesthetic)

**Behavior:**
- On load: if `?random=1` query param present, immediately pick a random variant and navigate with `?autoloop=1&random=1`. No UI flash.
- Otherwise: render the 4-button grid and wait for click.
- Keyboard support: `1`, `2`, `3`, `R` keys map to the four buttons.

**Verification:**
- Playwright: click each button, confirm correct navigation.
- Playwright: load `launcher/?random=1`, confirm it navigates to one of the three variants with `?autoloop=1&random=1`.

---

### Commit 6.3 — Tauri shell + cross-compile to Windows

**Prerequisites I'll install:**
1. Rust toolchain via `rustup-init` (~50 MB)
2. `cargo install tauri-cli`
3. `cargo install cargo-xwin` (cross-compile to Windows MSVC from Linux)
4. `rustup target add x86_64-pc-windows-msvc`
5. `cargo-xwin` will download Windows SDK headers/libs on first use (~500 MB cached under `~/.cache/cargo-xwin/`)

**Files created:**
- `desktop-app/src-tauri/tauri.conf.json`
- `desktop-app/src-tauri/Cargo.toml`
- `desktop-app/src-tauri/build.rs`
- `desktop-app/src-tauri/src/main.rs`
- `desktop-app/src-tauri/icons/` (6 PNGs at 32, 128, 256 + 128@2x; `.ico` for Windows; `.icns` for Mac)
- `desktop-app/README.md`

**`tauri.conf.json` essentials:**
```jsonc
{
  "build": {
    "frontendDist": "../../launcher",   // relative to src-tauri/
    "devUrl": "http://localhost:1430"
  },
  "app": {
    "windows": [{
      "title": "Aperture Science — End Credits Test Chamber",
      "width": 1280,
      "height": 720,
      "resizable": true,
      "fullscreen": false
    }]
  },
  "bundle": {
    "active": true,
    "targets": ["msi"],
    "identifier": "com.bigfnj.aperture-credits",
    "icon": ["icons/icon.ico"]
  }
}
```

**`src/main.rs` minimal:**
```rust
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Icon generation:**
- Use Inkscape or ImageMagick to convert the Aperture SVG (extracted from portal2/index.html) to PNG at 32/128/256/512.
- Bundle into `.ico` (Windows) and `.icns` (Mac, requires `iconutil` — Mac-only, skip if Linux-only build).

**Cross-compile invocation:**
```bash
cd desktop-app/src-tauri
cargo xwin build --release --target x86_64-pc-windows-msvc
# Output: target/x86_64-pc-windows-msvc/release/aperture-credits.exe
# Then bundle into .msi via tauri:
cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

**`desktop-app/README.md` contents:**
- Build prerequisites (Rust toolchain, Tauri CLI, cargo-xwin for cross-compile)
- Linux build: `cargo tauri build`
- Windows cross-build: `cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc`
- Native Windows build (without cargo-xwin): `cargo tauri build` on Windows after installing rustup + tauri-cli
- Mac build: `cargo tauri build` on a Mac
- Smoke test on each platform
- Known autoplay-policy caveat (see Risk section below)

**Verification:**
- Linux build completes locally → `target/release/aperture-credits` runs (will use WebKitGTK)
- Windows cross-build completes → `.msi` produced; user runs on Windows
- AIU: add new `desktop-app/**/*.{toml,json,rs,md}` glob to `_meta.json#tracked_globs`, write sidecars for each Rust + config file

---

### Commit 6.4 — WallpaperEngine packaging

**Files created:**
- `wallpaper-engine/project.json`
- `wallpaper-engine/preview.gif` (Portal 1 / Still Alive, 5 s loop, ≤2 MB)
- `wallpaper-engine/index.html` (immediate JS redirect to `launcher/?random=1`)
- `wallpaper-engine/portal/` (copy of portal/)
- `wallpaper-engine/portal2/` (copy of portal2/)
- `wallpaper-engine/portal2/portal1style/` (copy of portal2/portal1style/)
- `wallpaper-engine/launcher/` (copy of launcher/)
- `wallpaper-engine/README.md`

**Why copy instead of symlink:** WallpaperEngine zips the folder for import; symlinks don't survive. Acceptable duplication for a 200 KB total source tree.

**`project.json` essentials:**
```json
{
  "title": "Aperture Science — End Credits",
  "type": "web",
  "file": "index.html",
  "preview": "preview.gif",
  "description": "Auto-looping Portal 1 / Portal 2 end-credit sequences with the choice of all three layouts or random rotation.",
  "tags": ["Portal", "Aperture", "Credits", "Music", "Web"],
  "contentrating": "Everyone",
  "visibility": "private"
}
```

**Preview generation pipeline:**
1. Playwright headless launches portal/?autoloop=1
2. Records 5 s of video starting just after splash dismiss (use Playwright's video recording option)
3. ffmpeg converts MP4 → GIF at 12 fps, 480px wide, color-optimized
4. Verify ≤2 MB; if larger, drop fps to 8 or width to 320

**`index.html` redirect:**
```html
<!DOCTYPE html>
<meta charset="utf-8">
<title>Aperture Science — End Credits</title>
<meta http-equiv="refresh" content="0; url=launcher/?random=1">
<script>location.replace('launcher/?random=1');</script>
```

**`wallpaper-engine/README.md` contents:**
- What WallpaperEngine is (Steam app, paid)
- How to import this folder:
  1. Open WallpaperEngine
  2. Workshop → Open Wallpaper from File
  3. Select `wallpaper-engine/project.json`
  4. Configure audio in WE settings (default = muted)
- Known limitations (WE may require explicit audio opt-in)

**Verification:**
- File structure sanity-check (project.json validates against WE schema, all referenced paths exist)
- Playwright loads `wallpaper-engine/index.html` from `file://` and confirms it lands on a variant within 2 s
- AIU: add `wallpaper-engine/**` glob (excluding the variant copies — those are duplicates already covered by portal/portal2/portal1style globs; just track project.json, README.md, index.html, preview.gif), write sidecars

---

### Commit 6.5 — Documentation + close-out

**Changes:**
- Update top-level `README.md` to describe the three artifacts (static site, Tauri app, WE wallpaper) with quick links to each
- Update `MODERNIZATION_BACKLOG.md` to check off all Phase 6 items
- Update `PHASE6_DESKTOP_APP_PLAN.md` to mark complete + record any deviations
- Bump `AI_UNDERSTANDING/_meta.json#last_audit_commit` to new HEAD, `last_audit_at` to current ISO timestamp

---

## Risks and footguns

### Autoplay policy in Tauri WebView2 (Windows)

WebView2 enforces the same autoplay policy as Edge: audio requires a user gesture before playback. Our existing splash + click/Space handler satisfies this on first load. But on subsequent autoloop iterations, `location.reload()` is **not** treated as a user-gestured continuation — Chrome may allow it because same-origin and recent media engagement, but WebView2 behavior is less predictable.

**Mitigation:** instead of `location.reload()`, we can keep cake's state in memory and re-trigger the typing sequence without reloading the page. Avoids the new-page autoplay-policy reset. Add this fallback if WebView2 blocks autoplay on cycle 2.

### Tauri WebView2 vs WebKitGTK vs WKWebView differences

Each platform's webview has subtly different CSS / JS support and policies. We're developing against WebKitGTK on WSL2 but the user runs WebView2 on Windows. Some Phase 4 changes (e.g. unprefixed CSS animations) are universally supported, but a regression could surface only on Windows.

**Mitigation:** smoke-test the Windows build on real Windows before declaring 6.3 done. Document any platform-specific differences in `desktop-app/README.md`.

### cargo-xwin first-build size

First `cargo xwin build` downloads the Windows SDK headers/libs (~500 MB). Subsequent builds reuse the cache. Make sure user knows this happens once.

### WE audio default

WallpaperEngine mutes wallpaper audio by default. User has to enable it per wallpaper in WE settings. Document this in the WE README so they don't think the music is broken.

### Random mode and audio gesture chains

When random mode navigates from variant A → launcher → variant B, the user gesture from variant A's splash dismiss does NOT carry over to variant B's audio context. Variant B will need its own splash click for autoplay-policy compliance in browsers / WebView2. In Tauri, this is the moment we'd lean on the in-memory state approach above instead of cross-page navigation.

---

## Feature enhancements

All 15 originally-seeded enhancements were accepted by user 2026-05-19, plus one new explicit ask. Grouped below by estimated effort so scope can be reality-checked.

### NEW — Text color modes (portal/ and portal2/portal1style/ only)

User-explicit ask: "change the color of the text, have it multi-colored or have it cycle through colors slowly." Applies to portal/ (Still Alive) and portal2/portal1style/ (Want You Gone in Portal 1 layout). Excludes portal2/ — its gold-on-radial design is intentionally untouched.

**Modes via `?textcolor=` URL param:**
- `default` (or absent) → existing yellow
- `cycle` → slow hue rotation, ~60 s loop, applied via CSS `filter: hue-rotate()` keyframe animation on `body`
- `rainbow` → per-line discrete colors from a 6-color palette via `#lyricstext > span:nth-child(6n+k)` selectors (CSS-only, no JS-per-line work)
- Hex like `%23FF00FF` (URL-encoded `#FF00FF`) → fixed user-picked single color, applied by setting `--text-color` CSS variable

**Files touched:**
- `portal/style.css` and `portal2/portal1style/style.css` — add `:root { --text-color: yellow; }`, change `body { color: yellow }` to `color: var(--text-color)`, add `@keyframes color-cycle` + `.color-cycle` + `.color-rainbow` rules
- `portal/cake.js` and `portal2/portal1style/cake.js` — in DOMContentLoaded handler, read `URLSearchParams.get('textcolor')`, apply class or CSS var accordingly
- `launcher/index.html` — extend the picker with a "DISPLAY MODE" section: radio buttons for DEFAULT / CYCLE / RAINBOW / CUSTOM; show `<input type="color">` only when CUSTOM selected; apply selected mode by appending `&textcolor=...` to variant URL (only when navigating to portal/ or portal2/portal1style/; portal2/ navigation strips the param)
- 4 sidecars (2 CSS, 2 JS)

**Scope:** small. One commit, ~half hour.

### Tier 1 — small, batchable (each ~30-60 min)

- [ ] **Text color modes** (above) — fits here
- [ ] **Hotkeys** (F11 fullscreen, M mute, R restart variant, N next variant in random mode, Esc returns to launcher) — small handler in cake.js + launcher
- [ ] **Local storage of last-used variant + last-used color mode** — launcher reads/writes localStorage so the next launch preselects
- [ ] **Skip-to-end / replay button** — small overlay button visible after splash, restarts cycle or skips to credits end
- [ ] **Stats overlay** — small bottom-right text showing variant + elapsed time, toggleable with `S` key
- [ ] **Crossfade between variants in random mode** — JS opacity transition in launcher, ~1-2 s fade between consecutive cycles (currently hard cut via location.assign)

### Tier 2 — medium (each 1-3 hr)

- [ ] **Speed control** — typing speed multiplier (0.5×, 1×, 1.5×, 2×, 3×) applied to all setTimeout timings. Tricky because the credit-pacing math derives delays from total character count; multiplier needs to flow through `cake.delayMultiplier` and the runtime `cake.creditsDelay` computation
- [ ] **Visual theme selector** — beyond text color: alternate border styles (double pipes, em-dashes, solid lines), alternate background tints, alternate font (preserve monospace constraint)
- [ ] **CLI args for Tauri** (`--variant portal2`, `--fullscreen`, `--color cycle`) — passes through to launcher via env or query param
- [ ] **Window controls overlay (Tauri)** — custom title bar, frameless window with draggable region, close/minimize/maximize buttons
- [ ] **Single-instance enforcement** — Tauri plugin so launching the app twice raises the existing window instead of opening a new one

### Tier 3 — large (each ½-1 day +)

- [ ] **System tray icon** — tray menu with quick toggles (variant selector, mute, quit), Tauri tray API + state coordination
- [ ] **Other Portal songs** — add "Cara Mia Addio" (Portal 2 ending) as a fourth variant. Significant work: needs new cakedata.js with line-by-line timing data, lyric text, and credit list. Audio file too.
- [ ] **i18n** — Valve ships Portal credits in many languages. Would need lyric translation data plus a language picker. Big.
- [ ] **Accessibility** — screen-reader mode (text-to-speech fallback for credits typing), captions toggle, prefers-reduced-motion expansion to all typing animations (not just CSS ones)
- [ ] **Update checker** — Tauri updater plugin + GitHub Releases integration; requires actually publishing releases
- [ ] **Crash reporting / error boundary** — adds Sentry-style dependency; probably overkill for a credits app

### Scope reality check

Original Phase 6 estimate (4 commits + close-out): **~half day**.

If we execute all Tier 1 plus the color modes: **+~3 hours**. Still doable in a session.

If we add Tier 2: **another 8-12 hours** spread across a couple sessions.

If we add Tier 3 in full: **multiple days**.

User input needed before execution begins:
1. Confirm scope tier (Tier 1 only? Tier 1+2? Everything?)
2. Within each tier, any items to deprioritize?
3. Sequence — color modes first since they were the user-explicit ask, or roll alphabetically?

---

## Execution checklist (when ready to resume)

Once feature enhancements are decided:

1. Review this plan against new requirements; revise commit list as needed
2. Confirm Rust toolchain install isn't blocked by sudo (it shouldn't be — rustup-init installs to ~/.cargo and ~/.rustup, no system-level changes)
3. Start with Commit 6.1 (autoloop) — least risk, validates the URL-param approach
4. Then 6.2 (launcher) — pure HTML/CSS/JS, headless-verifiable
5. Then 6.3 (Tauri) — biggest piece, cross-compile validation
6. Then 6.4 (WE packaging) — file-shuffling + preview generation
7. Then 6.5 (close-out)

Estimated total effort: half day of focused work for the four feature commits + close-out, plus ~30 min toolchain setup for cargo-xwin. Could split across multiple sessions if feature enhancements turn out to be substantive.

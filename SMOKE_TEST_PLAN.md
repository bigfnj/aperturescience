# Smoke test plan — manual validation

End-to-end manual tests that the headless harness ([`test/`](./test/)) cannot verify: real audio playback, visual rendering, cross-browser behavior, WallpaperEngine integration, autoloop endurance. **The headless harness asserts DOM/CSS state and synthetic event flows — it cannot judge sound coming out of speakers, pixels looking right, real browsers other than Chromium, or real WallpaperEngine.**

Combined headless run currently reports **142/142 green** (A3 67/67 + A4 35/35 + A5 40/40). Manual smoke tests below cover the gaps.

## Setup

```bash
# one-time per machine
cd /home/bigfnj/projects/aperture-science/test
npm install
npx playwright install chromium

# every test session
cd /home/bigfnj/projects/aperture-science
python3 -m http.server 8765 &
# then open http://localhost:8765/launcher/ in your browser
```

**⚠ Use the HTTP server, NOT the WSL file share (`\\wsl.localhost\Ubuntu\...`).** Edge handles directory URLs inconsistently across SMB-mounted folders. The fix in [`1b3cddb`](https://github.com/bigfnj/aperturescience/commit/1b3cddb) makes the app *work* through WSL share, but the HTTP server is the canonical path and matches what tests run against.

---

## 🔁 Recently fixed — re-validate first

Three bugs were caught and fixed during smoke testing. Please re-test these to confirm the fixes hold in your real browser environment:

- [ ] **Custom text credits scroll correctly without bleeding into ASCII art.** (Fix: [`c22acb8`](https://github.com/bigfnj/aperturescience/commit/c22acb8) added `overflow: hidden` to `#credits` + `white-space: nowrap` to credit lines.) Test: Launcher → ENRICHMENT CENTER CREDITS textarea → paste a long URL list (≥10 lines with each URL ≥60 chars) → LOOP CONTINUOUSLY → launch TEST CHAMBER 01. Credits should stay inside their column box; long URLs should be clipped at the right edge (not wrap to multiple visual lines). The ASCII art region below should be untouched.
- [ ] **CYCLE color mode shows the full splash overlay.** (Fix: [`c22acb8`](https://github.com/bigfnj/aperturescience/commit/c22acb8) moved the `filter: hue-rotate()` from `body` to `#lyrics`/`#credits`/`#picture`.) Test: Launcher → DISPLAY MODE → CYCLE → click TEST CHAMBER 01. Splash should show BOTH "INITIALIZE TEST CHAMBER PROTOCOL" and "PRESS [SPACE] OR CLICK TO BEGIN_" centered in the viewport (yellow). After dismissal, lyrics/credits/picture should hue-cycle.
- [ ] **TEST CHAMBER 02 opens directly under WSL file share / `file://` access.** (Fix: [`1b3cddb`](https://github.com/bigfnj/aperturescience/commit/1b3cddb) added explicit `/index.html` to every internal navigation URL.) Test: if you're using WSL file share / file:// access, click TEST CHAMBER 02 — should open `portal2/index.html` directly, not a directory listing.

---

## 🔴 Highest priority — critical paths the harness mutes / fakes

### Audio playback (harness uses `--mute-audio`)

- [ ] **Real audio playback works on all three chambers.** TEST CHAMBER 01 → "Still Alive". TEST CHAMBER 02 → "Want You Gone". TEST CHAMBER 02 LEGACY → also "Want You Gone". All three should produce sound through speakers.
- [ ] **6.87 s Still Alive lead-in syncs with the song's intro instrumental.** This is the lyric/audio sync preserved via `cake.audioStartDelay`. On TEST CHAMBER 01: lyrics should start typing immediately after splash dismissal; song should kick in ~6.87 s later, on cue with the first vocals. If the song plays *immediately* on splash dismiss, the retrofit broke something.

### Custom audio override (A4 feature)

- [ ] **Custom audio override actually plays.** Launcher → OVERRIDE TRACK → LOAD AUDIO FILE → pick a `.mp3` or `.ogg` from your filesystem. Confirm status shows `Audio: <filename> (M:SS)`. Then click TEST CHAMBER 01. Your file should play instead of Still Alive. Credit pacing should adapt to the new song length.
- [ ] **RESET TO DEFAULT actually clears the custom audio.** Click reset, then launch TEST CHAMBER 01 again — Still Alive should be back.

---

## 🟡 Visual rendering — CSS + animation correctness

### Text color modes (A5 feature)

- [ ] **DEFAULT mode** (DISPLAY MODE → DEFAULT → launch CHAMBER 01) — yellow text on black, same as original.
- [ ] **CYCLE mode** — colors smoothly hue-rotate over 60 s. Should be a gradual rotation through the spectrum, not janky.
- [ ] **RAINBOW mode** — lyric and credit lines have different colors cycling through yellow / amber / red / magenta / cyan / mint. Borders + ASCII art stay yellow.
- [ ] **CUSTOM hex** — pick a non-yellow hex via the color picker (e.g. `#ff00ff` magenta) → launch CHAMBER 01 → text renders in that color.
- [ ] **TEST CHAMBER 02 ignores DISPLAY MODE.** Set any non-default mode, launch CHAMBER 02 (Portal 2 modern) — should stay gold-on-radial-gradient regardless. URL should NOT have `&textcolor=` (verify in address bar).

### Variant chrome and content

- [ ] **ASCII art frames in CHAMBER 01** render with correct line breaks and spacing. Cake / companion cube / GLaDOS art should all appear at the right lyric beats.
- [ ] **Portal 2 modern (CHAMBER 02) chrome** — animated dot scrollers, SVG Aperture logo, volume slider all render correctly.

### Accessibility

- [ ] **`prefers-reduced-motion`** — enable "Reduce motion" in your OS accessibility settings. Reload launcher → CHAMBER 01 with CYCLE mode. The hue-rotate animation should be suppressed; text stays default yellow.

---

## 🟢 A6 launcher state glue

- [ ] **Last-used chamber gets focus on launcher load.** Click TEST CHAMBER 02 (let it return to launcher after credits, or just navigate back). Reload launcher. CHAMBER 02 button should have visible focus ring. Press Enter — should re-launch CHAMBER 02 without needing a second click.

---

## 🟡 Cross-browser — harness only runs Chromium

- [ ] **Firefox** — launcher loads, all 3 chambers play, audio works, custom credits and audio overrides work. IndexedDB write may fail in Firefox **private mode** — verify the error pill `Storage write failed` appears gracefully if you test private mode.
- [ ] **Safari** (if on Mac) — launcher loads, autoplay gate works (splash click required). `localStorage` access in Safari private mode silently fails; verify the UI doesn't crash, just doesn't persist.

---

## 🟡 Autoloop endurance

- [ ] **Single-variant autoloop.** Launch CHAMBER 01 with autoloop (URL: `http://localhost:8765/portal/index.html?autoloop=1`). Let it run through a full cycle (~3 min). At ~3 min the page should reload and start again. Audio should resume on cycle 2 (WebView2 autoplay policy risk — see [`PHASE6_DESKTOP_APP_PLAN.md:304-308`](PHASE6_DESKTOP_APP_PLAN.md#L304-L308)). If cycle 2 audio is silent, that's the known same-origin gesture issue.
- [ ] **Random mode autoloop.** `http://localhost:8765/launcher/?random=1`. Should pick a random variant, play through, return to launcher, pick another. Let it run through 3-4 cycles.

---

## 🔵 WallpaperEngine (deferred until Bundle C ships)

- [ ] **WE-mode visual smoke.** Open `http://localhost:8765/launcher/?we=1`. OVERRIDE TRACK section should be visually dimmed (border + text in dark `#550` brown-yellow), `Custom audio not supported in WallpaperEngine.` pill visible, both LOAD/RESET buttons disabled.
- [ ] **Real WE smoke** — not testable until Bundle C ships the WE package and you import it via Steam Workshop. The runtime sniff for `window.wallpaperPropertyListener` is verified headless via init-script injection but the real injection moment + payload shape from WE itself is unverified.

---

## 🟣 Edge cases worth a spot-check

- [ ] **Very short custom audio** (e.g. a 10 s clip): credit STRETCH math will compress dramatically. Credits may "race" to the end. Acceptable for v1 per HANDOFF.
- [ ] **Corrupted audio file** (rename `.txt` to `.mp3` and try LOAD AUDIO FILE): launcher should show `Audio could not be loaded. Try a different file.` and NOT write to IDB.
- [ ] **20 000-char paste into Enrichment Credits:** should silently cap at 20 000 chars with `Pasted text trimmed to 20,000 characters.` notice for 5 s.
- [ ] **Resize launcher to <40 em width** (~640 px): grid should collapse to single-column, header letter-spacing should tighten.

---

## When something breaks

If something behaves wrong, the most likely culprits given recent work:
- Audio plays immediately on splash dismiss in CHAMBER 01 → `cake.audioStartDelay` got zeroed when it shouldn't (custom audio override bug in [`portal/cake.js`](portal/cake.js))
- Text color stays yellow even in CYCLE/RAINBOW → URL param not reaching variant, check the destination URL in address bar for `&textcolor=`
- CHAMBER 02 mysteriously gets recolored → `supportsTextColor` substring order regression in [`launcher/launcher.js`](launcher/launcher.js)
- Custom audio status shows wrong duration → the transient probe didn't fire `loadedmetadata` (corrupted file or slow disk)
- Chamber click navigates to a directory listing instead of opening credits → internal navigation URL lost its `/index.html` suffix
- Splash collapsed to a tiny box at the top of the page → CSS animation (`filter` or `transform`) applied to `body` is creating a containing block for `position: fixed` descendants

When reporting, include the URL bar contents + the variant + which DISPLAY MODE was active. That triages 90 % of issues.

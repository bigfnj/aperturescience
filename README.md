# Aperture Science — Portal End Credits in HTML/JS/CSS

Fan recreation of the Portal and Portal 2 end-credit sequences. Yellow-on-black monospace, ASCII art, lyric typing, and the iconic Aperture Science aesthetic — all in static HTML / CSS / JavaScript with no build step and no runtime dependencies.

This is a personal fork of [xBytez/aperturescience](https://xbytez.eu/) (originally by @Rudench, adapted by @xBytez with permission). Forked to modernize the codebase for current browsers and prepare it for desktop + wallpaper deployment.

## Variants

Three independent presentations live in the repo:

| Path | Song | Visual style |
| --- | --- | --- |
| [`portal/`](./portal/) | "Still Alive" (Jonathan Coulton) | Portal 1 terminal: lyric + credit boxes with ASCII pipe/dash borders, rotating ASCII art panel (cake, companion cube, GLaDOS, etc.) |
| [`portal2/`](./portal2/) | "Want You Gone" (Jonathan Coulton) | Portal 2 modern: CSS-animated dot scrollers, SVG Aperture logo, gold-on-radial-gradient theme, volume slider |
| [`portal2/portal1style/`](./portal2/portal1style/) | "Want You Gone" | Portal 1 terminal layout with the Portal 2 song |

## Running

The pages are static — open the variant's `index.html` directly in a browser:

```
file:///path/to/aperturescience/portal/index.html
```

Some browsers restrict local-audio playback under `file://`. If audio doesn't start after you click the splash, serve over HTTP instead:

```bash
python3 -m http.server
# then visit http://localhost:8000/portal/
```

Each page shows a splash overlay ("INITIALIZE TEST CHAMBER PROTOCOL") on load — click or press Space to start. The splash exists because modern browsers (Chrome / Firefox / Safari since ~2018) block audio autoplay without user interaction.

## Modernization

This fork modernized the original codebase across 14 commits in 2026-05. Highlights:

- Splash + autoplay-policy gate ([`ccd53c5`](https://github.com/bigfnj/aperturescience/commit/ccd53c5))
- String-form `setTimeout` → closure form ([`0489797`](https://github.com/bigfnj/aperturescience/commit/0489797))
- IIFE + `'use strict'`, implicit globals removed ([`ece125c`](https://github.com/bigfnj/aperturescience/commit/ece125c))
- `processLetter` rewritten with `createTextNode` ([`99752d6`](https://github.com/bigfnj/aperturescience/commit/99752d6))
- IE compatibility code deleted ([`4d038f7`](https://github.com/bigfnj/aperturescience/commit/4d038f7))
- HTML5 DOCTYPE + `defer` scripts ([`f0f11fd`](https://github.com/bigfnj/aperturescience/commit/f0f11fd))
- Vendor prefixes and IE6-9 filter stripped ([`5af46ec`](https://github.com/bigfnj/aperturescience/commit/5af46ec))
- `prefers-reduced-motion` respected ([`cb27b2c`](https://github.com/bigfnj/aperturescience/commit/cb27b2c))

Full commit list with sub-task checkboxes: [`MODERNIZATION_BACKLOG.md`](./MODERNIZATION_BACKLOG.md).

The original aesthetic — yellow on black, ASCII borders, character-by-character typing, fixed-grid layout — is preserved exactly. Only the underlying mechanics changed.

## Roadmap

Phase 6 is desktop-app packaging. Plan documented in [`PHASE6_DESKTOP_APP_PLAN.md`](./PHASE6_DESKTOP_APP_PLAN.md). Highlights:

- Tauri desktop app (cross-compiled to Windows from Linux via `cargo-xwin`)
- WallpaperEngine package (drop-in folder for Steam's WE)
- Auto-loop forever between cycles
- Launcher page with picker (`TEST CHAMBER 01` / `02` / `02 LEGACY` / `RANDOMIZE PROTOCOL`)
- Text color modes (default / cycle / rainbow / custom hex) for Portal 1 and Portal 1-style variants
- Tier 1-3 enhancements (hotkeys, speed control, themes, system tray, more songs, …)

Pending user prioritization before execution.

## AI Understanding

Per-file codebase model lives in [`AI_UNDERSTANDING/`](./AI_UNDERSTANDING/) — schema-v1 sidecars describing purpose, exports, imports, invariants, and gotchas for each tracked source file. The pre-commit hook keeps sidecars in lockstep with source.

## Attribution and License

Original credits sequence: **Valve** (Portal, Portal 2).

Original HTML/CSS/JS recreation: **Rudench**, adapted with permission by **xBytez**, with contributions from **TylaKitty**, **MatheusAvellar**, and others.

This fork: **bigfnj** — modernization for current browsers and desktop deployment.

Licensed under **Creative Commons Attribution-ShareAlike 4.0 International**. See [`LICENSE.md`](./LICENSE.md) or [creativecommons.org/licenses/by-sa/4.0/](https://creativecommons.org/licenses/by-sa/4.0/).

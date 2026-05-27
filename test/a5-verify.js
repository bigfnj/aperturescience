#!/usr/bin/env node
/*
 * A5 + A6 + Decision 3 verification harness.
 *
 * A5 — Text color modes:
 *   - Launcher DISPLAY MODE section render (radios, custom-color picker hidden by default).
 *   - Mode hydration from localStorage (cycle / rainbow / custom + hex).
 *   - Mode persistence on change (radio change → localStorage; picker input → localStorage).
 *   - URL-param append on navigate: portal/ + portal2/portal1style/ get &textcolor=...,
 *     portal2/ never does (gold theme intentionally untouched).
 *   - Variant URL-param read: portal/ and portal2/portal1style/ apply body class
 *     (color-cycle / color-rainbow) or :root style (--text-color hex) per the URL param.
 *
 * A6 — Launcher state glue:
 *   - Click a chamber → aperture.lastVariant persisted.
 *   - On launcher load, focus the chamber matching aperture.lastVariant
 *     (so pressing Enter re-launches the last-used variant).
 *
 * Decision 3 — WallpaperEngine runtime detection:
 *   - Injecting window.wallpaperPropertyListener via addInitScript triggers the
 *     same disabled state as ?we=1, even without the URL param.
 *
 * Run from repo root:
 *   node test/a5-verify.js
 */

'use strict';

const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8765';
const VERBOSE = process.env.VERBOSE === '1';

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, cond, detail) {
    if (cond) {
        passed++;
        if (VERBOSE) console.log(`    ✓ ${label}`);
    } else {
        failed++;
        const msg = detail ? ` (${detail})` : '';
        failures.push(label + msg);
        console.log(`    ✗ ${label}${msg}`);
    }
}

function section(name) { console.log(`\n  ${name}`); }

async function preflight() {
    try {
        const res = await fetch(`${BASE}/launcher/index.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
        console.error(`\nCannot reach ${BASE}/launcher/index.html (${e.message}).`);
        console.error(`Start a static server first:\n  python3 -m http.server 8765\n`);
        process.exit(2);
    }
}

async function launcherDisplayModeUiTests(browser) {
    section('Launcher DISPLAY MODE UI render');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);

    assert('.display-mode section present',
        await page.locator('.display-mode').count() === 1);

    const radioCount = await page.locator('input[name="textColorMode"]').count();
    assert('4 textColorMode radios present', radioCount === 4, `got ${radioCount}`);

    for (const v of ['default', 'cycle', 'rainbow', 'custom']) {
        const present = await page.locator(`input[name="textColorMode"][value="${v}"]`).count();
        assert(`radio with value="${v}" present`, present === 1);
    }

    const defaultChecked = await page.locator('input[name="textColorMode"][value="default"]').isChecked();
    assert('DEFAULT radio checked on fresh load', defaultChecked === true);

    const pickerHidden = await page.evaluate(
        () => document.getElementById('customColor').classList.contains('hidden'));
    assert('#customColor picker hidden when CUSTOM not selected', pickerHidden === true);

    await ctx.close();
}

async function modeHydrationTests(browser) {
    section('DISPLAY MODE hydration from localStorage');

    // Seed cycle → reload → CYCLE radio checked
    let ctx = await browser.newContext();
    let page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    await page.evaluate(() => localStorage.setItem('aperture.textColorMode', 'cycle'));
    await page.reload();
    const cycleChecked = await page.locator('input[name="textColorMode"][value="cycle"]').isChecked();
    assert('seed cycle → CYCLE radio hydrated', cycleChecked === true);
    await ctx.close();

    // Seed custom + hex → CUSTOM checked, picker visible + value matches
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    await page.evaluate(() => {
        localStorage.setItem('aperture.textColorMode', 'custom');
        localStorage.setItem('aperture.customColor', '#abcdef');
    });
    await page.reload();
    const customChecked = await page.locator('input[name="textColorMode"][value="custom"]').isChecked();
    assert('seed custom → CUSTOM radio hydrated', customChecked === true);
    const pickerVisible = await page.evaluate(
        () => !document.getElementById('customColor').classList.contains('hidden'));
    assert('CUSTOM hydration → picker visible', pickerVisible === true);
    const pickerValue = await page.locator('#customColor').inputValue();
    assert('CUSTOM hydration → picker value matches localStorage',
        pickerValue === '#abcdef', `got ${pickerValue}`);
    await ctx.close();
}

async function modePersistenceTests(browser) {
    section('DISPLAY MODE persistence on user change');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);

    await page.locator('input[name="textColorMode"][value="rainbow"]').check();
    await page.waitForTimeout(50);
    const stored = await page.evaluate(() => localStorage.getItem('aperture.textColorMode'));
    assert('check RAINBOW → localStorage.aperture.textColorMode === "rainbow"',
        stored === 'rainbow', `got ${JSON.stringify(stored)}`);

    await page.locator('input[name="textColorMode"][value="default"]').check();
    await page.waitForTimeout(50);
    const cleared = await page.evaluate(() => localStorage.getItem('aperture.textColorMode'));
    assert('check DEFAULT → localStorage.aperture.textColorMode removed',
        cleared === null, `got ${JSON.stringify(cleared)}`);

    // Picker input event persists
    await page.locator('input[name="textColorMode"][value="custom"]').check();
    await page.waitForTimeout(50);
    await page.locator('#customColor').evaluate((el) => {
        el.value = '#123abc';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(50);
    const customStored = await page.evaluate(() => localStorage.getItem('aperture.customColor'));
    assert('color picker input → localStorage.aperture.customColor matches',
        customStored === '#123abc', `got ${JSON.stringify(customStored)}`);

    await ctx.close();
}

async function navigateUrlAppendTests(browser) {
    section('Launcher navigate() — textcolor URL param append');

    // 1) Set cycle mode, click chamber 1 (portal/) → URL ends up with textcolor=cycle.
    let ctx = await browser.newContext();
    let page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    await page.evaluate(() => localStorage.setItem('aperture.textColorMode', 'cycle'));
    await page.reload();
    await Promise.all([
        page.waitForLoadState('load'),
        page.click('.chamber[data-key="1"]')
    ]);
    let url = page.url();
    assert('cycle mode + chamber 1 → URL contains textcolor=cycle',
        url.includes('textcolor=cycle'), `got ${url}`);
    assert('cycle mode + chamber 1 → URL targets portal/',
        url.includes('/portal/') && !url.includes('portal2'), `got ${url}`);
    await ctx.close();

    // 2) Set cycle mode, click chamber 2 (portal2/) → URL does NOT have textcolor.
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    await page.evaluate(() => localStorage.setItem('aperture.textColorMode', 'cycle'));
    await page.reload();
    await Promise.all([
        page.waitForLoadState('load'),
        page.click('.chamber[data-key="2"]')
    ]);
    url = page.url();
    assert('cycle mode + chamber 2 (portal2/) → URL does NOT contain textcolor (gold untouched)',
        !url.includes('textcolor'), `got ${url}`);
    await ctx.close();

    // 3) Set cycle mode, click chamber 3 (portal2/portal1style/) → URL has textcolor.
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    await page.evaluate(() => localStorage.setItem('aperture.textColorMode', 'cycle'));
    await page.reload();
    await Promise.all([
        page.waitForLoadState('load'),
        page.click('.chamber[data-key="3"]')
    ]);
    url = page.url();
    assert('cycle mode + chamber 3 (portal2/portal1style/) → URL contains textcolor=cycle',
        url.includes('textcolor=cycle') && url.includes('portal1style'), `got ${url}`);
    await ctx.close();

    // 4) Custom hex mode → URL contains URL-encoded hex.
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    await page.evaluate(() => {
        localStorage.setItem('aperture.textColorMode', 'custom');
        localStorage.setItem('aperture.customColor', '#ff00ff');
    });
    await page.reload();
    await Promise.all([
        page.waitForLoadState('load'),
        page.click('.chamber[data-key="1"]')
    ]);
    url = page.url();
    assert('custom mode + chamber 1 → URL contains URL-encoded hex (%23ff00ff)',
        /textcolor=%23ff00ff/i.test(url), `got ${url}`);
    await ctx.close();

    // 5) Default mode → URL has no textcolor param.
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    // No localStorage seed (default state)
    await Promise.all([
        page.waitForLoadState('load'),
        page.click('.chamber[data-key="1"]')
    ]);
    url = page.url();
    assert('default mode + chamber 1 → URL has no textcolor param',
        !url.includes('textcolor'), `got ${url}`);
    await ctx.close();
}

async function variantTextColorReadTests(browser) {
    section('Variant cake.js — applyTextColor() URL param read');

    const variants = [
        { name: 'portal/',              path: '/portal/',              supports: true },
        { name: 'portal2/portal1style/', path: '/portal2/portal1style/', supports: true },
        { name: 'portal2/',             path: '/portal2/',              supports: false }
    ];

    for (const v of variants) {
        // cycle
        {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await page.goto(`${BASE}${v.path}?textcolor=cycle`);
            await page.waitForFunction(() => window.cake);
            const hasClass = await page.evaluate(
                () => document.body.classList.contains('color-cycle'));
            assert(`?textcolor=cycle on ${v.name} → body has .color-cycle = ${v.supports}`,
                hasClass === v.supports, `got ${hasClass}`);
            await ctx.close();
        }
        // rainbow
        {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await page.goto(`${BASE}${v.path}?textcolor=rainbow`);
            await page.waitForFunction(() => window.cake);
            const hasClass = await page.evaluate(
                () => document.body.classList.contains('color-rainbow'));
            assert(`?textcolor=rainbow on ${v.name} → body has .color-rainbow = ${v.supports}`,
                hasClass === v.supports, `got ${hasClass}`);
            await ctx.close();
        }
        // hex
        if (v.supports) {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await page.goto(`${BASE}${v.path}?textcolor=%23ff00ff`);
            await page.waitForFunction(() => window.cake);
            const cssVar = await page.evaluate(
                () => document.documentElement.style.getPropertyValue('--text-color'));
            assert(`?textcolor=%23ff00ff on ${v.name} → :root --text-color = #ff00ff`,
                cssVar.toLowerCase() === '#ff00ff', `got "${cssVar}"`);
            await ctx.close();
        }
    }

    // default → no class, no inline var
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/portal/?textcolor=default`);
    await page.waitForFunction(() => window.cake);
    const noClass = await page.evaluate(
        () => !document.body.classList.contains('color-cycle') &&
              !document.body.classList.contains('color-rainbow'));
    assert('?textcolor=default on portal/ → no color-cycle nor color-rainbow class',
        noClass === true);
    await ctx.close();
}

async function lastVariantFocusTests(browser) {
    section('A6 — focus last-used chamber from localStorage');

    // Seed lastVariant → reload → matching chamber has focus.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    await page.evaluate(() => localStorage.setItem('aperture.lastVariant', '../portal2/index.html?autoloop=1'));
    await page.reload();
    await page.waitForTimeout(100);  // give focusLastVariant() a tick to run

    const focusedDataTarget = await page.evaluate(
        () => document.activeElement && document.activeElement.getAttribute &&
              document.activeElement.getAttribute('data-target'));
    assert('seed lastVariant = portal2/ → chamber 2 has focus on launcher load',
        focusedDataTarget === '../portal2/index.html?autoloop=1', `got "${focusedDataTarget}"`);
    await ctx.close();

    // Chamber click writes lastVariant — verify on the destination page (same origin → shared localStorage).
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(`${BASE}/launcher/`);
    await Promise.all([
        page2.waitForLoadState('load'),
        page2.click('.chamber[data-key="3"]')
    ]);
    const persisted = await page2.evaluate(() => localStorage.getItem('aperture.lastVariant'));
    assert('clicking chamber 3 → aperture.lastVariant points at portal1style/index.html',
        persisted === '../portal2/portal1style/index.html?autoloop=1',
        `got ${JSON.stringify(persisted)}`);
    await ctx2.close();
}

async function cycleSplashRegressionTests(browser) {
    section('CYCLE mode does not collapse #splash (regression: filter on body broke position:fixed inset:0)');

    // With ?textcolor=cycle, the splash MUST still be full-viewport.
    // Bug history: applying `filter: hue-rotate()` to body made body the
    // containing block for #splash's position:fixed inset:0, collapsing
    // it to 0×0 since body had no explicit height. Fix moved the filter
    // to #lyrics/#credits/#picture only. This regression check pins it.
    const variants = [
        { name: 'portal/',              path: '/portal/' },
        { name: 'portal2/portal1style/', path: '/portal2/portal1style/' }
    ];

    for (const v of variants) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(`${BASE}${v.path}?textcolor=cycle`);
        await page.waitForFunction(() => window.cake);

        const splashRect = await page.evaluate(() => {
            const el = document.getElementById('splash');
            return el ? el.getBoundingClientRect() : null;
        });
        assert(`?textcolor=cycle on ${v.name} → #splash fills viewport (height > 600px)`,
            splashRect && splashRect.height > 600,
            `got ${splashRect ? splashRect.height : 'null'}`);

        const h1Rect = await page.evaluate(() => {
            const el = document.querySelector('#splash h1');
            return el ? el.getBoundingClientRect() : null;
        });
        assert(`?textcolor=cycle on ${v.name} → #splash h1 (title) is visible`,
            h1Rect && h1Rect.height > 0 && h1Rect.width > 0,
            `got h=${h1Rect ? h1Rect.height : 'null'} w=${h1Rect ? h1Rect.width : 'null'}`);

        const pRect = await page.evaluate(() => {
            const el = document.querySelector('#splash p');
            return el ? el.getBoundingClientRect() : null;
        });
        assert(`?textcolor=cycle on ${v.name} → #splash p (subtitle) is below h1`,
            pRect && h1Rect && pRect.top > h1Rect.bottom,
            `h1.bottom=${h1Rect ? h1Rect.bottom : '?'} p.top=${pRect ? pRect.top : '?'}`);

        await ctx.close();
    }
}

async function wallpaperEngineRuntimeDetectionTests(browser) {
    section('Decision 3 — WallpaperEngine runtime detection (window.wallpaperPropertyListener)');

    // Inject the WE-specific global via init script. The launcher should treat this as WE mode
    // even without ?we=1 in the URL.
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
        window.wallpaperPropertyListener = {};
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);  // note: NO ?we=1

    const sectionDisabled = await page.evaluate(
        () => document.getElementById('overrideTrack').classList.contains('disabled'));
    assert('window.wallpaperPropertyListener defined → #overrideTrack has .disabled',
        sectionDisabled === true);

    const weVisible = await page.evaluate(
        () => !document.getElementById('weDisabled').classList.contains('hidden'));
    assert('window.wallpaperPropertyListener defined → #weDisabled visible',
        weVisible === true);

    await ctx.close();
}

(async () => {
    await preflight();

    const browser = await chromium.launch({
        args: [
            '--autoplay-policy=no-user-gesture-required',
            '--mute-audio'
        ]
    });

    const t0 = Date.now();
    try {
        await launcherDisplayModeUiTests(browser);
        await modeHydrationTests(browser);
        await modePersistenceTests(browser);
        await navigateUrlAppendTests(browser);
        await variantTextColorReadTests(browser);
        await lastVariantFocusTests(browser);
        await cycleSplashRegressionTests(browser);
        await wallpaperEngineRuntimeDetectionTests(browser);
    } finally {
        await browser.close();
    }
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    const total = passed + failed;
    console.log(`\n${passed}/${total} assertions passed in ${elapsed}s`);
    if (failed) {
        console.log('\nFailures:');
        for (const f of failures) console.log(`  - ${f}`);
        process.exit(failed);
    }
    process.exit(0);
})().catch((err) => {
    console.error('\nHarness crashed:', err);
    process.exit(99);
});

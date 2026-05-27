#!/usr/bin/env node
/*
 * A4 verification harness — Override Track feature.
 *
 * Covers:
 *   - Launcher OVERRIDE TRACK UI render (buttons, picker accept, status/error/WE pills hidden).
 *   - ?we=1 WallpaperEngine mode: .disabled class, buttons disabled, WE pill visible.
 *   - IndexedDB round-trip via the file picker: setInputFiles → probe → IDB.put → status hydrates.
 *   - RESET path: clears IDB record + hides status.
 *   - Per-variant cake.js applyCustomAudio:
 *       * cake.player.src becomes a blob URL.
 *       * cake.creditsMaxTime updates to the audio.duration (loadedmetadata) when overridden.
 *       * portal/ specifically zeroes cake.audioStartDelay from 6.87s.
 *   - Retrofit non-regression: the userReady/audioReady gate still converges with no custom audio
 *     (already covered exhaustively by test/a3-verify.js scroll smoke; not re-tested here).
 *
 * Requirements:
 *   - `python3 -m http.server 8765` (or any static server) serving the repo root.
 *   - `npm install` inside this test/ directory (one-time) — pulls in playwright.
 *   - `npx playwright install chromium` (one-time) — pulls the headless-shell binary.
 *
 * Run from repo root:
 *   node test/a4-verify.js
 *
 * Exit code = number of failed assertions.
 */

'use strict';

const { chromium } = require('playwright');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8765';
const VERBOSE = process.env.VERBOSE === '1';
const REPO_ROOT = path.resolve(__dirname, '..');

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

function section(name) {
    console.log(`\n  ${name}`);
}

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

// Helper: from a page already on origin, seed the IDB record by fetching an
// audio file as a blob and writing it under aperture/audio/customAudio.
async function seedIdbWithFetch(page, fetchPath, filename, durationSec) {
    await page.evaluate(async ({ fetchPath, filename, durationSec }) => {
        const resp = await fetch(fetchPath);
        const blob = await resp.blob();
        await new Promise((resolve, reject) => {
            const req = indexedDB.open('aperture', 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains('audio')) {
                    req.result.createObjectStore('audio');
                }
            };
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
                try {
                    const tx = req.result.transaction('audio', 'readwrite');
                    tx.objectStore('audio').put({ blob, filename, durationSec }, 'customAudio');
                    tx.oncomplete = resolve;
                    tx.onerror = () => reject(tx.error);
                } catch (e) { reject(e); }
            };
        });
    }, { fetchPath, filename, durationSec });
}

async function launcherUiTests(browser) {
    section('Launcher OVERRIDE TRACK UI render');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);

    assert('#overrideTrack section present', await page.locator('#overrideTrack').count() === 1);
    assert('#loadAudio button present', await page.locator('#loadAudio').count() === 1);
    assert('#resetAudio button present', await page.locator('#resetAudio').count() === 1);
    assert('#audioPicker file input present', await page.locator('#audioPicker').count() === 1);

    const accept = await page.getAttribute('#audioPicker', 'accept');
    assert('#audioPicker accept = "audio/*,.wav,.mp3,.ogg"',
        accept === 'audio/*,.wav,.mp3,.ogg', `got ${accept}`);

    const statusHidden = await page.locator('#audioStatus.hidden').count();
    assert('#audioStatus hidden on empty load', statusHidden === 1);

    const errHidden = await page.locator('#audioError.hidden').count();
    assert('#audioError hidden on empty load', errHidden === 1);

    const weHidden = await page.locator('#weDisabled.hidden').count();
    assert('#weDisabled hidden when not in WE mode', weHidden === 1);

    const sectionDisabled = await page.evaluate(
        () => document.getElementById('overrideTrack').classList.contains('disabled'));
    assert('#overrideTrack not .disabled when not in WE mode', sectionDisabled === false);

    const loadDisabledAttr = await page.getAttribute('#loadAudio', 'disabled');
    assert('#loadAudio not disabled when not in WE mode', loadDisabledAttr === null);

    await ctx.close();
}

async function wallpaperEngineModeTests(browser) {
    section('?we=1 WallpaperEngine mode');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/?we=1`);

    const sectionDisabled = await page.evaluate(
        () => document.getElementById('overrideTrack').classList.contains('disabled'));
    assert('?we=1 — #overrideTrack has .disabled class', sectionDisabled === true);

    const weVisible = await page.evaluate(
        () => !document.getElementById('weDisabled').classList.contains('hidden'));
    assert('?we=1 — #weDisabled pill visible', weVisible === true);

    const loadDisabled = await page.evaluate(() => document.getElementById('loadAudio').disabled);
    assert('?we=1 — #loadAudio is disabled', loadDisabled === true);

    const resetDisabled = await page.evaluate(() => document.getElementById('resetAudio').disabled);
    assert('?we=1 — #resetAudio is disabled', resetDisabled === true);

    await ctx.close();
}

async function idbRoundTripTests(browser) {
    section('IndexedDB round-trip via file picker (setInputFiles)');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);

    // Drive the file picker with the bundled Still Alive.ogg (173s = 2:53).
    const audioPath = path.join(REPO_ROOT, 'portal', 'Still Alive.ogg');
    await page.setInputFiles('#audioPicker', audioPath);

    // Wait for the probe + IDB.put + refresh chain to finish — status becomes visible.
    await page.waitForSelector('#audioStatus:not(.hidden)', { timeout: 15000 });
    const statusText = (await page.locator('#audioStatus').textContent()) || '';
    assert('after file picker: #audioStatus shows filename',
        statusText.includes('Still Alive.ogg'),
        `got "${statusText}"`);
    assert('after file picker: #audioStatus shows duration in M:SS format (~2:53)',
        /\b2:5[0-9]\b/.test(statusText),
        `got "${statusText}"`);

    // Verify IDB record landed.
    const recordPresent = await page.evaluate(() => new Promise((resolve) => {
        const req = indexedDB.open('aperture', 1);
        req.onsuccess = () => {
            const tx = req.result.transaction('audio', 'readonly');
            tx.objectStore('audio').get('customAudio').onsuccess = (e) => {
                const r = e.target.result;
                resolve(!!(r && r.blob && r.filename));
            };
        };
        req.onerror = () => resolve(false);
    }));
    assert('after file picker: IDB aperture/audio/customAudio record exists',
        recordPresent === true);

    // Click RESET, status should hide.
    await page.click('#resetAudio');
    await page.waitForFunction(
        () => document.getElementById('audioStatus').classList.contains('hidden'),
        null, { timeout: 5000 });
    const recordGone = await page.evaluate(() => new Promise((resolve) => {
        const req = indexedDB.open('aperture', 1);
        req.onsuccess = () => {
            const tx = req.result.transaction('audio', 'readonly');
            tx.objectStore('audio').get('customAudio').onsuccess = (e) => resolve(!e.target.result);
        };
        req.onerror = () => resolve(false);
    }));
    assert('after RESET: IDB aperture/audio/customAudio record removed', recordGone === true);

    const statusHidden = await page.locator('#audioStatus.hidden').count();
    assert('after RESET: #audioStatus hidden again', statusHidden === 1);

    await ctx.close();
}

async function variantBlobOverrideTests(browser) {
    // Per-variant: load a DIFFERENT audio file via IDB than the bundled one.
    // This way creditsMaxTime overrides are clearly distinguishable from the default.
    const variants = [
        {
            name: 'portal/',
            path: '/portal/',
            bundleMaxTime: 173,
            swapFetch: '/portal2/Want You Gone.mp3',
            swapDurationSec: 144,
            audioStartDelayDefault: 6870
        },
        {
            name: 'portal2/',
            path: '/portal2/',
            bundleMaxTime: 144,
            swapFetch: '/portal/Still Alive.ogg',
            swapDurationSec: 173,
            audioStartDelayDefault: null  // portal2/cake.js plays immediately, no field
        },
        {
            name: 'portal2/portal1style/',
            path: '/portal2/portal1style/',
            bundleMaxTime: 144,
            swapFetch: '/portal/Still Alive.ogg',
            swapDurationSec: 173,
            audioStartDelayDefault: 0
        }
    ];

    for (const v of variants) {
        section(`Variant blob override: ${v.name}`);

        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.goto(`${BASE}${v.path}`);
        await seedIdbWithFetch(page, v.swapFetch, 'test-track' + path.extname(v.swapFetch), v.swapDurationSec);
        await page.reload();

        // Wait until applyCustomAudio's IDB callback fires + initMusicPlayer runs.
        await page.waitForFunction(() => window.cake && window.cake.player && window.cake.player.src,
            { timeout: 10000 });
        const src = await page.evaluate(() => window.cake.player.src);
        assert(`[BLOB] ${v.name} cake.player.src is a blob: URL`,
            src.startsWith('blob:'),
            `got ${src.slice(0, 60)}`);

        // Wait for canplaythrough → audioReady → creditsMaxTime updated.
        await page.waitForFunction(() => window.cake && window.cake.audioReady === true,
            { timeout: 20000 });
        const maxTime = await page.evaluate(() => window.cake.creditsMaxTime);
        // Override must (a) differ from the bundle default (proves loadedmetadata fired and updated the field)
        // and (b) land within ~10s of the source file's nominal length. Encoded vs decoded audio duration
        // can drift several seconds for VBR MP3 / Vorbis OGG — exact match is brittle.
        assert(`[BLOB] ${v.name} cake.creditsMaxTime overridden via loadedmetadata (got ${maxTime.toFixed(2)}, was ${v.bundleMaxTime}, expected ~${v.swapDurationSec})`,
            maxTime !== v.bundleMaxTime && Math.abs(maxTime - v.swapDurationSec) < 10,
            `got ${maxTime}, must be !== ${v.bundleMaxTime} AND within 10s of ${v.swapDurationSec}`);

        if (v.audioStartDelayDefault !== null) {
            const delay = await page.evaluate(() => window.cake.audioStartDelay);
            const expected = v.name === 'portal/' ? 0 : v.audioStartDelayDefault;
            assert(`[BLOB] ${v.name} cake.audioStartDelay = ${expected} after applyCustomAudio`,
                delay === expected,
                `got ${delay}, expected ${expected}`);
        }

        await ctx.close();
    }
}

async function variantNoOverrideRegressionTests(browser) {
    section('Variant — no IDB override: bundled audio loads, retrofit gate converges');

    const variants = [
        { name: 'portal/',              path: '/portal/',              bundleSrc: 'Still Alive.ogg',  bundleMaxTime: 173, audioStartDelay: 6870 },
        { name: 'portal2/',             path: '/portal2/',             bundleSrc: 'Want You Gone.mp3', bundleMaxTime: 144 },
        { name: 'portal2/portal1style/', path: '/portal2/portal1style/', bundleSrc: 'Want You Gone.mp3', bundleMaxTime: 144, audioStartDelay: 0 }
    ];

    for (const v of variants) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.goto(`${BASE}${v.path}`);
        // Note: NO IDB seed. Variant should fall back to bundled audio.
        // Wait for cake.player to exist (applyCustomAudio called initMusicPlayer with no override).
        await page.waitForFunction(() => window.cake && window.cake.player && window.cake.player.src,
            { timeout: 5000 });
        const src = await page.evaluate(() => window.cake.player.src);
        assert(`[NO OVERRIDE] ${v.name} cake.player.src ends with bundled filename`,
            src.endsWith(encodeURI(v.bundleSrc)) || src.endsWith(v.bundleSrc),
            `got ${src.slice(-60)}`);

        const maxTime = await page.evaluate(() => window.cake.creditsMaxTime);
        assert(`[NO OVERRIDE] ${v.name} cake.creditsMaxTime unchanged (${v.bundleMaxTime})`,
            maxTime === v.bundleMaxTime, `got ${maxTime}`);

        if (v.audioStartDelay !== undefined) {
            const delay = await page.evaluate(() => window.cake.audioStartDelay);
            assert(`[NO OVERRIDE] ${v.name} cake.audioStartDelay default preserved (${v.audioStartDelay})`,
                delay === v.audioStartDelay, `got ${delay}`);
        }

        await ctx.close();
    }
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
        await launcherUiTests(browser);
        await wallpaperEngineModeTests(browser);
        await idbRoundTripTests(browser);
        await variantBlobOverrideTests(browser);
        await variantNoOverrideRegressionTests(browser);
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

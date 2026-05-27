#!/usr/bin/env node
/*
 * A3 verification harness — Enrichment Center Credits feature.
 *
 * Covers:
 *   - Launcher UI render, autosave, persistence-across-reload, char-counter,
 *     mode-fieldset 2,500-char threshold, CLEAR, ?random=1 redirect, hotkeys,
 *     paste-truncation notice.
 *   - Per-variant cake.js override behavior (portal/, portal2/, portal2/portal1style/)
 *     across 4 scenarios each: EMPTY, SHORT+LOOP, SHORT+STOP, LONG.
 *   - Real-time scroll smoke: dismiss splash, observe credits actually being typed.
 *
 * Requirements:
 *   - `python3 -m http.server 8765` (or any static server) serving the repo root.
 *   - `npm install` inside this test/ directory (one-time) — pulls in playwright.
 *   - `npx playwright install chromium` (one-time) — pulls the headless-shell binary.
 *
 * Run:
 *   node test/a3-verify.js
 *
 * Exit code = number of failed assertions.
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

function section(name) {
    console.log(`\n  ${name}`);
}

async function preflight() {
    // Verify the localhost server is up before we burn time launching chromium.
    try {
        const res = await fetch(`${BASE}/launcher/index.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
        console.error(`\nCannot reach ${BASE}/launcher/index.html (${e.message}).`);
        console.error(`Start a static server first:\n  python3 -m http.server 8765\n`);
        process.exit(2);
    }
}

async function launcherTests(browser) {
    section('Launcher UI + Enrichment Center Credits');

    // Fresh context — isolated localStorage.
    let ctx = await browser.newContext();
    let page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);

    // --- DOM render ---
    const chamberCount = await page.locator('.chamber').count();
    assert('4 chamber buttons render', chamberCount === 4, `got ${chamberCount}`);

    const expectedTargets = {
        '1': '../portal/?autoloop=1',
        '2': '../portal2/?autoloop=1',
        '3': '../portal2/portal1style/?autoloop=1',
        'r': 'RANDOM'
    };
    for (const key of Object.keys(expectedTargets)) {
        const target = await page.getAttribute(`.chamber[data-key="${key}"]`, 'data-target');
        assert(`chamber[data-key="${key}"] data-target = ${expectedTargets[key]}`,
            target === expectedTargets[key], `got ${target}`);
    }

    // --- Enrichment Center Credits initial state ---
    const textareaPresent = await page.locator('#customCredits').count();
    assert('customCredits textarea present', textareaPresent === 1);

    const maxlen = await page.getAttribute('#customCredits', 'maxlength');
    assert('textarea maxlength="20000"', maxlen === '20000', `got ${maxlen}`);

    const modeFieldsetHidden = await page.locator('#modeFieldset.hidden').count();
    assert('modeFieldset visible on empty load', modeFieldsetHidden === 0);

    const loopChecked = await page.locator('input[name="creditsMode"][value="loop"]').isChecked();
    assert('LOOP radio checked by default', loopChecked === true);

    const stopChecked = await page.locator('input[name="creditsMode"][value="stop"]').isChecked();
    assert('STOP radio not checked by default', stopChecked === false);

    const counter = await page.locator('#charCount').textContent();
    assert('char counter starts at "0 / 20,000"', counter === '0 / 20,000', `got "${counter}"`);

    const truncHidden = await page.locator('#truncNotice.hidden').count();
    assert('trunc notice hidden on load', truncHidden === 1);

    // --- Autosave on input ---
    await page.fill('#customCredits', 'hello\nworld');
    await page.waitForTimeout(50);
    const saved = await page.evaluate(() => localStorage.getItem('aperture.customCredits'));
    assert('autosave: localStorage.aperture.customCredits matches textarea',
        saved === 'hello\nworld', `got ${JSON.stringify(saved)}`);

    const counterAfter = await page.locator('#charCount').textContent();
    assert('char counter updates after input', counterAfter === '11 / 20,000', `got "${counterAfter}"`);

    // --- Mode toggle ---
    await page.locator('input[name="creditsMode"][value="stop"]').check();
    await page.waitForTimeout(50);
    const mode = await page.evaluate(() => localStorage.getItem('aperture.creditsMode'));
    assert('mode toggle: localStorage.aperture.creditsMode = "stop"',
        mode === 'stop', `got ${JSON.stringify(mode)}`);

    // --- 2,500-char threshold: modeFieldset hides ---
    const longText = 'x'.repeat(3000);
    await page.fill('#customCredits', longText);
    await page.waitForTimeout(50);
    const fieldsetHiddenAfter = await page.evaluate(
        () => document.getElementById('modeFieldset').classList.contains('hidden'));
    assert('modeFieldset hidden when length >= 2500', fieldsetHiddenAfter === true);

    // --- Back under threshold: modeFieldset shows ---
    await page.fill('#customCredits', 'short again');
    await page.waitForTimeout(50);
    const fieldsetVisAfter = await page.evaluate(
        () => !document.getElementById('modeFieldset').classList.contains('hidden'));
    assert('modeFieldset visible again when length < 2500', fieldsetVisAfter === true);

    // --- CLEAR button ---
    await page.click('#clearCredits');
    await page.waitForTimeout(50);
    const txtAfterClear = await page.inputValue('#customCredits');
    assert('CLEAR empties textarea', txtAfterClear === '');
    const storageAfterClear = await page.evaluate(() => localStorage.getItem('aperture.customCredits'));
    assert('CLEAR removes localStorage.aperture.customCredits', storageAfterClear === null);

    await ctx.close();

    // --- Persistence across reload (fresh context, seeded then reloaded) ---
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    await page.evaluate(() => {
        localStorage.setItem('aperture.customCredits', 'persisted line 1\npersisted line 2');
        localStorage.setItem('aperture.creditsMode', 'stop');
    });
    await page.reload();
    const hydrated = await page.inputValue('#customCredits');
    assert('hydration: textarea restored from localStorage',
        hydrated === 'persisted line 1\npersisted line 2',
        `got ${JSON.stringify(hydrated)}`);
    const stopAfterReload = await page.locator('input[name="creditsMode"][value="stop"]').isChecked();
    assert('hydration: STOP radio restored from localStorage', stopAfterReload === true);
    await ctx.close();

    // --- ?random=1 redirect ---
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/?random=1`, { waitUntil: 'load' });
    const finalUrl = page.url();
    const isVariant = /\/(portal|portal2|portal2\/portal1style)\//.test(finalUrl) &&
                      finalUrl.includes('autoloop=1') && finalUrl.includes('random=1');
    assert('?random=1 redirects to a variant URL with autoloop+random', isVariant, `got ${finalUrl}`);
    await ctx.close();

    // --- Paste-truncation notice ---
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await page.goto(`${BASE}/launcher/`);
    // Dispatch a paste event programmatically so inputType === 'insertFromPaste'.
    await page.evaluate(() => {
        const ta = document.getElementById('customCredits');
        ta.focus();
        // Push a string of MAX_CHARS so length === 20000 after insert.
        const big = 'p'.repeat(20000);
        ta.value = big;
        ta.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
    });
    await page.waitForTimeout(100);
    const truncVisible = await page.evaluate(
        () => !document.getElementById('truncNotice').classList.contains('hidden'));
    assert('paste-truncation notice shown when length === MAX_CHARS via insertFromPaste',
        truncVisible === true);
    await ctx.close();
}

async function variantOverrideTests(browser) {
    const variants = [
        { name: 'portal/',                path: '/portal/',                naturalDelay: 63 },
        { name: 'portal2/',               path: '/portal2/',               naturalDelay: 33 },
        { name: 'portal2/portal1style/',  path: '/portal2/portal1style/',  naturalDelay: 33 }
    ];

    for (const v of variants) {
        section(`Variant override: ${v.name}`);

        // --- EMPTY: no localStorage → original credits, no natural delay ---
        {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await page.goto(`${BASE}${v.path}`);
            await page.waitForFunction(() => window.cake && typeof window.cake.useNaturalDelay !== 'undefined');
            const state = await page.evaluate(() => ({
                useNaturalDelay: window.cake.useNaturalDelay,
                customCreditsLoop: window.cake.customCreditsLoop,
                naturalDelay: window.cake.naturalCreditsDelay,
                creditsLen: (window.credits || []).length
            }));
            assert(`[EMPTY] ${v.name} cake.useNaturalDelay === false`, state.useNaturalDelay === false);
            assert(`[EMPTY] ${v.name} cake.customCreditsLoop === false`, state.customCreditsLoop === false);
            assert(`[EMPTY] ${v.name} original credits intact (length > 50)`,
                state.creditsLen > 50, `got ${state.creditsLen}`);
            assert(`[EMPTY] ${v.name} cake.naturalCreditsDelay = ${v.naturalDelay}`,
                state.naturalDelay === v.naturalDelay, `got ${state.naturalDelay}`);
            await ctx.close();
        }

        // --- SHORT+LOOP: customCredits < 2500, mode=loop ---
        {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await page.goto(`${BASE}${v.path}`);
            await page.evaluate(() => {
                localStorage.setItem('aperture.customCredits', 'alpha\nbeta\ngamma');
                localStorage.setItem('aperture.creditsMode', 'loop');
            });
            await page.reload();
            await page.waitForFunction(() => window.cake && window.credits);
            const state = await page.evaluate(() => ({
                useNaturalDelay: window.cake.useNaturalDelay,
                customCreditsLoop: window.cake.customCreditsLoop,
                credits: window.credits
            }));
            assert(`[SHORT+LOOP] ${v.name} cake.useNaturalDelay === true`, state.useNaturalDelay === true);
            assert(`[SHORT+LOOP] ${v.name} cake.customCreditsLoop === true`, state.customCreditsLoop === true);
            assert(`[SHORT+LOOP] ${v.name} window.credits = split on \\n`,
                JSON.stringify(state.credits) === '["alpha","beta","gamma"]',
                `got ${JSON.stringify(state.credits).slice(0, 80)}`);
            await ctx.close();
        }

        // --- SHORT+STOP: customCredits < 2500, mode=stop ---
        {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await page.goto(`${BASE}${v.path}`);
            await page.evaluate(() => {
                localStorage.setItem('aperture.customCredits', 'one\ntwo');
                localStorage.setItem('aperture.creditsMode', 'stop');
            });
            await page.reload();
            await page.waitForFunction(() => window.cake && window.credits);
            const state = await page.evaluate(() => ({
                useNaturalDelay: window.cake.useNaturalDelay,
                customCreditsLoop: window.cake.customCreditsLoop,
                credits: window.credits
            }));
            assert(`[SHORT+STOP] ${v.name} cake.useNaturalDelay === true`, state.useNaturalDelay === true);
            assert(`[SHORT+STOP] ${v.name} cake.customCreditsLoop === false`, state.customCreditsLoop === false);
            assert(`[SHORT+STOP] ${v.name} window.credits = ["one","two"]`,
                JSON.stringify(state.credits) === '["one","two"]');
            await ctx.close();
        }

        // --- LONG: customCredits >= 2500, mode irrelevant ---
        {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await page.goto(`${BASE}${v.path}`);
            await page.evaluate(() => {
                const big = ('credit line\n').repeat(300); // ~3,600 chars
                localStorage.setItem('aperture.customCredits', big);
                localStorage.setItem('aperture.creditsMode', 'loop');
            });
            await page.reload();
            await page.waitForFunction(() => window.cake && window.credits);
            const state = await page.evaluate(() => ({
                useNaturalDelay: window.cake.useNaturalDelay,
                customCreditsLoop: window.cake.customCreditsLoop,
                creditsLen: window.credits.length
            }));
            assert(`[LONG] ${v.name} cake.useNaturalDelay === false (STRETCH kicks in)`,
                state.useNaturalDelay === false);
            assert(`[LONG] ${v.name} cake.customCreditsLoop === false (no loop at long lengths)`,
                state.customCreditsLoop === false);
            assert(`[LONG] ${v.name} window.credits still replaced (length > 100)`,
                state.creditsLen > 100, `got ${state.creditsLen}`);
            await ctx.close();
        }
    }
}

async function creditsOverflowGuardTests(browser) {
    section('Credits column overflow guard (regression: long custom credits bled into ASCII art)');

    // Portal 1 terminal layout variants: long URL credits used to wrap to
    // multiple visual lines, exceeding the 28em column height and bleeding
    // into the #picture region below. Fix added overflow:hidden on #credits
    // plus white-space:nowrap on credit/placeholder children.
    const variants = [
        { name: 'portal/',              path: '/portal/' },
        { name: 'portal2/portal1style/', path: '/portal2/portal1style/' }
    ];

    for (const v of variants) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.goto(`${BASE}${v.path}`);
        const overflow = await page.evaluate(
            () => getComputedStyle(document.getElementById('credits')).overflow);
        assert(`${v.name} #credits has overflow: hidden (stops bleed into picture region)`,
            overflow === 'hidden', `got "${overflow}"`);
        await ctx.close();
    }
}

async function scrollSmokeTests(browser) {
    section('Real-time scroll smoke (watching credits actually type)');

    // Per-variant: how long to wait before checking that credit chars are appearing.
    // portal/ has creditsStartTime=9s; portal2/ and portal2/portal1style/ start at 0.
    const variants = [
        { name: 'portal2/',              path: '/portal2/',              wait: 4000 },
        { name: 'portal2/portal1style/', path: '/portal2/portal1style/', wait: 4000 },
        { name: 'portal/',               path: '/portal/',               wait: 12000 }
    ];

    for (const v of variants) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        // Seed a short looping override so credits start typing quickly + visibly.
        await page.goto(`${BASE}${v.path}?autoloop=1`);
        await page.evaluate(() => {
            localStorage.setItem('aperture.customCredits',
                'AAAAA BBBBB CCCCC DDDDD EEEEE\nFFFFF GGGGG HHHHH IIIII JJJJJ\nKKKKK LLLLL MMMMM NNNNN OOOOO');
            localStorage.setItem('aperture.creditsMode', 'loop');
        });
        await page.reload();
        // Dismiss splash (click — same gesture a real user gives).
        await page.waitForSelector('#splash', { timeout: 5000 });
        await page.click('#splash');
        // Wait long enough for at least one credit line to type.
        await page.waitForTimeout(v.wait);
        const creditsText = await page.evaluate(() => {
            const el = document.getElementById('creditstext');
            return el ? el.textContent.replace(/\s+/g, '') : '';
        });
        // Strip the blinker cursor character so we know real chars appeared.
        const realChars = creditsText.replace(/[_ ]/g, '');
        assert(`[SCROLL] ${v.name} credit chars actually typed within ${v.wait}ms after splash dismiss`,
            realChars.length > 0,
            `got ${JSON.stringify(creditsText.slice(0, 60))}`);
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
        await launcherTests(browser);
        await variantOverrideTests(browser);
        await creditsOverflowGuardTests(browser);
        await scrollSmokeTests(browser);
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

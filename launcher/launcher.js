(function() {
'use strict';

// URLs point at index.html explicitly (not just the directory) so navigation
// works under HTTP servers, file:// access, WSL file shares (\\wsl.localhost),
// and Tauri's bundled webview — all of which handle directory URLs differently.
var VARIANTS = [
    '../portal/index.html?autoloop=1&random=1',
    '../portal2/index.html?autoloop=1&random=1',
    '../portal2/portal1style/index.html?autoloop=1&random=1'
];

function pickRandom() {
    return VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
}

// True for portal/ and portal2/portal1style/, false for portal2/ (gold theme intentionally untouched).
function supportsTextColor(url) {
    if (!url) return false;
    if (url.indexOf('portal2/portal1style/') !== -1) return true;
    if (url.indexOf('portal2/') !== -1) return false;
    if (url.indexOf('portal/') !== -1) return true;
    return false;
}

function applyTextColorParam(url) {
    if (!url || !supportsTextColor(url)) return url;
    var mode = safeGet(TEXTCOLOR_KEY) || 'default';
    if (mode === 'default') return url;
    var value;
    if (mode === 'cycle' || mode === 'rainbow') {
        value = mode;
    } else if (mode === 'custom') {
        var hex = safeGet(CUSTOM_COLOR_KEY);
        if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return url;
        value = hex;
    } else {
        return url;
    }
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'textcolor=' + encodeURIComponent(value);
}

function navigate(target) {
    if (target === 'RANDOM') {
        location.assign(applyTextColorParam(pickRandom()));
    } else {
        if (target) safeSet(LAST_VARIANT_KEY, target);
        location.assign(applyTextColorParam(target));
    }
}

var CREDITS_KEY = 'aperture.customCredits';
var MODE_KEY = 'aperture.creditsMode';
var TEXTCOLOR_KEY = 'aperture.textColorMode';
var CUSTOM_COLOR_KEY = 'aperture.customColor';
var LAST_VARIANT_KEY = 'aperture.lastVariant';
var MAX_CHARS = 20000;
var LOOP_THRESHOLD = 2500;

var params = new URLSearchParams(window.location.search);
if (params.get('random') === '1') {
    location.replace(applyTextColorParam(pickRandom()));
} else {
    document.querySelectorAll('.chamber').forEach(function(btn) {
        btn.addEventListener('click', function() {
            navigate(btn.getAttribute('data-target'));
        });
    });
    document.addEventListener('keydown', function(e) {
        if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
        var key = e.key.toLowerCase();
        var btn = document.querySelector('.chamber[data-key="' + key + '"]');
        if (btn) {
            e.preventDefault();
            navigate(btn.getAttribute('data-target'));
        }
    });
    initDisplayMode();
    initEnrichmentCredits();
    initOverrideTrack();
    focusLastVariant();
}

function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
}
function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
}

function focusLastVariant() {
    var last = safeGet(LAST_VARIANT_KEY);
    if (!last) return;
    var buttons = document.querySelectorAll('.chamber');
    for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].getAttribute('data-target') === last) {
            buttons[i].focus();
            return;
        }
    }
}

function initDisplayMode() {
    var radios = document.querySelectorAll('input[name="textColorMode"]');
    var picker = document.getElementById('customColor');
    if (!radios.length || !picker) return;

    var savedMode = safeGet(TEXTCOLOR_KEY) || 'default';
    var savedColor = safeGet(CUSTOM_COLOR_KEY);
    if (savedColor && /^#[0-9a-fA-F]{6}$/.test(savedColor)) {
        picker.value = savedColor;
    }
    var matched = false;
    radios.forEach(function(r) {
        if (r.value === savedMode) {
            r.checked = true;
            matched = true;
        }
    });
    if (!matched) {
        radios[0].checked = true;
        safeRemove(TEXTCOLOR_KEY);
    }
    refreshPicker();

    function refreshPicker() {
        var customSelected = document.querySelector('input[name="textColorMode"][value="custom"]').checked;
        if (customSelected) picker.classList.remove('hidden');
        else picker.classList.add('hidden');
    }

    radios.forEach(function(r) {
        r.addEventListener('change', function() {
            if (!r.checked) return;
            if (r.value === 'default') {
                safeRemove(TEXTCOLOR_KEY);
            } else {
                safeSet(TEXTCOLOR_KEY, r.value);
            }
            refreshPicker();
        });
    });

    picker.addEventListener('input', function() {
        if (/^#[0-9a-fA-F]{6}$/.test(picker.value)) {
            safeSet(CUSTOM_COLOR_KEY, picker.value);
        }
    });
}

function initEnrichmentCredits() {
    var textarea = document.getElementById('customCredits');
    var counter = document.getElementById('charCount');
    var truncNotice = document.getElementById('truncNotice');
    var modeFieldset = document.getElementById('modeFieldset');
    var loadBtn = document.getElementById('loadTxt');
    var picker = document.getElementById('txtPicker');
    var clearBtn = document.getElementById('clearCredits');
    if (!textarea) return;

    var noticeTimer = null;
    function showTruncNotice() {
        truncNotice.classList.remove('hidden');
        if (noticeTimer) clearTimeout(noticeTimer);
        noticeTimer = setTimeout(function() {
            truncNotice.classList.add('hidden');
        }, 5000);
    }

    function refreshMeta() {
        var len = textarea.value.length;
        counter.textContent = len.toLocaleString('en-US') + ' / 20,000';
        if (len < LOOP_THRESHOLD) {
            modeFieldset.classList.remove('hidden');
        } else {
            modeFieldset.classList.add('hidden');
        }
    }

    function persist() {
        if (textarea.value.length === 0) {
            safeRemove(CREDITS_KEY);
        } else {
            safeSet(CREDITS_KEY, textarea.value);
        }
    }

    var stored = safeGet(CREDITS_KEY) || '';
    textarea.value = stored;
    var storedMode = safeGet(MODE_KEY) || 'loop';
    var modeInput = document.querySelector('input[name="creditsMode"][value="' + storedMode + '"]');
    if (modeInput) modeInput.checked = true;
    refreshMeta();

    textarea.addEventListener('input', function(e) {
        if (e.inputType === 'insertFromPaste' && textarea.value.length === MAX_CHARS) {
            showTruncNotice();
        }
        persist();
        refreshMeta();
    });

    loadBtn.addEventListener('click', function() {
        picker.click();
    });

    picker.addEventListener('change', function() {
        var file = picker.files && picker.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function() {
            var text = String(reader.result || '');
            var truncated = false;
            if (text.length > MAX_CHARS) {
                text = text.slice(0, MAX_CHARS);
                truncated = true;
            }
            textarea.value = text;
            persist();
            refreshMeta();
            if (truncated) showTruncNotice();
        };
        reader.readAsText(file);
        picker.value = '';
    });

    clearBtn.addEventListener('click', function() {
        textarea.value = '';
        safeRemove(CREDITS_KEY);
        truncNotice.classList.add('hidden');
        refreshMeta();
    });

    document.querySelectorAll('input[name="creditsMode"]').forEach(function(input) {
        input.addEventListener('change', function() {
            if (input.checked) safeSet(MODE_KEY, input.value);
        });
    });
}

function idbOpen(callback) {
    try {
        var req = indexedDB.open('aperture', 1);
        req.onupgradeneeded = function() {
            var db = req.result;
            if (!db.objectStoreNames.contains('audio')) {
                db.createObjectStore('audio');
            }
        };
        req.onerror = function() { callback(null); };
        req.onsuccess = function() { callback(req.result); };
    } catch (e) { callback(null); }
}

function idbPutAudio(record, callback) {
    idbOpen(function(db) {
        if (!db) return callback(false);
        try {
            var tx = db.transaction('audio', 'readwrite');
            var putReq = tx.objectStore('audio').put(record, 'customAudio');
            putReq.onsuccess = function() { callback(true); };
            putReq.onerror = function() { callback(false); };
        } catch (e) { callback(false); }
    });
}

function idbGetAudio(callback) {
    idbOpen(function(db) {
        if (!db) return callback(null);
        try {
            var tx = db.transaction('audio', 'readonly');
            var getReq = tx.objectStore('audio').get('customAudio');
            getReq.onsuccess = function() { callback(getReq.result || null); };
            getReq.onerror = function() { callback(null); };
        } catch (e) { callback(null); }
    });
}

function idbDeleteAudio(callback) {
    idbOpen(function(db) {
        if (!db) return callback(false);
        try {
            var tx = db.transaction('audio', 'readwrite');
            var delReq = tx.objectStore('audio').delete('customAudio');
            delReq.onsuccess = function() { callback(true); };
            delReq.onerror = function() { callback(false); };
        } catch (e) { callback(false); }
    });
}

function formatDuration(secs) {
    if (!secs || !isFinite(secs)) return '0:00';
    var m = Math.floor(secs / 60);
    var s = Math.floor(secs % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function initOverrideTrack() {
    var section = document.getElementById('overrideTrack');
    var loadBtn = document.getElementById('loadAudio');
    var resetBtn = document.getElementById('resetAudio');
    var picker = document.getElementById('audioPicker');
    var status = document.getElementById('audioStatus');
    var errPill = document.getElementById('audioError');
    var wePill = document.getElementById('weDisabled');
    if (!section) return;

    var weMode = params.get('we') === '1' ||
                 typeof window.wallpaperPropertyListener !== 'undefined';
    if (weMode) {
        section.classList.add('disabled');
        loadBtn.disabled = true;
        resetBtn.disabled = true;
        wePill.classList.remove('hidden');
        return;
    }

    function refresh() {
        idbGetAudio(function(record) {
            errPill.classList.add('hidden');
            errPill.textContent = '';
            if (record && record.blob) {
                status.textContent = 'Audio: ' + record.filename + ' (' + formatDuration(record.durationSec) + ')';
                status.classList.remove('hidden');
            } else {
                status.classList.add('hidden');
                status.textContent = '';
            }
        });
    }

    function showError(msg) {
        errPill.textContent = msg;
        errPill.classList.remove('hidden');
    }

    refresh();

    loadBtn.addEventListener('click', function() { picker.click(); });

    picker.addEventListener('change', function() {
        var file = picker.files && picker.files[0];
        picker.value = '';
        if (!file) return;
        errPill.classList.add('hidden');
        var probeUrl = URL.createObjectURL(file);
        var probe = document.createElement('audio');
        probe.preload = 'metadata';
        var finished = false;
        function finish(durationSec, err) {
            if (finished) return;
            finished = true;
            URL.revokeObjectURL(probeUrl);
            if (err) {
                showError('Audio could not be loaded. Try a different file.');
                return;
            }
            idbPutAudio({ blob: file, filename: file.name, durationSec: durationSec }, function(ok) {
                if (ok) refresh();
                else showError('Storage write failed (IndexedDB quota or private mode).');
            });
        }
        probe.addEventListener('loadedmetadata', function() {
            finish(probe.duration && isFinite(probe.duration) ? probe.duration : 0, null);
        });
        probe.addEventListener('error', function() { finish(0, true); });
        setTimeout(function() { finish(0, true); }, 10000);
        probe.src = probeUrl;
    });

    resetBtn.addEventListener('click', function() {
        idbDeleteAudio(function(ok) {
            if (ok) refresh();
            else showError('Reset failed (IndexedDB error).');
        });
    });
}

})();

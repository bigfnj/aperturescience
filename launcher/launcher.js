(function() {
'use strict';

var VARIANTS = [
    '../portal/?autoloop=1&random=1',
    '../portal2/?autoloop=1&random=1',
    '../portal2/portal1style/?autoloop=1&random=1'
];

function pickRandom() {
    return VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
}

function navigate(target) {
    if (target === 'RANDOM') {
        location.assign(pickRandom());
    } else {
        location.assign(target);
    }
}

var CREDITS_KEY = 'aperture.customCredits';
var MODE_KEY = 'aperture.creditsMode';
var MAX_CHARS = 20000;
var LOOP_THRESHOLD = 2500;

var params = new URLSearchParams(window.location.search);
if (params.get('random') === '1') {
    location.replace(pickRandom());
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
    initEnrichmentCredits();
    initOverrideTrack();
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

    var weMode = params.get('we') === '1';
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

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

})();

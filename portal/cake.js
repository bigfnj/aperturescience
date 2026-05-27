/* Creative Commons License Portal End Credits Web by xBytez/TylaKitty/Valve is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License. Based on a work at https://xbytez.eu/. */
(function() {
'use strict';

var cake = {
    delayMultiplier: 1000,
    creditsStartTime: 9,
    creditsMaxTime: 173,
    blinkerTime: 0.3 * 1000,
    maxCredits: 15,
    firstLyricsIndex: 0,
    lastCreditsIndex: 0,
    naturalCreditsDelay: 63,
    useNaturalDelay: false,
    customCreditsLoop: false,
    userReady: false,
    audioReady: false,
    // Audio lead-in (ms) — matches Still Alive's 6.87s intro instrumental.
    // Set to 0 when a custom audio override is loaded (no shared sync to preserve).
    audioStartDelay: 6.87 * 1000,
    tryStart: function() {
        if (cake.userReady && cake.audioReady) {
            cake.init();
        }
    },
    init: function() {
        cake.lyricsdiv = document.getElementById('lyricstext');
        cake.creditsdiv = document.getElementById('creditstext');
        cake.drawLyricsBorder();
        cake.drawCreditsBorder();
        cake.initCredits();
        cake.initBlinker();
        setTimeout(function() {
            if (cake.player && cake.player.play) cake.player.play();
        }, cake.audioStartDelay);
        cake.processLyricLines();
        cake.processCreditLines();
    },
    initMusicPlayer: function(srcOverride) {
        cake.player = document.createElement('audio');
        if (cake.player.play) {
            cake.player.setAttribute('prebuffer', 'auto');
            cake.player.setAttribute('src', srcOverride || 'Still Alive.ogg');
            if (srcOverride) {
                cake.player.addEventListener('loadedmetadata', function() {
                    if (cake.player.duration && isFinite(cake.player.duration)) {
                        cake.creditsMaxTime = cake.player.duration;
                    }
                });
            }
            cake.player.addEventListener('canplaythrough', function() {
                cake.audioReady = true;
                cake.tryStart();
            });
            cake.player.addEventListener('ended', function() {
                if (!cake.autoloop) return;
                setTimeout(function() {
                    if (cake.random) location.assign('../launcher/?random=1');
                    else location.reload();
                }, 8000);
            });
            cake.player.load();
        } else {
            cake.audioReady = true;
            cake.tryStart();
        }
    },
    drawLyricsBorder: function() {
        var verttext = '';
        for (var x = 0; x < 30; x++) {
            verttext += '|<br />';
        }
        var horiztext = '';
        for (var x = 0; x < 47; x++) {
            horiztext += '-';
        }
        var left = document.getElementById('lyricsleft');
        left.innerHTML = verttext;
        var top = document.getElementById('lyricstop');
        top.innerHTML = horiztext;
        var right = document.getElementById('lyricsright');
        right.innerHTML = verttext;
        var bottom = document.getElementById('lyricsbottom');
        bottom.innerHTML = horiztext;
    },
    drawCreditsBorder: function() {
        var verttext = '';
        for (var x = 0; x < 16; x++) {
            verttext += '|<br />';
        }
        var horiztext = '';
        for (var x = 0; x < 47; x++) {
            horiztext += '-';
        }
        var left = document.getElementById('creditsleft');
        left.innerHTML = verttext;
        var top = document.getElementById('creditstop');
        top.innerHTML = horiztext;
        var right = document.getElementById('creditsright');
        right.innerHTML = verttext;
        var bottom = document.getElementById('creditsbottom');
        bottom.innerHTML = horiztext;
    },
    drawPictureBorder: function() {},
    initBlinker: function() {
        if (!cake.lyricsBlinker) {
            cake.lyricsBlinker = document.createElement("span");
            document.getElementById('lyricstext').appendChild(cake.lyricsBlinker);
            cake.blink(cake.lyricsBlinker);
        }
        if (!cake.creditsBlinker) {
            cake.creditsBlinker = document.createElement("span");
            cake.creditsBlinker.id = "creditsBlinker";
            document.getElementById('creditstext').appendChild(cake.creditsBlinker);
            cake.blink(cake.creditsBlinker);
        }
    },
    blink: function(blinker) {
        var nextChar = blinker.innerHTML;
        var newChar = '_';
        if (nextChar == '_')
            newChar = '&nbsp;';
        if (nextChar == '&nbsp;')
            newChar = '_';
        blinker.innerHTML = newChar;
        setTimeout(function() {
            cake.blink(blinker)
        }, cake.blinkerTime);
    },
    processLetter: function(type, lineindex, letter) {
        var line = document.getElementById(type + lineindex);
        if (line) {
            if (letter == "newline") {
                line.appendChild(document.createElement("br"));
            } else {
                if (letter == " ") letter = "\u00A0";
                line.appendChild(document.createTextNode(letter));
            }
        }
    },
    processLyricLine: function(index) {
        if (index < cake.firstLyricsIndex)
            return;
        var lastLineDiv;
        for (var lastIndex = index - 1; lastIndex >= 0 && !lastLineDiv && lyrics[lastIndex].clear == 0; lastIndex--) {
            lastLineDiv = document.getElementById('lyrics' + lastIndex);
        }
        var newlyrics = document.createElement("span");
        newlyrics.id = "lyrics" + index;
        if (lastLineDiv)
            cake.lyricsdiv.insertBefore(newlyrics, lastLineDiv.nextSibling);
        else {
            var nextLineDiv;
            for (var nextIndex = index + 1; nextIndex < index + 50 && !nextLineDiv; nextIndex++) {
                nextLineDiv = document.getElementById('lyrics' + nextIndex);
            }
            if (nextLineDiv)
                cake.lyricsdiv.insertBefore(newlyrics, nextLineDiv);
            else {
                cake.lyricsdiv.insertBefore(newlyrics, cake.lyricsBlinker);
            }
        }
        var curlyric = lyrics[index];
        if (curlyric['changepicture'] > -1)
            cake.setPicture(curlyric['changepicture']);
        var clear = curlyric['clear'];
        if (clear == 1) {
            cake.clearLyrics();
            cake.firstLyricsIndex = index;
        } else {
            var text = curlyric['text'];
            var delay = curlyric['delay'] * cake.delayMultiplier;
            var letterdelay = 0;
            if (text.length > 0) {
                letterdelay = delay / (text.length + 1);
            }
            for (var x = 0; x < text.length; x++) {
                setTimeout(cake.processLetter, letterdelay * x, 'lyrics', index, text.charAt(x));
            }
            if (curlyric['nonewline'] == 0) {
                setTimeout(cake.processLetter, letterdelay * text.length, 'lyrics', index, 'newline');
            }
        }
    },
    processLyricLines: function() {
        var delay = 0;
        for (var index = 0; index < lyrics.length; index++) {
            setTimeout(cake.processLyricLine, delay, index);
            delay += lyrics[index]['delay'] * cake.delayMultiplier;
        }
    },
    clearLyrics: function() {
        cake.lyricsdiv.innerHTML = "";
        cake.lyricsdiv.appendChild(cake.lyricsBlinker);
    },
    setPicture: function(id) {
        var picture = document.getElementById("picturetext");
        picture.textContent = '';
        var curart = asciiart['' + id + ''];
        if (curart) {
            for (const curline of curart) {
                const node = document.createElement("div");
                // substitute regular spaces with U+00A0 NBSP so ASCII art whitespace doesn't collapse
                node.textContent = curline.replace(/ /g, '\u00A0');
                picture.appendChild(node);
            }
        }
    },
    initCredits: function() {
        for (var index = 0 - cake.maxCredits; index < 0; index++) {
            var newcredits = document.createElement("div");
            newcredits.id = "credits" + index;
            newcredits.innerHTML = "&nbsp;";
            cake.creditsdiv.appendChild(newcredits);
        }
    },
    processCreditLine: function(index) {
        for (var lastIndex = cake.lastCreditsIndex - cake.maxCredits; lastIndex >= 0 - cake.maxCredits; lastIndex--) {
            var pastLineDiv = document.getElementById('credits' + lastIndex);
            if (pastLineDiv)
                cake.creditsdiv.removeChild(pastLineDiv);
            else
                break;
        }
        if (index < cake.lastCreditsIndex - cake.maxCredits)
            return;
        var lastLineDiv;
        for (var lastIndex = index - 1; lastIndex >= 0 && !lastLineDiv; lastIndex--) {
            lastLineDiv = document.getElementById('credits' + lastIndex);
        }
        var newcredits = document.createElement("span");
        newcredits.id = "credits" + index;
        if (lastLineDiv)
            cake.creditsdiv.insertBefore(newcredits, lastLineDiv.nextSibling);
        else
            cake.creditsdiv.insertBefore(newcredits, cake.creditsBlinker);
        if (index > cake.lastCreditsIndex)
            cake.lastCreditsIndex = index;
        var text = credits[index];
        for (var x = 0; x < text.length; x++) {
            setTimeout(cake.processLetter, cake.creditsDelay * x, 'credits', index, text.charAt(x));
        }
        if (index < credits.length - 1)
            setTimeout(cake.processLetter, cake.creditsDelay * text.length, 'credits', index, 'newline');
    },
    processCreditLines: function() {
        var totalchars = 0;
        for (var index = 0; index < credits.length; index++) {
            totalchars += credits[index].length + 1;
        }
        if (cake.useNaturalDelay) {
            cake.creditsDelay = cake.naturalCreditsDelay;
        } else {
            cake.creditsDelay = cake.creditsMaxTime * cake.delayMultiplier / totalchars;
        }
        var delay = cake.creditsStartTime * cake.delayMultiplier;
        for (var index = 0; index < credits.length; index++) {
            setTimeout(cake.processCreditLine, delay, index);
            delay += credits[index].length * cake.creditsDelay;
        }
        if (cake.customCreditsLoop) {
            setTimeout(cake.restartCustomCredits, delay + 1000);
        }
    },
    restartCustomCredits: function() {
        var blinker = cake.creditsBlinker;
        cake.creditsdiv.innerHTML = '';
        cake.lastCreditsIndex = 0;
        cake.initCredits();
        if (blinker) cake.creditsdiv.appendChild(blinker);
        cake.processCreditLines();
    }
};

window.cake = cake;

function applyCustomCredits() {
    var customCredits = '';
    var creditsMode = 'loop';
    try {
        customCredits = localStorage.getItem('aperture.customCredits') || '';
        creditsMode = localStorage.getItem('aperture.creditsMode') || 'loop';
    } catch (e) {}
    if (customCredits.trim().length === 0) return;
    window.credits = customCredits.split('\n');
    if (customCredits.length < 2500) {
        cake.useNaturalDelay = true;
        cake.customCreditsLoop = (creditsMode === 'loop');
    }
}

function loadCustomAudio(callback) {
    var done = false;
    function finish(blobUrl) {
        if (done) return;
        done = true;
        callback(blobUrl);
    }
    setTimeout(function() { finish(null); }, 1500);
    try {
        var req = indexedDB.open('aperture', 1);
        req.onupgradeneeded = function() {
            var db = req.result;
            if (!db.objectStoreNames.contains('audio')) {
                db.createObjectStore('audio');
            }
        };
        req.onerror = function() { finish(null); };
        req.onsuccess = function() {
            var db = req.result;
            try {
                if (!db.objectStoreNames.contains('audio')) { finish(null); return; }
                var tx = db.transaction('audio', 'readonly');
                var getReq = tx.objectStore('audio').get('customAudio');
                getReq.onerror = function() { finish(null); };
                getReq.onsuccess = function() {
                    var record = getReq.result;
                    if (record && record.blob) finish(URL.createObjectURL(record.blob));
                    else finish(null);
                };
            } catch (e) { finish(null); }
        };
    } catch (e) { finish(null); }
}

function applyCustomAudio() {
    loadCustomAudio(function(blobUrl) {
        if (blobUrl) cake.audioStartDelay = 0;
        cake.initMusicPlayer(blobUrl);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    var params = new URLSearchParams(window.location.search);
    cake.autoloop = params.get('autoloop') === '1';
    cake.random = params.get('random') === '1';
    applyCustomCredits();
    applyCustomAudio();
    var splash = document.getElementById('splash');
    var ready = false;
    function userReady() {
        if (ready) return;
        ready = true;
        splash.classList.add('fade');
        cake.userReady = true;
        cake.tryStart();
    }
    splash.addEventListener('click', userReady);
    document.addEventListener('keydown', function onKey(e) {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            document.removeEventListener('keydown', onKey);
            userReady();
        }
    });
    if (cake.autoloop) {
        setTimeout(userReady, 5000);
    }
});

})();

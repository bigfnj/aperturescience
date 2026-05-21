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
        var key = e.key.toLowerCase();
        var btn = document.querySelector('.chamber[data-key="' + key + '"]');
        if (btn) {
            e.preventDefault();
            navigate(btn.getAttribute('data-target'));
        }
    });
}

})();

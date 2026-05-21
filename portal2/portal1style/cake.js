// Creative Commons License
// Portal End Credits Web by TylaKitty/xBytez/Valve is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License.
// Based on a work at http://xbytez.eu/.
(function() {
'use strict';

var cake = {
    delayMultiplier:1000,

    creditsStartTime:0,
    creditsMaxTime:144,

    blinkerTime:0.3*1000,

    maxCredits:15,

    firstLyricsIndex:0,
    lastCreditsIndex:0,

    naturalCreditsDelay:33,
    useNaturalDelay:false,
    customCreditsLoop:false,

    init: function()
    {
        cake.lyricsdiv=document.getElementById('lyricstext');
        cake.creditsdiv=document.getElementById('creditstext');

        cake.drawLyricsBorder();
        cake.drawCreditsBorder();

        cake.initCredits();

        cake.initBlinker();

        cake.initMusicPlayer();

        cake.processLyricLines();
        cake.processCreditLines();

    },
    initMusicPlayer: function()
    {
        var delay = 0;
        cake.player=document.createElement('audio');
        if(cake.player.play)
        {
            cake.player.setAttribute('prebuffer', 'auto');
            cake.player.setAttribute('src','Want You Gone.mp3');
            cake.player.addEventListener('ended', function() {
                if (!cake.autoloop) return;
                setTimeout(function() {
                    if (cake.random) location.assign('../../launcher/?random=1');
                    else location.reload();
                }, 8000);
            });
            setTimeout(function() { cake.player.play(); }, delay);
        }
    },

    drawLyricsBorder: function()
    {
        var verttext='';
        for (var x=0; x<30; x++)
        {
            verttext+='|<br />';
        }
        var horiztext='';
        for (var x=0; x<47; x++)
        {
            horiztext+='-';
        }
        var left=document.getElementById('lyricsleft');
        left.innerHTML=verttext;

        var top=document.getElementById('lyricstop');
        top.innerHTML=horiztext;

        var right=document.getElementById('lyricsright');
        right.innerHTML=verttext;

        var bottom=document.getElementById('lyricsbottom');
        bottom.innerHTML=horiztext;

    },
    drawCreditsBorder: function()
    {
        var verttext='';
        for (var x=0; x<16; x++)
        {
            verttext+='|<br />';
        }
        var horiztext='';
        for (var x=0; x<47; x++)
        {
            horiztext+='-';
        }

        var left=document.getElementById('creditsleft');
        left.innerHTML=verttext;

        var top=document.getElementById('creditstop');
        top.innerHTML=horiztext;

        var right=document.getElementById('creditsright');
        right.innerHTML=verttext;

        var bottom=document.getElementById('creditsbottom');
        bottom.innerHTML=horiztext;
    },
    initBlinker: function()
    {
        if (!cake.lyricsBlinker)
        {
            cake.lyricsBlinker=document.createElement("span");
            document.getElementById('lyricstext').appendChild(cake.lyricsBlinker);
            cake.blink(cake.lyricsBlinker);
        }
        if (!cake.creditsBlinker)
        {
            cake.creditsBlinker=document.createElement("span");
            cake.creditsBlinker.id="creditsBlinker";
            document.getElementById('creditstext').appendChild(cake.creditsBlinker);
            cake.blink(cake.creditsBlinker);
        }
    },

    blink: function(blinker)
    {
        var nextChar=blinker.innerHTML;
        var newChar='_';
        if (nextChar=='_')
            newChar='&nbsp;';
        if (nextChar=='&nbsp;')
            newChar='_';
        blinker.innerHTML=newChar;

        setTimeout(function(){
            cake.blink(blinker)},cake.blinkerTime);

    },

    processLetter: function(type,lineindex,letter)
    {
        var line=document.getElementById(type+lineindex);
        if (line)
        {
            if (letter=="newline")
            {
                line.appendChild(document.createElement("br"));
            }
            else
            {
                if (letter==" ") letter="\u00A0";
                line.appendChild(document.createTextNode(letter));
            }
        }
    },
    processLyricLine: function(index)
    {
        if (index<cake.firstLyricsIndex)
            return;
        var lastLineDiv;

        for (var lastIndex=index - 1; lastIndex>=0 && !lastLineDiv && lyrics[lastIndex].clear==0; lastIndex--)
        {
            lastLineDiv=document.getElementById('lyrics'+lastIndex);
        }

        var newlyrics=document.createElement("span");
        newlyrics.id="lyrics"+index;
        if (lastLineDiv)
            cake.lyricsdiv.insertBefore(newlyrics,lastLineDiv.nextSibling);
        else
        {
            var nextLineDiv;
            for (var nextIndex = index + 1; nextIndex<index+50 && !nextLineDiv; nextIndex++)
            {
                nextLineDiv=document.getElementById('lyrics'+nextIndex);
            }
            if (nextLineDiv)
                cake.lyricsdiv.insertBefore(newlyrics,nextLineDiv);
            else
            {
                cake.lyricsdiv.insertBefore(newlyrics,cake.lyricsBlinker);
            }
        }
        //lyricsdiv.innerHTML+="<span id=\"lyrics"+index+"\"></span> ";

        var curlyric=lyrics[index];

        var clear=curlyric['clear'];
        if (clear==1)
        {
            cake.clearLyrics();
            cake.firstLyricsIndex=index;
        }
        else
        {
            var text=curlyric['text'];
            var delay=curlyric['delay']*cake.delayMultiplier;
            var letterdelay=0;
            if (text.length>0)
            {
                letterdelay=delay/(text.length+1);
            }
            for (var x=0; x<text.length; x++)
            {
                setTimeout(cake.processLetter, letterdelay*x, 'lyrics', index, text.charAt(x));
            }
            if (curlyric['nonewline']==0)
            {
                setTimeout(cake.processLetter, letterdelay*text.length, 'lyrics', index, 'newline');
            }
        }
    },
    processLyricLines: function()
    {
        var delay=0;
        for (var index=0; index<lyrics.length; index++)
        {
            setTimeout(cake.processLyricLine, delay, index);
            delay+=lyrics[index]['delay']*cake.delayMultiplier;
        }
    },

    clearLyrics: function()
    {
        cake.lyricsdiv.innerHTML="";
        cake.lyricsdiv.appendChild(cake.lyricsBlinker);
    },

    initCredits: function()
    {
        for (var index=0-cake.maxCredits; index<0; index++)
        {
            var newcredits=document.createElement("div");
            newcredits.id="credits"+index;
            newcredits.innerHTML="&nbsp;";
            cake.creditsdiv.appendChild(newcredits);
        }
    },

    processCreditLine: function(index)
    {
        for (var lastIndex=cake.lastCreditsIndex-cake.maxCredits; lastIndex>=0-cake.maxCredits; lastIndex--)
        {
            var pastLineDiv=document.getElementById('credits'+lastIndex);
            if (pastLineDiv)
                cake.creditsdiv.removeChild(pastLineDiv);
            else
                break;
        }

        if (index<cake.lastCreditsIndex-cake.maxCredits)    // too old
            return;

        var lastLineDiv;

        for (var lastIndex=index - 1; lastIndex>=0 && !lastLineDiv; lastIndex--)
        {
            lastLineDiv=document.getElementById('credits'+lastIndex);
        }
        var newcredits=document.createElement("span");
        newcredits.id="credits"+index;

        if (lastLineDiv)
            cake.creditsdiv.insertBefore(newcredits,lastLineDiv.nextSibling);
        else
            cake.creditsdiv.insertBefore(newcredits,cake.creditsBlinker);

        if (index>cake.lastCreditsIndex)
            cake.lastCreditsIndex=index;

        var text=credits[index];
        for (var x=0; x<text.length; x++)
        {
            setTimeout(cake.processLetter, cake.creditsDelay*x, 'credits', index, text.charAt(x));
        }
        if (index<credits.length-1)
            setTimeout(cake.processLetter, cake.creditsDelay*text.length, 'credits', index, 'newline');
    },

    processCreditLines: function()
    {
        var totalchars=0;
        for (var index=0; index<credits.length; index++)
        {
            totalchars+=credits[index].length+1;
        }
        if (cake.useNaturalDelay) {
            cake.creditsDelay=cake.naturalCreditsDelay;
        } else {
            cake.creditsDelay=cake.creditsMaxTime*cake.delayMultiplier/totalchars;
        }

        var delay=cake.creditsStartTime*cake.delayMultiplier;
        for (var index=0; index<credits.length; index++)
        {
            setTimeout(cake.processCreditLine, delay, index);
            delay+=credits[index].length*cake.creditsDelay;
        }
        if (cake.customCreditsLoop) {
            setTimeout(cake.restartCustomCredits, delay+1000);
        }

    },
    restartCustomCredits: function()
    {
        var blinker=cake.creditsBlinker;
        cake.creditsdiv.innerHTML='';
        cake.lastCreditsIndex=0;
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

document.addEventListener('DOMContentLoaded', function() {
    var params = new URLSearchParams(window.location.search);
    cake.autoloop = params.get('autoloop') === '1';
    cake.random = params.get('random') === '1';
    applyCustomCredits();
    var splash = document.getElementById('splash');
    var started = false;
    function startCake() {
        if (started) return;
        started = true;
        splash.classList.add('fade');
        cake.init();
    }
    splash.addEventListener('click', startCake);
    document.addEventListener('keydown', function onKey(e) {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            document.removeEventListener('keydown', onKey);
            startCake();
        }
    });
    if (cake.autoloop) {
        setTimeout(startCake, 5000);
    }
});

})();

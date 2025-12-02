// ==UserScript==
// @name         zyBooks Autocomplete
// @version      0.4
// @description  One click to speed up the boring parts, x2 checkbox correctly selected, toggleable run/stop
// @author       RobThePCGuy (Credit to Evanito https://github.com/Evanito/zyBAuto)
// @match        https://learn.zybooks.com/zybook/*
// @namespace    https://github.com/RobThePCGuy/zyBooks-Autocomplete
// @run-at       document-idle
// ==/UserScript==
// TO USE: Click Autocomplete! on a zyBooks page <-----

// ==== SETTINGS ====
var autoRun = false;
// interval between runs (ms)
var RUN_INTERVAL_MS = 5000;
// == END SETTINGS ==

// Do not edit below this line!
// ==========================================
(function() {
    console.log(timeString() + " [zBA] Begin zyBooks Autocomplete (fixed).");
    if (autoRun) {
        startRunner();
    } else {
        (function repeat() {
            try {
                const containers = document.getElementsByClassName('right-buttons');
                if (containers && containers[0]) {
                    const container = containers[0];

                    // Don't add duplicate button
                    if (!document.getElementById('zbaButton')) {
                        const btn = document.createElement('button');
                        btn.id = 'zbaButton';
                        btn.type = 'button';
                        btn.textContent = 'Autocomplete!';
                        btn.style.marginLeft = '8px';
                        btn.addEventListener("click", zBAStartButton, false);

                        // Add a stop button too (toggle)
                        const stopBtn = document.createElement('button');
                        stopBtn.id = 'zbaStopButton';
                        stopBtn.type = 'button';
                        stopBtn.textContent = 'Stop';
                        stopBtn.style.marginLeft = '8px';
                        stopBtn.disabled = true;
                        stopBtn.addEventListener("click", zBAStopButton, false);

                        container.appendChild(btn);
                        container.appendChild(stopBtn);
                    }
                } else {
                    throw new Error('no container yet');
                }
            } catch (error) {
                // keep trying until the UI is ready
                setTimeout(() => {
                    repeat();
                }, 1000);
            }
        })()
    }
})();

let _zbaIntervalId = null;
let _zbaRunning = false;

function zBAStartButton (zEvent) {
    console.log(timeString() + " [zBA] Start requested.");
    startRunner();
}

function zBAStopButton (zEvent) {
    stopRunner();
}

function startRunner() {
    if (_zbaRunning) {
        console.log(timeString() + " [zBA] Already running.");
        return;
    }
    _zbaRunning = true;
    // enable/disable UI
    const btn = document.getElementById('zbaButton');
    const stopBtn = document.getElementById('zbaStopButton');
    if (btn) btn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;

    // run immediately once, then on interval
    try {
        runOnceAndReport();
    } catch (e) {
        console.warn(timeString() + " [zBA] Run error:", e);
    }
    _zbaIntervalId = setInterval(() => {
        try {
            runOnceAndReport();
        } catch (e) {
            console.warn(timeString() + " [zBA] Run error:", e);
        }
    }, RUN_INTERVAL_MS);
}

function stopRunner() {
    if (!_zbaRunning) {
        return;
    }
    _zbaRunning = false;
    if (_zbaIntervalId) {
        clearInterval(_zbaIntervalId);
        _zbaIntervalId = null;
    }
    const btn = document.getElementById('zbaButton');
    const stopBtn = document.getElementById('zbaStopButton');
    if (btn) btn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    console.log(timeString() + " [zBA] Stopped.");
}

function runOnceAndReport() {
    // For each run, collect counts and log only a single summary line to avoid log spam
    let speedsChanged = click_speeds();
    let playsClicked = click_plays();
    let startsClicked = click_starts();

    if (speedsChanged + playsClicked + startsClicked > 0) {
        console.log(timeString() + ` [zBA] Actions this run: speeds=${speedsChanged}, plays=${playsClicked}, starts=${startsClicked}.`);
    }
    // If nothing left to do, automatically stop to avoid infinite polling
    // (This is conservative: if new content appears later, user can re-enable.)
    if (speedsChanged + playsClicked + startsClicked === 0) {
        // If you prefer continuous background operation, remove this automatic stop logic.
        stopRunner();
    }
}

function click_speeds() { // Checks speed boxes (selects the x2 checkbox inputs)
    var speedControls = document.querySelectorAll(".speed-control");
    let changed = 0;
    for (var i = 0; i < speedControls.length; i++) {
        try {
            const ctrl = speedControls[i];
            // If we've processed this control previously, skip
            if (ctrl.dataset.zbaProcessed === '1') continue;

            // Attempt to find a checkbox input inside the control
            const checkbox = ctrl.querySelector('input[type="checkbox"], input[type="radio"]');
            if (checkbox) {
                // If not checked, check it and fire change event
                if (!checkbox.checked) {
                    // prefer dispatching a click so site listeners run
                    checkbox.click();
                    // some UIs might need the 'change' event too
                    checkbox.dispatchEvent(new Event('change', {bubbles:true}));
                    changed++;
                }
                ctrl.dataset.zbaProcessed = '1';
            } else {
                // Some controls may be custom; try to detect label that contains "2x" and click it
                const label = Array.from(ctrl.querySelectorAll('label')).find(l => /2x|2×|2 x/i.test(l.textContent || ''));
                if (label) {
                    label.click();
                    changed++;
                    ctrl.dataset.zbaProcessed = '1';
                }
            }
        } catch (e) {
            // ignore single control errors
            console.debug(timeString() + " [zBA] speed control error:", e);
        }
    }
    return changed;
}

function click_plays() { // Clicks Play buttons, but only once per element
    var plays = document.getElementsByClassName("play-button");
    let clicked = 0;
    for (var i = 0; i < plays.length; i++) {
        try {
            const el = plays[i];
            // skip if already processed
            if (el.dataset.zbaPlayed === '1') continue;

            // Many play buttons toggle 'rotate-180' when in played state - don't replay if already rotated
            if (!(el.classList && el.classList.contains && el.classList.contains("rotate-180"))) {
                el.click();
                clicked++;
            }
            el.dataset.zbaPlayed = '1';
        } catch (e) {
            console.debug(timeString() + " [zBA] play click error:", e);
        }
    }
    return clicked;
}

function click_starts() { // Clicks Start buttons, but only once per element
    var starts = document.getElementsByClassName("start-button");
    let clicked = 0;
    for (var i = 0; i < starts.length; i++) {
        try {
            const el = starts[i];
            if (el.dataset.zbaStarted === '1') continue;
            el.click();
            clicked++;
            el.dataset.zbaStarted = '1';
        } catch (e) {
            console.debug(timeString() + " [zBA] start click error:", e);
        }
    }
    return clicked;
}

function timeString() {
    let d = new Date();
    let h = (d.getHours()<10?'0':'') + d.getHours();
    let m = (d.getMinutes()<10?'0':'') + d.getMinutes();
    let s = (d.getSeconds()<10?'0':'') + d.getSeconds();
    let dstr = h + ':' + m + ":" + s;
    return dstr;
}

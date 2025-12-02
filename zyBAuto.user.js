// ==UserScript==
// @name         zyBooks Autocomplete
// @version      0.4
// @description  Safer injector + diagnostic helpers to diagnose site issues (mutation logs, quiet-period gating, start/stop, click-once)
// @author       Evanito + RobThePCGuy
// @match        https://learn.zybooks.com/zybook/*
// @namespace    https://github.com/RobThePCGuy/zyBooks-Autocomplete
// @run-at       document-idle
// ==/UserScript==
//
// This userscript aims to avoid breaking zyBooks while still exercising play/start controls
// and collecting diagnostic information to reproduce the NotFoundError and similar race conditions.
//
// Usage:
//  - Wait for "Autocomplete (diagnostic)" button to appear in the .right-buttons area.
//  - Click to start/stop the runner.
//  - Use the "Diagnostics" checkbox to enable MutationObserver logs (recommended).
//  - Use "Aggressive" only when you need to reproduce a problem (it will repeatedly try clicks).
//  - When started the runner will only act after a quiet period (no DOM mutations) to reduce races.

(function () {
  'use strict';

  // Config
  const QUIET_MS = 800; // only act when no DOM mutations for this period
  const INTERVAL_MS = 1000; // check interval when running
  const CLICK_LIMIT_PER_TICK = 5; // safety: max clicks per tick to avoid spamming

  // State
  let running = false;
  let intervalHandle = null;
  let observer = null;
  let lastMutation = Date.now();
  let logs = [];
  window.zbaLogs = window.zbaLogs || logs; // expose for easy debugging

  // UI state
  let diagEnabled = true;
  let aggressive = false;

  // Provide a small `log` helper so early initialization messages don't throw
  // It will call pushLog once pushLog is available (function declarations are hoisted),
  // but if pushLog isn't available for some reason, it falls back to console.log.
  function log(msg, ...rest) {
    try {
      if (typeof pushLog === 'function') {
        pushLog(msg, ...rest);
      } else {
        console.log('[zBA] ' + msg, ...rest);
      }
    } catch (e) {
      console.log('[zBA] ' + msg, ...rest);
    }
  }

  log(timeString() + ' [zBA] Diagnostic userscript initializing');

  // Install global error / promise handlers to capture site exceptions in console with our prefix
  window.addEventListener('error', (ev) => {
    const msg = `[zBA][window.error] ${ev.message} @ ${ev.filename}:${ev.lineno}:${ev.colno}`;
    pushLog(msg, ev.error || null);
    // don't prevent default handling
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const msg = `[zBA][unhandledrejection] ${ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)}`;
    pushLog(msg, ev.reason || null);
  });

  // Insert control UI safely (non-destructive)
  (function repeatInsert() {
    tryInsertControlPanel();
    // Keep trying until container appears
    const container = document.getElementsByClassName('right-buttons')[0];
    if (!container) setTimeout(repeatInsert, 1000);
  })();

  function tryInsertControlPanel() {
    const container = document.getElementsByClassName('right-buttons')[0];
    if (!container) return false;
    if (document.getElementById('zbaControlPanel')) return true;

    const panel = document.createElement('div');
    panel.id = 'zbaControlPanel';
    panel.style.display = 'inline-flex';
    panel.style.alignItems = 'center';
    panel.style.gap = '6px';
    panel.style.marginLeft = '6px';
    panel.style.fontSize = '12px';

    const btn = document.createElement('button');
    btn.id = 'zbaButton';
    btn.type = 'button';
    btn.textContent = 'Autocomplete (diagnostic)';
    btn.style.padding = '6px';
    btn.addEventListener('click', () => {
      if (!running) {
        startRunner();
        btn.textContent = 'Stop Autocomplete';
      } else {
        stopRunner();
        btn.textContent = 'Autocomplete (diagnostic)';
      }
    }, false);

    const diagLabel = document.createElement('label');
    diagLabel.style.display = 'inline-flex';
    diagLabel.style.alignItems = 'center';
    diagLabel.style.gap = '4px';
    const diagCheckbox = document.createElement('input');
    diagCheckbox.type = 'checkbox';
    diagCheckbox.checked = diagEnabled;
    diagCheckbox.addEventListener('change', () => { diagEnabled = diagCheckbox.checked; pushLog('[zBA] Diagnostics ' + (diagEnabled ? 'enabled' : 'disabled')); });
    diagLabel.appendChild(diagCheckbox);
    diagLabel.appendChild(document.createTextNode('Diagnostics'));

    const aggLabel = document.createElement('label');
    aggLabel.style.display = 'inline-flex';
    aggLabel.style.alignItems = 'center';
    aggLabel.style.gap = '4px';
    const aggCheckbox = document.createElement('input');
    aggCheckbox.type = 'checkbox';
    aggCheckbox.checked = aggressive;
    aggCheckbox.addEventListener('change', () => { aggressive = aggCheckbox.checked; pushLog('[zBA] Aggressive mode ' + (aggressive ? 'ON' : 'OFF')); });
    aggLabel.appendChild(aggCheckbox);
    aggLabel.appendChild(document.createTextNode('Aggressive'));

    const dumpBtn = document.createElement('button');
    dumpBtn.type = 'button';
    dumpBtn.textContent = 'DumpState';
    dumpBtn.style.padding = '6px';
    dumpBtn.addEventListener('click', () => { dumpState(); });

    panel.appendChild(btn);
    panel.appendChild(diagLabel);
    panel.appendChild(aggLabel);
    panel.appendChild(dumpBtn);

    // Append safely
    container.appendChild(panel);
    pushLog(timeString() + ' [zBA] Control panel inserted safely');
    return true;
  }

  function startRunner() {
    if (running) return;
    running = true;
    pushLog(timeString() + ' [zBA] Runner starting');

    // Setup MutationObserver for diagnostics
    setupObserver();

    // Wait for a quiet period before first actions to reduce race with site rendering
    lastMutation = Date.now();
    intervalHandle = setInterval(() => {
      try {
        const quiet = (Date.now() - lastMutation) >= QUIET_MS;
        if (diagEnabled) pushLog(`[zBA] tick: quiet=${quiet} (lastMutation ${Date.now() - lastMutation}ms ago)`);
        if (quiet) {
          processOnce();
        } else if (aggressive) {
          // in aggressive mode, still try once per tick but log more
          processOnce();
        }
      } catch (err) {
        pushLog('[zBA] Runner tick error', err);
      }
    }, INTERVAL_MS);
  }

  function stopRunner() {
    if (!running) return;
    running = false;
    pushLog(timeString() + ' [zBA] Runner stopping');
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function processOnce() {
    let clicks = 0;
    // Click play buttons (but only once per element unless in aggressive mode)
    const plays = Array.from(document.getElementsByClassName('play-button'));
    for (let i = 0; i < plays.length && clicks < CLICK_LIMIT_PER_TICK; i++) {
      const p = plays[i];
      try {
        if (!isVisible(p)) continue;
        const rotated = p.classList && p.classList.contains('rotate-180');
        const already = p.dataset.zbaClicked && p.dataset.zbaClicked === '1';
        if (!rotated && (!already || aggressive)) {
          p.click();
          p.dataset.zbaClicked = '1';
          clicks++;
          pushLog(timeString() + ` [zBA] Clicked play button (#${i})`, shortElementInfo(p));
        }
      } catch (err) {
        pushLog('[zBA] click_plays error', err, shortElementInfo(p));
      }
    }

    // Click start buttons
    const starts = Array.from(document.getElementsByClassName('start-button'));
    for (let i = 0; i < starts.length && clicks < CLICK_LIMIT_PER_TICK; i++) {
      const s = starts[i];
      try {
        if (!isVisible(s)) continue;
        const already = s.dataset.zbaClicked && s.dataset.zbaClicked === '1';
        if (!already || aggressive) {
          s.click();
          s.dataset.zbaClicked = '1';
          clicks++;
          pushLog(timeString() + ` [zBA] Clicked start button (#${i})`, shortElementInfo(s));
        }
      } catch (err) {
        pushLog('[zBA] click_starts error', err, shortElementInfo(s));
      }
    }

    if (clicks === 0 && diagEnabled) {
      pushLog('[zBA] processOnce: no eligible buttons found this tick');
    }
  }

  // Mutation observer to help diagnose race conditions / DOM removals
  function setupObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      lastMutation = Date.now();
      if (!diagEnabled) return;
      for (const m of mutations) {
        if (m.type === 'childList') {
          if (m.addedNodes && m.addedNodes.length) {
            m.addedNodes.forEach((n) => {
              pushLog(`[zBA][mutation] added node: ${nodeSummary(n)}`, n);
            });
          }
          if (m.removedNodes && m.removedNodes.length) {
            m.removedNodes.forEach((n) => {
              pushLog(`[zBA][mutation] removed node: ${nodeSummary(n)}`, n);
              // helpful: if the removed node is an element we care about
              if (n instanceof Element) {
                if (n.classList.contains('start-button') || n.classList.contains('play-button') || n.classList.contains('right-buttons')) {
                  pushLog('[zBA][mutation] Removed one of our target node types', shortElementInfo(n));
                }
              }
            });
          }
        } else if (m.type === 'attributes') {
          pushLog(`[zBA][mutation] attributes changed on ${m.target && (m.target.id || m.target.className)}`, m);
        } else if (m.type === 'characterData') {
          pushLog(`[zBA][mutation] characterData changed on ${m.target && m.target.parentElement ? m.target.parentElement.nodeName : 'unknown'}`, m);
        }
      }
    });
    // Observe broadly but avoid extreme overhead: childList + subtree + attributes on body
    try {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      pushLog('[zBA] MutationObserver attached');
    } catch (err) {
      pushLog('[zBA] Failed to attach MutationObserver', err);
    }
  }

  // Helpers

  function isVisible(el) {
    if (!el) return false;
    // Basic: check if in DOM and visible
    if (!(el instanceof Element)) return false;
    if (!document.body.contains(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    // offsetParent null for fixed/visible sometimes; still accept offsetParent !== null as heuristic
    return el.offsetParent !== null || style.position === 'fixed';
  }

  function shortElementInfo(el) {
    if (!el) return { tag: String(el) };
    try {
      return {
        tag: el.tagName,
        id: el.id || undefined,
        classes: el.className || undefined,
        visible: isVisible(el),
        outer: (el.outerHTML || '').slice(0, 200)
      };
    } catch (err) {
      return { tag: 'error reading element' };
    }
  }

  function nodeSummary(n) {
    if (n instanceof Element) {
      return `[Element ${n.tagName} id=${n.id || ''} class=${(n.className || '').toString().slice(0, 80)}]`;
    } else if (n instanceof Text) {
      return `[Text "${n.data && n.data.trim().slice(0, 40)}"]`;
    } else {
      return `[Node type ${n.nodeType}]`;
    }
  }

  function dumpState() {
    const container = document.getElementsByClassName('right-buttons')[0];
    pushLog('[zBA] DumpState: snapshot ->');
    pushLog('  right-buttons exists: ' + !!container);
    if (container) pushLog('  right-buttons innerHTML (truncated): ' + (container.innerHTML || '').slice(0, 400));
    pushLog('  play-button count: ' + document.getElementsByClassName('play-button').length);
    pushLog('  start-button count: ' + document.getElementsByClassName('start-button').length);
    pushLog('  Recent logs (last 100):', logs.slice(-100));
    // Also expose logs as window.zbaLogs for easy copying
    console.log('[zBA] logs copied to window.zbaLogs (array)');
    window.zbaLogs = logs;
  }

  function pushLog(msg, ...rest) {
    const ts = timeString();
    const entry = { ts, msg, rest };
    logs.push(entry);
    // limit logs to reasonably sized array
    if (logs.length > 5000) logs.splice(0, logs.length - 5000);
    // Print to console with prefix so you can filter
    if (rest && rest.length) {
      console.log(`[zBA] ${ts} ${msg}`, ...rest);
    } else {
      console.log(`[zBA] ${ts} ${msg}`);
    }
  }

  function timeString() {
    const d = new Date();
    const h = (d.getHours() < 10 ? '0' : '') + d.getHours();
    const m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    const s = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
    return `${h}:${m}:${s}`;
  }

  // Expose a little API for interactive debugging from console
  window.zba = {
    start: startRunner,
    stop: stopRunner,
    dump: dumpState,
    logs: logs,
    setAggressive: (v) => { aggressive = !!v; pushLog('[zBA] aggressive set ' + aggressive); },
    setDiag: (v) => { diagEnabled = !!v; pushLog('[zBA] diagnostics set ' + diagEnabled); }
  };

})();

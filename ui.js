/* Shared motion, transient feedback and draggable glass sheets. */
(() => {
  'use strict';
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => window.matchMedia?.('(max-width: 700px)').matches;
  const jobs = new WeakMap(), sheets = new WeakMap(), rails = new Map();
  const now = () => window.performance?.now() ?? Date.now();
  const byId = id => document.getElementById(id);
  const historyKey = '__amiaPanelV35', historyOwner = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const panelStack = [], closedPanelTokens = new Set();
  let historySerial = 0, pendingHistoryCleanup = false;
  let toastElement, toastTimer = 0, toastAnimation, toastDrag = null, toastEpoch = 0;
  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';

  function cleanHistoryState(state) {
    if (!state || typeof state !== 'object') return state;
    const clean = { ...state }; delete clean[historyKey]; return clean;
  }
  // A reload starts with closed panels; remove a stale marker without navigation.
  try { if (history.state?.[historyKey]) history.replaceState(cleanHistoryState(history.state), '', location.href); } catch (_) {}
  function pushPanelHistory(record) {
    try {
      const previous = history.state;
      history.pushState({ ...(previous && typeof previous === 'object' ? previous : {}), [historyKey]: { owner: historyOwner, token: record.token, panel: record.panel.id } }, '', location.href);
      record.historyOwned = true;
    } catch (_) { record.historyOwned = false; }
  }
  function panelOpened(panel, { close }) {
    if (!panel) return;
    const existing = panelStack.find(record => record.panel === panel);
    if (existing) { existing.close = close; return; }
    const record = { panel, close, token: historyOwner + ':' + (++historySerial), historyOwned: false, fromBack: false };
    panelStack.push(record);
    // Closing a sheet traverses asynchronously. Do not push onto the entry being removed.
    if (!pendingHistoryCleanup) pushPanelHistory(record);
  }
  function panelClosed(panel) {
    const index = panelStack.findIndex(record => record.panel === panel);
    if (index < 0) return;
    const [record] = panelStack.splice(index, 1);
    if (!record.fromBack && record.historyOwned) closedPanelTokens.add(record.token);
    consumeClosedPanelEntry();
  }
  function consumeClosedPanelEntry() {
    const marker = history.state?.[historyKey];
    if (marker?.owner !== historyOwner || !closedPanelTokens.has(marker.token)) return false;
    closedPanelTokens.delete(marker.token);
    pendingHistoryCleanup = true;
    try { history.back(); return true; } catch (_) { pendingHistoryCleanup = false; return false; }
  }
  window.addEventListener('popstate', () => {
    if (pendingHistoryCleanup) {
      pendingHistoryCleanup = false;
      // An older sheet may have finished closing underneath the newer one.
      if (consumeClosedPanelEntry()) return;
      for (const record of panelStack) if (!record.historyOwned) pushPanelHistory(record);
      return;
    }
    const current = history.state?.[historyKey];
    const record = panelStack.at(-1);
    if (record && record.historyOwned && current?.token !== record.token) {
      record.fromBack = true;
      record.close();
      consumeClosedPanelEntry();
    } else if (!record && current) {
      // Forward may revisit a closed sheet marker; it must not trap future Back presses.
      try { history.replaceState(cleanHistoryState(history.state), '', location.href); } catch (_) {}
      closedPanelTokens.delete(current.token);
    }
  });

  function cancelJob(panel) {
    const job = jobs.get(panel);
    if (!job) return;
    clearTimeout(job.timer);
    job.animation?.cancel();
    jobs.delete(panel);
  }
  function clearSheetStyle(panel) {
    panel.style.removeProperty('transform');
    panel.style.removeProperty('opacity');
    panel.style.removeProperty('transition');
    panel.removeAttribute('data-sheet-dragging');
    panel.removeAttribute('data-sheet-closing');
  }
  function openSheet(panel) {
    if (!panel) return;
    cancelJob(panel); clearSheetStyle(panel);
    if (reduced() || typeof panel.animate !== 'function') return;
    const animation = panel.animate([
      { opacity: 0, transform: mobile() ? 'translateY(44px) scale(.985)' : 'translateY(12px) scale(.975)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: mobile() ? 420 : 280, easing: 'cubic-bezier(.18,.9,.22,1)', fill: 'both' });
    const job = { animation };
    jobs.set(panel, job);
    animation.finished?.then(() => {
      if (jobs.get(panel) !== job) return;
      animation.cancel(); jobs.delete(panel);
    }, () => {});
  }
  function closeSheet(panel, finalize) {
    if (!panel || panel.hasAttribute('data-sheet-closing')) return;
    cancelJob(panel);
    panel.setAttribute('data-sheet-closing', '');
    if (reduced() || typeof panel.animate !== 'function') { clearSheetStyle(panel); finalize(); return; }
    const from = panel.style.transform || 'translateY(0) scale(1)';
    const distance = Math.max(window.innerHeight - panel.getBoundingClientRect().top + 32, panel.offsetHeight + 32);
    const duration = mobile() ? 280 : 180;
    let done = false, job;
    const finish = () => {
      if (done || jobs.get(panel) !== job) return; done = true;
      clearTimeout(job?.timer);
      jobs.delete(panel); clearSheetStyle(panel);
      finalize();
      job?.animation?.cancel();
    };
    const animation = panel.animate([
      { opacity: 1, transform: from },
      { opacity: mobile() ? .12 : 0, transform: mobile() ? `translateY(${distance}px) scale(.985)` : 'translateY(10px) scale(.98)' }
    ], { duration, easing: 'cubic-bezier(.32,0,.72,.35)', fill: 'both' });
    job = { animation, timer: setTimeout(finish, duration + 70) };
    jobs.set(panel, job);
    animation.finished?.then(finish, finish);
  }
  function springBack(panel) {
    panel.removeAttribute('data-sheet-dragging');
    const from = panel.style.transform || 'translateY(0)';
    if (reduced() || typeof panel.animate !== 'function') { clearSheetStyle(panel); return; }
    const animation = panel.animate([{ transform: from }, { transform: 'translateY(0)' }], {
      duration: 380, easing: 'cubic-bezier(.2,1.22,.3,1)', fill: 'both'
    });
    const job = { animation }; jobs.set(panel, job);
    animation.finished?.then(() => {
      if (jobs.get(panel) !== job) return;
      clearSheetStyle(panel); jobs.delete(panel); animation.cancel();
    }, () => {});
  }
  function mountSheet(panel, { handle, close }) {
    if (!panel || sheets.has(panel)) return sheets.get(panel);
    const grab = typeof handle === 'string' ? panel.querySelector(handle) : handle;
    if (!grab) return;
    grab.setAttribute('data-sheet-grab', '');
    grab.setAttribute('role', 'button'); grab.tabIndex = 0;
    grab.setAttribute('aria-label', 'Закрыть панель. Можно потянуть вниз');
    grab.removeAttribute('aria-hidden');
    panel.classList.add('shared-sheet');
    let drag = null, suppressClickUntil = 0;
    const release = id => { try { if (grab.hasPointerCapture?.(id)) grab.releasePointerCapture(id); } catch (_) {} };
    grab.style.touchAction = 'none';
    function begin(event) {
      if (event.isPrimary === false || event.pointerType !== 'touch' && event.button !== 0 || panel.hasAttribute('data-sheet-closing')) return;
      cancelJob(panel); clearSheetStyle(panel);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: now(), dy: 0, active: false };
      try { grab.setPointerCapture(event.pointerId); } catch (_) {}
    }
    function move(event) {
      if (!drag || drag.id !== event.pointerId) return;
      const dy = Math.max(0, event.clientY - drag.y), dx = event.clientX - drag.x;
      if (!drag.active && Math.abs(dx) > dy + 8) { release(drag.id); drag = null; return; }
      if (!drag.active && dy < 4) return;
      event.preventDefault(); drag.active = true; drag.dy = dy;
      panel.setAttribute('data-sheet-dragging', '');
      panel.style.transform = `translateY(${dy}px)`;
    }
    grab.addEventListener('pointerdown', begin);
    // Track on window as well: WebViews can lose capture as a dialog is transformed.
    window.addEventListener('pointermove', move, { passive: false, capture: true });
    function finish(event, cancelled = false) {
      if (!drag || drag.id !== event.pointerId) return;
      const ended = drag; drag = null; release(ended.id);
      const dy = Math.max(ended.dy, event.clientY - ended.y, 0);
      const active = ended.active || dy >= 4;
      if (!active) return;
      event.preventDefault(); suppressClickUntil = Date.now() + 450;
      const velocity = dy / Math.max(1, now() - ended.time);
      const threshold = Math.min(120, Math.max(64, panel.offsetHeight * .2));
      if (!cancelled && (dy >= threshold || dy > 36 && velocity > .55)) { panel.style.transform = `translateY(${dy}px)`; close(); }
      else springBack(panel);
    }
    window.addEventListener('pointerup', event => finish(event), { capture: true });
    window.addEventListener('pointercancel', event => finish(event, true), { capture: true });
    window.addEventListener('blur', () => {
      if (!drag) return;
      const id = drag.id; drag = null; release(id); springBack(panel);
    });
    if (!window.PointerEvent) {
      const touchEvent = (event, touch) => ({ pointerId: touch.identifier, pointerType: 'touch', isPrimary: true, button: 0, clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => event.preventDefault() });
      grab.addEventListener('touchstart', event => { if (event.touches.length === 1) begin(touchEvent(event, event.touches[0])); }, { passive: true });
      window.addEventListener('touchmove', event => {
        const touch = [...event.changedTouches].find(touch => touch.identifier === drag?.id); if (touch) move(touchEvent(event, touch));
      }, { passive: false, capture: true });
      for (const type of ['touchend', 'touchcancel']) window.addEventListener(type, event => {
        const touch = [...event.changedTouches].find(touch => touch.identifier === drag?.id); if (touch) finish(touchEvent(event, touch), type === 'touchcancel');
      }, { capture: true });
    }
    grab.addEventListener('click', event => {
      if (event.detail !== 0 && Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
      close();
    });
    grab.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); close(); }
    });
    const api = { cancel() { if (drag) release(drag.id); drag = null; springBack(panel); } };
    sheets.set(panel, api); return api;
  }

  function mountSegmented(container, { onSelect }) {
    if (!container || rails.has(container) || typeof window.mountDragRail !== 'function') return;
    container.classList.add('glass-segmented');
    const rail = window.mountDragRail(container, {
      thumbSelector: '.glass-choice-thumb', thumbClass: 'glass-choice-thumb',
      commit: button => onSelect(button)
    });
    rails.set(container, rail);
    requestAnimationFrame(() => { if (container.isConnected) rail.reflow(); });
    return rail;
  }
  const railObserver = new MutationObserver(() => {
    for (const [container, rail] of rails) if (!container.isConnected) { rail.destroy?.(); rails.delete(container); }
  });
  if (document.body) railObserver.observe(document.body, { childList: true, subtree: true });

  function hideToast({ immediate = false, swipeX = 0, swipeY = 0 } = {}) {
    if (!toastElement || toastElement.hidden) return;
    const element = toastElement, epoch = ++toastEpoch;
    clearTimeout(toastTimer); toastAnimation?.cancel(); toastAnimation = null; toastDrag = null;
    const finish = () => {
      if (epoch !== toastEpoch) return;
      element.hidden = true; element.style.removeProperty('transform'); element.style.removeProperty('opacity');
      toastAnimation?.cancel(); toastAnimation = null;
    };
    if (immediate || reduced() || typeof element.animate !== 'function') { finish(); return; }
    const from = element.style.transform || 'translate(-50%,0) scale(1)';
    toastAnimation = element.animate([
      { opacity: 1, transform: from },
      { opacity: 0, transform: `translate(calc(-50% + ${swipeX}px),${swipeY || 14}px) scale(.96)` }
    ], { duration: 150, easing: 'cubic-bezier(.3,0,.7,.3)', fill: 'both' });
    toastAnimation.finished?.then(finish, () => {});
    setTimeout(finish, 190);
  }
  function ensureToast() {
    if (toastElement) return toastElement;
    const element = document.createElement('div'); element.id = 'glassToast'; element.className = 'glass-toast'; element.hidden = true;
    element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite'); element.setAttribute('aria-atomic', 'true');
    element.innerHTML = `<span class="glass-toast-mark">${checkIcon}</span><span class="glass-toast-text"></span><button type="button" class="glass-toast-close" aria-label="Скрыть уведомление">${closeIcon}</button>`;
    element.querySelector('button').addEventListener('click', () => hideToast());
    element.addEventListener('pointerdown', event => {
      if (event.isPrimary === false || event.button !== 0 || event.target.closest('button')) return;
      toastDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: now(), dx: 0, dy: 0 };
      toastAnimation?.cancel(); toastAnimation = null;
      clearTimeout(toastTimer);
      try { element.setPointerCapture(event.pointerId); } catch (_) {}
    });
    element.addEventListener('pointermove', event => {
      if (toastDrag?.id !== event.pointerId) return;
      event.preventDefault(); toastDrag.dx = event.clientX - toastDrag.x; toastDrag.dy = event.clientY - toastDrag.y;
      element.style.transform = `translate(calc(-50% + ${toastDrag.dx}px),${toastDrag.dy}px) scale(1)`;
      element.style.opacity = String(Math.max(.3, 1 - Math.hypot(toastDrag.dx, toastDrag.dy) / 260));
    }, { passive: false });
    function finish(event, cancelled = false) {
      if (toastDrag?.id !== event.pointerId) return;
      const ended = toastDrag; toastDrag = null;
      try { if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId); } catch (_) {}
      const distance = Math.hypot(ended.dx, ended.dy), velocity = distance / Math.max(1, now() - ended.time);
      if (!cancelled && (distance > 60 || distance > 25 && velocity > .6)) {
        hideToast({ swipeX: ended.dx * 2, swipeY: ended.dy * 2 }); return;
      }
      const from = element.style.transform || 'translate(-50%,0) scale(1)';
      element.style.removeProperty('transform'); element.style.removeProperty('opacity');
      if (!reduced() && typeof element.animate === 'function') {
        toastAnimation = element.animate([{ transform: from }, { transform: 'translate(-50%,0) scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,1.2,.3,1)' });
        toastAnimation.finished?.catch(() => {});
      }
      toastTimer = setTimeout(() => hideToast(), 1400);
    }
    element.addEventListener('pointerup', event => finish(event));
    element.addEventListener('pointercancel', event => finish(event, true));
    element.addEventListener('lostpointercapture', event => finish(event, true));
    window.addEventListener('blur', () => { if (toastDrag) finish({ pointerId: toastDrag.id }, true); });
    toastElement = element; return element;
  }
  function toast(text, { duration = 1400 } = {}) {
    if (!text) return;
    const element = ensureToast(); ++toastEpoch;
    clearTimeout(toastTimer); toastAnimation?.cancel(); toastAnimation = null; toastDrag = null;
    // An ordinary z-index cannot cover a native modal. Keep feedback in its top layer.
    const modals = [...document.querySelectorAll('dialog[open]')];
    const group = byId('groupOverlay');
    const host = modals.at(-1) || (group && !group.hidden ? byId('groupDialog') : document.body);
    host.append(element); element.querySelector('.glass-toast-text').textContent = text;
    element.hidden = false; element.style.removeProperty('transform'); element.style.removeProperty('opacity');
    if (!reduced() && typeof element.animate === 'function') {
      toastAnimation = element.animate([
        { opacity: 0, transform: 'translate(-50%,6px) scale(.98)' },
        { opacity: 1, transform: 'translate(-50%,0) scale(1)' }
      ], { duration: 180, easing: 'cubic-bezier(.2,.8,.25,1)' });
      toastAnimation.finished?.catch(() => {});
    }
    toastTimer = setTimeout(() => hideToast(), Math.max(500, Math.min(1800, duration)));
  }

  // All ordinary controls use one press/release response; rails keep stable geometry.
  let pressed = null;
  const pressTarget = target => target?.closest?.('button:not(:disabled),a[href],[role="button"]');
  const clearPress = () => { pressed?.element.removeAttribute('data-ui-pressed'); pressed?.rail?.classList.remove('is-touching'); pressed = null; };
  document.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || event.button !== 0) return;
    clearPress(); const element = pressTarget(event.target); if (!element) return;
    const rail = element.closest('.days,.segmented,.glass-segmented,#dateGrid');
    pressed = { element, rail, id: event.pointerId, x: event.clientX, y: event.clientY }; element.setAttribute('data-ui-pressed', 'true'); rail?.classList.add('is-touching');
  }, { capture: true, passive: true });
  document.addEventListener('pointermove', event => {
    if (pressed?.id === event.pointerId && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 9) clearPress();
  }, { capture: true, passive: true });
  for (const name of ['pointerup', 'pointercancel']) document.addEventListener(name, clearPress, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      const element = pressTarget(event.target); if (element) { clearPress(); const rail = element.closest('.days,.segmented,.glass-segmented,#dateGrid'); pressed = { element, rail }; element.setAttribute('data-ui-pressed', 'true'); rail?.classList.add('is-touching'); }
    }
  }, true);
  document.addEventListener('keyup', clearPress, true);
  window.addEventListener('blur', clearPress);
  document.addEventListener('close', event => {
    if (toastElement && !toastElement.hidden && event.target.contains?.(toastElement)) document.body.append(toastElement);
  }, true);

  function setupGroupSheet() {
    const panel = byId('groupDialog'), overlay = byId('groupOverlay');
    if (!panel || !overlay || typeof window.closeGroups !== 'function') return;
    const originalClose = window.closeGroups;
    window.closeGroups = function(...args) {
      if (overlay.hidden) return originalClose(...args);
      closeSheet(panel, () => {
        originalClose(...args);
        panelClosed(panel);
        if (args[0] === false) byId('groupBtn')?.focus();
      });
    };
    mountSheet(panel, { handle: '.handle', close: () => window.closeGroups() });
    new MutationObserver(() => {
      if (!overlay.hidden) { panelOpened(panel, { close: () => window.closeGroups() }); openSheet(panel); }
      else panelClosed(panel);
    }).observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.GlassUI = { toast, hideToast, openSheet, closeSheet, mountSheet, mountSegmented, panelOpened, panelClosed };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupGroupSheet, { once: true });
  else setupGroupSheet();
})();

/* Inline install invitation. Load with defer, after install.css. */
(() => {
  'use strict';
  // A previous invitation dismissal must not hide the restored v35 invitation.
  // Keep the legacy key untouched; only the explicit X below writes this key.
  const DISMISSED_KEY = 'sched_install_dismissed_at_v35';
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const isStandalone = () => standalone.matches || navigator.standalone === true;
  const icon = (body, className = '') => `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  const appIcon = icon('<rect x="5" y="3" width="14" height="18" rx="4"/><path d="M9 7h6M10 17h4"/>');
  const closeIcon = icon('<path d="m7 7 10 10M17 7 7 17"/>');
  const shareIcon = icon('<path d="M12 15V3m-4 4 4-4 4 4M7 11H5v9h14v-9h-2"/>');
  let pendingPrompt = null;
  let installed = isStandalone();
  let prompt;
  let dialog;
  let lastFocus;
  let oldOverflow = '';
  let inertElements = [];
  let helpClosing = false;

  function wasDismissed() {
    try {
      const at = Number(localStorage.getItem(DISMISSED_KEY));
      const elapsed = Date.now() - at;
      return Number.isFinite(at) && at > 0 && elapsed >= 0 && elapsed < WEEK;
    } catch (_) { return false; }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch (_) {}
    if (prompt) prompt.hidden = true;
  }

  function sync() {
    if (!prompt) return;
    prompt.hidden = installed || isStandalone() || wasDismissed();
    const action = prompt.querySelector('[data-install-action]');
    action.textContent = pendingPrompt ? 'Установить' : 'Как установить';
    const native = dialog?.querySelector('[data-native-install]');
    if (native) native.hidden = !pendingPrompt || installed;
  }

  function deviceInstructions() {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) return {
      title: 'На экран «Домой»',
      steps: [
        `В браузере нажмите «Поделиться» ${shareIcon}. Если кнопки нет, откройте расписание в Safari.`,
        'Выберите «На экран „Домой“». Этот пункт может находиться ниже в списке действий.',
        'Нажмите «Добавить». Расписание появится рядом с другими приложениями.'
      ]
    };
    if (/Macintosh|Mac OS X/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)) return {
      title: 'Добавить в Dock',
      steps: [
        'В Safari откройте меню «Файл» и выберите «Добавить в Dock».',
        'Подтвердите название и нажмите «Добавить».',
        'Открывайте расписание с помощью значка в Dock. Если пункта нет, проверьте доступные обновления Safari и macOS.'
      ]
    };
    if (/Android/.test(ua)) return {
      title: 'Всегда под рукой',
      steps: [
        'Откройте меню браузера рядом с адресной строкой.',
        'Выберите «Установить приложение» или «Добавить на главный экран», если такой пункт доступен.',
        'Подтвердите добавление. Расписание появится на домашнем экране.'
      ]
    };
    return {
      title: 'Открывать как приложение',
      steps: [
        'В Chrome или Edge найдите значок установки в адресной строке либо пункт установки приложения в меню браузера.',
        'Выберите установку расписания и подтвердите действие.',
        'Если установка недоступна, добавьте страницу в закладки. В Safari на Mac используется «Файл» → «Добавить в Dock».'
      ]
    };
  }

  function restoreBackground() {
    window.GlassUI?.panelClosed?.(dialog);
    helpClosing = false;
    document.body.style.overflow = oldOverflow;
    inertElements.forEach(([element, wasInert]) => { element.inert = wasInert; });
    inertElements = [];
    if (lastFocus?.isConnected) lastFocus.focus();
  }

  function closeHelp() {
    if (!dialog?.open || helpClosing) return;
    helpClosing = true;
    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;
      if (typeof dialog.close === 'function') dialog.close();
      else { dialog.removeAttribute('open'); restoreBackground(); }
    };
    if (typeof window.GlassUI?.closeSheet === 'function') window.GlassUI.closeSheet(dialog, finalize);
    else finalize();
  }

  function openHelp() {
    if (!dialog || dialog.open) return;
    lastFocus = document.activeElement;
    const content = deviceInstructions();
    dialog.querySelector('#installTitle').textContent = content.title;
    dialog.querySelector('.install-steps').innerHTML = content.steps.map(step => `<li>${step}</li>`).join('');
    dialog.querySelector('.install-dialog-note').textContent = installed || isStandalone()
      ? 'Расписание уже открыто как приложение.'
      : 'Группа и оформление сохраняются на этом устройстве. После первого открытия с интернетом расписание доступно офлайн.';
    sync();
    oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else {
      dialog.setAttribute('open', '');
      inertElements = [...document.body.children].filter(element => element !== dialog).map(element => [element, element.inert]);
      inertElements.forEach(([element]) => { element.inert = true; });
    }
    if (typeof window.GlassUI?.openSheet === 'function') window.GlassUI.openSheet(dialog);
    window.GlassUI?.panelOpened?.(dialog, { close: closeHelp });
    dialog.querySelector('[data-close-install]').focus();
  }

  async function install() {
    if (!pendingPrompt) { openHelp(); return; }
    const event = pendingPrompt;
    pendingPrompt = null;
    const buttons = [prompt?.querySelector('[data-install-action]'), dialog?.querySelector('[data-native-install]')].filter(Boolean);
    buttons.forEach(button => { button.disabled = true; });
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') { installed = true; closeHelp(); }
    } catch (_) {
      openHelp();
    } finally {
      buttons.forEach(button => { button.disabled = false; });
      sync();
    }
  }

  function initialize() {
    const main = document.querySelector('main');
    if (!main) return;
    prompt = document.getElementById('installPrompt');
    if (!prompt) {
      prompt = document.createElement('section');
      prompt.id = 'installPrompt';
      const calendar = main.querySelector('.calendar');
      if (calendar) calendar.after(prompt);
      else main.prepend(prompt);
    }
    prompt.classList.add('install-prompt');
    prompt.setAttribute('aria-labelledby', 'installPromptTitle');
    prompt.innerHTML = `<div class="install-prompt-layout"><span class="install-app-icon">${appIcon}</span><div class="install-prompt-copy"><h2 id="installPromptTitle">Расписание как приложение</h2><p>Один значок. Всё под рукой.</p></div><button class="install-action" data-install-action type="button">Как установить</button><button class="install-dismiss" type="button" aria-label="Скрыть предложение установки на неделю">${closeIcon}</button></div>`;
    prompt.querySelector('[data-install-action]').addEventListener('click', install);
    prompt.querySelector('.install-dismiss').addEventListener('click', dismiss);

    dialog = document.createElement('dialog');
    dialog.id = 'installDialog';
    dialog.className = 'install-dialog';
    dialog.setAttribute('aria-labelledby', 'installTitle');
    dialog.setAttribute('aria-describedby', 'installNote');
    dialog.innerHTML = `<div class="install-dialog-handle" aria-hidden="true"></div><div class="install-dialog-header"><span class="install-app-icon">${appIcon}</span><button class="install-dismiss" type="button" data-close-install aria-label="Закрыть инструкцию">${closeIcon}</button></div><p class="install-eyebrow">РАСПИСАНИЕ · ПРИЛОЖЕНИЕ</p><h2 id="installTitle"></h2><ol class="install-steps"></ol><p class="install-dialog-note" id="installNote"></p><button class="install-action install-native" data-native-install type="button" hidden>Установить приложение</button><button class="install-done" type="button" data-done-install>Понятно</button>`;
    document.body.append(dialog);
    if (typeof window.GlassUI?.mountSheet === 'function') {
      window.GlassUI.mountSheet(dialog, { handle: '.install-dialog-handle', close: closeHelp });
    }
    dialog.querySelector('[data-close-install]').addEventListener('click', closeHelp);
    dialog.querySelector('[data-done-install]').addEventListener('click', closeHelp);
    dialog.querySelector('[data-native-install]').addEventListener('click', install);
    dialog.addEventListener('close', restoreBackground);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeHelp(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeHelp();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape' && typeof dialog.showModal !== 'function') { event.preventDefault(); closeHelp(); }
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('button:not([hidden]):not(:disabled),a[href]')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    let help = document.getElementById('installHelp');
    if (!help) {
      help = document.createElement('button');
      help.id = 'installHelp';
      help.type = 'button';
      help.className = 'install-help';
      help.innerHTML = `${appIcon}<span>Приложение</span>`;
      help.setAttribute('aria-label', 'Как установить расписание как приложение');
      help.title = 'Установить расписание как приложение';
      (main.querySelector('footer .footer-actions') || main.querySelector('footer .footer-top') || main.querySelector('footer') || main).append(help);
    }
    help.addEventListener('click', openHelp);
    sync();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (installed || isStandalone()) return;
    pendingPrompt = event;
    sync();
  });
  window.addEventListener('appinstalled', () => { installed = true; pendingPrompt = null; closeHelp(); sync(); });
  const displayChanged = () => { if (isStandalone()) { installed = true; closeHelp(); } sync(); };
  if (standalone.addEventListener) standalone.addEventListener('change', displayChanged);
  else if (standalone.addListener) standalone.addListener(displayChanged);
  window.addEventListener('pageshow', sync);
  window.addEventListener('storage', event => { if (event.key === DISMISSED_KEY || event.key === null) sync(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();

/* Questions come only from the supplied curriculum maps. No inferred answers. */
(() => {
  'use strict';
  const data = window.CURRICULUM_DATA || { subjects: [] };
  const subjects = data.subjects;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const plain = value => String(value ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const icons = {
    book: svg('<path d="M12 6C8 3 4 4 3 5v14c3-2 6-1 9 1 3-2 6-3 9-1V5c-1-1-5-2-9 1Z"/><path d="M12 6v14"/>'),
    chevron: svg('<path d="m9 5 7 7-7 7"/>'),
    back: svg('<path d="m14 6-6 6 6 6"/>'),
    close: svg('<path d="m7 7 10 10M17 7 7 17"/>'),
    copy: svg('<rect x="8" y="8" width="12" height="13" rx="3"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/>'),
    check: svg('<path d="m5 12 4 4L19 6"/>'),
    search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'),
    folder: svg('<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/><path d="M3 10h18"/>'),
    external: svg('<path d="M8 16 17 7M8 7h9v9"/>')
  };
  const kinds = {
    lecture: { label: 'Лекция', action: 'План лекции', field: 'lectures' },
    seminar: { label: 'Семинар', action: 'Вопросы к семинару', field: 'seminars' },
    practical: { label: 'Практическое', action: 'К практическому занятию', field: 'practicals' }
  };
  const kindOf = type => type === 'practice' ? 'practical' : type;
  const lectureFolder = 'https://drive.google.com/drive/u/0/mobile/folders/1uhkJoeVkKWGur3FtXbzJRynd_Itu3DJM';
  const subjectFor = name => {
    const aliases = {
      'гражданское право (часть 2)': 'гражданское право',
      'уголовное право (особенная часть)': 'уголовное право'
    };
    const key = plain(name);
    return subjects.find(subject => plain(subject.name) === (aliases[key] || key));
  };
  const sessionsFor = (topic, kind) => {
    const sessions = (topic.sessions || []).filter(session => session.kind === kind && session.questions?.length);
    if (sessions.length) return sessions;
    const questions = topic[kinds[kind]?.field] || [];
    return questions.length ? [{ kind, code: null, questions, sourcePages: topic.sourcePages || [] }] : [];
  };
  const availableKinds = topic => Object.keys(kinds).filter(kind => sessionsFor(topic, kind).length);
  function codes(value) {
    return String(value || '').replace(/\s/g, '').split(',').flatMap(part => {
      // In this timetable, 13/1 and 17-18/2 mean sublessons, not topics 1 or 2.
      const slashRange = part.match(/^(\d+)[–-](\d+)\/(\d+(?:[./]\d+)*)$/);
      if (slashRange && +slashRange[2] >= +slashRange[1] && +slashRange[2] - +slashRange[1] < 100) {
        const suffix = slashRange[3].replace(/\//g, '.');
        return Array.from({ length: +slashRange[2] - +slashRange[1] + 1 }, (_, index) => `${+slashRange[1] + index}.${suffix}`);
      }
      part = part.replace(/\//g, '.');
      const range = part.match(/^(\d+)[–-](\d+)$/);
      if (range && +range[2] >= +range[1] && +range[2] - +range[1] < 100) return Array.from({ length: +range[2] - +range[1] + 1 }, (_, index) => String(+range[1] + index));
      return part ? [part] : [];
    });
  }
  const topicHas = (topic, code) => topic.number != null && codes(topic.number).some(number => codes(code).includes(number));
  const codeKey = value => codes(value).join(',');
  const questionsFor = set => set.questions || set.session.questions;
  function verifiedFor(subject, kind, code) {
    const mapping = (subject.verifiedMappings || []).find(item => item.kind === kind && codeKey(item.code) === codeKey(code));
    if (!mapping) return [];
    return mapping.blocks.flatMap(block => {
      const topic = subject.topics[block.topicIndex], session = topic?.sessions[block.sessionIndex];
      if (!session || session.kind !== kind) return [];
      const questions = block.questionIndexes ? block.questionIndexes.map(index => session.questions[index]).filter(Boolean) : session.questions;
      return questions.length ? [{ topic, session, questions, displayCode: code, verified: true }] : [];
    });
  }
  function resolve(lesson) {
    const subject = subjectFor(lesson.subject), kind = kindOf(lesson.type);
    if (!subject || !kinds[kind]) return null;
    const sets = [], missing = [], seen = new Set();
    let fallback = false;
    function append(set) {
      if (!seen.has(set.session)) { seen.add(set.session); sets.push(set); return; }
      const previous = sets.find(item => item.session === set.session);
      if (previous.questions && !set.questions) {
        delete previous.questions;
        delete previous.displayCode;
        delete previous.verified;
      } else if (previous.questions && set.questions) {
        previous.questions = previous.session.questions.filter(question => previous.questions.includes(question) || set.questions.includes(question));
        if (previous.displayCode !== set.displayCode) previous.displayCode = lesson.theme;
      }
    }
    const whole = verifiedFor(subject, kind, lesson.theme || '');
    if (whole.length) return { subject, kind, sets: whole, missing, fallback, requested: lesson.theme || '' };
    // Keep combined sublesson codes intact until their verified lookup runs.
    // Expanding 17-18/2 first would lose the shared 17.2,18.2 mapping.
    for (const segment of String(lesson.theme || '').split(',').map(value => value.trim()).filter(Boolean)) {
      const grouped = verifiedFor(subject, kind, segment);
      if (grouped.length) { grouped.forEach(append); continue; }
      for (const code of codes(segment)) {
      const verified = verifiedFor(subject, kind, code);
      if (verified.length) {
        verified.forEach(append);
        continue;
      }
      // A literal row code is authoritative only when the lesson kind also matches.
      let found = false;
      for (const topic of subject.topics) {
        const exact = sessionsFor(topic, kind).filter(session => session.code === code);
        if (!exact.length) continue;
        exact.forEach(session => append({ topic, session }));
        found = true;
      }
      if (found) continue;
      const exactTopics = subject.topics.filter(item => topicHas(item, code));
      const topics = exactTopics.length ? exactTopics : subject.topics.filter(item => topicHas(item, code.split('.')[0]));
      const available = topics.flatMap(topic => sessionsFor(topic, kind).map(session => ({ topic, session })));
      if (!available.length) { missing.push(code); continue; }
      // A parent topic is useful, but is never presented as a verified sublesson.
      if (code.includes('.') || available.length > 1) fallback = true;
      available.forEach(append);
      }
    }
    return { subject, kind, sets, missing, fallback, requested: lesson.theme || '' };
  }
  function card(lesson) {
    const match = resolve(lesson);
    if (!match) return '';
    const count = match.sets.reduce((sum, set) => sum + questionsFor(set).length, 0);
    const label = count ? kinds[match.kind].action : 'Материалы по предмету';
    return `<button type="button" class="study-lesson-action" data-study-subject="${escape(lesson.subject)}" data-study-kind="${escape(match.kind)}" data-study-theme="${escape(lesson.theme || '')}" aria-haspopup="dialog">${icons.book}<span>${label}</span>${count ? `<span class="study-count">${count}</span>` : ''}${icons.chevron}</button>`;
  }
  window.StudyMaterials = { card, resolve, buildPrompt: preparationPrompt, buildSearchQuery, searchUrl };

  let dialog, body, title, eyebrow, back, lastFocus, previousOverflow = '', inertElements = [], view = null, copyText = '', librarySubject = '', query = '';
  let sheetOpen = false, sheetClosing = false;
  let materialRail = null;
  const copyTimers = new WeakMap(), copyDefaults = new WeakMap();
  const byId = id => document.getElementById(id);
  const topicLabel = topic => topic.number == null ? '' : `Тема ${topic.number}`;
  const visibleTopic = topic => topic.number != null && availableKinds(topic).length;
  function closeSubjectPicker(restoreFocus = false) {
    const list = byId('studySubjectList'), button = byId('studySubject');
    if (!list || list.hidden) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }
  function setupSubjectPicker() {
    const picker = byId('studySubjectPicker'), button = byId('studySubject'), list = byId('studySubjectList');
    const options = [...list.querySelectorAll('[data-study-filter]')];
    let active = options.findIndex(option => option.dataset.studyFilter === librarySubject);
    function focusOption(index) {
      active = Math.max(0, Math.min(options.length - 1, index));
      options.forEach((option, item) => { option.tabIndex = item === active ? 0 : -1; });
      options[active].focus();
      options[active].scrollIntoView({ block: 'nearest' });
    }
    function openPicker(index = active) {
      list.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      focusOption(index);
    }
    function select(option) {
      librarySubject = option.dataset.studyFilter;
      const label = subjects.find(subject => subject.id === librarySubject)?.name || 'Все дисциплины';
      button.querySelector('span').textContent = label;
      button.setAttribute('aria-label', 'Предмет: ' + label);
      button.title = label;
      options.forEach(item => item.setAttribute('aria-selected', String(item === option)));
      active = options.indexOf(option);
      closeSubjectPicker(true);
      drawResults();
    }
    button.addEventListener('click', () => list.hidden ? openPicker() : closeSubjectPicker(true));
    list.addEventListener('click', event => {
      const option = event.target.closest('[data-study-filter]');
      if (option) select(option);
    });
    picker.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !list.hidden) {
        event.preventDefault(); event.stopPropagation(); closeSubjectPicker(true); return;
      }
      if (event.key === 'Tab' && !list.hidden) { closeSubjectPicker(true); return; }
      const navigation = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (navigation.includes(event.key)) {
        event.preventDefault();
        const wasHidden = list.hidden;
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : wasHidden ? active : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        openPicker(index);
      } else if (!list.hidden && event.target !== button && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); select(options[active]);
      }
    });
  }
  function open({ preserveFocus = false } = {}) {
    if (dialog.open) { if (!preserveFocus) byId('studyClose').focus(); return; }
    sheetOpen = true;
    sheetClosing = false;
    lastFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog.showModal) dialog.showModal();
    else {
      dialog.setAttribute('open', '');
      inertElements = [...document.body.children].filter(element => element !== dialog).map(element => [element, element.inert]);
      inertElements.forEach(([element]) => { element.inert = true; });
    }
    if (window.GlassUI?.panelOpened) window.GlassUI.panelOpened(dialog, { close });
    if (window.GlassUI?.openSheet) window.GlassUI.openSheet(dialog);
    byId('studyClose').focus();
  }
  function restore() {
    closeSubjectPicker();
    document.body.style.overflow = previousOverflow;
    inertElements.forEach(([element, inert]) => { element.inert = inert; });
    inertElements = [];
    if (lastFocus?.isConnected) lastFocus.focus();
  }
  function finalizeClose() {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheetClosing = false;
    if (dialog.open) {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    }
    if (window.GlassUI?.panelClosed) window.GlassUI.panelClosed(dialog);
    restore();
  }
  function close() {
    closeSubjectPicker();
    if (!sheetOpen || sheetClosing) return;
    sheetClosing = true;
    if (window.GlassUI?.closeSheet) window.GlassUI.closeSheet(dialog, finalizeClose);
    else finalizeClose();
  }
  function announce(text, { quiet = false, duration = 1400 } = {}) {
    const status = byId('studyStatus'), toast = window.GlassUI?.toast;
    const useToast = !!toast && !quiet;
    status.classList.toggle('sr-only', quiet || !!toast);
    status.textContent = useToast ? '' : text;
    if (useToast && text) window.GlassUI.toast(text, { duration });
  }
  function showLibrary(subjectId = '', keepQuery = false) {
    materialRail = null;
    view = { type: 'library' };
    librarySubject = subjectId;
    if (!keepQuery) query = '';
    eyebrow.textContent = 'УЧЕБНЫЕ ПРОГРАММЫ';
    title.textContent = 'Материалы занятий';
    back.hidden = true;
    const selectedName = subjects.find(subject => subject.id === librarySubject)?.name || 'Все дисциплины';
    body.innerHTML = `<a class="study-drive-link" href="${lectureFolder}" target="_blank" rel="noopener noreferrer" aria-label="Материалы лекций на Google Диске — открыть в новой вкладке"><span class="study-drive-icon">${icons.folder}</span><span class="study-drive-copy"><strong>Материалы лекций</strong><small>Google Диск</small></span>${icons.external}</a><div class="study-filters"><label class="study-search">${icons.search}<input id="studySearch" type="search" placeholder="Найти тему или вопрос" aria-label="Найти тему или вопрос" value="${escape(query)}" autocomplete="off"></label><div class="study-subject-picker" id="studySubjectPicker"><button type="button" id="studySubject" class="study-subject-trigger" aria-label="Предмет: ${escape(selectedName)}" title="${escape(selectedName)}" aria-haspopup="listbox" aria-expanded="false" aria-controls="studySubjectList"><span>${escape(selectedName)}</span>${icons.chevron}</button><div id="studySubjectList" class="study-subject-menu" role="listbox" aria-label="Предмет" hidden>${[{ id: '', name: 'Все дисциплины' }, ...subjects].map((subject, index) => `<button type="button" role="option" id="studySubjectOption${index}" class="study-subject-option" data-study-filter="${escape(subject.id)}" aria-selected="${subject.id === librarySubject}" tabindex="-1"><span>${escape(subject.name)}</span>${icons.check}</button>`).join('')}</div></div></div><div id="studyResults" class="study-results" aria-live="polite"></div>`;
    byId('studySearch').addEventListener('input', event => { query = event.target.value; drawResults(); });
    setupSubjectPicker();
    drawResults();
    body.scrollTop = 0;
    open();
  }
  function drawResults() {
    const term = plain(query), chosen = subjects.filter(subject => !librarySubject || subject.id === librarySubject);
    const container = byId('studyResults');
    if (!term && !librarySubject) {
      container.innerHTML = `<div class="study-subjects">${subjects.map(subject => `<button type="button" class="study-subject-row" data-study-browse="${escape(subject.id)}"><span class="study-subject-icon">${icons.book}</span><span><strong>${escape(subject.name)}</strong><small>${subject.topics.filter(visibleTopic).length} тем</small></span>${icons.chevron}</button>`).join('')}</div>`;
      return;
    }
    const found = [];
    for (const subject of chosen) subject.topics.forEach((topic, index) => {
      if (!visibleTopic(topic)) return;
      const allText = [subject.name, topic.number, topic.title, ...Object.values(kinds).flatMap(kind => topic[kind.field] || [])].join(' ');
      if (!term || plain(allText).includes(term)) found.push({ subject, topic, index });
    });
    container.innerHTML = `<p class="study-result-count">${found.length ? `Тем: ${found.length}` : 'Ничего не найдено'}</p><div class="study-topic-list">${found.slice(0, 80).map(({ subject, topic, index }) => `<button type="button" class="study-topic-row" data-study-topic="${index}" data-study-owner="${escape(subject.id)}"><span class="study-topic-meta">${!librarySubject ? `${escape(subject.name)} · ` : ''}${escape(topicLabel(topic))}</span><strong>${escape(topic.title || topicLabel(topic))}</strong><span class="study-kind-labels">${availableKinds(topic).map(kind => `<span data-kind="${kind}">${kinds[kind].label}</span>`).join('')}</span>${icons.chevron}</button>`).join('')}</div>${found.length > 80 ? '<p class="study-result-count study-search-limit">Уточните запрос, чтобы увидеть остальные темы.</p>' : ''}`;
  }
  function showTopic(subject, topic, preferredKind) {
    const available = availableKinds(topic);
    const kind = available.includes(preferredKind) ? preferredKind : available.includes('seminar') ? 'seminar' : available[0];
    if (!kind) return;
    showQuestions({ subject, kind, sets: sessionsFor(topic, kind).map(session => ({ topic, session })), missing: [], fallback: false, requested: topic.number || '', topic });
  }
  function showQuestions(match) {
    if (!match) return;
    closeSubjectPicker();
    view = { type: 'questions', match };
    const { subject, kind, sets } = match;
    eyebrow.textContent = kinds[kind].action.toUpperCase();
    title.textContent = subject.name;
    back.hidden = false;
    back.setAttribute('aria-label', 'Все темы по предмету');
    const uniqueTopics = [...new Set(sets.map(set => set.topic))];
    const topic = match.topic || (uniqueTopics.length === 1 ? uniqueTopics[0] : null);
    const available = topic ? availableKinds(topic) : [];
    const retainedRail = available.length > 1 && materialRail?.subject === subject && materialRail.topic === topic && materialRail.element.parentNode === body ? materialRail : null;
    copyText = `${subject.name}\n${kinds[kind].label}${match.requested ? ' · Тема ' + match.requested : ''}\n${match.fallback ? 'Показана тема целиком; точная привязка подпункта не подтверждена.\n' : ''}\n` + sets.map(set => {
      const heading = set.topic.number != null ? `${topicLabel(set.topic)}. ${set.topic.title}\n` : '';
      const code = set.displayCode || set.session.code;
      return heading + (code ? `Занятие ${code}\n` : '') + questionsFor(set).map((question, index) => `${index + 1}. ${question}`).join('\n');
    }).join('\n\n');
    const heading = topic && (topic.number != null || match.requested) ? `<div class="study-topic-heading"><span>${escape(match.requested ? 'Тема ' + match.requested : topicLabel(topic))}</span>${topic.number != null ? `<h3>${escape(topic.title)}</h3>` : ''}</div>` : '';
    const switches = available.length > 1 ? `<div class="study-kind-switch glass-segmented" role="group" aria-label="Вид занятия">${available.map(item => `<button type="button" data-study-switch="${item}" aria-pressed="${item === kind}">${kinds[item].label}</button>`).join('')}</div>` : '';
    const notice = match.fallback ? '<p class="study-notice">Показана тема целиком: точная привязка подпункта пока не подтверждена.</p>' : '';
    const missing = sets.length && match.missing.length ? `<p class="study-notice">Вопросы к теме ${escape(match.missing.join(', '))} пока не добавлены.</p>` : '';
    const questions = sets.length ? `<div class="study-copy-bar"><button type="button" class="study-copy-primary" data-study-copy="plain">${icons.copy}<span>Скопировать все</span></button><button type="button" class="study-copy-ai" data-study-copy="ai" title="Скопировать вопросы с запросом для подготовки">Для ИИ ${icons.copy}</button></div><div class="study-question-groups">${sets.map((set, groupIndex) => {
      const { topic: item, session, displayCode } = set;
      const groupTitle = !topic && item.number != null ? `${topicLabel(item)}. ${item.title}` : displayCode || session.code ? `Занятие ${displayCode || session.code}` : `${kinds[kind].label} ${session.numberWithinTopic || groupIndex + 1}`;
      return `<section class="study-question-group">${!topic || sets.length > 1 ? `<h3>${escape(groupTitle)}</h3>` : ''}<ol class="study-questions">${questionsFor(set).map((question, index) => `<li><span class="study-question-text">${escape(question)}</span><span class="study-question-actions"><button type="button" class="study-question-copy" data-study-question="${groupIndex}:${index}" aria-label="Скопировать вопрос ${index + 1}" title="Скопировать вопрос ${index + 1}"><span class="study-question-copy-face">${icons.copy}</span></button><a class="study-question-search" href="${escape(searchUrl(question, subject, item))}" target="_blank" rel="noopener noreferrer" aria-label="Найти вопрос ${index + 1} в Google — откроется новая вкладка" title="${escape(buildSearchQuery(question, subject, item))}"><span class="study-question-copy-face">${icons.search}</span></a></span></li>`).join('')}</ol></section>`;
    }).join('')}</div>` : `<div class="study-missing"><span class="study-subject-icon">${icons.book}</span><h3>Материалов к этой теме пока нет</h3><p>Выберите другую тему в каталоге.</p></div>`;
    const content = notice + missing + questions + `<button type="button" class="study-other-topics" data-study-browse="${escape(subject.id)}">Все темы по предмету ${icons.chevron}</button>`;
    if (retainedRail) {
      // Keep the rail, thumb and focused button connected while replacing content.
      [...body.childNodes].forEach(child => { if (child !== retainedRail.element) child.remove(); });
      retainedRail.element.insertAdjacentHTML('beforebegin', heading);
      retainedRail.element.insertAdjacentHTML('afterend', content);
    } else {
      body.innerHTML = heading + switches + content;
      materialRail = null;
      body.querySelectorAll('[data-study-switch]').forEach(button => button.addEventListener('click', () => {
        showTopic(subject, topic, button.dataset.studySwitch);
        body.querySelector(`[data-study-switch="${button.dataset.studySwitch}"]`)?.focus({ preventScroll: true });
      }));
    }
    const rail = body.querySelector('.study-kind-switch');
    rail?.querySelectorAll('[data-study-switch]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.studySwitch === kind)));
    body.scrollTop = 0;
    announce('');
    open({ preserveFocus: !!retainedRail });
    if (rail && !retainedRail) materialRail = { element: rail, subject, topic, api: null };
    if (rail && !retainedRail && window.GlassUI?.mountSegmented) {
      rail.classList.add('has-glass-segments');
      materialRail.api = window.GlassUI.mountSegmented(rail, { onSelect: button => button.click() });
    } else if (retainedRail?.api?.reflow) {
      const reflow = () => { if (retainedRail.element.isConnected) retainedRail.api.reflow(true); };
      if (window.requestAnimationFrame) window.requestAnimationFrame(reflow);
      else setTimeout(reflow, 0);
    }
  }
  function fallbackCopy(text) {
    const selection = window.getSelection(), ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
    const focused = document.activeElement, input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('aria-label', 'Текст для копирования');
    input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
    dialog.append(input);
    input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    input.remove();
    if (focused?.isConnected) focused.focus();
    if (selection) { selection.removeAllRanges(); ranges.forEach(range => selection.addRange(range)); }
    return copied;
  }
  // Search uses the question itself, not instructions to an AI. Add only the
  // context missing from a short question and a jurisdiction when law matters.
  function buildSearchQuery(question, subject, topic) {
    const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim().replace(/[.?!;:\s]+$/gu, '');
    const questionText = clean(question).replace(/^(?:вопрос\s+)?\d+(?:\.\d+)*[.)]\s+/iu, '');
    const name = clean(typeof subject === 'string' ? subject : subject?.name);
    const title = clean(typeof topic === 'string' ? topic : topic?.title);
    if (!questionText) return '';
    const hasBelarus = value => /беларус|белорус|(?:^|\s)РБ(?=\s|[.,;:()]|$)/iu.test(value);
    const foreignScope = /российск|россии|(?:^|\s)РФ(?=\s|[.,;:()]|$)|СССР|РСФСР|(?:^|\s)США(?=\s|[.,;:()]|$)|германи|франци|великобритани|англии|кита[йяею]|япони|зарубежн[а-яё-]*\s+(?:государств|стран)|зарубежных государств/iu;
    const theoryHistory = /(?:^|[\s.,;(])(?:истори[яию]|историческ|становлени|зарождени)|возникновение\s+и\s+развитие\s+(?:налогообложени|науки|криминологи)|этапы развития|научн[а-яё-]*\s+(?:школ|теори)|методолог/iu;
    const legalScienceQuestion = /законодательств|нормативн[а-яё-]*\s+(?:правов|акт|источник|регулирован|предписан)|кодекс|(?:^|\s)(?:УПК|ГК|УК|НК|КоАП)(?=\s|[.,;:()]|$)|правов[а-яё-]*(?:\s*,?\s*(?:и\s+)?(?:научн[а-яё-]*|организационн[а-яё-]*))*\s+(?:основ|основан|регулирован|статус|регламентац|норм)|процессуальн[а-яё-]*\s+(?:основ|поряд|требован)/iu;
    const scientific = /криминолог|криминалист/iu.test(name);
    const lawCourse = /право|процесс/iu.test(name);
    const needsBelarus = !hasBelarus(questionText) && !foreignScope.test(questionText) && !foreignScope.test(title) && (scientific ? legalScienceQuestion.test(questionText) : lawCourse && !theoryHistory.test(questionText));
    const generic = new Set('понятие понятия признаки виды вид значение сущность содержание характеристика общая общие основные основы положения особенности структура система классификация предмет метод методы задачи функции цели цель формы форма роль место вопросы вопрос порядок условия развитие наука теории теория научные научная'.split(' '));
    const tokens = value => plain(value).match(/[а-яёa-z0-9]+/giu) || [];
    const terms = value => tokens(value).filter(word => word.length > 2 && !generic.has(word)).map(word => /^криминолог/iu.test(word) ? 'криминология' : /^криминалист/iu.test(word) ? 'криминалистика' : /^купл/iu.test(word) ? 'купл' : /^прав[оа]/iu.test(word) ? 'прав' : word.slice(0, 5));
    const questionTerms = new Set(terms(questionText));
    const covers = (value, known) => terms(value).every(term => known.has(term));
    const parts = [questionText];
    // A complete named question already supplies its own topic. For a generic
    // one, select a relevant clause instead of attaching a long combined title.
    const jurisdictionContext = foreignScope.test(title) && !foreignScope.test(questionText) && !hasBelarus(questionText);
    const relativeQuestion = /^(?:объект|объективная сторона|субъект|субъективная сторона|форма договора)(?=\s|[.,:;]|$)/iu.test(questionText) && questionTerms.size <= 3;
    if (title && (questionTerms.size <= 1 || relativeQuestion || jurisdictionContext)) {
      const clauses = title.split(/[.;]\s+/u).map(clean).filter(Boolean);
      const overlap = value => [...new Set(terms(value))].filter(term => questionTerms.has(term)).length;
      clauses.sort((a, b) => overlap(b) - overlap(a));
      let context = clauses[0] || '';
      if (!needsBelarus && !hasBelarus(questionText)) context = context.replace(/(?:^|\s)(?:в\s+)?(?:Республик[аиуе]\s+Беларус[ьи]|Беларус[ьи]|РБ)(?=\s|[.,;:()]|$)/giu, ' ').replace(/\s+/gu, ' ').trim();
      const contextWords = context.split(' ');
      if (contextWords.length > 14) context = contextWords.slice(0, 14).join(' ').replace(/\s+(?:и|в|на|по|с|для|из|к|о|об)$/iu, '');
      if (context && !covers(context, questionTerms)) parts.push(context);
    }
    const known = new Set(terms(parts.join(' ')));
    if (name && !covers(name, known)) parts.push(name);
    if (needsBelarus && !foreignScope.test(parts.join(' ')) && !hasBelarus(parts.join(' '))) parts.push('Республика Беларусь');
    return parts.join('. ');
  }
  function searchUrl(question, subject, topic) {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('q', buildSearchQuery(question, subject, topic));
    return url.href;
  }
  function preparationPrompt(match, text) {
    const name = match.subject.name;
    const theoretical = /криминолог|криминалист/i.test(name);
    const format = {
      lecture: 'Сначала покажи логику темы, затем раскрой каждый пункт коротким тезисным конспектом: основные понятия, связи между ними и один поясняющий пример.',
      seminar: 'Для каждого пункта подготовь опору для устного ответа: главная мысль, несколько аргументов и короткий пример. Выдели понятия, которые легко перепутать.',
      practical: 'Разбери порядок выполнения: исходные данные, последовательность действий и проверка результата. Если дан только теоретический вопрос, объясни его применение. Придуманные примеры явно пометь как учебные.'
    }[match.kind] || 'Разбери основные понятия и покажи, как они связаны.';
    const parts = [
      `Собери рабочий материал по дисциплине «${name}». Формат занятия: ${kinds[match.kind]?.label.toLowerCase() || 'занятие'}.`,
      format,
      theoretical
        ? 'Опирайся на научные понятия, теории, методы и практические приёмы. Объясняй причинные связи и границы применимости методов.'
        : 'Соединяй понятия с условиями их применения. Правовые правила раскрывай только там, где они нужны для ответа.'
    ];
    const explicitLegalQuestion = /законодательств|нормативн|кодекс|стать[яиею]|правов(?:ые|ая|ое|ого|ых)\s+основан/i.test(text);
    if (!theoretical || explicitLegalQuestion) parts.push('Если ответ зависит от действующей нормы, используй право Республики Беларусь и проверь её актуальность. Называй акт и статью лишь при подтверждённой ссылке; при отсутствии проверки обозначь это. Для теоретических пунктов перечень нормативных актов не нужен.');
    parts.push('Сохрани номера вопросов. Отделяй проверяемые факты от научных трактовок и собственных оценок. Не придумывай источники, цитаты и результаты исследований; пробелы в знаниях отмечай прямо.');
    parts.push('Пиши компактно, без повторения формулировки вопроса и длинных вступлений. В конце предложи три коротких вопроса для самопроверки без готовых ответов.');
    return parts.join('\n\n') + '\n\nМатериал для разбора:\n' + text;
  }
  async function writeClipboard(text, button) {
    button.disabled = true;
    let success = false;
    try {
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); success = true; } } catch (_) {}
      if (!success) success = fallbackCopy(text);
      return success;
    } finally { button.disabled = false; }
  }
  async function copy(mode, button) {
    const text = mode === 'ai' ? preparationPrompt(view.match, copyText) : copyText;
    if (!text) return;
    announce('');
    const success = await writeClipboard(text, button);
    if (!success) { announce('Не удалось скопировать', { duration: 2200 }); return; }
    const message = mode === 'ai' ? 'Запрос скопирован' : 'Вопросы скопированы';
    flashCopied(button, message);
    const android = navigator.userAgentData?.platform === 'Android' || /Android/i.test(navigator.userAgent || '');
    announce(message, { quiet: android });
  }
  function flashCopied(button, message) {
    if (!button.isConnected) return;
    if (!copyDefaults.has(button)) copyDefaults.set(button, { label: button.getAttribute('aria-label'), title: button.getAttribute('title') });
    const original = copyDefaults.get(button);
    const setIcon = markup => {
      const face = button.querySelector('.study-question-copy-face');
      if (face) face.innerHTML = markup;
      else { const icon = button.querySelector('svg'); if (icon) icon.outerHTML = markup; }
    };
    clearTimeout(copyTimers.get(button));
    button.dataset.copied = 'true';
    setIcon(icons.check);
    button.setAttribute('aria-label', message);
    button.title = message;
    copyTimers.set(button, setTimeout(() => {
      if (!button.isConnected) return;
      delete button.dataset.copied;
      setIcon(icons.copy);
      if (original.label == null) button.removeAttribute('aria-label'); else button.setAttribute('aria-label', original.label);
      if (original.title == null) button.removeAttribute('title'); else button.setAttribute('title', original.title);
    }, 1800));
  }
  async function copyQuestion(button) {
    const [groupIndex, questionIndex] = button.dataset.studyQuestion.split(':').map(Number);
    const set = view?.match?.sets[groupIndex], question = set && questionsFor(set)[questionIndex];
    if (typeof question !== 'string') return;
    announce('', { quiet: true });
    const success = await writeClipboard(question, button);
    if (!success) { announce('Не удалось скопировать', { duration: 2200 }); return; }
    const number = questionIndex + 1;
    announce(`Вопрос ${number} скопирован`, { quiet: true });
    flashCopied(button, `Вопрос ${number} скопирован`);
  }
  function initialize() {
    dialog = document.createElement('dialog');
    dialog.id = 'studyDialog';
    dialog.className = 'study-dialog';
    dialog.setAttribute('aria-labelledby', 'studyTitle');
    dialog.innerHTML = `<div class="study-handle" aria-hidden="true"></div><div class="study-dialog-top"><button type="button" id="studyBack" class="study-round" aria-label="Все темы по предмету" hidden>${icons.back}</button><div class="study-dialog-title"><p id="studyEyebrow"></p><h2 id="studyTitle"></h2></div><button type="button" id="studyClose" class="study-round" aria-label="Закрыть материалы">${icons.close}</button></div><div id="studyBody" class="study-body"></div><p id="studyStatus" class="study-status" role="status" aria-live="polite" aria-atomic="true"></p>`;
    document.body.append(dialog);
    body = byId('studyBody'); title = byId('studyTitle'); eyebrow = byId('studyEyebrow'); back = byId('studyBack');
    byId('studyClose').addEventListener('click', close);
    back.addEventListener('click', () => showLibrary(view.match.subject.id));
    dialog.addEventListener('close', () => { if (!dialog.open) finalizeClose(); });
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (byId('studySubjectList')?.hidden === false) { closeSubjectPicker(true); return; }
      close();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape' && byId('studySubjectList')?.hidden === false) { event.preventDefault(); event.stopPropagation(); closeSubjectPicker(true); return; }
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled),input,select,summary,a[href]')].filter(element => !element.hidden && element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('#studySubjectPicker')) closeSubjectPicker();
      const lesson = event.target.closest('[data-study-subject]');
      if (lesson) { showQuestions(resolve({ subject: lesson.dataset.studySubject, type: lesson.dataset.studyKind, theme: lesson.dataset.studyTheme })); return; }
      const browse = event.target.closest('[data-study-browse]');
      if (browse) { showLibrary(browse.dataset.studyBrowse); return; }
      const topicButton = event.target.closest('[data-study-topic]');
      if (topicButton) {
        const subject = subjects.find(item => item.id === topicButton.dataset.studyOwner);
        showTopic(subject, subject.topics[+topicButton.dataset.studyTopic]);
        return;
      }
      const copyButton = event.target.closest('[data-study-copy]');
      if (copyButton) copy(copyButton.dataset.studyCopy, copyButton);
      const questionButton = event.target.closest('[data-study-question]');
      if (questionButton) copyQuestion(questionButton);
    });
    byId('studyOpen')?.addEventListener('click', () => showLibrary());
    const count = byId('studySubjectCount');
    if (count) count.textContent = `${subjects.length} дисциплин · Вопросы и планы занятий`;
    if (window.GlassUI?.mountSheet) {
      dialog.classList.add('study-shared-sheet');
      window.GlassUI.mountSheet(dialog, { handle: '.study-handle', close });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();

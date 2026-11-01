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
    search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>')
  };
  const kinds = {
    lecture: { label: 'Лекция', action: 'План лекции', field: 'lectures' },
    seminar: { label: 'Семинар', action: 'Вопросы к семинару', field: 'seminars' },
    practical: { label: 'Практическое', action: 'К практическому занятию', field: 'practicals' }
  };
  const kindOf = type => type === 'practice' ? 'practical' : type;
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
    for (const code of codes(lesson.theme)) {
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
    return { subject, kind, sets, missing, fallback, requested: lesson.theme || '' };
  }
  function card(lesson) {
    const match = resolve(lesson);
    if (!match) return '';
    const count = match.sets.reduce((sum, set) => sum + questionsFor(set).length, 0);
    const label = count ? kinds[match.kind].action : 'Материалы по предмету';
    return `<button type="button" class="study-lesson-action" data-study-subject="${escape(lesson.subject)}" data-study-kind="${escape(match.kind)}" data-study-theme="${escape(lesson.theme || '')}" aria-haspopup="dialog">${icons.book}<span>${label}</span>${count ? `<span class="study-count">${count}</span>` : ''}${icons.chevron}</button>`;
  }
  window.StudyMaterials = { card, resolve };

  let dialog, body, title, eyebrow, back, lastFocus, previousOverflow = '', inertElements = [], view = null, copyText = '', librarySubject = '', query = '';
  const byId = id => document.getElementById(id);
  const topicLabel = topic => topic.number == null ? 'Фрагмент программы' : `Тема ${topic.number}`;
  function open() {
    if (dialog.open) { byId('studyClose').focus(); return; }
    lastFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog.showModal) dialog.showModal();
    else {
      dialog.setAttribute('open', '');
      inertElements = [...document.body.children].filter(element => element !== dialog).map(element => [element, element.inert]);
      inertElements.forEach(([element]) => { element.inert = true; });
    }
    byId('studyClose').focus();
  }
  function restore() {
    document.body.style.overflow = previousOverflow;
    inertElements.forEach(([element, inert]) => { element.inert = inert; });
    inertElements = [];
    if (lastFocus?.isConnected) lastFocus.focus();
  }
  function close() {
    if (dialog.close) dialog.close();
    else { dialog.removeAttribute('open'); restore(); }
  }
  function announce(text) { byId('studyStatus').textContent = text; }
  function showLibrary(subjectId = '', keepQuery = false) {
    view = { type: 'library' };
    librarySubject = subjectId;
    if (!keepQuery) query = '';
    eyebrow.textContent = 'УЧЕБНЫЕ ПРОГРАММЫ';
    title.textContent = 'Материалы занятий';
    back.hidden = true;
    body.innerHTML = `<p class="study-intro">Темы и вопросы из ваших учебных программ. Выберите предмет или найдите нужное по словам.</p><div class="study-filters"><label class="study-search">${icons.search}<input id="studySearch" type="search" placeholder="Найти тему или вопрос" aria-label="Найти тему или вопрос" value="${escape(query)}" autocomplete="off"></label><label class="study-subject-label"><span class="sr-only">Предмет</span><select id="studySubject"><option value="">Все ${subjects.length} дисциплин</option>${subjects.map(subject => `<option value="${escape(subject.id)}" ${subject.id === librarySubject ? 'selected' : ''}>${escape(subject.name)}</option>`).join('')}</select></label></div><div id="studyResults" class="study-results" aria-live="polite"></div>`;
    byId('studySearch').addEventListener('input', event => { query = event.target.value; drawResults(); });
    byId('studySubject').addEventListener('change', event => { librarySubject = event.target.value; drawResults(); });
    drawResults();
    body.scrollTop = 0;
    open();
  }
  function drawResults() {
    const term = plain(query), chosen = subjects.filter(subject => !librarySubject || subject.id === librarySubject);
    const container = byId('studyResults');
    if (!term && !librarySubject) {
      container.innerHTML = `<div class="study-subjects">${subjects.map(subject => `<button type="button" class="study-subject-row" data-study-browse="${escape(subject.id)}"><span class="study-subject-icon">${icons.book}</span><span><strong>${escape(subject.name)}</strong><small>${subject.topics.filter(topic => availableKinds(topic).length).length} тем в программе</small></span>${icons.chevron}</button>`).join('')}</div><p class="study-footnote">Вопросы приведены по приложенным программам. Задания и изменения преподавателя уточняйте на занятии.</p>`;
      return;
    }
    const found = [];
    for (const subject of chosen) subject.topics.forEach((topic, index) => {
      if (!availableKinds(topic).length) return;
      const allText = [subject.name, topic.number, topic.title, ...Object.values(kinds).flatMap(kind => topic[kind.field] || [])].join(' ');
      if (!term || plain(allText).includes(term)) found.push({ subject, topic, index });
    });
    const notes = librarySubject ? chosen[0]?.notes || [] : [];
    container.innerHTML = `${notes.length ? `<details class="study-source-notes"><summary>Об этой программе</summary>${notes.map(note => `<p>${escape(note)}</p>`).join('')}</details>` : ''}<p class="study-result-count">${found.length ? `Найдено тем: ${found.length}` : 'Темы не найдены'}</p><div class="study-topic-list">${found.slice(0, 80).map(({ subject, topic, index }) => `<button type="button" class="study-topic-row" data-study-topic="${index}" data-study-owner="${escape(subject.id)}"><span class="study-topic-meta">${!librarySubject ? `${escape(subject.name)} · ` : ''}${escape(topicLabel(topic))}</span><strong>${escape(topic.title || topicLabel(topic))}</strong><span class="study-kind-labels">${availableKinds(topic).map(kind => `<span data-kind="${kind}">${kinds[kind].label}</span>`).join('')}</span>${icons.chevron}</button>`).join('')}</div>${!found.length ? '<p class="study-footnote">Попробуйте другое слово или выберите все дисциплины.</p>' : found.length > 80 ? '<p class="study-footnote">Показаны первые 80 тем. Уточните поиск.</p>' : ''}`;
  }
  function showTopic(subject, topic, preferredKind) {
    const available = availableKinds(topic);
    const kind = available.includes(preferredKind) ? preferredKind : available.includes('seminar') ? 'seminar' : available[0];
    if (!kind) return;
    showQuestions({ subject, kind, sets: sessionsFor(topic, kind).map(session => ({ topic, session })), missing: [], fallback: false, requested: topic.number || '', topic });
  }
  function showQuestions(match) {
    view = { type: 'questions', match };
    const { subject, kind, sets } = match;
    eyebrow.textContent = kinds[kind].action.toUpperCase();
    title.textContent = subject.name;
    back.hidden = false;
    back.setAttribute('aria-label', 'Все темы по предмету');
    const uniqueTopics = [...new Set(sets.map(set => set.topic))];
    const topic = match.topic || (uniqueTopics.length === 1 ? uniqueTopics[0] : null);
    const available = topic ? availableKinds(topic) : [];
    copyText = `${subject.name}\n${kinds[kind].label}${match.requested ? ' · Тема ' + match.requested : ''}\n${match.fallback ? 'Все вопросы темы для этого вида занятия; подпункт расписания не удалось однозначно сопоставить с программой.\n' : ''}\n` + sets.map(set => `${topicLabel(set.topic)}. ${set.topic.title}\n${set.displayCode || set.session.code ? 'Занятие ' + (set.displayCode || set.session.code) + '\n' : ''}${questionsFor(set).map((question, index) => `${index + 1}. ${question}`).join('\n')}`).join('\n\n');
    const pages = [...new Set(sets.flatMap(set => set.session.sourcePages || set.topic.sourcePages || []))].sort((a, b) => a - b);
    body.innerHTML = `${topic ? `<div class="study-topic-heading"><span>${escape(match.requested ? 'Тема ' + match.requested : topicLabel(topic))}</span><h3>${escape(topic.title)}</h3></div>` : ''}${available.length > 1 ? `<div class="study-kind-switch" role="group" aria-label="Вид занятия">${available.map(item => `<button type="button" data-study-switch="${item}" aria-pressed="${item === kind}">${kinds[item].label}</button>`).join('')}</div>` : ''}${match.fallback ? '<p class="study-notice">Показаны все вопросы темы для этого вида занятия. Отдельный подпункт из расписания не удалось однозначно сопоставить с программой.</p>' : ''}${match.missing.length ? `<p class="study-notice">В приложенной программе нет ${kinds[kind].label === 'Лекция' ? 'плана лекции' : 'вопросов этого вида занятия'} к теме ${escape(match.missing.join(', '))}. Можно выбрать другую тему.</p>` : ''}${sets.length ? `<div class="study-copy-bar"><button type="button" class="study-copy-primary" data-study-copy="plain">${icons.copy}<span>Скопировать вопросы</span></button><button type="button" class="study-copy-ai" data-study-copy="ai" title="Скопировать вопросы с запросом для подготовки">Для ИИ ${icons.copy}</button></div><div class="study-question-groups">${sets.map(({ topic: item, session, questions, displayCode }, index) => `<section class="study-question-group">${!topic || sets.length > 1 ? `<h3>${escape(!topic ? `${topicLabel(item)}. ${item.title}` : displayCode || session.code ? `Занятие ${displayCode || session.code}` : `${kinds[kind].label} ${session.numberWithinTopic || index + 1}`)}</h3>` : ''}<ol class="study-questions">${(questions || session.questions).map(question => `<li><span>${escape(question)}</span></li>`).join('')}</ol></section>`).join('')}</div><p class="study-footnote">Источник: ${escape(subject.sourceFile)}${pages.length ? ` · стр. ${pages.join(', ')}` : ''}. ${topic?.contentStatus === 'partial' ? 'В исходном файле эта тема приведена не полностью.' : ''}</p>` : '<div class="study-missing"><span class="study-subject-icon">' + icons.book + '</span><h3>Нужная тема пока не найдена</h3><p>В приложенном фрагменте программы могут отсутствовать отдельные темы или вопросы. Откройте каталог, чтобы посмотреть доступные материалы.</p></div>'}<button type="button" class="study-other-topics" data-study-browse="${escape(subject.id)}">Все темы по предмету ${icons.chevron}</button>`;
    body.querySelectorAll('[data-study-switch]').forEach(button => button.addEventListener('click', () => {
      showTopic(subject, topic, button.dataset.studySwitch);
      body.querySelector(`[data-study-switch="${button.dataset.studySwitch}"]`)?.focus();
    }));
    body.scrollTop = 0;
    announce('');
    open();
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
  async function copy(mode, button) {
    const original = copyText;
    const text = mode === 'ai' ? `Помоги подготовиться к занятию по следующим вопросам. Ответь на каждый вопрос отдельно, объясни ключевые понятия и приведи короткие примеры. Для юридических вопросов используй право Республики Беларусь, проверь актуальность норм на дату ответа, указывай источники и не выдумывай статьи. Если не можешь проверить норму, прямо сообщи об этом.\n\n${original}` : original;
    if (!text) return;
    button.disabled = true;
    let success = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); success = true; } } catch (_) {}
    if (!success) success = fallbackCopy(text);
    button.disabled = false;
    announce(success ? mode === 'ai' ? 'Вопросы и запрос для ИИ скопированы' : 'Вопросы скопированы' : 'Не удалось скопировать. Выделите текст вопросов и скопируйте вручную.');
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
    dialog.addEventListener('close', restore);
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !dialog.showModal) { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled),input,select,summary')].filter(element => !element.hidden && element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    document.addEventListener('click', event => {
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
    });
    byId('studyOpen')?.addEventListener('click', () => showLibrary());
    const count = byId('studySubjectCount');
    if (count) count.textContent = `${subjects.length} дисциплин · Вопросы и планы занятий`;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();

/* Shared card layout for the timetable and the assessment list. */
(() => {
  'use strict';

  const assessmentColors = Object.freeze({
    credit: '#efb77d',
    diff_credit: '#e9cf72',
    exam: '#c2a0e5',
    consultation: '#8cb9e5'
  });
  const assessmentType = (type, raw) => type === 'credit' &&
    /(?:^|\s)(?:диф(?:ф)?\.?\s*|дифференцированный\s+)зач[её]т(?=$|[\s.,])/i.test(raw || '')
      ? 'diff_credit' : type;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const values = value => (Array.isArray(value) ? value : [value]).filter(Boolean).map(escape).join(' · ');
  const time = value => Number.isFinite(value)
    ? String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0')
    : String(value ?? '');

  function interval(start, end) {
    const from = time(start);
    const to = time(end);
    return escape(from || '—') + (from && to ? '<span class="time-dash">–</span>' + escape(to) : '');
  }

  function render(lesson, options = {}) {
    const { index = 0, state = '', color, label = 'Занятие', live = '', status = '',
      actions = '', material = '', cabinet = false } = options;
    const { type, subject, num, theme } = lesson;
    const segments = Array.isArray(lesson.segments) ? lesson.segments : [];
    const assessment = Object.hasOwn(assessmentColors, type);
    const ink = /^#[a-f0-9]{6}$/i.test(color) ? color : assessment ? assessmentColors[type] : '#b0bed8';
    const kind = assessment ? ` data-assessment="${type}"` : '';
    const attributes = cabinet && assessment ? kind + ` data-exam-type="${type}"` : kind;
    const segmentsCount = segments.length;
    const lastDigit = segmentsCount % 10;
    const pairWord = lastDigit === 1 && segmentsCount % 100 !== 11 ? 'пара'
      : lastDigit >= 2 && lastDigit <= 4 && (segmentsCount % 100 < 12 || segmentsCount % 100 > 14)
        ? 'пары' : 'пар';
    const pairLabel = segmentsCount > 1 ? segmentsCount + ' ' + pairWord
      : num ? escape(num) + ' пара' : '';
    const teachers = values(lesson.teachers ?? lesson.teacher);
    const rooms = values(lesson.rooms ?? lesson.room);

    return `<article class="lesson${assessment ? ' assessment-card' : ''}${cabinet ? ' cab-exam-card' : ''}${state ? ' ' + escape(state) : ''}"${attributes} data-lesson-kind="${escape(type||'other')}" style="--color:${ink};--i:${Number.isFinite(index) ? index : 0}">
      <div class="lesson-heading"><div class="time"><strong>${interval(lesson.time ?? lesson.start, lesson.endTime ?? lesson.end)}</strong>${pairLabel ? `<small>${pairLabel}</small>` : ''}</div><span class="type">${escape(label)}</span></div>
      <h3>${escape(subject)}</h3>
      ${teachers ? `<div class="teacher">${teachers}</div>` : ''}
      <div class="meta">${theme ? `<span>Тема ${escape(theme)}</span>` : ''}${rooms ? `<span class="room-detail">${rooms}</span>` : ''}</div>
      ${lesson.note ? `<p class="lesson-note">${escape(lesson.note)}</p>` : ''}
      ${live}
      <div class="card-bottom">${status}</div>
      ${actions}
      ${material}
    </article>`;
  }

  window.AmiaLessonCard = Object.freeze({ assessmentColors, assessmentType, render });
})();

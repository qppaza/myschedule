/* AMIA personal tools. The timetable and materials never require a login. */
(() => {
  'use strict';
  const BASE = String(window.AMIA_CABINET_API || 'https://qdropbot.qdrop-study-4502-122fde.workers.dev/api/cabinet').replace(/\/$/, '');
  const TOKEN_KEY = 'amia_cabinet_session_v1';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const icons = {
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'),
    book: svg('<path d="M12 6C8 3 4 4 3 5v14c3-2 6-1 9 1 3-2 6-3 9-1V5c-1-1-5-2-9 1Z"/><path d="M12 6v14"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 11h18"/><path d="m8 16 2 2 5-5"/>'),
    grades: svg('<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M8 3v5h5"/><path d="m13 17 6-6m-4 0h4v4M8 12H6m4 4H6"/>'),
    note: svg('<path d="M13 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-7M8 9h4m-4 5h2"/><path d="m14 10 6-6-2-2-6 6-1 3Z"/>'),
    bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'),
    exam: svg('<path d="m3 9 9-5 9 5-9 5Z"/><path d="M6 11v6c4 3 8 3 12 0v-6M21 9v7"/>'),
    check: svg('<path d="m5 12 4 4L19 6"/>'),
    close: svg('<path d="m7 7 10 10M17 7 7 17"/>'),
    back: svg('<path d="m14 6-6 6 6 6"/>'),
    next: svg('<path d="m9 6 6 6-6 6"/>'),
    down: svg('<path d="m7 10 5 5 5-5"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    refresh: svg('<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>'),
    telegram: svg('<path d="m21 3-4 18-5-6-4 4 1-7L3 9Z"/><path d="m9 12 8-6-5 9"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    shield: svg('<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>'),
  };
  const pageNames = {home:'Личный кабинет',login:'Вход через Telegram',questions:'Мои вопросы',attendance:'Табель',grades:'Дневник',notes:'Личные заметки',exams:'Зачёты и экзамены',preferences:'Напоминания'};
  const roles = {student:'Студент',starosta:'Староста',deputy:'Заместитель старосты',owner:'Владелец'};
  const reasonNames = {'Б':'Болезнь','УП':'По заявлению','ПН':'Неуважительный пропуск','СБ':'Сборы и соревнования','ОМ':'Общественные мероприятия','Ц':'ЦКВР','ПР':'Присутствовал без участия','':'Снять отметку'};
  const attendanceCode = code => code==='Н'?'ПН':code==='ОП'?'':code||'';
  const absenceLimit = 72;
  const absenceReasons = ['ПН','Б','УП','СБ','ОМ','Ц'];
  const today = () => {try{const values={};new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Minsk',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(p=>{values[p.type]=p.value;});return `${values.year}-${values.month}-${values.day}`;}catch{return new Date(Date.now()+10800000).toISOString().slice(0,10);}};
  const dateLabel = (date, options={day:'numeric',month:'long'}) => {
    try { return new Intl.DateTimeFormat('ru-RU',{...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')); } catch { return String(date||'Дата не указана'); }
  };
  const shiftDay=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const timeLabel = minutes => typeof minutes === 'number' ? `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}` : String(minutes||'');
  const shortName = person => person.shortName || (()=>{const [surname,...rest]=String(person.name||'Участник').trim().split(/\s+/);return surname+(rest.length?' '+rest.map(n=>n[0]+'.').join(''):'');})();
  const list = (value,key='entries') => Array.isArray(value)?value:Array.isArray(value?.[key])?value[key]:[];
  const subjectNames = new Intl.Collator('ru',{numeric:true,sensitivity:'base'});
  const bySubjectName = (a,b) => subjectNames.compare(a.name,b.name);
  const number = value => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(value)||0);
  const passingGrade = 4;
  const isLowGrade = value => Number(value)>0&&Number(value)<passingGrade;
  const gradeTone = value => isLowGrade(value)?' data-low-grade':'';
  const plural = (value,one,few,many) => value%10===1&&value%100!==11?one:value%10>=2&&value%10<=4&&(value%100<12||value%100>14)?few:many;
  const safeRead = key => { try{return localStorage.getItem(key);}catch{return null;} };
  const safeWrite = (key,value) => { try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value);}catch{} };
  let token=safeRead(TOKEN_KEY)||'', me=null, main=null, view={page:'home'}, frames=[], serial=0, renderEpoch=0, loginEpoch=0, contextGroup='', contextPerson='', refreshTimer=0;
  const groups=new Map(), questionCache=new Map(), claimViews=new WeakMap();
  let claimSerial=0, noteEditorPending=false, avatarSession='', avatarUrl='';
  const apiError = (message,status=0,code='')=>Object.assign(new Error(message),{status,code});
  const schedule=()=>window.AmiaSchedule||{};
  function attendanceLessonAccent(type){
    const kind=type==='practical'?'practice':type||'other';
    return ` data-lesson-kind="${escape(kind)}" style="--attendance-lesson-ink:${escape(schedule().getLessonColor?.(kind)||'#b0bed8')}"`;
  }
  const attendanceAccent=code=>code?` data-attendance-code="${escape(code)}"`:'';
  const selectedGroup=()=>contextGroup||me?.person?.group||schedule().getGroup?.()||safeRead('sched_group')||'4502';
  const personId=()=>me?.owner&&contextPerson?contextPerson:me?.person?.id||'';
  const manages=()=>!!me&&(me.owner||['starosta','deputy'].includes(me.person?.role)&&selectedGroup()===me.person?.group);
  const toast=message=>window.GlassUI?.toast?.(message,{duration:2000});
  const badge=(text,kind='')=>`<span class="cab-badge ${kind}">${escape(text)}</span>`;
  const action=(label,command,icon='',classes='',attrs='')=>`<button type="button" class="cab-action ${classes}" data-cab-action="${escape(command)}" ${attrs}>${icon}${escape(label)}</button>`;
  const empty=(title,text,icon=icons.book,button='')=>`<div class="cab-empty">${icon}<h3>${escape(title)}</h3><p>${escape(text)}</p>${button}</div>`;
  const section=(title,meta='')=>`<div class="cab-section-title"><h3>${escape(title)}</h3>${meta?`<span>${escape(meta)}</span>`:''}</div>`;
  const note=text=>`<p class="cab-note">${text}</p>`;
  const personalQuery=()=>me?.owner&&contextPerson?'&person='+encodeURIComponent(contextPerson):'';

  async function api(path,{method='GET',body,headers={},auth=true,signal}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    if(signal)signal.addEventListener('abort',()=>controller.abort(),{once:true});
    try{
      const response=await fetch(BASE+path,{method,cache:'no-store',credentials:'omit',signal:controller.signal,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(auth&&token?{Authorization:'Bearer '+token}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
      let data;try{data=await response.json();}catch{throw apiError('Сервис кабинета временно недоступен.',response.status);}
      if(!response.ok||data.ok===false){
        if(response.status===401&&auth){token='';me=null;safeWrite(TOKEN_KEY,null);updateEntry();}
        throw apiError(data.error||'Не удалось выполнить действие.',response.status,data.code);
      }
      return data;
    }catch(error){if(error.status!==undefined)throw error;throw apiError(navigator.onLine===false?'Нет подключения. Расписание и материалы по-прежнему доступны.':'Не удалось связаться с кабинетом. Попробуйте ещё раз.');}
    finally{clearTimeout(timer);}
  }

  function makeSheet(title,content,{large=false,onClose,onMount,className='',steady=false,compact=false}={}){
    const dialog=document.createElement('dialog');
    dialog.className=large?'cabinet-dialog study-dialog study-shared-sheet':'cab-picker study-dialog study-shared-sheet';
    if(className)dialog.classList.add(className);
    if(steady)dialog.dataset.cabSteady='';
    dialog.id=large?'cabinetDialog':'cabinetPicker'+(++serial);dialog.setAttribute('aria-labelledby',dialog.id+'Title');
    const heading=`<h2 id="${dialog.id}Title"${compact?' class="sr-only"':''}>${escape(title)}</h2>`;
    const header=compact?heading:`<div class="study-handle"></div><div class="study-dialog-top">${large?`<button type="button" class="study-round cab-back" aria-label="Назад" hidden>${icons.back}</button>`:''}<div class="study-dialog-title"><p>${large?'AMIA · УЧЕБНЫЙ КАБИНЕТ':'ВЫБОР'}</p>${heading}</div><button type="button" class="study-round cab-close" aria-label="Закрыть" autofocus>${icons.close}</button></div>`;
    dialog.innerHTML=header+`<div class="study-body">${content}</div>`;
    document.body.append(dialog);
    const previous=document.activeElement,oldOverflow=document.body.style.overflow;
    let closing=false,closed=false,resolveClosed;
    const closedSheet=new Promise(resolve=>{resolveClosed=resolve;});
    function finish(){if(closed)return;closed=true;if(dialog.open)dialog.close?.();dialog.removeAttribute('open');window.GlassUI?.panelClosed?.(dialog);document.body.style.overflow=oldOverflow;dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});try{onClose?.();}finally{resolveClosed();}}
    function close(){if(!closing&&!closed){closing=true;window.GlassUI?.closeSheet?window.GlassUI.closeSheet(dialog,finish):finish();}return closedSheet;}
    dialog.querySelector('.cab-close')?.addEventListener('click',close);
    dialog.addEventListener('cancel',e=>{e.preventDefault();large?back():close();});
    dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});
    dialog.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();large?back():close();return;}
      if(e.key!=='Tab')return;
      const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not([type=hidden]),textarea,a[href]')].filter(el=>!el.hidden&&el.getClientRects().length);
      if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0]?.focus();}
    });
    window.GlassUI?.mountSheet?.(dialog,{handle:'.study-handle',close});
    if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
    document.body.style.overflow='hidden';window.GlassUI?.panelOpened?.(dialog,{close});window.GlassUI?.openSheet?.(dialog);
    const result={dialog,body:dialog.querySelector('.study-body'),close,heading:dialog.querySelector('h2')};
    onMount?.(result);if(!dialog.contains(document.activeElement))dialog.querySelector('.cab-close')?.focus({preventScroll:true});return result;
  }

  function openChoice(title,items,{selected,multiple=false,onPick,description='',steady=false}={}){
    const chosen=new Set(multiple?(Array.isArray(selected)?selected:[]):[String(selected??'')]);
    const options=items.map(item=>{
      const accent=item.lessonType?attendanceLessonAccent(item.lessonType):attendanceAccent(item.attendanceCode);
      return `<button type="button" class="cab-pick-option" data-value="${escape(item.value)}" ${item.disabled?'disabled':''} ${multiple?'aria-pressed':'role="option" aria-selected'}="${chosen.has(String(item.value))}"${accent}><span${gradeTone(item.grade)}>${escape(item.label)}${item.detail?`<small>${escape(item.detail)}</small>`:''}</span>${icons.check}</button>`;
    }).join('');
    const picker=makeSheet(title,`${description?note(escape(description)):''}${multiple?`<div class="cab-pick-toolbar">${action('Выбрать всё','all')}${action('Снять выбор','none')}${note('Выбор сохраняется при закрытии списка.')}</div>`:''}<div class="cab-pick-list" role="${multiple?'group':'listbox'}" aria-label="${escape(title)}">${options}</div>`,{className:multiple?'cab-multi-picker':'',steady,onClose:()=>{if(multiple)onPick?.([...chosen]);}});
    picker.body.onclick=e=>{
      const option=e.target.closest('[data-value]');
      if(option&&!option.disabled){const value=option.dataset.value;if(!multiple){const closed=picker.close();if(steady)closed.then(()=>onPick?.(value));else onPick?.(value);return;}chosen.has(value)?chosen.delete(value):chosen.add(value);option.setAttribute('aria-pressed',String(chosen.has(value)));}
      const command=e.target.closest('[data-cab-action]')?.dataset.cabAction;
      if(command==='all'){items.filter(item=>!item.disabled).forEach(item=>chosen.add(String(item.value)));picker.body.querySelectorAll('[data-value]').forEach(button=>button.setAttribute('aria-pressed',String(chosen.has(button.dataset.value))));}
      if(command==='none'){chosen.clear();picker.body.querySelectorAll('[data-value]').forEach(button=>button.setAttribute('aria-pressed','false'));}
    };
    return picker;
  }

  function chooseDate(value,onPick,{steady=false}={}){
    let current=/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value:today(),month=current.slice(0,7)+'-01';
    let rail=null;
    const picker=makeSheet('Выберите дату','',{className:'cab-calendar-picker',steady,compact:true,onClose:()=>rail?.destroy?.()});
    const choose=date=>{const closed=picker.close();if(steady)closed.then(()=>onPick(date));else onPick(date);};
    function changeMonth(step,restoreFocus=false){
      const date=new Date(month+'T12:00:00Z');
      date.setUTCMonth(date.getUTCMonth()+step);
      month=date.toISOString().slice(0,10);
      draw();
      if(restoreFocus)picker.body.querySelector(`[data-month="${step}"]`)?.focus({preventScroll:true});
    }
    function draw(focusDate){
      rail?.destroy?.();rail=null;
      const weekday=(new Date(month+'T12:00:00Z').getUTCDay()+6)%7,count=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate(),label=dateLabel(month,{month:'long',year:'numeric'});
      const offday=date=>window.offdayLabel?.(date)||(new Date(date+'T12:00:00Z').getUTCDay()===0?'Воскресенье — выходной':'');
      const todayDate=today(),group=selectedGroup(),scheduleAPI=schedule();
      const days=Array.from({length:count},(_,i)=>{
        const date=month.slice(0,8)+String(i+1).padStart(2,'0'),holiday=offday(date);
        const session=scheduleAPI.assessmentDate?.(date,group);
        const description=[holiday,session?.label].filter(Boolean).join(', ');
        const label=dateLabel(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
        return `<button type="button" data-date="${date}" title="${escape(description)}" aria-label="${escape([label,description].filter(Boolean).join(', '))}" aria-pressed="${date===current}" data-offday="${!!holiday}" data-today="${date===todayDate}" ${date===todayDate?'aria-current="date"':''}><span class="calendar-date-number"${session?.numeral||''}>${i+1}</span>${session?.markers||''}</button>`;
      });
      picker.body.innerHTML=`<div class="date-month-nav"><button type="button" class="study-round" data-month="-1" aria-label="Предыдущий месяц">${icons.back}</button><h3>${escape(label.charAt(0).toUpperCase()+label.slice(1))}</h3><button type="button" class="study-round" data-month="1" aria-label="Следующий месяц">${icons.next}</button></div><div class="date-weekdays" aria-hidden="true">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>`<span>${day}</span>`).join('')}</div><div class="cab-date-grid date-grid">${'<span aria-hidden="true"></span>'.repeat(weekday)}${days.join('')}</div><p class="date-calendar-note"><span>Розовым</span> — воскресенья и нерабочие праздники</p>${scheduleAPI.assessmentLegend?.()||''}<div class="date-popover-footer">${action('Сегодня','today')}${action('Закрыть','cancel')}</div>`;
      const grid=picker.body.querySelector('.cab-date-grid');
      if(window.mountDragRail){grid.classList.add('has-date-rail');rail=window.mountDragRail(grid,{thumbSelector:'.date-thumb',thumbClass:'date-thumb',axis:'both',keyboard:false,commit:button=>choose(button.dataset.date)});}
      window.swipeNavigation?.(picker.body.querySelector('.date-month-nav'),changeMonth);
      if(focusDate)grid.querySelector(`[data-date="${focusDate}"]`)?.focus({preventScroll:true});
    }
    picker.body.onclick=e=>{const date=e.target.closest('[data-date]')?.dataset.date;if(date){choose(date);return;}const step=e.target.closest('[data-month]')?.dataset.month;if(step){changeMonth(Number(step),true);return;}const command=e.target.closest('[data-cab-action]')?.dataset.cabAction;if(command==='today')choose(today());if(command==='cancel')picker.close();};
    picker.body.addEventListener('keydown',e=>{const date=e.target.closest('[data-date]')?.dataset.date,delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(!date||delta===undefined)return;e.preventDefault();const next=shiftDay(date,delta);month=next.slice(0,7)+'-01';draw(next);});
    draw(current);return picker;
  }

  function field(name,label,value='',placeholder='',{type='text',required=false,maxLength=200,min,max}={}){return`<label class="cab-field"><span>${escape(label)}</span><input name="${escape(name)}" type="${type}" value="${escape(value)}" placeholder="${escape(placeholder)}" ${required?'required':''} maxlength="${maxLength}" ${min!==undefined?`min="${min}"`:''} ${max!==undefined?`max="${max}"`:''} autocomplete="off"></label>`;}
  function pickerField(name,label,value,display){return`<div class="cab-field"><span>${escape(label)}</span><input type="hidden" name="${escape(name)}" value="${escape(value)}"><button type="button" class="cab-picker-trigger" data-field-picker="${escape(name)}"><span>${escape(display||'Выбрать')}</span>${icons.down}</button></div>`;}
  function textField(name,label,value='',placeholder=''){return`<label class="cab-field"><span>${escape(label)}</span><textarea name="${escape(name)}" maxlength="10000" placeholder="${escape(placeholder)}">${escape(value)}</textarea></label>`;}
  function attachChoice(form,name,title,items,{multiple=false}={}){
    form.querySelector(`[data-field-picker="${name}"]`).onclick=()=>{
      const input=form.elements[name],options=typeof items==='function'?items():items;
      let selected=input.value;if(multiple){try{selected=JSON.parse(selected);}catch{selected=[];}}
      openChoice(title,options,{selected,multiple,steady:!!form.closest('.cab-note-editor'),onPick:value=>{if(!form.isConnected)return;input.value=multiple?JSON.stringify(value):value;const values=new Set(multiple?value:[value]);form.querySelector(`[data-field-picker="${name}"]>span`).textContent=options.filter(item=>values.has(String(item.value))).map(item=>item.label).join(', ')||'Выбрать';input.dispatchEvent(new Event('change',{bubbles:true}));}});
    };
  }
  function attachDate(form,name){form.querySelector(`[data-field-picker="${name}"]`).onclick=()=>chooseDate(form.elements[name].value,date=>{if(!form.isConnected)return;form.elements[name].value=date;form.querySelector(`[data-field-picker="${name}"]>span`).textContent=dateLabel(date,{day:'numeric',month:'long',year:'numeric'});form.elements[name].dispatchEvent(new Event('change',{bubbles:true}));},{steady:!!form.closest('.cab-note-editor')});}
  function setFormError(form,message){const region=form.querySelector('.cab-inline-error');if(region)region.textContent=message;}
  function submitForm(picker,onSubmit,{quiet=false}={}){
    const form=picker.body.querySelector('form');form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('[type=submit]');if(submit.disabled||!form.reportValidity())return;submit.disabled=true;setFormError(form,'');try{await onSubmit(form);await picker.close();await draw({quiet});}catch(error){setFormError(form,error.status===409?'Эту запись уже изменили. Закройте окно и обновите табель, чтобы увидеть актуальные данные.':error.message);}finally{submit.disabled=false;}});return form;
  }
  function confirmAction(title,text,callback){
    const picker=makeSheet(title,`${note(escape(text))}<div class="cab-actions">${action('Отмена','cancel')}${action('Подтвердить','confirm','', 'primary')}</div><p class="cab-inline-error" role="alert"></p>`);
    picker.body.onclick=async e=>{const b=e.target.closest('[data-cab-action]');if(!b)return;if(b.dataset.cabAction==='cancel')picker.close();if(b.dataset.cabAction==='confirm'){b.disabled=true;try{await callback();picker.close();await draw();}catch(error){picker.body.querySelector('.cab-inline-error').textContent=error.message;b.disabled=false;}}};
  }
  const mountedSegments=new WeakMap();
  function mountSegments(container){
    container.querySelectorAll('.cab-segments').forEach(rail=>{if(window.GlassUI?.mountSegmented&&!mountedSegments.has(rail)){
      const api=window.GlassUI.mountSegmented(rail,{onSelect:button=>button.click()});
      if(api){rail.classList.add('has-glass-segments');mountedSegments.set(rail,api);}
    }});
  }
  const segments=(items,selected,name)=>`<div class="cab-segments glass-segmented" role="group" aria-label="${escape(name)}">${items.map(([id,label])=>`<button type="button" data-cab-action="segment" data-segment="${escape(id)}" aria-pressed="${id===selected}">${escape(label)}</button>`).join('')}</div>`;

  async function groupData(group=selectedGroup()){
    if(!groups.has(group)){
      const data=await api('/group?group='+encodeURIComponent(group));
      groups.set(group,{...data,subjects:[...list(data,'subjects')].sort(bySubjectName)});
    }
    return groups.get(group);
  }
  function controls(data,{person=false}={}){
    if(!me?.owner)return'';
    const people=list(data,'people');const current=people.find(p=>p.id===personId())||people[0];
    if(person&&current)contextPerson=current.id;
    return`<div class="cab-toolbar"><button type="button" class="cab-picker-trigger" data-cab-action="group"><span>Группа ${escape(selectedGroup())}</span>${icons.down}</button>${person?`<button type="button" class="cab-picker-trigger" data-cab-action="person"><span>${escape(current?.name||'Участник')}</span>${icons.down}</button>`:''}</div>${person&&current?.id!==me.person.id?note('Вы просматриваете кабинет участника как владелец системы.'):''}`;
  }
  async function chooseGroup(){openChoice('Учебная группа',(me?.groups||['4501','4502','4503']).map(g=>({value:g,label:'Группа '+g})),{selected:selectedGroup(),onPick:g=>{contextGroup=g;contextPerson='';draw();}});}
  async function choosePerson(){const data=await groupData();openChoice('Кабинет участника',list(data,'people').map(p=>({value:p.id,label:p.name,detail:`№ ${p.number}${p.role!=='student'?' · '+(roles[p.role]||''):''}`})),{selected:personId(),onPick:id=>{contextPerson=id;draw();}});}

  function paintAvatar(){
    const tile=document.getElementById('cabinetEntryAvatar'),portrait=document.querySelector('.cab-profile .cab-avatar');
    for(const target of [tile,portrait]){
      if(!target)continue;
      let img=target.querySelector('.cab-avatar-photo');
      if(!me||!avatarUrl){img?.remove();continue;}
      if(img?.src===avatarUrl)continue;
      img?.remove();
      img=document.createElement('img');img.className='cab-avatar-photo';img.alt='';img.decoding='async';
      img.addEventListener('load',()=>{img.classList.add('is-ready');},{once:true});
      img.addEventListener('error',()=>{img.remove();},{once:true});
      img.src=avatarUrl;target.append(img);
    }
  }
  async function loadAvatar(){
    const session=token;
    if(!me||!session||avatarSession===session)return;
    avatarSession=session;
    try{
      const {image}=await api('/avatar',{auth:false,headers:{Authorization:'Bearer '+session}});
      if(token!==session||!me)return;
      if(typeof image==='string'&&image.length<150000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)){
        avatarUrl=image;paintAvatar();
      }
    }catch{if(avatarSession===session)avatarSession='';}
  }
  function updateEntry(){
    const name=document.getElementById('cabinetEntryName'),meta=document.getElementById('cabinetEntryMeta');
    if(!me||avatarSession!==token){avatarSession='';avatarUrl='';}
    paintAvatar();
    if(me)loadAvatar();
    if(name)name.textContent=me?shortName(me.person):'Личный кабинет';
    if(meta)meta.textContent=me?`${me.person.group} · ${roles[me.person.role]||'Студент'}`:'Режим гостя · Войти';
    document.dispatchEvent(new CustomEvent('amia-cabinet-auth',{detail:{authenticated:!!me,group:me?.person?.group||null}}));
  }
  async function restoreSession(){
    const session=token;if(!session)return;
    try{
      const value=await api('/me');if(token!==session)return;
      me=value.me||value;contextGroup=me.person.group;
      schedule().useAccountGroup?.(me.person.group);updateEntry();if(main)draw();
    }catch{updateEntry();}
  }
  function stopLogin(){loginEpoch++;}
  function close(){stopLogin();clearInterval(refreshTimer);refreshTimer=0;main?.close();}
  function back(){const frame=frames.at(-1);if(frame){restoreFrame(frame);return;}close();}
  function restoreFrame(frame){const index=frames.indexOf(frame);if(index<0)return;frames.splice(index);window.GlassUI?.navigationStepClosed?.(main?.dialog,frame.key);view=frame.previous;stopLogin();draw();}
  function navigate(page,extra={}){if(!main)return open(page,extra);const next={page,...extra};if(view.page===page&&(view.segment||'')===(next.segment||'')&&(view.date||'')===(next.date||'')&&(view.subjectId||'')===(next.subjectId||''))return;const frame={key:'cab-view-'+(++serial),previous:{...view}};frames.push(frame);view=next;stopLogin();draw();window.GlassUI?.navigationStep?.(main.dialog,frame.key,{back:()=>restoreFrame(frame)});}
  function open(page='home',extra={}){
    if(main){navigate(page,extra);return;}
    view={page,...extra};frames=[];
    main=makeSheet(pageNames[page]||pageNames.home,'<div class="cab-loading">Открываем раздел</div>',{large:true,onClose:()=>{stopGradeVisual?.();main=null;frames=[];renderEpoch++;stopLogin();clearInterval(refreshTimer);refreshTimer=0;}});
    main.dialog.querySelector('.cab-back').onclick=back;
    main.body.onclick=handleClick;main.body.oninput=updateGradeForecast;draw();
    refreshTimer=setInterval(()=>{if(main&&!document.hidden&&['attendance','questions','exams'].includes(view.page))draw({quiet:true});},30000);
  }
  function replaceCabinetBody(body,html,previousRail){
    if(previousRail){
      const template=document.createElement('template');template.innerHTML=html;
      const rail=template.content.querySelector('.cab-segments');
      const buttons=[...previousRail.querySelectorAll('[data-segment]')];
      const next=rail?[...rail.querySelectorAll('[data-segment]')]:[];
      if(rail?.parentNode===template.content&&buttons.length===next.length&&
        buttons.every((button,i)=>button.dataset.segment===next[i].dataset.segment)){
        for(const node of [...body.childNodes])if(node!==previousRail)node.remove();
        for(const node of [...template.content.childNodes]){
          if(node===rail)break;
          body.insertBefore(node,previousRail);
        }
        while(rail.nextSibling)body.append(rail.nextSibling);
        buttons.forEach((button,i)=>button.setAttribute('aria-pressed',next[i].getAttribute('aria-pressed')));
        mountedSegments.get(previousRail)?.reflow?.(true);
        return;
      }
    }
    body.innerHTML=html;
  }
  let stopGradeVisual;
  async function draw({quiet=false}={}){
    if(!main)return;const epoch=++renderEpoch,page=view.page;
    const retained=main.body.dataset.cabinetPage===page?main.body.querySelector(':scope > .cab-segments'):null;
    main.heading.textContent=pageNames[page]||pageNames.home;
    main.dialog.querySelector('.cab-back').hidden=!frames.length;
    if(!quiet&&!retained){stopGradeVisual?.();main.body.innerHTML='<div class="cab-loading" role="status">Открываем раздел</div>';}
    try{
      let html;
      if(!me&&!['home','login','exams'].includes(page))html=guestPage();
      else if(page==='grades')html=await gradesPage(epoch);
      else html=await ({home:homePage,login:loginPage,questions:questionsPage,attendance:attendancePage,notes:notesPage,exams:examsPage,preferences:preferencesPage}[page]||homePage)();
      if(epoch!==renderEpoch||!main)return;
      if(quiet&&main.renderedHtml===html&&main.body.dataset.cabinetPage===page)return;
      const scroll=quiet||retained?main.body.scrollTop:0;
      const tracks=quiet&&page==='attendance'
        ?new Map([...main.body.querySelectorAll('[data-attendance-track]')].map(track=>[track.dataset.attendanceTrack,track.scrollLeft]))
        :null;
      stopGradeVisual?.();
      replaceCabinetBody(main.body,html,retained);main.renderedHtml=html;main.body.dataset.cabinetPage=page;
      stopGradeVisual=page==='grades'?window.AmiaGradeVisual?.mount(main.body):undefined;
      if(page==='grades'&&view.gradeSubject)main.heading.textContent=view.gradeSubject;
      main.body.scrollTop=scroll;mountSegments(main.body);
      if(tracks)for(const track of main.body.querySelectorAll('[data-attendance-track]')){
        track.scrollLeft=tracks.get(track.dataset.attendanceTrack)||0;
      }
      if(page==='home')paintAvatar();
      if(page==='preferences')bindPreferences();
      if(page==='login')bindLoginPage();
    }catch(error){
      if(epoch!==renderEpoch||!main||quiet)return;
      main.body.innerHTML=`<div class="cab-error"><p>${escape(error.message)}</p><div class="cab-actions">${action('Попробовать ещё','refresh',icons.refresh)}${!me?action('Режим гостя','guest'):''}</div></div>`;
    }
  }

  function guestPage(){return`<div class="cab-welcome"><span class="cab-avatar">${icons.user}</span><h3>Учёба под рукой</h3><p>Войдите через Telegram, чтобы видеть свои вопросы, оценки, заметки и табель. Расписание и учебные материалы открыты и в режиме гостя.</p><div class="cab-actions cab-stack">${action('Войти через Telegram','login',icons.telegram,'primary')}${action('Продолжить как гость','guest','','subtle')}</div></div>${section('Без входа')}<div class="cab-grid"><button type="button" class="cab-tile" data-cab-action="guest">${icons.calendar}<strong>Расписание</strong><small>Все группы и материалы занятий</small></button><button type="button" class="cab-tile" data-cab-action="exams">${icons.exam}<strong>Зачёты и экзамены</strong><small>Даты, время и аудитории</small></button></div>${note('Привязка выполняется по подтверждённому аккаунту Telegram. Вводить свой номер журнала вручную не нужно.')}`;}
  async function homePage(){
    if(!me)return guestPage();
    const person=me.person,initials=person.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('');
    const tiles=[['questions','Мои вопросы','Взятые вопросы и история подготовки','book'],['attendance','Табель',manages()?'Отметки и правки группы':'Отметки группы и мои пропуски','calendar'],['grades','Дневник','Отметки и средний балл','grades'],['notes','Личные заметки','К предмету или учебному дню','note'],['exams','Зачёты и экзамены','Даты, время и аудитории','exam'],['preferences','Напоминания','Вопросы, зачёты и пропуски','bell']];
    return`<div class="cab-profile"><span class="cab-avatar">${escape(initials)}</span><div class="cab-profile-copy"><h3>${escape(person.name)}</h3><p>Группа ${escape(person.group)} · № ${person.number} в журнале</p><span class="cab-role">${escape(roles[person.role]||'Студент')}</span></div></div><div class="cab-grid">${tiles.map(([id,title,description,icon])=>`<button type="button" class="cab-tile" data-cab-action="${id}">${icons[icon]}<strong>${escape(title)}</strong><small>${escape(description)}</small></button>`).join('')}</div>${note(me.owner?'Вам доступно управление всеми группами и кабинетами. Группу и участника можно выбрать внутри раздела.':'Личные записи сохраняются за вашим аккаунтом и доступны вам и владельцу системы. Табель группы видят участники; правки доступны старосте и заместителю.')}`;
  }
  function loginPage(){return`<div class="cab-welcome"><span class="cab-avatar">${icons.telegram}</span><h3>Ваш профиль Telegram</h3><p>Подтвердите вход в Qdropbot. Бот покажет проверочный код — он должен совпасть с кодом на этой странице.</p><div id="cabLoginState"><div class="cab-actions cab-stack">${action('Продолжить в Telegram','begin-login',icons.telegram,'primary')}${action('Режим гостя','guest','','subtle')}</div></div></div>${note('Вход сохраняется на этом устройстве. На общем устройстве после работы нажмите «Выйти». Смена имени или фотографии Telegram не меняет привязку к группе.')}`;}
  function bindLoginPage(){}
  async function beginLogin(){
    const popup=window.open('about:blank','amiaTelegramLogin');if(popup)popup.opener=null;
    const epoch=++loginEpoch,region=document.getElementById('cabLoginState');if(!region)return;
    region.innerHTML='<div class="cab-loading">Готовим вход</div>';
    try{
      const auth=await api('/auth/start',{method:'POST',body:{},auth:false});
      if(epoch!==loginEpoch||!main){popup?.close();return;}
      const url=new URL(auth.telegramUrl);if(url.protocol!=='https:'||url.hostname!=='t.me')throw apiError('Некорректная ссылка для входа.');
      if(popup){try{popup.location.replace(url.href);}catch{}}
      region.innerHTML=`<div class="cab-login-code" aria-label="Проверочный код ${escape(auth.verifyCode)}">${escape(auth.verifyCode)}</div>${note('Сравните код с сообщением бота и подтвердите вход. Затем вернитесь в расписание.')}<div class="cab-actions"><a class="cab-action primary" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${icons.telegram}Открыть Telegram</a>${action('Отмена','cancel-login')}</div><p class="cab-note" role="status">Ожидаем подтверждения…</p>`;
      const expires=Date.parse(auth.expiresAt)||Date.now()+5*60000;
      while(epoch===loginEpoch&&main&&Date.now()<expires){
        await new Promise(resolve=>setTimeout(resolve,1700));if(epoch!==loginEpoch||!main)return;
        const result=await api('/auth/status?request='+encodeURIComponent(auth.requestId),{auth:false,headers:{'X-Login-Secret':auth.browserSecret}});
        if(epoch!==loginEpoch||!main)return;
        if(result.status==='approved'&&result.token){
          const identity=await api('/me',{auth:false,headers:{Authorization:'Bearer '+result.token}});
          if(epoch!==loginEpoch||!main)return;
          token=result.token;safeWrite(TOKEN_KEY,token);me=identity.me||identity;contextGroup=me.person.group;contextPerson='';schedule().useAccountGroup?.(me.person.group,true);groups.clear();questionCache.clear();updateEntry();stopLogin();toast('Вы вошли в кабинет');view={page:'home'};frames.forEach(frame=>window.GlassUI?.navigationStepClosed?.(main.dialog,frame.key));frames=[];await draw();return;
        }
        if(result.status==='expired')break;
      }
      if(epoch===loginEpoch&&main)region.innerHTML=`${note('Время подтверждения истекло. Можно создать новый запрос.')}<div class="cab-actions">${action('Попробовать снова','begin-login',icons.refresh,'primary')}</div>`;
    }catch(error){popup?.close();if(epoch===loginEpoch&&region.isConnected)region.innerHTML=`<div class="cab-error"><p>${escape(error.message)}</p>${action('Попробовать снова','begin-login',icons.refresh)}</div>`;}
  }

  async function questionsData(group=selectedGroup(),force=false,context=null){
    const params=new URLSearchParams({group});
    if(context){params.set('date',context.date);params.set('subjectId',context.subjectId);params.set('type',context.type);if(context.num!==undefined&&context.num!==null&&context.num!=='')params.set('num',String(context.num));}
    const key=context?params.toString():group,cache=questionCache.get(key);if(cache&&!force&&Date.now()-cache.at<30000)return cache.data;
    const data=await api('/questions?'+params);questionCache.set(key,{at:Date.now(),data});return data;
  }
  async function questionsPage(){
    const group=await groupData();let html=controls(group,{person:true});
    const data=await api('/questions?group='+encodeURIComponent(selectedGroup())+personalQuery());questionCache.set(selectedGroup(),{at:Date.now(),data});
    const history=view.segment==='history',mine=list(data,'mine').filter(item=>history?item.date<today()||item.active===false:item.date>=today()&&item.active!==false).sort((a,b)=>history?b.date.localeCompare(a.date):a.date.localeCompare(b.date));view.questionItems=mine;
    html+=segments([['upcoming','Ближайшие'],['history','История']],history?'history':'upcoming','Мои вопросы');
    if(!mine.length)return html+empty(history?'История ещё пуста':'Пока нет взятых вопросов',history?'Здесь сохранятся вопросы, которые вы выбирали к прошедшим занятиям.':'Выберите вопрос в неанонимном опросе Qdropbot — он появится здесь. Оценку после занятия вносить необязательно.');
    return html+`<div class="cab-list">${mine.map((item,index)=>`<article class="cab-card"><div class="cab-card-top"><small>${escape(dateLabel(item.date,{weekday:'short',day:'numeric',month:'long'}))} · ${escape(item.subject)}</small>${badge(item.active===false?'Выбор снят':'Вопрос '+item.number,item.active===false?'muted':'')}</div><h3>${escape(item.text)}</h3><div class="cab-card-actions">${action('Материалы занятия','question-materials',icons.book,'',`data-index="${index}"`)}${action('Заметка','question-note',icons.note,'',`data-index="${index}"`)}</div></article>`).join('')}</div>${note('История показывает выбор вопросов, а не факт ответа на занятии. Отсутствие оценки не меняет эту запись.')}`;
  }

  async function attendancePage(){
    const group=await groupData(),date=view.date||today(),month=date.slice(0,7),data=await api('/attendance?group='+encodeURIComponent(selectedGroup())+'&month='+month);view.attendance=data;
    const people=list(group,'people'),allLessons=list(data,'lessons'),entries=list(data),dayLessons=allLessons.filter(l=>l.date===date),map=new Map(entries.map(e=>[e.personId+'|'+e.lessonKey,e]));
    const monthMode=view.segment==='month',editable=!!data.canEdit;
    const own=people.find(person=>person.id===me?.person?.id);
    const participant=person=>{
      const label=escape(shortName(person)),canView=editable||person.id===own?.id;
      const name=canView?`<button type="button" class="cab-person-link" data-cab-action="attendance-summary" data-person="${escape(person.id)}" aria-label="Пропуски: ${label}">${label}</button>`:`<strong>${label}</strong>`;
      const role=person.role==='student'?'':roles[person.role];
      return `<div class="cab-attendance-identity"><span class="cab-attendance-number" aria-label="Номер в журнале ${escape(person.number)}">${escape(person.number)}</span><div class="cab-attendance-name">${name}${role?`<small>${escape(role)}</small>`:''}</div></div>`;
    };
    let html=controls(group)+`<div class="cab-date-nav"><button type="button" class="study-round" data-cab-action="attendance-prev" aria-label="Предыдущий день">${icons.back}</button><button type="button" class="cab-picker-trigger" data-cab-action="attendance-date"><span>${escape(dateLabel(date,{weekday:'short',day:'numeric',month:'long'}))}</span>${icons.down}</button><button type="button" class="study-round" data-cab-action="attendance-next" aria-label="Следующий день">${icons.next}</button></div>`;
    html+=segments([['day','День'],['month','Месяц']],monthMode?'month':'day','Вид табеля');
    if(editable)html+=`<div class="cab-attendance-actions" role="group" aria-label="Действия с табелем">${action('Внести отметку','attendance-edit',icons.plus,'primary',dayLessons.length?'':'disabled')}${action('Правки','audit',icons.clock)}</div>`;
    if(own)html+=`<button type="button" class="cab-attendance-summary" data-cab-action="attendance-summary" data-person="${escape(own.id)}">${icons.calendar}<span>Мои пропуски за семестр</span>${icons.next}</button>`;
    if(!allLessons.length)return html+empty('На этот месяц нет занятий','Выберите другой месяц.',icons.calendar);
    if(!monthMode&&!dayLessons.length){
      html+=empty('В этот день занятий нет','Выберите учебный день в календаре.',icons.calendar);
    }else{
      const groupedLessons=new Map();
      for(const lesson of allLessons){
        if(!groupedLessons.has(lesson.date))groupedLessons.set(lesson.date,[]);
        groupedLessons.get(lesson.date).push(lesson);
      }
      const slots=monthMode?[...groupedLessons].sort(([first],[second])=>first.localeCompare(second)).map(([day,lessons])=>({
        date:day,lessons,label:dateLabel(day,{day:'numeric',month:'short'}).replace(/\.$/,''),
        detail:dateLabel(day,{weekday:'short'}),description:dateLabel(day,{day:'numeric',month:'long'})
      })):dayLessons.map(lesson=>({
        date,lessons:[lesson],lesson:lesson.key,label:lesson.num+'-я',
        detail:timeLabel(lesson.start),description:lesson.num+'-я пара, '+lesson.subject,
        subject:lesson.subject,accent:attendanceLessonAccent(lesson.type)
      }));
      const mark=(person,slot)=>{
        const codes=[...new Set(slot.lessons.map(lesson=>attendanceCode(map.get(person.id+'|'+lesson.key)?.code)).filter(Boolean))];
        const description=codes.map(code=>reasonNames[code]||code).join(', ')||'нет отметок';
        const label=shortName(person)+', '+slot.description+': '+description;
        const values=codes.map(code=>`<span${attendanceAccent(code)}>${escape(code)}</span>`).join('');
        return `<button type="button" class="cab-attendance-chip" data-cab-action="attendance-cell" data-person="${escape(person.id)}" data-date="${escape(slot.date)}" ${slot.lesson?`data-lesson="${escape(slot.lesson)}"`:''} ${editable?'':'disabled'} aria-label="${escape(label)}" title="${escape(slot.description)}" data-mark="${codes.length?'recorded':'empty'}"${monthMode&&slot.date===date?' aria-current="date"':''}${slot.accent||''}><span class="cab-attendance-chip-date">${escape(slot.label)}</span><span class="cab-attendance-chip-detail">${escape(slot.detail)}</span><strong class="cab-attendance-value">${values||'—'}</strong></button>`;
      };
      const hint=monthMode&&slots.length>3?'<p class="cab-attendance-hint">Листайте даты в карточке участника.</p>':'';
      if(!monthMode)html+=`<ul class="cab-attendance-lesson-key" aria-label="Занятия этого дня">${slots.map(slot=>`<li${slot.accent}><b>${escape(slot.label)}</b><span>${escape(slot.subject)}<small>${escape(slot.detail)}</small></span></li>`).join('')}</ul>`;
      html+=hint+`<ul class="cab-attendance-roster" role="list" aria-label="Участники группы" data-mode="${monthMode?'month':'day'}" data-many-slots="${slots.length>3}">${people.map(person=>`<li class="cab-attendance-person">${participant(person)}<div class="cab-attendance-marks" role="group" aria-label="${escape((monthMode?'Даты':'Пары')+' · '+shortName(person))}" ${monthMode&&slots.length>3?`tabindex="0" data-attendance-track="${escape(person.id)}"`:''}>${slots.map(slot=>mark(person,slot)).join('')}</div></li>`).join('')}</ul>`;
    }
    return html+`<div class="cab-attendance-legend">${Object.entries(reasonNames).filter(([code])=>code).map(([code,title])=>`<span><b${attendanceAccent(code)}>${escape(code)}</b> — ${escape(title)}</span>`).join('')}</div>`+note(editable?'Табель общий для старосты и заместителя. Все изменения сохраняются с автором и временем. ПР применяется только к физкультуре.':'Табель доступен для просмотра. Причины пропусков вносят староста и заместитель.')+note('ПН учитывается как неуважительный пропуск. Часы считаются после окончания занятия.');
  }
  async function editAttendance({person='',lesson='',date=view.date||today()}={}){
    const group=await groupData(),data=date.slice(0,7)===(view.date||today()).slice(0,7)?view.attendance:await api('/attendance?group='+selectedGroup()+'&month='+date.slice(0,7));
    if(!data?.canEdit)return toast('Правки доступны старосте и заместителю');
    const people=list(group,'people'),lessons=list(data,'lessons').filter(l=>l.date===date),entry=person&&lesson?list(data).find(e=>e.personId===person&&e.lessonKey===lesson):null;
    if(!lessons.length)return toast('В выбранный день нет занятий');
    const personIds=person?[person]:[],lessonKeys=lesson?[lesson]:lessons.map(l=>l.key),initialCode=entry?attendanceCode(entry.code):'Б';
    const picker=makeSheet('Отметка в табеле',`<form class="cab-form">${note(escape(dateLabel(date,{weekday:'long',day:'numeric',month:'long'})))}${pickerField('people','Участники',JSON.stringify(personIds),person?people.find(p=>p.id===person)?.name:'Выбрать участников')}${pickerField('lessons','Занятия',JSON.stringify(lessonKeys),lesson?lessons.find(l=>l.key===lesson)?.num+'-я пара':'Все пары этого дня')}${pickerField('code','Причина',initialCode,reasonNames[initialCode])}${field('comment','Комментарий',entry?.comment||'','Необязательно',{maxLength:500})}<p class="cab-inline-error" role="alert"></p><button type="submit" class="cab-action primary">Сохранить отметку</button></form>`);
    const form=submitForm(picker,async form=>{
      const persons=JSON.parse(form.elements.people.value),keys=JSON.parse(form.elements.lessons.value);if(!persons.length||!keys.length)throw apiError('Выберите участников и занятия.');
      const versions={};for(const p of persons)for(const key of keys)versions[p+'|'+key]=list(data).find(e=>e.personId===p&&e.lessonKey===key)?.version||0;
      await api('/attendance',{method:'POST',body:{group:selectedGroup(),personIds:persons,lessonKeys:keys,code:form.elements.code.value,comment:form.elements.comment.value,unexcused:form.elements.code.value==='ПН',versions}});toast('Табель обновлён');
    });
    attachChoice(form,'people','Кого отметить',people.map(p=>({value:p.id,label:p.name,detail:'№ '+p.number})),{multiple:true});
    attachChoice(form,'lessons','На каких парах',lessons.map(l=>({value:l.key,label:l.num+'-я · '+l.subject,lessonType:l.type||'other',detail:[timeLabel(l.start),timeLabel(l.end)].filter(Boolean).join('–')})),{multiple:true});
    attachChoice(form,'code','Причина',()=>Object.entries(reasonNames).map(([code,label])=>({value:code,label:code?code+' · '+label:label,attendanceCode:code,detail:code==='ПР'?'Только физкультура':'',disabled:code==='ПР'&&JSON.parse(form.elements.lessons.value).some(key=>!/физкультур|физическ/i.test(lessons.find(l=>l.key===key)?.subject||''))})));
  }

  async function attendanceSummary(person,group,month){
    const route='/attendance?group='+encodeURIComponent(group)+'&month=';
    const data=await api(route+month+'&summaryPerson='+encodeURIComponent(person));
    if(data.attendanceSummary)return list(data.attendanceSummary);
    // The current cloud endpoint also supports the monthly ledger.
    const asOf=new Date(data.asOf||Date.now()),last=today(),period=data.period;
    const start=period?.start||month+'-01',end=period?.end||last;
    const months=[];
    for(let date=start.slice(0,7)+'-01';date<=end&&date<=last&&months.length<12;){
      months.push(date.slice(0,7));
      const next=new Date(date+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);date=next.toISOString().slice(0,10);
    }
    const responses=await Promise.all(months.map(item=>item===month?data:api(route+item)));
    const entries=[];
    for(const response of responses){
      const lessons=new Map(list(response,'lessons').map(lesson=>[lesson.key,lesson]));
      for(const entry of list(response)){
        const code=attendanceCode(entry.code);
        if(entry.personId!==person||!absenceReasons.includes(code)||entry.date<start||entry.date>end||entry.date>last)continue;
        const lesson=lessons.get(entry.lessonKey);
        const finish=lesson&&Number.isFinite(lesson.end)?Date.parse(entry.date+'T00:00:00+03:00')+lesson.end*60000:Infinity;
        if(entry.date===last&&finish>asOf)continue;
        entries.push({date:entry.date,code,hours:entry.hours,subject:lesson?.subject});
      }
    }
    return entries;
  }

  async function openAttendanceSummary(personId){
    const group=selectedGroup(),month=(view.date||today()).slice(0,7);
    const member=list(await groupData(group),'people').find(person=>person.id===personId);
    if(!member||group!==selectedGroup())return;
    let stopGraph,closed=false;
    const sheet=makeSheet('Пропуски за семестр',note(escape(member.name))+'<div class="cab-loading" role="status">Загружаем табель</div>',{onClose:()=>{closed=true;stopGraph?.();}});
    try{
      const entries=(await attendanceSummary(personId,group,month)).sort((a,b)=>a.date.localeCompare(b.date));
      if(closed)return;
      const counts=new Map(absenceReasons.map(code=>[code,0])),days=new Map();
      for(const entry of entries){
        counts.set(entry.code,(counts.get(entry.code)||0)+Number(entry.hours));
        if(!days.has(entry.date))days.set(entry.date,0);
        if(entry.code==='ПН')days.set(entry.date,days.get(entry.date)+Number(entry.hours));
      }
      const unexcused=counts.get('ПН'),total=[...counts.values()].reduce((sum,hours)=>sum+hours,0);
      const stats=[[total,'Всего пропущено'],[total-unexcused,'Уважительные'],[unexcused,'Неуважительные · ПН'],[Math.max(0,absenceLimit-unexcused),'До порога '+absenceLimit+' ч']];
      const statsMarkup='<div class="cab-summary cab-absence-summary">'+stats.map(([value,label],i)=>`<div class="cab-stat"${i===2?attendanceAccent('ПН'):''}><strong>${number(value)} ч</strong><span>${label}</span></div>`).join('')+'</div>';
      let running=0;
      const samples=[...days].map(([date,hours])=>[date,running+=hours]);
      const series=absenceReasons.map(code=>[code,reasonNames[code],counts.get(code)]);
      const chart=samples.length?chartMarkup({title:'Динамика пропусков',hint:'Накопленные часы ПН и распределение по причинам',samples,series,min:0,max:Math.max(absenceLimit,unexcused),unit:' ч',selection:'Часы ПН'}):'';
      const reasons=series.filter(item=>item[2]>0).map(([code,label,hours])=>`<div><span><b${attendanceAccent(code)}>${escape(code)}</b> · ${escape(label)}</span><strong>${number(hours)} ч</strong></div>`).join('');
      const history=entries.slice().reverse().map(entry=>`<div><span>${escape(dateLabel(entry.date))} · ${escape(entry.subject||'Занятие') }</span><strong><b${attendanceAccent(entry.code)}>${escape(entry.code)}</b> · ${number(entry.hours)} ч</strong></div>`).join('');
      sheet.body.innerHTML=note(escape(member.name))+statsMarkup+chart+(reasons?section('По причинам')+'<div class="cab-card cab-absence-list">'+reasons+'</div>'+section('Записи табеля')+'<div class="cab-card cab-absence-list">'+history+'</div>':empty('Пропусков пока нет','Здесь появятся часы по завершённым занятиям.',icons.calendar));
      stopGraph=window.AmiaGradeVisual?.mount(sheet.body);
    }catch(error){
      if(!closed)sheet.body.innerHTML='<p class="cab-inline-error" role="alert">'+escape(error.message)+'</p>';
    }
  }

  async function openAudit(){
    const data=await api('/audit?group='+selectedGroup()),changes=list(data,'changes');
    const picker=makeSheet('История правок',changes.length?`<div class="cab-list">${changes.slice(0,50).map((change,index)=>`<article class="cab-card"><small>${escape(change.actorName||'Участник')} · ${escape(new Date(change.at).toLocaleString('ru-RU',{timeZone:'Europe/Minsk',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</small><h3>${escape(change.personName||'Участник')} · ${escape(dateLabel(change.date))}</h3><p>${escape(change.before?.code||'Нет отметки')} → ${escape(change.after?.code||'Нет отметки')}</p><div class="cab-card-actions">${action('Отменить эту правку','undo',icons.back,'',`data-index="${index}"`)}</div></article>`).join('')}</div>`:empty('Правок пока нет','Здесь будут видны авторы и время изменений табеля.',icons.clock));
    picker.body.onclick=async e=>{const button=e.target.closest('[data-cab-action=undo]');if(!button)return;const change=changes[+button.dataset.index];button.disabled=true;try{await api('/attendance/undo',{method:'POST',body:{changeId:change.id}});toast('Правка отменена');picker.close();draw();}catch(error){toast(error.status===409?'Запись уже изменена. Обновите историю.':error.message);button.disabled=false;}};
  }


  function chartMarkup({title,hint,samples,series,min,max,unit='',selection='Отметка',passingMark=0}){
    const last=samples.at(-1);
    return `<section class="cab-grade-visual" data-grade-visual data-graph-mode="timeline" data-samples="${escape(JSON.stringify(samples))}" data-series="${escape(JSON.stringify(series))}" data-range="${escape(JSON.stringify([min,max]))}" data-unit="${escape(unit)}" data-selection="${escape(selection)}" data-passing-mark="${passingMark}">
      <div class="cab-chart-head"><div><h3>${escape(title)}</h3><small>${escape(hint)}</small></div><div class="cab-chart-meter"><output${passingMark?gradeTone(last[1]):''}>${escape(last[1]+unit)}</output><small>${escape(dateLabel(last[0]))}</small></div></div>
      <div class="cab-chart-tabs" role="group" aria-label="Вид диаграммы"><button type="button" data-graph-tab="timeline" aria-pressed="true">По датам</button><button type="button" data-graph-tab="distribution" aria-pressed="false">Распределение</button></div>
      <canvas class="cab-chart-canvas" role="slider" tabindex="0" aria-label="Выбрать точку на диаграмме" aria-valuemin="1" aria-valuemax="${samples.length}" aria-valuenow="${samples.length}"></canvas>
      <div class="cab-chart-axis" aria-hidden="true"></div>
      <div class="sr-only cab-grade-chart" role="list" aria-label="Распределение ${unit?'часов':'отметок'}">${series.map(([_,label,count])=>`<div role="listitem" aria-label="${escape(label)}, ${unit?'':'количество '}${count}${unit}"></div>`).join('')}</div>
    </section>`;
  }
  function gradeDistribution(entries){
    if(!entries.length)return'';
    const counts=Array.from({length:10},()=>0);
    for(const {value} of entries)if(Number.isInteger(value)&&value>=1&&value<=10)counts[value-1]++;
    const samples=entries.slice(-36).map(({date,value})=>[date,value]);
    const hint=samples.length<entries.length?'Последние '+samples.length+' отметок':'За текущий семестр';
    return chartMarkup({title:'Динамика отметок',hint,samples,series:counts.map((n,i)=>[String(i+1),'Отметка '+(i+1),n]),min:1,max:10,passingMark:passingGrade});
  }
  function gradeForecast(entries,sum){
    if(!entries.length)return'';
    const estimate=(sum+8)/(entries.length+1);
    return `<details class="cab-card cab-forecast"><summary>Прогноз среднего</summary><label for="cabForecastMark">Если получить ещё одну отметку <strong data-forecast-mark>8</strong></label><input id="cabForecastMark" type="range" min="1" max="10" value="8" data-forecast-sum="${sum}" data-forecast-count="${entries.length}"><div class="cab-forecast-result"><span>Новый средний балл</span><output for="cabForecastMark"${gradeTone(estimate)}>${number(estimate)}</output></div></details>`;
  }
  function updateGradeForecast(event){
    const input=event.target.closest('[data-forecast-sum]');if(!input)return;
    const card=input.closest('.cab-forecast'),mark=Number(input.value);
    const estimate=(Number(input.dataset.forecastSum)+mark)/(Number(input.dataset.forecastCount)+1);
    const current=card.querySelector('[data-forecast-mark]'),prediction=card.querySelector('output');
    current.textContent=mark;
    current.toggleAttribute('data-low-grade',isLowGrade(mark));
    prediction.textContent=number(estimate);
    prediction.toggleAttribute('data-low-grade',isLowGrade(estimate));
  }
  function gradeHistory(entries){
    if(!entries.length)return empty('Отметок пока нет','Добавьте первую отметку по предмету.',icons.grades);
    const days=new Map();
    for(const item of entries){if(!days.has(item.date))days.set(item.date,[]);days.get(item.date).push(item);}
    return [...days].map(([date,items])=>section(dateLabel(date,{day:'numeric',month:'long',year:'numeric'}))+`<div class="cab-list">${items.map(item=>
      `<article class="cab-card cab-grade-record"><strong class="cab-grade-value"${gradeTone(item.value)}>${escape(item.value)}</strong>${item.comment?`<p>${escape(item.comment)}</p>`:''}<div class="cab-grade-actions"><button type="button" class="study-round" data-cab-action="grade-edit" data-id="${escape(item.id)}" aria-label="Изменить отметку">${icons.note}</button><button type="button" class="study-round" data-cab-action="grade-delete" data-id="${escape(item.id)}" aria-label="Удалить отметку">${icons.close}</button></div></article>`).join('')}</div>`).join('');
  }
  async function gradesPage(epoch){
    const screen=view,group=await groupData();
    if(epoch!==renderEpoch||screen!==view)return'';
    const context=controls(group,{person:true}),data=await api('/grades?'+personalQuery().replace(/^&/,''));
    if(epoch!==renderEpoch||screen!==view)return'';
    const entries=[...list(data)].reverse(),averages=new Map(list(data,'averages').map(item=>[item.subjectId,item]));
    const subjects=new Map(list(group,'subjects').map(subject=>[subject.id,subject]));
    for(const item of entries)if(!subjects.has(item.subjectId))subjects.set(item.subjectId,{id:item.subjectId,name:item.subject||item.subjectId});
    screen.grades=data;
    const subject=subjects.get(screen.subjectId);
    const button=`<div class="cab-toolbar">${action('Добавить оценку','grade-add',icons.plus,'primary')}</div>`;
    if(subject){
      screen.gradeSubject=subject.name;
      const records=entries.filter(item=>item.subjectId===subject.id);
      const sum=records.reduce((total,item)=>total+Number(item.value),0);
      const average=records.length?sum/records.length:null;
      return context+`<div class="cab-summary cab-subject-summary"><div class="cab-stat"><strong${gradeTone(average)}>${average===null?'—':number(average)}</strong><span>средний балл</span></div><div class="cab-stat"><strong>${records.length}</strong><span>внесено отметок</span></div></div>`+button+gradeHistory(records)+gradeDistribution(records)+gradeForecast(records,sum);
    }
    screen.gradeSubject='';
    const sum=entries.reduce((total,item)=>total+Number(item.value),0);
    const rows=[...subjects.values()].sort(bySubjectName).map(({id,name})=>{
      const grade=averages.get(id),count=grade?.count||0;
      const label=count?count+' '+plural(count,'отметка','отметки','отметок'):'Нет отметок';
      return `<button type="button" class="cab-card cab-diary-subject" data-cab-action="grade-subject" data-subject="${escape(id)}"><span><strong>${escape(name)}</strong><small>${escape(label)}</small></span>${grade?`<span class="cab-grade-value"${gradeTone(grade.average)} aria-label="Средний балл ${number(grade.average)}">${number(grade.average)}</span>`:''}${icons.next}</button>`;
    });
    const average=entries.length?sum/entries.length:null;
    return context+`<div class="cab-summary"><div class="cab-stat"><strong${gradeTone(average)}>${average===null?'—':number(average)}</strong><span>общий средний балл</span></div><div class="cab-stat"><strong>${entries.length}</strong><span>внесено отметок</span></div><div class="cab-stat"><strong>${averages.size}</strong><span>${plural(averages.size,'предмет с отметками','предмета с отметками','предметов с отметками')}</span></div></div>`+button+section('Предметы')+`<div class="cab-list">${rows.join('')}</div>`+gradeDistribution(entries);
  }
  async function editGrade(id=''){
    const screen=view,target=personId(),group=await groupData();
    if(!main||screen!==view||target!==personId())return;
    const subjects=list(group,'subjects'),entry=list(view.grades).find(e=>String(e.id)===String(id)),subjectId=entry?.subjectId||view.subjectId||subjects[0]?.id||'';
    const picker=makeSheet(entry?'Изменить оценку':'Новая оценка',`<form class="cab-form">${pickerField('subjectId','Учебная дисциплина',subjectId,subjects.find(s=>s.id===subjectId)?.name)}<div class="cab-form-grid">${pickerField('date','Дата',entry?.date||today(),dateLabel(entry?.date||today()))}${pickerField('value','Оценка',String(entry?.value||''),entry?.value||'Выбрать')}</div>${textField('comment','Комментарий',entry?.comment||'','За что получена оценка — необязательно')}<p class="cab-inline-error" role="alert"></p><button type="submit" class="cab-action primary">Сохранить оценку</button></form>`);
    const form=submitForm(picker,async form=>{if(!form.elements.value.value)throw apiError('Выберите оценку от 1 до 10.');await api('/grades',{method:'POST',body:{...(entry?{id:entry.id}:{}),personId:target,subjectId:form.elements.subjectId.value,date:form.elements.date.value,value:Number(form.elements.value.value),comment:form.elements.comment.value}});toast('Оценка сохранена');});
    attachChoice(form,'subjectId','Учебная дисциплина',subjects.map(s=>({value:s.id,label:s.name})));
    attachChoice(form,'value','Оценка',Array.from({length:10},(_,i)=>({value:String(i+1),label:String(i+1),grade:i+1})));
    attachDate(form,'date');
    const markLabel=form.querySelector('[data-field-picker="value"]>span'),mark=form.elements.value;
    const updateMarkTone=()=>markLabel.toggleAttribute('data-low-grade',isLowGrade(mark.value));
    mark.addEventListener('change',updateMarkTone);
    updateMarkTone();
  }

  async function notesPage(){
    const group=await groupData(),context=controls(group,{person:true}),data=await api('/notes?'+personalQuery().replace(/^&/,'')),items=list(data).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));view.notes=data;
    const subjectMap=new Map(list(group,'subjects').map(s=>[s.id,s.name]));
    return context+`<div class="cab-toolbar">${action('Новая заметка','note-add',icons.plus,'primary')}</div>`+(items.length?`<div class="cab-list">${items.map(item=>`<article class="cab-card"><div class="cab-card-top"><small>${item.scope==='day'?escape(dateLabel(item.date,{weekday:'short',day:'numeric',month:'long'})):escape(subjectMap.get(item.subjectId)||item.subject||'Учебная дисциплина')}</small>${badge(item.scope==='day'?'К дню':'К предмету','muted')}</div><p>${escape(item.text)}</p><div class="cab-card-actions">${action('Изменить','note-edit',icons.note,'',`data-id="${escape(item.id)}"`)}${action('Удалить','note-delete','','subtle',`data-id="${escape(item.id)}"`)}</div></article>`).join('')}</div>`:empty('Место для важных мелочей','Добавьте заметку к предмету или дню: что повторить, что принести и о чём спросить.',icons.note))+note('Заметки сохраняются за вашим аккаунтом и доступны на других устройствах после входа. Владелец системы имеет доступ к записям кабинетов.');
  }
  async function editNote(id='',preset={},caller=document.activeElement){
    if(!me){open('login');return;}
    if(noteEditorPending)return;
    const session=token;
    noteEditorPending=true;
    try{await openNoteEditor(id,preset,caller,session);}
    finally{noteEditorPending=false;}
  }
  async function openNoteEditor(id,preset,caller,session){
    const group=await groupData(),subjects=list(group,'subjects'),entry=list(view.notes).find(e=>String(e.id)===String(id)),initial={scope:'subject',subjectId:subjects[0]?.id||'',date:schedule().getDate?.()||today(),text:'',...preset,...entry};
    if(!caller?.isConnected||session!==token||document.querySelector('.cab-note-editor[open]'))return;
    const source=caller.closest('dialog');
    if(source&&(!source.open||source.hasAttribute('data-sheet-closing')))return;
    const picker=makeSheet(entry?'Изменить заметку':'Новая заметка',`<form class="cab-form">${pickerField('scope','К чему относится заметка',initial.scope,initial.scope==='day'?'К учебному дню':'К предмету')}<div data-note-subject ${initial.scope==='day'?'hidden':''}>${pickerField('subjectId','Учебная дисциплина',initial.subjectId,subjects.find(s=>s.id===initial.subjectId)?.name)}</div><div data-note-date ${initial.scope!=='day'?'hidden':''}>${pickerField('date','Учебный день',initial.date,dateLabel(initial.date))}</div>${textField('text','Заметка',initial.text,'Запишите то, что важно не забыть')}<p class="cab-inline-error" role="alert"></p><button type="submit" class="cab-action primary">Сохранить заметку</button></form>`,{className:'cab-note-editor',steady:true});
    const form=submitForm(picker,async form=>{const text=form.elements.text.value.trim();if(!text)throw apiError('Введите текст заметки.');const scope=form.elements.scope.value;await api('/notes',{method:'POST',body:{...(entry?{id:entry.id}:{}),personId:personId(),scope,...(scope==='day'?{date:form.elements.date.value}:{subjectId:form.elements.subjectId.value}),text}});toast('Заметка сохранена');},{quiet:true});
    attachChoice(form,'scope','Заметка', [{value:'subject',label:'К учебной дисциплине'},{value:'day',label:'К учебному дню'}]);attachChoice(form,'subjectId','Учебная дисциплина',subjects.map(s=>({value:s.id,label:s.name})));attachDate(form,'date');
    form.elements.scope.addEventListener('change',()=>{form.querySelector('[data-note-subject]').hidden=form.elements.scope.value==='day';form.querySelector('[data-note-date]').hidden=form.elements.scope.value!=='day';});
  }

  const examKinds={credit:'Зачёт',diff_credit:'Дифзачёт',exam:'Экзамен',consultation:'Консультация'};
  function localExams(group){
    const merged=new Map();
    for(const event of schedule().getEvents?.(group)||[]){
      if(!Object.hasOwn(examKinds,event.type))continue;
      const key=JSON.stringify([group,event.date,event.subject,event.type,event.teachers??event.teacher??'',event.rooms??event.room??'']);
      if(!merged.has(key))merged.set(key,{id:'local:'+key,group,subject:event.subject,date:event.date,time:'',endTime:'',type:event.type,teachers:event.teachers??event.teacher,rooms:event.rooms??event.room,confirmed:true,source:'schedule',segments:[]});
      const entry=merged.get(key);entry.confirmed=entry.confirmed&&event.confirmed===true;
      entry.segments.push({num:String(event.num??''),start:event.start,end:event.end,time:timeLabel(event.start),endTime:Number.isFinite(event.end)?timeLabel(event.end):''});
    }
    for(const entry of merged.values()){entry.segments.sort((a,b)=>(a.start??1440)-(b.start??1440));entry.time=entry.segments[0].time;entry.endTime=entry.segments.at(-1).endTime;}
    return[...merged.values()];
  }
  function assessmentIdentity(entry){
    return JSON.stringify([entry.date,entry.subject,entry.time]);
  }
  function assessmentCard(entry, history) {
    const subject = entry.subject || entry.subjectName || entry.subjectId;
    const num = entry.segments?.[0]?.num ?? entry.num;
    const provisional = !['credit','diff_credit'].includes(entry.type) && !entry.confirmed;
    const status = provisional ? badge('Предварительно', 'warning')
      : history ? '<span class="status">✓ Завершено</span>' : '';
    return window.AmiaLessonCard.render({...entry, subject, num}, {
      label:examKinds[entry.type], status, cabinet:true, state:history?'past':'upcoming'
    });
  }
  async function examsPage(){
    const group=selectedGroup();let data,offline=false;
    try{data=await api('/exams?group='+encodeURIComponent(group)+'&assessmentKinds=2',{auth:!!me});}catch(error){const entries=localExams(group);if(!entries.length&&navigator.onLine!==false)throw error;data={entries};offline=true;}
    const localKinds=new Map(localExams(group).map(entry=>[assessmentIdentity(entry),entry.type]));
    const resolved=list(data).map(entry=>entry.type==='credit'&&entry.source==='schedule'&&localKinds.get(assessmentIdentity(entry))==='diff_credit'
      ?{...entry,type:'diff_credit'}:entry);
    const history=view.segment==='history',entries=resolved.filter(e=>Object.hasOwn(examKinds,e.type)&&(history?e.date<today():e.date>=today())).sort((a,b)=>(history?b.date.localeCompare(a.date):a.date.localeCompare(b.date))||String(a.time||'').localeCompare(String(b.time||''))||String(a.subject||'').localeCompare(String(b.subject||''),'ru'));
    let html=`<div class="cab-toolbar"><button type="button" class="cab-picker-trigger" data-cab-action="exam-group"><span>Группа ${escape(group)}</span>${icons.down}</button></div>${segments([['upcoming','Ближайшие'],['history','Прошедшие']],history?'history':'upcoming','Контрольные даты')}`;
    if(offline)html+=note('Показаны сохранённые даты из расписания. Дополнительные даты появятся после подключения к кабинету.');
    if(!entries.length)return html+empty(history?'Прошедших дат нет':'Ближайших дат пока нет','Даты появляются после обновления расписания.',icons.exam);
    const days=new Map();
    for(const entry of entries){
      if(!days.has(entry.date))days.set(entry.date,[]);
      days.get(entry.date).push(entry);
    }
    const cards=[...days].map(([date,items])=>{
      const distance=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today()+'T12:00:00Z'))/86400000);
      const relative=distance===0?'Сегодня':distance===1?'Завтра':distance>1?'Через '+distance+' дн.':'';
      return `<section class="cab-exam-day">
        <div class="cab-section-title"><h3>${escape(dateLabel(date,{weekday:'short',day:'numeric',month:'long'}))}</h3>${relative?`<span>${escape(relative)}</span>`:''}</div>
        <div class="lesson-list">${items.map(entry=>assessmentCard(entry,history)).join('')}</div>
      </section>`;
    });
    return html+`<div class="cab-exam-days">${cards.join('')}</div>${note('Даты и аудитории могут меняться.')}`;
  }

  const defaultPreferences={questionReminder:false,questionBeforeMinutes:60,examReminder:false,examDaysBefore:1,absenceReminder:false,absenceThreshold:72,absenceSteps:[48,60,68,72],quietStart:'22:00',quietEnd:'08:00'};
  async function preferencesPage(){
    const group=await groupData(),context=controls(group,{person:true}),response=await api('/preferences?'+personalQuery().replace(/^&/,'')),p={...defaultPreferences,...(response.preferences||response)};view.preferences=p;
    const toggle=(name,title,description)=>`<div class="cab-switch-row"><span>${escape(title)}<small>${escape(description)}</small></span><button type="button" class="cab-switch" aria-label="${escape(title)}" aria-pressed="${!!p[name]}" data-pref-toggle="${name}"></button><input type="hidden" name="${name}" value="${p[name]?'1':'0'}"></div>`;
    return context+`<form class="cab-form" id="cabPreferences">${note('Напоминания приходят в личный чат <a href="https://t.me/Qdr0pbot" target="_blank" rel="noopener noreferrer">Qdropbot ↗</a>. Режимы можно включать независимо друг от друга.')}${toggle('questionReminder','О взятом вопросе','Перед занятием, к которому вы выбрали вопрос')}${pickerField('questionBeforeMinutes','За сколько напомнить',String(p.questionBeforeMinutes),p.questionBeforeMinutes>=60?'За '+number(p.questionBeforeMinutes/60)+' ч':'За '+p.questionBeforeMinutes+' мин')}${toggle('examReminder','О зачёте или экзамене','Только по подтверждённым датам вашей группы')}${pickerField('examDaysBefore','За сколько дней',String(p.examDaysBefore),'За '+p.examDaysBefore+' дн.')}${toggle('absenceReminder','О количестве пропусков','При достижении контрольных уровней неуважительных часов')}<div class="cab-card"><h4>Контрольный порог — ${number(p.absenceThreshold)} ч</h4><p class="cab-note" style="margin:0">Предупреждения: ${(p.absenceSteps||defaultPreferences.absenceSteps).map(number).join(', ')} учебных часов. Повторные сообщения по одному уровню не отправляются.</p></div><div class="cab-form-grid">${field('quietStart','Тихие часы с',p.quietStart,'22:00',{required:true,maxLength:5})}${field('quietEnd','До',p.quietEnd,'08:00',{required:true,maxLength:5})}</div>${note('Время — Минск. Счётчик основан на подтверждённых отметках табеля и служит предупреждением, а не решением об отчислении.')}<p class="cab-inline-error" role="alert"></p><button type="submit" class="cab-action primary">Сохранить настройки</button></form>`+section('Аккаунт')+`<div class="cab-actions">${action('Выйти из кабинета','logout','','subtle')}</div>`;
  }
  function bindPreferences(){
    const form=main.body.querySelector('#cabPreferences');if(!form)return;
    form.querySelectorAll('[data-pref-toggle]').forEach(button=>button.onclick=()=>{const value=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(value));form.elements[button.dataset.prefToggle].value=value?'1':'0';});
    attachChoice(form,'questionBeforeMinutes','Напомнить о вопросе',[15,30,60,120,180,1440].map(value=>({value:String(value),label:value===1440?'За день':value>=60?'За '+value/60+' ч':'За '+value+' мин'})));
    attachChoice(form,'examDaysBefore','Напомнить о зачёте или экзамене',[1,2,3,7].map(value=>({value:String(value),label:'За '+value+' дн.'})));
    form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;setFormError(form,'');try{const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;if(!time.test(form.elements.quietStart.value)||!time.test(form.elements.quietEnd.value))throw apiError('Время указывается в формате ЧЧ:ММ.');const p={...view.preferences,questionReminder:form.elements.questionReminder.value==='1',examReminder:form.elements.examReminder.value==='1',absenceReminder:form.elements.absenceReminder.value==='1',questionBeforeMinutes:Number(form.elements.questionBeforeMinutes.value),examDaysBefore:Number(form.elements.examDaysBefore.value),quietStart:form.elements.quietStart.value,quietEnd:form.elements.quietEnd.value,...(me.owner&&contextPerson?{personId:contextPerson}:{})};delete p.ok;await api('/preferences',{method:'POST',body:p});toast('Настройки сохранены');}catch(error){setFormError(form,error.message);}finally{submit.disabled=false;}};
  }

  async function handleClick(event){
    const button=event.target.closest('[data-cab-action]');if(!button||button.disabled)return;
    const command=button.dataset.cabAction;
    try{
      if(['home','login','questions','attendance','grades','notes','exams','preferences'].includes(command)){navigate(command);return;}
      if(command==='guest'){close();return;}
      if(command==='refresh'){questionCache.clear();groups.clear();await draw();return;}
      if(command==='group'){await chooseGroup();return;}
      if(command==='person'){await choosePerson();return;}
      if(command==='begin-login'){await beginLogin();return;}
      if(command==='cancel-login'){stopLogin();draw();return;}
      if(command==='logout'){await api('/auth/logout',{method:'POST',body:{}}).catch(()=>{});token='';me=null;contextGroup='';contextPerson='';groups.clear();questionCache.clear();safeWrite(TOKEN_KEY,null);updateEntry();frames.forEach(frame=>window.GlassUI?.navigationStepClosed?.(main.dialog,frame.key));frames=[];view={page:'home'};await draw();toast('Вы вышли из кабинета');return;}
      if(command==='segment'){navigate(view.page,{segment:button.dataset.segment,...(view.page==='attendance'?{date:view.date||today()}:{})});return;}
      if(command==='attendance-date'){chooseDate(view.date||today(),date=>navigate('attendance',{date,segment:view.segment||'day'}));return;}
      if(command==='attendance-prev'||command==='attendance-next'){navigate('attendance',{date:shiftDay(view.date||today(),command.endsWith('prev')?-1:1),segment:view.segment||'day'});return;}
      if(command==='attendance-summary'){await openAttendanceSummary(button.dataset.person);return;}
      if(command==='attendance-edit'){await editAttendance();return;}
      if(command==='attendance-cell'){await editAttendance({person:button.dataset.person,lesson:button.dataset.lesson||'',date:button.dataset.date});return;}
      if(command==='audit'){await openAudit();return;}
      if(command==='grade-subject'){navigate('grades',{subjectId:button.dataset.subject});return;}
      if(command==='grade-add'||command==='grade-edit'){await editGrade(button.dataset.id);return;}
      if(command==='grade-delete'){confirmAction('Удалить оценку?','Эта запись исчезнет из личного списка и расчёта среднего балла.',()=>api('/grades?id='+encodeURIComponent(button.dataset.id),{method:'DELETE'}));return;}
      if(command==='note-add'||command==='note-edit'){await editNote(button.dataset.id,{},button);return;}
      if(command==='note-delete'){confirmAction('Удалить заметку?','Заметка будет удалена из вашего кабинета.',()=>api('/notes?id='+encodeURIComponent(button.dataset.id),{method:'DELETE'}));return;}
      if(command==='exam-group'){openChoice('Учебная группа',(me?.groups||['4501','4502','4503']).map(g=>({value:g,label:'Группа '+g})),{selected:selectedGroup(),onPick:g=>{contextGroup=g;contextPerson='';draw();}});return;}
      if(command==='question-materials'||command==='question-note'){
        const item=view.questionItems?.[+button.dataset.index];if(!item)return;const data=await api('/questions?group='+selectedGroup()+personalQuery());
        const lesson=list(data,'lessons').find(l=>l.key===item.lessonKey);
        if(command==='question-materials'&&lesson){window.StudyMaterials?.openLesson?.(lesson);return;}
        const group=await groupData(),subject=list(group,'subjects').find(s=>s.name===item.subject);await editNote('',{scope:'day',date:item.date,text:`${item.subject} · Вопрос ${item.number}\n${item.text}\n\n`});return;
      }
    }catch(error){toast(error.message);}
  }

  async function decorateQuestions(container,match,{force=false}={}){
    if(!container||!match)return;
    const epoch=++claimSerial;claimViews.set(container,epoch);
    if(!me){
      container.querySelectorAll('.cab-taken,.cab-study-note').forEach(element=>element.remove());
      if(match.lesson?.date&&['seminar','practice','practical'].includes(match.kind||match.lesson.type)&&!container.querySelector('.cab-claims-hint')){const button=document.createElement('button');button.type='button';button.className='cab-study-note cab-claims-hint';button.textContent='Войти, чтобы увидеть, кто взял вопросы';button.onclick=()=>open('login');container.append(button);}
      return;
    }
    container.querySelector('.cab-claims-hint')?.remove();
    if(!container.querySelector('.cab-study-note')){
      const button=document.createElement('button');button.type='button';button.className='cab-study-note';button.innerHTML=icons.note+'Моя заметка к предмету';button.onclick=()=>editNote('',{scope:'subject',subjectId:match.subject.id},button);container.append(button);
    }
    if(!match?.lesson?.date||!['seminar','practice','practical'].includes(match.kind||match.lesson.type))return;
    const lesson=match.lesson,group=lesson.group||schedule().getGroup?.()||selectedGroup();
    if(!me.owner&&group!==me.person.group)return;
    const rows=[...container.querySelectorAll('.study-questions li')],kind=value=>value==='practical'?'practice':value;
    const setChip=(row,label,claimed,callback)=>{
      const text=row.querySelector('.study-question-text');if(!text)return;
      let chip=row.querySelector('.cab-taken');if(!chip){chip=document.createElement('button');chip.type='button';chip.className='cab-taken';let wrapper=text.parentElement;if(!wrapper.classList.contains('cab-question-with-claim')){wrapper=document.createElement('span');wrapper.className='cab-question-with-claim';text.replaceWith(wrapper);wrapper.append(text);}wrapper.append(chip);}
      chip.dataset.claimed=String(claimed);chip.innerHTML=icons.user+escape(label);chip.disabled=!callback;chip.onclick=callback||null;return chip;
    };
    rows.forEach(row=>{if(!row.querySelector('.cab-taken'))setChip(row,'Проверяем…',false,null);});
    try{
      const data=await questionsData(group,force,{date:lesson.date,num:lesson.num,subjectId:match.subject.id,type:kind(match.kind||lesson.type)}),candidates=list(data,'lessons').filter(l=>l.date===lesson.date&&(l.subjectId===match.subject.id||l.subject===match.subject.name)&&String(l.theme||'').replace(/\s/g,'')===String(lesson.theme||match.requested||'').replace(/\s/g,'')&&kind(match.kind||lesson.type)===kind(l.type));
      const exact=candidates.find(l=>String(l.num)===String(lesson.num))||candidates.find(l=>l.start===lesson.start)||(candidates.length===1?candidates[0]:null);
      if(!container.isConnected||claimViews.get(container)!==epoch||!me)return;
      if(!exact){rows.forEach(row=>setChip(row,'Нет данных',false,()=>makeSheet('Выбор вопроса',note('Для этого занятия пока нет синхронизированного опроса.'))));return;}
      const questions=exact.questions||[];
      rows.forEach((row,index)=>{
        const text=row.querySelector('.study-question-text');if(!text)return;
        const item=questions[index];if(!item||String(item.text).trim()!==text.textContent.trim()){setChip(row,'Нет данных',false,()=>makeSheet('Выбор вопроса',note('Вопросы опроса и программы пока не совпадают. Сверьте выбранное занятие.')));return;}
        const people=item.takers||[],claimed=people.length>0||item.claimed===true,unknown=item.claimed===null||item.claimed===undefined&&exact.coverage!=='complete';
        const chip=setChip(row,claimed?'Взяли'+(people.length>1?' · '+people.length:''):(unknown?'Нет данных':'Свободен'),claimed,()=>{makeSheet('Вопрос '+item.number,`${note(escape(item.text))}${people.length?`<div class="cab-pick-list">${people.map(p=>`<div class="cab-pick-option" style="cursor:default"><span>${escape(shortName(p))}</span></div>`).join('')}</div>`:note(claimed?'Вопрос выбрали в опросе. Имена пока не синхронизированы.':unknown?'Бот пока не сохранил полные данные об этом голосовании.':'Этот вопрос пока никто не выбрал в опросе бота.')}${note('Выбор вопроса меняется в опросе Telegram. Отметка не означает, что участника уже вызвали отвечать.')}`);});
        chip.setAttribute('aria-label',claimed?'Кто взял вопрос '+item.number:'Статус вопроса '+item.number);
      });
    }catch{if(container.isConnected&&claimViews.get(container)===epoch)rows.forEach(row=>setChip(row,'Нет связи',false,()=>makeSheet('Статус вопроса',`${note('Сейчас не удалось получить данные опроса. Подключение проверится после возвращения в расписание.')}<div class="cab-actions">${action('Повторить','retry-claim')}</div>`,{onMount:picker=>{picker.body.querySelector('[data-cab-action=retry-claim]').onclick=()=>{picker.close();decorateQuestions(container,match,{force:true});};}})));}
  }

  function initialize(){
    document.getElementById('cabinetOpen')?.addEventListener('click',()=>open());
    document.getElementById('cabinetExamsOpen')?.addEventListener('click',()=>open('exams'));
    updateEntry();restoreSession();
    window.addEventListener('online',()=>{if(token&&!me)restoreSession();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)return;if(token&&!me){restoreSession();return;}if(main&&me&&['home','attendance','questions','exams'].includes(view.page))draw({quiet:true});});
  }
  window.AmiaCabinet={open,close,decorateQuestions,editNote,get authenticated(){return!!me;},refresh:()=>{groups.clear();questionCache.clear();return draw();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();

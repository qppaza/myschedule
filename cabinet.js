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
  const pageNames = {home:'Личный кабинет',login:'Вход через Telegram',questions:'Мои вопросы',attendance:'Посещаемость',grades:'Мои оценки',notes:'Личные заметки',exams:'Зачёты и экзамены',preferences:'Напоминания'};
  const roles = {student:'Студент',starosta:'Староста',deputy:'Заместитель старосты',owner:'Владелец'};
  const reasonNames = {'Б':'Болезнь','УП':'По заявлению','ПН':'Причина неизвестна','СБ':'Сборы и соревнования','ОМ':'Общественные мероприятия','Ц':'ЦКВР','ПР':'Присутствовал без участия','Н':'Неуважительная причина','ОП':'Опоздание','':'Снять отметку'};
  const today = () => {try{const values={};new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Minsk',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(p=>{values[p.type]=p.value;});return `${values.year}-${values.month}-${values.day}`;}catch{return new Date(Date.now()+10800000).toISOString().slice(0,10);}};
  const dateLabel = (date, options={day:'numeric',month:'long'}) => {
    try { return new Intl.DateTimeFormat('ru-RU',{...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')); } catch { return String(date||'Дата не указана'); }
  };
  const shiftDay=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const timeLabel = minutes => typeof minutes === 'number' ? `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}` : String(minutes||'');
  const shortName = person => person.shortName || (()=>{const [surname,...rest]=String(person.name||'Участник').trim().split(/\s+/);return surname+(rest.length?' '+rest.map(n=>n[0]+'.').join(''):'');})();
  const list = (value,key='entries') => Array.isArray(value)?value:Array.isArray(value?.[key])?value[key]:[];
  const number = value => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(value)||0);
  const plural = (value,one,few,many) => value%10===1&&value%100!==11?one:value%10>=2&&value%10<=4&&(value%100<12||value%100>14)?few:many;
  const safeRead = key => { try{return localStorage.getItem(key);}catch{return null;} };
  const safeWrite = (key,value) => { try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value);}catch{} };
  let token=safeRead(TOKEN_KEY)||'', me=null, main=null, view={page:'home'}, frames=[], serial=0, renderEpoch=0, loginEpoch=0, contextGroup='', contextPerson='', refreshTimer=0;
  const groups=new Map(), questionCache=new Map(), claimViews=new WeakMap();
  let claimSerial=0, noteEditorPending=false, avatarSession='', avatarUrl='';
  const apiError = (message,status=0,code='')=>Object.assign(new Error(message),{status,code});
  const schedule=()=>window.AmiaSchedule||{};
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

  function makeSheet(title,content,{large=false,onClose,onMount}={}){
    const dialog=document.createElement('dialog');
    dialog.className=large?'cabinet-dialog study-dialog study-shared-sheet':'cab-picker study-dialog study-shared-sheet';
    dialog.id=large?'cabinetDialog':'cabinetPicker'+(++serial);dialog.setAttribute('aria-labelledby',dialog.id+'Title');
    dialog.innerHTML=`<div class="study-handle"></div><div class="study-dialog-top">${large?`<button type="button" class="study-round cab-back" aria-label="Назад" hidden>${icons.back}</button>`:''}<div class="study-dialog-title"><p>${large?'AMIA · УЧЕБНЫЙ КАБИНЕТ':'ВЫБОР'}</p><h2 id="${dialog.id}Title">${escape(title)}</h2></div><button type="button" class="study-round cab-close" aria-label="Закрыть">${icons.close}</button></div><div class="study-body">${content}</div>`;
    document.body.append(dialog);
    const previous=document.activeElement,oldOverflow=document.body.style.overflow;
    let closing=false,closed=false,resolveClosed;
    const closedSheet=new Promise(resolve=>{resolveClosed=resolve;});
    function finish(){if(closed)return;closed=true;if(dialog.open)dialog.close?.();dialog.removeAttribute('open');window.GlassUI?.panelClosed?.(dialog);document.body.style.overflow=oldOverflow;dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});try{onClose?.();}finally{resolveClosed();}}
    function close(){if(!closing&&!closed){closing=true;window.GlassUI?.closeSheet?window.GlassUI.closeSheet(dialog,finish):finish();}return closedSheet;}
    dialog.querySelector('.cab-close').onclick=close;
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
    onMount?.(result);dialog.querySelector('.cab-close')?.focus({preventScroll:true});return result;
  }

  function openChoice(title,items,{selected,multiple=false,onPick,description=''}={}){
    const chosen=new Set(multiple?(Array.isArray(selected)?selected:[]):[String(selected??'')]);
    const picker=makeSheet(title,`${description?note(escape(description)):''}${multiple?`<div class="cab-pick-toolbar">${action('Выбрать всё','all')}${action('Снять выбор','none')}${note('Выбор сохраняется при закрытии списка.')}</div>`:''}<div class="cab-pick-list" role="${multiple?'group':'listbox'}" aria-label="${escape(title)}">${items.map(item=>`<button type="button" class="cab-pick-option" data-value="${escape(item.value)}" ${item.disabled?'disabled':''} ${multiple?'aria-pressed':'aria-selected'}="${chosen.has(String(item.value))}"><span>${escape(item.label)}${item.detail?`<small>${escape(item.detail)}</small>`:''}</span>${icons.check}</button>`).join('')}</div>`,{onClose:()=>{if(multiple)onPick?.([...chosen]);}});
    picker.body.onclick=e=>{
      const option=e.target.closest('[data-value]');
      if(option&&!option.disabled){const value=option.dataset.value;if(!multiple){picker.close();onPick?.(value);return;}chosen.has(value)?chosen.delete(value):chosen.add(value);option.setAttribute('aria-pressed',String(chosen.has(value)));}
      const command=e.target.closest('[data-cab-action]')?.dataset.cabAction;
      if(command==='all'){items.filter(item=>!item.disabled).forEach(item=>chosen.add(String(item.value)));picker.body.querySelectorAll('[data-value]').forEach(button=>button.setAttribute('aria-pressed',String(chosen.has(button.dataset.value))));}
      if(command==='none'){chosen.clear();picker.body.querySelectorAll('[data-value]').forEach(button=>button.setAttribute('aria-pressed','false'));}
    };
    return picker;
  }

  function chooseDate(value,onPick){
    let current=/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value:today(),month=current.slice(0,7)+'-01';
    let rail=null;
    const picker=makeSheet('Выберите дату','',{onClose:()=>rail?.destroy?.()});
    picker.dialog.classList.add('cab-calendar-picker');
    const choose=date=>{picker.close();onPick(date);};
    function draw(focusDate){
      rail?.destroy?.();rail=null;
      const weekday=(new Date(month+'T12:00:00Z').getUTCDay()+6)%7,count=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate(),label=dateLabel(month,{month:'long',year:'numeric'});
      const offday=date=>window.offdayLabel?.(date)||(new Date(date+'T12:00:00Z').getUTCDay()===0?'Воскресенье — выходной':'');
      picker.body.innerHTML=`<div class="date-month-nav cab-calendar-month"><button type="button" class="study-round" data-month="-1" aria-label="Предыдущий месяц">${icons.back}</button><h3>${escape(label.charAt(0).toUpperCase()+label.slice(1))}</h3><button type="button" class="study-round" data-month="1" aria-label="Следующий месяц">${icons.next}</button></div><div class="date-weekdays" aria-hidden="true">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>`<span>${day}</span>`).join('')}</div><div class="cab-date-grid date-grid">${'<span aria-hidden="true"></span>'.repeat(weekday)}${Array.from({length:count},(_,i)=>{const date=month.slice(0,8)+String(i+1).padStart(2,'0'),holiday=offday(date);return`<button type="button" data-date="${date}" aria-label="${escape(dateLabel(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}${holiday?', '+escape(holiday):''}" aria-pressed="${date===current}" data-offday="${!!holiday}" data-today="${date===today()}" ${date===today()?'aria-current="date"':''}>${i+1}</button>`;}).join('')}</div><p class="date-calendar-note"><span>Розовым</span> — воскресенья и нерабочие праздники</p><div class="cab-actions cab-calendar-footer">${action('Сегодня','today')}${action('Закрыть','cancel')}</div>`;
      const grid=picker.body.querySelector('.cab-date-grid');
      if(window.mountDragRail){grid.classList.add('has-date-rail');rail=window.mountDragRail(grid,{thumbSelector:'.date-thumb',thumbClass:'date-thumb',axis:'both',keyboard:false,commit:button=>choose(button.dataset.date)});}
      if(focusDate)grid.querySelector(`[data-date="${focusDate}"]`)?.focus({preventScroll:true});
    }
    picker.body.onclick=e=>{const date=e.target.closest('[data-date]')?.dataset.date;if(date){choose(date);return;}const step=e.target.closest('[data-month]')?.dataset.month;if(step){const d=new Date(month+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(step));month=d.toISOString().slice(0,10);draw();}const command=e.target.closest('[data-cab-action]')?.dataset.cabAction;if(command==='today')choose(today());if(command==='cancel')picker.close();};
    picker.body.addEventListener('keydown',e=>{const date=e.target.closest('[data-date]')?.dataset.date,delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(!date||delta===undefined)return;e.preventDefault();const next=shiftDay(date,delta);month=next.slice(0,7)+'-01';draw(next);});
    draw();return picker;
  }

  function field(name,label,value='',placeholder='',{type='text',required=false,maxLength=200,min,max}={}){return`<label class="cab-field"><span>${escape(label)}</span><input name="${escape(name)}" type="${type}" value="${escape(value)}" placeholder="${escape(placeholder)}" ${required?'required':''} maxlength="${maxLength}" ${min!==undefined?`min="${min}"`:''} ${max!==undefined?`max="${max}"`:''} autocomplete="off"></label>`;}
  function pickerField(name,label,value,display){return`<div class="cab-field"><span>${escape(label)}</span><input type="hidden" name="${escape(name)}" value="${escape(value)}"><button type="button" class="cab-picker-trigger" data-field-picker="${escape(name)}"><span>${escape(display||'Выбрать')}</span>${icons.down}</button></div>`;}
  function textField(name,label,value='',placeholder=''){return`<label class="cab-field"><span>${escape(label)}</span><textarea name="${escape(name)}" maxlength="10000" placeholder="${escape(placeholder)}">${escape(value)}</textarea></label>`;}
  function attachChoice(form,name,title,items,{multiple=false}={}){
    form.querySelector(`[data-field-picker="${name}"]`).onclick=()=>{
      const input=form.elements[name],options=typeof items==='function'?items():items;
      let selected=input.value;if(multiple){try{selected=JSON.parse(selected);}catch{selected=[];}}
      openChoice(title,options,{selected,multiple,onPick:value=>{input.value=multiple?JSON.stringify(value):value;const values=new Set(multiple?value:[value]);form.querySelector(`[data-field-picker="${name}"]>span`).textContent=options.filter(item=>values.has(String(item.value))).map(item=>item.label).join(', ')||'Выбрать';input.dispatchEvent(new Event('change',{bubbles:true}));}});
    };
  }
  function attachDate(form,name){form.querySelector(`[data-field-picker="${name}"]`).onclick=()=>chooseDate(form.elements[name].value,date=>{form.elements[name].value=date;form.querySelector(`[data-field-picker="${name}"]>span`).textContent=dateLabel(date,{day:'numeric',month:'long',year:'numeric'});form.elements[name].dispatchEvent(new Event('change',{bubbles:true}));});}
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
    if(!groups.has(group))groups.set(group,await api('/group?group='+encodeURIComponent(group)));
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
  async function restoreSession(){if(!token)return;try{const value=await api('/me');me=value.me||value;contextGroup=me.person.group;if(!me.owner)schedule().setGroup?.(me.person.group);updateEntry();if(main)draw();}catch{updateEntry();}}
  function stopLogin(){loginEpoch++;}
  function close(){stopLogin();clearInterval(refreshTimer);refreshTimer=0;main?.close();}
  function back(){const frame=frames.at(-1);if(frame){restoreFrame(frame);return;}close();}
  function restoreFrame(frame){const index=frames.indexOf(frame);if(index<0)return;frames.splice(index);window.GlassUI?.navigationStepClosed?.(main?.dialog,frame.key);view=frame.previous;stopLogin();draw();}
  function navigate(page,extra={}){if(!main)return open(page,extra);const next={page,...extra};if(view.page===page&&(view.segment||'')===(next.segment||'')&&(view.date||'')===(next.date||''))return;const frame={key:'cab-view-'+(++serial),previous:{...view}};frames.push(frame);view=next;stopLogin();draw();window.GlassUI?.navigationStep?.(main.dialog,frame.key,{back:()=>restoreFrame(frame)});}
  function open(page='home',extra={}){
    if(main){navigate(page,extra);return;}
    view={page,...extra};frames=[];
    main=makeSheet(pageNames[page]||pageNames.home,'<div class="cab-loading">Открываем раздел</div>',{large:true,onClose:()=>{main=null;frames=[];renderEpoch++;stopLogin();clearInterval(refreshTimer);refreshTimer=0;}});
    main.dialog.querySelector('.cab-back').onclick=back;
    main.body.onclick=handleClick;draw();
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
  async function draw({quiet=false}={}){
    if(!main)return;const epoch=++renderEpoch,page=view.page;
    const retained=main.body.dataset.cabinetPage===page?main.body.querySelector(':scope > .cab-segments'):null;
    main.heading.textContent=pageNames[page]||pageNames.home;
    main.dialog.querySelector('.cab-back').hidden=!frames.length;
    if(!quiet&&!retained)main.body.innerHTML='<div class="cab-loading" role="status">Открываем раздел</div>';
    try{
      let html;
      if(!me&&!['home','login','exams'].includes(page))html=guestPage();
      else html=await ({home:homePage,login:loginPage,questions:questionsPage,attendance:attendancePage,grades:gradesPage,notes:notesPage,exams:examsPage,preferences:preferencesPage}[page]||homePage)();
      if(epoch!==renderEpoch||!main)return;
      const scroll=quiet||retained?main.body.scrollTop:0;
      replaceCabinetBody(main.body,html,retained);main.body.dataset.cabinetPage=page;
      main.body.scrollTop=scroll;mountSegments(main.body);
      if(page==='home')paintAvatar();
      if(page==='preferences')bindPreferences();
      if(page==='login')bindLoginPage();
    }catch(error){
      if(epoch!==renderEpoch||!main||quiet)return;
      main.body.innerHTML=`<div class="cab-error"><p>${escape(error.message)}</p><div class="cab-actions">${action('Попробовать ещё','refresh',icons.refresh)}${!me?action('Режим гостя','guest'):''}</div></div>`;
    }
  }

  function guestPage(){return`<div class="cab-welcome"><span class="cab-avatar">${icons.user}</span><h3>Учёба под рукой</h3><p>Войдите через Telegram, чтобы видеть свои вопросы, оценки, заметки и посещаемость. Расписание и учебные материалы открыты и в режиме гостя.</p><div class="cab-actions cab-stack">${action('Войти через Telegram','login',icons.telegram,'primary')}${action('Продолжить как гость','guest','','subtle')}</div></div>${section('Без входа')}<div class="cab-grid"><button type="button" class="cab-tile" data-cab-action="guest">${icons.calendar}<strong>Расписание</strong><small>Все группы и материалы занятий</small></button><button type="button" class="cab-tile" data-cab-action="exams">${icons.exam}<strong>Зачёты и экзамены</strong><small>Ближайшие даты вашей группы</small></button></div>${note('Привязка выполняется по подтверждённому аккаунту Telegram. Вводить свой номер журнала вручную не нужно.')}`;}
  async function homePage(){
    if(!me)return guestPage();
    const person=me.person,initials=person.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('');
    const tiles=[['questions','Мои вопросы','Взятые вопросы и история подготовки','book'],['attendance','Посещаемость',manages()?'Общий табель и правки группы':'Табель и мои пропуски','calendar'],['grades','Мои оценки','Отметки и средний балл','grades'],['notes','Личные заметки','К предмету или учебному дню','note'],['exams','Зачёты и экзамены','Ближайшие контрольные даты','exam'],['preferences','Напоминания','Вопросы, зачёты и пропуски','bell']];
    return`<div class="cab-profile"><span class="cab-avatar">${escape(initials)}</span><div class="cab-profile-copy"><h3>${escape(person.name)}</h3><p>Группа ${escape(person.group)} · № ${person.number} в журнале</p><span class="cab-role">${escape(roles[person.role]||'Студент')}</span></div></div><div class="cab-grid">${tiles.map(([id,title,description,icon])=>`<button type="button" class="cab-tile" data-cab-action="${id}">${icons[icon]}<strong>${escape(title)}</strong><small>${escape(description)}</small></button>`).join('')}</div>${note(me.owner?'Вам доступно управление всеми группами и кабинетами. Группу и участника можно выбрать внутри раздела.':'Личные записи сохраняются за вашим аккаунтом и доступны вам и владельцу системы. Табель группы видят участники; правки доступны старосте и заместителю.')}<div class="cab-actions" style="margin-top:18px">${action('Вернуться к расписанию','guest',icons.calendar,'subtle')}${action('Выйти','logout','','subtle')}</div>`;
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
          token=result.token;safeWrite(TOKEN_KEY,token);me=identity.me||identity;contextGroup=me.person.group;contextPerson='';if(!me.owner)schedule().setGroup?.(me.person.group);groups.clear();questionCache.clear();updateEntry();stopLogin();toast('Вы вошли в кабинет');view={page:'home'};frames.forEach(frame=>window.GlassUI?.navigationStepClosed?.(main.dialog,frame.key));frames=[];await draw();return;
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
    const totals=list(data,'totals'),ownTotal=totals.find(t=>t.personId===personId()),monthMode=view.segment==='month',editable=!!data.canEdit;
    let html=controls(group)+`<div class="cab-date-nav"><button type="button" class="study-round" data-cab-action="attendance-prev" aria-label="Предыдущий день">${icons.back}</button><button type="button" class="cab-picker-trigger" data-cab-action="attendance-date"><span>${escape(dateLabel(date,{weekday:'short',day:'numeric',month:'long'}))}</span>${icons.down}</button><button type="button" class="study-round" data-cab-action="attendance-next" aria-label="Следующий день">${icons.next}</button></div>`;
    if(ownTotal)html+=`<div class="cab-summary"><div class="cab-stat"><strong>${number(ownTotal.hours)}</strong><span>часов пропущено</span></div><div class="cab-stat warning"><strong>${number(ownTotal.unexcusedHours)}</strong><span>неуважительных часов</span></div><div class="cab-stat"><strong>72</strong><span>контрольный порог</span></div></div>`;
    html+=`<div class="cab-toolbar">${segments([['day','День'],['month','Месяц']],monthMode?'month':'day','Вид табеля')}${editable?action('Внести отметку','attendance-edit',icons.plus,'primary',dayLessons.length?'':'disabled'):''}${editable?action('Правки','audit',icons.clock):''}</div>`;
    if(!allLessons.length)return html+empty('На этот месяц нет занятий','Выберите другой месяц. Пустая ячейка не означает отсутствие.',icons.calendar);
    if(monthMode){
      const dates=[...new Set(allLessons.map(l=>l.date))].sort();
      html+=`<div class="cab-attendance-wrap"><table class="cab-attendance"><thead><tr><th>Участник</th>${dates.map(d=>`<th>${+d.slice(8)}<br>${escape(dateLabel(d,{weekday:'short'}))}</th>`).join('')}</tr></thead><tbody>${people.map(p=>`<tr><td><span class="cab-person-number">${p.number}</span>${escape(shortName(p))}${p.role!=='student'?`<span class="cab-person-role">${escape(roles[p.role]||'')}</span>`:''}</td>${dates.map(d=>{const found=allLessons.filter(l=>l.date===d).map(l=>map.get(p.id+'|'+l.key)).filter(e=>e?.code),codes=[...new Set(found.map(e=>e.code))];return`<td><button type="button" ${editable?'':'disabled'} data-cab-action="attendance-cell" data-person="${escape(p.id)}" data-date="${d}" class="${!codes.length?'cab-cell-empty':found.some(e=>e.unexcused)?'cab-cell-unexcused':''}" aria-label="${escape(shortName(p)+', '+dateLabel(d)+': '+(codes.join(', ')||'нет отметок'))}">${escape(codes.join(' / ')||'—')}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
    }else if(dayLessons.length){
      html+=`<div class="cab-attendance-wrap"><table class="cab-attendance"><thead><tr><th>Участник</th>${dayLessons.map(l=>`<th title="${escape(l.subject)}">${l.num}-я<br>${escape(timeLabel(l.start))}</th>`).join('')}</tr></thead><tbody>${people.map(p=>`<tr><td><span class="cab-person-number">${p.number}</span>${escape(shortName(p))}${p.role!=='student'?`<span class="cab-person-role">${escape(roles[p.role]||'')}</span>`:''}</td>${dayLessons.map(l=>{const entry=map.get(p.id+'|'+l.key);return`<td><button type="button" ${editable?'':'disabled'} data-cab-action="attendance-cell" data-person="${escape(p.id)}" data-lesson="${escape(l.key)}" data-date="${date}" class="${!entry?.code?'cab-cell-empty':entry.unexcused?'cab-cell-unexcused':''}" aria-label="${escape(shortName(p)+', '+l.num+'-я пара: '+(entry?.code?reasonNames[entry.code]||entry.code:'нет отметки'))}">${escape(entry?.code||'—')}${entry?.code&&entry?.lateMinutes?`<br><small>${entry.lateMinutes} мин</small>`:''}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>${note(dayLessons.map(l=>`${l.num}-я · ${escape(l.subject)}`).join('<br>'))}`;
    }else html+=empty('В этот день занятий нет','Выберите учебный день в календаре.',icons.calendar);
    return html+`<div class="cab-attendance-legend">${Object.entries(reasonNames).filter(([code])=>code).map(([code,title])=>`<span><b>${escape(code)}</b> — ${escape(title)}</span>`).join('')}</div>`+note(editable?'Табель общий для старосты и заместителя. Все изменения сохраняются с автором и временем. ПР применяется только к физкультуре.':'Табель доступен для просмотра. Причины пропусков вносят староста и заместитель.')+note('ПН означает неизвестную причину и не становится неуважительным пропуском автоматически. Учёт ведётся в учебных часах; контрольный порог служит предупреждением.');
  }
  async function editAttendance({person='',lesson='',date=view.date||today()}={}){
    const group=await groupData(),data=date.slice(0,7)===(view.date||today()).slice(0,7)?view.attendance:await api('/attendance?group='+selectedGroup()+'&month='+date.slice(0,7));
    if(!data?.canEdit)return toast('Правки доступны старосте и заместителю');
    const people=list(group,'people'),lessons=list(data,'lessons').filter(l=>l.date===date),entry=person&&lesson?list(data).find(e=>e.personId===person&&e.lessonKey===lesson):null;
    if(!lessons.length)return toast('В выбранный день нет занятий');
    const personIds=person?[person]:[],lessonKeys=lesson?[lesson]:lessons.map(l=>l.key),initialCode=entry?entry.code:'Б';
    const picker=makeSheet('Отметка посещаемости',`<form class="cab-form">${note(escape(dateLabel(date,{weekday:'long',day:'numeric',month:'long'})))}${pickerField('people','Участники',JSON.stringify(personIds),person?people.find(p=>p.id===person)?.name:'Выбрать участников')}${pickerField('lessons','Занятия',JSON.stringify(lessonKeys),lesson?lessons.find(l=>l.key===lesson)?.num+'-я пара':'Все пары этого дня')}${pickerField('code','Причина',initialCode,reasonNames[initialCode])}<div class="cab-form-grid">${field('lateMinutes','Опоздание, минут',entry?.lateMinutes||'','Например, 15',{type:'number',min:0,max:600})}${field('comment','Комментарий',entry?.comment||'','Необязательно',{maxLength:500})}</div><div class="cab-switch-row"><span>Неуважительный пропуск<small>Учитывать выбранные часы в контрольном пороге</small></span><button type="button" class="cab-switch" aria-label="Неуважительный пропуск" aria-pressed="${!!entry?.unexcused}" data-form-toggle="unexcused"></button><input type="hidden" name="unexcused" value="${entry?.unexcused?'1':'0'}"></div><p class="cab-inline-error" role="alert"></p><button type="submit" class="cab-action primary">Сохранить отметку</button></form>`);
    const form=submitForm(picker,async form=>{
      const persons=JSON.parse(form.elements.people.value),keys=JSON.parse(form.elements.lessons.value);if(!persons.length||!keys.length)throw apiError('Выберите участников и занятия.');
      const versions={};for(const p of persons)for(const key of keys)versions[p+'|'+key]=list(data).find(e=>e.personId===p&&e.lessonKey===key)?.version||0;
      await api('/attendance',{method:'POST',body:{group:selectedGroup(),personIds:persons,lessonKeys:keys,code:form.elements.code.value,lateMinutes:Number(form.elements.lateMinutes.value)||0,comment:form.elements.comment.value,unexcused:form.elements.unexcused.value==='1',versions}});toast('Табель обновлён');
    });
    attachChoice(form,'people','Кого отметить',people.map(p=>({value:p.id,label:p.name,detail:'№ '+p.number})),{multiple:true});
    attachChoice(form,'lessons','На каких парах',lessons.map(l=>({value:l.key,label:l.num+'-я · '+l.subject,detail:timeLabel(l.start)+'–'+timeLabel(l.end)})),{multiple:true});
    attachChoice(form,'code','Причина',()=>Object.entries(reasonNames).map(([code,label])=>({value:code,label:code?code+' · '+label:label,detail:code==='ПР'?'Только физкультура':code==='УП'?'По заявлению · факультет права':'',disabled:code==='ПР'&&JSON.parse(form.elements.lessons.value).some(key=>!/физкультур|физическ/i.test(lessons.find(l=>l.key===key)?.subject||''))})));
    form.elements.code.addEventListener('change',()=>{const yes=form.elements.code.value==='Н';form.elements.unexcused.value=yes?'1':'0';form.querySelector('[data-form-toggle]').setAttribute('aria-pressed',String(yes));});
    form.querySelector('[data-form-toggle]').onclick=e=>{const b=e.currentTarget,value=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(value));form.elements.unexcused.value=value?'1':'0';};
  }
  async function openAudit(){
    const data=await api('/audit?group='+selectedGroup()),changes=list(data,'changes');
    const picker=makeSheet('История правок',changes.length?`<div class="cab-list">${changes.slice(0,50).map((change,index)=>`<article class="cab-card"><small>${escape(change.actorName||'Участник')} · ${escape(new Date(change.at).toLocaleString('ru-RU',{timeZone:'Europe/Minsk',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</small><h3>${escape(change.personName||'Участник')} · ${escape(dateLabel(change.date))}</h3><p>${escape(change.before?.code||'Нет отметки')} → ${escape(change.after?.code||'Нет отметки')}</p><div class="cab-card-actions">${action('Отменить эту правку','undo',icons.back,'',`data-index="${index}"`)}</div></article>`).join('')}</div>`:empty('Правок пока нет','Здесь будут видны авторы и время изменений табеля.',icons.clock));
    picker.body.onclick=async e=>{const button=e.target.closest('[data-cab-action=undo]');if(!button)return;const change=changes[+button.dataset.index];button.disabled=true;try{await api('/attendance/undo',{method:'POST',body:{changeId:change.id}});toast('Правка отменена');picker.close();draw();}catch(error){toast(error.status===409?'Запись уже изменена. Обновите историю.':error.message);button.disabled=false;}};
  }

  async function gradesPage(){
    const group=await groupData(),context=controls(group,{person:true}),data=await api('/grades?'+personalQuery().replace(/^&/,'')),entries=list(data).sort((a,b)=>b.date.localeCompare(a.date));view.grades=data;
    const subjectMap=new Map(list(group,'subjects').map(s=>[s.id,s.name])),averages=list(data,'averages'),count=entries.length,average=count?entries.reduce((sum,e)=>sum+Number(e.value),0)/count:0;
    return context+`<div class="cab-summary"><div class="cab-stat"><strong>${count?number(average):'—'}</strong><span>средний по всем отметкам</span></div><div class="cab-stat"><strong>${count}</strong><span>внесено оценок</span></div><div class="cab-stat"><strong>${averages.length}</strong><span>${plural(averages.length,'предмет с оценками','предмета с оценками','предметов с оценками')}</span></div></div><div class="cab-toolbar">${action('Добавить оценку','grade-add',icons.plus,'primary')}</div>${averages.length?section('По предметам')+`<div class="cab-list">${averages.map(item=>`<div class="cab-card cab-card-top"><div><h4>${escape(subjectMap.get(item.subjectId)||item.subject||item.subjectId)}</h4><small>${item.count} ${plural(item.count,'оценка','оценки','оценок')}</small></div>${badge(number(item.average))}</div>`).join('')}</div>`:''}${section('Мои отметки')}${entries.length?`<div class="cab-list">${entries.map((item,index)=>`<article class="cab-card"><div class="cab-card-top"><div><small>${escape(dateLabel(item.date))}</small><h3>${escape(subjectMap.get(item.subjectId)||item.subject||item.subjectId)}</h3></div><span class="cab-avatar" style="width:43px;height:43px;font-size:21px;border-radius:15px">${item.value}</span></div>${item.comment?`<p>${escape(item.comment)}</p>`:''}<div class="cab-card-actions">${action('Изменить','grade-edit',icons.note,'',`data-id="${escape(item.id)}"`)}${action('Удалить','grade-delete','','subtle',`data-id="${escape(item.id)}"`)}</div></article>`).join('')}</div>`:empty('Первую оценку можно добавить сейчас','Это личный учёт. Вносить оценку к каждому взятому вопросу необязательно.',icons.grades)}${note('Средний балл считается по внесённым числовым оценкам. Пропуски и пустые клетки не считаются нулями. Личные оценки не изменяют проверенные данные журнала для жеребьёвки.')}`;
  }
  async function editGrade(id=''){
    const group=await groupData(),subjects=list(group,'subjects'),entry=list(view.grades).find(e=>String(e.id)===String(id)),subjectId=entry?.subjectId||subjects[0]?.id||'';
    const picker=makeSheet(entry?'Изменить оценку':'Новая оценка',`<form class="cab-form">${pickerField('subjectId','Учебная дисциплина',subjectId,subjects.find(s=>s.id===subjectId)?.name)}<div class="cab-form-grid">${pickerField('date','Дата',entry?.date||today(),dateLabel(entry?.date||today()))}${pickerField('value','Оценка',String(entry?.value||''),entry?.value||'Выбрать')}</div>${textField('comment','Комментарий',entry?.comment||'','За что получена оценка — необязательно')}<p class="cab-inline-error" role="alert"></p><button type="submit" class="cab-action primary">Сохранить оценку</button></form>`);
    const form=submitForm(picker,async form=>{if(!form.elements.value.value)throw apiError('Выберите оценку от 1 до 10.');await api('/grades',{method:'POST',body:{...(entry?{id:entry.id}:{}),personId:personId(),subjectId:form.elements.subjectId.value,date:form.elements.date.value,value:Number(form.elements.value.value),comment:form.elements.comment.value}});toast('Оценка сохранена');});
    attachChoice(form,'subjectId','Учебная дисциплина',subjects.map(s=>({value:s.id,label:s.name})));attachChoice(form,'value','Оценка',Array.from({length:10},(_,i)=>({value:String(i+1),label:String(i+1)})));attachDate(form,'date');
  }

  async function notesPage(){
    const group=await groupData(),context=controls(group,{person:true}),data=await api('/notes?'+personalQuery().replace(/^&/,'')),items=list(data).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));view.notes=data;
    const subjectMap=new Map(list(group,'subjects').map(s=>[s.id,s.name]));
    return context+`<div class="cab-toolbar">${action('Новая заметка','note-add',icons.plus,'primary')}</div>`+(items.length?`<div class="cab-list">${items.map(item=>`<article class="cab-card"><div class="cab-card-top"><small>${item.scope==='day'?escape(dateLabel(item.date,{weekday:'short',day:'numeric',month:'long'})):escape(subjectMap.get(item.subjectId)||item.subject||'Учебная дисциплина')}</small>${badge(item.scope==='day'?'К дню':'К предмету','muted')}</div><p>${escape(item.text)}</p><div class="cab-card-actions">${action('Изменить','note-edit',icons.note,'',`data-id="${escape(item.id)}"`)}${action('Удалить','note-delete','','subtle',`data-id="${escape(item.id)}"`)}</div></article>`).join('')}</div>`:empty('Место для важных мелочей','Добавьте заметку к предмету или дню: что повторить, что принести и о чём спросить.',icons.note))+note('Заметки сохраняются за вашим аккаунтом и доступны на других устройствах после входа. Владелец системы имеет доступ к записям кабинетов.');
  }
  async function editNote(id='',preset={}){
    if(!me){open('login');return;}
    if(noteEditorPending)return;
    const caller=document.activeElement,session=token;
    noteEditorPending=true;
    try{await openNoteEditor(id,preset,caller,session);}
    finally{noteEditorPending=false;}
  }
  async function openNoteEditor(id,preset,caller,session){
    const group=await groupData(),subjects=list(group,'subjects'),entry=list(view.notes).find(e=>String(e.id)===String(id)),initial={scope:'subject',subjectId:subjects[0]?.id||'',date:schedule().getDate?.()||today(),text:'',...preset,...entry};
    if(!caller?.isConnected||session!==token||document.querySelector('.cab-note-editor[open]'))return;
    const source=caller.closest('dialog');
    if(source&&(!source.open||source.hasAttribute('data-sheet-closing')))return;
    const picker=makeSheet(entry?'Изменить заметку':'Новая заметка',`<form class="cab-form">${pickerField('scope','К чему относится заметка',initial.scope,initial.scope==='day'?'К учебному дню':'К предмету')}<div data-note-subject ${initial.scope==='day'?'hidden':''}>${pickerField('subjectId','Учебная дисциплина',initial.subjectId,subjects.find(s=>s.id===initial.subjectId)?.name)}</div><div data-note-date ${initial.scope!=='day'?'hidden':''}>${pickerField('date','Учебный день',initial.date,dateLabel(initial.date))}</div>${textField('text','Заметка',initial.text,'Запишите то, что важно не забыть')}<p class="cab-inline-error" role="alert"></p><button type="submit" class="cab-action primary">Сохранить заметку</button></form>`);
    picker.dialog.classList.add('cab-note-editor');
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
    return context+`<form class="cab-form" id="cabPreferences">${note('Напоминания приходят в личный чат <a href="https://t.me/Qdr0pbot" target="_blank" rel="noopener noreferrer">Qdropbot ↗</a>. Режимы можно включать независимо друг от друга.')}${toggle('questionReminder','О взятом вопросе','Перед занятием, к которому вы выбрали вопрос')}${pickerField('questionBeforeMinutes','За сколько напомнить',String(p.questionBeforeMinutes),p.questionBeforeMinutes>=60?'За '+number(p.questionBeforeMinutes/60)+' ч':'За '+p.questionBeforeMinutes+' мин')}${toggle('examReminder','О зачёте или экзамене','Только по подтверждённым датам вашей группы')}${pickerField('examDaysBefore','За сколько дней',String(p.examDaysBefore),'За '+p.examDaysBefore+' дн.')}${toggle('absenceReminder','О количестве пропусков','При достижении контрольных уровней неуважительных часов')}<div class="cab-card"><h4>Контрольный порог — ${number(p.absenceThreshold)} ч</h4><p class="cab-note" style="margin:0">Предупреждения: ${(p.absenceSteps||defaultPreferences.absenceSteps).map(number).join(', ')} учебных часов. Повторные сообщения по одному уровню не отправляются.</p></div><div class="cab-form-grid">${field('quietStart','Тихие часы с',p.quietStart,'22:00',{required:true,maxLength:5})}${field('quietEnd','До',p.quietEnd,'08:00',{required:true,maxLength:5})}</div>${note('Время — Минск. Счётчик основан на подтверждённых отметках табеля и служит предупреждением, а не решением об отчислении.')}<p class="cab-inline-error" role="alert"></p><button type="submit" class="cab-action primary">Сохранить настройки</button></form>`;
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
      if(command==='attendance-edit'){await editAttendance();return;}
      if(command==='attendance-cell'){await editAttendance({person:button.dataset.person,lesson:button.dataset.lesson||'',date:button.dataset.date});return;}
      if(command==='audit'){await openAudit();return;}
      if(command==='grade-add'||command==='grade-edit'){await editGrade(button.dataset.id);return;}
      if(command==='grade-delete'){confirmAction('Удалить оценку?','Эта запись исчезнет из личного списка и расчёта среднего балла.',()=>api('/grades?id='+encodeURIComponent(button.dataset.id),{method:'DELETE'}));return;}
      if(command==='note-add'||command==='note-edit'){await editNote(button.dataset.id);return;}
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
      const button=document.createElement('button');button.type='button';button.className='cab-study-note';button.innerHTML=icons.note+'Моя заметка к предмету';button.onclick=()=>editNote('',{scope:'subject',subjectId:match.subject.id});container.append(button);
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

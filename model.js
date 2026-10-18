/* Appendix 12, user-provided scans, pages 228–239. Printed g/dm3 values.
   Only correction: p230 values for 11.1/11.2 reversed in print; restored ascending order and disclosed.
   Zero is a physical boundary. No interpolation between 0 and first photographed row (0.4%). */
const BOOK = (()=>{
 const pages=[
 [228,.4,`3.99 5.00 6.00 7.00 8.00 9.00 10.00 11.00 12.03 13.04 14.05 15.06 16.07 17.08 18.09 19.10 20.12 21.13 22.14 23.16 24.18 25.19 26.21 27.23 28.25 29.27 30.28 31.32 32.34 33.36 34.39 35.41 36.44 37.69 38.49 39.52 40.55 41.58 42.61 43.64 44.68 45.71`],
 [229,4.6,`46.74 47.78 48.81 49.85 50.89 51.93 52.96 54.00 55.05 56.09 57.18 58.17 59.22 60.26 61.31 62.35 63.40 64.45 65.50 66.55 67.60 68.65 69.70 70.75 71.80 72.86 73.92 74.97 76.03 77.09 78.15 79.21 80.27 81.33 82.39 83.45 84.52 85.58 86.65 87.71 88.78 89.85`],
 [230,8.8,`90.92 91.99 93.06 94.13 95.20 96.27 97.35 98.32 99.50 100.57 101.65 102.73 103.81 104.89 105.97 107.05 108.12 109.22 110.30 111.39 112.47 113.56 114.65 115.74 116.83 117.92 119.01 120.10 121.20 122.29 123.38 124.48 125.58 126.67 127.77 128.87 129.96 131.06 132.17 133.27 134.37 135.48`],
 [231,13,`136.58 137.69 138.79 139.91 141.02 142.13 143.24 144.35 145.46 146.57 147.69 148.80 149.92 151.03 152.07 153.27 154.39 155.51 156.63 157.75 158.87 159.99 161.12 162.25 163.38 164.49 165.63 166.76 167.89 169.02 170.16 171.29 172.42 173.56 174.69 175.83 176.96 178.10 179.24 180.38 181.52 182.67`],
 [232,17.2,`183.81 184.95 186.10 187.24 188.39 189.54 190.69 191.84 192.99 194.13 195.29 196.44 197.59 198.75 199.90 201.06 202.22 203.38 204.55 205.70 206.86 208.02 209.19 210.35 211.52 212.68 213.85 215.02 216.19 217.36 218.53 219.70 220.87 222.05 223.23 224.30 225.58 226.76 227.94 229.12 230.29 231.48`],
 [233,21.4,`232.66 233.85 235.06 236.22 237.40 238.59 239.78 240.97 242.16 243.35 244.54 245.75 246.93 248.12 249.31 250.52 251.72 252.92 254.12 255.32 256.52 257.72 258.93 260.13 261.34 262.54 263.75 264.96 266.17 267.38 268.59 269.81 271.02 272.24 273.45 274.67 275.89 277.11 278.33 279.55 280.77 281.99`],
 [234,25.6,`283.22 284.44 285.67 286.89 288.13 289.35 290.58 291.82 293.05 294.28 295.52 296.75 297.98 299.23 300.46 301.70 302.97 304.18 305.43 306.67 307.92 309.16 310.41 311.65 312.90 314.15 315.40 316.65 317.91 319.16 320.42 321.67 322.93 324.18 325.45 326.71 327.97 329.23 330.49 331.76 333.02 334.29`],
 [235,29.8,`335.55 336.83 338.09 339.36 340.64 341.91 343.18 344.46 345.74 347.01 348.29 349.57 350.85 352.16 353.41 354.69 355.98 357.26 358.52 359.84 361.13 362.42 363.71 365.00 366.29 367.59 368.88 370.18 371.48 372.78 374.08 375.38 376.68 377.98 379.28 380.59 381.89 383.20 384.51 385.82 387.13 388.44`],
 [236,34,`389.76 391.07 392.38 393.70 395.02 396.34 397.66 398.98 400.30 401.62 402.95 404.27 405.59 406.92 408.25 409.57 410.91 412.24 413.57 414.90 416.25 417.58 418.92 420.26 421.59 422.93 424.28 425.62 426.97 428.31 429.66 431.00 432.35 433.70 435.05 436.41 437.76 439.11 440.47 441.82 443.18 444.54`],
 [237,38.2,`445.90 447.26 448.63 449.99 451.35 452.72 454.08 455.45 456.82 458.19 459.56 460.93 462.31 463.69 465.06 466.43 467.71 469.19 470.57 471.96 473.34 474.72 476.11 477.50 478.88 480.27 481.66 483.06 484.45 485.84 487.24 488.63 490.03 491.43 492.83 494.23 495.63 497.04 498.44 499.85 501.25 502.66`],
 [238,42.4,`504.07 505.49 506.89 508.31 509.72 511.14 512.55 513.97 515.39 516.81 518.23 519.65 521.08 522.50 523.93 525.36 526.78 528.21 529.64 531.08 532.51 533.95 535.38 536.82 538.26 539.70 541.04 542.58 544.02 545.47 546.91 548.36 549.81 551.26 552.71 554.16 555.62 557.07 558.53 559.98 561.44 562.90`],
 [239,46.6,`564.36 565.83 567.29 568.75 570.26 571.68 573.15 574.62 576.09 577.56 579.04 580.51 581.99 583.47 584.94 586.42 587.90 589.39 590.87 592.35 593.84 595.33 596.82 598.31 599.80 601.20 602.78 604.28 605.77 607.27 608.77 610.27 611.77 613.27 614.78 616.28 617.79 619.30 620.81 622.32 623.83 625.34`]
 ];
 const rows=pages.flatMap(([page,start,values])=>{const a=values.split(/\s+/).map(Number);if(a.length!==42)throw Error('Таблица: неверное число строк на странице '+page);return a.map((c,i)=>({w:Math.round((start+i/10)*10)/10,c,page}))});
 for(let i=1;i<rows.length;i++)if(rows[i].c<=rows[i-1].c)throw Error('Нарушен порядок таблицы');
 function convert(value,input,output){if(!Number.isFinite(value))return NaN;if(value===0)return 0;if(value<rows[0][input]||value>rows.at(-1)[input])return NaN;let i=rows.findIndex(r=>r[input]>=value);let hi=rows[i];if(hi[input]===value)return hi[output];let lo=rows[i-1];return lo[output]+(value-lo[input])/(hi[input]-lo[input])*(hi[output]-lo[output]);}
 return {rows,toPercent:c=>convert(c,'c','w'),toConcentration:w=>convert(w,'w','c'),minC:rows[0].c,maxC:rows.at(-1).c,maxW:50.7};
})();

/* Beverage Studio 8. Pure calculation functions; all quantities are per 1000 L. */
const BS = (() => {
 const number = v => v === '' || v == null || typeof v === 'boolean' ? NaN : Number(String(v).replace(',', '.'));
 const finite = v => Number.isFinite(number(v));
 const clone = o => JSON.parse(JSON.stringify(o));
 const id = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);
 const blank = () => ({id:id(),name:'Новая рецептура',labNumber:'',type:'газированный',appearance:'прозрачный',processing:'',group:'',volume:1000,density:'',syrupDensity:'',ratio:4,loss:0,inversion:100,pageCode:'',recipeStandard:'',waterStandard:'',ingredients:[],lab:{},norm:{},targets:{dry:'',acid:'',basis:'inverted'},sample:1});
 const ingredient = (name='Новое сырьё') => ({id:id(),name,std:'',cat:'прочее',unit:'кг',qty:0,solids:'',density:'',sucrose:0,active:'',acidFactor:'',benFactor:'',sorbFactor:'',carbs:'',kcal:'',kj:'',stage:'syrup'});
 const presets = [
  {...ingredient('Сахар'),cat:'сахароза',std:'ГОСТ 33222-2015',solids:99.85,sucrose:99.85,carbs:99.85,kcal:399.4,kj:1697.45},
  {...ingredient('Лимонная кислота, моногидрат'),cat:'кислота',solids:90.97,active:100,acidFactor:0.7004667,carbs:0,kcal:272.91,kj:1182.61},
  {...ingredient('Лимонная кислота, безводная'),cat:'кислота',solids:100,active:100,acidFactor:0.6404133,carbs:0,kcal:300,kj:1300},
  {...ingredient('Яблочная кислота'),cat:'кислота',solids:100,active:100,acidFactor:0.67045,carbs:0,kcal:300,kj:1300},
  {...ingredient('Натрий бензоат'),cat:'консервант',solids:99.9,active:99.9,benFactor:122.12/144.11,carbs:0,kcal:0,kj:0},
  {...ingredient('Калий сорбат'),cat:'консервант',solids:100,active:100,sorbFactor:112.13/150.22,carbs:0,kcal:0,kj:0},
  {...ingredient('Двуокись углерода'),cat:'CO2',stage:'drink',solids:0,active:100,carbs:0,kcal:0,kj:0},
  {...ingredient('Ароматизатор'),cat:'ароматизатор'},
  {...ingredient('Сок / экстракт'),cat:'сок/экстракт'},
  {...ingredient('Краситель / КПД'),cat:'КПД'},
  {...ingredient('Вода как отдельный компонент'),cat:'вода',stage:'drink',solids:0,density:1,carbs:0,kcal:0,kj:0}
 ];
 function example() {
  let s=blank();Object.assign(s,{name:'Дюшес AN1374',labNumber:'5820',density:1.0352,syrupDensity:1.18,processing:'непастеризованный с применением консерванта',group:'на ароматах',recipeStandard:'Контрольный пример из BUILD 7'});
  s.ingredients=[{...presets[0],qty:94.58},{...presets[7],name:'Ароматизатор Дюшес AN1374',std:'ТУ BY 100534628.026',qty:.33},{...presets[9],name:'КПД Раствор красителей «Дюшес»',std:'ТУ BY 100534628.022',qty:.17},{...presets[1],std:'ГОСТ 908',qty:1.83,acidFactor:.7005},{...presets[4],qty:.17},{...presets[6],std:'ГОСТ 8050',qty:4.15}].map(x=>({...clone(x),id:id()}));
  s.norm={dry:'9,8 ± 0,3',acid:'2,6 ± 0,3',co2:'0,4',benzoic:'150',appearance:'Прозрачная жидкость без осадка и взвешенных частиц.',color:'От светло-жёлтого до соломенного',taste:'Кисло-сладкий, свойственный дюшесу',note:'Учебный пример BUILD 7: кислота 1,83 кг. Нормы требуют утверждения; это не проверка соответствия ТР ТС.'};return s;
 }
 function normalize(raw) {
  if(!raw || typeof raw!=='object' || !Array.isArray(raw.ingredients)) throw Error('Файл не содержит рецептуру');
  if(raw.ingredients.length>500) throw Error('Не более 500 компонентов');
  let s={...blank(),...clone(raw)};s.lab={...(raw.lab||{})};s.norm={...(raw.norm||{})};s.targets={dry:'',acid:'',basis:'inverted',...(raw.targets||{})};
  s.ingredients=raw.ingredients.map(x=>{let a={...ingredient(),...x};if(x.cat==='бензоат натрия'){a.cat='консервант';a.benFactor=122.12/144.11;a.active=finite(x.solids)?number(x.solids):100;}if(x.sucrose==null)a.sucrose=x.cat==='сахароза'?x.solids:0;if(x.active==null&&['кислота','CO2'].includes(x.cat))a.active=100;return a});return s;
 }
 function mass(x) {let q=number(x.qty);if(!Number.isFinite(q)||q<0)return NaN;if(x.unit==='кг')return q;if(x.unit==='г')return q/1000;if(x.unit==='мг')return q/1e6;if(['л','мл','дм³'].includes(x.unit)){let d=number(x.density);return d>0?q*d/(x.unit==='мл'?1000:1):NaN}return NaN}
 function calc(s) {
  let warnings=[],errors=[];const V=number(s.volume),rho=number(s.density),srho=number(s.syrupDensity),ratio=number(s.ratio),loss=number(s.loss),inv=number(s.inversion);
  if(!(V>0))errors.push('Объём партии должен быть больше нуля.');if(s.density!==''&&s.density!=null&&!(rho>0))errors.push('Плотность напитка должна быть положительным числом.');if(s.syrupDensity!==''&&s.syrupDensity!=null&&!(srho>0))errors.push('Плотность сиропа должна быть положительным числом.');if(!(rho>0))warnings.push('Плотность напитка нужна только для массы, баланса воды и CO₂; СВ считаются по книге.');if(!(srho>0))warnings.push('Плотность сиропа нужна только для массового баланса воды; СВ считаются по книге.');if(!(ratio>=0))errors.push('Соотношение сироп : вода должно быть неотрицательным.');if(!(loss>=0&&loss<100))errors.push('Потери должны быть от 0 до менее 100 %.');if(!(inv>=0&&inv<=100))errors.push('Инверсия должна быть от 0 до 100 %.');
  let dry=0,suc=0,acid=0,ben=0,sorb=0,co2=0,syrupDry=0,carbs=0,kcal=0,kj=0,knownMass=0,syrupMass=0;
  let dryOK=true,acidOK=true,benOK=true,sorbOK=true,co2OK=true,carbsOK=true,energyOK=true;
  const rows=s.ingredients.map(x=>{
   let m=mass(x),sv=number(x.solids),su=number(x.sucrose),active=number(x.active);
   if(!Number.isFinite(m)){errors.push(`${x.name}: проверьте количество, единицу и плотность сырья.`);dryOK=acidOK=benOK=sorbOK=co2OK=carbsOK=energyOK=false;return {x,m,dry:NaN};}
   for(const [k,label] of [['solids','СВ'],['sucrose','сахароза'],['active','активное вещество'],['carbs','углеводы']])if(x[k]!==''&&x[k]!=null&&(!finite(x[k])||number(x[k])<0||number(x[k])>100))errors.push(`${x.name}: ${label} — от 0 до 100 %.`);
   for(const k of ['acidFactor','benFactor','sorbFactor','kcal','kj'])if(x[k]!==''&&x[k]!=null&&(!finite(x[k])||number(x[k])<0))errors.push(`${x.name}: недопустимое значение ${k}.`);
   if(Number.isFinite(sv)&&su>sv+1e-8)errors.push(`${x.name}: сахароза не может превышать СВ сырья.`);
   knownMass+=m;if(x.stage!=='drink')syrupMass+=m;
   const d=Number.isFinite(sv)?m*sv/100:NaN;
   if(m>0){if(Number.isFinite(d)){dry+=d;if(x.stage!=='drink')syrupDry+=d;}else{dryOK=false;warnings.push(`${x.name}: не заданы СВ; итог СВ неполный.`);}
    if(!Number.isFinite(su)){dryOK=false;warnings.push(`${x.name}: не указано содержание сахарозы.`);}else suc+=m*su/100;
    if(x.cat==='кислота'){if(number(x.acidFactor)>0&&Number.isFinite(active))acid+=m*active/100/number(x.acidFactor);else{acidOK=false;warnings.push(`${x.name}: задайте концентрацию кислоты и коэффициент.`);}}
    if(x.cat==='консервант'){if(!Number.isFinite(active)||(!finite(x.benFactor)&&!finite(x.sorbFactor))){benOK=sorbOK=false;warnings.push(`${x.name}: не задан пересчёт консерванта.`);}else{ben+=m*1000*active/100*(number(x.benFactor)||0);sorb+=m*1000*active/100*(number(x.sorbFactor)||0);}}
    if(x.cat==='CO2'){if(Number.isFinite(active))co2+=m*active/100;else{co2OK=false;warnings.push(`${x.name}: задайте долю удержанного CO₂.`);}}
    if(finite(x.carbs))carbs+=m*number(x.carbs)/100;else carbsOK=false;
    if(finite(x.kcal)&&finite(x.kj)){kcal+=m*number(x.kcal)/100;kj+=m*number(x.kj)/100;}else energyOK=false;
   }return {x,m,dry:d};
  });
  if(!carbsOK||!energyOK)warnings.push('Пищевая ценность неполная: заполните углеводы, ккал и кДж сырья по спецификациям.');
  if(s.ingredients.some(x=>x.cat==='сок/экстракт'&&number(x.qty)>0))warnings.push('Для соков и экстрактов вклад буферных веществ в кислотность уточняйте титрованием; здесь суммируются только заданные кислоты.');
  const gain=suc*.0526*inv/100,scale=V/1000,batchMass=V*rho,syrup=V/(1+ratio),factor=1/(1-loss/100);
  const water=1000*rho-knownMass,sw=1000/(1+ratio)*srho-syrupMass;
  if(water< -1e-6)errors.push('Сумма масс сырья превышает массу напитка. Проверьте состав и плотность.');if(sw< -1e-6)errors.push('Сырьё сиропа превышает расчётную массу сиропа. Проверьте плотность или соотношение.');
  const drinkC=dry, invertedC=dry+gain, syrupC=syrupDry*(1+ratio);
  for(const [label,value] of [['Напиток до инверсии',drinkC],['Напиток после инверсии',invertedC],['Купажный сироп',syrupC]]){
   if(value>BOOK.maxC+1e-9)errors.push(label+': концентрация СВ выше 625,34 г/дм³ (50,7 %). Увеличьте объём или измените состав / соотношение сиропа и воды.');
   else if(value>0&&value<BOOK.minC)warnings.push(label+': ниже первой строки таблицы (3,99 г/дм³; 0,4 %). Процент не определяется; экстраполяция отключена.');
  }
  return {errors,warnings,rows,scale,factor,batchMass,syrup,dry:dry*scale,gain:gain*scale,inverted:(dry+gain)*scale,drinkC,invertedC,syrupC,fresh:BOOK.toPercent(drinkC),invPct:BOOK.toPercent(invertedC),syrupPct:BOOK.toPercent(syrupC),acid:acidOK?acid:NaN,ben:benOK?ben:NaN,sorb:sorbOK?sorb:NaN,co2:co2OK&&rho>0?co2/(10*rho):NaN,carbs:carbsOK?carbs/10:NaN,kcal:energyOK?kcal/10:NaN,kj:energyOK?kj/10:NaN,dryOK,water:water*scale,syrupWater:sw*scale};
 }
 function solve(s) {
  let t=clone(s),dry=number(t.targets.dry),acid=number(t.targets.acid),rho=number(t.density);
  if(!finite(t.targets.dry)&&!finite(t.targets.acid))throw Error('Введите цель по СВ или кислотности.');
  if(finite(t.targets.acid)){
   if(acid<0)throw Error('Кислотность не может быть отрицательной.');
   let x=t.ingredients.find(x=>x.id===t.targets.acidId&&x.cat==='кислота');if(!x)throw Error('Выберите кислоту для подбора.');
   if(!(number(x.active)>0&&number(x.acidFactor)>0))throw Error('У кислоты нужны активность и коэффициент.');x.qty=0;let other=calc({...t,volume:1000}).acid;if(!Number.isFinite(other)||other>acid)throw Error('Другие кислоты уже превышают цель или их данные неполные.');
   x.qty=(acid-other)*number(x.acidFactor)/(number(x.active)/100);x.unit='кг';
  }
  if(finite(t.targets.dry)){
   if(!Number.isFinite(BOOK.toConcentration(dry)))throw Error('Цель СВ: 0 или от 0,4 до 50,7 % по таблице книги.');
   let x=t.ingredients.find(x=>x.id===t.targets.sugarId);if(!x)throw Error('Выберите сахаросодержащее сырьё для подбора.');
   if(!(number(x.solids)>0&&finite(x.sucrose)))throw Error('У выбранного сырья нужны СВ и сахароза.');
   x.qty=0;let c=calc({...t,volume:1000});if(!c.dryOK)throw Error('Для подбора СВ заполните СВ и сахарозу всех компонентов.');
   let after=t.targets.basis==='inverted',base=c.dry+(after?c.gain:0),wanted=BOOK.toConcentration(dry),coef=number(x.solids)/100+(after?number(x.sucrose)/100*.0526*number(t.inversion)/100:0);
   if(wanted<base)throw Error('Остальные компоненты уже превышают цель СВ.');x.qty=(wanted-base)/coef;x.unit='кг';
  }
  const c=calc(t);if(c.errors.length)throw Error(c.errors.join(' '));return t;
 }
 return {book:BOOK,number,finite,clone,id,blank,ingredient,presets,example,normalize,mass,calc,solve};
})();
if(typeof module!=='undefined')module.exports=BS;

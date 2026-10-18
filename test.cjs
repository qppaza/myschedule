const assert=require('node:assert/strict'),fs=require('node:fs');
const B=require('./model.js');let checks=0;function near(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);checks++}
for(const r of B.book.rows){near(B.book.toPercent(r.c),r.w);near(B.book.toConcentration(r.w),r.c)}
near(B.book.toPercent((103.81+104.89)/2),10.05);
for(const n of [-1,.1,51,Infinity])assert.ok(Number.isNaN(B.book.toConcentration(n)));
let s=B.blank();s.ratio=0;s.inversion=0;s.ingredients=[{...B.ingredient('Любой напиток'),qty:103.81,solids:100}];near(B.calc(s).fresh,10);near(B.calc(s).syrupPct,10);
s.volume=250;near(B.calc(s).fresh,10);near(B.calc(s).dry,25.9525);
s.density=1.2;s.syrupDensity=1.2;near(B.calc(s).fresh,10);
s=B.blank();s.ratio=4;s.inversion=0;s.ingredients=[{...B.ingredient('Экстракт'),qty:100,solids:50},{...B.ingredient('Сок'),qty:100,solids:10,stage:'drink'}];near(B.calc(s).drinkC,60);near(B.calc(s).syrupC,250);near(B.calc(s).dry,60);
s.ingredients[0].solids='';assert.equal(B.calc(s).dryOK,false);
s=B.blank();s.ratio=0;s.ingredients=[{...B.presets[0],id:'sugar',qty:100},{...B.ingredient('Несахарные СВ'),qty:10,solids:50}];s.targets={dry:10,acid:'',basis:'inverted',sugarId:'sugar'};let solved=B.solve(s);near(B.calc(solved).invPct,10);near(B.calc(solved).gain,B.mass(solved.ingredients[0])*.9985*.0526);
s.targets.basis='fresh';near(B.calc(B.solve(s)).fresh,10);
s=B.blank();s.ratio=0;s.inversion=0;s.ingredients=[{...B.ingredient(),qty:625.34,solids:100}];near(B.calc(s).syrupPct,50.7);assert.equal(B.calc(s).errors.length,0);s.ingredients[0].qty=625.35;assert.ok(B.calc(s).errors.length);s.ingredients[0].qty=1;assert.ok(Number.isNaN(B.calc(s).fresh));assert.ok(B.calc(s).warnings.some(x=>x.includes('ниже первой')));
s.ingredients[0].qty=0;near(B.calc(s).fresh,0);
s=B.blank();s.ratio=4;s.ingredients=[{...B.ingredient(),qty:130,solids:100}];assert.ok(B.calc(s).errors.some(x=>x.includes('Купажный сироп')));
const h=fs.readFileSync(require('node:path').join(__dirname,fs.existsSync(require('node:path').join(__dirname,'../release/index.html'))?'../release/index.html':'../index.html'),'utf8');for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(m[1]);
console.log(`PASS: ${checks} numerical comparisons, table boundaries, mixed ingredients, stage isolation, inversion, target solver, missing data, script syntax.`);

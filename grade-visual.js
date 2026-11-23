(() => {
  const dateFormat = new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', timeZone:'UTC' });
  const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const caption = day => dateFormat.format(new Date(day + 'T12:00:00Z')).replace(/\.$/, '');
  const mix = (from,to,amount) => from + (to-from)*amount;
  const clamp = value => Math.max(0,Math.min(1,value));
  const ease = value => 1-(1-clamp(value))**3;

  function curve(context,points,move=true) {
    if(move)context.moveTo(points[0].x,points[0].y);
    else context.lineTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],middle=(a.x+b.x)/2;
      context.bezierCurveTo(middle,a.y,middle,b.y,b.x,b.y);
    }
  }

  function rounded(context,x,y,width,height,radius) {
    const corner=Math.min(radius,width/2,height/2),right=x+width,bottom=y+height;
    context.beginPath();
    context.moveTo(x+corner,y);
    context.arcTo(right,y,right,bottom,corner);
    context.arcTo(right,bottom,x,bottom,corner);
    context.arcTo(x,bottom,x,y,corner);
    context.arcTo(x,y,right,y,corner);
    context.closePath();
  }

  function mount(root) {
    const panel=root.querySelector('[data-grade-visual]');
    const canvas=panel?.querySelector('canvas');
    if(!canvas||!window.ResizeObserver||!window.IntersectionObserver)return;
    const context=canvas.getContext('2d');
    if(!context)return;
    const samples=JSON.parse(panel.dataset.samples),series=JSON.parse(panel.dataset.series);
    const counts=series.map(item=>item[2]),[minimum,maximum]=JSON.parse(panel.dataset.range);
    const unit=panel.dataset.unit,selection=panel.dataset.selection;
    const passingMark=Number(panel.dataset.passingMark)||0;
    const isLowMark=mark=>Number(mark)>0&&Number(mark)<passingMark;
    const axis=panel.querySelector('.cab-chart-axis'),value=panel.querySelector('output');
    const key=panel.querySelector('.cab-chart-meter small'),tabs=panel.querySelectorAll('[data-graph-tab]');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const palette=['ink','muted','grid','main','tip','shade','floor','other','low'];
    let mode='timeline',selected=samples.length-1,previous=null,frame=0,visible=false;
    let width=0,height=0,colors,touch=null;
    const modeValues=()=>mode==='timeline'?samples:counts;
    const geometry=()=>({left:29,right:width-14,top:12,bottom:height-10});

    function readPalette(){
      const computed=getComputedStyle(panel);
      colors=Object.fromEntries(palette.map(name=>[name,computed.getPropertyValue('--chart-'+name).trim()]));
    }
    function dimensions(){
      const bounds=canvas.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return false;
      const scale=Math.min(window.devicePixelRatio||1,2);
      width=bounds.width;height=bounds.height;
      canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
      context.setTransform(scale,0,0,scale,0,0);
      return true;
    }
    function updateLabels(){
      const labels=mode==='timeline'?[...new Set([0,Math.floor((samples.length-1)/2),samples.length-1])].map(i=>caption(samples[i][0]))
        : [];
      axis.replaceChildren(...labels.map(label=>Object.assign(document.createElement('span'),{textContent:label})));
      for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab.dataset.graphTab===mode));
      panel.dataset.graphMode=mode;
      readSelection();
    }
    function readSelection(){
      const timeline=mode==='timeline';
      const sample=timeline?samples[selected]:series[selected];
      const amount=numberFormat.format(timeline?sample[1]:sample[2])+unit;
      const text=timeline?selection+' '+amount+' · '+caption(sample[0]):sample[1]+' · '+amount;
      value.textContent=amount;
      value.toggleAttribute('data-low-grade',timeline&&isLowMark(sample[1]));
      key.textContent=timeline?caption(sample[0]):sample[1];
      canvas.setAttribute('aria-valuemin','1');
      canvas.setAttribute('aria-valuemax',String(modeValues().length));
      canvas.setAttribute('aria-valuenow',String(selected+1));
      canvas.setAttribute('aria-valuetext',text);
      canvas.setAttribute('aria-orientation',timeline?'horizontal':'vertical');
    }
    function grid(kind,alpha){
      const {left,right,top,bottom}=geometry();
      if(kind!=='timeline')return;
      const values=Array.from({length:4},(_,i)=>Math.round(mix(minimum,maximum,i/3)));
      const max=values.at(-1),min=values[0];
      context.save();context.globalAlpha=alpha;
      context.font='10px system-ui';context.textAlign='right';context.textBaseline='middle';
      for(const n of values){
        const y=mix(bottom,top,(n-min)/(max-min));
        context.fillStyle=colors.muted;context.fillText(n,left-7,y);
        context.strokeStyle=colors.grid;context.setLineDash(n===min?[]:[3,5]);
        context.beginPath();context.moveTo(left,y);context.lineTo(right,y);context.stroke();
      }
      context.restore();
    }
    function focusPoint(x,y,bottom,low){
      context.strokeStyle=low?colors.low:colors.main;context.setLineDash([3,4]);context.globalAlpha*=.62;
      context.beginPath();context.moveTo(x,y);context.lineTo(x,bottom);context.stroke();
      context.setLineDash([]);context.globalAlpha/=.62;context.fillStyle=low?colors.low:colors.tip;
      context.shadowColor=low?colors.low:colors.main;context.shadowBlur=3;
      context.beginPath();context.arc(x,y,3.5,0,Math.PI*2);context.fill();
    }
    function drawTimeline(amount,alpha,focus){
      const {left,right,top,bottom}=geometry();
      const points=samples.map(([,mark],i)=>({
        x:samples.length===1?(left+right)/2:mix(left,right,i/(samples.length-1)),
        y:mix(bottom,mix(bottom,top,(mark-minimum)/(maximum-minimum)),amount),
      }));
      const [first,last]=[points[0],points.at(-1)];
      context.save();context.globalAlpha=alpha;
      if(points.length>1){
        const wash=context.createLinearGradient(0,top,0,bottom);
        wash.addColorStop(0,colors.shade);wash.addColorStop(1,colors.floor);
        context.beginPath();curve(context,points);context.lineTo(last.x,bottom);context.lineTo(first.x,bottom);
        context.closePath();context.fillStyle=wash;context.fill();
        const ribbon=points.map(({x,y})=>({x,y:Math.min(y+12*amount,bottom)}));
        const edge=context.createLinearGradient(left,0,right,0);
        edge.addColorStop(0,colors.main);edge.addColorStop(.56,colors.tip);edge.addColorStop(1,colors.other);
        context.beginPath();curve(context,points);curve(context,[...ribbon].reverse(),false);context.closePath();
        context.fillStyle=edge;context.globalAlpha=alpha*.10;context.fill();
        context.globalAlpha=alpha;context.strokeStyle=edge;context.lineWidth=1.75;
        context.beginPath();curve(context,points);context.stroke();
      }
      const every=Math.max(1,Math.ceil(points.length/16));
      for(let i=0;i<points.length;i++){
        const low=isLowMark(samples[i][1]);
        if(!low&&i%every!==0)continue;
        const point=points[i];
        context.fillStyle=low?colors.low:colors.main;context.beginPath();context.arc(point.x,point.y,low?2.6:1.9,0,Math.PI*2);context.fill();
      }
      if(focus!==null)focusPoint(points[focus].x,points[focus].y,bottom,isLowMark(samples[focus][1]));
      context.restore();
    }

    function distributionGeometry(){
      const top=7,step=(height-14)/series.length;
      return {top,step,left:unit?39:33,right:width-(unit?45:33)};
    }

    function drawDistribution(amount,alpha,focus){
      const {top,step,left,right}=distributionGeometry();
      const largest=Math.max(1,...counts),trackWidth=Math.max(1,right-left);
      const trackHeight=Math.min(8,step*.43);
      const fontSize=unit?11:12;
      context.save();
      context.textBaseline='middle';
      context.globalAlpha=alpha;
      series.forEach(([label,,count],index)=>{
        const middle=top+step*(index+.5),y=middle-trackHeight/2;
        const active=index===focus;
        const low=isLowMark(label);
        if(active){
          rounded(context,1,middle-step/2+1,width-2,step-2,7);
          context.fillStyle=colors.floor;
          context.fill();
        }
        rounded(context,left,y,trackWidth,trackHeight,trackHeight/2);
        context.fillStyle=colors.grid;
        context.fill();
        const fillWidth=trackWidth*(count/largest)*amount;
        if(fillWidth>.4){
          const sheen=context.createLinearGradient(left,y,left,y+trackHeight);
          sheen.addColorStop(0,low?colors.low:active?colors.tip:colors.main);
          sheen.addColorStop(.32,low?colors.low:colors.main);
          sheen.addColorStop(1,colors.shade);
          rounded(context,left,y,fillWidth,trackHeight,trackHeight/2);
          context.fillStyle=sheen;
          context.fill();
        }
        context.font=(active?'600 ':'500 ')+fontSize+'px system-ui';
        context.fillStyle=low?colors.low:active?colors.ink:colors.muted;
        context.textAlign='left';
        context.fillText(label,7,middle);
        context.textAlign='right';
        context.fillText(numberFormat.format(count)+unit,width-7,middle);
      });
      context.restore();
    }
    function paint(progress=1){
      if(!width||!height)return;
      const amount=ease(progress);
      context.clearRect(0,0,width,height);
      if(previous&&amount<1){
        grid(previous.mode,1-amount);
        (previous.mode==='timeline'?drawTimeline:drawDistribution)(1-amount*.38,1-amount,null);
      }
      grid(mode,previous?amount:1);
      (mode==='timeline'?drawTimeline:drawDistribution)(amount,previous?amount:1,selected);
    }
    function animate(){
      cancelAnimationFrame(frame);
      frame=0;
      if(motion.matches){previous=null;paint();return;}
      const begin=performance.now();
      const tick=time=>{
        const progress=clamp((time-begin)/780);
        paint(progress);
        if(progress<1&&panel.isConnected)frame=requestAnimationFrame(tick);
        else{frame=0;previous=null;}
      };
      frame=requestAnimationFrame(tick);
    }
    function select(index){
      const next=Math.max(0,Math.min(modeValues().length-1,index));
      if(next===selected)return;
      selected=next;readSelection();
      if(!frame)paint();
    }
    function atPointer(event){
      const bounds=canvas.getBoundingClientRect(),x=event.clientX-bounds.left;
      if(mode==='timeline'){
        const {left,right}=geometry();
        select(Math.round(clamp((x-left)/(right-left))*(samples.length-1)));
        return;
      }
      const {top,step}=distributionGeometry(),y=event.clientY-bounds.top;
      select(Math.floor((y-top)/step));
    }
    for(const tab of tabs)tab.onclick=()=>{
      const next=tab.dataset.graphTab;
      if(next===mode)return;
      previous={mode};mode=next;
      selected=mode==='timeline'?samples.length-1:counts.indexOf(Math.max(...counts));
      updateLabels();animate();
    };
    canvas.addEventListener('pointerdown',event=>{touch={id:event.pointerId,y:event.clientY};atPointer(event);},{passive:true});
    canvas.addEventListener('pointermove',event=>{
      if(event.pointerType==='mouse'){atPointer(event);return;}
      if(touch?.id!==event.pointerId||Math.abs(event.clientY-touch.y)>18)return;
      atPointer(event);
    },{passive:true});
    for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{touch=null;},{passive:true});
    canvas.addEventListener('keydown',event=>{
      const rowDirection=mode==='distribution'?1:-1;
      const next={ArrowLeft:selected-1,ArrowDown:selected+rowDirection,ArrowRight:selected+1,ArrowUp:selected-rowDirection,Home:0,End:modeValues().length-1}[event.key];
      if(next===undefined)return;
      event.preventDefault();select(next);
    });
    readPalette();updateLabels();
    if(dimensions())paint();
    const size=new ResizeObserver(()=>{if(dimensions()&&!frame)paint();});size.observe(canvas);
    const theme=new MutationObserver(()=>{readPalette();if(!frame)paint();});theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    const observer=new IntersectionObserver(rows=>{
      if(visible||!rows.some(row=>row.isIntersecting))return;
      visible=true;observer.disconnect();animate();
    },{threshold:.28});
    observer.observe(canvas);
    return ()=>{cancelAnimationFrame(frame);size.disconnect();theme.disconnect();observer.disconnect();};
  }
  window.AmiaGradeVisual=Object.freeze({mount});
})();

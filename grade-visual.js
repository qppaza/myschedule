(() => {
  const dateFormat = new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', timeZone:'UTC' });
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

  function mount(root) {
    const panel=root.querySelector('[data-grade-visual]');
    const canvas=panel?.querySelector('canvas');
    const context=canvas?.getContext?.('2d');
    if(!context)return;
    const samples=JSON.parse(panel.dataset.samples),counts=JSON.parse(panel.dataset.counts);
    const axis=panel.querySelector('.cab-chart-axis'),value=panel.querySelector('output');
    const key=panel.querySelector('.cab-chart-meter small'),tabs=panel.querySelectorAll('[data-graph-tab]');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const palette=['ink','muted','grid','main','tip','shade','floor','other'];
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
        : counts.map((_,i)=>String(i+1));
      axis.replaceChildren(...labels.map(label=>Object.assign(document.createElement('span'),{textContent:label})));
      for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab.dataset.graphTab===mode));
      panel.dataset.graphMode=mode;
      readSelection();
    }
    function readSelection(){
      const timeline=mode==='timeline',sample=samples[selected];
      const text=timeline?'Отметка '+sample[1]+' · '+caption(sample[0]):'Отметка '+(selected+1)+' · количество '+counts[selected];
      value.textContent=timeline?sample[1]:counts[selected];
      key.textContent=timeline?caption(sample[0]):'Отметка '+(selected+1);
      canvas.setAttribute('aria-valuemin','1');
      canvas.setAttribute('aria-valuemax',String(modeValues().length));
      canvas.setAttribute('aria-valuenow',String(selected+1));
      canvas.setAttribute('aria-valuetext',text);
    }
    function grid(kind,alpha){
      const {left,right,top,bottom}=geometry();
      const values=kind==='timeline'?[1,4,7,10]:[0,...new Set([Math.max(1,...counts)])];
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
    function focusPoint(x,y,bottom){
      context.strokeStyle=colors.main;context.setLineDash([3,4]);context.globalAlpha*=.62;
      context.beginPath();context.moveTo(x,y);context.lineTo(x,bottom);context.stroke();
      context.setLineDash([]);context.globalAlpha/=.62;context.fillStyle=colors.tip;
      context.shadowColor=colors.main;context.shadowBlur=12;
      context.beginPath();context.arc(x,y,4,0,Math.PI*2);context.fill();
    }
    function drawTimeline(amount,alpha,focus){
      const {left,right,top,bottom}=geometry();
      const points=samples.map(([,mark],i)=>({
        x:samples.length===1?(left+right)/2:mix(left,right,i/(samples.length-1)),
        y:mix(bottom,mix(bottom,top,(mark-1)/9),amount),
      }));
      const [first,last]=[points[0],points.at(-1)];
      context.save();context.globalAlpha=alpha;
      if(points.length>1){
        const wash=context.createLinearGradient(0,top,0,bottom);
        wash.addColorStop(0,colors.shade);wash.addColorStop(1,colors.floor);
        context.beginPath();curve(context,points);context.lineTo(last.x,bottom);context.lineTo(first.x,bottom);
        context.closePath();context.fillStyle=wash;context.fill();
        const ribbon=points.map(({x,y},i)=>({x,y:mix(y,bottom,(.25+.14*Math.sin(i*.72))*amount)}));
        const edge=context.createLinearGradient(left,0,right,0);
        edge.addColorStop(0,colors.main);edge.addColorStop(.56,colors.tip);edge.addColorStop(1,colors.other);
        context.beginPath();curve(context,points);curve(context,[...ribbon].reverse(),false);context.closePath();
        context.fillStyle=edge;context.globalAlpha=alpha*.17;context.fill();
        context.globalAlpha=alpha;context.strokeStyle=edge;context.lineWidth=2.35;
        context.shadowColor=colors.main;context.shadowBlur=9;
        context.beginPath();curve(context,points);context.stroke();context.shadowBlur=0;
      }
      const every=Math.max(1,Math.ceil(points.length/16));
      for(let i=0;i<points.length;i+=every){
        const point=points[i];
        context.fillStyle=colors.main;context.beginPath();context.arc(point.x,point.y,1.9,0,Math.PI*2);context.fill();
      }
      if(focus!==null)focusPoint(points[focus].x,points[focus].y,bottom);
      context.restore();
    }
    function drawDistribution(amount,alpha,focus){
      const {left,right,top,bottom}=geometry();
      const max=Math.max(1,...counts),step=(right-left)/counts.length,bar=Math.min(24,step*.63);
      context.save();
      for(let i=0;i<counts.length;i++){
        const count=counts[i],x=left+step*(i+.5),growth=ease((amount-i*.032)/.72);
        const size=Math.max(3,(bottom-top)*.94*(count/max)*growth),y=bottom-size;
        const gradient=context.createLinearGradient(x-bar/2,y,x+bar/2,bottom);
        gradient.addColorStop(0,i===focus?colors.tip:colors.main);
        gradient.addColorStop(.27,i===focus?colors.main:colors.shade);
        gradient.addColorStop(1,colors.floor);
        context.globalAlpha=alpha*(count?1:.32);
        context.fillStyle=gradient;context.strokeStyle=i===focus?colors.tip:colors.main;context.lineWidth=i===focus?1.35:.7;
        context.beginPath();context.roundRect(x-bar/2,y,bar,size,Math.min(6,size/2));
        context.fill();context.stroke();
      }
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
      const {left,right}=geometry(),x=event.clientX-canvas.getBoundingClientRect().left;
      const fraction=clamp((x-left)/(right-left));
      select(mode==='timeline'?Math.round(fraction*(samples.length-1)):Math.floor(fraction*counts.length));
    }
    for(const tab of tabs)tab.onclick=()=>{
      const next=tab.dataset.graphTab;
      if(next===mode)return;
      previous={mode};mode=next;
      selected=mode==='timeline'?samples.length-1:counts.indexOf(Math.max(...counts));
      updateLabels();animate();
    };
    canvas.addEventListener('pointerdown',event=>{touch={id:event.pointerId,x:event.clientX,y:event.clientY};atPointer(event);},{passive:true});
    canvas.addEventListener('pointermove',event=>{
      if(event.pointerType==='mouse'){atPointer(event);return;}
      if(touch?.id!==event.pointerId||Math.abs(event.clientY-touch.y)>18)return;
      atPointer(event);
    },{passive:true});
    for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{touch=null;},{passive:true});
    canvas.addEventListener('keydown',event=>{
      const next={ArrowLeft:selected-1,ArrowRight:selected+1,Home:0,End:modeValues().length-1}[event.key];
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

/* A moving specular highlight on the surface being pressed. */
(() => {
  'use strict';
  const reduced = window.matchMedia?.('(prefers-reduced-transparency: reduce), (forced-colors: active)') || { matches: false };
  // One reflection follows contact across actionable glass surfaces. Scroll
  // gestures release it immediately, so list items never need their own layers.
  const surfaces = '.lesson,.study-library-entry,.cabinet-entry,.study-topic-row,.study-subject-row,.study-questions li,.cab-card,.cab-tile,.cab-pick-option,.study-drive-link,.study-eumk-link,.study-round,.cab-picker-trigger,.install-action,.group.glass';
  const lowMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reflection;
  function releaseLight(immediate = false) {
    if (!reflection) return;
    const { host, spot, positioned, animation, frame } = reflection;
    reflection = null;
    if (frame) cancelAnimationFrame(frame);
    animation?.cancel();
    function clean() {
      spot.remove();
      if (positioned && !host.querySelector(':scope > .glass-contact')) host.classList.remove('glass-contact-host');
    }
    if (immediate || !spot.animate) return clean();
    const exit = spot.animate([{opacity: 1},{opacity: 0}], {duration: 190, fill: 'both'});
    exit.finished.then(clean, clean);
  }
  document.addEventListener('pointerdown', event => {
    releaseLight(true);
    if (event.button !== 0 || reduced.matches || lowMotion?.matches || event.isPrimary === false) return;
    const host = event.target.closest?.(surfaces);
    if (!host || event.target.closest('[data-sheet-grab],.glass-segmented,.segmented,.days,.date-grid')) return;
    const box = host.getBoundingClientRect();
    const positioned = getComputedStyle(host).position === 'static' || host.classList.contains('glass-contact-host');
    if (positioned) host.classList.add('glass-contact-host');
    const spot = document.createElement('span');
    spot.className = 'glass-contact';
    spot.setAttribute('aria-hidden','true');
    const paint = (x,y) => {
      spot.style.setProperty('--beam-x', (x-box.left)+'px');
      spot.style.setProperty('--beam-y', (y-box.top)+'px');
    };
    paint(event.clientX,event.clientY);
    host.append(spot);
    const animation = spot.animate?.([{opacity:0},{opacity:1}], {duration:135});
    reflection = { host, spot, positioned, animation, paint, id:event.pointerId, x:event.clientX, y:event.clientY, frame:0 };
  }, {passive:true});
  window.addEventListener('pointermove', event => {
    const light=reflection;
    if (!light || light.id!==event.pointerId) return;
    if(event.pointerType==='touch' && Math.abs(event.clientY-light.y)>10) return releaseLight(true);
    light.pointerX=event.clientX;light.pointerY=event.clientY;
    if(!light.frame)light.frame=requestAnimationFrame(()=>{
      light.frame=0;
      if(reflection===light)light.paint(light.pointerX,light.pointerY);
    });
  }, {passive:true});
  for(const name of ['pointerup','pointercancel']) window.addEventListener(name, event=>{
    if(reflection?.id===event.pointerId)releaseLight(name==='pointercancel');
  }, {passive:true});
  window.addEventListener('blur',()=>releaseLight(true));
  reduced.addEventListener?.('change', () => { if (reduced.matches) releaseLight(true); });
})();

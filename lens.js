/* Refraction profile adapted from liquid-glass-js, container.js.
   Copyright 2025 Armagan Amcalar. See LICENSE-liquid-glass.txt. */
(() => {
  'use strict';

  const SVG = 'http://www.w3.org/2000/svg';
  const FILTER_ID = 'amia-live-lens';
  const THUMB = '#segThumb,.glass-choice-thumb,.day-thumb,.date-thumb';
  const reduced = window.matchMedia?.('(prefers-reduced-transparency: reduce), (forced-colors: active)') || { matches: false };
  const chromium = navigator.userAgentData?.brands?.some(v => v.brand === 'Chromium') ??
    (/Chrome\//.test(navigator.userAgent) && !/iPhone|iPad|Firefox/.test(navigator.userAgent));
  const nativeBackdrop = chromium && window.CSS?.supports('backdrop-filter', 'url("#amia-live-lens")');
  let current = null, scratch = null, defs = null;

  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  function canvas(w, h) {
    const node = document.createElement('canvas');
    node.width = Math.ceil(w);
    node.height = Math.ceil(h);
    return node;
  }

  // The signed distance and the exponential edge and rim falloff are the
  // corresponding parts of the shader in the supplied archive.
  function distance(x, y, w, h, radius) {
    const cx = Math.abs(x - w / 2) - (w / 2 - radius);
    const cy = Math.abs(y - h / 2) - (h / 2 - radius);
    return Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) + Math.min(Math.max(cx, cy), 0) - radius;
  }

  const mapCache = new Map();
  function makeMap(w, h, radius) {
    const key = [w, h, radius].join(':');
    if (mapCache.has(key)) return mapCache.get(key);
    scratch ||= canvas(w, h);
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(w, h);
    const maxShift = Math.min(14, h * .31);
    const scale = 2 * maxShift + 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + .5, py = y + .5;
        const depth = Math.max(0, -distance(px, py, w, h, radius));
        const dx = distance(px + .75, py, w, h, radius) - distance(px - .75, py, w, h, radius);
        const dy = distance(px, py + .75, w, h, radius) - distance(px, py - .75, w, h, radius);
        const normal = Math.hypot(dx, dy) || 1;
        const edge = Math.exp(-depth * .14);
        const rim = Math.exp(-depth * .51);
        const refraction = maxShift * (.77 * edge + .23 * rim) / (normal * scale);
        const i = 4 * (y * w + x);
        image.data[i] = 255 * (.5 - dx * refraction);
        image.data[i + 1] = 255 * (.5 - dy * refraction);
        image.data[i + 2] = 128;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const result = { url: scratch.toDataURL('image/png'), scale };
    if (mapCache.size >= 16) mapCache.delete(mapCache.keys().next().value);
    mapCache.set(key, result);
    return result;
  }

  function attachFilter(w, h, map) {
    if (!defs) {
      defs = svg('svg', { 'aria-hidden': 'true', focusable: 'false', width: 0, height: 0, class: 'rail-optics-defs' });
      document.body.append(defs);
    }
    const filter = svg('filter', {
      id: FILTER_ID, x: 0, y: 0, width: w, height: h,
      filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB'
    });
    const texture = svg('feImage', { href: map.url, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'field' });
    filter.append(texture, svg('feDisplacementMap', {
      in: 'SourceGraphic', in2: 'field', scale: map.scale, xChannelSelector: 'R', yChannelSelector: 'G'
    }));
    defs.replaceChildren(filter);
  }

  // Browser engines without SVG backdrop filters use a one-time, local
  // bitmap of the real rail contents. No page clone or network assets.
  function captureRail(rail, g) {
    if (g.width < 1 || g.height < 1 || g.width > 1200 || g.height > 580) return null;
    const resolution = Math.min(1.5, Math.sqrt(215000 / (g.width * g.height)));
    const bitmap = canvas(g.width * resolution, g.height * resolution);
    const ctx = bitmap.getContext('2d');
    if (!ctx) return null;
    ctx.scale(resolution, resolution);
    const x = value => (value - g.outer.left) / g.scaleX - g.left;
    const y = value => (value - g.outer.top) / g.scaleY - g.top;
    const cells = [];
    for (const button of rail.querySelectorAll(':scope > button:not(:disabled)')) {
      const bounds = button.getBoundingClientRect(), width = bounds.width / g.scaleX, height = bounds.height / g.scaleY;
      cells.push({ button, x: x(bounds.left), y: y(bounds.top), width, height, clip: button.style.clipPath });
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (!text) continue;
        const element = node.parentElement;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        ctx.fillStyle = style.color;
        ctx.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x(rect.left), y(rect.top + rect.height / 2));
      }
      const dot = button.querySelector('.dot');
      if (dot) {
        const r = dot.getBoundingClientRect();
        ctx.fillStyle = getComputedStyle(dot).backgroundColor;
        ctx.beginPath();
        ctx.ellipse(x(r.left + r.width / 2), y(r.top + r.height / 2), r.width / g.scaleX / 2, r.height / g.scaleY / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    return { url: bitmap.toDataURL('image/png'), cells };
  }

  function clearCut(cell) {
    if (cell.cut) cell.button.style.clipPath = cell.clip;
    cell.cut = false;
  }

  function cutLabels(state, left, top) {
    for (const c of state.cells) {
      const x1 = Math.max(0, left - c.x), x2 = Math.min(c.width, left + state.w - c.x);
      const y1 = Math.max(0, top - c.y), y2 = Math.min(c.height, top + state.h - c.y);
      if (x2 <= x1 || y2 <= y1) { clearCut(c); continue; }
      const l=left-c.x,t=top-c.y,r=l+state.w,b=t+state.h,k=state.radius;
      const perimeter='M0 0H'+c.width+'V'+c.height+'H0Z';
      const hole='M'+(l+k)+' '+t+'H'+(r-k)+'Q'+r+' '+t+' '+r+' '+(t+k)+
        'V'+(b-k)+'Q'+r+' '+b+' '+(r-k)+' '+b+'H'+(l+k)+'Q'+l+' '+b+' '+l+' '+(b-k)+
        'V'+(t+k)+'Q'+l+' '+t+' '+(l+k)+' '+t+'Z';
      c.button.style.clipPath='path(evenodd,"'+perimeter+hole+'")';
      c.cut = true;
    }
  }

  function end(thumb) {
    if (!current || thumb && current.thumb !== thumb) return;
    const old = current;
    current = null;
    if (old.frame) cancelAnimationFrame(old.frame);
    old.thumb.removeAttribute('data-optics');
    old.thumb.classList.remove('ready-optics');
    old.layer?.remove();
    old.cells?.forEach(clearCut);
  }

  function begin(thumb, rail, size, geometry) {
    if (reduced.matches || !thumb.matches(THUMB) || size.w <= 0 || size.h <= 0) return;
    end();
    const outset = thumb.matches('#segThumb,.glass-choice-thumb') ? 3 : 0;
    const w = Math.round(size.w + outset * 2), h = Math.round(size.h + outset * 2);
    if (w > 220 || h > 116 || w < 14 || h < 14) return;
    try {
      const radius = Math.min(w / 2, h / 2, parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 18);
      const map = makeMap(w, h, radius);
      if (!map) return;
      attachFilter(w, h, map);
      const state = { thumb, w, h, radius, outset, frame: 0, x: size.x, y: size.y };
      current = state;
      if (nativeBackdrop) {
        thumb.dataset.optics = 'native';
        return;
      }
      const capture = captureRail(rail, geometry);
      if (!capture) return end(thumb);
      const layer = svg('svg', {class:'rail-live-capture', 'aria-hidden':'true', focusable:'false', viewBox:'0 0 ' + w + ' ' + h, preserveAspectRatio:'none'});
      const shifted = svg('g', {filter:'url(#' + FILTER_ID + ')'});
      const contents = svg('image', {href:capture.url, width:geometry.width, height:geometry.height, preserveAspectRatio:'none'});
      shifted.append(contents);
      layer.append(shifted);
      thumb.append(layer);
      Object.assign(state, { layer, contents, cells: capture.cells });
      const image = new Image();
      image.onload = () => {
        if (state !== current) return;
        thumb.dataset.optics = 'capture';
        thumb.classList.add('ready-optics');
        move(thumb,state.x,state.y);
      };
      image.onerror = () => { if(state === current)end(thumb); };
      image.src = capture.url;
    } catch { end(thumb); }
  }

  function move(thumb, x, y) {
    if (current?.thumb !== thumb) return;
    const state = current;
    state.x = x;
    state.y = y;
    if (!state.contents || !thumb.classList.contains('ready-optics') || state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      if (state !== current) return;
      const left = state.x - state.outset, top = state.y - state.outset;
      state.contents.setAttribute('x', -left);
      state.contents.setAttribute('y', -top);
      cutLabels(state, left, top);
    });
  }

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
  reduced.addEventListener?.('change', () => { if (reduced.matches) end(); });
  window.AmiaRailOptics = Object.freeze({ begin, move, end, canPreviewPress: nativeBackdrop });
})();

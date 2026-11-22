/* Refraction profile adapted from liquid-glass-js, container.js.
   Copyright 2025 Armagan Amcalar. See LICENSE-liquid-glass.txt. */
(() => {
  'use strict';

  const SVG = 'http://www.w3.org/2000/svg';
  const FILTER_ID = 'amia-live-lens';
  const THUMB = '#segThumb,.glass-choice-thumb,.day-thumb,.date-thumb';
  const reduced = window.matchMedia?.('(prefers-reduced-transparency: reduce), (forced-colors: active)') || { matches: false };
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
    const maxShift = Math.min(9, h * .21);
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

  // The lens redraws only labels and dots, as vectors. The original glyphs
  // are clipped by the same rounded aperture before the refracted layer shows.
  function measureRail(rail, g) {
    if (g.width < 1 || g.height < 1 || g.width > 1200 || g.height > 580) return null;
    const x = value => (value - g.outer.left) / g.scaleX - g.left;
    const y = value => (value - g.outer.top) / g.scaleY - g.top;
    const contents = svg('g'), cells = [];
    for (const button of rail.querySelectorAll(':scope > button:not(:disabled)')) {
      const bounds = button.getBoundingClientRect();
      cells.push({ button, x: x(bounds.left), y: y(bounds.top), width: bounds.width / g.scaleX,
        height: bounds.height / g.scaleY, clip: button.style.clipPath });
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const value = node.textContent.trim();
        if (!value) continue;
        const style = getComputedStyle(node.parentElement);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const text = svg('text', {
          x: x(rect.left), y: y(rect.top + rect.height / 2) - parseFloat(style.fontSize) * .02,
          fill: style.color, 'text-anchor': 'start', 'dominant-baseline': 'central',
          'font-family': style.fontFamily, 'font-size': style.fontSize, 'font-weight': style.fontWeight,
          textLength: rect.width / g.scaleX, lengthAdjust: 'spacingAndGlyphs'
        });
        text.textContent = value;
        contents.append(text);
      }
      const dot = button.querySelector('.dot');
      if (dot) {
        const r = dot.getBoundingClientRect();
        if (r.width && r.height) contents.append(svg('ellipse', {
          cx: x(r.left + r.width / 2), cy: y(r.top + r.height / 2), rx: r.width / g.scaleX / 2,
          ry: r.height / g.scaleY / 2, fill: getComputedStyle(dot).backgroundColor
        }));
      }
    }
    return contents.childElementCount ? { contents, cells } : null;
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
      const corner='A'+k+' '+k+' 0 0 1 ';
      const hole='M'+(l+k)+' '+t+'H'+(r-k)+corner+r+' '+(t+k)+
        'V'+(b-k)+corner+(r-k)+' '+b+'H'+(l+k)+corner+l+' '+(b-k)+
        'V'+(t+k)+corner+(l+k)+' '+t+'Z';
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
    old.layer?.remove();
    old.cells?.forEach(clearCut);
  }

  function begin(thumb, rail, size, geometry) {
    if (reduced.matches || !thumb.matches(THUMB) || size.w <= 0 || size.h <= 0 ||
      !window.CSS?.supports('clip-path', 'path(evenodd,"M0 0H1V1Z")')) return;
    end();
    const outset = thumb.matches('#segThumb,.glass-choice-thumb') ? 3 : 0;
    const w = size.w + outset * 2, h = size.h + outset * 2;
    if (w > 220 || h > 116 || w < 14 || h < 14) return;
    try {
      const radius = Math.min(w / 2, h / 2, parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 18);
      const map = makeMap(Math.round(w), Math.round(h), radius);
      if (!map) return;
      attachFilter(w, h, map);
      const state = { thumb, w, h, radius, outset, frame: 0, x: size.x, y: size.y };
      current = state;
      const labels = measureRail(rail, geometry);
      if (!labels) return end(thumb);
      const layer = svg('svg', {class:'rail-live-capture', 'aria-hidden':'true', focusable:'false', viewBox:'0 0 ' + w + ' ' + h, preserveAspectRatio:'none'});
      const shifted = svg('g', {filter:'url(#' + FILTER_ID + ')'});
      shifted.append(labels.contents);
      layer.append(shifted);
      thumb.append(layer);
      Object.assign(state, { layer, ...labels });
      layer.style.borderRadius=radius+'px';
      paintLens(state);
      thumb.dataset.optics = 'vector';
    } catch { end(thumb); }
  }

  function paintLens(state) {
    const left = state.x - state.outset, top = state.y - state.outset;
    state.contents.setAttribute('transform', 'translate(' + -left + ' ' + -top + ')');
    cutLabels(state, left, top);
  }

  function move(thumb, x, y) {
    if (current?.thumb !== thumb) return;
    const state = current;
    state.x = x;
    state.y = y;
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      if (state === current) paintLens(state);
    });
  }

  // One reflection follows contact across actionable glass surfaces. Scroll
  // gestures release it immediately, so list items never need their own layers.
  const surfaces = 'button:not(:disabled),a[href],[role=button]:not([aria-disabled=true])';
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
    if (immediate || lowMotion?.matches || !spot.animate) return clean();
    const exit = spot.animate([{opacity: 1},{opacity: 0}], {duration: 190, fill: 'both'});
    exit.finished.then(clean, clean);
  }
  document.addEventListener('pointerdown', event => {
    releaseLight(true);
    if (event.button !== 0 || event.isPrimary === false) return;
    const host = event.target.closest?.(surfaces);
    if (!host || event.target.closest('[data-sheet-grab],[aria-disabled=true]')) return;
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
    const animation = lowMotion?.matches ? null : spot.animate?.([{opacity:0},{opacity:1}], {duration:115});
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
  window.AmiaRailOptics = Object.freeze({ begin, move, end });
})();

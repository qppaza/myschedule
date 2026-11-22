/* Rounded refraction profile adapted from liquid-glass-js.
   Copyright 2025 Armagan Amcalar. See LICENSE-liquid-glass.txt. */
(() => {
  'use strict';
  const reduced = window.matchMedia?.('(prefers-reduced-transparency: reduce), (forced-colors: active)') || { matches: false };
  const SVG = 'http://www.w3.org/2000/svg';
  const lowMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let filterSerial = 0;
  let activeLens;
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
    const raster = canvas(w, h);
    const ctx = raster.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(w, h);
    const maxShift = Math.min(5, h * .12);
    const scale = 2 * maxShift + 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + .5, py = y + .5;
        const depth = Math.max(0, -distance(px, py, w, h, radius));
        const dx = distance(px + .75, py, w, h, radius) - distance(px - .75, py, w, h, radius);
        const dy = distance(px, py + .75, w, h, radius) - distance(px, py - .75, w, h, radius);
        const normal = Math.hypot(dx, dy) || 1;
        // Taper to zero at the glass boundary so a stroke can travel
        // through the rim without splitting or doubling.
        const t = Math.min(1, depth / 8);
        const taper = t * t * (3 - 2 * t);
        const falloff = .82 * Math.exp(-depth * .064) + .18 * Math.exp(-depth * .29);
        const refraction = maxShift * taper * falloff / (normal * scale);
        const i = 4 * (y * w + x);
        image.data[i] = 255 * (.5 - dx * refraction);
        image.data[i + 1] = 255 * (.5 - dy * refraction);
        image.data[i + 2] = 128;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const result = { url: raster.toDataURL('image/png'), scale };
    if (mapCache.size >= 16) mapCache.delete(mapCache.keys().next().value);
    mapCache.set(key, result);
    return result;
  }


  // A small filter on each covered button bends its original pixels. Text is
  // never duplicated, clipped out and replaced, or sampled from the page.
  function createFilter(cell, size, map) {
    const id = 'amia-refraction-' + (++filterSerial);
    const region = { x: -4, y: -4, width: cell.w + 8, height: cell.h + 8 };
    const filter = svg('filter', {
      id, ...region, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB'
    });
    const texture = svg('feImage', {
      href: map.url, width: size.w, height: size.h, preserveAspectRatio: 'none', result: 'field'
    });
    filter.append(
      svg('feFlood', { ...region, 'flood-color': '#808080', result: 'neutral' }),
      texture,
      svg('feComposite', { ...region, in: 'field', in2: 'neutral', operator: 'over', result: 'combined' }),
      svg('feDisplacementMap', { ...region, in: 'SourceGraphic', in2: 'combined', scale: map.scale,
        xChannelSelector: 'R', yChannelSelector: 'G' })
    );
    return { filter, texture, id, prior: cell.button.style.getPropertyValue('filter'),
      priority: cell.button.style.getPropertyPriority('filter') };
  }

  function begin(thumb, size, cells, railWidth) {
    if (reduced.matches || lowMotion?.matches || !window.CSS?.supports?.('filter', 'url("#amia-refraction")')
        || size.w < 14 || size.h < 14 || size.w > 235 || size.h > 118) return;
    activeLens?.end();
    const w = Math.round(size.w), h = Math.round(size.h);
    const corner = parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 18;
    let map;
    try { map = makeMap(w, h, Math.min(corner, w / 2, h / 2)); } catch { return; }
    if (!map) return;

    const defs = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false', class: 'rail-optics-defs' });
    document.body.append(defs);
    const affected = new Map();
    let frame = 0, x = size.x, y = size.y, stopped = false;
    function release(cell, entry) {
      cell.button.style.setProperty('filter', entry.prior, entry.priority);
      entry.filter.remove();
      affected.delete(cell);
    }
    function paint() {
      frame = 0;
      if (reduced.matches || lowMotion?.matches) { end(); return; }
      for (const cell of cells) {
        const overlaps = cell.x < x + size.w && cell.x + cell.w > x &&
          cell.y < y + size.h && cell.y + cell.h > y;
        let entry = affected.get(cell);
        if (!overlaps) { if (entry) release(cell, entry); continue; }
        if (!entry) {
          entry = createFilter(cell, size, map);
          defs.append(entry.filter);
          affected.set(cell, entry);
          cell.button.style.setProperty('filter', 'url("#' + entry.id + '")');
        }
        entry.texture.setAttribute('x', (x - cell.x).toFixed(2));
        entry.texture.setAttribute('y', (y - cell.y).toFixed(2));
      }
      const progress = Math.max(0, Math.min(1, x / Math.max(1, railWidth - size.w)));
      thumb.style.setProperty('--lens-highlight-x', (13 + 54 * progress).toFixed(1) + '%');
    }
    function end() {
      if (stopped) return;
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      affected.forEach((entry, cell) => release(cell, entry));
      defs.remove();
      thumb.style.removeProperty('--lens-highlight-x');
      thumb.removeAttribute('data-liquid-drag');
      if (activeLens === lens) activeLens = null;
    }
    const lens = {
      move(left, top) {
        if (stopped) return;
        x = left;
        y = top;
        if (!frame) frame = requestAnimationFrame(paint);
      },
      end
    };
    activeLens = lens;
    thumb.setAttribute('data-liquid-drag', '');
    return lens;
  }

  window.AmiaRailOptics = Object.freeze({ begin });
  // One reflection follows contact across actionable glass surfaces. Scroll
  // gestures release it immediately, so list items never need their own layers.
  const surfaces = '.lesson,.study-library-entry,.cabinet-entry,.study-topic-row,.study-subject-row,.study-questions li,.cab-card,.cab-tile,.cab-pick-option,.study-drive-link,.study-eumk-link,.study-round,.cab-picker-trigger,.install-action,.group.glass';
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
  window.addEventListener('blur',()=>{activeLens?.end();releaseLight(true);});
  reduced.addEventListener?.('change', () => { if (reduced.matches) { activeLens?.end(); releaseLight(true); } });
})();

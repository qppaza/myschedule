(() => {
  'use strict';
  const ns = 'http://www.w3.org/2000/svg';
  const fieldWidth = 114, fieldHeight = 48, outset = 3, opticalScale = 17;
  const faces = new WeakMap();
  let definitionsReady;

  function svgNode(tag, attributes = {}) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  // The two image channels represent how far each ray bends toward the
  // centre of a convex capsule. The centre of the lens remains clear.
  function displacementImage() {
    const width = fieldWidth, height = fieldHeight, radius = height / 2;
    const map = document.createElement('canvas');
    map.width = width;
    map.height = height;
    const ctx = map.getContext('2d');
    if (!ctx) return '';
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x + .5, py = y + .5;
        const nx = px - Math.min(width - radius, Math.max(radius, px));
        const ny = py - radius;
        const distance = Math.hypot(nx, ny);
        const depth = Math.max(0, radius - distance);
        const rim = Math.max(0, 1 - depth / 12);
        const bend = distance ? -6.0 * rim * rim / (opticalScale * distance) : 0;
        const pixel = 4 * (x + y * width);
        image.data[pixel] = 255 * (.5 + nx * bend);
        image.data[pixel + 1] = 255 * (.5 + ny * bend);
        image.data[pixel + 2] = 128;
        image.data[pixel + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return map.toDataURL('image/png');
  }

  function ensureDefinitions() {
    if (definitionsReady !== undefined) return definitionsReady;
    definitionsReady = false;
    let field;
    try { field = displacementImage(); } catch { return false; }
    if (!field) return false;
    const svg = svgNode('svg', {
      'aria-hidden': 'true', focusable: 'false', width: 0, height: 0,
      style: 'position:absolute;pointer-events:none'
    });
    const defs = svgNode('defs');
    const filter = svgNode('filter', {
      id: 'amia-rail-optics', x: 0, y: 0, width: fieldWidth, height: fieldHeight,
      filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB'
    });
    filter.append(
      svgNode('feImage', { href: field, width: fieldWidth, height: fieldHeight, preserveAspectRatio: 'none', result: 'field' }),
      svgNode('feDisplacementMap', { in: 'SourceGraphic', in2: 'field', scale: opticalScale, xChannelSelector: 'R', yChannelSelector: 'G' })
    );
    defs.append(filter);
    svg.append(defs);
    document.body.append(svg);
    definitionsReady = true;
    return true;
  }

  function createFace(element) {
    if (!ensureDefinitions()) return null;
    const optics = svgNode('svg', {
      class: 'rail-glass-optics', 'aria-hidden': 'true', focusable: 'false',
      preserveAspectRatio: 'none', viewBox: '0 0 ' + fieldWidth + ' ' + fieldHeight
    });
    const trace = svgNode('rect', { class: 'rail-glass-trace' });
    const prismatic = svgNode('g', { filter: 'url(#amia-rail-optics)' });
    prismatic.append(trace);
    optics.append(prismatic);
    element.append(optics);
    const face = { trace, key: '' };
    faces.set(element, face);
    return face;
  }

  // Reuse the selection's existing position updates. No animation loop,
  // screenshot, or new displacement texture is needed during a gesture.
  function position(element, x, y, width, height, animate) {
    if (width <= 0 || height <= 0 || !element.matches('#segThumb,.glass-choice-thumb')) return;
    const rail = element.parentElement;
    if (!rail) return;
    const face = faces.get(element) || createFace(element);
    if (!face) return;
    const sx = fieldWidth / (width + 2 * outset);
    const sy = fieldHeight / (height + 2 * outset);
    const nextSize = width + ':' + height;
    if (face.key !== nextSize) {
      face.key = nextSize;
      face.trace.setAttribute('width', Math.max(0, rail.offsetWidth - 1) * sx);
      face.trace.setAttribute('height', Math.max(0, rail.offsetHeight - 1) * sy);
      face.trace.setAttribute('rx', rail.offsetHeight * sx / 2);
      face.trace.setAttribute('ry', rail.offsetHeight * sy / 2);
    }
    face.trace.style.transitionDuration = animate ? '.32s' : '0s';
    face.trace.style.transform = 'translate(' + ((outset - x - .5) * sx) + 'px,' + ((outset - y - .5) * sy) + 'px)';
  }
  window.amiaPositionGlassLens = position;
})();

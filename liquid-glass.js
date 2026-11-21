/* Adapted from liquid-glass-js (Armagan Amcalar, MIT), commit 78cb6cc.
   See LICENSE-liquid-glass.txt. The backdrop here is AMIA's own colour wash. */
(() => {
  'use strict';
  const ambient = document.querySelector('.ambient');
  const wash = ambient?.querySelector('.ambient-wash');
  const bloom = wash?.querySelector('.ambient-bloom');
  const panels = [...document.querySelectorAll('.summary, .calendar')];
  if (!wash || !panels.length || !('IntersectionObserver' in window) ||
      !('ResizeObserver' in window)) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const forcedColors = matchMedia('(forced-colors: active)');
  if (transparency.matches || forcedColors.matches) return;

  const vertexSource = `
    precision mediump float;
    attribute vec2 a_corner;
    uniform vec4 u_plate;
    uniform vec2 u_view;
    varying vec2 v_coord;
    void main() {
      v_coord = a_corner;
      vec2 pixel = u_plate.xy + a_corner * u_plate.zw;
      gl_Position = vec4(pixel / u_view * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision mediump float;
    varying vec2 v_coord;
    uniform vec4 u_plate;
    uniform vec4 u_wash;
    uniform vec2 u_view;
    uniform float u_radius;
    uniform float u_bloom;
    uniform bool u_light;

    // Rounded-rectangle distance and exponential edge/rim profile from the
    // upstream shader. Use that distance to find a normal along straight sides
    // as well as curves.
    float roundedRectDistance(vec2 coord, vec2 size, float radius) {
      vec2 center = size * 0.5;
      vec2 toCorner = abs(coord * size - center) - (center - radius);
      return length(max(toCorner, 0.0)) + min(max(toCorner.x, toCorner.y), 0.0) - radius;
    }

    float ellipse(vec2 p, vec2 center, float stop) {
      vec2 farCorner = max(center, 1.0 - center);
      float t = length((p - center) / farCorner) * 0.707107 / stop;
      return 1.0 - clamp(t, 0.0, 1.0);
    }

    vec3 backdrop(vec2 pixel) {
      vec2 p = (clamp(pixel, vec2(0.0), u_view) - u_wash.xy) / u_wash.zw;
      if (u_light) {
        vec3 c = vec3(0.925, 0.914, 0.945);
        c = mix(c, vec3(0.737, 0.800, 0.890), 0.30 * ellipse(p, vec2(.09, .96), .45));
        c = mix(c, vec3(0.671, 0.835, 0.780), 0.36 * ellipse(p, vec2(.91, .89), .52));
        c = mix(c, vec3(0.902, 0.784, 0.741), 0.35 * ellipse(p, vec2(.96, .06), .49));
        c = mix(c, vec3(0.792, 0.706, 0.886), 0.37 * ellipse(p, vec2(.03, .13), .54));
        c = mix(c, vec3(.934, .752, .786), u_bloom * .32 * ellipse(p, vec2(.50, .08), .45));
        c = mix(c, vec3(.590, .816, .758), u_bloom * .44 * ellipse(p, vec2(.77, .62), .54));
        return mix(c, vec3(.683, .666, .900), u_bloom * .46 * ellipse(p, vec2(.26, .47), .52));
      }
      vec3 c = vec3(0.082, 0.082, 0.106);
      c = mix(c, vec3(0.271, 0.361, 0.596), 0.29 * ellipse(p, vec2(.15, .95), .48));
      c = mix(c, vec3(0.220, 0.494, 0.459), 0.40 * ellipse(p, vec2(.87, .83), .50));
      c = mix(c, vec3(0.769, 0.490, 0.384), 0.43 * ellipse(p, vec2(.94, .02), .49));
      c = mix(c, vec3(0.443, 0.314, 0.608), 0.53 * ellipse(p, vec2(.06, .16), .51));
      c = mix(c, vec3(.698, .459, .569), u_bloom * .35 * ellipse(p, vec2(.50, .08), .45));
      c = mix(c, vec3(.224, .537, .455), u_bloom * .40 * ellipse(p, vec2(.77, .62), .54));
      return mix(c, vec3(.341, .337, .635), u_bloom * .44 * ellipse(p, vec2(.26, .47), .52));
    }

    void main() {
      float d = roundedRectDistance(v_coord, u_plate.zw, u_radius);
      if (d > 1.0 || d < -25.0) discard;
      vec2 stepSize = 1.5 / u_plate.zw;
      vec2 slope = vec2(
        roundedRectDistance(v_coord + vec2(stepSize.x, 0.0), u_plate.zw, u_radius) - d,
        roundedRectDistance(v_coord + vec2(0.0, stepSize.y), u_plate.zw, u_radius) - d
      );
      vec2 normal = slope / max(length(slope), .001);
      float depth = max(0.0, -d);
      float edge = exp(-depth * 0.135);
      float rim = exp(-depth * 0.62);
      vec2 pixel = u_plate.xy + v_coord * u_plate.zw;
      // Bend rays towards the interior, with a tighter curve at the rim.
      vec2 sampleAt = pixel - normal * (37.0 * edge + 28.0 * rim);
      vec3 colour = backdrop(sampleAt);
      float beam = clamp(dot(normal, vec2(-.43, -.83)), 0.0, 1.0);
      float bounce = clamp(dot(normal, vec2(.63, .74)), 0.0, 1.0);
      float caustic = exp(-abs(depth - 4.0) * .42);
      vec3 sheen = u_light ? vec3(1.0, .99, 1.0) : vec3(.86, .82, .96);
      vec3 cool = u_light ? vec3(.75, .83, .81) : vec3(.54, .68, .68);
      colour = mix(colour, sheen, beam * (.38 * rim + .30 * caustic));
      colour = mix(colour, cool, bounce * (.28 * rim + .16 * caustic));
      float coverage = (1.0 - smoothstep(-1.4, .7, d)) *
        (u_light ? .41 : .52) * max(edge, .8 * caustic);
      gl_FragColor = vec4(colour, coverage);
    }
  `;

  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-optics';
  canvas.setAttribute('aria-hidden', 'true');
  // Keep the effect inexpensive on high-density phones. CSS provides a full
  // fallback when graphics are unavailable.
  const gl = canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: false, antialias: false, depth: false,
    stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true
  });
  if (!gl) return;

  const program = gl.createProgram();
  function attach(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (ok) gl.attachShader(program, shader);
    gl.deleteShader(shader);
    return ok;
  }
  if (!attach(gl.VERTEX_SHADER, vertexSource) || !attach(gl.FRAGMENT_SHADER, fragmentSource)) return;
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const corner = gl.getAttribLocation(program, 'a_corner');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  const uniform = Object.fromEntries(
    ['plate', 'view', 'wash', 'radius', 'bloom', 'light'].map(name => [name, gl.getUniformLocation(program, 'u_' + name)])
  );

  ambient.append(canvas);
  const visible = new Set();
  const controller = new AbortController();
  const { signal } = controller;
  let timer = 0;
  let rebuild = true;
  let viewport = [0, 0];
  let geometry = [];
  const unavailable = () => document.hidden || ambient.hasAttribute('data-paused') ||
    transparency.matches || forcedColors.matches || !visible.size;

  function updateGeometry() {
    viewport = [ambient.clientWidth, ambient.clientHeight];
    const [width, height] = viewport;
    if (!width || !height) return false;
    const scale = Math.min(.8, Math.sqrt(115000 / (width * height)));
    const cols = Math.max(1, Math.floor(width * scale));
    const rows = Math.max(1, Math.floor(height * scale));
    if (canvas.width !== cols) canvas.width = cols;
    if (canvas.height !== rows) canvas.height = rows;
    gl.viewport(0, 0, cols, rows);
    geometry = [...visible].map(panel => {
      const { left, top, width, height } = panel.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 24;
      return { left, top, width, height, radius: Math.min(radius, width / 2, height / 2) };
    });
    rebuild = false;
    return true;
  }

  function paint() {
    timer = 0;
    if (unavailable()) return;
    if (rebuild && !updateGeometry()) return;
    const { left, top, width, height } = wash.getBoundingClientRect();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniform.view, ...viewport);
    gl.uniform4f(uniform.wash, left, top, width, height);
    gl.uniform1f(uniform.bloom, bloom ? Number(getComputedStyle(bloom).opacity) : 0);
    gl.uniform1i(uniform.light, Number(document.documentElement.dataset.theme === 'light'));
    for (const plate of geometry) {
      gl.uniform4f(uniform.plate, plate.left, plate.top, plate.width, plate.height);
      gl.uniform1f(uniform.radius, plate.radius);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    canvas.toggleAttribute('data-active', true);
    if (!motion.matches) timer = setTimeout(paint, 125);
  }

  function refresh() {
    clearTimeout(timer);
    timer = 0;
    rebuild = true;
    if (unavailable()) canvas.removeAttribute('data-active');
    else timer = setTimeout(paint, 50);
  }

  const intersections = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) visible.add(target);
      else visible.delete(target);
    }
    refresh();
  });
  const layout = new ResizeObserver(refresh);
  for (const panel of panels) {
    intersections.observe(panel);
    layout.observe(panel);
  }
  layout.observe(ambient);
  const pause = new MutationObserver(refresh);
  pause.observe(ambient, { attributes: true, attributeFilter: ['data-paused'] });
  const themeChanged = () => {
    refresh();
    clearTimeout(timer);
    canvas.removeAttribute('data-active');
    if (!unavailable()) timer = setTimeout(paint, 475);
  };
  document.addEventListener('schedule-theme-change', themeChanged, { signal });
  document.addEventListener('visibilitychange', refresh, { signal });
  for (const preference of [motion, transparency, forcedColors]) {
    preference.addEventListener('change', refresh, { signal });
  }
  canvas.addEventListener('webglcontextlost', () => {
    clearTimeout(timer);
    controller.abort();
    layout.disconnect();
    intersections.disconnect();
    pause.disconnect();
    canvas.remove();
  }, { once: true });
})();

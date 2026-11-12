// Space, as the receiver hears it: what lies around a lost radio adrift
// online, drawn as a matrix of dots behind the page. The receiver itself is
// never shown; the page is the receiver. Nothing here answers to a touch.
//
// A scene is a field of light, sampled once per cell of the matrix: each
// dot's size and colour are the light at its centre. Scenes are meant to
// change and evolve; for now each Song tunes to one of them, and
// ?scene=<name> holds one still for looking at.

const scenes = ['cloud', 'pillars']

const vertex = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const fragment = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dpr;
uniform float u_scene;
uniform float u_seed;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
mat2 turn(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// a star cloud, seen from inside a galaxy's disk and close up: a fairly even
// haze of countless faint stars, crossed by soft lanes of dust, with only a
// hint of colour here and there. Nothing in it asks to be looked at.
vec4 cloud(vec2 p, float t) {
  vec2 q = turn(0.6 + u_seed * 1.4) * p + vec2(t * 0.0015, 0.0) + u_seed * 7.0;
  float band = fbm(q * 0.8);
  float dust = smoothstep(0.48, 0.72, fbm(q * 1.7 + 4.0)) * 0.75;
  float grain = 0.55 + 0.7 * noise(q * 38.0);
  float haze = (0.46 + 0.24 * band) * (1.0 - dust) * grain;
  float warmth = smoothstep(0.45, 0.75, fbm(q * 1.1 - 2.0));
  float blush = smoothstep(0.62, 0.8, fbm(q * 2.2 + 9.0)) * (1.0 - dust) * 0.25;
  vec3 color = mix(vec3(0.62, 0.7, 0.85), vec3(0.85, 0.75, 0.6), warmth) * haze * 1.15 + vec3(0.8, 0.4, 0.55) * blush * 0.7;
  return vec4(color, haze + blush * 0.3);
}

// pillars of dust rising out of the dark, lit from behind and above by the
// nebula they are being carved from: dark columns, bright heads
vec4 pillars(vec2 p, float t) {
  vec2 w = p + vec2(t * 0.002, 0.0);
  float glow = fbm(w * 1.3 + u_seed * 5.0);
  float wisps = fbm(w * 3.5 - u_seed * 2.0);
  float light = (0.35 + 0.9 * smoothstep(0.3, 0.8, glow)) * smoothstep(-1.3, 0.6, p.y) * (0.7 + 0.5 * wisps);
  vec3 nebula = mix(vec3(0.12, 0.5, 0.58), vec3(1.0, 0.66, 0.34), smoothstep(0.35, 0.8, glow + 0.2 * wisps));
  float density = 0.0;
  float head = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = -0.7 + fi * 0.62 + (hash(vec2(fi, u_seed * 7.0)) - 0.5) * 0.25;
    float top = -0.15 + 0.55 * hash(vec2(fi + 3.0, u_seed * 11.0)) - fi * 0.08;
    float along = clamp((p.y + 1.3) / (top + 1.3), 0.0, 1.0);
    float width = mix(0.2 + 0.04 * fi, 0.06, along);
    float rough = 0.06 * (fbm(vec2(p.y * 5.0, fi * 3.0 + u_seed)) - 0.5);
    float side = abs(p.x - x - 0.08 * along + rough) - width;
    float column = smoothstep(0.04, -0.03, side) * step(p.y, top);
    float cap = smoothstep(width + 0.03, width - 0.04, length((p - vec2(x + 0.08, top)) * vec2(1.0, 1.4)));
    float body = max(column, cap) * (0.75 + 0.25 * fbm(p * 7.0 + fi * 4.0));
    density = max(density, body);
    // the edges facing the light glow where the dust is being worn away
    head = max(head, cap * smoothstep(top - 0.1, top + 0.05, p.y) + smoothstep(0.02, 0.0, abs(side)) * 0.5 * along * step(p.y, top));
  }
  vec3 color = nebula * light * (1.0 - 0.94 * density) + vec3(1.0, 0.82, 0.58) * head * light * 0.9;
  return vec4(color, light * (1.0 - 0.94 * density) + head * light * 0.7);
}

void main() {
  float spacing = 6.0 * u_dpr;
  vec2 cell = floor(gl_FragCoord.xy / spacing);
  vec2 centre = (cell + 0.5) * spacing;
  vec2 p = (centre - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y) * 2.0;
  float t = u_time;

  vec4 light = u_scene < 0.5 ? cloud(p, t) : pillars(p, t);

  // a glimmer: every dot is a star of its own, and each changes its light
  // on its own, at its own pace; no two neighbours keep the same time
  float own = hash(cell * 1.7 + 41.0);
  float pace = 0.25 + 0.9 * hash(cell * 2.3 + 7.0);
  light *= 0.82 + 0.3 * (0.5 + 0.5 * sin(t * pace + own * 6.2832));

  // far stars, each fixed to its cell, each keeping its own time. A star
  // never goes out: its light only wavers a little, unevenly, the way the
  // air or the dust between makes it seem to
  vec2 shelf = vec2(floor(u_seed * 100.0));
  float isStar = step(0.9965, hash(cell + shelf));
  float waver = 0.5 * sin(t * (0.2 + 0.5 * hash(cell * 5.7 + shelf)) + 6.2832 * hash(cell * 3.1 + shelf + 5.0))
              + 0.5 * sin(t * (0.07 + 0.2 * hash(cell * 8.3 + shelf)) + 6.2832 * hash(cell * 4.9 + shelf + 9.0));
  float stars = isStar * 0.7 * (0.85 + 0.15 * waver);
  vec3 color = light.rgb + vec3(0.85, 0.9, 1.0) * stars;
  float energy = clamp(light.a + stars, 0.0, 1.0);

  vec2 inCell = fract(gl_FragCoord.xy / spacing) - 0.5;
  float radius = mix(0.06, 0.38, clamp(energy * 1.2, 0.0, 1.0));
  float aa = 1.2 / spacing;
  float dot = 1.0 - smoothstep(radius - aa, radius + aa, length(inCell));
  // quiet enough that the words stay in front
  gl_FragColor = vec4(color * dot * 0.55, 1.0);
}`

const canvas = document.getElementById('space')
const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
const still = window.matchMedia('(prefers-reduced-motion: reduce)')
const asked = new URLSearchParams(location.search).get('scene')
const pinned = scenes.includes(asked) ? scenes.indexOf(asked) : undefined

let uniforms
let scene = pinned ?? 0
let seed = 0.37
let frame
let last = 0
const started = performance.now()

function compile(type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
  return shader
}

function begin() {
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const at = gl.getAttribLocation(program, 'p')
  gl.enableVertexAttribArray(at)
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
  uniforms = Object.fromEntries(
    ['resolution', 'time', 'dpr', 'scene', 'seed'].map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]),
  )
}

function fit() {
  // never more pixels than a modest screen's worth: the dots are large anyway
  const scale = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2_000_000 / (innerWidth * innerHeight)))
  canvas.width = Math.round(innerWidth * scale)
  canvas.height = Math.round(innerHeight * scale)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
  gl.uniform1f(uniforms.dpr, scale)
  draw()
}

function draw(now = performance.now()) {
  gl.uniform1f(uniforms.time, still.matches ? 0 : (now - started) / 1000)
  gl.uniform1f(uniforms.scene, scene)
  gl.uniform1f(uniforms.seed, seed)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

// slow light needs few frames: about twenty a second
function drift(now) {
  frame = requestAnimationFrame(drift)
  if (now - last < 50) return
  last = now
  draw(now)
}

function play() {
  cancelAnimationFrame(frame)
  if (!still.matches && !document.hidden) frame = requestAnimationFrame(drift)
}

if (gl) {
  try {
    begin()
    fit()
    play()
    addEventListener('resize', fit)
    document.addEventListener('visibilitychange', play)
    still.addEventListener('change', () => {
      draw()
      play()
    })
  } catch (error) {
    console.warn(`space stays dark: ${error.message}`)
  }
}

/** Tunes space to a Song: each Song lies somewhere of its own. */
window.space = {
  tune(song) {
    if (!uniforms) return
    const n = Number(BigInt(song) % 9973n)
    seed = (n * 0.618034) % 1
    if (pinned === undefined) scene = n % scenes.length
    draw()
  },
}

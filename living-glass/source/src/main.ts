import * as THREE from 'three';
import { generateCells } from './cells';

// ---------- composition constants (world units) ----------
const HW = 1.5; // half width of the glass
const Y0 = 0.6; // sill
const YS = 3.2; // spring line of the pointed arch
const HEIGHT = 5.2; // Y0 .. apex (equilateral arch: YS + sqrt(3) * HW)
const CELL_COUNT = 200;

// ---------- game constants ----------
const MISSING = 8; // panes knocked out of the window
const PLAY_Z = 0.35; // moths, routes and loose shards live on this plane
const SPEED = 2.7; // moth flight speed, units / s
const MOTH_DEFS = [
  { name: 'Amber', color: '#ffb52e' },
  { name: 'Rose', color: '#ff5c8a' },
  { name: 'Azure', color: '#4fb4ff' },
];

type P2 = [number, number];

/** Pointed gothic arch as a convex CCW polygon. */
function archPolygon(hw: number, y0: number, ys: number, seg = 28): P2[] {
  const pts: P2[] = [[-hw, y0], [hw, y0]];
  const r = 2 * hw;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 3);
    pts.push([-hw + r * Math.cos(a), ys + r * Math.sin(a)]);
  }
  for (let i = 1; i <= seg; i++) {
    const a = (2 * Math.PI) / 3 + (i / seg) * (Math.PI / 3);
    pts.push([hw + r * Math.cos(a), ys + r * Math.sin(a)]);
  }
  return pts;
}

/** Sutherland–Hodgman: clip a convex polygon by a convex CCW polygon. */
function clipConvex(subject: P2[], clip: P2[]): P2[] {
  let out = subject;
  for (let i = 0; i < clip.length && out.length >= 3; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p: P2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const next: P2[] = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j];
      const q = out[(j + 1) % out.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) next.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    out = next;
  }
  return out;
}

function rand(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Jewel ramp: gold heart -> rose -> ruby -> violet -> cobalt -> teal rim.
const RAMP = ['#ffc23d', '#ff7a3c', '#e0244f', '#9a2bd6', '#2a4cf0', '#12a6b8', '#1fbf7a'].map(
  (h) => new THREE.Color(h),
);
function jewel(t: number, out: THREE.Color): THREE.Color {
  const x = Math.min(0.9999, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.floor(x);
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], x - i);
}

const ARCH = archPolygon(HW, Y0, YS);

type Pane = { start: number; count: number; cx: number; cy: number; area: number; poly: P2[] };

function buildGlass(seed: number): { geometry: THREE.BufferGeometry; panes: Pane[] } {
  const pos: number[] = [];
  const center: number[] = [];
  const color: number[] = [];
  const seeds: number[] = [];
  const edge: number[] = [];
  const panes: Pane[] = [];
  const col = new THREE.Color();

  for (const cell of generateCells(CELL_COUNT, seed)) {
    if (!cell.polygon || cell.polygon.length < 3) continue;
    const world: P2[] = cell.polygon.map(([u, v]: P2): P2 => [u * HW, Y0 + ((v + 1) / 2) * HEIGHT]);
    if (world.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) continue;
    const poly = clipConvex(world, ARCH);
    if (poly.length < 3) continue;

    // area centroid
    let a2 = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % poly.length];
      const w = x0 * y1 - x1 * y0;
      a2 += w;
      cx += (x0 + x1) * w;
      cy += (y0 + y1) * w;
    }
    if (Math.abs(a2) < 2e-4) continue;
    cx /= 3 * a2;
    cy /= 3 * a2;

    const s = rand(seed * 0.37 + cell.id * 1.618);
    const r = Math.hypot(cx, (cy - 3.55) * 0.8) / 2.5;
    jewel(r + (rand(s * 91.7) - 0.5) * 0.34, col);
    col.multiplyScalar(0.7 + rand(s * 13.3) * 0.6);

    panes.push({ start: pos.length / 3, count: poly.length * 3, cx, cy, area: Math.abs(a2) / 2, poly });
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      pos.push(cx, cy, 0, a[0], a[1], 0, b[0], b[1], 0);
      edge.push(1, 0, 0);
      for (let k = 0; k < 3; k++) {
        center.push(cx, cy);
        color.push(col.r, col.g, col.b);
        seeds.push(s);
      }
    }
  }

  const n = pos.length / 3;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(center, 2));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(color, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  // per-pane game state, rewritten only for the loose panes
  const off = new THREE.BufferAttribute(new Float32Array(n * 3), 3); // offset from the pane's slot
  const fx = new THREE.BufferAttribute(new Float32Array(n * 3), 3); // spin, loose, flash
  off.setUsage(THREE.DynamicDrawUsage);
  fx.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aOff', off);
  g.setAttribute('aFx', fx);
  return { geometry: g, panes };
}

// ---------- shaders ----------
const uniforms = {
  uTime: { value: 0 },
  uProgress: { value: 0 },
  uSmile: { value: 0 },
  uAgents: { value: MOTH_DEFS.map(() => new THREE.Vector2(0, -50)) },
};

const glassVert = /* glsl */ `
uniform float uTime;
attribute vec2 aCenter;
attribute vec3 aColor, aOff, aFx;
attribute float aSeed, aEdge;
varying vec3 vColor;
varying vec2 vWorld, vCenter;
varying float vEdge, vSeed, vDist, vLoose, vFlash;
void main(){
  float loose = aFx.y;
  vec2 c = aCenter + aOff.xy;
  vec2 l = position.xy - aCenter;
  float sc = 0.93 + 0.035 * sin(uTime * 0.9 + aSeed * 6.283) + 0.2 * aFx.z;
  float ang = 0.035 * sin(uTime * 0.55 + aSeed * 40.0) + aFx.x;
  float z = 0.03 * sin(uTime * 0.7 + aSeed * 17.0) + aOff.z;
  float cs = cos(ang), sn = sin(ang);
  vec3 P = vec3(c + mat2(cs, sn, -sn, cs) * l * sc, z);
  vColor = aColor; vEdge = aEdge; vSeed = aSeed; vLoose = loose; vFlash = aFx.z;
  vWorld = P.xy; vCenter = c; vDist = 0.0;
#ifdef FLOOR
  float hgt = max(P.y - ${Y0.toFixed(2)}, 0.0);
  vDist = hgt / ${HEIGHT.toFixed(2)};
  P = vec3(P.x * (1.0 + 0.11 * hgt), 0.012, 0.32 + hgt * 0.74);
#endif
  gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
}`;

const glassFrag = /* glsl */ `
uniform float uTime, uSmile, uProgress;
uniform vec2 uAgents[${MOTH_DEFS.length}];
varying vec3 vColor;
varying vec2 vWorld, vCenter;
varying float vEdge, vSeed, vDist, vLoose, vFlash;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float smile(vec2 p){
  vec2 q = (p - vec2(0.0, 3.55)) / 0.98;
  float e = min(length(q - vec2(-0.36, 0.3)), length(q - vec2(0.36, 0.3)));
  float m = smoothstep(0.15, 0.10, e);
  float arc = abs(length(q - vec2(0.0, 0.12)) - 0.6);
  m = max(m, smoothstep(0.1, 0.06, arc) * smoothstep(-0.1, -0.2, q.y));
  return m;
}
void main(){
  // hand-rolled glass: streaks + slow light drifting behind the window
  float n = 0.72 + 0.5 * noise(vWorld * vec2(5.0, 2.2) + vSeed * 31.0) * noise(vWorld * 13.0 + vSeed * 7.0 + 3.0) * 1.6;
  float sun = 0.78 + 0.34 * sin(vWorld.x * 0.8 + vWorld.y * 0.55 - uTime * 0.38)
            + 0.14 * sin(vWorld.y * 2.1 + uTime * 0.23 + vSeed * 6.0);
  // the window is dim and grey while broken; every pane brought home lets more light through
  float p2 = uProgress * uProgress;
  float lit = mix(0.14 + 0.86 * p2, 1.7 + 0.4 * sin(uTime * 2.4 + vSeed * 20.0), vLoose);
  vec3 base = mix(vec3(dot(vColor, vec3(0.3, 0.5, 0.2))) * vec3(0.8, 0.85, 1.1), vColor, max(vLoose, 0.3 + 0.7 * uProgress));
  vec3 col = base * n * mix(sun, 1.0, vLoose) * lit;

  float a = 0.0;
  for (int i = 0; i < ${MOTH_DEFS.length}; i++) { vec2 d = vCenter - uAgents[i]; a += exp(-dot(d, d) / 0.2); }
  a = min(a, 1.5) * (1.0 - vLoose);
  col += vColor * a * 0.8 + vec3(1.0, 0.86, 0.6) * a * 0.1;

  float glint = pow(max(0.0, sin(uTime * 0.6 + vSeed * 30.0)), 24.0);
  col += (vColor + 0.25) * glint * 0.7 * p2;
  col += (vColor * 1.6 + vec3(1.0, 0.9, 0.7)) * vFlash * 1.4;

  float m = smile(vWorld) * uSmile;
  col = mix(col * (1.0 - 0.62 * uSmile), vec3(1.0, 0.74, 0.2) * 2.3 * n, m);

#ifdef FLOOR
  float soft = smoothstep(0.0, 0.55, vEdge);
  col *= soft * (1.0 - 0.6 * vDist) * 0.62 * (1.0 - vLoose);
  gl_FragColor = vec4(col, 1.0);
#else
  float bevel = smoothstep(0.0, 0.1, vEdge);
  float rim = smoothstep(0.05, 0.11, vEdge) * smoothstep(0.24, 0.11, vEdge);
  col = col * mix(0.22, 1.0, bevel) + vColor * rim * (0.08 + 0.27 * p2 + 0.6 * vLoose);
  col = 1.0 - exp(-col * 1.55);
  gl_FragColor = vec4(col, 1.0);
#endif
  #include <colorspace_fragment>
}`;

// ---------- scene ----------
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x05050a);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 1, 80);

const glassMat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: glassVert,
  fragmentShader: glassFrag,
  side: THREE.DoubleSide,
});
const floorMat = new THREE.ShaderMaterial({
  uniforms,
  defines: { FLOOR: 1 },
  vertexShader: glassVert,
  fragmentShader: glassFrag,
  side: THREE.DoubleSide,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const glass = new THREE.Mesh(new THREE.BufferGeometry(), glassMat);
const cast = new THREE.Mesh(glass.geometry, floorMat);
glass.frustumCulled = cast.frustumCulled = false;
glass.renderOrder = 3;
cast.renderOrder = 2;
scene.add(glass, cast);

// leading behind the glass
const toShape = (pts: P2[]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const lead = new THREE.Mesh(new THREE.ShapeGeometry(toShape(ARCH)), new THREE.MeshBasicMaterial({ color: 0x020203 }));
lead.position.z = -0.06;
scene.add(lead);

// stone surround
const frameShape = toShape(archPolygon(HW + 0.24, Y0 - 0.24, YS));
frameShape.holes.push(new THREE.Path(archPolygon(HW + 0.02, Y0 - 0.02, YS).map(([x, y]) => new THREE.Vector2(x, y))));
const frame = new THREE.Mesh(
  new THREE.ExtrudeGeometry(frameShape, { depth: 0.34, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }),
  new THREE.MeshStandardMaterial({ color: 0x2b2733, roughness: 0.62, metalness: 0.25 }),
);
frame.position.z = -0.17;
scene.add(frame);
const key = new THREE.PointLight(0xffc48a, 26, 22);
key.position.set(-2.6, 5.4, 4.2);
const fill = new THREE.PointLight(0x5a6cff, 14, 22);
fill.position.set(3.2, 1.2, 3.6);
scene.add(key, fill, new THREE.AmbientLight(0x30304a, 0.5));

// wall + floor: dark, with just enough light to give the room a shape
const roomVert = `varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }`;
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 30),
  new THREE.ShaderMaterial({
    uniforms: { uProgress: uniforms.uProgress },
    vertexShader: roomVert,
    fragmentShader: `uniform float uProgress; varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 q = (vP.xy - vec2(0.0, 3.3)) / vec2(2.6, 3.6);
        float g = exp(-dot(q, q) * 0.9) * (0.45 + 0.55 * uProgress);
        vec2 b = vP.xy * vec2(0.9, 1.9); b.x += floor(b.y) * 0.5;
        vec2 fb = fract(b);
        float mortar = smoothstep(0.0, 0.04, fb.x) * smoothstep(0.0, 0.07, fb.y);
        float stone = 0.75 + 0.25 * hash(floor(b));
        vec3 col = vec3(0.012, 0.012, 0.02) + vec3(0.075, 0.055, 0.12) * g * stone * mix(0.55, 1.0, mortar);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
wall.position.set(0, 10, -0.2);
scene.add(wall);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 40),
  new THREE.ShaderMaterial({
    uniforms: { uProgress: uniforms.uProgress },
    vertexShader: roomVert,
    fragmentShader: `uniform float uProgress; varying vec3 vP;
      void main(){
        vec2 q = (vP.xz - vec2(0.0, 1.8)) / vec2(3.4, 3.6);
        float g = exp(-dot(q, q)) * (0.4 + 0.6 * uProgress);
        vec2 t = abs(fract(vP.xz * 0.5) - 0.5);
        float joint = smoothstep(0.0, 0.012, min(t.x, t.y));
        vec3 col = vec3(0.01, 0.01, 0.016) + vec3(0.05, 0.04, 0.075) * g * mix(0.5, 1.0, joint);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.z = 19.8;
scene.add(floor);

// dust drifting through the coloured light
{
  const DUST = 320;
  const p: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < DUST; i++) {
    p.push((rand(i + 0.1) - 0.5) * 5.5, rand(i + 0.2) * 5.6, 0.5 + rand(i + 0.3) * 4.0);
    s.push(rand(i + 0.4));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(s, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uProgress: uniforms.uProgress, uPx: { value: 1 } },
    vertexShader: `uniform float uTime, uPx; attribute float aSeed; varying float vA; varying vec3 vC;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.03 + aSeed * 0.05), 5.6);
        p.x += sin(uTime * 0.2 + aSeed * 40.0) * 0.3;
        p.z += cos(uTime * 0.17 + aSeed * 23.0) * 0.3;
        vA = (0.25 + 0.75 * abs(sin(uTime * (0.5 + aSeed) + aSeed * 50.0))) * smoothstep(5.6, 3.5, p.y) * smoothstep(0.0, 0.5, p.y);
        vC = mix(vec3(1.0, 0.75, 0.4), vec3(0.6, 0.55, 1.0), fract(aSeed * 7.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = max(1.5, uPx * (0.035 + 0.07 * aSeed) / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uProgress; varying float vA; varying vec3 vC;
      void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC * smoothstep(0.5, 0.0, d) * vA * (0.12 + 0.43 * uProgress), 1.0); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dust = new THREE.Points(g, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 5;
  dust.onBeforeRender = () => (dustMat.uniforms.uPx.value = renderer.domElement.height * 0.5);
  scene.add(dust);
}

// ---------- game state ----------
// Shard i belongs to slot i (its own pane). That identity is never shown to the player.
type ShardState = 'loose' | 'waiting' | 'carried' | 'seating' | 'returning' | 'placed';
type Shard = {
  id: number;
  pane: Pane;
  state: ShardState;
  x: number; y: number; z: number; // world position of the shard
  hx: number; hy: number; // its resting place in a side aisle
  angle: number; // stable puzzle orientation; turns home only when seated
  target: number; // slot the player sent it to, -1 when none
  bx: number; by: number; t: number; // wrong-slot bounce
  flash: number;
  ghost: THREE.LineLoop;
};
type MothState = 'idle' | 'fetch' | 'carry' | 'home';
type Moth = {
  name: string;
  group: THREE.Group;
  body: THREE.Group;
  wingR: THREE.Mesh;
  wingL: THREE.Mesh;
  x: number; y: number;
  rx: number; ry: number;
  heading: number;
  state: MothState;
  job: Shard | null;
  pulse: number;
};

const params = new URLSearchParams(location.search);
const forceSmile = params.has('smile');
let seed = 7;
let shards: Shard[] = [];
let placed = 0;
let attempts = 0;
let wrongAttempts = 0;
let done = false;
let selectedShard = -1;
let time = 0;
let smileT = 0;
let toastTimer = 0;

const ghostMat = new THREE.LineBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.8, depthTest: false });
const ghosts = new THREE.Group();
scene.add(ghosts);

// glass moths: three equivalent helpers, assigned automatically
const wingGeo = new THREE.BufferGeometry();
wingGeo.setAttribute(
  'position',
  new THREE.Float32BufferAttribute([0, 0.1, 0, 0, -0.07, 0, 0.2, 0.09, 0, 0, -0.07, 0, 0.13, -0.11, 0, 0.2, 0.09, 0], 3),
);
const haloGeo = new THREE.CircleGeometry(0.36, 32);
const haloVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const haloFrag = `uniform vec3 uC; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uC * pow(max(0.0, 1.0 - d), 2.0) * 0.5, 1.0); }`;

const restartBtn = document.getElementById('restart') as HTMLButtonElement;
const progressEl = document.getElementById('progress') as HTMLElement;
const toastEl = document.getElementById('toast') as HTMLElement;
const winEl = document.getElementById('win') as HTMLElement;

const moths: Moth[] = MOTH_DEFS.map((def, i) => {
  const color = new THREE.Color(def.color);
  const pale = color.clone().lerp(new THREE.Color(0xffffff), 0.35);
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false };
  const group = new THREE.Group();
  const wingMat = new THREE.MeshBasicMaterial({ color: pale, side: THREE.DoubleSide, ...add });
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.scale.x = -1;
  const body = new THREE.Group();
  body.add(wingR, wingL);
  body.scale.setScalar(1.3);
  const halo = new THREE.Mesh(
    haloGeo,
    new THREE.ShaderMaterial({ uniforms: { uC: { value: color } }, vertexShader: haloVert, fragmentShader: haloFrag, ...add }),
  );
  halo.renderOrder = wingR.renderOrder = wingL.renderOrder = 7;
  group.add(halo, body);
  scene.add(group);
  const rx = (i - 1) * 0.9;
  const ry = 0.32;
  return { name: def.name, group, body, wingR, wingL, x: rx, y: ry, rx, ry, heading: Math.PI / 2, state: 'idle' as MothState, job: null, pulse: 0 };
});

function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function updateHud() {
  progressEl.textContent = `${placed} / ${shards.length} restored`;
  winEl.classList.toggle('show', done);
}

function writeShard(s: Shard) {
  const off = glass.geometry.getAttribute('aOff') as THREE.BufferAttribute;
  const fx = glass.geometry.getAttribute('aFx') as THREE.BufferAttribute;
  const loose =
    s.state === 'placed' ? 0 : s.state === 'seating' ? Math.min(1, Math.hypot(s.x - s.pane.cx, s.y - s.pane.cy) * 3 + s.z * 2) : 1;
  const flash = Math.max(s.flash, s.id === selectedShard ? 0.3 + 0.06 * Math.sin(time * 5) : 0);
  for (let v = s.pane.start; v < s.pane.start + s.pane.count; v++) {
    off.setXYZ(v, s.x - s.pane.cx, s.y - s.pane.cy, s.z);
    fx.setXYZ(v, s.angle, loose, flash);
  }
  off.needsUpdate = fx.needsUpdate = true;
}

/** Build (or rebuild) the level. Safe to call repeatedly: disposes everything it replaces. */
function startLevel() {
  const old = glass.geometry;
  const { geometry, panes } = buildGlass(seed);
  glass.geometry = cast.geometry = geometry;
  old.dispose();
  for (const s of shards) s.ghost.geometry.dispose();
  ghosts.clear();

  // knock out large panes, spread across the window
  const pool = panes
    .filter((p) => Math.abs(p.cx) < HW - 0.25 && p.cy > Y0 + 0.4 && p.cy < 4.8)
    .sort((a, b) => b.area - a.area)
    .slice(0, 45)
    .sort((a, b) => rand(seed + a.cx * 9.1 + a.cy) - rand(seed + b.cx * 9.1 + b.cy));
  const chosen: Pane[] = [];
  for (const min of [0.95, 0.65, 0.4, 0]) {
    for (const p of pool) {
      if (chosen.length >= MISSING) break;
      if (!chosen.includes(p) && chosen.every((c) => Math.hypot(c.cx - p.cx, c.cy - p.cy) > min)) chosen.push(p);
    }
  }

  // aisle places are shuffled so position says nothing about where a piece belongs
  const places = chosen.map((_, i) => i).sort((a, b) => rand(seed * 5.3 + a * 3.7) - rand(seed * 5.3 + b * 3.7));
  const rows = Math.ceil(chosen.length / 2);
  shards = chosen.map((pane, id) => {
    const k = places[id];
    const hx = (k % 2 ? 1 : -1) * 2.06;
    const hy = 1.35 + (Math.floor(k / 2) + 0.5) * (3.9 / rows);
    const ghost = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        pane.poly.map(([x, y]) => new THREE.Vector3(pane.cx + (x - pane.cx) * 0.93, pane.cy + (y - pane.cy) * 0.93, 0.03)),
      ),
      ghostMat,
    );
    ghost.renderOrder = 4;
    ghosts.add(ghost);
    // Keep every loose piece visibly turned, in either direction, without continuous spinning.
    const homeAngle = (rand(seed * 11.7 + id * 7.3) < 0.5 ? -1 : 1)
      * THREE.MathUtils.degToRad(45 + rand(seed * 19.1 + id * 13.7) * 120);
    return { id, pane, state: 'loose' as ShardState, x: hx, y: hy, z: PLAY_Z, hx, hy, angle: homeAngle, target: -1, bx: 0, by: 0, t: 0, flash: 0, ghost };
  });

  for (const m of moths) {
    m.x = m.rx;
    m.y = m.ry;
    m.heading = Math.PI / 2;
    m.state = 'idle';
    m.job = null;
    m.pulse = 0;
  }
  down = null;
  placed = attempts = wrongAttempts = 0;
  done = false;
  smileT = 0;
  selectedShard = -1;
  clearTimeout(toastTimer);
  toastEl.classList.remove('show');
  uniforms.uProgress.value = 0;
  shards.forEach(writeShard);
  updateHud();
}

function restart() {
  seed += 1;
  startLevel();
}
restartBtn.addEventListener('click', restart);
(document.getElementById('again') as HTMLButtonElement).addEventListener('click', restart);

// ---------- input: choose a piece, then choose an opening ----------
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hit = new THREE.Vector3();
const ndc = new THREE.Vector2();
let down: { id: number; x: number; y: number; shard: number; slot: number; previous: number } | null = null;

function toWorld(e: PointerEvent, z: number): P2 | null {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  plane.constant = -z;
  return ray.ray.intersectPlane(plane, hit) ? [hit.x, hit.y] : null;
}
function toScreen(x: number, y: number, z = PLAY_Z): P2 {
  const v = new THREE.Vector3(x, y, z).project(camera);
  const r = canvas.getBoundingClientRect();
  return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
}

const slotOpen = (i: number) => shards[i].state !== 'placed' && shards[i].state !== 'seating';
const slotReserved = (i: number) => shards.some((s) => s.target === i);

function shardAt(e: PointerEvent): number {
  const p = toWorld(e, PLAY_Z);
  let best = -1;
  let bd = 0.45;
  if (p) for (const s of shards) {
    const d = Math.hypot(s.x - p[0], s.y - p[1]);
    if (s.state === 'loose' && d < bd) { bd = d; best = s.id; }
  }
  return best;
}
function slotAt(e: PointerEvent): number {
  const p = toWorld(e, 0);
  let best = -1;
  let bd = 0.4;
  if (p) for (const s of shards) {
    const d = Math.hypot(s.pane.cx - p[0], s.pane.cy - p[1]);
    if (slotOpen(s.id) && d < bd) { bd = d; best = s.id; }
  }
  return best;
}

/** Send the selected piece to the opening the player chose. No validation happens here. */
function sendTo(slot: number) {
  const s = shards[selectedShard];
  if (!s || s.state !== 'loose') return;
  if (slotReserved(slot)) return toast('A helper is already heading there');
  let m: Moth | null = null;
  let bd = Infinity;
  for (const c of moths) {
    const d = Math.hypot(c.x - s.x, c.y - s.y);
    if ((c.state === 'idle' || c.state === 'home') && d < bd) { bd = d; m = c; }
  }
  if (!m) return toast('All helpers are busy — try again in a moment');
  s.state = 'waiting';
  s.target = slot;
  m.job = s;
  m.state = 'fetch';
  attempts += 1;
  selectedShard = -1;
}

canvas.addEventListener('pointerdown', (e) => {
  if (down || done || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  down = { id: e.pointerId, x: e.clientX, y: e.clientY, shard: -1, slot: -1, previous: selectedShard };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers may not be capturable */ }
  const sh = shardAt(e);
  if (sh >= 0) {
    down.shard = sh;
    selectedShard = sh;
    return;
  }
  const slot = slotAt(e);
  if (slot < 0) selectedShard = -1;
  else down.slot = slot;
});
function endPointer(e: PointerEvent, commit: boolean) {
  if (!down || e.pointerId !== down.id) return;
  const d = down;
  down = null;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  if (!commit || done) {
    if (d.shard >= 0) selectedShard = d.previous;
    return;
  }
  const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14;
  if (d.shard >= 0) {
    if (moved) {
      const slot = slotAt(e);
      if (slot >= 0) sendTo(slot);
    } else if (d.previous === d.shard) selectedShard = -1;
  } else if (d.slot >= 0 && !moved && slotAt(e) === d.slot) {
    if (selectedShard < 0) toast('Choose a piece first');
    else sendTo(d.slot);
  }
}
canvas.addEventListener('pointerup', (e) => endPointer(e, true));
canvas.addEventListener('pointercancel', (e) => endPointer(e, false));
canvas.addEventListener('lostpointercapture', (e) => endPointer(e, false));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'r' || e.key === 'R') restart();
  else if (e.key === 'Escape') selectedShard = -1;
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the whole window, the side aisles and the pool of light in frame on any aspect
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(7.9 / (2 * t), 5.2 / (2 * t * camera.aspect));
  camera.position.set(0, 3.5, dist);
  camera.lookAt(0, 2.65, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
window.addEventListener('resize', resize);
resize();

// ---------- simulation ----------
function step(dt: number) {
  time += dt;
  uniforms.uTime.value = time;
  let hud = false;

  moths.forEach((m, i) => {
    let target: P2 | null = null;
    const s = m.job;
    if (m.state === 'fetch' && s) {
      target = [s.x, s.y + 0.2];
      if (Math.hypot(target[0] - m.x, target[1] - m.y) < 0.1) {
        s.state = 'carried';
        s.flash = 0.8;
        m.pulse = 1;
        m.state = 'carry';
      }
    } else if (m.state === 'carry' && s) {
      const slot = shards[s.target].pane;
      target = [slot.cx, slot.cy + 0.2];
      if (Math.hypot(target[0] - m.x, target[1] - m.y) < 0.08) {
        if (s.target === s.id) s.state = 'seating'; // keeps its reservation until seated
        else {
          // wrong opening: no repair, no rerouting; the piece bounces and goes back to its aisle
          s.state = 'returning';
          s.bx = slot.cx;
          s.by = slot.cy;
          s.t = 0;
          s.target = -1;
          s.flash = 0.5;
          wrongAttempts += 1;
          toast('Different shape — try another opening');
        }
        m.pulse = 1;
        m.job = null;
        m.state = 'home';
      }
    } else if (m.state === 'home') {
      target = [m.rx, m.ry];
      if (Math.hypot(m.rx - m.x, m.ry - m.y) < 0.04) m.state = 'idle';
    }
    if (target) {
      const dx = target[0] - m.x;
      const dy = target[1] - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const mv = Math.min(d, SPEED * dt);
      m.x += (dx / d) * mv;
      m.y += (dy / d) * mv;
      let dh = Math.atan2(dy, dx) - m.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      m.heading += dh * Math.min(1, dt * 10);
    }
    m.pulse = Math.max(0, m.pulse - dt * 2.2);

    const moving = m.state !== 'idle';
    const bob = moving ? 0 : Math.sin(time * 1.6 + i * 2.1) * 0.04;
    m.group.position.set(m.x, m.y + bob, PLAY_Z + 0.06);
    m.group.scale.setScalar(1 + m.pulse * 0.5);
    m.body.rotation.z = m.heading - Math.PI / 2;
    const flap = 0.2 + (moving ? 1.05 : 0.55) * Math.abs(Math.sin(time * (moving ? 11 : 4.5) + i * 1.3));
    m.wingR.rotation.y = -flap;
    m.wingL.rotation.y = flap;
    uniforms.uAgents.value[i].set(m.x, m.y);
  });

  const k = Math.min(1, dt * 8);
  for (const s of shards) {
    if (s.state === 'placed' && s.flash <= 0) continue;
    s.flash = Math.max(0, s.flash - dt * 1.6);
    if (s.state === 'loose' || s.state === 'waiting') {
      const lift = s.id === selectedShard || s.state === 'waiting' ? 0.3 : 0;
      s.x = s.hx;
      s.y = s.hy + Math.sin(time * 0.8 + s.hy * 5) * 0.025;
      s.z += (PLAY_Z + lift - s.z) * k;
    } else if (s.state === 'carried') {
      const m = moths.find((c) => c.job === s);
      if (m) {
        s.x += (m.x - s.x) * k;
        s.y += (m.y - 0.2 - s.y) * k;
      }
      s.z += (PLAY_Z - s.z) * k;
    } else if (s.state === 'seating') {
      s.angle += (0 - s.angle) * k;
      s.x += (s.pane.cx - s.x) * k;
      s.y += (s.pane.cy - s.y) * k;
      s.z += (0 - s.z) * k;
      if (Math.hypot(s.x - s.pane.cx, s.y - s.pane.cy) < 0.012 && s.z < 0.012 && Math.abs(s.angle) < 0.012) {
        s.state = 'placed';
        s.x = s.pane.cx; s.y = s.pane.cy; s.z = 0;
        s.angle = 0;
        s.target = -1;
        s.flash = 1;
        s.ghost.visible = false;
        placed += 1;
        if (placed === shards.length) {
          done = true;
          selectedShard = -1;
        }
        hud = true;
      }
    } else if (s.state === 'returning') {
      s.t += dt;
      if (s.t < 0.55) {
        // try the opening, shake, give up
        s.x += (s.bx + Math.sin(s.t * 42) * 0.06 - s.x) * k;
        s.y += (s.by - s.y) * k;
        s.z += (0.12 - s.z) * k;
      } else {
        const kk = Math.min(1, dt * 4.5);
        s.x += (s.hx - s.x) * kk;
        s.y += (s.hy - s.y) * kk;
        s.z += (PLAY_Z - s.z) * kk;
        if (Math.hypot(s.x - s.hx, s.y - s.hy) < 0.03) s.state = 'loose';
      }
    }
    writeShard(s);
  }

  const goal = shards.length ? placed / shards.length : 0;
  uniforms.uProgress.value += (goal - uniforms.uProgress.value) * Math.min(1, dt * 2.5);
  smileT = done ? Math.min(1, smileT + dt * 0.5) : 0;
  uniforms.uSmile.value = forceSmile ? 1 : smileT * smileT * (3 - 2 * smileT);
  ghostMat.opacity = 0.6 + 0.25 * Math.sin(time * 2.2);
  if (hud) updateHud();
}

// ---------- boot ----------
startLevel();

let last = performance.now();
function tick(now: number) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);

// read-only snapshot for browser tests; no mutation or auto-solve. Shard id === matching slot id.
(window as unknown as Record<string, unknown>).__glassGame = {
  snapshot: () => ({
    seed,
    total: shards.length,
    restored: placed,
    won: done,
    selectedShard,
    attempts,
    wrongAttempts,
    busyMoths: moths.filter((m) => m.state === 'fetch' || m.state === 'carry').length,
    moths: moths.map((m, id) => ({ id, name: m.name, state: m.state, shard: m.job ? m.job.id : -1, screen: toScreen(m.x, m.y) })),
    loose: shards.filter((s) => s.state === 'loose').map((s) => ({ id: s.id, screen: toScreen(s.x, s.y, s.z) })),
    emptySlots: shards.filter((s) => slotOpen(s.id)).map((s) => ({ id: s.id, reserved: slotReserved(s.id), screen: toScreen(s.pane.cx, s.pane.cy, 0) })),
    shards: shards.map((s) => ({ id: s.id, state: s.state, target: s.target, angle: s.angle, screen: toScreen(s.x, s.y, s.z) })),
  }),
};

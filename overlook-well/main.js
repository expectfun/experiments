// The Overlook Well, real-time.
//
// One module of the shaft (stairs and walls with Cycles lighting baked into a
// lightmap, plus the light strips) is repeated above and below the viewer.
// Every module is identical, so the viewer's height simply wraps around one
// module and the fall never ends. The balls replay the paths exported from
// Blender: one loop per flight, after which the whole set of balls has turned
// a quarter turn and carries on, exactly as in the film.
//
// Geometry and paths arrive in Blender's coordinates (Z up) and are converted
// here to three.js's (Y up): (x, y, z) -> (x, z, -y).
import * as THREE from "./vendor/three.module.js";
import { VRButton } from "./vendor/VRButton.js";

// The look, matching scripts/look.py in its dark mood.
const WHITE = [0.85, 0.86, 0.86];
const TEAL = [0.02, 0.3, 0.32];
const FOG = [0.0, 0.025, 0.03];
const STRIP = [0.85 * 6, 0.97 * 6, 1.0 * 6];
const BALL = [1.0 * 1.8, 0.25 * 1.8, 0.01 * 1.8];
const FADE_NEAR = 4;
const FADE_FAR = 70;
const EXPOSURE = 0.65;         // three.js's AgX is gentler than Blender's "Medium High Contrast"
const FILM_FALL_MODULES = 2;   // per loop, as in the film: 24 m in 6 s
const VR_FALL_SPEED = 1.2;     // metres per second when falling in VR: gentle, no turning
const MODULES_EACH_WAY = 7;    // beyond that the fog has swallowed everything

const statusEl = document.getElementById("status");
const hud = document.getElementById("hud");

const [meta, bin, lightmap] = await Promise.all([
  fetch("assets/module.json").then((r) => r.json()),
  fetch("assets/module.bin").then((r) => r.arrayBuffer()),
  new THREE.TextureLoader().loadAsync("assets/lightmap.png"),
]);
const H = meta.moduleHeight;

// ---------- Renderer, scene, viewer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = EXPOSURE;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color().setRGB(...FOG, THREE.LinearSRGBColorSpace);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 400);
const rig = new THREE.Group(); // the viewer's body: it falls; the head (camera) looks
rig.add(camera);
scene.add(rig);

// ---------- Materials: viewer-relative fog, as in the Cycles material ----------
const common = /* glsl */ `
  uniform vec3 fogColor;
  uniform float fadeNear, fadeFar;
  varying float vDist;
  float fade() { return smoothstep(fadeNear, fadeFar, vDist); }
`;
const vertex = /* glsl */ `
  varying float vDist;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
    #endif
    vec4 mv = modelViewMatrix * local;
    vDist = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const fogUniforms = () => ({
  fogColor: { value: new THREE.Vector3(...FOG) },
  fadeNear: { value: FADE_NEAR },
  fadeFar: { value: FADE_FAR },
});

lightmap.colorSpace = THREE.NoColorSpace;
lightmap.anisotropy = renderer.capabilities.getMaxAnisotropy();
const wellMaterial = new THREE.ShaderMaterial({
  uniforms: {
    ...fogUniforms(),
    lightmap: { value: lightmap },
    lightScale: { value: meta.lightScale },
    white: { value: new THREE.Vector3(...WHITE) },
    teal: { value: new THREE.Vector3(...TEAL) },
  },
  vertexShader: vertex,
  fragmentShader: /* glsl */ `
    ${common}
    uniform sampler2D lightmap;
    uniform float lightScale;
    uniform vec3 white, teal;
    varying vec2 vUv;
    void main() {
      float f = fade();
      // White near the viewer, easing to teal by halfway, as the Cycles colour ramp.
      vec3 albedo = mix(white, teal, smoothstep(0.0, 0.5, f));
      vec3 enc = texture2D(lightmap, vUv).rgb;
      vec3 lit = albedo * enc * enc * lightScale;
      gl_FragColor = vec4(mix(lit, fogColor, f), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
const glowMaterial = (rgb) =>
  new THREE.ShaderMaterial({
    uniforms: { ...fogUniforms(), glow: { value: new THREE.Vector3(...rgb) } },
    vertexShader: vertex,
    fragmentShader: /* glsl */ `
      ${common}
      uniform vec3 glow;
      void main() {
        gl_FragColor = vec4(mix(glow, fogColor, fade()), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

// ---------- Geometry: one module, repeated ----------
const toYUp = (src) => {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    out[i] = src[i];
    out[i + 1] = src[i + 2];
    out[i + 2] = -src[i + 1];
  }
  return out;
};
const { bakedVerts, stripVerts } = meta.counts;
let offset = 0;
const take = (n) => {
  const a = new Float32Array(bin, offset, n);
  offset += n * 4;
  return a;
};
const wellGeo = new THREE.BufferGeometry();
wellGeo.setAttribute("position", new THREE.BufferAttribute(toYUp(take(bakedVerts * 3)), 3));
wellGeo.setAttribute("uv", new THREE.BufferAttribute(take(bakedVerts * 2), 2));
const stripGeo = new THREE.BufferGeometry();
stripGeo.setAttribute("position", new THREE.BufferAttribute(toYUp(take(stripVerts * 3)), 3));
wellGeo.computeBoundingSphere();
stripGeo.computeBoundingSphere();

const stripMaterial = glowMaterial(STRIP);
// Beyond the last module: a sphere of pure fog, drawn through the same tone mapping.
scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 16, 8), Object.assign(glowMaterial(FOG), { side: THREE.BackSide })));
rig.add(scene.children.at(-1)); // it travels with the viewer
for (let k = -MODULES_EACH_WAY; k <= MODULES_EACH_WAY; k++) {
  const well = new THREE.Mesh(wellGeo, wellMaterial);
  const strips = new THREE.Mesh(stripGeo, stripMaterial);
  well.position.y = strips.position.y = -k * H;
  scene.add(well, strips);
}

// ---------- Balls ----------
// Each path is one loop (one flight) relative to the ball's module. Its true end is
// where the next loop starts, a quarter turn on and one module up ("up" balls) or
// down ("down" balls); after each loop the whole set turns a quarter anticlockwise.
const ccw = ([x, y, z], n) => {
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) [x, y] = [-y, x];
  return [x, y, z];
};
const cw = (p) => ccw(p, 3);
const balls = meta.balls.map((b) => {
  const [x0, y0, z0] = b.path[0];
  const end = b.way === "up" ? [...ccw([x0, y0, z0], 1).slice(0, 2), z0 + H] : [...cw([x0, y0, z0]).slice(0, 2), z0 - H];
  return { path: [...b.path, end] };
});
const levels = 2 * MODULES_EACH_WAY + 1;
const ballMesh = new THREE.InstancedMesh(
  new THREE.SphereGeometry(meta.ballRadius, 32, 16),
  glowMaterial(BALL),
  balls.length * levels,
);
scene.add(ballMesh);
const loopSeconds = meta.loopFrames / meta.fps;
const m4 = new THREE.Matrix4();

function placeBalls(t) {
  const loop = Math.floor(t / loopSeconds);
  const frame = ((t / loopSeconds) - loop) * meta.loopFrames;
  const i = Math.floor(frame);
  const u = frame - i;
  let n = 0;
  for (const b of balls) {
    const a = b.path[i], c = b.path[i + 1];
    const p = ccw([a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, a[2] + (c[2] - a[2]) * u], loop);
    for (let k = -MODULES_EACH_WAY; k <= MODULES_EACH_WAY; k++) {
      m4.makeTranslation(p[0], p[2] - k * H, -p[1]);
      ballMesh.setMatrixAt(n++, m4);
    }
  }
  ballMesh.instanceMatrix.needsUpdate = true;
}

// ---------- Viewing modes ----------
const state = { mode: "film", falling: true, speed: 1, t: 0, fall: 0 };
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const qDown = new THREE.Quaternion().setFromAxisAngle(X, -Math.PI / 2);
const qSpin = new THREE.Quaternion();
const qLook = qDown.clone(); // camera orientation (in film mode, relative to the film's spin)
const qDeltaY = new THREE.Quaternion();
const qDeltaX = new THREE.Quaternion();
const qDeltaZ = new THREE.Quaternion();
const DRAG_SENS = 0.004;

const buttons = {
  film: document.getElementById("film"),
  free: document.getElementById("free"),
  fall: document.getElementById("fall"),
};
function currentTurn() {
  return (state.t / loopSeconds) * (Math.PI / 2);
}
function setMode(mode) {
  if (mode === "free" && state.mode === "film") {
    // Keep the exact current view when leaving film mode instead of snapping.
    qSpin.setFromAxisAngle(Y, currentTurn());
    qLook.premultiply(qSpin).normalize();
  } else if (mode === "film") {
    // Return to the film's straight-down shot.
    qLook.copy(qDown);
  }
  state.mode = mode;
  buttons.film.setAttribute("aria-pressed", mode === "film");
  buttons.free.setAttribute("aria-pressed", mode === "free");
}
function setFalling(on) {
  state.falling = on;
  buttons.fall.setAttribute("aria-pressed", on);
  buttons.fall.textContent = on ? "Falling" : "Hovering";
}
buttons.film.onclick = () => setMode("film");
buttons.free.onclick = () => setMode("free");
buttons.fall.onclick = () => setFalling(!state.falling);
const speedInput = document.getElementById("speed");
speedInput.oninput = () => (state.speed = Number(speedInput.value));
addEventListener("keydown", (e) => {
  if (e.key === " ") setFalling(!state.falling);
  else if (e.key === "f") setMode("film");
  else if (e.key === "l") setMode("free");
  else if (e.key === "q" || e.key === "e") {
    qDeltaZ.setFromAxisAngle(Z, e.key === "q" ? 0.08 : -0.08);
    qLook.multiply(qDeltaZ).normalize();
  } else return;
  e.preventDefault();
});

// Drag to look, always relative to the camera's own current axes (no fixed "up",
// no pitch clamp). Dragging left/right turns your head horizontally on screen;
// dragging up/down pitches endlessly over the top or bottom.
let drag = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  qDeltaY.setFromAxisAngle(Y, dx * DRAG_SENS);
  qDeltaX.setFromAxisAngle(X, dy * DRAG_SENS);
  qLook.multiply(qDeltaY).multiply(qDeltaX).normalize();
  drag = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener("pointerup", () => (drag = null));

// The controls fade away after a few still seconds, screensaver-style.
let idleTimer;
const wake = () => {
  document.body.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add("idle"), 3000);
};
["pointermove", "pointerdown", "keydown"].forEach((ev) => addEventListener(ev, wake));
wake();

// VR: the headset looks, the trigger switches between hovering and a gentle fall.
const vrButton = VRButton.createButton(renderer);
vrButton.id = "vr";
document.getElementById("vrslot").append(vrButton);
renderer.xr.addEventListener("sessionstart", () => setFalling(false));
for (let i = 0; i < 2; i++) {
  renderer.xr.getController(i).addEventListener("select", () => setFalling(!state.falling));
}

// The film's 18 mm lens: 90 degrees across, whatever the window's shape.
function fit() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(1 / camera.aspect));
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", fit);
fit();

// ---------- Loop ----------
const timer = new THREE.Timer();
window.__well = state; // for testing

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1) * state.speed;
  state.t += dt;
  const inVR = renderer.xr.isPresenting;
  if (state.falling) {
    state.fall += dt * (inVR ? VR_FALL_SPEED : (FILM_FALL_MODULES * H) / loopSeconds);
  }
  rig.position.y = -(state.fall % H);
  placeBalls(state.t);

  if (!inVR) {
    if (state.mode === "film") {
      qSpin.setFromAxisAngle(Y, currentTurn());
      camera.quaternion.copy(qSpin).multiply(qLook);
    } else {
      camera.quaternion.copy(qLook);
    }
  }
  renderer.render(scene, camera);
});
statusEl.remove();

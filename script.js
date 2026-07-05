// ==========================================================
// 3D Keyboard Configurator — Prototype (v2: PBR + Motion)
// Placeholder geometry: Box (base), Cubes/RoundedBoxes (keys),
// Cylinders (switches). Upgraded with HDRI lighting, tuned PBR
// materials, soft grounded shadows, and GSAP camera/color motion.
// ==========================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

// ----------------------------------------------------------
// 1. CONFIG — single source of truth for current selections
// ----------------------------------------------------------
const config = {
  baseColor: "black",
  keyShape: "flat",
  keyColor: "red",
  switchType: "linear",
};

// Color palettes referenced by the UI buttons
const COLORS = {
  base: {
    red: 0xb3392f,
    blue: 0x2f5bb3,
    black: 0x1c1c1e,
  },
  key: {
    red: 0xe0483e,
    green: 0x3ea564,
    blue: 0x3e7de0,
  },
  // Switch color + stem height doubles as a stand-in for "switch feel"
  switch: {
    linear: { color: 0xd6603c, height: 1.0 },
    tactile: { color: 0xdcb63c, height: 1.15 },
    clicky: { color: 0x3ca7dc, height: 1.3 },
  },
};

// ----------------------------------------------------------
// 2. SCENE / CAMERA / RENDERER
// ----------------------------------------------------------
const container = document.getElementById("scene-container");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101114);
scene.fog = new THREE.Fog(0x101114, 20, 45);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(9, 8, 11);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- Renderer color/tone settings for a premium PBR look ---
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

container.appendChild(renderer.domElement);

// ----------------------------------------------------------
// 3. CONTROLS
// ----------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 25;
controls.maxPolarAngle = Math.PI / 2.05; // keep camera from diving below the floor
controls.target.set(0, 0.5, 0);

// ----------------------------------------------------------
// 4. LIGHTING — key/fill directional lights + HDRI environment
// ----------------------------------------------------------
// A soft directional key light still does the heavy lifting for
// grounded, readable shadows; the HDRI supplies realistic ambient
// reflections/fill so we no longer need a flat AmbientLight.
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(8, 12, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 30;
keyLight.shadow.bias = -0.0015;
keyLight.shadow.radius = 4; // softens shadow edges (PCFSoftShadowMap)
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9fc6ff, 0.25);
fillLight.position.set(-6, 4, -8);
scene.add(fillLight);

// --- HDRI environment via RGBELoader + PMREM for PBR reflections ---
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().load(
  "https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr",
  (hdrTexture) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
    scene.environment = envMap; // lights + reflects PBR materials
    // Keep the visible background as our own dark studio color rather
    // than the raw HDRI photo — comment this out if you want the HDRI visible.
    hdrTexture.dispose();
    pmremGenerator.dispose();
  },
  undefined,
  (err) => {
    console.warn("HDRI failed to load — falling back to directional-only lighting.", err);
  }
);

// --- Ground plane, receives the soft contact shadow ---
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.51;
ground.receiveShadow = true;
scene.add(ground);

// ----------------------------------------------------------
// 5. KEYBOARD GROUP — base, keys, switches
// ----------------------------------------------------------
const keyboardGroup = new THREE.Group();
scene.add(keyboardGroup);

// --- Base plate ---
const BASE_WIDTH = 12;
const BASE_DEPTH = 4.5;
const BASE_HEIGHT = 0.6;

const baseGeometry = new THREE.BoxGeometry(BASE_WIDTH, BASE_HEIGHT, BASE_DEPTH);
// Matte-with-a-hint-of-sheen plastic: mid roughness, low metalness.
const baseMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.base[config.baseColor],
  roughness: 0.55,
  metalness: 0.2,
});
const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
baseMesh.position.y = 0;
baseMesh.castShadow = true;
baseMesh.receiveShadow = true;
keyboardGroup.add(baseMesh);

// --- Key / switch grid layout ---
const COLS = 14;
const ROWS = 4;
const SPACING = 0.78;
const KEY_SIZE = 0.62;
const SWITCH_RADIUS = 0.16;

const gridWidth = (COLS - 1) * SPACING;
const gridDepth = (ROWS - 1) * SPACING;

const keyMeshes = [];
const switchMeshes = [];

let keyGeometryFlat = new THREE.BoxGeometry(KEY_SIZE, 0.22, KEY_SIZE);
let keyGeometryRounded = new RoundedBoxGeometry(KEY_SIZE, 0.28, KEY_SIZE, 4, 0.08);

function currentKeyGeometry() {
  return config.keyShape === "rounded" ? keyGeometryRounded : keyGeometryFlat;
}

// Keycap plastic: soft matte finish, near-zero metalness.
const keyMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.key[config.keyColor],
  roughness: 0.6,
  metalness: 0.05,
});

// Switch housing: treated as the "metallic accent" — more reflective.
const switchMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.switch[config.switchType].color,
  roughness: 0.3,
  metalness: 0.6,
});

const switchGeometry = new THREE.CylinderGeometry(
  SWITCH_RADIUS,
  SWITCH_RADIUS,
  1, // base height of 1, scaled per switch type
  16
);

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const x = col * SPACING - gridWidth / 2;
    const z = row * SPACING - gridDepth / 2;

    // Switch: sits on top of the base, partially under the key
    const switchMesh = new THREE.Mesh(switchGeometry, switchMaterial);
    const switchHeight = COLORS.switch[config.switchType].height;
    switchMesh.scale.y = switchHeight * 0.45;
    switchMesh.position.set(x, BASE_HEIGHT / 2 + (switchHeight * 0.45) / 2, z);
    switchMesh.castShadow = true;
    keyboardGroup.add(switchMesh);
    switchMeshes.push(switchMesh);

    // Key: floats above the switch stem
    const keyMesh = new THREE.Mesh(currentKeyGeometry(), keyMaterial);
    keyMesh.position.set(
      x,
      BASE_HEIGHT / 2 + switchHeight * 0.45 + 0.16,
      z
    );
    keyMesh.castShadow = true;
    keyMesh.receiveShadow = true;
    keyboardGroup.add(keyMesh);
    keyMeshes.push(keyMesh);
  }
}

// Slight tilt for a nicer default view of the whole build
keyboardGroup.rotation.y = -0.15;

// ----------------------------------------------------------
// 6. CAMERA FOCUS — reusable GSAP-driven fly-to for any "part"
// ----------------------------------------------------------
// Add new entries here as you add more configurable parts —
// nothing else in the app needs to change.
const FOCUS_VIEWS = {
  overview: {
    position: { x: 9, y: 8, z: 11 },
    target: { x: 0, y: 0.5, z: 0 },
  },
  base: {
    position: { x: 7, y: 5, z: 9 },
    target: { x: 0, y: 0.1, z: 0 },
  },
  keys: {
    position: { x: 3, y: 4.5, z: 6 },
    target: { x: 0, y: 0.6, z: 0 },
  },
  switches: {
    position: { x: 2, y: 2.4, z: 3.2 },
    target: { x: 0, y: 0.5, z: 0 },
  },
};

let focusTween = null; // track the active tween so rapid clicks don't fight each other

/**
 * Smoothly fly the camera + orbit target to a named part's view.
 * Safe to call repeatedly — interrupts any in-flight tween cleanly.
 * @param {keyof typeof FOCUS_VIEWS} part
 */
function focusOn(part) {
  const view = FOCUS_VIEWS[part] || FOCUS_VIEWS.overview;

  if (focusTween) focusTween.kill();

  // Disable damping's own pull while GSAP is driving the camera,
  // so the two easing systems don't fight each other.
  controls.enableDamping = false;

  const tl = gsap.timeline({
    defaults: { duration: 0.9, ease: "power2.out" },
    onComplete: () => {
      controls.enableDamping = true;
    },
  });

  tl.to(camera.position, { ...view.position }, 0);
  tl.to(controls.target, { ...view.target }, 0);

  focusTween = tl;
  return tl;
}

// ----------------------------------------------------------
// 7. COLOR TRANSITIONS — reusable GSAP color tween
// ----------------------------------------------------------
/**
 * Smoothly tween a material's color to a new hex value.
 * @param {THREE.Material} material
 * @param {number} hex
 */
function tweenMaterialColor(material, hex) {
  const target = new THREE.Color(hex);
  gsap.to(material.color, {
    r: target.r,
    g: target.g,
    b: target.b,
    duration: 0.5,
    ease: "power2.out",
  });
}

// ----------------------------------------------------------
// 8. UPDATE FUNCTIONS — driven by UI selections
// ----------------------------------------------------------

/** Update the base plate color (animated) + focus the camera on it. */
function updateBaseColor(value) {
  config.baseColor = value;
  tweenMaterialColor(baseMaterial, COLORS.base[value]);
  focusOn("base");
}

/** Swap every key's geometry between flat and rounded, then focus on keys. */
function updateKeyShape(value) {
  config.keyShape = value;
  const newGeometry = value === "rounded" ? keyGeometryRounded : keyGeometryFlat;
  keyMeshes.forEach((mesh) => {
    mesh.geometry = newGeometry;
  });
  focusOn("keys");
}

/** Update every key's color (animated) + focus the camera on keys. */
function updateKeyColor(value) {
  config.keyColor = value;
  tweenMaterialColor(keyMaterial, COLORS.key[value]);
  focusOn("keys");
}

/** Update every switch's color (animated) + stem height, then focus on switches. */
function updateSwitchType(value) {
  config.switchType = value;
  const { color, height } = COLORS.switch[value];
  tweenMaterialColor(switchMaterial, color);

  switchMeshes.forEach((switchMesh, i) => {
    const scaledHeight = height * 0.45;

    gsap.to(switchMesh.scale, { y: scaledHeight, duration: 0.5, ease: "power2.out" });
    gsap.to(switchMesh.position, {
      y: BASE_HEIGHT / 2 + scaledHeight / 2,
      duration: 0.5,
      ease: "power2.out",
    });

    // Reposition the matching key so it still rests on top of the switch
    const keyMesh = keyMeshes[i];
    gsap.to(keyMesh.position, {
      y: BASE_HEIGHT / 2 + scaledHeight + 0.16,
      duration: 0.5,
      ease: "power2.out",
    });
  });

  focusOn("switches");
}

// ----------------------------------------------------------
// 9. UI WIRING — generic handler for any .button-row group
// ----------------------------------------------------------
const UPDATE_HANDLERS = {
  baseColor: updateBaseColor,
  keyShape: updateKeyShape,
  keyColor: updateKeyColor,
  switchType: updateSwitchType,
};

document.querySelectorAll(".button-row").forEach((row) => {
  const controlName = row.dataset.control;
  const handler = UPDATE_HANDLERS[controlName];
  if (!handler) return;

  row.addEventListener("click", (event) => {
    const btn = event.target.closest(".option-btn");
    if (!btn) return;

    // Toggle active state within this row only
    row.querySelectorAll(".option-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    handler(btn.dataset.value);
  });
});

// ----------------------------------------------------------
// 10. RESIZE HANDLING
// ----------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------------------------------------------------
// 11. RENDER LOOP
// ----------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
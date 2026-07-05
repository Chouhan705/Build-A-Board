// ==========================================================
// 3D Keyboard Configurator — Prototype
// Placeholder geometry: Box (base), Cubes/RoundedBoxes (keys),
// Cylinders (switches). All swapped/recolored via the UI panel.
// ==========================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// ----------------------------------------------------------
// 3. CONTROLS
// ----------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 25;
controls.maxPolarAngle = Math.PI / 2.05; // keep camera from diving below the floor
controls.target.set(0, 0.5, 0);

// ----------------------------------------------------------
// 4. LIGHTING
// ----------------------------------------------------------
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(8, 12, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -12;
keyLight.shadow.camera.right = 12;
keyLight.shadow.camera.top = 12;
keyLight.shadow.camera.bottom = -12;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9fc6ff, 0.35);
fillLight.position.set(-6, 4, -8);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 1 })
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
const baseMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.base[config.baseColor],
  roughness: 0.5,
  metalness: 0.15,
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

const keyMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.key[config.keyColor],
  roughness: 0.4,
  metalness: 0.05,
});

const switchMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.switch[config.switchType].color,
  roughness: 0.35,
  metalness: 0.1,
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
// 6. UPDATE FUNCTIONS — driven by UI selections
// ----------------------------------------------------------

/** Update the base plate color. */
function updateBaseColor(value) {
  config.baseColor = value;
  baseMaterial.color.setHex(COLORS.base[value]);
}

/** Swap every key's geometry between flat and rounded. */
function updateKeyShape(value) {
  config.keyShape = value;
  const newGeometry = currentKeyGeometry.call(null); // resolve after config update
  keyMeshes.forEach((mesh) => {
    mesh.geometry = value === "rounded" ? keyGeometryRounded : keyGeometryFlat;
  });
}

/** Update every key's color. */
function updateKeyColor(value) {
  config.keyColor = value;
  keyMaterial.color.setHex(COLORS.key[value]);
}

/** Update every switch's color + stem height (visual stand-in for switch feel). */
function updateSwitchType(value) {
  config.switchType = value;
  const { color, height } = COLORS.switch[value];
  switchMaterial.color.setHex(color);

  switchMeshes.forEach((switchMesh, i) => {
    const scaledHeight = height * 0.45;
    switchMesh.scale.y = scaledHeight;
    switchMesh.position.y = BASE_HEIGHT / 2 + scaledHeight / 2;

    // Reposition the matching key so it still rests on top of the switch
    const keyMesh = keyMeshes[i];
    keyMesh.position.y = BASE_HEIGHT / 2 + scaledHeight + 0.16;
  });
}

// ----------------------------------------------------------
// 7. UI WIRING — generic handler for any .button-row group
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
// 8. RESIZE HANDLING
// ----------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------------------------------------------------
// 9. RENDER LOOP
// ----------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

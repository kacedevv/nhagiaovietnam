import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// =======================
// KHỞI TẠO SCENE, CAMERA, RENDERER
// =======================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.0015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.position.set(0, 20, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
if (THREE.sRGBEncoding !== undefined && renderer.outputColorSpace === undefined) {
  renderer.outputEncoding = THREE.sRGBEncoding;
} else if (renderer.outputColorSpace !== undefined) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
document.getElementById('container').appendChild(renderer.domElement);

// =======================
// CONTROLS
// =======================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.enabled = false;
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.minDistance = 15;
controls.maxDistance = 300;
controls.zoomSpeed = 0.3;
controls.rotateSpeed = 0.3;
controls.update();

// =======================
// Utility: glow sprite
// =======================
function createGlowMaterial(color, size = 128, opacity = 0.55) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Sprite(material);
}

// =======================
// Base scene elements
// =======================
const centralGlow = createGlowMaterial('rgba(255,255,255,0.8)', 156, 0.25);
centralGlow.scale.set(8, 8, 1);
scene.add(centralGlow);

// nebula clouds
for (let i = 0; i < 15; i++) {
  const hue = Math.random() * 360;
  const color = `hsla(${hue}, 80%, 50%, 0.6)`;
  const nebula = createGlowMaterial(color, 256);
  nebula.scale.set(100, 100, 1);
  nebula.position.set(
    (Math.random() - 0.5) * 175,
    (Math.random() - 0.5) * 175,
    (Math.random() - 0.5) * 175
  );
  scene.add(nebula);
}

// =======================
// GALAXY core points
// =======================
const galaxyParameters = {
  count: 100000,
  arms: 6,
  radius: 100,
  spin: 0.5,
  randomness: 0.2,
  randomnessPower: 20,
  insideColor: new THREE.Color(0xd63ed6),
  outsideColor: new THREE.Color(0x48b8b8),
};

const textureLoader = new THREE.TextureLoader();

// build base galaxy points (background swirl)
const positions = new Float32Array(galaxyParameters.count * 3);
const colors = new Float32Array(galaxyParameters.count * 3);
let pointIdx = 0;
for (let i = 0; i < galaxyParameters.count; i++) {
  const radius = Math.pow(Math.random(), galaxyParameters.randomnessPower) * galaxyParameters.radius;
  const branchAngle = (i % galaxyParameters.arms) / galaxyParameters.arms * Math.PI * 2;
  const spinAngle = radius * galaxyParameters.spin;

  const randomX = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
  const randomY = (Math.random() - 0.5) * galaxyParameters.randomness * radius * 1.2;
  const randomZ = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
  const totalAngle = branchAngle + spinAngle;

  if (radius < 30 && Math.random() < 0.8) continue;

  const i3 = pointIdx * 3;
  positions[i3] = Math.cos(totalAngle) * radius + randomX;
  positions[i3 + 1] = randomY;
  positions[i3 + 2] = Math.sin(totalAngle) * radius + randomZ;

  const mixedColor = new THREE.Color(0xff66ff);
  mixedColor.lerp(new THREE.Color(0x66ffff), radius / galaxyParameters.radius);
  mixedColor.multiplyScalar(0.7 + 0.3 * Math.random());
  colors[i3] = mixedColor.r;
  colors[i3 + 1] = mixedColor.g;
  colors[i3 + 2] = mixedColor.b;

  pointIdx++;
}

const galaxyGeometry = new THREE.BufferGeometry();
galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, pointIdx * 3), 3));
galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, pointIdx * 3), 3));

const galaxyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0.0 },
    uSize: { value: 50.0 * renderer.getPixelRatio() },
    uRippleTime: { value: -1.0 },
    uRippleSpeed: { value: 40.0 },
    uRippleWidth: { value: 20.0 }
  },
  vertexShader: `
        uniform float uSize;
        uniform float uTime;
        uniform float uRippleTime;
        uniform float uRippleSpeed;
        uniform float uRippleWidth;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);
            if (uRippleTime > 0.0) {
                float rippleRadius = (uTime - uRippleTime) * uRippleSpeed;
                float particleDist = length(modelPosition.xyz);
                float strength = 1.0 - smoothstep(rippleRadius - uRippleWidth, rippleRadius + uRippleWidth, particleDist);
                strength *= smoothstep(rippleRadius + uRippleWidth, rippleRadius - uRippleWidth, particleDist);
                if (strength > 0.0) {
                    vColor += vec3(strength * 2.0);
                }
            }
            vec4 viewPosition = viewMatrix * modelPosition;
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = uSize / -viewPosition.z;
        }
    `,
  fragmentShader: `
        varying vec3 vColor;
        void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            gl_FragColor = vec4(vColor, 1.0);
        }
    `,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
  vertexColors: true
});
const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial);
scene.add(galaxy);

// =======================
// Neon texture helper (same as your original)
// =======================
function createNeonTexture(image, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const aspectRatio = image.width / image.height;
  let drawWidth, drawHeight, offsetX, offsetY;
  if (aspectRatio > 1) {
    drawWidth = size;
    drawHeight = size / aspectRatio;
    offsetX = 0;
    offsetY = (size - drawHeight) / 2;
  } else {
    drawHeight = size;
    drawWidth = size * aspectRatio;
    offsetX = (size - drawWidth) / 2;
    offsetY = 0;
  }
  ctx.clearRect(0, 0, size, size);
  const cornerRadius = size * 0.1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(offsetX + cornerRadius, offsetY);
  ctx.lineTo(offsetX + drawWidth - cornerRadius, offsetY);
  ctx.arcTo(offsetX + drawWidth, offsetY, offsetX + drawWidth, offsetY + cornerRadius, cornerRadius);
  ctx.lineTo(offsetX + drawWidth, offsetY + drawHeight - cornerRadius);
  ctx.arcTo(offsetX + drawWidth, offsetY + drawHeight, offsetX + drawWidth - cornerRadius, offsetY + drawHeight, cornerRadius);
  ctx.lineTo(offsetX + cornerRadius, offsetY + drawHeight);
  ctx.arcTo(offsetX, offsetY + drawHeight, offsetX, offsetY + drawHeight - cornerRadius, cornerRadius);
  ctx.lineTo(offsetX, offsetY + cornerRadius);
  ctx.arcTo(offsetX, offsetY, offsetX + cornerRadius, offsetY, cornerRadius);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
  return new THREE.CanvasTexture(canvas);
}

// =======================
// Enhanced heart-images loader (replaces defaultHeartImages-only behavior)
// - manifest fetch
// - progressive batch loading
// - LRU texture cache
// - drag&drop + file input upload
// =======================

const defaultHeartImages = [
  "images/3d618dec-327a-4484-9c71-21b3f254e6be.jpg",
  "images/444ecfd7-55da-4ac8-b78a-ee72d7ef4052.jpg",
  "images/59fce220-46cc-44bc-a602-47ce2878dfec.jpg",
  "images/64addb6f-f854-451e-a558-d3256f7af6ad.jpg",
  "images/9b369934-4974-4e19-ab47-7dc780cbb4b6.jpg",
  "images/a7eb3c92-a985-4e2e-ab2f-0fb49de2ec74.jpg",
  "images/c9a9178f-17ba-4b7e-b17d-62e7ddb80ba3.jpg"
];


// config
const heartLoaderConfig = {
  maxGroupsForScale: 14,
  maxTextureCache: 8,
  batchSize: 2,
  loadDelayMS: 60,
  maxPointsTotal: galaxyParameters.count
};

const manifestUrlsToTry = ['/images/manifest.json', '/manifest.json'];

// tiny LRU for textures
class TextureLRU {
  constructor(limit = 8) {
    this.limit = limit;
    this.map = new Map();
  }
  has(key) { return this.map.has(key); }
  get(key) {
    const v = this.map.get(key);
    if (!v) return null;
    this.map.delete(key);
    this.map.set(key, v);
    return v.texture;
  }
  put(key, texture) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { texture, time: Date.now() });
    this._trim();
  }
  _trim() {
    while (this.map.size > this.limit) {
      const firstKey = this.map.keys().next().value;
      const entry = this.map.get(firstKey);
      if (entry && entry.texture && entry.texture.dispose) {
        try { entry.texture.dispose(); } catch (e) { /* ignore */ }
      }
      this.map.delete(firstKey);
      console.info('LRU disposed texture', firstKey);
    }
  }
  clear() {
    for (const [k, v] of this.map.entries()) {
      try { v.texture.dispose(); } catch (e) {}
    }
    this.map.clear();
  }
}
const textureCache = new TextureLRU(heartLoaderConfig.maxTextureCache);

// try fetch manifest JSON array of image paths
async function tryFetchManifest() {
  for (const url of manifestUrlsToTry) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        console.info('Loaded image manifest from', url);
        return data;
      }
    } catch (e) { /* ignore */ }
  }
  return [];
}

async function buildHeartImageList() {
  let arr = [];
  if (window.dataCCD && window.dataCCD.data && Array.isArray(window.dataCCD.data.heartImages) && window.dataCCD.data.heartImages.length) {
    arr = [...window.dataCCD.data.heartImages];
    console.info('Using heartImages from window.dataCCD.data.heartImages');
  }
  if (arr.length === 0) {
    const manifest = await tryFetchManifest();
    if (manifest.length) {
      arr = manifest.map(p => p);
      console.info('Using manifest for heartImages, count =', arr.length);
    }
  }
  if (arr.length === 0) {
    arr = [...defaultHeartImages];
    console.info('Using defaultHeartImages, count =', arr.length);
  }
  arr = Array.from(new Set(arr)).filter(Boolean);
  return arr;
}

// ===== Add drift-control variables and defaults =====
// heartDriftSpeed controls the speed of vertical oscillation of heart-image groups.
// Range exposed in UI will be 0.0 .. 3.0 (0 = static)
let heartDriftSpeed = 0.6; // default speed
// =====================================================================

// create heart groups progressively
async function createHeartGroupsFromImages(heartImages) {
  const numGroups = heartImages.length;
  const maxDensity = 50000;
  const minDensity = 2000;
  const maxGroupsForScale = heartLoaderConfig.maxGroupsForScale;
  let pointsPerGroup;
  if (numGroups <= 1) pointsPerGroup = maxDensity;
  else if (numGroups >= maxGroupsForScale) pointsPerGroup = minDensity;
  else {
    const t = (numGroups - 1) / (maxGroupsForScale - 1);
    pointsPerGroup = Math.floor(maxDensity * (1 - t) + minDensity * t);
  }
  if (pointsPerGroup * numGroups > heartLoaderConfig.maxPointsTotal) {
    pointsPerGroup = Math.floor(heartLoaderConfig.maxPointsTotal / Math.max(1, numGroups));
  }
  console.info(`Số lượng ảnh: ${numGroups}, Điểm mỗi ảnh: ${pointsPerGroup}`);

  for (let g = 0; g < numGroups; g += heartLoaderConfig.batchSize) {
    const batch = heartImages.slice(g, g + heartLoaderConfig.batchSize);
    const promises = batch.map((imgSrc, idxInBatch) => new Promise(resolve => {
      const group = g + idxInBatch;
      const groupPositions = new Float32Array(pointsPerGroup * 3);
      const groupColorsNear = new Float32Array(pointsPerGroup * 3);
      const groupColorsFar = new Float32Array(pointsPerGroup * 3);
      let validPointCount = 0;

      for (let i = 0; i < pointsPerGroup; i++) {
        const idx = validPointCount * 3;
        const globalIdx = group * pointsPerGroup + i;
        const radius = Math.pow(Math.random(), galaxyParameters.randomnessPower) * galaxyParameters.radius;
        if (radius < 30) continue;

        const branchAngle = (globalIdx % galaxyParameters.arms) / galaxyParameters.arms * Math.PI * 2;
        const spinAngle = radius * galaxyParameters.spin;

        const randomX = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
        const randomY = (Math.random() - 0.5) * galaxyParameters.randomness * radius * 0.5;
        const randomZ = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
        const totalAngle = branchAngle + spinAngle;

        groupPositions[idx] = Math.cos(totalAngle) * radius + randomX;
        groupPositions[idx + 1] = randomY;
        groupPositions[idx + 2] = Math.sin(totalAngle) * radius + randomZ;

        const colorNear = new THREE.Color(0xffffff);
        groupColorsNear[idx] = colorNear.r;
        groupColorsNear[idx + 1] = colorNear.g;
        groupColorsNear[idx + 2] = colorNear.b;

        const colorFar = galaxyParameters.insideColor.clone();
        colorFar.lerp(galaxyParameters.outsideColor, radius / galaxyParameters.radius);
        colorFar.multiplyScalar(0.7 + 0.3 * Math.random());
        groupColorsFar[idx] = colorFar.r;
        groupColorsFar[idx + 1] = colorFar.g;
        groupColorsFar[idx + 2] = colorFar.b;

        validPointCount++;
      }

      if (validPointCount === 0) {
        console.warn('Group generated 0 points, skipping group', group);
        resolve(null);
        return;
      }

      const groupGeometryNear = new THREE.BufferGeometry();
      groupGeometryNear.setAttribute('position', new THREE.BufferAttribute(groupPositions.slice(0, validPointCount * 3), 3));
      groupGeometryNear.setAttribute('color', new THREE.BufferAttribute(groupColorsNear.slice(0, validPointCount * 3), 3));

      const groupGeometryFar = new THREE.BufferGeometry();
      groupGeometryFar.setAttribute('position', new THREE.BufferAttribute(groupPositions.slice(0, validPointCount * 3), 3));
      groupGeometryFar.setAttribute('color', new THREE.BufferAttribute(groupColorsFar.slice(0, validPointCount * 3), 3));

      // centroid
      const posAttr = groupGeometryFar.getAttribute('position');
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < posAttr.count; i++) {
        cx += posAttr.getX(i);
        cy += posAttr.getY(i);
        cz += posAttr.getZ(i);
      }
      cx /= posAttr.count;
      cy /= posAttr.count;
      cz /= posAttr.count;
      groupGeometryNear.translate(-cx, -cy, -cz);
      groupGeometryFar.translate(-cx, -cy, -cz);

      // placeholder points (so scene isn't empty while texture loads)
      const placeholderMaterial = new THREE.PointsMaterial({
        size: 1.6,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        vertexColors: true,
        depthWrite: false
      });
      const pointsObject = new THREE.Points(groupGeometryFar, placeholderMaterial);
      pointsObject.position.set(cx, cy, cz);
      pointsObject.userData = {
        materialNear: null,
        materialFar: null,
        geometryNear: groupGeometryNear,
        geometryFar: groupGeometryFar,
        src: imgSrc,
        cx, cy, cz,
        baseY: cy,
        // add drift params for this group (used by drift-speed control)
        driftPhase: Math.random() * Math.PI * 2,
        driftAmplitude: 0.6 + Math.random() * 1.6
      };
      scene.add(pointsObject);

      // load image
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = imgSrc;
      img.onload = () => {
        try {
          const neonTexture = createNeonTexture(img, 256);
          textureCache.put(imgSrc, neonTexture);

          const materialNear = new THREE.PointsMaterial({
            size: 1.8,
            map: neonTexture,
            transparent: false,
            alphaTest: 0.2,
            depthWrite: true,
            depthTest: true,
            blending: THREE.NormalBlending,
            vertexColors: true
          });

          const materialFar = new THREE.PointsMaterial({
            size: 1.8,
            map: neonTexture,
            transparent: true,
            alphaTest: 0.2,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true
          });

          pointsObject.userData.materialNear = materialNear;
          pointsObject.userData.materialFar = materialFar;
          pointsObject.material = materialFar;
          resolve(pointsObject);
        } catch (err) {
          console.error('Failed to create neon texture for', imgSrc, err);
          resolve(pointsObject);
        }
      };
      img.onerror = (e) => {
        console.warn('Failed to load heart image', imgSrc, e);
        resolve(pointsObject);
      };
    }));

    try {
      await Promise.all(promises);
    } catch (e) {
      console.warn('Batch load error', e);
    }
    // yield to main thread
    await new Promise(r => setTimeout(r, heartLoaderConfig.loadDelayMS));
  }
}

// upload UI (file input + drag-drop)
function createUploadControls() {
  const controlWrap = document.createElement('div');
  controlWrap.style.position = 'fixed';
  controlWrap.style.left = '12px';
  controlWrap.style.bottom = '12px';
  controlWrap.style.zIndex = 9999;
  controlWrap.style.display = 'flex';
  controlWrap.style.gap = '8px';
  document.body.appendChild(controlWrap);

  const btn = document.createElement('button');
  btn.innerText = 'Add Heart Images';
  btn.style.padding = '8px 12px';
  btn.style.borderRadius = '8px';
  btn.style.border = 'none';
  btn.style.background = 'rgba(255,255,255,0.08)';
  btn.style.color = 'white';
  btn.style.backdropFilter = 'blur(6px)';
  btn.style.cursor = 'pointer';
  controlWrap.appendChild(btn);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files);
    if (!files || !files.length) return;
    const urls = files.map(f => URL.createObjectURL(f));
    if (!window.dataCCD) window.dataCCD = { data: {} };
    if (!window.dataCCD.data.heartImages) window.dataCCD.data.heartImages = [];
    window.dataCCD.data.heartImages.push(...urls);
    console.info('User uploaded images, appended to heartImages', urls);
    await createHeartGroupsFromImages(urls);
  });

  const containerEl = document.getElementById('container') || document.body;
  containerEl.addEventListener('dragover', (e) => { e.preventDefault(); });
  containerEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    const urls = files.map(f => URL.createObjectURL(f));
    if (!window.dataCCD) window.dataCCD = { data: {} };
    if (!window.dataCCD.data.heartImages) window.dataCCD.data.heartImages = [];
    window.dataCCD.data.heartImages.push(...urls);
    console.info('User dropped images, appended to heartImages', urls);
    await createHeartGroupsFromImages(urls);
  });
}

// ========= Drift control UI =========
// Adds a slider + preset buttons to control heart image drift speed
function createDriftControlUI() {
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.left = '12px';
  wrap.style.bottom = '72px';
  wrap.style.zIndex = 9999;
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '8px';
  wrap.style.padding = '8px';
  wrap.style.borderRadius = '10px';
  wrap.style.background = 'rgba(0,0,0,0.35)';
  wrap.style.backdropFilter = 'blur(6px)';
  wrap.style.color = 'white';
  wrap.style.fontFamily = 'sans-serif';
  document.body.appendChild(wrap);

  const title = document.createElement('div');
  title.innerText = 'Tốc độ trôi ảnh';
  title.style.fontSize = '13px';
  title.style.opacity = '0.9';
  wrap.appendChild(title);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  wrap.appendChild(row);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '3';
  slider.step = '0.01';
  slider.value = String(heartDriftSpeed);
  slider.style.width = '160px';
  row.appendChild(slider);

  const valLabel = document.createElement('div');
  valLabel.innerText = heartDriftSpeed.toFixed(2);
  valLabel.style.minWidth = '44px';
  valLabel.style.textAlign = 'center';
  valLabel.style.fontSize = '13px';
  row.appendChild(valLabel);

  const presets = document.createElement('div');
  presets.style.display = 'flex';
  presets.style.gap = '6px';
  presets.style.marginTop = '6px';
  wrap.appendChild(presets);

  ['0 (stop)', '0.4', '0.8', '1.6', '3.0'].forEach(p => {
    const b = document.createElement('button');
    b.innerText = p;
    b.style.padding = '6px 8px';
    b.style.borderRadius = '6px';
    b.style.border = 'none';
    b.style.background = 'rgba(255,255,255,0.06)';
    b.style.color = 'white';
    b.style.cursor = 'pointer';
    b.style.fontSize = '12px';
    presets.appendChild(b);
    b.addEventListener('click', () => {
      const v = parseFloat(p.split(' ')[0]);
      heartDriftSpeed = v;
      slider.value = String(v);
      valLabel.innerText = v.toFixed(2);
    });
  });

  slider.addEventListener('input', (e) => {
    const v = parseFloat(slider.value);
    heartDriftSpeed = v;
    valLabel.innerText = v.toFixed(2);
  });
}

// init heart flow
(async function initHeartImagesFlow() {
  try {
    createUploadControls();
    createDriftControlUI(); // create drift UI (user requested)
    const list = await buildHeartImageList();
    window._heartImageList = list;
    await createHeartGroupsFromImages(list);
    console.info('Finished creating heart groups for', list.length, 'images');
  } catch (err) {
    console.error('Error initializing heart images', err);
  }
})();

// =======================
// Ambient and starfield
// =======================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const starCount = 20000;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 900;
  starPositions[i * 3 + 1] = (Math.random() - 0.5) * 900;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 900;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.7,
  transparent: true,
  opacity: 0.7,
  depthWrite: false
});
const starField = new THREE.Points(starGeometry, starMaterial);
starField.name = 'starfield';
starField.renderOrder = 999;
scene.add(starField);

// =======================
// Shooting stars & helpers (kept from original, cleaned)
// =======================
let shootingStars = [];

function createRandomCurve() {
  const startPoint = new THREE.Vector3(-200 + Math.random() * 100, -100 + Math.random() * 200, -100 + Math.random() * 200);
  const endPoint = new THREE.Vector3(600 + Math.random() * 200, startPoint.y + (-100 + Math.random() * 200), startPoint.z + (-100 + Math.random() * 200));
  const controlPoint1 = new THREE.Vector3(startPoint.x + 200 + Math.random() * 100, startPoint.y + (-50 + Math.random() * 100), startPoint.z + (-50 + Math.random() * 100));
  const controlPoint2 = new THREE.Vector3(endPoint.x - 200 + Math.random() * 100, endPoint.y + (-50 + Math.random() * 100), endPoint.z + (-50 + Math.random() * 100));
  return new THREE.CubicBezierCurve3(startPoint, controlPoint1, controlPoint2, endPoint);
}

function createShootingStar() {
  const trailLength = 100;
  const headGeometry = new THREE.SphereGeometry(2, 32, 32);
  const headMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);

  const glowGeometry = new THREE.SphereGeometry(3, 32, 32);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            varying vec3 vNormal;
            uniform float time;
            void main() {
                float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(1.0, 1.0, 1.0, intensity * (0.8 + sin(time * 5.0) * 0.2));
            }
        `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  head.add(glow);

  const curve = createRandomCurve();
  const trailPoints = [];
  for (let i = 0; i < trailLength; i++) {
    const progress = i / (trailLength - 1);
    trailPoints.push(curve.getPoint(progress));
  }
  const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0x99eaff,
    transparent: true,
    opacity: 0.7,
    linewidth: 2
  });
  const trail = new THREE.Line(trailGeometry, trailMaterial);

  const shootingStarGroup = new THREE.Group();
  shootingStarGroup.add(head);
  shootingStarGroup.add(trail);
  shootingStarGroup.userData = {
    curve,
    progress: 0,
    speed: 0.001 + Math.random() * 0.001,
    life: 0,
    maxLife: 300,
    head,
    trail,
    trailLength,
    trailPoints
  };
  scene.add(shootingStarGroup);
  shootingStars.push(shootingStarGroup);
}

// =======================
// Planet + shaders (kept from original)
// =======================
function createPlanetTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, size / 8, size / 2, size / 2, size / 2);
  gradient.addColorStop(0.00, '#f8bbd0');
  gradient.addColorStop(0.12, '#f48fb1');
  gradient.addColorStop(0.22, '#f06292');
  gradient.addColorStop(0.35, '#ffffff');
  gradient.addColorStop(0.50, '#e1aaff');
  gradient.addColorStop(0.62, '#a259f7');
  gradient.addColorStop(0.75, '#b2ff59');
  gradient.addColorStop(1.00, '#3fd8c7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const spotColors = ['#f8bbd0', '#f8bbd0', '#f48fb1', '#f48fb1', '#f06292', '#f06292', '#ffffff', '#e1aaff', '#a259f7', '#b2ff59'];
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 30 + Math.random() * 120;
    const color = spotColors[Math.floor(Math.random() * spotColors.length)];
    const spotGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spotGradient.addColorStop(0, color + 'cc');
    spotGradient.addColorStop(1, color + '00');
    ctx.fillStyle = spotGradient;
    ctx.fillRect(0, 0, size, size);
  }

  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.bezierCurveTo(Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size);
    ctx.strokeStyle = 'rgba(180, 120, 200, ' + (0.12 + Math.random() * 0.18) + ')';
    ctx.lineWidth = 8 + Math.random() * 18;
    ctx.stroke();
  }

  if (ctx.filter !== undefined) {
    ctx.filter = 'blur(2px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }

  return new THREE.CanvasTexture(canvas);
}

const stormShader = {
  uniforms: {
    time: { value: 0.0 },
    baseTexture: { value: null }
  },
  vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
  fragmentShader: `
        uniform float time;
        uniform sampler2D baseTexture;
        varying vec2 vUv;
        void main() {
            vec2 uv = vUv;
            float angle = length(uv - vec2(0.5)) * 3.0;
            float twist = sin(angle * 3.0 + time) * 0.1;
            uv.x += twist * sin(time * 0.5);
            uv.y += twist * cos(time * 0.5);
            vec4 texColor = texture2D(baseTexture, uv);
            float noise = sin(uv.x * 10.0 + time) * sin(uv.y * 10.0 + time) * 0.1;
            texColor.rgb += noise * vec3(0.8, 0.4, 0.2);
            gl_FragColor = texColor;
        }
    `
};

const planetRadius = 10;
const planetGeometry = new THREE.SphereGeometry(planetRadius, 48, 48);
const planetTexture = createPlanetTexture();
const planetMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0.0 },
    baseTexture: { value: planetTexture }
  },
  vertexShader: stormShader.vertexShader,
  fragmentShader: stormShader.fragmentShader
});
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.position.set(0, 0, 0);
scene.add(planet);

// attach atmosphere used earlier in shooting star (the original code referenced planet variable)
const atmosphereGeometry = new THREE.SphereGeometry(planetRadius * 1.05, 48, 48);
const atmosphereMaterial = new THREE.ShaderMaterial({
  uniforms: { glowColor: { value: new THREE.Color(0xe0b3ff) } },
  vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
  fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            gl_FragColor = vec4(glowColor, 1.0) * intensity;
        }
    `,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true
});
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
planet.add(atmosphere);

// =======================
// Text rings (kept original but small fixes for fonts & measure)
// =======================
const ringTexts = [
  'Chúc Mừng Ngày Nhà Giáo Việt Nam',
  "Ước Gì 9I Bớt Đẳng Cấp",
  "Giáo Viên Phạm Như Quỳnh",
  "Tập Thể 9I",
  ...(window.dataCCD && window.dataCCD.data.ringTexts ? window.dataCCD.data.ringTexts : [])
];

function createTextRings() {
  const numRings = ringTexts.length;
  const baseRingRadius = planetRadius * 1.1;
  const ringSpacing = 5;
  window.textRings = [];

  for (let i = 0; i < numRings; i++) {
    const text = ringTexts[i % ringTexts.length] + '   ';
    const ringRadius = baseRingRadius + i * ringSpacing;

    function getCharType(char) {
      const charCode = char.charCodeAt(0);
      if ((charCode >= 0x4E00 && charCode <= 0x9FFF) ||
        (charCode >= 0x3040 && charCode <= 0x309F) ||
        (charCode >= 0x30A0 && charCode <= 0x30FF) ||
        (charCode >= 0xAC00 && charCode <= 0xD7AF)) {
        return 'cjk';
      } else if (charCode >= 0 && charCode <= 0x7F) {
        return 'latin';
      }
      return 'other';
    }

    let charCounts = { cjk: 0, latin: 0, other: 0 };
    for (let char of text) {
      charCounts[getCharType(char)]++;
    }

    let scaleParams = { fontScale: 0.75, spacingScale: 1.1 };
    if (i === 0) { scaleParams.fontScale = 0.55; scaleParams.spacingScale = 0.9; }
    else if (i === 1) { scaleParams.fontScale = 0.65; scaleParams.spacingScale = 1.0; }
    if (charCounts.cjk > 0) { scaleParams.fontScale *= 0.9; scaleParams.spacingScale *= 1.1; }

    // draw dynamic texture
    const textureHeight = 150;
    const fontSize = Math.max(130, 0.8 * textureHeight);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `bold ${fontSize}px Arial, sans-serif`;
    let singleText = ringTexts[i % ringTexts.length];
    const separator = '   ';
    let repeatedTextSegment = singleText + separator;
    let segmentWidth = tempCtx.measureText(repeatedTextSegment).width || 200;
    let textureWidthCircumference = 2 * Math.PI * ringRadius * 180;
    let repeatCount = Math.ceil(textureWidthCircumference / segmentWidth);
    let fullText = '';
    for (let j = 0; j < repeatCount; j++) fullText += repeatedTextSegment;
    let finalTextureWidth = segmentWidth * repeatCount;
    if (finalTextureWidth < 1 || !fullText) { fullText = repeatedTextSegment; finalTextureWidth = segmentWidth; }

    const textCanvas = document.createElement('canvas');
    textCanvas.width = Math.ceil(Math.max(1, finalTextureWidth));
    textCanvas.height = textureHeight;
    const ctx = textCanvas.getContext('2d');
    ctx.clearRect(0, 0, textCanvas.width, textureHeight);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = '#e0b3ff';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#fff';
    ctx.strokeText(fullText, 0, textureHeight * 0.82);
    ctx.shadowColor = '#ffb3de';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff';
    ctx.fillText(fullText, 0, textureHeight * 0.84);

    const ringTexture = new THREE.CanvasTexture(textCanvas);
    ringTexture.wrapS = THREE.RepeatWrapping;
    ringTexture.repeat.x = finalTextureWidth / (textureWidthCircumference || finalTextureWidth);
    ringTexture.needsUpdate = true;

    const ringGeometry = new THREE.CylinderGeometry(ringRadius, ringRadius, 1, 128, 1, true);
    const ringMaterial = new THREE.MeshBasicMaterial({
      map: ringTexture,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.01,
      opacity: 1,
      depthWrite: false,
    });

    const textRingMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    textRingMesh.position.set(0, 0, 0);
    textRingMesh.rotation.y = Math.PI / 2;

    const ringGroup = new THREE.Group();
    ringGroup.add(textRingMesh);
    ringGroup.userData = {
      ringRadius: ringRadius,
      angleOffset: 0.15 * Math.PI * 0.5,
      speed: 0.002 + 0.00025,
      tiltSpeed: 0, rollSpeed: 0, pitchSpeed: 0,
      tiltAmplitude: Math.PI / 3, rollAmplitude: Math.PI / 6, pitchAmplitude: Math.PI / 8,
      tiltPhase: Math.PI * 2, rollPhase: Math.PI * 2, pitchPhase: Math.PI * 2,
      isTextRing: true
    };

    const initialRotationX = i / numRings * (Math.PI / 1);
    ringGroup.rotation.x = initialRotationX;
    scene.add(ringGroup);
    window.textRings.push(ringGroup);
  }
}
createTextRings();

function updateTextRingsRotation() {
  if (!window.textRings || !camera) return;
  window.textRings.forEach((ringGroup) => {
    ringGroup.children.forEach(child => {
      if (child.userData.initialAngle !== undefined) {
        const angle = child.userData.initialAngle + ringGroup.userData.angleOffset;
        const x = Math.cos(angle) * child.userData.ringRadius;
        const z = Math.sin(angle) * child.userData.ringRadius;
        child.position.set(x, 0, z);
        const worldPos = new THREE.Vector3();
        child.getWorldPosition(worldPos);
        const lookAtVector = new THREE.Vector3().subVectors(camera.position, worldPos).normalize();
        const rotationY = Math.atan2(lookAtVector.x, lookAtVector.z);
        child.rotation.y = rotationY;
      }
    });
  });
}

function animatePlanetSystem() {
  if (window.textRings) {
    const time = Date.now() * 0.001;
    window.textRings.forEach((ringGroup, index) => {
      const userData = ringGroup.userData;
      userData.angleOffset += userData.speed;
      const tilt = Math.sin(time * userData.tiltSpeed + userData.tiltPhase) * userData.tiltAmplitude;
      const roll = Math.cos(time * userData.rollSpeed + userData.rollPhase) * userData.rollAmplitude;
      const pitch = Math.sin(time * userData.pitchSpeed + userData.pitchPhase) * userData.pitchAmplitude;
      ringGroup.rotation.x = (index / window.textRings.length) * (Math.PI / 1) + tilt;
      ringGroup.rotation.z = roll;
      ringGroup.rotation.y = userData.angleOffset + pitch;
      const verticalBob = Math.sin(time * (userData.tiltSpeed * 0.7) + userData.tiltPhase) * 0.3;
      ringGroup.position.y = verticalBob;
      const pulse = (Math.sin(time * 1.5 + index) + 1) / 2;
      const textMesh = ringGroup.children[0];
      if (textMesh && textMesh.material) {
        textMesh.material.opacity = 0.7 + pulse * 0.3;
      }
    });
    updateTextRingsRotation();
  }
}

// =======================
// Music playlist manager (shuffle -> sequential -> reshuffle when finished)
// =======================
let galaxyAudio = null;
let playlist = [
  "https://files.catbox.moe/ny852l.mp3",
  "https://files.catbox.moe/esn6jf.mp3"
  // thêm URL tại đây nếu cần
];

let playOrder = [];
let currentTrackIndex = 0;
let isPlaylistReady = false;
let defaultVolume = 1.0;

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPlayOrder() {
  playOrder = playlist.map((_, i) => i);
  shuffleArray(playOrder);
  currentTrackIndex = 0;
  isPlaylistReady = playOrder.length > 0;
}

function setupGalaxyAudio() {
  if (galaxyAudio) return;
  galaxyAudio = new Audio();
  galaxyAudio.preload = "auto";
  galaxyAudio.crossOrigin = "anonymous";
  galaxyAudio.volume = defaultVolume;
  galaxyAudio.addEventListener('ended', onTrackEnded);
  galaxyAudio.addEventListener('error', (e) => {
    console.warn('Galaxy audio error', e);
    setTimeout(() => skipToNext(), 200);
  });
}

function onTrackEnded() {
  currentTrackIndex++;
  if (currentTrackIndex >= playOrder.length) {
    buildPlayOrder();
  }
  playCurrentTrack();
}

function playCurrentTrack() {
  if (!isPlaylistReady || playOrder.length === 0) return;
  setupGalaxyAudio();
  const trackIdx = playOrder[currentTrackIndex];
  const src = playlist[trackIdx];
  if (!src) return;
  if (galaxyAudio.src && galaxyAudio.src.indexOf(src) !== -1) {
    galaxyAudio.play().catch(err => console.warn('Play blocked:', err));
    return;
  }
  galaxyAudio.src = src;
  galaxyAudio.load();
  galaxyAudio.play().catch(err => {
    console.warn('Play blocked or delayed:', err);
  });
}

function startPlaylist() {
  if (!playlist || playlist.length === 0) return;
  buildPlayOrder();
  setupGalaxyAudio();
  playCurrentTrack();
}

function skipToNext() {
  if (!playOrder || playOrder.length === 0) return;
  currentTrackIndex++;
  if (currentTrackIndex >= playOrder.length) {
    buildPlayOrder();
  }
  playCurrentTrack();
}

function skipToPrev() {
  if (!playOrder || playOrder.length === 0) return;
  currentTrackIndex = Math.max(0, currentTrackIndex - 1);
  playCurrentTrack();
}

function setPlaylistVolume(v) {
  defaultVolume = Math.max(0, Math.min(1, v));
  if (galaxyAudio) galaxyAudio.volume = defaultVolume;
}

window.galaxyMusic = {
  startPlaylist,
  skipToNext,
  skipToPrev,
  setPlaylistVolume,
  playlist,
  rebuildOrder: buildPlayOrder
};

// backward-compatible alias if other code calls playGalaxyAudio()
const playGalaxyAudio = startPlaylist;

// =======================
// Hint icon & text (kept)
// =======================
let fadeOpacity = 0.1;
let fadeInProgress = false;
let hintIcon;
let hintText;

function createHintIcon() {
  hintIcon = new THREE.Group();
  hintIcon.name = 'hint-icon-group';
  scene.add(hintIcon);

  const cursorVisuals = new THREE.Group();
  const cursorShape = new THREE.Shape();
  const h = 1.5;
  const w = h * 0.5;
  cursorShape.moveTo(0, 0);
  cursorShape.lineTo(-w * 0.4, -h * 0.7);
  cursorShape.lineTo(-w * 0.25, -h * 0.7);
  cursorShape.lineTo(-w * 0.5, -h);
  cursorShape.lineTo(w * 0.5, -h);
  cursorShape.lineTo(w * 0.25, -h * 0.7);
  cursorShape.lineTo(w * 0.4, -h * 0.7);
  cursorShape.closePath();

  const backgroundGeometry = new THREE.ShapeGeometry(cursorShape);
  const backgroundMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  });
  const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
  const foregroundGeometry = new THREE.ShapeGeometry(cursorShape);
  const foregroundMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide
  });
  const foregroundMesh = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
  foregroundMesh.scale.set(0.8, 0.8, 1);
  foregroundMesh.position.z = 0.01;
  cursorVisuals.add(backgroundMesh, foregroundMesh);
  cursorVisuals.position.y = h / 2;
  cursorVisuals.rotation.x = Math.PI / 2;

  const ringGeometry = new THREE.RingGeometry(1.8, 2.0, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = Math.PI / 2;
  hintIcon.userData.ringMesh = ringMesh;

  hintIcon.add(cursorVisuals);
  hintIcon.add(ringMesh);

  hintIcon.position.set(1.5, 1.5, 15);
  hintIcon.scale.set(0.8, 0.8, 0.8);
  hintIcon.lookAt(planet.position);
  hintIcon.userData.initialPosition = hintIcon.position.clone();
}

function animateHintIcon(time) {
  if (!hintIcon) return;
  if (!introStarted) {
    hintIcon.visible = true;
    const tapFrequency = 2.5;
    const tapAmplitude = 1.5;
    const tapOffset = Math.sin(time * tapFrequency) * tapAmplitude;
    const direction = new THREE.Vector3();
    hintIcon.getWorldDirection(direction);
    hintIcon.position.copy(hintIcon.userData.initialPosition).addScaledVector(direction, -tapOffset);
    const ring = hintIcon.userData.ringMesh;
    const ringScale = 1 + Math.sin(time * tapFrequency) * 0.1;
    ring.scale.set(ringScale, ringScale, 1);
    ring.material.opacity = 0.5 + Math.sin(time * tapFrequency) * 0.2;
    if (hintText) {
      hintText.visible = true;
      hintText.material.opacity = 0.7 + Math.sin(time * 3) * 0.3;
      hintText.position.y = 15 + Math.sin(time * 2) * 0.5;
      hintText.lookAt(camera.position);
    }
  } else {
    if (hintIcon) hintIcon.visible = false;
    if (hintText) hintText.visible = false;
  }
}

function createHintText() {
  const canvasSize = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = canvasSize;
  const context = canvas.getContext('2d');
  const fontSize = 50;
  const text = 'Chạm Vào Tinh Cầu';
  context.font = `bold ${fontSize}px Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = '#ffb3de';
  context.shadowBlur = 5;
  context.lineWidth = 2;
  context.strokeStyle = 'rgba(255, 200, 220, 0.8)';
  context.strokeText(text, canvasSize / 2, canvasSize / 2);
  context.shadowColor = '#e0b3ff';
  context.shadowBlur = 5;
  context.lineWidth = 2;
  context.strokeStyle = 'rgba(220, 180, 255, 0.5)';
  context.strokeText(text, canvasSize / 2, canvasSize / 2);
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.fillStyle = 'white';
  context.fillText(text, canvasSize / 2, canvasSize / 2);
  const textTexture = new THREE.CanvasTexture(canvas);
  textTexture.needsUpdate = true;
  const textMaterial = new THREE.MeshBasicMaterial({
    map: textTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  const planeGeometry = new THREE.PlaneGeometry(16, 8);
  hintText = new THREE.Mesh(planeGeometry, textMaterial);
  hintText.position.set(0, 15, 0);
  scene.add(hintText);
}

// =======================
// Animation loop & interactions
// =======================
let introStarted = false;

function startCameraAnimation() {
  const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const midPos1 = { x: startPos.x, y: 0, z: startPos.z };
  const midPos2 = { x: startPos.x, y: 0, z: 160 };
  const endPos = { x: -40, y: 100, z: 100 };
  const duration1 = 0.2, duration2 = 0.55, duration3 = 0.4;
  let progress = 0;
  function animatePath() {
    progress += 0.0025;
    let newPos;
    if (progress < duration1) {
      let t = progress / duration1;
      newPos = {
        x: startPos.x + (midPos1.x - startPos.x) * t,
        y: startPos.y + (midPos1.y - startPos.y) * t,
        z: startPos.z + (midPos1.z - startPos.z) * t,
      };
    } else if (progress < duration1 + duration2) {
      let t = (progress - duration1) / duration2;
      newPos = {
        x: midPos1.x + (midPos2.x - midPos1.x) * t,
        y: midPos1.y + (midPos2.y - midPos1.y) * t,
        z: midPos1.z + (midPos2.z - midPos1.z) * t,
      };
    } else if (progress < duration1 + duration2 + duration3) {
      let t = (progress - duration1 - duration2) / duration3;
      let easedT = 0.5 - 0.5 * Math.cos(Math.PI * t);
      newPos = {
        x: midPos2.x + (endPos.x - midPos2.x) * easedT,
        y: midPos2.y + (endPos.y - midPos2.y) * easedT,
        z: midPos2.z + (endPos.z - midPos2.z) * easedT,
      };
    } else {
      camera.position.set(endPos.x, endPos.y, endPos.z);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
      controls.enabled = true;
      return;
    }
    camera.position.set(newPos.x, newPos.y, newPos.z);
    camera.lookAt(0, 0, 0);
    requestAnimationFrame(animatePath);
  }
  controls.enabled = false;
  animatePath();
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const originalStarCount = starGeometry.getAttribute('position').count;
if (starField && starField.geometry) {
  starField.geometry.setDrawRange(0, Math.floor(originalStarCount * 0.1));
}

function requestFullScreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) elem.requestFullscreen();
  else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
  else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
  else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
}

function onCanvasClick(event) {
  if (introStarted) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(planet);
  if (intersects.length > 0) {
    requestFullScreen();
    introStarted = true;
    fadeInProgress = true;
    document.body.classList.add("intro-started");
    // start playlist here (user gesture from click allows audio)
    startPlaylist();
    startCameraAnimation();
    if (starField && starField.geometry) starField.geometry.setDrawRange(0, originalStarCount);
  }
}
renderer.domElement.addEventListener("click", onCanvasClick);

// create initial extras
createShootingStar();
createHintIcon();
createHintText();

// =======================
// Animate loop
// =======================
let lastTime = performance.now() * 0.001;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() * 0.001;
  const dt = Math.max(0, now - lastTime);
  lastTime = now;
  const time = now;

  animateHintIcon(time);
  controls.update();
  planet.material.uniforms.time.value = time * 0.5;

  if (fadeInProgress && fadeOpacity < 1) {
    fadeOpacity += 0.025;
    if (fadeOpacity > 1) fadeOpacity = 1;
  }

  if (!introStarted) {
    fadeOpacity = 0.1;
    scene.traverse(obj => {
      if (obj.name === 'starfield') {
        if (obj.points && obj.material.opacity !== undefined) {
          obj.material.transparent = false;
          obj.material.opacity = 1;
        }
        return;
      }
      if (obj.userData.isTextRing || (obj.parent && obj.parent.userData && obj.parent.userData.isTextRing)) {
        if (obj.material && obj.material.opacity !== undefined) {
          obj.material.transparent = false;
          obj.material.opacity = 1;
        }
        if (obj.material && obj.material.color) {
          obj.material.color.set(0xffffff);
        }
      } else if (obj !== planet && obj !== centralGlow && obj !== hintIcon && obj.type !== 'Scene' && !(obj.parent && obj.parent.isGroup)) {
        if (obj.material && obj.material.opacity !== undefined) {
          obj.material.transparent = true;
          obj.material.opacity = 0.1;
        }
      }
    });
    planet.visible = true;
    centralGlow.visible = true;
  } else {
    scene.traverse(obj => {
      if (!(obj.userData.isTextRing || (obj.parent && obj.parent.userData && obj.parent.userData.isTextRing) || obj === planet || obj === centralGlow || obj.type === 'Scene')) {
        if (obj.material && obj.material.opacity !== undefined) {
          obj.material.transparent = true;
          obj.material.opacity = fadeOpacity;
        }
      } else {
        if (obj.material && obj.material.opacity !== undefined) {
          obj.material.opacity = 1;
          obj.material.transparent = false;
        }
      }
      if (obj.material && obj.material.color) {
        obj.material.color.set(0xffffff);
      }
    });
  }

  // shooting stars update
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const star = shootingStars[i];
    star.userData.life++;
    let opacity = 1.0;
    if (star.userData.life < 30) opacity = star.userData.life / 30;
    else if (star.userData.life > star.userData.maxLife - 30) opacity = (star.userData.maxLife - star.userData.life) / 30;

    star.userData.progress += star.userData.speed;
    if (star.userData.progress > 1) {
      scene.remove(star);
      shootingStars.splice(i, 1);
      continue;
    }

    const currentPos = star.userData.curve.getPoint(star.userData.progress);
    star.position.copy(currentPos);
    star.userData.head.material.opacity = opacity;
    const glowChild = star.userData.head.children[0];
    if (glowChild && glowChild.material && glowChild.material.uniforms) glowChild.material.uniforms.time.value = time;

    const trail = star.userData.trail;
    const trailPoints = star.userData.trailPoints;
    trailPoints[0].copy(currentPos);
    for (let j = 1; j < star.userData.trailLength; j++) {
      const trailProgress = Math.max(0, star.userData.progress - j * 0.01);
      trailPoints[j].copy(star.userData.curve.getPoint(trailProgress));
    }
    trail.geometry.setFromPoints(trailPoints);
    trail.material.opacity = opacity * 0.7;
  }

  if (shootingStars.length < 3 && Math.random() < 0.02) createShootingStar();

  // switch materials for heart groups based on camera distance
  scene.traverse(obj => {
    if (obj.isPoints && obj.userData && obj.userData.materialNear && obj.userData.materialFar) {
      // Apply vertical drift based on heartDriftSpeed and per-group phase/amplitude
      if (obj.userData && typeof obj.userData.baseY === 'number') {
        const phase = obj.userData.driftPhase || 0;
        const amp = obj.userData.driftAmplitude || 1.0;
        // heartDriftSpeed controls how fast the sine wave progresses
        const y = obj.userData.baseY + Math.sin(time * heartDriftSpeed + phase) * amp;
        obj.position.y = y;
      }

      const positionAttr = obj.geometry.getAttribute('position');
      let isClose = false;
      for (let i = 0; i < positionAttr.count; i++) {
        const worldX = positionAttr.getX(i) + obj.position.x;
        const worldY = positionAttr.getY(i) + obj.position.y;
        const worldZ = positionAttr.getZ(i) + obj.position.z;
        const distance = camera.position.distanceTo(new THREE.Vector3(worldX, worldY, worldZ));
        if (distance < 10) { isClose = true; break; }
      }
      if (isClose) {
        if (obj.material !== obj.userData.materialNear) {
          obj.material = obj.userData.materialNear;
          obj.geometry = obj.userData.geometryNear;
        }
      } else {
        if (obj.material !== obj.userData.materialFar) {
          obj.material = obj.userData.materialFar;
          obj.geometry = obj.userData.geometryFar;
        }
      }
    }
  });

  planet.lookAt(camera.position);
  animatePlanetSystem();

  if (starField && starField.material && starField.material.opacity !== undefined) {
    starField.material.opacity = 1.0;
    starField.material.transparent = false;
  }

  renderer.render(scene, camera);
}

animate();

// =======================
// Responsive & orientation checks
// =======================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.target.set(0, 0, 0);
  controls.update();
});

function setFullScreen() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  const container = document.getElementById('container');
  if (container) container.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', setFullScreen);
window.addEventListener('orientationchange', () => setTimeout(setFullScreen, 300));
setFullScreen();

const preventDefault = event => event.preventDefault();
document.addEventListener('touchmove', preventDefault, { passive: false });
document.addEventListener('gesturestart', preventDefault, { passive: false });
const containerEl = document.getElementById('container');
if (containerEl) containerEl.addEventListener('touchmove', preventDefault, { passive: false });

function checkOrientation() {
  const isMobilePortrait = window.innerHeight > window.innerWidth && 'ontouchstart' in window;
  if (isMobilePortrait) document.body.classList.add('portrait-mode');
  else document.body.classList.remove('portrait-mode');
}
window.addEventListener('DOMContentLoaded', checkOrientation);
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 200));

// End of script

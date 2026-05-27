import './styles.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const processSteps = [
  '\\text{blood flow }v',
  '\\text{Lorentz force}',
  '\\text{tiny charge imbalance}',
  '\\text{measured }\\Delta V',
  '\\text{velocity + flow rate}',
];

const stages = [
  {
    title: 'Stage 1 — Why can blood be measured by MHD?',
    question: 'Why can blood interact with electric and magnetic fields?',
    takeaway:
      'Blood plasma contains water and electrolytes, so moving blood carries mobile charged particles.',
    formula: ['\\begin{gathered}\\text{electrolytes}\\rightarrow\\text{mobile ions}\\\\\\rightarrow\\text{conductive fluid}\\end{gathered}'],
    observe:
      'Blood looks neutral overall, but it contains mobile ions that can respond to electric and magnetic fields.',
    visual: 'ions',
    activeProcess: 0,
  },
  {
    title: 'Stage 2 — Lorentz force separates moving ions',
    question: 'What happens when moving ions enter a magnetic field?',
    takeaway:
      'The magnetic field creates sideways forces on moving ions. Positive and negative ions are pushed toward opposite sides.',
    formula: ['F_B=q(\\vec v\\times\\vec B_0)', '\\vec v\\perp\\vec B_0\\Rightarrow |F_B|=|q|vB_0'],
    observe: 'The ions keep moving with the blood, but the magnetic field pushes them sideways.',
    visual: 'lorentz',
    activeProcess: 1,
  },
  {
    title: 'Stage 3 — Why does the separation stop?',
    question: 'Why don’t ions keep drifting sideways forever?',
    takeaway:
      'A tiny charge separation creates an electric field. At equilibrium, electric force balances magnetic force.',
    formula: ['qE=qvB', 'E=vB'],
    observe: 'Charge separation stops when the electric force balances the magnetic force.',
    visual: 'balance',
    activeProcess: 2,
  },
  {
    title: 'Stage 4 — Neutral overall, voltage across',
    question: 'If blood remains nearly neutral, why can we measure voltage?',
    takeaway:
      'Neutral overall does not mean zero voltage. A tiny side-to-side imbalance creates an electric field and a measurable ΔV.',
    formula: ['\\Delta V=El', 'l=2r_0\\;\\text{(electrode spacing)}'],
    observe:
      'The blood remains nearly neutral and mixed. The tiny side-to-side charge imbalance creates the electric field measured as ΔV.',
    visual: 'crossSection',
    activeProcess: 3,
  },
  {
    title: 'Stage 5 — Measuring blood flow from ΔV',
    question: 'What does the instrument actually measure?',
    takeaway:
      'The electrodes measure a tiny potential difference across the vessel. From ΔV, B₀, and r₀, the system calculates blood velocity and volumetric flow rate.',
    formula: ['\\Delta V=B_0lv=2B_0r_0v', 'v=\\frac{\\Delta V}{2B_0r_0}'],
    observe: 'The electrodes do not track individual ions. They measure the tiny voltage across the vessel.',
    visual: 'measurement',
    activeProcess: 4,
  },
  {
    title: 'Stage 6 — Complete MHD blood-flow measurement system',
    question: 'How do all parts work together to measure blood flow?',
    takeaway:
      'The instrument does not measure individual ions. It measures the tiny voltage across the vessel, then uses known B₀ and r₀ to calculate blood velocity and flow rate.',
    formula: [
      '\\Delta V=B_0lv=2B_0r_0v',
      'v=\\frac{\\Delta V}{2B_0r_0}',
      'Q=Av=\\pi r_0^2v=\\frac{\\Delta V\\pi r_0}{2B_0}',
    ],
    observe: 'Follow the chain from flowing conductive blood to measured ΔV, then to calculated velocity and flow rate.',
    visual: 'system',
    activeProcess: 4,
  },
];

const state = {
  mode: 'learn',
  stage: 0,
  explorePanel: 'measurement',
  vBase: 0.3,
  B0: 0.5,
  r0Mm: 2,
  noise: 3,
  pulsatile: false,
  showTags: true,
  showFieldGuides: true,
  showForceGuides: true,
  graph: [],
  lastTimestamp: performance.now(),
};

const dom = {
  learnMode: document.querySelector('#learn-mode'),
  exploreMode: document.querySelector('#explore-mode'),
  app: document.querySelector('#app'),
  tagGuides: document.querySelector('#tag-guides'),
  fieldGuides: document.querySelector('#field-guides'),
  forceGuides: document.querySelector('#force-guides'),
  learnView: document.querySelector('#learn-view'),
  exploreView: document.querySelector('#explore-view'),
  stageProgress: document.querySelector('#stage-progress'),
  stageTitle: document.querySelector('#stage-title'),
  stageQuestion: document.querySelector('#stage-question'),
  stageTakeaway: document.querySelector('#stage-takeaway'),
  formulaStack: document.querySelector('#formula-stack'),
  observeText: document.querySelector('#observe-text'),
  stageVisual: document.querySelector('#stage-visual'),
  processChain: document.querySelector('#process-chain'),
  stageRail: document.querySelector('#stage-rail'),
  previousStage: document.querySelector('#previous-stage'),
  nextStage: document.querySelector('#next-stage'),
  stageDots: document.querySelector('#stage-dots'),
  exploreVisual: document.querySelector('#explore-visual'),
  exploreRail: document.querySelector('.explore-rail'),
  velocity: document.querySelector('#velocity'),
  magneticField: document.querySelector('#magnetic-field'),
  radius: document.querySelector('#radius'),
  noise: document.querySelector('#noise'),
  pulsatile: document.querySelector('#pulsatile'),
  velocityValue: document.querySelector('#velocity-value'),
  magneticFieldValue: document.querySelector('#magnetic-field-value'),
  radiusValue: document.querySelector('#radius-value'),
  noiseValue: document.querySelector('#noise-value'),
  measuredDv: document.querySelector('#measured-dv'),
  readoutB: document.querySelector('#readout-b'),
  readoutR: document.querySelector('#readout-r'),
  readoutL: document.querySelector('#readout-l'),
  calculatedV: document.querySelector('#calculated-v'),
  flowRate: document.querySelector('#flow-rate'),
  areaReadout: document.querySelector('#area-readout'),
  flowRateDetail: document.querySelector('#flow-rate-detail'),
  graph: document.querySelector('#delta-v-graph'),
};

function calculateElectrodeSpacing(r0Mm) {
  return 2 * r0Mm;
}

function calculateDeltaV(v, B0, r0Mm) {
  const lM = calculateElectrodeSpacing(r0Mm) / 1000;
  return B0 * lM * v;
}

function calculateVelocity(deltaV, B0, r0Mm) {
  const r0M = r0Mm / 1000;
  if (B0 <= 0 || r0M <= 0) return null;
  return deltaV / (2 * B0 * r0M);
}

function calculateFlowRate(v, r0Mm) {
  const r0M = r0Mm / 1000;
  const area = Math.PI * r0M ** 2;
  return v * area;
}

function formatMv(volts) {
  return `${(volts * 1000).toFixed(2)} mV`;
}

function formatFlow(flowM3S) {
  return `${(flowM3S * 1_000_000).toFixed(1)} mL/s`;
}

function latexMarkup(tex, displayMode = false) {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    strict: false,
  });
}

function latexFO(x, y, width, height, tex, className = '', displayMode = false) {
  return `
    <foreignObject x="${x}" y="${y}" width="${width}" height="${height}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="svg-latex ${className}">
        ${latexMarkup(tex, displayMode)}
      </div>
    </foreignObject>
  `;
}

function threeTemplate() {
  return `
    <div id="three-stage" class="three-stage">
      <div id="three-label-layer" class="three-label-layer"></div>
      <button id="three-focus-toggle" class="three-focus-toggle" type="button" aria-label="Focus 3D view" title="Focus 3D view">⛶</button>
      <div class="drag-hint">Drag to rotate · auto returns to teaching view</div>
    </div>
  `;
}

const threeView = {
  initialized: false,
  root: null,
  labels: null,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  groups: {},
  ions: [],
  crossIons: [],
  arrows: [],
  forceArrows: {},
  meterDisplays: {},
  wirePulses: [],
  visualRefs: {
    vesselShell: null,
    bloodVolume: null,
    vesselRims: [],
    bloodRims: [],
    flowArrow: null,
    fieldVolume: null,
    fieldArrows: [],
    fieldLines: [],
    electricArrows: [],
    chargeGlows: [],
    electrodes: [],
    wireLines: [],
    dimensionLines: [],
  },
  resizeObserver: null,
  currentStage: 0,
  transitionUntil: 0,
  lastInteraction: performance.now(),
  isInteracting: false,
  labelsHiddenUntil: 0,
  focusButton: null,
  defaultPosition: new THREE.Vector3(5.8, 3.6, 6.6),
  defaultTarget: new THREE.Vector3(0, 0, 0),
};

function makeIonTexture(symbol, bg, fg = '#06111d') {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 96, 96);
  ctx.beginPath();
  ctx.arc(48, 48, 36, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = '600 46px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 48, 50);
  return new THREE.CanvasTexture(canvas);
}

const plusTexture3d = makeIonTexture('+', '#e7b27a');
const minusTexture3d = makeIonTexture('−', '#86b8ed');

function makeSprite(texture, position, scale = 0.34) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
  sprite.position.copy(position);
  sprite.scale.set(scale, scale, scale);
  sprite.renderOrder = 20;
  return sprite;
}

function makeTextTexture(lines, {
  width = 512,
  height = 192,
  bg = 'rgba(8,12,18,0.82)',
  border = 'rgba(190,220,245,0.18)',
  color = '#edf6ff',
  accent = '#f2f2f2',
  align = 'center',
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, width, height, Math.min(36, height / 5));
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = border;
  ctx.stroke();
  const normalized = Array.isArray(lines) ? lines : [lines];
  const startY = height / 2 - (normalized.length - 1) * 28;
  normalized.forEach((line, index) => {
    ctx.fillStyle = index === normalized.length - 1 ? accent : color;
    ctx.font = `${index === normalized.length - 1 ? '700' : '600'} ${index === normalized.length - 1 ? 34 : 24}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(line, align === 'left' ? 34 : width / 2, startY + index * 56);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function makeTextPlane(lines, position, scale, options = {}) {
  const texture = makeTextTexture(lines, options);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const aspect = (options.width || 512) / (options.height || 192);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(scale * aspect, scale), material);
  mesh.position.copy(position);
  mesh.renderOrder = 45;
  mesh.userData.textOptions = options;
  mesh.userData.lines = Array.isArray(lines) ? [...lines] : [lines];
  mesh.userData.billboard = Boolean(options.billboard);
  return mesh;
}

function updateTextPlane(mesh, lines) {
  if (!mesh?.material) return;
  mesh.material.map?.dispose?.();
  mesh.material.map = makeTextTexture(lines, mesh.userData.textOptions || {});
  mesh.material.needsUpdate = true;
  mesh.userData.lines = Array.isArray(lines) ? [...lines] : [lines];
}

function makeCylinder(radius, length, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 72, 1, true), material);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function makeArrow(direction, origin, length, color) {
  const arrow = new THREE.ArrowHelper(direction.clone().normalize(), origin, length, color, length * 0.23, length * 0.09);
  arrow.userData.baseLength = length;
  arrow.userData.direction = direction.clone().normalize();
  arrow.traverse((object) => {
    if (!object.material) return;
    object.renderOrder = 35;
    object.material.transparent = true;
    object.material.depthTest = false;
    object.material.depthWrite = false;
  });
  return arrow;
}

function setArrowStrength(arrow, length, opacity = 1) {
  if (!arrow) return;
  arrow.setLength(length, length * 0.23, length * 0.09);
  arrow.traverse((object) => {
    if (!object.material) return;
    object.material.transparent = true;
    object.material.opacity = opacity;
    object.material.needsUpdate = true;
  });
}

function setObjectOpacity(object, opacity) {
  if (!object) return;
  eachMaterial(object, (material) => {
    material.transparent = true;
    material.opacity = opacity;
    material.needsUpdate = true;
  });
}

function setLinePoints(line, points) {
  if (!line?.geometry) return;
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function applyExploreRadiusDynamics(radiusMm) {
  const refs = threeView.visualRefs;
  const radiusScale = 0.7 + radiusMm * 0.15;
  const lerpFactor = 0.12;
  const radialScale = new THREE.Vector3(radiusScale, 1, radiusScale);

  [refs.vesselShell, refs.bloodVolume].filter(Boolean).forEach((mesh) => {
    mesh.scale.lerp(radialScale, lerpFactor);
  });
  [...refs.vesselRims, ...refs.bloodRims].filter(Boolean).forEach((rim) => {
    rim.scale.lerp(new THREE.Vector3(radiusScale, radiusScale, radiusScale), lerpFactor);
  });

  if (refs.flowArrow) {
    refs.flowArrow.position.y += (1.02 * radiusScale - refs.flowArrow.position.y) * lerpFactor;
    refs.flowArrow.position.z += (0.72 * radiusScale - refs.flowArrow.position.z) * lerpFactor;
  }

  const topY = 0.86 * radiusScale;
  const bottomY = -topY;
  refs.electrodes.forEach((electrode, index) => {
    const targetY = index === 0 ? topY : bottomY;
    electrode.position.y += (targetY - electrode.position.y) * lerpFactor;
  });

  const dimensionY = 0.72 * radiusScale;
  const dimensionPoints = [
    [new THREE.Vector3(-0.62, dimensionY, 0.74), new THREE.Vector3(-0.62, -dimensionY, 0.74)],
    [new THREE.Vector3(-0.75, dimensionY, 0.74), new THREE.Vector3(-0.49, dimensionY, 0.74)],
    [new THREE.Vector3(-0.75, -dimensionY, 0.74), new THREE.Vector3(-0.49, -dimensionY, 0.74)],
  ];
  refs.dimensionLines.forEach((line, index) => setLinePoints(line, dimensionPoints[index]));

  const wireTopPoints = [
    new THREE.Vector3(0.35, 0.98 * radiusScale, 0.08),
    new THREE.Vector3(2.22, 1.2 * radiusScale, 0.35),
    new THREE.Vector3(3.02, 0.46 * radiusScale, 0.76),
  ];
  const wireBottomPoints = [
    new THREE.Vector3(0.35, -0.98 * radiusScale, 0.08),
    new THREE.Vector3(2.22, -1.2 * radiusScale, 0.35),
    new THREE.Vector3(3.02, -0.46 * radiusScale, 0.76),
  ];
  if (refs.wireLines[0]) setLinePoints(refs.wireLines[0], wireTopPoints);
  if (refs.wireLines[1]) setLinePoints(refs.wireLines[1], wireBottomPoints);
  if (threeView.wirePulses[0]) threeView.wirePulses[0].userData.points = wireTopPoints;
  if (threeView.wirePulses[1]) threeView.wirePulses[1].userData.points = wireBottomPoints;

  return radiusScale;
}

function applyExploreVisualDynamics({ velocity, magneticField, visualStage }) {
  const refs = threeView.visualRefs;
  const velocityStrength = Math.min(1.8, Math.max(0, velocity / 0.3));
  const fieldStrength = Math.min(1.8, Math.max(0, magneticField / 0.5));
  const signalStrength = Math.min(1.8, velocityStrength * fieldStrength);
  const measurementVisible = visualStage >= 4;

  setArrowStrength(refs.flowArrow, 0.68 + velocityStrength * 0.78, 0.34 + Math.min(0.64, velocityStrength * 0.38));

  if (state.showFieldGuides) {
    refs.fieldArrows.forEach((arrow) => {
      setArrowStrength(arrow, 0.9 + fieldStrength * 1.3, 0.1 + Math.min(0.82, fieldStrength * 0.46));
    });
    refs.fieldLines.forEach((line, index) => {
      setObjectOpacity(line, 0.04 + Math.min(0.34, fieldStrength * (index % 2 === 0 ? 0.18 : 0.12)));
    });
    setObjectOpacity(refs.fieldVolume, 0.015 + Math.min(0.105, fieldStrength * 0.05));
  }

  if (state.showFieldGuides) {
    refs.electricArrows.forEach((arrow) => {
      const baseLength = arrow.userData.baseLength || 1;
      setArrowStrength(arrow, baseLength * (0.45 + signalStrength * 0.55), 0.18 + Math.min(0.76, signalStrength * 0.42));
    });
  }
  refs.chargeGlows.forEach((glow) => {
    setObjectOpacity(glow, measurementVisible ? 0.035 + Math.min(0.18, signalStrength * 0.07) : 0.02);
  });
}

function makeRing(radius, tube, color, opacity = 0.75) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 18, 112),
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.28,
      metalness: 0.08,
      emissive: color,
      emissiveIntensity: 0.06,
    }),
  );
  ring.rotation.y = Math.PI / 2;
  return ring;
}

function makeBox(size, position, color, opacity = 1, metalness = 0.1) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      roughness: 0.34,
      metalness,
    }),
  );
  mesh.position.copy(position);
  return mesh;
}

function makeLine(points, color, opacity = 0.8) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
    }),
  );
  line.renderOrder = 30;
  return line;
}

function makeLabel(text, className = '', meta = {}) {
  const div = document.createElement('div');
  div.className = `three-label ${className}`.trim();
  div.innerHTML = text;
  if (meta.world) div.dataset.world = meta.world.join(',');
  if (meta.follow) div.dataset.follow = meta.follow;
  if (meta.guide) div.dataset.guide = meta.guide;
  return div;
}

function mountThreeStage(container) {
  if (!container) return;
  let stageElement = document.querySelector('#three-stage');
  if (!stageElement) {
    container.innerHTML = threeTemplate();
    stageElement = container.querySelector('#three-stage');
  } else if (stageElement.parentElement !== container) {
    container.replaceChildren(stageElement);
  }
  document.querySelectorAll('#three-stage').forEach((element, index) => {
    if (index > 0) element.remove();
  });
  initThreeView(stageElement);
  updateDragHint();
}

function syncFocusButton() {
  const button = threeView.focusButton || document.querySelector('#three-focus-toggle');
  if (!button) return;
  const isFocused = dom.app?.classList.contains('scene-focus');
  button.textContent = isFocused ? '×' : '⛶';
  button.classList.toggle('is-focused', isFocused);
  button.setAttribute('aria-label', isFocused ? 'Exit 3D focus view' : 'Focus 3D view');
  button.title = isFocused ? 'Exit focus view' : 'Focus 3D view';
}

function toggleThreeFocus() {
  dom.app?.classList.toggle('scene-focus');
  syncFocusButton();
  updateThreeStage(state.mode === 'explore' ? 4 : state.stage);
  [0, 90, 190, 330, 520].forEach((delay) => {
    window.setTimeout(() => {
      resizeThreeView();
      updateProjectedLabels();
    }, delay);
  });
}

function markSceneInteraction() {
  const now = performance.now();
  threeView.lastInteraction = now;
  threeView.labelsHiddenUntil = now + 900;
  threeView.labels?.classList.add('is-hidden');
}

function setupThreeUiControls() {
  if (!threeView.root) return;
  threeView.focusButton = threeView.root.querySelector('#three-focus-toggle');
  if (threeView.focusButton && !threeView.focusButton.dataset.bound) {
    threeView.focusButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleThreeFocus();
    });
    threeView.focusButton.dataset.bound = 'true';
  }
  syncFocusButton();
}

function updateDragHint() {
  const hint = threeView.root?.querySelector('.drag-hint');
  if (!hint) return;
  hint.textContent = state.mode === 'explore'
    ? 'Drag to rotate freely'
    : 'Drag to rotate · auto returns to teaching view';
}

function add3DLabels(stageIndex) {
  if (!threeView.labels) return;
  const common = [
    [latexMarkup('\\text{blood flow }v'), 'label-flow', { world: [-3.65, 1.05, 0.88] }],
  ];
  const stageLabels = {
    0: [
      ...common,
      [latexMarkup('\\mathrm{Na^+}\\;\\mathrm{K^+}\\;\\mathrm{Cl^-}'), 'label-ions', { world: [-0.55, 0.74, 0.44] }],
      [latexMarkup('\\text{overall charge}\\approx\\text{neutral}'), 'label-bottom', { world: [0.25, -0.95, 0.72] }],
    ],
    1: [
      ...common,
      [latexMarkup('\\vec B_0\\perp\\vec v'), 'label-field', { world: [0, 1.12, 1.25], guide: 'field' }],
      [latexMarkup('F_B'), 'label-force-top', { follow: 'positiveForce', guide: 'force' }],
      [latexMarkup('F_B'), 'label-force-bottom', { follow: 'negativeForce', guide: 'force' }],
    ],
    2: [
      ...common,
      [latexMarkup('E'), 'label-center', { world: [0.38, 0.1, 0.98], guide: 'field' }],
      [latexMarkup('F_B\\;\\text{and}\\;F_E\\;\\text{balance}'), 'label-balance', { world: [0.05, 1.18, 0.78], guide: 'force' }],
      [latexMarkup('\\text{sideways net force}=0'), 'label-bottom', { world: [0.25, -1.02, 0.72] }],
    ],
    3: [
      [latexMarkup('\\text{slightly }+'), 'label-cross-positive', { world: [-0.62, 1.24, 0.35] }],
      [latexMarkup('\\text{slightly }-'), 'label-cross-negative', { world: [-0.62, -1.24, 0.35] }],
      [latexMarkup('E'), 'label-center', { world: [0.18, 0, 0.48], guide: 'field' }],
      [latexMarkup('\\text{measured }\\Delta V'), 'label-dv', { world: [1.16, 0, 0.46] }],
      [latexMarkup('l=2r_0'), 'label-d', { world: [0.7, 0, 0.5] }],
      [latexMarkup('r_0'), 'label-radius', { world: [0.34, 0.56, -0.34] }],
      [latexMarkup('\\text{overall charge}\\approx0,\\;\\text{but}\\;\\Delta V\\ne0'), 'label-bottom', { world: [0, -1.46, 0.34] }],
    ],
    4: [
      ...common,
      [latexMarkup('l=2r_0'), 'label-d', { world: [-0.72, 0, 0.95] }],
    ],
    5: [
      ...common,
      [latexMarkup('\\text{MHD measurement system}'), 'label-top', { world: [0.15, 1.5, 0.75] }],
    ],
  };
  threeView.labels.innerHTML = '';
  (stageLabels[stageIndex] || [])
    .forEach(([text, className, meta]) => {
    threeView.labels.appendChild(makeLabel(text, className, meta));
  });
  updateProjectedLabels();
}

function initThreeView(container) {
  if (!container) return;
  if (threeView.initialized) {
    container.appendChild(threeView.renderer.domElement);
    threeView.root = container;
    threeView.labels = container.querySelector('#three-label-layer');
    setupThreeUiControls();
    add3DLabels(threeView.currentStage);
    resizeThreeView();
    return;
  }

  threeView.root = container;
  threeView.labels = container.querySelector('#three-label-layer');
  threeView.scene = new THREE.Scene();
  threeView.scene.fog = new THREE.Fog(0x111722, 8, 16);
  threeView.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  threeView.camera.position.copy(threeView.defaultPosition);

  threeView.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  threeView.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeView.renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(threeView.renderer.domElement);

  threeView.controls = new OrbitControls(threeView.camera, threeView.renderer.domElement);
  threeView.controls.enableDamping = true;
  threeView.controls.dampingFactor = 0.06;
  threeView.controls.minDistance = 4.8;
  threeView.controls.maxDistance = 10;
  threeView.controls.target.copy(threeView.defaultTarget);
  threeView.controls.addEventListener('start', () => {
    threeView.isInteracting = true;
    markSceneInteraction();
  });
  threeView.controls.addEventListener('end', () => {
    threeView.isInteracting = false;
    markSceneInteraction();
  });
  threeView.renderer.domElement.addEventListener('wheel', markSceneInteraction, { passive: true });
  threeView.renderer.domElement.addEventListener('pointerdown', markSceneInteraction);
  threeView.scene.add(new THREE.AmbientLight(0xcbd7e7, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(4, 5, 6);
  threeView.scene.add(key);
  const rim = new THREE.DirectionalLight(0x88cfff, 1.1);
  rim.position.set(-5, 2, -4);
  threeView.scene.add(rim);

  buildThreeObjects();
  threeView.resizeObserver = new ResizeObserver(resizeThreeView);
  threeView.resizeObserver.observe(container);
  window.addEventListener('resize', resizeThreeView);
  threeView.initialized = true;
  setupThreeUiControls();
  resizeThreeView();
}

function buildThreeObjects() {
  const scene = threeView.scene;
  threeView.visualRefs = {
    vesselShell: null,
    bloodVolume: null,
    vesselRims: [],
    bloodRims: [],
    flowArrow: null,
    fieldVolume: null,
    fieldArrows: [],
    fieldLines: [],
    electricArrows: [],
    chargeGlows: [],
    electrodes: [],
    wireLines: [],
    dimensionLines: [],
  };
  const groups = {
    vessel: new THREE.Group(),
    blood: new THREE.Group(),
    field: new THREE.Group(),
    fieldGuides: new THREE.Group(),
    ions: new THREE.Group(),
    forceB: new THREE.Group(),
    forceE: new THREE.Group(),
    electric: new THREE.Group(),
    chargeGlow: new THREE.Group(),
    electrodes: new THREE.Group(),
    wires: new THREE.Group(),
    meter: new THREE.Group(),
    output: new THREE.Group(),
    dimension: new THREE.Group(),
    cross: new THREE.Group(),
    crossIons: new THREE.Group(),
  };
  threeView.groups = groups;
  Object.values(groups).forEach((group) => scene.add(group));

  const tubeLength = 7.7;
  const vesselRadius = 0.72;
  const bloodRadius = 0.56;

  const shell = makeCylinder(
    vesselRadius,
    tubeLength,
    new THREE.MeshPhysicalMaterial({
      color: 0xb6c5d6,
      transparent: true,
      opacity: 0.22,
      roughness: 0.16,
      metalness: 0.02,
      transmission: 0.28,
      emissive: 0x243448,
      emissiveIntensity: 0.08,
    }),
  );
  shell.renderOrder = 1;
  threeView.visualRefs.vesselShell = shell;
  groups.vessel.add(shell);

  const blood = makeCylinder(
    bloodRadius,
    tubeLength - 0.28,
    new THREE.MeshStandardMaterial({
      color: 0x8a2035,
      transparent: true,
      opacity: 0.34,
      roughness: 0.48,
      metalness: 0.04,
      emissive: 0x260812,
      emissiveIntensity: 0.2,
    }),
  );
  blood.renderOrder = 2;
  threeView.visualRefs.bloodVolume = blood;
  groups.blood.add(blood);

  [-tubeLength / 2, tubeLength / 2].forEach((x) => {
    const rim = makeRing(vesselRadius, 0.018, 0x9ec2dc, 0.62);
    rim.position.x = x;
    threeView.visualRefs.vesselRims.push(rim);
    groups.vessel.add(rim);
    const innerRim = makeRing(bloodRadius, 0.01, 0x9a3144, 0.45);
    innerRim.position.x = x;
    threeView.visualRefs.bloodRims.push(innerRim);
    groups.blood.add(innerRim);
  });

  const midRim = makeRing(vesselRadius, 0.016, 0xb7e7f7, 0.54);
  midRim.position.x = 0;
  groups.cross.add(midRim);

  const flowArrow = makeArrow(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-4.25, 1.02, 0.72), 1.45, 0x78c7e8);
  threeView.visualRefs.flowArrow = flowArrow;
  groups.vessel.add(flowArrow);

  const fieldVolume = new THREE.Mesh(
    new THREE.BoxGeometry(3.9, 2.35, 2.8),
    new THREE.MeshBasicMaterial({
      color: 0x5fdcff,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
    }),
  );
  threeView.visualRefs.fieldVolume = fieldVolume;
  groups.fieldGuides.add(fieldVolume);

  const magnetN = makeBox([4.25, 0.58, 0.18], new THREE.Vector3(0, 0, 1.48), 0x263547, 0.94, 0.22);
  const magnetS = makeBox([4.25, 0.58, 0.18], new THREE.Vector3(0, 0, -1.48), 0x171f2d, 0.82, 0.22);
  groups.field.add(magnetN, magnetS);
  const nLabel = makeTextPlane('N', new THREE.Vector3(-2.38, 0.42, 1.58), 0.32, {
    width: 160,
    height: 120,
    bg: 'rgba(120,199,232,0.12)',
    color: '#b7e7f7',
    accent: '#b7e7f7',
  });
  const sLabel = makeTextPlane('S', new THREE.Vector3(-2.38, 0.42, -1.58), 0.32, {
    width: 160,
    height: 120,
    bg: 'rgba(156,145,223,0.12)',
    color: '#c5bdff',
    accent: '#c5bdff',
  });
  groups.field.add(nLabel, sLabel);

  [-1.25, 0, 1.25].forEach((x) => {
    const arrow = makeArrow(new THREE.Vector3(0, 0, -1), new THREE.Vector3(x, 0.82, 1.12), 2.2, 0x78c7e8);
    arrow.renderOrder = 38;
    threeView.visualRefs.fieldArrows.push(arrow);
    groups.fieldGuides.add(arrow);
  });
  [-1.85, -0.62, 0.62, 1.85].forEach((x) => {
    const lowerLine = makeLine([
      new THREE.Vector3(x, -0.72, 1.05),
      new THREE.Vector3(x, -0.72, -1.05),
    ], 0x78c7e8, 0.28);
    const midLine = makeLine([
      new THREE.Vector3(x, 0.08, 1.05),
      new THREE.Vector3(x, 0.08, -1.05),
    ], 0x78c7e8, 0.18);
    threeView.visualRefs.fieldLines.push(lowerLine, midLine);
    groups.fieldGuides.add(lowerLine);
    groups.fieldGuides.add(midLine);
  });

  const ionPositions = [
    [-3.35, 0.18, 0.16, 1], [-2.9, -0.26, -0.22, -1], [-2.42, 0.34, -0.1, 1],
    [-1.95, -0.04, 0.3, -1], [-1.42, 0.23, -0.28, 1], [-0.92, -0.22, 0.16, -1],
    [-0.42, 0.07, 0.28, 1], [0.08, -0.12, -0.28, -1], [0.56, 0.28, 0.05, 1],
    [1.04, -0.31, 0.2, -1], [1.54, 0.1, -0.3, 1], [2.04, -0.18, -0.08, -1],
    [2.54, 0.25, 0.24, 1], [3.02, -0.08, -0.28, -1], [3.44, 0.16, 0.02, 1],
  ];
  threeView.ions = ionPositions.map(([x, y, z, charge], index) => {
    const sprite = makeSprite(charge > 0 ? plusTexture3d : minusTexture3d, new THREE.Vector3(x, y, z), index === 6 || index === 7 ? 0.38 : 0.25);
    sprite.userData = {
      baseX: x,
      baseY: y,
      baseZ: z,
      charge,
      phase: index * 0.73,
      baseScale: index === 6 || index === 7 ? 0.38 : 0.25,
      highlight: index === 6 || index === 7,
    };
    groups.ions.add(sprite);
    return sprite;
  });

  threeView.forceArrows.posFB = makeArrow(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.4, 0.2, 0.74), 0.58, 0x78c7e8);
  threeView.forceArrows.negFB = makeArrow(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.08, -0.12, 0.74), 0.58, 0x78c7e8);
  threeView.forceArrows.posFE = makeArrow(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-0.4, 0.2, 0.82), 0.58, 0x8bd7a5);
  threeView.forceArrows.negFE = makeArrow(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.08, -0.12, 0.82), 0.58, 0x8bd7a5);
  groups.forceB.add(threeView.forceArrows.posFB, threeView.forceArrows.negFB);
  groups.forceE.add(threeView.forceArrows.posFE, threeView.forceArrows.negFE);

  const eMain = makeArrow(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.25, 0.78, 0.78), 1.48, 0x8bd7a5);
  eMain.userData.sideOnly = true;
  threeView.visualRefs.electricArrows.push(eMain);
  groups.electric.add(eMain);
  const eCross = makeArrow(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.18, 1.04, 0.18), 2.08, 0xd8ff8c);
  eCross.userData.crossOnly = true;
  threeView.visualRefs.electricArrows.push(eCross);
  groups.electric.add(eCross);

  const positiveGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.76, 48, 24),
    new THREE.MeshBasicMaterial({
      color: 0xe7b27a,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    }),
  );
  positiveGlow.scale.set(1.05, 0.22, 0.52);
  positiveGlow.position.set(0, 0.46, 0.02);
  const negativeGlow = positiveGlow.clone();
  negativeGlow.material = positiveGlow.material.clone();
  negativeGlow.material.color.set(0x86b8ed);
  negativeGlow.position.y = -0.46;
  threeView.visualRefs.chargeGlows.push(positiveGlow, negativeGlow);
  groups.chargeGlow.add(positiveGlow, negativeGlow);

  const electrodeMat = new THREE.MeshStandardMaterial({ color: 0xdde8f5, roughness: 0.28, metalness: 0.6 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.15, 0.48), electrodeMat);
  top.position.set(0.35, 0.86, 0.04);
  const bottom = top.clone();
  bottom.position.y = -0.86;
  threeView.visualRefs.electrodes.push(top, bottom);
  groups.electrodes.add(top, bottom);

  const wireTopPoints = [
    new THREE.Vector3(0.35, 0.98, 0.08),
    new THREE.Vector3(2.22, 1.2, 0.35),
    new THREE.Vector3(3.02, 0.46, 0.76),
  ];
  const wireBottomPoints = [
    new THREE.Vector3(0.35, -0.98, 0.08),
    new THREE.Vector3(2.22, -1.2, 0.35),
    new THREE.Vector3(3.02, -0.46, 0.76),
  ];
  const wireTopLine = makeLine(wireTopPoints, 0xc9d4e1, 0.72);
  const wireBottomLine = makeLine(wireBottomPoints, 0xc9d4e1, 0.72);
  threeView.visualRefs.wireLines.push(wireTopLine, wireBottomLine);
  groups.wires.add(wireTopLine, wireBottomLine);
  threeView.wirePulses = [wireTopPoints, wireBottomPoints].map((points) => {
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0x78c7e8, transparent: true, opacity: 0.9, depthTest: false }),
    );
    pulse.renderOrder = 42;
    pulse.userData.points = points;
    groups.wires.add(pulse);
    return pulse;
  });

  const meter = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.9, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0x101722,
      roughness: 0.38,
      metalness: 0.18,
      emissive: 0x06121c,
      emissiveIntensity: 0.3,
    }),
  );
  meter.position.set(3.55, 0, 0.82);
  groups.meter.add(meter);
  threeView.meterDisplays.voltmeter = makeTextPlane(['DIGITAL VOLTMETER', 'Measured ΔV = 0.60 mV'], new THREE.Vector3(3.55, 0, 0.895), 0.58, {
    width: 520,
    height: 230,
    bg: 'rgba(12,12,12,0.92)',
    border: 'rgba(255,255,255,0.16)',
    color: '#d8d8d8',
    accent: '#f2f2f2',
  });
  groups.meter.add(threeView.meterDisplays.voltmeter);

  threeView.meterDisplays.output = makeTextPlane(
    ['MEASUREMENT OUTPUT', 'B₀ = 0.50 T   r₀ = 2.0 mm', 'l = 4.0 mm   v = 0.30 m/s', 'Q = 3.8 mL/s'],
    new THREE.Vector3(3.72, -1.22, 0.72),
    0.58,
    {
      width: 640,
      height: 260,
      bg: 'rgba(20,20,20,0.88)',
      border: 'rgba(255,255,255,0.14)',
      color: '#d8d8d8',
      accent: '#f2f2f2',
    },
  );
  groups.output.add(threeView.meterDisplays.output);

  const diameterLine = makeLine([
    new THREE.Vector3(-0.62, 0.72, 0.74),
    new THREE.Vector3(-0.62, -0.72, 0.74),
  ], 0xdde8f5, 0.88);
  const diameterTopTick = makeLine([
    new THREE.Vector3(-0.75, 0.72, 0.74),
    new THREE.Vector3(-0.49, 0.72, 0.74),
  ], 0xdde8f5, 0.88);
  const diameterBottomTick = makeLine([
    new THREE.Vector3(-0.75, -0.72, 0.74),
    new THREE.Vector3(-0.49, -0.72, 0.74),
  ], 0xdde8f5, 0.88);
  threeView.visualRefs.dimensionLines.push(diameterLine, diameterTopTick, diameterBottomTick);
  groups.dimension.add(diameterLine, diameterTopTick, diameterBottomTick);

  const crossRadius = 0.94;
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(crossRadius, crossRadius, 0.05, 128),
    new THREE.MeshStandardMaterial({
      color: 0x8a2035,
      transparent: true,
      opacity: 0.42,
      roughness: 0.42,
      emissive: 0x260812,
      emissiveIntensity: 0.16,
    }),
  );
  disk.rotation.z = Math.PI / 2;
  disk.position.x = 0.02;
  groups.cross.add(disk);
  const ring = makeRing(1.03, 0.024, 0xb8c5d4, 0.9);
  groups.cross.add(ring);
  const innerRing = makeRing(0.94, 0.008, 0x78c7e8, 0.34);
  groups.cross.add(innerRing);

  const crossPositiveGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 48, 24),
    new THREE.MeshBasicMaterial({
      color: 0xe7b27a,
      transparent: true,
      opacity: 0.16,
      depthTest: false,
      depthWrite: false,
    }),
  );
  crossPositiveGlow.scale.set(0.12, 1.0, 1.28);
  crossPositiveGlow.position.set(0.12, 0.48, 0);
  const crossNegativeGlow = crossPositiveGlow.clone();
  crossNegativeGlow.material = crossPositiveGlow.material.clone();
  crossNegativeGlow.material.color.set(0x86b8ed);
  crossNegativeGlow.position.y = -0.48;
  groups.cross.add(crossPositiveGlow, crossNegativeGlow);

  const crossElectrodeMat = new THREE.MeshStandardMaterial({
    color: 0xe4eef8,
    roughness: 0.24,
    metalness: 0.68,
    emissive: 0x101a24,
    emissiveIntensity: 0.18,
  });
  const crossTopElectrode = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.42), crossElectrodeMat);
  crossTopElectrode.position.set(0.17, 1.17, 0);
  const crossBottomElectrode = crossTopElectrode.clone();
  crossBottomElectrode.position.y = -1.17;
  groups.cross.add(crossTopElectrode, crossBottomElectrode);

  groups.cross.add(makeLine([
    new THREE.Vector3(0.46, 1.17, 0.34),
    new THREE.Vector3(0.46, -1.17, 0.34),
  ], 0xb7e7f7, 0.92));
  groups.cross.add(makeLine([
    new THREE.Vector3(0.34, 1.17, 0.34),
    new THREE.Vector3(0.58, 1.17, 0.34),
  ], 0xb7e7f7, 0.92));
  groups.cross.add(makeLine([
    new THREE.Vector3(0.34, -1.17, 0.34),
    new THREE.Vector3(0.58, -1.17, 0.34),
  ], 0xb7e7f7, 0.92));
  groups.cross.add(makeLine([
    new THREE.Vector3(0.17, 1.02, 0.28),
    new THREE.Vector3(-0.55, 1.26, 0.28),
  ], 0xe7b27a, 0.68));
  groups.cross.add(makeLine([
    new THREE.Vector3(0.17, -1.02, 0.28),
    new THREE.Vector3(-0.55, -1.26, 0.28),
  ], 0x86b8ed, 0.68));
  groups.cross.add(makeLine([
    new THREE.Vector3(0.46, 0, 0.34),
    new THREE.Vector3(1.18, 0, 0.34),
  ], 0xb7e7f7, 0.64));
  groups.cross.add(makeLine([
    new THREE.Vector3(0.2, 0, -0.36),
    new THREE.Vector3(0.2, 0.92, -0.36),
  ], 0xdde8f5, 0.72));

  const crossIonPositions = [
    [0.62, -0.64, 1], [0.34, -0.72, 1], [-0.02, -0.68, 1], [-0.36, -0.62, 1],
    [-0.66, -0.44, 1], [0.52, -0.36, 1], [0.14, -0.38, 1], [-0.24, -0.32, 1],
    [-0.58, -0.2, -1], [0.74, -0.18, 1], [-0.02, -0.18, -1], [-0.42, -0.06, -1],
    [0.38, -0.02, 1], [-0.18, 0.02, -1],
    [0.58, 0.18, 1], [-0.72, 0.16, -1], [0.2, 0.3, 1], [-0.32, 0.42, -1],
    [0.72, 0.38, -1], [0.44, 0.58, -1], [0.08, 0.68, 1], [-0.28, 0.66, -1],
    [-0.62, 0.5, -1], [0.48, 0.08, -1], [-0.02, 0.24, -1], [-0.5, 0.08, -1],
  ];
  threeView.crossIons = crossIonPositions.map(([y, z, charge], index) => {
    const sprite = makeSprite(charge > 0 ? plusTexture3d : minusTexture3d, new THREE.Vector3(0.12, y, z), 0.145);
    sprite.userData = { baseY: y, baseZ: z, charge, phase: index * 0.57, baseScale: 0.145 };
    groups.crossIons.add(sprite);
    return sprite;
  });
}

function eachMaterial(group, callback) {
  group.traverse((object) => {
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material.userData.baseOpacity === undefined) {
        material.userData.baseOpacity = material.opacity ?? 1;
      }
      material.transparent = true;
      callback(material, object);
    });
  });
}

function setGroupTargetOpacity(group, opacity) {
  group.visible = true;
  const isInitialTarget = group.userData.targetOpacity === undefined;
  group.userData.targetOpacity = opacity;
  eachMaterial(group, (material) => {
    material.userData.targetOpacity = material.userData.baseOpacity * opacity;
    if (isInitialTarget) {
      material.opacity = material.userData.targetOpacity;
    }
  });
}

function updateGroupOpacity(group) {
  const target = group.userData.targetOpacity ?? 1;
  let maxOpacity = 0;
  eachMaterial(group, (material) => {
    const materialTarget = material.userData.targetOpacity ?? material.userData.baseOpacity;
    material.opacity += (materialTarget - material.opacity) * 0.08;
    maxOpacity = Math.max(maxOpacity, material.opacity);
  });
  group.visible = target > 0.01 || maxOpacity > 0.015;
}

function labelWorldPosition(label) {
  const world = label.dataset.world;
  if (world) {
    const [x, y, z] = world.split(',').map(Number);
    return new THREE.Vector3(x, y, z);
  }

  const highlightedPositive = threeView.ions.find((ionSprite) => ionSprite.userData.highlight && ionSprite.userData.charge > 0);
  const highlightedNegative = threeView.ions.find((ionSprite) => ionSprite.userData.highlight && ionSprite.userData.charge < 0);
  if (label.dataset.follow === 'positiveForce' && highlightedPositive) {
    return highlightedPositive.position.clone().add(new THREE.Vector3(0.18, 0.74, 0.28));
  }
  if (label.dataset.follow === 'negativeForce' && highlightedNegative) {
    return highlightedNegative.position.clone().add(new THREE.Vector3(0.18, -0.74, 0.28));
  }
  return null;
}

function updateProjectedLabels() {
  if (!threeView.labels || !threeView.camera || !threeView.root) return;
  const rect = threeView.root.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const now = performance.now();
  const labelsShouldHide = !state.showTags || threeView.isInteracting || now < threeView.labelsHiddenUntil;
  threeView.labels.classList.toggle('is-hidden', labelsShouldHide);

  threeView.labels.querySelectorAll('.three-label').forEach((label) => {
    const position = labelWorldPosition(label);
    if (!position) return;
    const projected = position.project(threeView.camera);
    const isVisible = projected.z > -1 && projected.z < 1;
    const left = (projected.x * 0.5 + 0.5) * rect.width;
    const top = (-projected.y * 0.5 + 0.5) * rect.height;
    const guideHidden =
      (label.dataset.guide === 'field' && !state.showFieldGuides) ||
      (label.dataset.guide === 'force' && !state.showForceGuides);
    label.style.left = `${left}px`;
    label.style.top = `${top}px`;
    label.style.transform = 'translate(-50%, -50%)';
    label.classList.toggle('guide-hidden', guideHidden);
    label.style.opacity = isVisible && !guideHidden ? '1' : '0';
  });
}

function updateThreeStage(stageIndex) {
  const container = document.querySelector('#three-stage');
  initThreeView(container);
  threeView.currentStage = stageIndex;
  threeView.transitionUntil = performance.now() + 950;
  threeView.labelsHiddenUntil = threeView.transitionUntil + 150;
  add3DLabels(stageIndex);

  const { groups } = threeView;
  const isExplore = state.mode === 'explore';
  const isFocused = dom.app?.classList.contains('scene-focus');
  const measurementStage = isExplore ? 4 : stageIndex;

  setGroupTargetOpacity(groups.vessel, measurementStage === 3 ? 0.18 : 1);
  setGroupTargetOpacity(groups.blood, measurementStage === 3 ? 0.08 : 1);
  setGroupTargetOpacity(groups.field, measurementStage >= 1 ? (measurementStage === 3 ? 0.05 : 1) : 0.06);
  setGroupTargetOpacity(
    groups.fieldGuides,
    state.showFieldGuides && measurementStage >= 1 ? (measurementStage === 3 ? 0.72 : 1) : 0,
  );
  setGroupTargetOpacity(groups.ions, measurementStage === 3 ? 0 : measurementStage >= 4 ? 0.42 : 1);
  setGroupTargetOpacity(groups.forceB, state.showForceGuides && (measurementStage === 1 || measurementStage === 2 || measurementStage >= 4) ? 1 : 0);
  setGroupTargetOpacity(groups.forceE, state.showForceGuides && measurementStage === 2 ? 1 : 0);
  setGroupTargetOpacity(groups.electric, state.showFieldGuides && (measurementStage === 2 || measurementStage === 3 || measurementStage >= 4) ? 1 : 0);
  setGroupTargetOpacity(groups.chargeGlow, measurementStage >= 2 ? (measurementStage === 3 ? 1 : 0.62) : 0);
  setGroupTargetOpacity(groups.electrodes, measurementStage === 3 ? 0 : measurementStage >= 4 ? 1 : 0.08);
  setGroupTargetOpacity(groups.wires, measurementStage >= 4 ? 1 : 0);
  setGroupTargetOpacity(groups.meter, measurementStage >= 4 ? 1 : 0);
  setGroupTargetOpacity(groups.output, measurementStage >= 4 ? 1 : 0);
  setGroupTargetOpacity(groups.dimension, measurementStage >= 4 ? 1 : 0);
  setGroupTargetOpacity(groups.cross, measurementStage === 3 ? 1 : 0);
  setGroupTargetOpacity(groups.crossIons, measurementStage === 3 ? 1 : 0);
  groups.electric.children.forEach((child) => {
    if (child.userData.crossOnly) child.scale.setScalar(measurementStage === 3 ? 1 : 0.001);
    if (child.userData.sideOnly) child.scale.setScalar(measurementStage === 3 ? 0.001 : 1);
  });

  const cameraMap = [
    [[5.9, 2.85, 4.95], [0, 0.02, 0]],
    [[3.72, 1.72, 3.18], [0.03, 0.02, 0.15]],
    [[3.22, 1.86, 2.82], [0.02, 0.02, 0.26]],
    [[4.45, 0.02, 0.02], [0.02, 0, 0]],
    [[5.0, 2.35, 4.35], [0.72, -0.08, 0.24]],
    [[6.12, 3.0, 5.15], [0.5, -0.04, 0.18]],
  ];
  const [position, target] = cameraMap[measurementStage] || cameraMap[0];
  if (isExplore || (isFocused && measurementStage >= 4)) {
    threeView.defaultPosition.set(8.45, 3.9, 7.35);
    threeView.defaultTarget.set(0.62, -0.06, 0.18);
    if (threeView.controls) {
      threeView.controls.maxDistance = 14;
    }
  } else {
    threeView.defaultPosition.set(...position);
    threeView.defaultTarget.set(...target);
    if (threeView.controls) {
      threeView.controls.maxDistance = 10;
    }
  }
}

function resizeThreeView() {
  if (!threeView.root || !threeView.renderer || !threeView.camera) return;
  const rect = threeView.root.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  threeView.camera.aspect = width / height;
  threeView.camera.updateProjectionMatrix();
  threeView.renderer.setSize(width, height, false);
}

function currentVelocity(timeSeconds) {
  if (!state.pulsatile) return state.vBase;
  return state.vBase * (1 + 0.25 * Math.sin(2 * Math.PI * 1.2 * timeSeconds));
}

function noisyMeasurement(deltaV) {
  if (state.noise <= 0) return deltaV;
  const amplitude = deltaV * (state.noise / 100);
  return deltaV + (Math.random() * 2 - 1) * amplitude;
}

function ion(x, y, charge, label = '') {
  const cls = charge > 0 ? 'ion positive' : 'ion negative';
  const symbol = charge > 0 ? '+' : '-';
  return `
    <g class="${cls}" style="--delay:${((x + y) % 7) * 0.12}s">
      <circle cx="${x}" cy="${y}" r="13"></circle>
      ${latexFO(x - 9, y - 11, 18, 22, symbol, 'ion-symbol-latex')}
      ${label ? latexFO(x + 16, y - 26, 92, 24, label, 'ion-label-latex') : ''}
    </g>
  `;
}

function arrow(id, color = '#7ce7ff') {
  return `
    <marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"></path>
    </marker>
  `;
}

function defs() {
  return `
    <defs>
      ${arrow('arrow-cyan', '#7ce7ff')}
      ${arrow('arrow-purple', '#b894ff')}
      ${arrow('arrow-green', '#8dffb2')}
      ${arrow('arrow-orange', '#ffb66d')}
      ${arrow('arrow-blue', '#77baff')}
      <linearGradient id="blood-gradient" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#42131e"></stop>
        <stop offset="48%" stop-color="#771b2e"></stop>
        <stop offset="100%" stop-color="#2a0c14"></stop>
      </linearGradient>
      <linearGradient id="field-gradient" x1="0" x2="1">
        <stop offset="0%" stop-color="#63ddff" stop-opacity=".08"></stop>
        <stop offset="50%" stop-color="#b894ff" stop-opacity=".24"></stop>
        <stop offset="100%" stop-color="#63ddff" stop-opacity=".08"></stop>
      </linearGradient>
      <filter id="soft-glow">
        <feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur>
        <feMerge>
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>
    </defs>
  `;
}

function vesselBase({ field = false, electrodes = false, spacing = false, meterValue = '0.60 mV' } = {}) {
  return `
    ${field ? `
      <rect class="field-region" x="248" y="84" width="384" height="252" rx="28"></rect>
      ${latexFO(332, 56, 230, 28, '\\text{magnetic field }\\vec B_0\\text{ into screen}', 'field-latex')}
      ${Array.from({ length: 18 }, (_, i) => {
        const x = 286 + (i % 6) * 58;
        const y = 126 + Math.floor(i / 6) * 70;
        return `<g class="b-cross"><path d="M${x - 8},${y - 8} L${x + 8},${y + 8} M${x + 8},${y - 8} L${x - 8},${y + 8}"></path></g>`;
      }).join('')}
    ` : ''}
    <rect class="vessel-shell" x="84" y="168" width="712" height="104" rx="52"></rect>
    <rect class="blood" x="104" y="182" width="672" height="76" rx="38"></rect>
    <path class="flow-line" d="M142 220 H290"></path>
    <path class="flow-line delay" d="M122 238 H244"></path>
    <path class="arrow-line cyan" d="M118 130 H252"></path>
    ${latexFO(126, 96, 124, 28, '\\text{blood flow }v', 'label-latex')}
    ${electrodes ? `
      <rect class="electrode top-electrode" x="415" y="132" width="56" height="30" rx="10"></rect>
      <rect class="electrode bottom-electrode" x="415" y="278" width="56" height="30" rx="10"></rect>
      <path class="wire" d="M443 132 C443 82, 642 82, 642 154"></path>
      <path class="wire" d="M443 308 C443 356, 642 356, 642 284"></path>
      <rect class="meter" x="612" y="154" width="168" height="130" rx="22"></rect>
      ${latexFO(620, 176, 152, 24, '\\text{Digital Voltmeter}', 'meter-label-latex')}
      ${latexFO(630, 218, 132, 24, '\\text{Measured }\\Delta V', 'meter-value-latex')}
      ${latexFO(630, 242, 132, 34, meterValue.replace('mV', '\\\\,\\text{mV}'), 'meter-number-latex')}
    ` : ''}
    ${spacing ? `
      <path class="dimension" d="M386 168 V272"></path>
      <path class="dimension-tick" d="M372 168 H400 M372 272 H400"></path>
      ${latexFO(336, 202, 58, 32, 'l=2r_0', 'label-latex')}
    ` : ''}
  `;
}

function measurementPanel(x = 72, y = 320, compact = false) {
  const width = compact ? 282 : 332;
  const height = compact ? 166 : 184;
  return `
    <g class="svg-readout" transform="translate(${x} ${y})">
      <rect width="${width}" height="${height}" rx="22"></rect>
      ${latexFO(20, 18, width - 36, 28, '\\text{Measurement output}', 'readout-title-latex')}
      ${latexFO(20, 52, width - 36, 24, '\\text{Measured }\\Delta V:0.60\\,\\text{mV}', 'readout-line-latex')}
      ${latexFO(20, 78, width - 36, 24, '\\text{Magnetic field }B_0:0.50\\,\\text{T}', 'readout-line-latex')}
      ${latexFO(20, 104, width - 36, 24, 'r_0:2.0\\,\\text{mm},\\quad l=2r_0=4.0\\,\\text{mm}', 'readout-line-latex')}
      ${latexFO(20, 130, width - 36, 24, '\\text{Calculated velocity }v:0.30\\,\\text{m/s}', 'readout-line-latex')}
      ${latexFO(20, 156, width - 36, 24, 'Q:3.8\\,\\text{mL/s}', 'readout-line-latex')}
    </g>
  `;
}

function visualStage1() {
  return `
    <svg viewBox="0 0 900 520" role="img" aria-label="Mixed ions flowing inside blood">
      ${defs()}
      ${vesselBase()}
      <g class="drifting-ions">
        ${ion(190, 205, 1, '\\mathrm{Na^+}')}
        ${ion(262, 236, -1, '\\mathrm{Cl^-}')}
        ${ion(338, 210, 1, '\\mathrm{K^+}')}
        ${ion(430, 238, -1)}
        ${ion(514, 204, 1)}
        ${ion(602, 236, -1)}
        ${ion(694, 212, 1)}
        ${ion(735, 238, -1)}
      </g>
      ${latexFO(318, 322, 264, 34, '\\text{overall charge}\\approx\\text{neutral}', 'note-latex')}
      ${latexFO(272, 356, 356, 28, '\\text{electrolytes provide mobile ions in the fluid}', 'note-latex small')}
    </svg>
  `;
}

function visualStage2() {
  return `
    <svg viewBox="0 0 900 520" role="img" aria-label="Positive and negative ions experiencing opposite Lorentz forces">
      ${defs()}
      ${vesselBase({ field: true })}
      <g class="featured-ion">
        ${ion(420, 220, 1, '\\text{positive ion}')}
        <path class="force-arrow orange" d="M420 204 V132"></path>
        ${latexFO(434, 140, 44, 28, 'F_B', 'force-latex')}
      </g>
      <g class="featured-ion">
        ${ion(512, 220, -1, '\\text{negative ion}')}
        <path class="force-arrow blue" d="M512 236 V308"></path>
        ${latexFO(526, 278, 44, 28, 'F_B', 'force-latex')}
      </g>
      ${latexFO(300, 360, 340, 34, '\\text{same }v,\\text{ opposite }q\\rightarrow\\text{opposite sideways force}', 'note-latex')}
    </svg>
  `;
}

function visualStage3() {
  return `
    <svg viewBox="0 0 900 520" role="img" aria-label="Electric and magnetic forces balancing">
      ${defs()}
      ${vesselBase({ field: true })}
      <path class="e-field-line" d="M702 144 V296"></path>
      ${latexFO(722, 210, 28, 28, 'E', 'field-latex green')}
      ${latexFO(246, 140, 92, 26, '\\text{slightly }+', 'charge-latex positive-edge')}
      ${latexFO(246, 288, 92, 26, '\\text{slightly }-', 'charge-latex negative-edge')}
      <g class="featured-ion">
        ${ion(408, 220, 1, '\\text{positive ion}')}
        <path class="force-arrow orange" d="M408 204 V134"></path>
        ${latexFO(422, 138, 44, 28, 'F_B', 'force-latex')}
        <path class="force-arrow green grow-down" d="M408 236 V306"></path>
        ${latexFO(422, 278, 44, 28, 'F_E', 'force-latex green')}
      </g>
      <g class="featured-ion">
        ${ion(528, 220, -1, '\\text{negative ion}')}
        <path class="force-arrow blue" d="M528 236 V306"></path>
        ${latexFO(542, 278, 44, 28, 'F_B', 'force-latex')}
        <path class="force-arrow green grow-up" d="M528 204 V134"></path>
        ${latexFO(542, 138, 44, 28, 'F_E', 'force-latex green')}
      </g>
      <g class="equilibrium-badge">
        <rect x="348" y="346" width="204" height="42" rx="21"></rect>
        ${latexFO(362, 354, 176, 28, '\\text{sideways net force}=0', 'badge-latex green')}
      </g>
    </svg>
  `;
}

function visualStage4() {
  const mixed = [
    [396, 185, 1], [430, 167, -1], [470, 184, 1], [506, 169, -1],
    [372, 222, -1], [414, 220, 1], [458, 218, -1], [500, 221, 1], [536, 220, -1],
    [398, 260, 1], [438, 276, -1], [480, 262, 1], [518, 278, -1],
    [346, 204, 1], [553, 236, -1], [356, 250, 1], [548, 190, -1],
  ];
  return `
    <svg viewBox="0 0 900 520" role="img" aria-label="Nearly neutral vessel cross-section with electrodes measuring delta V">
      ${defs()}
      <circle class="cross-vessel" cx="450" cy="230" r="154"></circle>
      <circle class="cross-blood" cx="450" cy="230" r="130"></circle>
      <ellipse class="subtle-positive-cloud" cx="350" cy="230" rx="58" ry="112"></ellipse>
      <ellipse class="subtle-negative-cloud" cx="550" cy="230" rx="58" ry="112"></ellipse>
      <g class="cross-ions">${mixed.map(([x, y, q]) => ion(x, y, q)).join('')}</g>
      <rect class="electrode side left" x="262" y="174" width="34" height="112" rx="13"></rect>
      <rect class="electrode side right" x="604" y="174" width="34" height="112" rx="13"></rect>
      <path class="wire" d="M262 214 C194 214, 194 132, 332 132"></path>
      <path class="wire" d="M638 214 C706 214, 706 132, 568 132"></path>
      <rect class="mini-meter" x="332" y="96" width="236" height="72" rx="22"></rect>
      ${latexFO(342, 112, 216, 24, '\\text{potential difference between electrodes}', 'meter-value-latex')}
      ${latexFO(420, 134, 60, 36, '\\Delta V', 'meter-number-latex')}
      <path class="e-field-horizontal" d="M354 230 H546"></path>
      ${latexFO(440, 188, 28, 28, 'E', 'field-latex green')}
      ${latexFO(266, 310, 92, 26, '\\text{slightly }+', 'charge-latex positive-edge')}
      ${latexFO(554, 310, 92, 26, '\\text{slightly }-', 'charge-latex negative-edge')}
      ${latexFO(310, 414, 280, 30, '\\text{overall charge}\\approx0,\\text{ but }\\Delta V\\ne0', 'note-latex')}
    </svg>
  `;
}

function visualStage5() {
  return `
    <svg viewBox="0 0 900 520" role="img" aria-label="MHD blood-flow measurement instrument">
      ${defs()}
      ${vesselBase({ field: true, electrodes: true, spacing: true })}
      <g class="drifting-ions compact-ions">
        ${ion(168, 210, 1)}
        ${ion(226, 237, -1)}
        ${ion(318, 207, 1)}
        ${ion(380, 240, -1)}
        ${ion(518, 210, 1)}
        ${ion(574, 238, -1)}
      </g>
      ${latexFO(438, 138, 92, 26, '\\text{slightly }+', 'charge-latex positive-edge')}
      ${latexFO(438, 298, 92, 26, '\\text{slightly }-', 'charge-latex negative-edge')}
      ${measurementPanel(72, 318)}
    </svg>
  `;
}

function visualStage6() {
  return `
    <svg viewBox="0 0 900 520" role="img" aria-label="Complete MHD blood-flow measurement system">
      ${defs()}
      ${vesselBase({ field: true, electrodes: true, spacing: true })}
      <g class="compact-ions">
        ${ion(188, 211, 1)}
        ${ion(250, 239, -1)}
        ${ion(342, 210, 1)}
        ${ion(404, 238, -1)}
        ${ion(500, 208, 1)}
        ${ion(562, 238, -1)}
        ${ion(624, 211, 1)}
      </g>
      <path class="force-arrow tiny orange" d="M344 195 V158"></path>
      <path class="force-arrow tiny blue" d="M404 252 V290"></path>
      <path class="e-field-line small-e" d="M706 168 V270"></path>
      ${latexFO(726, 208, 28, 28, 'E', 'field-latex green')}
      ${latexFO(434, 138, 92, 26, '\\text{slightly }+', 'charge-latex positive-edge')}
      ${latexFO(434, 298, 92, 26, '\\text{slightly }-', 'charge-latex negative-edge')}
      ${measurementPanel(70, 296, true)}
      <g class="system-formula">
        <rect x="386" y="326" width="442" height="112" rx="24"></rect>
        ${latexFO(456, 344, 304, 44, 'v=\\dfrac{\\Delta V}{2B_0r_0}', 'formula-main-latex', true)}
        ${latexFO(456, 392, 304, 28, 'Q=\\pi r_0^2v=\\dfrac{\\Delta V\\pi r_0}{2B_0}', 'formula-secondary-latex')}
        ${latexFO(442, 420, 332, 24, 'F_B=q(\\vec v\\times\\vec B_0),\\;qE=qvB_0,\\;\\Delta V=El', 'formula-small-latex')}
      </g>
    </svg>
  `;
}

function visualForStage(type) {
  return threeTemplate(type);
}

function renderProcessChain(activeIndex) {
  dom.processChain.innerHTML = processSteps
    .map((step, index) => {
      const active = index === activeIndex ? 'active' : '';
      const arrowNode = index < processSteps.length - 1 ? '<span class="chain-arrow">→</span>' : '';
      return `<span class="chain-step ${active}">${latexMarkup(step)}</span>${arrowNode}`;
    })
    .join('');
}

function renderStageDots() {
  dom.stageDots.innerHTML = stages
    .map((_, index) => `<button class="stage-dot ${index === state.stage ? 'active' : ''}" type="button" aria-label="Go to stage ${index + 1}"></button>`)
    .join('');
  [...dom.stageDots.querySelectorAll('.stage-dot')].forEach((button, index) => {
    button.addEventListener('click', () => {
      state.stage = index;
      renderLearnStage();
    });
  });
}

function renderStageRail() {
  const labels = [
    ['Ions', 'Conductive blood'],
    ['Force', 'Lorentz separation'],
    ['Balance', 'Equilibrium'],
    ['ΔV', 'Electrodes'],
    ['Calc', 'Flow reading'],
    ['System', 'Overview'],
  ];

  dom.stageRail.innerHTML = `
    <div class="rail-brand">MHD</div>
    ${labels
      .map(
        ([tag, text], index) => `
          <button class="rail-item ${index === state.stage ? 'active' : ''}" type="button" aria-label="Go to stage ${index + 1}">
            <span class="rail-number">${index + 1}</span>
            <span class="rail-tag">${tag}</span>
            <small>${text}</small>
          </button>
        `,
      )
      .join('')}
  `;

  [...dom.stageRail.querySelectorAll('.rail-item')].forEach((button, index) => {
    button.addEventListener('click', () => {
      state.stage = index;
      renderLearnStage();
    });
  });
}

function renderFormula(formulas) {
  dom.formulaStack.innerHTML = formulas
    .map(
      (formula, index) =>
        `<div class="formula ${index === 0 ? 'primary' : 'secondary'}">${latexMarkup(formula, index === 0)}</div>`,
    )
    .join('');
}

function renderStaticLatex() {
  document.querySelectorAll('.static-latex').forEach((element) => {
    element.innerHTML = latexMarkup(element.dataset.tex, element.classList.contains('primary'));
  });
}

function renderLearnStage() {
  const stage = stages[state.stage];
  window.scrollTo({ top: 0, behavior: 'instant' });
  dom.stageProgress.textContent = `Stage ${state.stage + 1} of ${stages.length}`;
  dom.stageTitle.textContent = stage.title;
  dom.stageQuestion.textContent = stage.question;
  dom.stageTakeaway.textContent = stage.takeaway;
  dom.observeText.textContent = stage.observe;
  renderFormula(stage.formula);
  mountThreeStage(dom.stageVisual);
  updateThreeStage(state.stage);
  renderProcessChain(stage.activeProcess);
  renderStageDots();
  renderStageRail();
  dom.previousStage.disabled = state.stage === 0;
  dom.nextStage.disabled = state.stage === stages.length - 1;
}

function renderExploreVisual(values) {
  mountThreeStage(dom.exploreVisual);
  if (threeView.currentStage !== 4) {
    updateThreeStage(4);
  }
}

function renderExplorePanel() {
  document.querySelectorAll('[data-explore-panel]').forEach((button) => {
    button.classList.toggle('active', button.dataset.explorePanel === state.explorePanel);
  });
  document.querySelectorAll('.explore-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === state.explorePanel);
  });
  if (state.explorePanel === 'signal') {
    drawGraph();
  }
}

function applyExploreCameraView() {
  if (!threeView.initialized) return;
  threeView.camera.position.copy(threeView.defaultPosition);
  threeView.controls.target.copy(threeView.defaultTarget);
  threeView.controls.maxDistance = 14;
  threeView.controls.update();
}

function drawGraph() {
  const canvas = dom.graph;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(124, 231, 255, 0.18)');
  gradient.addColorStop(1, 'rgba(124, 231, 255, 0.01)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.11)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const max = Math.max(0.001, ...state.graph.map((point) => point.value));
  const min = Math.min(0, ...state.graph.map((point) => point.value));
  const range = Math.max(0.0001, max - min);

  ctx.strokeStyle = '#7ce7ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  state.graph.forEach((point, index) => {
    const x = (index / Math.max(1, state.graph.length - 1)) * width;
    const y = height - ((point.value - min) / range) * (height - 28) - 14;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = 'rgba(240,246,255,0.78)';
  ctx.font = '600 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('ΔV', 14, 22);
  ctx.fillText(`${(max * 1000).toFixed(2)} mV`, width - 92, 22);
}

function updateMeasurementDisplay(timeSeconds = 0) {
  const trueVelocity = currentVelocity(timeSeconds);
  const lMm = calculateElectrodeSpacing(state.r0Mm);
  const trueDeltaV = calculateDeltaV(trueVelocity, state.B0, state.r0Mm);
  const measuredDeltaV = noisyMeasurement(trueDeltaV);
  const calculatedVelocity = calculateVelocity(measuredDeltaV, state.B0, state.r0Mm);
  const displayVelocity = calculatedVelocity === null ? null : Math.max(0, calculatedVelocity);
  const flowRate = calculateFlowRate(trueVelocity, state.r0Mm);

  dom.velocityValue.innerHTML = latexMarkup(`${state.vBase.toFixed(2)}\\,\\text{m/s}`);
  dom.magneticFieldValue.innerHTML = latexMarkup(`${state.B0.toFixed(2)}\\,\\text{T}`);
  dom.radiusValue.innerHTML = latexMarkup(`${state.r0Mm.toFixed(1)}\\,\\text{mm}`);
  dom.noiseValue.innerHTML = latexMarkup(`${state.noise}\\%`);
  dom.measuredDv.innerHTML = latexMarkup(`${(measuredDeltaV * 1000).toFixed(2)}\\,\\text{mV}`);
  dom.readoutB.innerHTML = latexMarkup(`${state.B0.toFixed(2)}\\,\\text{T}`);
  dom.readoutR.innerHTML = latexMarkup(`${state.r0Mm.toFixed(1)}\\,\\text{mm}`);
  dom.readoutL.innerHTML = latexMarkup(`${lMm.toFixed(1)}\\,\\text{mm}`);
  dom.calculatedV.innerHTML =
    displayVelocity === null
      ? 'N/A: increase B₀ and r₀'
      : latexMarkup(`${displayVelocity.toFixed(2)}\\,\\text{m/s}`);
  dom.flowRate.innerHTML = latexMarkup(`${(flowRate * 1_000_000).toFixed(1)}\\,\\text{mL/s}`);
  if (dom.areaReadout) {
    const areaMm2 = Math.PI * state.r0Mm ** 2;
    dom.areaReadout.innerHTML = latexMarkup(`${areaMm2.toFixed(1)}\\,\\text{mm}^2`);
  }
  if (dom.flowRateDetail) {
    dom.flowRateDetail.innerHTML = latexMarkup(`${(flowRate * 1_000_000).toFixed(1)}\\,\\text{mL/s}`);
  }

  if (threeView.meterDisplays.voltmeter) {
    updateTextPlane(threeView.meterDisplays.voltmeter, [
      'DIGITAL VOLTMETER',
      `Measured ΔV = ${(measuredDeltaV * 1000).toFixed(2)} mV`,
    ]);
  }
  if (threeView.meterDisplays.output) {
    updateTextPlane(threeView.meterDisplays.output, [
      'MEASUREMENT OUTPUT',
      `B₀ = ${state.B0.toFixed(2)} T   r₀ = ${state.r0Mm.toFixed(1)} mm`,
      `l = ${lMm.toFixed(1)} mm   v = ${displayVelocity === null ? 'N/A' : `${displayVelocity.toFixed(2)} m/s`}`,
      `Q = ${(flowRate * 1_000_000).toFixed(1)} mL/s`,
    ]);
  }

  if (state.mode === 'explore') {
    renderExploreVisual({ measuredDeltaV });
  }
}

function animate(timestamp) {
  const timeSeconds = timestamp / 1000;
  if (threeView.initialized && (state.mode === 'learn' || state.mode === 'explore')) {
    const visualStage = state.mode === 'explore' ? 4 : state.stage;
    const liveVelocity = currentVelocity(timeSeconds);
    const driftSpeed = state.mode === 'explore' ? liveVelocity * 1.75 : 0.52;
    const radiusScale = applyExploreRadiusDynamics(state.mode === 'explore' ? state.r0Mm : 2);
    threeView.ions.forEach((ionSprite) => {
      const { baseX, baseY, baseZ, charge, phase, baseScale, highlight } = ionSprite.userData;
      if (highlight && visualStage <= 2 && state.mode !== 'explore') {
        ionSprite.position.x = baseX + Math.sin(timeSeconds * 0.65 + phase) * 0.08;
      } else {
        const drift = ((baseX + 3.8 + timeSeconds * driftSpeed + phase * 0.18) % 7.6) - 3.8;
        ionSprite.position.x = drift;
      }
      const exploreSignal = state.mode === 'explore' ? Math.min(1.8, (liveVelocity / 0.3) * (state.B0 / 0.5)) : 1;
      const separation = visualStage >= 1 ? charge * (highlight ? 0.22 : 0.08) * (0.35 + exploreSignal * 0.38) * radiusScale : 0;
      ionSprite.position.y = baseY * radiusScale + separation + Math.sin(timeSeconds * 1.3 + phase) * 0.025;
      ionSprite.position.z = baseZ * radiusScale + Math.cos(timeSeconds * 1.1 + phase) * 0.018;
      const targetScale = baseScale * (highlight && visualStage >= 1 && visualStage <= 2 ? 1.36 : 1);
      ionSprite.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
      ionSprite.material.opacity += ((highlight || visualStage === 0 ? 1 : 0.72) - ionSprite.material.opacity) * 0.08;
    });

    threeView.crossIons.forEach((ionSprite) => {
      const { baseY, baseZ, phase, charge } = ionSprite.userData;
      ionSprite.position.y = baseY + charge * 0.035 + Math.sin(timeSeconds * 0.7 + phase) * 0.01;
      ionSprite.position.z = baseZ + Math.cos(timeSeconds * 0.62 + phase) * 0.01;
    });

    const highlightedPositive = threeView.ions.find((ionSprite) => ionSprite.userData.highlight && ionSprite.userData.charge > 0);
    const highlightedNegative = threeView.ions.find((ionSprite) => ionSprite.userData.highlight && ionSprite.userData.charge < 0);
    if (highlightedPositive && highlightedNegative && threeView.forceArrows.posFB) {
      const progress = Math.min(1, Math.max(0, 1 - (threeView.transitionUntil - timestamp) / 850));
      const forceLength = 0.28 + Math.min(0.48, (liveVelocity / 0.3) * (state.B0 / 0.5) * 0.22);
      const electricLength = visualStage === 2 ? forceLength * progress : forceLength;
      threeView.forceArrows.posFB.position.copy(highlightedPositive.position).add(new THREE.Vector3(0, 0.06, 0.18));
      threeView.forceArrows.negFB.position.copy(highlightedNegative.position).add(new THREE.Vector3(0, -0.06, 0.18));
      threeView.forceArrows.posFE.position.copy(highlightedPositive.position).add(new THREE.Vector3(0, -0.06, 0.25));
      threeView.forceArrows.negFE.position.copy(highlightedNegative.position).add(new THREE.Vector3(0, 0.06, 0.25));
      threeView.forceArrows.posFE.setLength(electricLength, electricLength * 0.24, electricLength * 0.1);
      threeView.forceArrows.negFE.setLength(electricLength, electricLength * 0.24, electricLength * 0.1);
    }

    threeView.wirePulses.forEach((pulse, index) => {
      const points = pulse.userData.points;
      const pulseSpeed = state.mode === 'explore' ? 0.28 + liveVelocity * 2.2 : 0.7;
      const phase = (timeSeconds * pulseSpeed + index * 0.42) % 1;
      const firstLeg = phase < 0.55;
      const local = firstLeg ? phase / 0.55 : (phase - 0.55) / 0.45;
      const a = firstLeg ? points[0] : points[1];
      const b = firstLeg ? points[1] : points[2];
      pulse.position.copy(a).lerp(b, local);
      pulse.material.opacity += ((visualStage >= 4 ? 0.9 : 0) - pulse.material.opacity) * 0.1;
    });

    Object.values(threeView.groups).forEach(updateGroupOpacity);
    applyExploreVisualDynamics({ velocity: liveVelocity, magneticField: state.B0, visualStage });
    Object.values(threeView.meterDisplays).forEach((display) => {
      if (display?.userData?.billboard) {
        display.quaternion.copy(threeView.camera.quaternion);
      }
    });

    if (state.mode !== 'explore' && (timestamp < threeView.transitionUntil || timestamp - threeView.lastInteraction > 5000)) {
      threeView.camera.position.lerp(threeView.defaultPosition, 0.035);
      threeView.controls.target.lerp(threeView.defaultTarget, 0.035);
    }
    threeView.controls.update();
    updateProjectedLabels();
    threeView.renderer.render(threeView.scene, threeView.camera);
  }
  if (state.mode === 'explore') {
    const trueVelocity = currentVelocity(timeSeconds);
    const deltaV = noisyMeasurement(calculateDeltaV(trueVelocity, state.B0, state.r0Mm));
    state.graph.push({ time: timeSeconds, value: Math.max(0, deltaV) });
    if (state.graph.length > 160) state.graph.shift();

    if (timestamp - state.lastTimestamp > 120) {
      updateMeasurementDisplay(timeSeconds);
      state.lastTimestamp = timestamp;
    }
    drawGraph();
  }
  requestAnimationFrame(animate);
}

function setMode(mode) {
  state.mode = mode;
  window.scrollTo({ top: 0, behavior: 'instant' });
  const isLearn = mode === 'learn';
  dom.learnView.hidden = !isLearn;
  dom.exploreView.hidden = isLearn;
  dom.learnMode.classList.toggle('active', isLearn);
  dom.exploreMode.classList.toggle('active', !isLearn);
  if (isLearn) renderLearnStage();
  else {
    state.graph = [];
    mountThreeStage(dom.exploreVisual);
    updateThreeStage(4);
    applyExploreCameraView();
    renderExplorePanel();
    updateMeasurementDisplay(performance.now() / 1000);
    drawGraph();
  }
}

function applyGuideVisibility() {
  if (!threeView.initialized) return;
  const measurementStage = state.mode === 'explore' ? 4 : state.stage;
  const { groups } = threeView;
  setGroupTargetOpacity(
    groups.fieldGuides,
    state.showFieldGuides && measurementStage >= 1 ? (measurementStage === 3 ? 0.72 : 1) : 0,
  );
  setGroupTargetOpacity(groups.electric, state.showFieldGuides && (measurementStage === 2 || measurementStage === 3 || measurementStage >= 4) ? 1 : 0);
  setGroupTargetOpacity(groups.forceB, state.showForceGuides && (measurementStage === 1 || measurementStage === 2 || measurementStage >= 4) ? 1 : 0);
  setGroupTargetOpacity(groups.forceE, state.showForceGuides && measurementStage === 2 ? 1 : 0);
}

function syncGuideToggles() {
  if (dom.tagGuides) dom.tagGuides.checked = state.showTags;
  if (dom.fieldGuides) dom.fieldGuides.checked = state.showFieldGuides;
  if (dom.forceGuides) dom.forceGuides.checked = state.showForceGuides;
  if (threeView.initialized) {
    if (state.showTags && threeView.labels && !threeView.labels.children.length) {
      add3DLabels(state.mode === 'explore' ? 4 : state.stage);
    }
    applyGuideVisibility();
    updateProjectedLabels();
  }
}

dom.previousStage.addEventListener('click', () => {
  state.stage = Math.max(0, state.stage - 1);
  renderLearnStage();
});

dom.nextStage.addEventListener('click', () => {
  state.stage = Math.min(stages.length - 1, state.stage + 1);
  renderLearnStage();
});

dom.learnMode.addEventListener('click', () => setMode('learn'));
dom.exploreMode.addEventListener('click', () => setMode('explore'));

dom.exploreRail?.querySelectorAll('[data-explore-panel]').forEach((button) => {
  button.addEventListener('click', () => {
    state.explorePanel = button.dataset.explorePanel;
    renderExplorePanel();
  });
});

dom.tagGuides.addEventListener('change', (event) => {
  state.showTags = event.target.checked;
  syncGuideToggles();
});

dom.fieldGuides.addEventListener('change', (event) => {
  state.showFieldGuides = event.target.checked;
  syncGuideToggles();
});

dom.forceGuides.addEventListener('change', (event) => {
  state.showForceGuides = event.target.checked;
  syncGuideToggles();
});

dom.velocity.addEventListener('input', (event) => {
  state.vBase = Number(event.target.value);
  updateMeasurementDisplay(performance.now() / 1000);
});

dom.magneticField.addEventListener('input', (event) => {
  state.B0 = Number(event.target.value);
  updateMeasurementDisplay(performance.now() / 1000);
});

dom.radius.addEventListener('input', (event) => {
  state.r0Mm = Number(event.target.value);
  updateMeasurementDisplay(performance.now() / 1000);
});

dom.noise.addEventListener('input', (event) => {
  state.noise = Number(event.target.value);
  updateMeasurementDisplay(performance.now() / 1000);
});

dom.pulsatile.addEventListener('change', (event) => {
  state.pulsatile = event.target.checked;
  state.graph = [];
  updateMeasurementDisplay(performance.now() / 1000);
});

renderLearnStage();
renderStaticLatex();
updateMeasurementDisplay(0);
requestAnimationFrame(animate);

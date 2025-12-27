// FILE: docs/src/index.js
import { createStateStore } from './state.js';
import { DEFAULTS, resolveDims } from './params.js';
import { boot, disposeAll } from './renderer/babylon.js';
import * as Base from './elements/base.js';
import * as Walls from './elements/walls.js';
import { renderBOM } from './bom/index.js';

window.__dbg = window.__dbg || { lastError: null, frames: 0, buildCalls: 0, engine: null, scene: null };
window.addEventListener('error', (e) => {
  window.__dbg.lastError = (e && e.message) ? e.message : String(e);
});

const statusOverlayEl = document.getElementById('statusOverlay');

const canvas = document.getElementById('renderCanvas');
const viewSelect = document.getElementById('viewSelect');

const ctx = boot(canvas);
window.__dbg.engine = ctx?.engine || null;
window.__dbg.scene = ctx?.scene || null;

if (window.__dbg.engine?.onEndFrameObservable?.add) {
  window.__dbg.engine.onEndFrameObservable.add(() => { window.__dbg.frames += 1; });
}

const store = createStateStore(DEFAULTS);

const vWallsEl = document.getElementById('vWalls');
const vBaseEl = document.getElementById('vBase');
const vFrameEl = document.getElementById('vFrame');
const vInsEl = document.getElementById('vIns');
const vDeckEl = document.getElementById('vDeck');

const vWallFrontEl = document.getElementById('vWallFront');
const vWallBackEl = document.getElementById('vWallBack');
const vWallLeftEl = document.getElementById('vWallLeft');
const vWallRightEl = document.getElementById('vWallRight');

const dimModeEl = document.getElementById('dimMode');
const wInputEl = document.getElementById('wInput');
const dInputEl = document.getElementById('dInput');

const overUniformEl = document.getElementById('roofOverUniform');
const overFrontEl = document.getElementById('roofOverFront');
const overBackEl = document.getElementById('roofOverBack');
const overLeftEl = document.getElementById('roofOverLeft');
const overRightEl = document.getElementById('roofOverRight');

const wallsVariantEl = document.getElementById('wallsVariant');
const wallHeightEl = document.getElementById('wallHeight');

const doorEnabledEl = document.getElementById('doorEnabled');
const doorXEl = document.getElementById('doorX');
const doorWEl = document.getElementById('doorW');
const doorHEl = document.getElementById('doorH');

function render(state) {
  window.__dbg.buildCalls += 1;

  const R = resolveDims(state);
  const baseState = { ...state, w: R.base.w_mm, d: R.base.d_mm };
  const wallState = { ...state, w: R.frame.w_mm, d: R.frame.d_mm };

  disposeAll(ctx.scene);

  Base.build3D(baseState, ctx);

  const parts = state.vis?.walls || { front: true, back: true, left: true, right: true };
  const anyWallOn = !!state.vis?.wallsEnabled && (parts.front || parts.back || parts.left || parts.right);
  if (anyWallOn) {
    Walls.build3D(wallState, ctx);
  }

  const bom = Walls.updateBOM(wallState);
  renderBOM(bom.sections);

  Base.updateBOM(baseState);
}

store.onChange(render);

const asPosInt = (v, def) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : def;
};
const asNonNegInt = (v, def = 0) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const asNullableInt = (v) => {
  if (v == null || v === '') return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function currentFrontWallLength() {
  const R = resolveDims(store.getState());
  return Math.max(1, Math.floor(R.frame.w_mm));
}

function clampDoorX(x, doorW) {
  const L = currentFrontWallLength();
  const maxX = Math.max(0, L - doorW);
  return Math.max(0, Math.min(maxX, x));
}

function syncUiFromState(state) {
  dimModeEl.value = state.dimMode;
  if (state.dimMode === 'base') {
    wInputEl.value = String(state.dimInputs.baseW_mm);
    dInputEl.value = String(state.dimInputs.baseD_mm);
  } else if (state.dimMode === 'frame') {
    wInputEl.value = String(state.dimInputs.frameW_mm);
    dInputEl.value = String(state.dimInputs.frameD_mm);
  } else {
    wInputEl.value = String(state.dimInputs.roofW_mm);
    dInputEl.value = String(state.dimInputs.roofD_mm);
  }

  overUniformEl.value = String(state.overhang.uniform_mm ?? 0);
  overLeftEl.value = state.overhang.left_mm == null ? '' : String(state.overhang.left_mm);
  overRightEl.value = state.overhang.right_mm == null ? '' : String(state.overhang.right_mm);
  overFrontEl.value = state.overhang.front_mm == null ? '' : String(state.overhang.front_mm);
  overBackEl.value = state.overhang.back_mm == null ? '' : String(state.overhang.back_mm);

  vBaseEl.checked = !!state.vis.base;
  vFrameEl.checked = !!state.vis.frame;
  vInsEl.checked = !!state.vis.ins;
  vDeckEl.checked = !!state.vis.deck;

  vWallsEl.checked = !!state.vis.wallsEnabled;

  const parts = state.vis?.walls || { front: true, back: true, left: true, right: true };
  vWallFrontEl.checked = !!parts.front;
  vWallBackEl.checked = !!parts.back;
  vWallLeftEl.checked = !!parts.left;
  vWallRightEl.checked = !!parts.right;

  wallsVariantEl.value = state.walls.variant;
  wallHeightEl.value = String(state.walls.height_mm);

  const door = state.walls.openings[0];
  doorEnabledEl.checked = !!door.enabled;
  doorXEl.value = String(door.x_mm);
  doorWEl.value = String(door.width_mm);
  doorHEl.value = String(door.height_mm);
}

vWallsEl.addEventListener('change', (e) => {
  const on = !!e.target.checked;
  store.setState({
    vis: {
      wallsEnabled: on,
      walls: { front: on, back: on, left: on, right: on }
    }
  });
});

vBaseEl.addEventListener('change', (e) => { store.setState({ vis: { base: e.target.checked } }); });
vFrameEl.addEventListener('change', (e) => { store.setState({ vis: { frame: e.target.checked } }); });
vInsEl.addEventListener('change', (e) => { store.setState({ vis: { ins: e.target.checked } }); });
vDeckEl.addEventListener('change', (e) => { store.setState({ vis: { deck: e.target.checked } }); });

vWallFrontEl.addEventListener('change', (e) => { store.setState({ vis: { walls: { front: !!e.target.checked } } }); });
vWallBackEl.addEventListener('change', (e) => { store.setState({ vis: { walls: { back: !!e.target.checked } } }); });
vWallLeftEl.addEventListener('change', (e) => { store.setState({ vis: { walls: { left: !!e.target.checked } } }); });
vWallRightEl.addEventListener('change', (e) => { store.setState({ vis: { walls: { right: !!e.target.checked } } }); });

dimModeEl.addEventListener('change', () => {
  store.setState({ dimMode: dimModeEl.value });
  syncUiFromState(store.getState());
});

function writeActiveDims() {
  const s = store.getState();
  const w = asPosInt(wInputEl.value, (s.dimInputs.baseW_mm));
  const d = asPosInt(dInputEl.value, (s.dimInputs.baseD_mm));
  if (s.dimMode === 'base') {
    store.setState({ dimInputs: { baseW_mm: w, baseD_mm: d } });
  } else if (s.dimMode === 'frame') {
    store.setState({ dimInputs: { frameW_mm: w, frameD_mm: d } });
  } else {
    store.setState({ dimInputs: { roofW_mm: w, roofD_mm: d } });
  }
}
wInputEl.addEventListener('input', writeActiveDims);
dInputEl.addEventListener('input', writeActiveDims);

overUniformEl.addEventListener('input', () => {
  const n = Math.max(0, Math.floor(Number(overUniformEl.value || 0)));
  store.setState({ overhang: { uniform_mm: Number.isFinite(n) ? n : 0 } });
});
overLeftEl.addEventListener('input', () => store.setState({ overhang: { left_mm: asNullableInt(overLeftEl.value) } }));
overRightEl.addEventListener('input', () => store.setState({ overhang: { right_mm: asNullableInt(overRightEl.value) } }));
overFrontEl.addEventListener('input', () => store.setState({ overhang: { front_mm: asNullableInt(overFrontEl.value) } }));
overBackEl.addEventListener('input', () => store.setState({ overhang: { back_mm: asNullableInt(overBackEl.value) } }));

wallsVariantEl.addEventListener('change', () => { store.setState({ walls: { variant: wallsVariantEl.value } }); });
wallHeightEl.addEventListener('input', () => { store.setState({ walls: { height_mm: asPosInt(wallHeightEl.value, 2400) } }); });

doorEnabledEl.addEventListener('change', () => {
  const s = store.getState();
  const enabled = !!doorEnabledEl.checked;
  const cur = s.walls.openings[0];
  if (enabled) {
    const L = currentFrontWallLength();
    const doorW = asPosInt(cur.width_mm, 900);
    const centered = Math.floor((L - doorW) / 2);
    const clamped = clampDoorX(centered, doorW);
    const o = { ...cur, enabled: true, x_mm: clamped };
    store.setState({ walls: { openings: [o] } });
  } else {
    const o = { ...cur, enabled: false };
    store.setState({ walls: { openings: [o] } });
  }
});

doorXEl.addEventListener('input', () => {
  const s = store.getState();
  const cur = s.walls.openings[0];
  const doorW = asPosInt(cur.width_mm, 900);
  const x = asNonNegInt(doorXEl.value, cur.x_mm);
  const clamped = clampDoorX(x, doorW);
  const o = { ...cur, x_mm: clamped };
  store.setState({ walls: { openings: [o] } });
});

doorWEl.addEventListener('input', () => {
  const s = store.getState();
  const cur = s.walls.openings[0];
  const w = asPosInt(doorWEl.value, cur.width_mm);
  const clampedX = clampDoorX(cur.x_mm ?? 0, w);
  const o = { ...cur, width_mm: w, x_mm: clampedX };
  store.setState({ walls: { openings: [o] } });
});

doorHEl.addEventListener('input', () => {
  const s = store.getState();
  const cur = s.walls.openings[0];
  const h = asPosInt(doorHEl.value, cur.height_mm);
  const clampedX = clampDoorX(cur.x_mm ?? 0, asPosInt(cur.width_mm, 900));
  const o = { ...cur, height_mm: h, x_mm: clampedX };
  store.setState({ walls: { openings: [o] } });
});

/* Diagnostics overlay updater (1Hz) */
function updateOverlay() {
  if (!statusOverlayEl) return;
  const hasBabylon = (typeof window.BABYLON !== 'undefined');
  const engine = window.__dbg.engine;
  const scene = window.__dbg.scene;
  const meshes = scene?.meshes ? scene.meshes.length : 0;

  const btn = document.getElementById('controlsToggle');
  const controls = document.getElementById('controls');
  const uiLayer = document.getElementById('ui-layer');

  statusOverlayEl.textContent =
`BABYLON: ${hasBabylon}
engine: ${!!engine}
scene: ${!!scene}
frames: ${window.__dbg.frames}
buildCalls: ${window.__dbg.buildCalls}
scene.meshes: ${meshes}
controlsToggle: ${btn ? btn.tagName : 'missing'}
controls: ${!!controls}
ui-layer: ${!!uiLayer}
ui-hidden: ${document.body.classList.contains('ui-hidden')}
lastError: ${window.__dbg.lastError ?? ''}`;
}
setInterval(updateOverlay, 1000);
updateOverlay();

/* Initial view (3D) even if module wiring is flaky */
window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.remove('ui-hidden');
  if (viewSelect) {
    viewSelect.value = '3d';
    if (typeof viewSelect.onchange === 'function') viewSelect.onchange.call(viewSelect);
    else viewSelect.dispatchEvent(new Event('change'));
  } else {
    const bomPage = document.getElementById('bomPage');
    const wallsPage = document.getElementById('wallsBomPage');
    if (bomPage) bomPage.style.display = 'none';
    if (wallsPage) wallsPage.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
  }
});

/* Build + render */
syncUiFromState(store.getState());
render(store.getState());
```0

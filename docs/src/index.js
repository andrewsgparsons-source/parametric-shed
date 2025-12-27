// FILE: docs/src/index.js
window.__dbg = window.__dbg || {};
window.__dbg.initStarted = true;
window.__dbg.initFinished = false;

import { createStateStore } from "./state.js";
import { DEFAULTS, resolveDims } from "./params.js";
import { boot, disposeAll } from "./renderer/babylon.js";
import * as Base from "./elements/base.js";
import * as Walls from "./elements/walls.js";
import { renderBOM } from "./bom/index.js";

(function init() {
  window.__dbg.engine ??= null;
  window.__dbg.scene ??= null;
  window.__dbg.camera ??= null;
  window.__dbg.frames ??= 0;
  window.__dbg.buildCalls ??= 0;
  window.__dbg.lastError ??= null;

  window.addEventListener("error", (e) => {
    window.__dbg.lastError = (e && e.message) ? e.message : String(e);
  });
  window.addEventListener("unhandledrejection", (e) => {
    window.__dbg.lastError = (e && e.reason) ? String(e.reason) : "unhandledrejection";
  });

  const canvas = document.getElementById("renderCanvas");
  const statusOverlayEl = document.getElementById("statusOverlay");

  const ctx = boot(canvas);

  window.__dbg.engine = ctx?.engine || null;
  window.__dbg.scene = ctx?.scene || null;
  window.__dbg.camera = ctx?.camera || null;

  if (window.__dbg.engine?.onEndFrameObservable?.add) {
    window.__dbg.engine.onEndFrameObservable.add(() => {
      window.__dbg.frames += 1;
    });
  }

  const store = createStateStore(DEFAULTS);

  const viewSelect = document.getElementById("viewSelect");

  const vWallsEl = document.getElementById("vWalls");
  const vBaseEl = document.getElementById("vBase");
  const vFrameEl = document.getElementById("vFrame");
  const vInsEl = document.getElementById("vIns");
  const vDeckEl = document.getElementById("vDeck");

  const vWallFrontEl = document.getElementById("vWallFront");
  const vWallBackEl = document.getElementById("vWallBack");
  const vWallLeftEl = document.getElementById("vWallLeft");
  const vWallRightEl = document.getElementById("vWallRight");

  const dimModeEl = document.getElementById("dimMode");
  const wInputEl = document.getElementById("wInput");
  const dInputEl = document.getElementById("dInput");

  const overUniformEl = document.getElementById("roofOverUniform");
  const overFrontEl = document.getElementById("roofOverFront");
  const overBackEl = document.getElementById("roofOverBack");
  const overLeftEl = document.getElementById("roofOverLeft");
  const overRightEl = document.getElementById("roofOverRight");

  const wallsVariantEl = document.getElementById("wallsVariant");
  const wallHeightEl = document.getElementById("wallHeight");

  const doorEnabledEl = document.getElementById("doorEnabled");
  const doorXEl = document.getElementById("doorX");
  const doorWEl = document.getElementById("doorW");
  const doorHEl = document.getElementById("doorH");

  const asPosInt = (v, def) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : def;
  };

  const asNonNegInt = (v, def = 0) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : def;
  };

  const asNullableInt = (v) => {
    if (v == null || v === "") return null;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  function getWallsEnabled(state) {
    const vw = state?.vis?.walls;
    if (typeof vw === "boolean") return vw;
    if (typeof state?.vis?.wallsEnabled === "boolean") return state.vis.wallsEnabled;
    return true;
  }

  function getWallParts(state) {
    const vw = state?.vis?.walls;
    if (vw && typeof vw === "object") {
      return {
        front: vw.front !== false,
        back: vw.back !== false,
        left: vw.left !== false,
        right: vw.right !== false,
      };
    }
    const parts = state?.vis?.wallsParts;
    if (parts && typeof parts === "object") {
      return {
        front: parts.front !== false,
        back: parts.back !== false,
        left: parts.left !== false,
        right: parts.right !== false,
      };
    }
    return { front: true, back: true, left: true, right: true };
  }

  function resume3D() {
    const engine = window.__dbg.engine;
    const scene = window.__dbg.scene;
    const camera = window.__dbg.camera;

    if (canvas) canvas.style.display = "block";

    const bomPage = document.getElementById("bomPage");
    const wallsPage = document.getElementById("wallsBomPage");
    if (bomPage) bomPage.style.display = "none";
    if (wallsPage) wallsPage.style.display = "none";

    if (engine?.resize) engine.resize();
    if (camera?.attachControl) camera.attachControl(canvas, true);
    if (scene?.render) scene.render();
  }

  function currentFrontWallLength(state) {
    const R = resolveDims(state);
    return Math.max(1, Math.floor(R.frame.w_mm));
  }

  function clampDoorX(x, doorW, wallLen) {
    const maxX = Math.max(0, wallLen - doorW);
    return Math.max(0, Math.min(maxX, x));
  }

  function render(state) {
    window.__dbg.buildCalls += 1;

    const R = resolveDims(state);
    const baseState = { ...state, w: R.base.w_mm, d: R.base.d_mm };
    const wallState = { ...state, w: R.frame.w_mm, d: R.frame.d_mm };

    disposeAll(ctx.scene);

    Base.build3D(baseState, ctx);

    if (getWallsEnabled(state)) {
      Walls.build3D(wallState, ctx);
    }

    const wallsBom = Walls.updateBOM(wallState);
    renderBOM(wallsBom.sections);

    Base.updateBOM(baseState);
  }

  function syncUiFromState(state) {
    if (dimModeEl) dimModeEl.value = state.dimMode ?? "base";

    if (wInputEl && dInputEl && state.dimInputs && state.dimMode) {
      if (state.dimMode === "base") {
        wInputEl.value = String(state.dimInputs.baseW_mm);
        dInputEl.value = String(state.dimInputs.baseD_mm);
      } else if (state.dimMode === "frame") {
        wInputEl.value = String(state.dimInputs.frameW_mm);
        dInputEl.value = String(state.dimInputs.frameD_mm);
      } else {
        wInputEl.value = String(state.dimInputs.roofW_mm);
        dInputEl.value = String(state.dimInputs.roofD_mm);
      }
    } else {
      if (wInputEl && state.w != null) wInputEl.value = String(state.w);
      if (dInputEl && state.d != null) dInputEl.value = String(state.d);
    }

    if (overUniformEl && state.overhang) overUniformEl.value = String(state.overhang.uniform_mm ?? 0);
    if (overLeftEl && state.overhang) overLeftEl.value = state.overhang.left_mm == null ? "" : String(state.overhang.left_mm);
    if (overRightEl && state.overhang) overRightEl.value = state.overhang.right_mm == null ? "" : String(state.overhang.right_mm);
    if (overFrontEl && state.overhang) overFrontEl.value = state.overhang.front_mm == null ? "" : String(state.overhang.front_mm);
    if (overBackEl && state.overhang) overBackEl.value = state.overhang.back_mm == null ? "" : String(state.overhang.back_mm);

    if (vBaseEl) vBaseEl.checked = !!state?.vis?.base;
    if (vFrameEl) vFrameEl.checked = !!state?.vis?.frame;
    if (vInsEl) vInsEl.checked = !!state?.vis?.ins;
    if (vDeckEl) vDeckEl.checked = !!state?.vis?.deck;

    if (vWallsEl) vWallsEl.checked = getWallsEnabled(state);

    const parts = getWallParts(state);
    if (vWallFrontEl) vWallFrontEl.checked = !!parts.front;
    if (vWallBackEl) vWallBackEl.checked = !!parts.back;
    if (vWallLeftEl) vWallLeftEl.checked = !!parts.left;
    if (vWallRightEl) vWallRightEl.checked = !!parts.right;

    if (wallsVariantEl && state?.walls?.variant) wallsVariantEl.value = state.walls.variant;
    if (wallHeightEl && state?.walls?.height_mm != null) wallHeightEl.value = String(state.walls.height_mm);

    const door = state?.walls?.openings?.[0];
    if (door) {
      if (doorEnabledEl) doorEnabledEl.checked = !!door.enabled;
      if (doorXEl && door.x_mm != null) doorXEl.value = String(door.x_mm);
      if (doorWEl && door.width_mm != null) doorWEl.value = String(door.width_mm);
      if (doorHEl && door.height_mm != null) doorHEl.value = String(door.height_mm);
    }
  }

  function updateOverlay() {
    if (!statusOverlayEl) return;

    const hasBabylon = typeof window.BABYLON !== "undefined";
    const cw = canvas?.clientWidth ?? 0;
    const ch = canvas?.clientHeight ?? 0;

    const engine = window.__dbg.engine;
    const scene = window.__dbg.scene;
    const camera = window.__dbg.camera;

    const meshes = scene?.meshes?.length ?? 0;
    const err = (window.__dbg.lastError || "").slice(0, 200);

    statusOverlayEl.textContent =
`BABYLON loaded: ${hasBabylon}
Canvas: ${cw} x ${ch}
Engine: ${!!engine}
Scene: ${!!scene}
Camera: ${!!camera}
Frames: ${window.__dbg.frames}
BuildCalls: ${window.__dbg.buildCalls}
Meshes: ${meshes}
LastError: ${err}`;
  }

  // --- Wiring (no schema surprises) ---
  if (viewSelect && !viewSelect._wiredResume) {
    viewSelect._wiredResume = true;
    viewSelect.addEventListener("change", () => {
      if (viewSelect.value === "3d") resume3D();
    });
  }

  if (vWallsEl) {
    vWallsEl.addEventListener("change", (e) => {
      const s = store.getState();
      const on = !!e.target.checked;

      // Patch whichever overall-walls key already exists.
      if (typeof s?.vis?.walls === "boolean") store.setState({ vis: { walls: on } });
      else if (typeof s?.vis?.wallsEnabled === "boolean") store.setState({ vis: { wallsEnabled: on } });
      else store.setState({ vis: { walls: on } }); // minimal fallback for older shapes
    });
  }

  if (vBaseEl) vBaseEl.addEventListener("change", (e) => store.setState({ vis: { base: !!e.target.checked } }));
  if (vFrameEl) vFrameEl.addEventListener("change", (e) => store.setState({ vis: { frame: !!e.target.checked } }));
  if (vInsEl) vInsEl.addEventListener("change", (e) => store.setState({ vis: { ins: !!e.target.checked } }));
  if (vDeckEl) vDeckEl.addEventListener("change", (e) => store.setState({ vis: { deck: !!e.target.checked } }));

  function patchWallPart(key, value) {
    const s = store.getState();

    // Only patch into an existing object container (no new schema guessing).
    if (s?.vis?.walls && typeof s.vis.walls === "object") {
      store.setState({ vis: { walls: { [key]: value } } });
      return;
    }
    if (s?.vis?.wallsParts && typeof s.vis.wallsParts === "object") {
      store.setState({ vis: { wallsParts: { [key]: value } } });
      return;
    }

    // If nothing exists, still re-render safely via a no-op state tick.
    store.setState({ _noop: Date.now() });
  }

  if (vWallFrontEl) vWallFrontEl.addEventListener("change", (e) => patchWallPart("front", !!e.target.checked));
  if (vWallBackEl) vWallBackEl.addEventListener("change", (e) => patchWallPart("back", !!e.target.checked));
  if (vWallLeftEl) vWallLeftEl.addEventListener("change", (e) => patchWallPart("left", !!e.target.checked));
  if (vWallRightEl) vWallRightEl.addEventListener("change", (e) => patchWallPart("right", !!e.target.checked));

  if (dimModeEl) {
    dimModeEl.addEventListener("change", () => {
      store.setState({ dimMode: dimModeEl.value });
      syncUiFromState(store.getState());
    });
  }

  function writeActiveDims() {
    const s = store.getState();
    const w = asPosInt(wInputEl?.value, 1000);
    const d = asPosInt(dInputEl?.value, 1000);

    if (s.dimInputs && s.dimMode) {
      if (s.dimMode === "base") store.setState({ dimInputs: { baseW_mm: w, baseD_mm: d } });
      else if (s.dimMode === "frame") store.setState({ dimInputs: { frameW_mm: w, frameD_mm: d } });
      else store.setState({ dimInputs: { roofW_mm: w, roofD_mm: d } });
    } else {
      store.setState({ w, d });
    }
  }
  if (wInputEl) wInputEl.addEventListener("input", writeActiveDims);
  if (dInputEl) dInputEl.addEventListener("input", writeActiveDims);

  if (overUniformEl) {
    overUniformEl.addEventListener("input", () => {
      const n = Math.max(0, Math.floor(Number(overUniformEl.value || 0)));
      store.setState({ overhang: { uniform_mm: Number.isFinite(n) ? n : 0 } });
    });
  }
  if (overLeftEl) overLeftEl.addEventListener("input", () => store.setState({ overhang: { left_mm: asNullableInt(overLeftEl.value) } }));
  if (overRightEl) overRightEl.addEventListener("input", () => store.setState({ overhang: { right_mm: asNullableInt(overRightEl.value) } }));
  if (overFrontEl) overFrontEl.addEventListener("input", () => store.setState({ overhang: { front_mm: asNullableInt(overFrontEl.value) } }));
  if (overBackEl) overBackEl.addEventListener("input", () => store.setState({ overhang: { back_mm: asNullableInt(overBackEl.value) } }));

  if (wallsVariantEl) wallsVariantEl.addEventListener("change", () => store.setState({ walls: { variant: wallsVariantEl.value } }));
  if (wallHeightEl) wallHeightEl.addEventListener("input", () => store.setState({ walls: { height_mm: asPosInt(wallHeightEl.value, 2400) } }));

  function patchDoor(patch) {
    const s = store.getState();
    const cur = s?.walls?.openings?.[0];
    if (!cur) return;
    store.setState({ walls: { openings: [{ ...cur, ...patch }] } });
  }

  if (doorEnabledEl) {
    doorEnabledEl.addEventListener("change", () => {
      const s = store.getState();
      const cur = s?.walls?.openings?.[0];
      if (!cur) return;

      const enabled = !!doorEnabledEl.checked;
      if (!enabled) {
        patchDoor({ enabled: false });
        return;
      }

      const wallLen = currentFrontWallLength(s);
      const doorW = asPosInt(cur.width_mm, 900);
      const centered = Math.floor((wallLen - doorW) / 2);
      const clamped = clampDoorX(centered, doorW, wallLen);
      patchDoor({ enabled: true, x_mm: clamped });
    });
  }

  if (doorXEl) {
    doorXEl.addEventListener("input", () => {
      const s = store.getState();
      const cur = s?.walls?.openings?.[0];
      if (!cur) return;

      const wallLen = currentFrontWallLength(s);
      const doorW = asPosInt(cur.width_mm, 900);
      const x = asNonNegInt(doorXEl.value, cur.x_mm ?? 0);
      patchDoor({ x_mm: clampDoorX(x, doorW, wallLen) });
    });
  }

  if (doorWEl) {
    doorWEl.addEventListener("input", () => {
      const s = store.getState();
      const cur = s?.walls?.openings?.[0];
      if (!cur) return;

      const wallLen = currentFrontWallLength(s);
      const w = asPosInt(doorWEl.value, cur.width_mm ?? 900);
      const x = clampDoorX(cur.x_mm ?? 0, w, wallLen);
      patchDoor({ width_mm: w, x_mm: x });
    });
  }

  if (doorHEl) doorHEl.addEventListener("input", () => patchDoor({ height_mm: asPosInt(doorHEl.value, 2000) }));

  // --- Start ---
  store.onChange((s) => {
    syncUiFromState(s);
    render(s);
  });

  setInterval(updateOverlay, 1000);
  updateOverlay();

  window.addEventListener("DOMContentLoaded", () => {
    if (viewSelect) viewSelect.value = "3d";
    resume3D();
  });

  syncUiFromState(store.getState());
  render(store.getState());

  window.__dbg.initFinished = true;
})();

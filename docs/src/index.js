// FILE: docs/src/index.js
// NO-DRIFT: Orchestration only. Keeps existing parameters, dimensions, and element logic stable.

window.__dbg = window.__dbg || {};
window.__dbg.initStarted = true;
window.__dbg.initFinished = false;

// Avoid newer syntax that can break on some Android WebViews (no ??=, minimal optional chaining).
function dbgInitDefaults() {
  if (window.__dbg.engine === undefined) window.__dbg.engine = null;
  if (window.__dbg.scene === undefined) window.__dbg.scene = null;
  if (window.__dbg.camera === undefined) window.__dbg.camera = null;
  if (window.__dbg.frames === undefined) window.__dbg.frames = 0;
  if (window.__dbg.buildCalls === undefined) window.__dbg.buildCalls = 0;
  if (window.__dbg.lastError === undefined) window.__dbg.lastError = null;
}
dbgInitDefaults();

window.addEventListener("error", (e) => {
  window.__dbg.lastError = (e && e.message) ? e.message : String(e);
});
window.addEventListener("unhandledrejection", (e) => {
  window.__dbg.lastError = (e && e.reason) ? String(e.reason) : "unhandledrejection";
});

import { createStateStore } from "./state.js";
import { DEFAULTS, resolveDims } from "./params.js";
import { boot, disposeAll } from "./renderer/babylon.js";
import * as Base from "./elements/base.js";
import * as Walls from "./elements/walls.js";
import { renderBOM } from "./bom/index.js";

(function init() {
  try {
    const canvas = document.getElementById("renderCanvas");
    const statusOverlayEl = document.getElementById("statusOverlay");

    if (!canvas) {
      window.__dbg.lastError = "renderCanvas not found";
      return;
    }

    // Boot renderer
    let ctx = null;
    try {
      ctx = boot(canvas);
    } catch (e) {
      window.__dbg.lastError = "boot(canvas) failed: " + String(e && e.message ? e.message : e);
      return;
    }

    // Record ctx fields (defensive)
    window.__dbg.engine = (ctx && ctx.engine) ? ctx.engine : null;
    window.__dbg.scene = (ctx && ctx.scene) ? ctx.scene : null;
    window.__dbg.camera = (ctx && ctx.camera) ? ctx.camera : null;

    // Frames counter (defensive)
    try {
      const eng = window.__dbg.engine;
      if (eng && eng.onEndFrameObservable && typeof eng.onEndFrameObservable.add === "function") {
        eng.onEndFrameObservable.add(() => { window.__dbg.frames += 1; });
      }
    } catch (e) {
      // don't fail init
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
      const vis = state && state.vis ? state.vis : null;
      if (vis && typeof vis.walls === "boolean") return vis.walls;
      if (vis && typeof vis.wallsEnabled === "boolean") return vis.wallsEnabled;
      return true;
    }

    function getWallParts(state) {
      const vis = state && state.vis ? state.vis : null;

      // vis.walls as object container
      if (vis && vis.walls && typeof vis.walls === "object") {
        return {
          front: vis.walls.front !== false,
          back: vis.walls.back !== false,
          left: vis.walls.left !== false,
          right: vis.walls.right !== false,
        };
      }

      // vis.wallsParts container
      if (vis && vis.wallsParts && typeof vis.wallsParts === "object") {
        return {
          front: vis.wallsParts.front !== false,
          back: vis.wallsParts.back !== false,
          left: vis.wallsParts.left !== false,
          right: vis.wallsParts.right !== false,
        };
      }

      return { front: true, back: true, left: true, right: true };
    }

    function resume3D() {
      const engine = window.__dbg.engine;
      const scene = window.__dbg.scene;
      const camera = window.__dbg.camera;

      canvas.style.display = "block";

      const bomPage = document.getElementById("bomPage");
      const wallsPage = document.getElementById("wallsBomPage");
      if (bomPage) bomPage.style.display = "none";
      if (wallsPage) wallsPage.style.display = "none";

      try { if (engine && typeof engine.resize === "function") engine.resize(); } catch (e) {}
      try { if (camera && typeof camera.attachControl === "function") camera.attachControl(canvas, true); } catch (e) {}
      try { if (scene && typeof scene.render === "function") scene.render(); } catch (e) {}
    }

    function currentFrontWallLength(state) {
      const R = resolveDims(state);
      return Math.max(1, Math.floor(R.frame.w_mm));
    }

    function clampDoorX(x, doorW, wallLen) {
      const maxX = Math.max(0, wallLen - doorW);
      return Math.max(0, Math.min(maxX, x));
    }

    function safeDispose() {
      // NO-DRIFT: just tolerant invocation so we don't crash before building geometry.
      try {
        // Try both calling conventions.
        try { disposeAll(ctx); return; } catch (e) {}
        try { disposeAll(ctx && ctx.scene ? ctx.scene : null); return; } catch (e) {}
        try { disposeAll(); } catch (e) {}
      } catch (e) {}
    }

    function render(state) {
      try {
        window.__dbg.buildCalls += 1;

        const R = resolveDims(state);
        const baseState = { ...state, w: R.base.w_mm, d: R.base.d_mm };
        const wallState = { ...state, w: R.frame.w_mm, d: R.frame.d_mm };

        safeDispose();

        // Base build
        if (Base && typeof Base.build3D === "function") {
          Base.build3D(baseState, ctx);
        }

        // Walls build
        if (getWallsEnabled(state)) {
          if (Walls && typeof Walls.build3D === "function") {
            Walls.build3D(wallState, ctx);
          }
        }

        // Walls BOM -> table
        if (Walls && typeof Walls.updateBOM === "function") {
          const wallsBom = Walls.updateBOM(wallState);
          if (wallsBom && wallsBom.sections) renderBOM(wallsBom.sections);
        }

        // Base BOM -> base page IDs
        if (Base && typeof Base.updateBOM === "function") {
          Base.updateBOM(baseState);
        }
      } catch (e) {
        window.__dbg.lastError = "render() failed: " + String(e && e.message ? e.message : e);
      }
    }

    function syncUiFromState(state) {
      try {
        if (dimModeEl) dimModeEl.value = (state && state.dimMode) ? state.dimMode : "base";

        if (wInputEl && dInputEl && state && state.dimInputs && state.dimMode) {
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
          if (wInputEl && state && state.w != null) wInputEl.value = String(state.w);
          if (dInputEl && state && state.d != null) dInputEl.value = String(state.d);
        }

        if (state && state.overhang) {
          if (overUniformEl) overUniformEl.value = String(state.overhang.uniform_mm ?? 0);
          if (overLeftEl) overLeftEl.value = state.overhang.left_mm == null ? "" : String(state.overhang.left_mm);
          if (overRightEl) overRightEl.value = state.overhang.right_mm == null ? "" : String(state.overhang.right_mm);
          if (overFrontEl) overFrontEl.value = state.overhang.front_mm == null ? "" : String(state.overhang.front_mm);
          if (overBackEl) overBackEl.value = state.overhang.back_mm == null ? "" : String(state.overhang.back_mm);
        }

        if (vBaseEl) vBaseEl.checked = !!(state && state.vis && state.vis.base);
        if (vFrameEl) vFrameEl.checked = !!(state && state.vis && state.vis.frame);
        if (vInsEl) vInsEl.checked = !!(state && state.vis && state.vis.ins);
        if (vDeckEl) vDeckEl.checked = !!(state && state.vis && state.vis.deck);

        if (vWallsEl) vWallsEl.checked = getWallsEnabled(state);

        const parts = getWallParts(state);
        if (vWallFrontEl) vWallFrontEl.checked = !!parts.front;
        if (vWallBackEl) vWallBackEl.checked = !!parts.back;
        if (vWallLeftEl) vWallLeftEl.checked = !!parts.left;
        if (vWallRightEl) vWallRightEl.checked = !!parts.right;

        if (wallsVariantEl && state && state.walls && state.walls.variant) wallsVariantEl.value = state.walls.variant;
        if (wallHeightEl && state && state.walls && state.walls.height_mm != null) wallHeightEl.value = String(state.walls.height_mm);

        const door = state && state.walls && state.walls.openings ? state.walls.openings[0] : null;
        if (door) {
          if (doorEnabledEl) doorEnabledEl.checked = !!door.enabled;
          if (doorXEl && door.x_mm != null) doorXEl.value = String(door.x_mm);
          if (doorWEl && door.width_mm != null) doorWEl.value = String(door.width_mm);
          if (doorHEl && door.height_mm != null) doorHEl.value = String(door.height_mm);
        }
      } catch (e) {
        window.__dbg.lastError = "syncUiFromState failed: " + String(e && e.message ? e.message : e);
      }
    }

    function updateOverlay() {
      if (!statusOverlayEl) return;

      const hasBabylon = typeof window.BABYLON !== "undefined";
      const cw = canvas ? (canvas.clientWidth || 0) : 0;
      const ch = canvas ? (canvas.clientHeight || 0) : 0;

      const engine = window.__dbg.engine;
      const scene = window.__dbg.scene;
      const camera = window.__dbg.camera;

      const meshes = (scene && scene.meshes) ? scene.meshes.length : 0;
      const err = (window.__dbg.lastError || "").slice(0, 200);

      statusOverlayEl.textContent =
        "BABYLON loaded: " + hasBabylon + "\n" +
        "Canvas: " + cw + " x " + ch + "\n" +
        "Engine: " + (!!engine) + "\n" +
        "Scene: " + (!!scene) + "\n" +
        "Camera: " + (!!camera) + "\n" +
        "Frames: " + window.__dbg.frames + "\n" +
        "BuildCalls: " + window.__dbg.buildCalls + "\n" +
        "Meshes: " + meshes + "\n" +
        "LastError: " + err;
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

        if (s && s.vis && typeof s.vis.walls === "boolean") store.setState({ vis: { walls: on } });
        else if (s && s.vis && typeof s.vis.wallsEnabled === "boolean") store.setState({ vis: { wallsEnabled: on } });
        else store.setState({ vis: { walls: on } });
      });
    }

    if (vBaseEl) vBaseEl.addEventListener("change", (e) => store.setState({ vis: { base: !!e.target.checked } }));
    if (vFrameEl) vFrameEl.addEventListener("change", (e) => store.setState({ vis: { frame: !!e.target.checked } }));
    if (vInsEl) vInsEl.addEventListener("change", (e) => store.setState({ vis: { ins: !!e.target.checked } }));
    if (vDeckEl) vDeckEl.addEventListener("change", (e) => store.setState({ vis: { deck: !!e.target.checked } }));

    function patchWallPart(key, value) {
      const s = store.getState();
      if (s && s.vis && s.vis.walls && typeof s.vis.walls === "object") {
        store.setState({ vis: { walls: { [key]: value } } });
        return;
      }
      if (s && s.vis && s.vis.wallsParts && typeof s.vis.wallsParts === "object") {
        store.setState({ vis: { wallsParts: { [key]: value } } });
        return;
      }
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
      const w = asPosInt(wInputEl ? wInputEl.value : null, 1000);
      const d = asPosInt(dInputEl ? dInputEl.value : null, 1000);

      if (s && s.dimInputs && s.dimMode) {
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
      const cur = s && s.walls && s.walls.openings ? s.walls.openings[0] : null;
      if (!cur) return;
      store.setState({ walls: { openings: [{ ...cur, ...patch }] } });
    }

    if (doorEnabledEl) {
      doorEnabledEl.addEventListener("change", () => {
        const s = store.getState();
        const cur = s && s.walls && s.walls.openings ? s.walls.openings[0] : null;
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
        const cur = s && s.walls && s.walls.openings ? s.walls.openings[0] : null;
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
        const cur = s && s.walls && s.walls.openings ? s.walls.openings[0] : null;
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

    // Kick everything once
    syncUiFromState(store.getState());
    render(store.getState());
    resume3D();

    window.__dbg.initFinished = true;
  } catch (e) {
    window.__dbg.lastError = "init() failed: " + String(e && e.message ? e.message : e);
    window.__dbg.initFinished = false;
  }
})();

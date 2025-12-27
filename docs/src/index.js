// docs/src/index.js
// Entry point (GitHub Pages /docs safe). NO-DRIFT: orchestration + diagnostics only.

import * as StoreMod from "./state.js";
import * as ParamsMod from "./params.js";
import * as RendererMod from "./renderer/babylon.js";
import * as BaseMod from "./elements/base.js";
import * as WallsMod from "./elements/walls.js";
import * as BomMod from "./bom/index.js";

(function () {
  // ---------- Minimal diagnostics (safe, no drift) ----------
  const dbg = (window.__dbg = window.__dbg || {
    initStarted: false,
    initFinished: false,
    frames: 0,
    lastError: null,
    engine: null,
    scene: null,
    camera: null,
    buildCalls: 0,
  });

  function overlayEl() {
    return document.getElementById("statusOverlay");
  }
  function setOverlay(text) {
    const el = overlayEl();
    if (el) el.textContent = String(text ?? "");
  }
  function appendOverlay(line) {
    const el = overlayEl();
    if (!el) return;
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + String(line ?? "");
  }

  window.addEventListener("error", (e) => {
    dbg.lastError = (e && e.message) ? e.message : String(e);
    appendOverlay("window.onerror: " + dbg.lastError);
  });
  window.addEventListener("unhandledrejection", (e) => {
    dbg.lastError = (e && e.reason) ? String(e.reason) : "unhandledrejection";
    appendOverlay("unhandledrejection: " + dbg.lastError);
  });

  // ---------- Store (use module if available; fallback otherwise) ----------
  const hasStore =
    typeof StoreMod.getState === "function" &&
    typeof StoreMod.setState === "function" &&
    typeof StoreMod.onChange === "function";

  let _state = null;
  const _subs = new Set();

  const Store = hasStore
    ? StoreMod
    : {
        getState() {
          return _state;
        },
        setState(patch) {
          _state = { ..._state, ...(patch || {}) };
          _subs.forEach((fn) => {
            try { fn(_state); } catch (e) { /* no-op */ }
          });
        },
        onChange(fn) {
          _subs.add(fn);
          return () => _subs.delete(fn);
        },
      };

  // ---------- Defaults (use params.js if present; fallback mirrors earlier shape) ----------
  const DEFAULTS =
    ParamsMod && (ParamsMod.DEFAULTS || ParamsMod.defaults || ParamsMod.DEFAULT_STATE) ?
      (ParamsMod.DEFAULTS || ParamsMod.defaults || ParamsMod.DEFAULT_STATE) :
      {
        w: 3000,
        d: 4000,
        vis: { base: true, frame: true, ins: true, deck: true },
      };

  // Ensure initial state exists (no drift: we only set if empty)
  if (!Store.getState || Store.getState() == null) {
    _state = { ...DEFAULTS };
  } else if (Store.getState() == null) {
    Store.setState({ ...DEFAULTS });
  }

  // ---------- Babylon bootstrap ----------
  let ctx = null;

  function bootRenderer() {
    const canvas = document.getElementById("renderCanvas");
    if (!canvas) throw new Error("renderCanvas not found");

    // Renderer module contract (best-effort):
    // - boot(canvas) => { engine, scene, camera, root, ... }
    if (typeof RendererMod.boot === "function") {
      return RendererMod.boot(canvas);
    }

    // If renderer module doesn’t exist / doesn't export boot, fail loudly (overlay will show).
    throw new Error("renderer/babylon.js boot(canvas) not found");
  }

  function disposeAll() {
    // NO DRIFT: disposal only (if module supports it)
    if (RendererMod && typeof RendererMod.disposeAll === "function") {
      RendererMod.disposeAll(ctx);
      return;
    }
    // If ctx has disposable meshes array, ignore—element modules should manage internally.
  }

  // ---------- Render orchestration (NO DRIFT: only calls existing builders) ----------
  function render(state) {
    dbg.buildCalls++;

    if (!ctx || !dbg.scene) return;

    // Clear previous geometry if supported
    try { disposeAll(); } catch (e) { /* no-op */ }

    // Build elements if present
    try {
      if (BaseMod && typeof BaseMod.build3D === "function") {
        BaseMod.build3D(state, ctx);
      }
    } catch (e) {
      dbg.lastError = "Base.build3D error: " + String(e && e.message ? e.message : e);
      appendOverlay(dbg.lastError);
    }

    try {
      if (WallsMod && typeof WallsMod.build3D === "function") {
        WallsMod.build3D(state, ctx);
      }
    } catch (e) {
      dbg.lastError = "Walls.build3D error: " + String(e && e.message ? e.message : e);
      appendOverlay(dbg.lastError);
    }

    // BOM: prefer walls-driven sections if available
    try {
      let sections = null;
      if (WallsMod && typeof WallsMod.updateBOM === "function") {
        sections = WallsMod.updateBOM(state);
      }
      if (BomMod && typeof BomMod.renderBOM === "function") {
        BomMod.renderBOM(sections, state);
      }
    } catch (e) {
      dbg.lastError = "BOM error: " + String(e && e.message ? e.message : e);
      appendOverlay(dbg.lastError);
    }
  }

  // ---------- View switching (resume 3D reliably) ----------
  function show3D() {
    const canvas = document.getElementById("renderCanvas");
    const basePage = document.getElementById("baseBomPage") || document.getElementById("bomPage");
    const wallsPage = document.getElementById("wallsBomPage");

    if (basePage) basePage.style.display = "none";
    if (wallsPage) wallsPage.style.display = "none";
    if (canvas) canvas.style.display = "block";

    // Resume rendering / input after DOM visibility changes
    try {
      if (dbg.engine && typeof dbg.engine.resize === "function") dbg.engine.resize();
      if (dbg.camera && canvas && typeof dbg.camera.attachControl === "function") dbg.camera.attachControl(canvas, true);
      if (dbg.scene && typeof dbg.scene.render === "function") dbg.scene.render();
    } catch (e) {
      dbg.lastError = "resume3D error: " + String(e && e.message ? e.message : e);
      appendOverlay(dbg.lastError);
    }
  }

  function showBaseList() {
    const canvas = document.getElementById("renderCanvas");
    const basePage = document.getElementById("baseBomPage") || document.getElementById("bomPage");
    const wallsPage = document.getElementById("wallsBomPage");

    if (canvas) canvas.style.display = "none";
    if (wallsPage) wallsPage.style.display = "none";
    if (basePage) basePage.style.display = "block";
  }

  function showWallsList() {
    const canvas = document.getElementById("renderCanvas");
    const basePage = document.getElementById("baseBomPage") || document.getElementById("bomPage");
    const wallsPage = document.getElementById("wallsBomPage");

    if (canvas) canvas.style.display = "none";
    if (basePage) basePage.style.display = "none";
    if (wallsPage) wallsPage.style.display = "block";
  }

  function wireViewSelect() {
    const sel = document.getElementById("viewSelect");
    if (!sel || sel._wired) return;
    sel._wired = true;

    sel.addEventListener("change", () => {
      const v = String(sel.value || "").toLowerCase();
      if (v === "3d") show3D();
      else if (v === "base") showBaseList();
      else if (v === "walls") showWallsList();
      else {
        // fallback: non-3d -> base list
        showBaseList();
      }
    });
  }

  // ---------- UI wiring (NO DRIFT: only reads/writes existing IDs) ----------
  function wireInputs() {
    const wInput = document.getElementById("wInput");
    const dInput = document.getElementById("dInput");

    if (wInput && !wInput._wired) {
      wInput._wired = true;
      wInput.addEventListener("input", (e) => {
        const v = parseInt(e.target.value, 10);
        Store.setState({ w: Number.isFinite(v) ? v : 1000 });
      });
    }

    if (dInput && !dInput._wired) {
      dInput._wired = true;
      dInput.addEventListener("input", (e) => {
        const v = parseInt(e.target.value, 10);
        Store.setState({ d: Number.isFinite(v) ? v : 1000 });
      });
    }

    // Base visibility toggles (if present)
    const map = [
      ["vBase", "base"],
      ["vFrame", "frame"],
      ["vIns", "ins"],
      ["vDeck", "deck"],
    ];
    map.forEach(([id, key]) => {
      const cb = document.getElementById(id);
      if (!cb || cb._wired) return;
      cb._wired = true;
      cb.addEventListener("change", (e) => {
        const st = Store.getState();
        const vis = { ...(st && st.vis ? st.vis : {}) };
        vis[key] = !!e.target.checked;
        Store.setState({ vis });
      });
    });
  }

  // ---------- Overlay updater (every 1s) ----------
  function startOverlayTicker() {
    setInterval(() => {
      const el = overlayEl();
      if (!el) return;

      const canvas = document.getElementById("renderCanvas");
      const cw = canvas ? canvas.clientWidth : 0;
      const ch = canvas ? canvas.clientHeight : 0;

      const bab = (typeof window.BABYLON !== "undefined");
      const engineOk = !!dbg.engine;
      const sceneOk = !!dbg.scene;
      const camOk = !!dbg.camera;
      const meshes = dbg.scene && dbg.scene.meshes ? dbg.scene.meshes.length : 0;

      const lines = [
        `BABYLON loaded: ${bab}`,
        `Canvas: ${cw}x${ch}`,
        `initStarted: ${dbg.initStarted}`,
        `initFinished: ${dbg.initFinished}`,
        `Engine: ${engineOk}`,
        `Scene: ${sceneOk}`,
        `Camera: ${camOk}`,
        `Frames: ${dbg.frames}`,
        `BuildCalls: ${dbg.buildCalls}`,
        `Meshes: ${meshes}`,
        `LastError: ${dbg.lastError ? String(dbg.lastError).slice(0, 200) : ""}`,
      ];
      setOverlay(lines.join("\n"));
    }, 1000);
  }

  // ---------- Main startup ----------
  document.addEventListener("DOMContentLoaded", () => {
    try {
      dbg.initStarted = true;

      wireViewSelect();
      wireInputs();
      startOverlayTicker();

      // Boot Babylon
      ctx = bootRenderer();

      // Attempt to locate engine/scene/camera in returned ctx (common shapes)
      dbg.engine = ctx && (ctx.engine || ctx._engine || ctx.Engine) ? (ctx.engine || ctx._engine || ctx.Engine) : null;
      dbg.scene = ctx && (ctx.scene || ctx._scene || ctx.Scene) ? (ctx.scene || ctx._scene || ctx.Scene) : null;
      dbg.camera = ctx && (ctx.camera || ctx._camera || ctx.Camera) ? (ctx.camera || ctx._camera || ctx.Camera) : null;

      // If ctx itself is a scene (some implementations), infer
      if (!dbg.scene && ctx && ctx.render && ctx.meshes) dbg.scene = ctx;

      // Start render loop if engine+scene exist
      if (dbg.engine && dbg.scene && typeof dbg.engine.runRenderLoop === "function") {
        dbg.engine.runRenderLoop(() => {
          try {
            dbg.frames++;
            dbg.scene.render();
          } catch (e) {
            dbg.lastError = "renderLoop error: " + String(e && e.message ? e.message : e);
          }
        });
      }

      // Resize handler
      window.addEventListener("resize", () => {
        try {
          if (dbg.engine && typeof dbg.engine.resize === "function") dbg.engine.resize();
        } catch (e) {
          dbg.lastError = "resize error: " + String(e && e.message ? e.message : e);
        }
      });

      // Render first time + subscribe to changes
      const initial = Store.getState ? Store.getState() : _state;
      render(initial || DEFAULTS);

      if (typeof Store.onChange === "function") {
        Store.onChange((st) => render(st));
      }

      // Force initial 3D view
      const sel = document.getElementById("viewSelect");
      if (sel) sel.value = "3d";
      show3D();

      dbg.initFinished = true;
    } catch (e) {
      dbg.lastError = String(e && e.message ? e.message : e);
      appendOverlay("Startup error: " + dbg.lastError);
      dbg.initFinished = false;
    }
  });
})();

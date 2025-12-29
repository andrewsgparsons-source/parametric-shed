// FILE: docs/src/views.js
/**
 * Three views controller:
 * - 3D Scene View: #renderCanvas
 * - Base Cutting List: #bomPage
 * - Walls Cutting List: #wallsBomPage
 *
 * Responsibilities:
 * - show/hide containers only (no geometry/BOM logic)
 * - hash routing (#view=3d|base|walls)
 * - persistence (localStorage.viewMode)
 * - keyboard shortcuts: 1→3D, 2→Walls, 3→Base
 * - aria-hidden accuracy + focus management
 * - zero-leakage 3D mode + aggressive sidebar purge
 */
export function initViews() {
  const canvas = document.getElementById("renderCanvas");
  const basePage = document.getElementById("bomPage");
  const wallsPage = document.getElementById("wallsBomPage");
  const sel = document.getElementById("viewSelect");

  if (!canvas || !basePage || !wallsPage || !sel) return;

  const VIEW_KEY = "viewMode";
  const VIEWS = { "3d": true, "base": true, "walls": true };

  let current = "3d";
  let setting = false;

  function isValidView(v) {
    return !!(v && VIEWS[String(v)]);
  }

  function getHashView() {
    const h = String(window.location.hash || "");
    if (!h) return null;
    const idx = h.indexOf("view=");
    if (idx === -1) return null;
    const tail = h.slice(idx + "view=".length);
    const end = tail.indexOf("&");
    const raw = end === -1 ? tail : tail.slice(0, end);
    const v = decodeURIComponent(raw.replace(/^#/, "").trim());
    return isValidView(v) ? v : null;
  }

  function setHashView(v) {
    try {
      const next = "#view=" + encodeURIComponent(v);
      if (window.history && typeof window.history.replaceState === "function") {
        window.history.replaceState(null, "", next);
      } else {
        window.location.hash = next;
      }
    } catch (e) {
      try { window.location.hash = "#view=" + v; } catch (e2) {}
    }
  }

  function getStoredView() {
    try {
      const v = window.localStorage ? window.localStorage.getItem(VIEW_KEY) : null;
      return isValidView(v) ? v : null;
    } catch (e) {
      return null;
    }
  }

  function setStoredView(v) {
    try {
      if (window.localStorage) window.localStorage.setItem(VIEW_KEY, v);
    } catch (e) {}
  }

  function setBodyViewAttr(v) {
    try { document.body.setAttribute("data-view", v); } catch (e) {}
  }

  function setAriaHidden(el, hidden) {
    try { el.setAttribute("aria-hidden", String(!!hidden)); } catch (e) {}
  }

  function show(el) {
    el.style.display = "block";
  }

  function hide(el) {
    el.style.display = "none";
  }

  function ensureCanvasFullscreen() {
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
  }

  function tryResume3DInteractions() {
    const dbg = window.__dbg || {};
    const engine = dbg.engine;
    const camera = dbg.camera;

    try { if (engine && typeof engine.resize === "function") engine.resize(); } catch (e) {}
    try { if (camera && typeof camera.attachControl === "function") camera.attachControl(canvas, true); } catch (e) {}
  }

  function tryPause3DInteractions() {
    const dbg = window.__dbg || {};
    const camera = dbg.camera;
    try { if (camera && typeof camera.detachControl === "function") camera.detachControl(canvas); } catch (e) {}
  }

  function focusFirstHeading(pageEl) {
    const h = pageEl.querySelector("h1, h2, h3, [role='heading']");
    if (!h) return;

    const prev = h.getAttribute("tabindex");
    h.setAttribute("tabindex", "-1");
    try { h.focus({ preventScroll: true }); } catch (e) { try { h.focus(); } catch (e2) {} }

    try {
      pageEl.scrollTop = 0;
      h.scrollIntoView({ block: "start", inline: "nearest" });
    } catch (e) {}

    window.setTimeout(() => {
      try {
        if (prev === null) h.removeAttribute("tabindex");
        else h.setAttribute("tabindex", prev);
      } catch (e) {}
    }, 0);
  }

  // Aggressive removal of any sidebar/panel injected by other scripts.
  function purgeSidebars(root) {
    const r = root || document;
    const suspects = [
      "#ui-layer", "#controls",
      "[id*='sidebar' i]", "[class*='sidebar' i]",
      "[id*='panel' i]",   "[class*='panel' i]",
      "[id*='inspector' i]", "[class*='inspector' i]",
      "[id*='gui' i]", "[class*='gui' i]",
      ".dg.ac",
      // Common right-hand overlays seen in 3D viewers/UIs
      "[class*='drawer' i]", "[id*='drawer' i]",
      "[class*='overlay' i][style*='right' i]",
      "[class*='tool' i][style*='right' i]",
      "[id*='tool' i][style*='right' i]"
    ];

    try {
      r.querySelectorAll(suspects.join(",")).forEach((el) => {
        try { el.remove(); } catch (e) {}
      });
    } catch (e) {}

    // Heuristic: remove any fixed/absolute element glued to the right edge >= 200px wide, >= 100px tall, z-index >= 1000.
    try {
      const topbar = document.getElementById("topbar");
      const all = Array.prototype.slice.call(r.querySelectorAll("body *"));
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (!el || el === document.body || el === document.documentElement) continue;
        if (topbar && (el === topbar || (typeof el.contains === "function" && el.contains(topbar)))) continue;

        let st;
        try { st = window.getComputedStyle(el); } catch (e) { continue; }
        if (!st || st.display === "none") continue;

        const pos = st.position;
        if (pos !== "fixed" && pos !== "absolute") continue;

        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { continue; }
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;

        const nearRight = (window.innerWidth - rect.right) <= 2;
        const bigEnough = rect.width >= 200 && rect.height >= 100;

        let z = 0;
        try { z = parseInt(st.zIndex || "0", 10); } catch (e) { z = 0; }
        const zHigh = z >= 1000;

        if (nearRight && bigEnough && zHigh) {
          try { el.remove(); } catch (e) {}
        }
      }
    } catch (e) {}
  }

  function applyView(v, opts) {
    if (!isValidView(v)) v = "3d";
    if (setting) return;

    setting = true;
    current = v;

    // State + persistence
    try { sel.value = v; } catch (e) {}
    setBodyViewAttr(v);
    setStoredView(v);
    setHashView(v);

    const is3d = v === "3d";
    const isBase = v === "base";
    const isWalls = v === "walls";

    // Visibility
    if (is3d) {
      ensureCanvasFullscreen();
      show(canvas);
      hide(basePage);
      hide(wallsPage);
      tryResume3DInteractions();
      purgeSidebars(document);
    } else {
      hide(canvas);
      show(isBase ? basePage : wallsPage);
      hide(isBase ? wallsPage : basePage);
      tryPause3DInteractions();
    }

    // ARIA
    setAriaHidden(canvas, !is3d);
    setAriaHidden(basePage, !isBase);
    setAriaHidden(wallsPage, !isWalls);

    // Focus
    const noFocus = opts && opts.noFocus;
    if (!noFocus) {
      window.requestAnimationFrame(() => {
        if (is3d) {
          try { sel.focus({ preventScroll: true }); } catch (e) { try { sel.focus(); } catch (e2) {} }
        } else if (isBase) {
          focusFirstHeading(basePage);
        } else {
          focusFirstHeading(wallsPage);
        }
      });
    }

    // Resize safety
    if (is3d) {
      window.requestAnimationFrame(() => {
        ensureCanvasFullscreen();
        tryResume3DInteractions();
      });
    }

    setting = false;
  }

  function resolveInitialView() {
    const hv = getHashView();
    if (hv) return hv;

    const sv = getStoredView();
    if (sv) return sv;

    const pv = sel.value;
    return isValidView(pv) ? pv : "3d";
  }

  // Wire selector changes
  if (!sel._viewsWired) {
    sel._viewsWired = true;
    sel.addEventListener("change", (e) => {
      const next = e && e.target ? e.target.value : sel.value;
      applyView(isValidView(next) ? next : "3d");
    });
  }

  // Keyboard shortcuts: 1→3D, 2→Walls, 3→Base
  if (!window.__viewsKeysWired) {
    window.__viewsKeysWired = true;
    window.addEventListener("keydown", (e) => {
      if (!e || e.defaultPrevented) return;

      const t = e.target;
      const tag = t && t.tagName ? String(t.tagName).toLowerCase() : "";
      const isTyping =
        tag === "input" || tag === "textarea" || tag === "select" ||
        (t && typeof t.isContentEditable === "boolean" && t.isContentEditable);

      if (isTyping) return;

      const k = e.key;
      if (k === "1") applyView("3d");
      else if (k === "2") applyView("walls");
      else if (k === "3") applyView("base");
    }, { passive: true });
  }

  // Hash routing (external changes / back-forward)
  window.addEventListener("hashchange", () => {
    const hv = getHashView();
    if (hv && hv !== current) applyView(hv, { noFocus: true });
  });

  // MutationObserver to purge late-injected overlays
  if (!window.__viewsPurgeMO) {
    const mo = new MutationObserver((muts) => {
      for (let i = 0; i < muts.length; i++) {
        const m = muts[i];
        if (m && m.addedNodes && m.addedNodes.length) {
          purgeSidebars(document);
          break;
        }
      }
    });
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true });
      window.__viewsPurgeMO = mo;
    } catch (e) {}
  }

  // Keep canvas full-screen on resize (and keep heuristic purge effective)
  window.addEventListener("resize", () => {
    if (current === "3d") {
      ensureCanvasFullscreen();
      tryResume3DInteractions();
      purgeSidebars(document);
    }
  });

  // Initial purge + initial view
  purgeSidebars(document);
  applyView(resolveInitialView(), { noFocus: true });
}

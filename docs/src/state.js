// FILE: docs/src/state.js
export function createStateStore(initial) {
  let state = structuredCloneSafe(initial);
  const subs = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    state = deepMerge(state, patch);
    subs.forEach(fn => fn(state));
  }

  function onChange(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  return { getState, setState, onChange };
}

function deepMerge(target, patch) {
  if (!isObj(patch)) return target;

  const out = Array.isArray(target) ? target.slice() : { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (isObj(v) && isObj(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }

  // Special-case shapes used by this app (preserve nested objects)
  if (isObj(patch.vis) && isObj(out.vis)) {
    if (isObj(patch.vis.walls) && isObj(out.vis.walls)) out.vis.walls = deepMerge(out.vis.walls, patch.vis.walls);
  }
  if (isObj(patch.overhang) && isObj(out.overhang)) out.overhang = deepMerge(out.overhang, patch.overhang);
  if (isObj(patch.dimInputs) && isObj(out.dimInputs)) out.dimInputs = deepMerge(out.dimInputs, patch.dimInputs);
  if (isObj(patch.walls) && isObj(out.walls)) {
    out.walls = deepMerge(out.walls, patch.walls);
    if (Array.isArray(patch.walls.openings) && Array.isArray(out.walls.openings)) {
      out.walls.openings = patch.walls.openings;
    }
  }

  return out;
}

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function structuredCloneSafe(v) {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
    }

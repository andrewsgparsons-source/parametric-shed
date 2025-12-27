// src/state.js

export function createStateStore(initial) {
  /** @type {any} */
  let state = deepClone(initial);
  /** @type {Array<(s:any)=>void>} */
  const subs = [];

  function getState() {
    return state;
  }

  function setState(patch) {
    state = deepMerge(state, patch);
    subs.forEach(fn => fn(state));
  }

  function onChange(fn) {
    subs.push(fn);
    return () => {
      const i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  return { getState, setState, onChange };
}

function deepClone(v) {
  if (Array.isArray(v)) return v.map(deepClone);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = deepClone(v[k]);
    return o;
  }
  return v;
}

function deepMerge(target, patch) {
  if (patch == null) return target;
  if (Array.isArray(patch)) return patch.slice();

  if (patch && typeof patch === 'object') {
    const out = Array.isArray(target) ? target.slice() : { ...(target && typeof target === 'object' ? target : {}) };
    for (const k of Object.keys(patch)) {
      const pv = patch[k];
      const tv = out[k];

      if (pv && typeof pv === 'object' && !Array.isArray(pv)) {
        out[k] = deepMerge(tv && typeof tv === 'object' && !Array.isArray(tv) ? tv : {}, pv);
      } else {
        out[k] = pv;
      }
    }
    return out;
  }

  return patch;
}

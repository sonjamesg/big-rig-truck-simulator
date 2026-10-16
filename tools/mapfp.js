// Deep fingerprint of every named global (tools/verify_map.py): structure + values + sharing, canvases as "C",
// functions as "F". Two worlds with equal fingerprints are identical for every list, field, typed array and reference.
window.mapFingerprint = (names) => {
  const res = {};
  for (const n of names) {
    let v;
    try {
      v = (0, eval)(n);
    } catch (e) {
      res[n] = "unavailable: " + e.message;
      continue;
    }
    let h1 = 0x811c9dc5,
      h2 = 0x01000193,
      cnt = 0;
    const seen = new Map();
    const mix = (s) => {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
      }
    };
    const num = (x) => mix(Object.is(x, -0) ? "-0" : String(x));
    const walk = (o) => {
      cnt++;
      if (o === null) return mix("n");
      const t = typeof o;
      if (t === "function") return mix("F");
      if (t === "number") return (mix("#"), num(o));
      if (t !== "object") return mix(t[0] + String(o));
      if (seen.has(o)) return mix("R" + seen.get(o));
      seen.set(o, seen.size);
      const c = o.constructor && o.constructor.name;
      if (
        /Canvas|Context|ImageData|Pattern|Gradient|AudioContext|Node|Element/.test(c || "") ||
        (typeof Node !== "undefined" && o instanceof Node)
      )
        return mix("C");
      if (ArrayBuffer.isView(o)) {
        mix(c + o.length);
        const u = new Uint8Array(o.buffer, o.byteOffset, o.byteLength);
        for (let i = 0; i < u.length; i++) {
          h1 = Math.imul(h1 ^ u[i], 16777619) >>> 0;
          h2 = Math.imul(h2 ^ u[i], 2246822519) >>> 0;
        }
        return;
      }
      if (o instanceof Map) {
        mix("M" + o.size);
        for (const [k, x] of o) (walk(k), walk(x));
        return;
      }
      if (o instanceof Set) {
        mix("S" + o.size);
        for (const x of o) walk(x);
        return;
      }
      if (Array.isArray(o)) {
        mix("A" + o.length);
        for (let k = 0; k < o.length; k++) k in o ? walk(o[k]) : mix("hole");
        return;
      }
      mix("O" + (c || "null"));
      for (const k of Object.keys(o)) (mix("." + k), walk(o[k]));
    };
    walk(v);
    res[n] = h1.toString(16) + h2.toString(16) + ":" + cnt;
  }
  return res;
};

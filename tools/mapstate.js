// Map state serializer (runs inside the game page; used by tools/export_map.py and tools/verify_map.py).
// window.mapSerialize(parts) -> {parts:[{root,key,value}], tiles:{layer:rle_b64}, stats}. Format: see src/mapload.js.
(() => {
  const TILE_LEN = MW * MH;
  const isPlain = (o) => o.constructor === Object || Object.getPrototypeOf(o) === null;
  const isCanvas = (o) =>
    typeof HTMLCanvasElement !== "undefined" &&
    (o instanceof HTMLCanvasElement ||
      (typeof OffscreenCanvas !== "undefined" && o instanceof OffscreenCanvas));
  const b64 = (u8) => {
    let s = "";
    for (let k = 0; k < u8.length; k += 0x8000)
      s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
    return btoa(s);
  };
  const rle = (a) => {
    const out = [];
    const put = (n) => {
      while (n > 127) {
        out.push((n % 128) | 128);
        n = Math.floor(n / 128);
      }
      out.push(n);
    };
    const signed = a instanceof Int16Array || a instanceof Int32Array;
    let i = 0;
    while (i < a.length) {
      const v = a[i];
      let j = i + 1;
      while (j < a.length && a[j] === v) j++;
      put(signed ? (v >= 0 ? v * 2 : -v * 2 - 1) : v);
      put(j - i);
      i = j;
    }
    return b64(Uint8Array.from(out));
  };
  // trailer art objects -> the trailerArt() arguments that rebuild them (identity checked against the cache)
  const artArgs = new Map();
  for (const k of Object.keys(traffic.arts || {})) {
    /* filled from trailers below */
  }
  const noteArt = (tr) => {
    if (tr && tr.art && typeof tr.type === "string" && tr.col != null) {
      const key = "dt" + tr.type + tr.col + tr.logo;
      if (traffic.arts[key] === tr.art) artArgs.set(tr.art, [tr.type, tr.col, tr.logo]);
    }
  };
  window.mapSerialize = (parts, tileLayers) => {
    // pass 1: count references, collect trailer art
    const cnt = new Map();
    const count = (o) => {
      if (o === null || typeof o !== "object") return;
      const c = cnt.get(o) || 0;
      cnt.set(o, c + 1);
      if (c) return;
      if (ArrayBuffer.isView(o) || isCanvas(o)) return;
      if (o instanceof Map) {
        for (const [k, v] of o) {
          count(k);
          count(v);
        }
        return;
      }
      if (o instanceof Set) {
        for (const v of o) count(v);
        return;
      }
      if (!Array.isArray(o) && "art" in o) noteArt(o);
      if (Array.isArray(o)) {
        for (let k = 0; k < o.length; k++) if (k in o) count(o[k]);
        return;
      }
      for (const k of Object.keys(o)) count(o[k]);
    };
    for (const p of parts) if (p.root !== "trlSeq" && !p.derived) count(mapRootGet(p.root)[p.key]);
    let nid = 0;
    const idOf = new Map(),
      tiles = {},
      stats = { objects: 0, tables: 0, shared: 0 };
    const enc = (v, parent, key, path) => {
      if (v === undefined) return { $u: 1 };
      if (typeof v === "number") {
        if (Number.isNaN(v)) return { $n: "NaN" };
        if (v === Infinity) return { $n: "Inf" };
        if (v === -Infinity) return { $n: "-Inf" };
        if (v === 0 && 1 / v < 0) return { $n: "-0" };
        return v;
      }
      if (typeof v === "function") {
        if (v === regionAt) return { $f: "regionAt" };
        if (v === isDesert) return { $f: "isDesert" };
        if (key === "hs" && parent && "eP" in parent && "eM" in parent && "wN" in parent)
          return { $f: "taperHs" };
        if (path === "world.roadClear") return { $f: "roadClear" };
        if (path === "RAIL._clearLine") return { $f: "roadClear" };
        if (typeof RL_FNARGS !== "undefined" && RL_FNARGS.has(v))
          return { $f: "rlTrackFn", a: RL_FNARGS.get(v) };
        if (v.name && window[v.name] === v) return { $f: "global:" + v.name };
        throw new Error("mapSerialize: unknown function at " + path);
      }
      if (v === null || typeof v !== "object") {
        if (typeof v === "bigint" || typeof v === "symbol")
          throw new Error("mapSerialize: " + typeof v + " at " + path);
        return v;
      }
      if (idOf.has(v)) return { $r: idOf.get(v) };
      const shared = cnt.get(v) > 1;
      const def = (o) => {
        if (shared) {
          const id = ++nid;
          idOf.set(v, id);
          stats.shared++;
          return Object.assign({ $i: id }, o);
        }
        return o;
      };
      stats.objects++;
      if (artArgs.has(v)) return def({ $c: "trailerArt", a: artArgs.get(v) });
      if (isCanvas(v)) throw new Error("mapSerialize: canvas at " + path);
      if (ArrayBuffer.isView(v)) {
        const T = v.constructor.name;
        if (tileLayers && parent === world && v.length === TILE_LEN) {
          tiles[key] = rle(v);
          return def({ $t: T, len: v.length, tile: key });
        }
        return def({ $t: T, b64: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) });
      }
      if (v instanceof Map) {
        const o = def({ $m: [] }); // register id before children (cycles)
        for (const [k, x] of v)
          o.$m.push([enc(k, v, null, path + ".<k>"), enc(x, v, null, path + ".<v>")]);
        return o;
      }
      if (v instanceof Set) {
        const o = def({ $s: [] });
        for (const x of v) o.$s.push(enc(x, v, null, path + ".<s>"));
        return o;
      }
      if (Array.isArray(v)) {
        const A = shared ? def({ $a: [] }) : null,
          out = A ? A.$a : [];
        // table form: >= 8 plain objects, no holes. One shape -> {$tab:keys,rows}; several -> {$tabs:[keys..],rows:[[shape,..]]}
        let tab = v.length >= 8;
        const shapes = new Map();
        if (tab)
          for (let k = 0; k < v.length; k++) {
            const o = v[k];
            if (
              !(k in v) ||
              !o ||
              typeof o !== "object" ||
              Array.isArray(o) ||
              ArrayBuffer.isView(o) ||
              o instanceof Map ||
              o instanceof Set ||
              !isPlain(o) ||
              idOf.has(o) ||
              artArgs.has(o)
            ) {
              tab = false;
              break;
            }
            const ks = Object.keys(o).join("\u0001");
            if (!shapes.has(ks)) shapes.set(ks, shapes.size);
          }
        if (tab && shapes.size > 64) tab = false;
        if (tab) {
          const multi = shapes.size > 1,
            klist = [...shapes.keys()].map((ks) => (ks ? ks.split("\u0001") : [])),
            T = multi
              ? { $tabs: klist, rows: [], ids: null }
              : { $tab: klist[0], rows: [], ids: null };
          if (A) T.$i = A.$i;
          for (let r = 0; r < v.length; r++) {
            const o = v[r];
            if (cnt.get(o) > 1) {
              const id = ++nid;
              idOf.set(o, id);
              stats.shared++;
              if (!T.ids) T.ids = new Array(v.length).fill(0);
              T.ids[r] = id;
            }
            stats.objects++;
            const si = shapes.get(Object.keys(o).join("\u0001")),
              row = klist[si].map((k) => enc(o[k], o, k, path + "[" + r + "]." + k));
            T.rows.push(multi ? [si].concat(row) : row);
          }
          if (!T.ids) delete T.ids;
          stats.tables++;
          return T;
        }
        for (let k = 0; k < v.length; k++)
          out.push(k in v ? enc(v[k], v, k, path + "[" + k + "]") : { $h: 1 });
        return A || out;
      }
      if (!isPlain(v))
        throw new Error("mapSerialize: class instance " + v.constructor.name + " at " + path);
      const o = def({});
      for (const k of Object.keys(v)) {
        if (k[0] === "$") throw new Error("mapSerialize: key starting with $ at " + path + "." + k);
        o[k] = enc(v[k], v, k, path + "." + k);
      }
      return o;
    };
    const out = [];
    for (const p of parts) {
      if (p.derived) out.push({ root: p.root, key: p.key, derived: p.derived });
      else if (p.root === "trlSeq") out.push({ root: "trlSeq", key: null, value: trlSeq });
      else {
        const R = mapRootGet(p.root);
        out.push({
          root: p.root,
          key: p.key,
          value: enc(R[p.key], R, p.key, p.root + "." + p.key),
        });
      }
    }
    return { parts: out, tiles, stats };
  };
  window.mapRootGet = (n) => ({ world, traffic, BigRig, SVC, HOMES, RAIL })[n];
})();

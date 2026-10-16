/**
 * @file mapload.js — MAP DATA LOADER: restores the generated world from src/map/ (mapdata.bin or inlined MAP_DATA)
 * Exposes (globals): MAPLOAD, mapLoadWorld, mapAvailable, mapDecoder, mapParseBin, mapGunzip, mapUnRle
 * Depends on: world.js (worldChunkIndex, regionAt, isDesert), rail.js (rlTrackFn), depots.js (trailerArt)
 * Load order: just before main.js in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== map data: load the generated world from src/map/ (inlined by build.py) instead of generating it
// Format (see AGENTS.md "Map data"): a JSON value tree with markers for what plain JSON can't hold:
//   {"$i":n,...} defines a shared object (id n), {"$r":n} refers back to it; {"$a":[...],"$i":n} a shared array;
//   {"$tab":[keys],"rows":[[...]],"ids":[...]} an array of same-shaped objects (one row per object);
//   {"$tabs":[[keys],..],"rows":[[shape,...]]} the same for an array of a few different shapes;
//   {"$t":"Int16Array","b64":".."} raw typed array (little-endian), {"$t":..,"tile":"roadH"} a tile layer file;
//   {"$m":[[k,v]]} Map, {"$s":[..]} Set, {"$n":"NaN"|"Inf"|"-Inf"|"-0"}, {"$u":1} undefined, {"$h":1} array hole,
//   {"$f":"name"} a function rebuilt in code, {"$c":"trailerArt","a":[kind,col,logo]} canvas art rebuilt in code.
// Restoring keeps the identity of objects that exist before generation (e.g. world.ground aliased as G, world.segs):
// those are cleared and refilled in place.
const MAPLOAD = { ms: 0, used: false, err: null, touched: false, pending: null };
function mapTaperHs(tp) {
  // same curve as the generator's closure (world.js), from the taper's stored fields
  return (t, sd) => {
    const u = Math.max(0, Math.min(1, t / tp.L)),
      e = u * u * (3 - 2 * u);
    return tp.wN / 2 + ((sd > 0 ? tp.eP : tp.eM) - tp.wN / 2) * (1 - e);
  };
}
function mapRoadClearGone() {
  throw new Error(
    "this helper (world.roadClear / RAIL._clearLine) only exists while the world is being generated",
  );
}
const MAP_FN = {
  regionAt: () => regionAt,
  isDesert: () => isDesert,
  taperHs: (parent) => mapTaperHs(parent),
  roadClear: () => mapRoadClearGone,
};
function mapB64Bytes(s) {
  const bin = atob(s),
    u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function mapUnRle(bytes, Ctor, len, into) {
  const a = into || new Ctor(len),
    signed = Ctor === Int16Array || Ctor === Int32Array;
  let i = 0,
    o = 0;
  const rd = () => {
    let r = 0,
      s = 1,
      b;
    do {
      b = bytes[i++];
      r += (b & 127) * s;
      s *= 128;
    } while (b > 127);
    return r;
  };
  while (i < bytes.length) {
    let v = rd();
    const c = rd();
    if (signed) v = v % 2 === 0 ? v / 2 : -(v + 1) / 2;
    a.fill(v, o, o + c);
    o += c;
  }
  if (o !== a.length) throw new Error("tile layer length " + o + " != " + a.length);
  return a;
}
function mapDecoder(tiles) {
  const ids = new Map();
  const TA = {
    Uint8Array,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    Float32Array,
    Float64Array,
    Uint8ClampedArray,
  };
  const dec = (v, parent, into) => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return fillArr(into, v, parent);
    if ("$r" in v) {
      if (!ids.has(v.$r)) throw new Error("map data: reference to undefined id " + v.$r);
      return ids.get(v.$r);
    }
    if ("$n" in v) return { NaN: NaN, Inf: Infinity, "-Inf": -Infinity, "-0": -0 }[v.$n];
    if ("$u" in v) return undefined;
    if ("$f" in v) {
      if (v.$f === "rlTrackFn") return rlTrackFn(v.a[0], v.a[1], v.a[2]);
      if (v.$f.startsWith("global:")) {
        const g = window[v.$f.slice(7)];
        if (typeof g !== "function") throw new Error("map data: missing global function " + v.$f);
        return g;
      }
      const f = MAP_FN[v.$f];
      if (!f) throw new Error("map data: unknown function " + v.$f);
      return f(parent);
    }
    if ("$c" in v) {
      if (v.$c !== "trailerArt") throw new Error("map data: unknown canvas " + v.$c);
      const o = trailerArt(v.a[0], v.a[1], v.a[2]);
      if ("$i" in v) ids.set(v.$i, o);
      return o;
    }
    if ("$t" in v) {
      const C = TA[v.$t];
      let a;
      if (v.tile != null) {
        const t = tiles[v.tile];
        if (!t) throw new Error("map data: missing tile layer " + v.tile);
        a = into instanceof C && into.length === v.len ? into : new C(v.len);
        mapUnRle(t, C, v.len, a);
      } else {
        const u = mapB64Bytes(v.b64),
          src = new C(u.buffer, 0, u.byteLength / C.BYTES_PER_ELEMENT);
        a = into instanceof C && into.length === src.length ? into : new C(src.length);
        a.set(src);
      }
      if ("$i" in v) ids.set(v.$i, a);
      return a;
    }
    if ("$a" in v) {
      const a = Array.isArray(into) ? into : [];
      a.length = 0;
      if ("$i" in v) ids.set(v.$i, a);
      return fillArr(a, v.$a, parent, true);
    }
    if ("$tab" in v || "$tabs" in v) {
      const a = Array.isArray(into) ? into : [];
      a.length = 0;
      if ("$i" in v) ids.set(v.$i, a);
      const multi = "$tabs" in v,
        KS = multi ? v.$tabs : [v.$tab],
        off = multi ? 1 : 0;
      for (let r = 0; r < v.rows.length; r++) {
        const row = v.rows[r],
          K = KS[multi ? row[0] : 0],
          o = {};
        if (v.ids && v.ids[r]) ids.set(v.ids[r], o);
        for (let k = 0; k < K.length; k++) o[K[k]] = dec(row[k + off], o);
        a.push(o);
      }
      return a;
    }
    if ("$m" in v) {
      const m = into instanceof Map ? into : new Map();
      m.clear();
      if ("$i" in v) ids.set(v.$i, m);
      for (const [k, x] of v.$m) m.set(dec(k, m), dec(x, m));
      return m;
    }
    if ("$s" in v) {
      const s = into instanceof Set ? into : new Set();
      s.clear();
      if ("$i" in v) ids.set(v.$i, s);
      for (const x of v.$s) s.add(dec(x, s));
      return s;
    }
    const o =
      into && typeof into === "object" && !Array.isArray(into) && into.constructor === Object
        ? into
        : {};
    if (o === into) for (const k of Object.keys(o)) delete o[k];
    if ("$i" in v) ids.set(v.$i, o);
    for (const k of Object.keys(v)) if (k !== "$i") o[k] = dec(v[k], o);
    return o;
  };
  const fillArr = (into, src, parent, cleared) => {
    const a = Array.isArray(into) ? into : [];
    if (!cleared) a.length = 0;
    for (let k = 0; k < src.length; k++) {
      const x = src[k];
      if (x && typeof x === "object" && !Array.isArray(x) && "$h" in x) {
        a.length = k + 1;
        continue;
      }
      a[k] = dec(x, a);
    }
    if (a.length < src.length) a.length = src.length;
    return a;
  };
  return dec;
}
// roots that generation fills, in the exporter's order; existing containers are refilled in place
function mapRoot(name) {
  return { world, traffic, BigRig, SVC, HOMES, RAIL }[name];
}
const MAP_SCALARS = { trlSeq: (v) => (trlSeq = v) };
async function mapGunzip(src) {
  // src: base64 string (inlined MAP_DATA) or bytes (fetched mapdata.bin)
  const ds = new DecompressionStream("gzip"),
    blob = new Blob([typeof src === "string" ? mapB64Bytes(src) : src]);
  return new Uint8Array(await new Response(blob.stream().pipeThrough(ds)).arrayBuffer());
}
// mapdata.bin (build.py, next to index.html): u32 LE header length, JSON header
// {"state":[off,len],"tiles":{"k":[off,len]}}, then the gzip blobs (offsets from the end of the header).
function mapParseBin(buf) {
  const u = new Uint8Array(buf),
    n = new DataView(buf).getUint32(0, true),
    h = JSON.parse(new TextDecoder().decode(u.subarray(4, 4 + n))),
    b = 4 + n,
    sl = (r) => u.subarray(b + r[0], b + r[0] + r[1]),
    tiles = {};
  for (const k of Object.keys(h.tiles)) tiles[k] = sl(h.tiles[k]);
  return { state: sl(h.state), tiles };
}
function mapUrl() {
  return typeof window !== "undefined" && window.MAP_URL && location.protocol !== "file:"
    ? window.MAP_URL
    : null;
}
function mapAvailable() {
  return (
    typeof window !== "undefined" &&
    !!(window.MAP_DATA || mapUrl()) &&
    typeof DecompressionStream === "function" &&
    !/[?&]mapgen=1/.test(location.search) &&
    !window.__BIGRIG_MAPGEN
  );
}
// start downloading the map data straight away, in parallel with the rest of the boot
if (mapAvailable() && !window.MAP_DATA)
  MAPLOAD.pending = fetch(mapUrl()).then((r) => {
    if (!r.ok) throw new Error("map data HTTP " + r.status);
    return r.arrayBuffer();
  });
async function mapLoadWorld(stage) {
  const t0 = performance.now();
  await stage("Loading the map");
  const D =
    window.MAP_DATA ||
    mapParseBin(await (MAPLOAD.pending || Promise.reject(new Error("no map data"))));
  const tiles = {};
  for (const k of Object.keys(D.tiles)) tiles[k] = await mapGunzip(D.tiles[k]);
  const doc = JSON.parse(new TextDecoder().decode(await mapGunzip(D.state)));
  await stage("Building the map");
  MAPLOAD.touched = true; // from here on the world is being overwritten: a failure needs a reload
  const dec = mapDecoder(tiles),
    derived = [];
  for (const part of doc.parts) {
    if (part.derived) {
      // index rebuilt in code below; reserve the key now so the object's key order matches the generator
      const R = mapRoot(part.root);
      if (!(part.key in R)) R[part.key] = null;
      derived.push(part);
      continue;
    }
    if (part.root in MAP_SCALARS) {
      MAP_SCALARS[part.root](part.value);
      continue;
    }
    const R = mapRoot(part.root);
    if (!R) throw new Error("map data: unknown root " + part.root);
    R[part.key] = dec(part.value, R, R[part.key]);
  }
  for (const part of derived) {
    if (part.derived === "worldChunkIndex") worldChunkIndex(world.objects);
    else throw new Error("map data: unknown derived part " + part.derived);
  }
  MAPLOAD.used = true;
  MAPLOAD.ms = performance.now() - t0;
}

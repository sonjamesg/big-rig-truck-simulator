// Map exporter (runs inside the built game page via tools/export_map.py, after world generation).
// Returns {meta, layers:{name:{type,len,rle_b64}}, entities:{...}}. Read-only: it never changes game state.
(() => {
  const r1 = (v) => Math.round(v * 1000) / 1000;
  const tilesOf = (m) => r1(m / M_T); // metres -> tiles
  // ---- tile layers: run-length (value, count) as LEB128 varints, zig-zag for signed values, base64
  const rle = (a) => {
    const out = [];
    const put = (n) => {
      while (n > 127) {
        out.push((n & 127) | 128);
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
    let s = "";
    const B = 0x8000;
    for (let k = 0; k < out.length; k += B)
      s += String.fromCharCode.apply(null, out.slice(k, k + B));
    return btoa(s);
  };
  const hash = (a) => {
    // FNV-1a over the raw bytes, for exactness checks
    const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    let h = 0x811c9dc5;
    for (let i = 0; i < u.length; i++) {
      h ^= u[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  };
  const layers = {};
  for (const k of Object.keys(world).sort()) {
    const a = world[k];
    if (ArrayBuffer.isView(a) && a.length === MW * MH)
      layers[k] = { type: a.constructor.name, len: a.length, fnv1a: hash(a), rle_b64: rle(a) };
  }
  // ---- entities (ids, types, names, positions / geometry)
  const E = {};
  E.roads = world.segs.map((s) => ({
    id: "R" + s.id,
    type: "road",
    roadType: s.type,
    name: `${s.type} road ${s.id}`,
    dir: s.dir,
    a: s.a,
    w: s.w,
    b0: s.b0,
    b1: s.b1,
    rect_tiles: s.dir === "h" ? [s.b0, s.a, s.b1, s.a + s.w] : [s.a, s.b0, s.a + s.w, s.b1],
  }));
  E.curvedRoads = world.curves.map((c) => ({
    id: "CV" + c.id,
    type: "curve",
    roadType: c.type,
    name: c.name || `curve ${c.id}`,
    w: c.w,
    bridge: !!c.bridge,
    pts_tiles: c.pts.map((p) => [r1(p[0]), r1(p[1])]),
  }));
  E.junctions = world.junctions.map((j) => ({
    id: "J" + j.id,
    type: "junction",
    name: `junction ${j.id}`,
    x: j.x,
    y: j.y,
    w: j.w,
    h: j.h,
    lights: !!j.lights,
  }));
  E.roundabouts = world.rbs.map((b) => ({
    id: "RB" + b.id,
    type: "roundabout",
    name: `roundabout ${b.id}`,
    cx: b.cx,
    cy: b.cy,
    rin: b.rin,
    rout: b.rout,
    arms: b.arms.length,
  }));
  let bi = 0;
  E.buildings = world.objects
    .filter((o) => o.kind === "bldg")
    .map((o) => ({
      id: "B" + bi++,
      type: "building",
      style: o.style || null,
      name: o.sign || `${o.style || "building"} ${bi - 1}`,
      rect_tiles: [r1(o.x / TILE), r1(o.y / TILE), r1(o.w / TILE), r1(o.h / TILE)],
      height: r1(o.height || 0),
      front: o.front || null,
    }));
  const site = (type, o, xUnit) => ({
    id: o.id,
    type,
    name: o.name,
    region: o.region || null,
    pos_tiles: xUnit === "t" ? [o.x, o.y] : [tilesOf(o.x), tilesOf(o.y)],
    entrance_tiles: o.entrance ? [tilesOf(o.entrance.x), tilesOf(o.entrance.y)] : null,
  });
  E.depots = world.depots.map((d) =>
    Object.assign(site("depot", d, "t"), {
      code: d.code,
      tier: d.tier,
      size_tiles: [d.w, d.h],
      bays: d.bays.length,
    }),
  );
  E.fuelStations = world.fuel.map((f) =>
    Object.assign(site("fuel", f), {
      brand: f.brand,
      price: f.price,
      hgvBays: (f.hgv || []).length,
    }),
  );
  E.garages = world.garages.map((g) => site("garage", g));
  E.services = world.services.map((s) =>
    Object.assign(site(s.type, s), { town: s.town || null, rect_tiles: [s.tx, s.ty, s.w, s.h] }),
  );
  E.malls = (world.malls || []).map((m) =>
    Object.assign(site(m.kind || "mall", m), { brand: m.brand }),
  );
  E.dealers = (world.dealers || []).map((d) => site("dealer", d));
  E.ports = [
    ["Albion", world.port],
    ["Kingsbridge", world.kbPort],
  ]
    .filter((p) => p[1])
    .map(([n, P], i) => ({
      id: "P" + i,
      type: "port",
      name: n + " Port",
      depot: P.dep || null,
      rect_tiles: P.x0 != null ? [P.x0, P.y0, P.x1, P.y1] : null,
      berths: (P.berths || []).length,
      cranes: (P.cranes || []).length,
    }));
  E.airports = world.airports.map((a, i) => ({
    id: "A" + i,
    type: "airport",
    name: a.name,
    rect_tiles: a.albion ? [a.albion.x0, a.albion.y0, a.albion.x1, a.albion.y1] : null,
  }));
  E.bridges = []
    .concat(
      (world.susp || []).map((s, i) => ({
        id: "BR" + i,
        type: "suspension bridge",
        name: `suspension bridge ${i}`,
        dir: s.dir,
        a: s.a,
        w: s.w,
        span: [s.r0, s.r1],
        towers: [s.t0, s.t1],
      })),
    )
    .concat(
      (world.flyovers || []).map((f) => ({
        id: "FO" + f.id,
        type: "flyover",
        name: `flyover ${f.id}`,
        curve: "CV" + f.cv,
        pts: [f.a, f.b],
      })),
    )
    .concat(
      world.curves
        .filter((c) => c.bridge)
        .map((c) => ({
          id: "CB" + c.id,
          type: "curved bridge",
          name: c.name || `curve ${c.id}`,
          curve: "CV" + c.id,
        })),
    );
  if (typeof RAIL !== "undefined" && RAIL.ready) {
    const line = [];
    for (let s = 0; s < RAIL.L; s += 8) line.push([r1(RAIL.X[s]), r1(RAIL.Y[s])]);
    E.rail = {
      id: "RL0",
      type: "rail line",
      name: "Main line",
      samples: RAIL.L,
      step: 8,
      pts_tiles: line,
    };
    E.stations = RAIL.stations.map((s, i) => ({
      id: "ST" + i,
      type: "station",
      name: s.name,
      kind: s.kind,
      s: s.s,
      pos_tiles: [r1(RAIL.X[s.s]), r1(RAIL.Y[s.s])],
      platform_len: s.len,
    }));
  }
  E.towns = world.labels.map((l, i) => ({
    id: "T" + i,
    type: ["town", "region", "water"][l[3] || 0] || "label",
    name: l[0],
    pos_tiles: [l[1], l[2]],
  }));
  const kinds = {};
  for (const o of world.objects) kinds[o.kind] = (kinds[o.kind] || 0) + 1;
  return JSON.stringify({
    meta: {
      format: "bigrig-map",
      version: 1,
      MW,
      MH,
      TILE_px: TILE,
      metres_per_tile: M_T,
      note: "Exported from the procedural generator (world.js). Positions are in tiles unless named *_m.",
      objectKinds: kinds,
    },
    layers,
    entities: E,
  });
})();

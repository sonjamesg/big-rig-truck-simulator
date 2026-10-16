"use strict";
// ===================== RAILWAY (decorative, v28) =====================
// One double-track main line loops the whole map. Up line (w>0, travels +s) = passenger, stops at stations.
// Down line (w<0, travels -s) = freight, runs through. Every train position is a PURE function of game time:
// tS = gameT*DAY_LEN/24 in [0,1200) and every timetable has an integer 1200 s cycle, so save/load and multiplayer
// (host already sends gameT) reproduce identical trains with no extra state. Blocks/interlocking are checked by
// railSelfTest(); the timetable builder drops trains until the block test passes (so a conflicting train is never run).
const RAIL = {
  ready: false,
  L: 0,
  X: null,
  Y: null,
  NX: null,
  NY: null,
  stations: [],
  cross: [],
  trains: [],
  tracks: [],
  chunkRuns: new Map(),
  spr: {},
  cyc: 1800,
  cycF: 1200,
  test: null,
};
const RAIL_WP = [
  [180, 456],
  [300, 456],
  [430, 456],
  [560, 440],
  [640, 330],
  [680, 215],
  [800, 190],
  [920, 240],
  [990, 360],
  [1100, 400],
  [1250, 430],
  [1360, 560],
  [1480, 630],
  [1610, 680],
  [1720, 730],
  [1725, 840],
  [1705, 960],
  [1600, 1060],
  [1520, 1095],
  [1430, 1180],
  [1360, 1300],
  [1200, 1320],
  [1080, 1305],
  [960, 1300],
  [880, 1300],
  [800, 1300],
  [700, 1340],
  [620, 1380],
  [560, 1450],
  [530, 1580],
  [560, 1720],
  [560, 1850],
  [450, 1890],
  [260, 1880],
  [160, 1720],
  [150, 1420],
  [180, 1250],
  [200, 1130],
  [230, 1010],
  [320, 930],
  [470, 930],
  [400, 840],
  [300, 730],
  [150, 640],
  [140, 530],
];
const RAIL_ST = [
  ["Albion Central", 300, 456, "city"],
  ["Sound Coast", 650, 300, "coast"],
  ["Dustwater", 990, 360, "desert"],
  ["Sandvale Parkway", 1470, 628, "city"],
  ["Coppermine", 1715, 735, "rural"],
  ["Fenwick Forest", 1530, 1092, "forest"],
  ["Kingsbridge North", 1340, 1308, "city"],
  ["Redhill Central", 880, 1300, "hub"],
  ["Greyfell Pass", 532, 1600, "hills"],
  ["Greyfell Sands", 380, 1888, "coast"],
  ["Ashby", 196, 1150, "rural"],
  ["Wendwood", 420, 930, "rural"],
  ["Millford", 300, 730, "town"],
];
const RW_P = 2.1,
  RW_F = -2.1,
  HUB_W = 9,
  HUB_HALF = 150,
  HUB_RAMP = 80;
function rlHash(n) {
  n = n ^ 61 ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
function rlMod(a, L) {
  return ((a % L) + L) % L;
}
function rlSm(x) {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
}
// ---------- v29 router: the main line is laid by an A* over an 8 m grid (state = cell + heading) that hugs main roads / coast at
// 8-12 m from the road edge, never enters buildings or functional sites, crosses roads only straight and at right angles, crosses
// water straight (suspension bridges), and pays heavily for every heading change; the cell path is then string-pulled over open
// land and every corner is filleted with the largest clear radius (no wiggles).
const RR_C = 2,
  RR_TURN = 60,
  RR_DEV = 28,
  RR_APP = 7,
  RR_GR = 25,
  RR_TAIL = 8,
  RR_JR = 60,
  RR_STR = 9;
function rlDT(src) {
  // approx-Euclidean distance (tiles) + nearest source index, 8-neighbour two-pass propagation
  const N = MW * MH,
    D = new Float32Array(N).fill(1e9),
    NI = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++)
    if (src[i]) {
      D[i] = 0;
      NI[i] = i;
    }
  const rel = (i, j) => {
    const s = NI[j];
    if (s < 0) return;
    const dx = (i % MW) - (s % MW),
      dy = ((i / MW) | 0) - ((s / MW) | 0),
      d = Math.sqrt(dx * dx + dy * dy);
    if (d < D[i]) {
      D[i] = d;
      NI[i] = s;
    }
  };
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      if (x > 0) rel(i, i - 1);
      if (y > 0) {
        rel(i, i - MW);
        if (x > 0) rel(i, i - MW - 1);
        if (x < MW - 1) rel(i, i - MW + 1);
      }
    }
    for (let x = MW - 2; x >= 0; x--) rel(y * MW + x, y * MW + x + 1);
  }
  for (let y = MH - 1; y >= 0; y--) {
    for (let x = MW - 1; x >= 0; x--) {
      const i = y * MW + x;
      if (x < MW - 1) rel(i, i + 1);
      if (y < MH - 1) {
        rel(i, i + MW);
        if (x < MW - 1) rel(i, i + MW + 1);
        if (x > 0) rel(i, i + MW - 1);
      }
    }
    for (let x = 1; x < MW; x++) rel(y * MW + x, y * MW + x - 1);
  }
  return { D, NI };
}
const RR_HARDT = {
  [T.BLDG]: 1,
  [T.CONC]: 1,
  [T.LOT]: 1,
  [T.PLAZA]: 1,
  [T.TANK]: 1,
  [T.PUMP]: 1,
  [T.CONT]: 1,
  [T.QUAY]: 1,
  [T.PARK]: 1,
  [T.PGRASS]: 1,
};
const RR_HARDO = {
  bldg: 1,
  tank: 1,
  silo: 1,
  turbine: 1,
  mast: 1,
  runway: 1,
  lot: 1,
  pump: 1,
  canopy: 1,
  mall: 1,
  dealer: 1,
  mallyard: 1,
  dpad: 1,
  yard: 1,
  pond: 1,
  fountain: 1,
  dam: 1,
  cont: 1,
  pallets: 1,
  awning: 1,
  showtruck: 1,
  tbay: 1,
  hgvbay: 1,
  hgvisland: 1,
  drive: 1,
};
function railHardMask(objs) {
  const N = MW * MH,
    H = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (RR_HARDT[G[i]]) H[i] = 1;
  const box = (x0, y0, x1, y1) => {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(MH - 1, Math.floor(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(MW - 1, Math.floor(x1)); x++)
        H[y * MW + x] = 1;
  };
  for (const b of world.funcFP || []) box(b[0], b[1], b[2], b[3]);
  for (const o of objs) {
    if (!RR_HARDO[o.kind] || o._dead) continue;
    const r = o.r || 0;
    if (o.w !== undefined) box(o.x / TILE, o.y / TILE, (o.x + o.w) / TILE, (o.y + o.h) / TILE);
    else box((o.x - r) / TILE, (o.y - r) / TILE, (o.x + r * 2.2) / TILE, (o.y + r * 2.2) / TILE);
  }
  return H;
}
function railRoute(objs) {
  const it = railRouteSteps(objs);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
function railHashArr(h, a) {
  if (!a) return Math.imul(h ^ 0x55, 16777619) >>> 0;
  const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const n = u.length;
  let h1 = h ^ n,
    h2 = 0x9e3779b9;
  for (let i = 0; i + 3 < n; i += 4) {
    const k = u[i] | (u[i + 1] << 8) | (u[i + 2] << 16) | (u[i + 3] << 24);
    h1 = Math.imul(h1 ^ k, 0x01000193);
    h2 = Math.imul(h2 + k, 0x85ebca6b) ^ (h2 >>> 13);
  }
  for (let i = n & ~3; i < n; i++) h1 = Math.imul(h1 ^ u[i], 0x01000193);
  return (h1 ^ h2) >>> 0;
}
function railInKey(H) {
  let h = 2166136261;
  for (const a of [world.ground, H, world.jMask, world.roadH, world.roadV, world.cornerAt])
    h = railHashArr(h, a && a.buffer ? a : null);
  const g = JSON.stringify([
    MW,
    MH,
    RR_C,
    (world.junctions || []).map((J) => [J.x, J.y, J.w, J.h]),
    (world.curves || []).map((c) => [c.w, c.pts.length, c.pts[0]]),
    (world.tapers || []).map((t) => [t.wW, t.pts.length, t.pts[0]]),
    RAIL_ST,
  ]);
  for (let i = 0; i < g.length; i++) h = Math.imul(h ^ g.charCodeAt(i), 16777619) >>> 0;
  return "r1-" + h.toString(36) + "-" + g.length;
}
function railCacheGet(k) {
  try {
    const B = window.RAIL_BAKE;
    if (B && B.k === k) return { raw: railUnpack(B.raw), route: JSON.parse(B.route), src: "bake" };
    const s = localStorage.getItem("bigrig.railc");
    if (s) {
      const o = JSON.parse(s);
      if (o.k === k) return { raw: railUnpack(o.raw), route: JSON.parse(o.route), src: "local" };
    }
  } catch (e) {}
  return null;
}
function railPack(raw) {
  const f = new Float64Array(raw.length * 2);
  raw.forEach((p, i) => {
    f[i * 2] = p[0];
    f[i * 2 + 1] = p[1];
  });
  let s = "";
  const u = new Uint8Array(f.buffer);
  for (let i = 0; i < u.length; i += 8192)
    s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(s);
}
function railUnpack(b) {
  const s = atob(b),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const f = new Float64Array(u.buffer),
    r = [];
  for (let i = 0; i < f.length; i += 2) r.push([f[i], f[i + 1]]);
  return r;
}
function railCachePut(k, raw) {
  try {
    const o = { k, raw: railPack(raw), route: JSON.stringify(RAIL.route) };
    window.__railBakeOut = o;
    localStorage.setItem("bigrig.railc", JSON.stringify(o));
  } catch (e) {}
}
function* railRouteSteps(objs) {
  const t0 = performance.now(),
    N = MW * MH;
  const H = railHardMask(objs);
  RAIL.hard = H;
  // route cache: the A* result is a pure function of the generated world, so reuse it when every input hashes identically
  const RKEY = railInKey(H);
  {
    const c = railCacheGet(RKEY);
    if (c) {
      RAIL.route = c.route;
      RAIL.route.cached = c.src;
      return c.raw;
    }
  }
  const RD = new Uint8Array(N),
    WT = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const g = G[i];
    if (g === T.ROAD || g === T.BRIDGE || g === T.WALK || g === T.ISLAND) RD[i] = 1;
    if (g === T.WATER) WT[i] = 1;
  }
  for (const c of world.curves || [])
    for (const [px, py] of c.pts)
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = Math.floor(px + dx),
            y = Math.floor(py + dy);
          if (inb(x, y) && Math.hypot(x + 0.5 - px, y + 0.5 - py) <= c.w / 2 + 0.5)
            RD[y * MW + x] = 1;
        }
  for (const t of world.tapers || [])
    for (const [px, py] of t.pts)
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const x = Math.floor(px + dx),
            y = Math.floor(py + dy);
          if (inb(x, y) && Math.hypot(x + 0.5 - px, y + 0.5 - py) <= t.wW / 2 + 0.5)
            RD[y * MW + x] = 1;
        }
  const JM = new Uint8Array(N);
  for (const J of world.junctions || [])
    for (let y = J.y; y < J.y + J.h; y++)
      for (let x = J.x; x < J.x + J.w; x++) if (inb(x, y)) JM[y * MW + x] = 1;
  if (world.jMask) for (let i = 0; i < N; i++) if (world.jMask[i]) JM[i] = 1;
  yield "Routing the railway";
  const dH = rlDT(H),
    dR = rlDT(RD),
    dW = rlDT(WT),
    dJ = rlDT(JM);
  // road orientation of the nearest road tile: 1 = h (cross with a vertical move), 2 = v, 0 = not crossable (junction, curve, bridge, roundabout)
  const ori = (i) => {
    const g = G[i];
    if (
      g === T.BRIDGE ||
      (world.jMask && world.jMask[i]) ||
      (world.cornerAt && world.cornerAt[i] >= 0)
    )
      return 0;
    const a = world.roadH[i] >= 0,
      b = world.roadV[i] >= 0;
    if (a === b) return 0;
    return a ? 1 : 2;
  };
  // allowed crossing headings (bit d) for a cell over a road: local road axis by PCA of the road tiles nearby, cross within 23 deg of square
  const crossMask = (ti) => {
    const ni = dR.NI[ti];
    if (ni < 0) return 0;
    const x0 = ni % MW,
      y0 = (ni / MW) | 0;
    let n = 0,
      sx = 0,
      sy = 0,
      sxx = 0,
      syy = 0,
      sxy = 0;
    for (let dy = -7; dy <= 7; dy++)
      for (let dx = -7; dx <= 7; dx++) {
        const x = x0 + dx,
          y = y0 + dy;
        if (!inb(x, y)) continue;
        const j = y * MW + x,
          gg = G[j];
        if (gg === T.BRIDGE || JM[j] || (world.cornerAt && world.cornerAt[j] >= 0)) {
          if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return 0;
          continue;
        }
        if (gg !== T.ROAD) continue;
        n++;
        sx += dx;
        sy += dy;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
      }
    if (n < 6) return 0;
    sx /= n;
    sy /= n;
    const a = sxx / n - sx * sx,
      b = syy / n - sy * sy,
      cc = sxy / n - sx * sy,
      tr = a + b,
      det = a * b - cc * cc,
      l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)),
      l2 = tr - l1;
    if (l1 < 3 * Math.max(l2, 0.05)) return 0;
    const phi = 0.5 * Math.atan2(2 * cc, a - b);
    let m = 0;
    for (let d = 0; d < 8; d++) {
      const ang = (d * Math.PI) / 4;
      let df = Math.abs(
        ((((ang - phi - Math.PI / 2) % Math.PI) + Math.PI * 1.5) % Math.PI) - Math.PI / 2,
      );
      if (df < 0.4) m |= 1 << d;
    }
    return m;
  };
  yield "Routing the railway";
  const GW = MW / RR_C,
    GH = MH / RR_C,
    NC = GW * GH,
    CL = new Uint8Array(NC),
    CO = new Float32Array(NC),
    CR = new Uint8Array(NC); // CL: 0 blocked 1 land 2 road(crossing) 3 water
  const HUBT = RAIL_ST.find((s) => s[3] === "hub"),
    hubX = HUBT[1] / RR_C,
    hubY = HUBT[2] / RR_C;
  for (let cy = 0; cy < GH; cy++)
    for (let cx = 0; cx < GW; cx++) {
      const c = cy * GW + cx,
        ti = (cy * RR_C + 1) * MW + cx * RR_C + 1;
      if (cx < 4 || cy < 4 || cx >= GW - 4 || cy >= GH - 4) {
        continue;
      }
      const hm = dH.D[ti] * M_T - 1.5,
        rm = dR.D[ti] * M_T - 1.5,
        wm = dW.D[ti] * M_T - 1.5,
        hub = Math.hypot(cx - hubX, cy - hubY) * RR_C * M_T < 330;
      if (hm < (hub ? 24 : 7.5)) continue;
      if (rm < 7) {
        if (hub) continue;
        const m = crossMask(ti);
        if (!m) continue;
        CL[c] = 2;
        CR[c] = m;
        CO[c] = 6;
        continue;
      }
      {
        const tx = cx * RR_C + 1,
          ty = cy * RR_C + 1;
        if (tx >= 470 && tx < 810 && ty >= 140 && ty < 462 && (G[ti] === T.WATER || wm < 12))
          continue;
      } // Port Albion basin + ship approach: no track over the berths
      if (G[ti] === T.WATER || wm < 3) {
        CL[c] = 3;
        CO[c] = 3;
        continue;
      }
      if (hub && rm < 20) continue;
      const e = rm;
      let k = e < 8 ? 2.5 : e <= 13 ? 0 : e <= 40 ? 0.3 + (e - 13) * 0.08 : 2.6;
      if (wm >= 8 && wm <= 25) k = Math.min(k, 0.2);
      if (G[ti] === T.ROCK) k += 0.6;
      {
        const jm = dJ.D[ti] * M_T;
        if (jm < RR_JR) k += 2.2 * (1 - jm / RR_JR);
      }
      CL[c] = 1;
      CO[c] = 1 + k;
    }
  yield "Routing the railway";
  // stations: nearest good corridor cell to each named spot
  const used = new Uint8Array(NC);
  const HINT = { "Sound Coast": [840, 330], "Albion Central": [110, 540] };
  const tgt = RAIL_ST.map(([name, tx, ty, kind]) => {
    if (HINT[name]) [tx, ty] = HINT[name];
    const X0 = tx / RR_C,
      Y0 = ty / RR_C;
    let best = -1,
      bs = 1e18;
    const R = 110;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const cx = Math.round(X0 + dx),
          cy = Math.round(Y0 + dy);
        if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) continue;
        const c = cy * GW + cx;
        if (CL[c] !== 1) continue;
        // platform needs a straight, open run around the cell
        let open = 0;
        for (let q = -6; q <= 6; q++) {
          if (CL[c + q] === 1) open++;
        }
        let openV = 0;
        for (let q = -6; q <= 6; q++) {
          const cc = c + q * GW;
          if (cc >= 0 && cc < NC && CL[cc] === 1) openV++;
        }
        {
          const ti = (cy * RR_C + 1) * MW + cx * RR_C + 1;
          if (kind === "hub") {
            if (dH.D[ti] * M_T < 30 || dR.D[ti] * M_T < 24 || dR.D[ti] * M_T > 110) continue;
          } else if (dR.D[ti] * M_T > 40) continue;
        }
        const sc = Math.hypot(dx, dy) + (CO[c] - 1) * 25 + (13 - Math.max(open, openV)) * 6;
        if (sc < bs) {
          bs = sc;
          best = c;
        }
      }
    return { name, kind, c: best };
  });
  {
    const hb = tgt.find((t) => t.kind === "hub"),
      hx = hb.c % GW,
      hy = (hb.c / GW) | 0,
      HR = Math.ceil(330 / M_T / RR_C); // hub throat: wide, clear and crossing-free
    for (let dy = -HR; dy <= HR; dy++)
      for (let dx = -HR; dx <= HR; dx++) {
        if (dx * dx + dy * dy > HR * HR) continue;
        const cx = hx + dx,
          cy = hy + dy;
        if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) continue;
        const c = cy * GW + cx,
          ti = (cy * RR_C + 1) * MW + cx * RR_C + 1;
        if (CL[c] === 2 || dH.D[ti] * M_T - 1.5 < 24 || dR.D[ti] * M_T - 1.5 < 20) CL[c] = 0;
      }
  }
  RAIL._CL = CL;
  RAIL._CO = CO;
  RAIL._tgt = tgt;
  RAIL._GW = GW;
  yield "Routing the railway";
  // A*
  const DX = [1, 1, 0, -1, -1, -1, 0, 1],
    DY = [0, 1, 1, 1, 0, -1, -1, -1],
    NS = NC * 8,
    g = new Float32Array(NS),
    pv = new Int8Array(NS),
    stamp = new Uint16Array(NS);
  let heap = new Int32Array(1 << 20),
    hk = new Float32Array(1 << 20),
    hn = 0;
  const push = (s, k) => {
    if (hn >= heap.length) {
      const a = new Int32Array(heap.length * 2);
      a.set(heap);
      heap = a;
      const b = new Float32Array(hk.length * 2);
      b.set(hk);
      hk = b;
    }
    let i = hn++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p] <= k) break;
      heap[i] = heap[p];
      hk[i] = hk[p];
      i = p;
    }
    heap[i] = s;
    hk[i] = k;
  };
  const pop = () => {
    const top = heap[0];
    hn--;
    if (hn > 0) {
      const s = heap[hn],
        k = hk[hn];
      let i = 0;
      for (;;) {
        let l = 2 * i + 1;
        if (l >= hn) break;
        if (l + 1 < hn && hk[l + 1] < hk[l]) l++;
        if (hk[l] >= k) break;
        heap[i] = heap[l];
        hk[i] = hk[l];
        i = l;
      }
      heap[i] = s;
      hk[i] = k;
    }
    return top;
  };
  const legs = [];
  let cur = null,
    stp = 0;
  const startC = tgt[0].c;
  let goalSet = null;
  let strN = 0;
  const leg = function* (seeds, goalC, goalDir) {
    for (const sn of [RR_STR]) {
      strN = sn;
      const r = yield* leg1(seeds, goalC, goalDir);
      if (r) return r;
    }
    return null;
  };
  const leg1 = function* (seeds, goalC, goalDir) {
    stp++;
    {
      goalSet = new Set();
      const gx0 = goalC % GW,
        gy0 = (goalC / GW) | 0;
      const GR_ = (tgt.find((t) => t.kind === "hub") || {}).c === goalC ? 5 : RR_GR;
      for (let dy = -GR_; dy <= GR_; dy++)
        for (let dx = -GR_; dx <= GR_; dx++)
          if (dx * dx + dy * dy <= GR_ * GR_) {
            const q = (gy0 + dy) * GW + gx0 + dx;
            if (q >= 0 && q < NC && CL[q] === 1) goalSet.add(q);
          }
    }
    hn = 0;
    const gx = goalC % GW,
      gy = (goalC / GW) | 0;
    const h = (c) => {
      const dx = Math.abs((c % GW) - gx),
        dy = Math.abs(((c / GW) | 0) - gy);
      return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
    };
    const seed = (s, v) => {
      stamp[s] = stp;
      g[s] = v;
      pv[s] = 9;
      push(s, v + h(s >> 3));
    };
    for (const s0 of seeds) seed(s0, 0);
    let found = -1,
      it = 0;
    while (hn > 0) {
      if ((it & 4095) === 4095) yield "Routing the railway";
      const s = pop(),
        c = s >> 3,
        d = s & 7;
      it++;
      const gs = g[s];
      if (gs > 0 && (closeSet ? closeSet.has(s) : goalSet.has(c))) {
        found = s;
        break;
      }
      const cl = CL[c];
      for (const dd of cl === 1 ? [0, -1, 1] : [0]) {
        const nd = (d + dd + 8) & 7,
          nx = (c % GW) + DX[nd],
          ny = ((c / GW) | 0) + DY[nd];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const nc = ny * GW + nx,
          ncl = CL[nc];
        if (!ncl) continue;
        if (used[nc] && !(closeSet && closeCells.has(nc))) continue;
        if (ncl === 2 && !((CR[nc] >> nd) & 1)) continue;
        if (ncl !== 1 && dd) continue;
        let xp = 0;
        if (dd && strN) {
          let q = s,
            bad = false;
          for (let h2 = 0; h2 < strN; h2++) {
            const pd_ = pv[q];
            if (pd_ === 9) break;
            if (pd_ !== 0) {
              bad = true;
              break;
            }
            const qc = q >> 3,
              qd = q & 7;
            q = (qc - DX[qd] - DY[qd] * GW) * 8 + qd;
            if (stamp[q] !== stp) break;
          }
          if (bad) xp = RR_TURN * 1.5;
        }
        if (dd) {
          let bad = false;
          const cx0 = c % GW,
            cy0 = (c / GW) | 0;
          for (let q = 1; q <= RR_APP && !bad; q++) {
            const ax = cx0 + DX[nd] * q,
              ay = cy0 + DY[nd] * q,
              bx = cx0 - DX[d] * (q - 1),
              by = cy0 - DY[d] * (q - 1);
            if (ax >= 0 && ay >= 0 && ax < GW && ay < GH && CL[ay * GW + ax] >= 2) bad = true;
            if (bx >= 0 && by >= 0 && bx < GW && by < GH && CL[by * GW + bx] >= 2) bad = true;
          }
          if (bad) continue;
        }
        if (nd & 1) {
          const a = CL[c + DX[nd]],
            b = CL[c + DY[nd] * GW];
          if (a !== 1 && b !== 1 && ncl === 1) continue;
        }
        const ns = nc * 8 + nd,
          ng = gs + CO[nc] * (nd & 1 ? 1.4142 : 1) + (dd ? RR_TURN : 0) + xp;
        if (stamp[ns] !== stp || ng < g[ns]) {
          stamp[ns] = stp;
          g[ns] = ng;
          pv[ns] = dd;
          push(ns, ng + h(nc));
        }
      }
    }
    if (found < 0) return null;
    const path = [];
    let s = found;
    while (true) {
      path.push(s);
      const dd = pv[s];
      if (dd === 9) break;
      const c = s >> 3,
        d = s & 7,
        pc = c - DX[d] - DY[d] * GW,
        pd = (d - dd + 8) & 7;
      s = pc * 8 + pd;
    }
    return path.reverse();
  };
  const order = tgt.map((t, i) => i);
  let all = [],
    fail = [];
  const markUsed = (path, keepStart) => {
    for (const s of path) {
      const c = s >> 3,
        cx = c % GW,
        cy = (c / GW) | 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const q = (cy + dy) * GW + cx + dx;
          if (q >= 0 && q < NC) used[q] = 1;
        }
    }
    if (keepStart) {
      const sx = startC % GW,
        sy = (startC / GW) | 0;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) used[(sy + dy) * GW + sx + dx] = 0;
    }
  };
  let prev = null,
    closeSet = null,
    closeCells = null;
  for (let k = 1; k <= tgt.length + 1; k++) {
    yield "Routing the railway";
    const goal = k <= tgt.length ? tgt[k % tgt.length].c : startC;
    const gd = -1;
    let path;
    if (k === 1)
      path = yield* leg(
        [0, 1, 2, 3, 4, 5, 6, 7].map((d) => startC * 8 + d),
        goal,
        -1,
      );
    else {
      // release the cells around the previous leg's end so we can continue out of it
      const TB = Math.min(RR_TAIL, all.length - 2),
        tail = all.slice(all.length - TB);
      for (const ts of tail) {
        const ec = ts >> 3,
          ex = ec % GW,
          ey = (ec / GW) | 0;
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) used[(ey + dy) * GW + ex + dx] = 0;
      }
      if (k === tgt.length + 1) {
        closeSet = new Map();
        closeCells = new Set();
        for (let q = 4; q < Math.min(all.length - 1, 90); q++) {
          closeSet.set(all[q], q);
          closeCells.add(all[q] >> 3);
        }
        for (let q = 0; q < Math.min(all.length - 1, 90); q++) {
          const c = all[q] >> 3,
            cx = c % GW,
            cy = (c / GW) | 0;
          for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++) used[(cy + dy) * GW + cx + dx] = 0;
        }
      }
      path = yield* leg(k === tgt.length + 1 ? [prev] : tail, goal, gd);
      if (path) {
        const q = all.lastIndexOf(path[0]);
        if (q >= 0) all.length = q + 1;
      }
    }
    if (!path) {
      RAIL.routeFail = tgt[k % tgt.length].name;
      RAIL._seen = new Uint8Array(NC);
      RAIL._used = used;
      for (let q = 0; q < NS; q++) if (stamp[q] === stp) RAIL._seen[q >> 3] = 1;
      return null;
    }
    if (k === 1) {
      const mid = path.length >> 1;
      all = path.slice(mid);
      used.fill(0);
      markUsed(all, false);
    } // loop starts mid-way along leg 1, so the closing legs re-lay the Albion end freely
    else {
      all = all.concat(path.slice(1));
      markUsed(path, false);
    }
    // re-block the immediate tail except the last cell (continuation)
    prev = path[path.length - 1];
  }
  {
    const j = closeSet.get(prev);
    all = all.slice(j);
    all.pop();
  } // loop closes onto the first leg at index j
  RAIL.route = {
    ms: Math.round(performance.now() - t0),
    cells: all.length,
    stations: tgt.map((t) => [t.name, (t.c % GW) * RR_C + 1, ((t.c / GW) | 0) * RR_C + 1]),
  };
  // polyline vertices at heading changes (metres)
  const P = (c) => [((c % GW) * RR_C + 1) * M_T, (((c / GW) | 0) * RR_C + 1) * M_T];
  {
    let best = 0,
      bl = 0,
      run = 0;
    for (let i = 0; i < all.length * 2; i++) {
      const a = all[i % all.length] & 7,
        b = all[(i + 1) % all.length] & 7;
      if (a === b) {
        run++;
        if (run > bl && i < all.length + run) {
          bl = run;
          best = i - (run >> 1);
        }
      } else run = 0;
    }
    const r = ((best % all.length) + all.length) % all.length;
    all = all.slice(r).concat(all.slice(0, r));
  }
  RAIL._all = all;
  let V = [],
    VA = [],
    VK = [];
  const n = all.length,
    stC = new Set(tgt.map((t) => t.c));
  for (let i = 0; i < n; i++) {
    const d1 = all[(i + 1) % n] & 7,
      an = stC.has(all[i] >> 3);
    if ((all[i] & 7) !== d1 || i === 0 || an) {
      V.push(P(all[i] >> 3));
      VA.push(i === 0);
      VK.push(i);
    }
  }
  // string-pull: drop vertices when the shortcut stays on open land
  const cellAtM = (x, y) => {
    const cx = Math.floor(x / M_T / RR_C),
      cy = Math.floor(y / M_T / RR_C);
    return cy * GW + cx;
  };
  const clearLine = (a, b, okW) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s <= L; s += 2) {
      const x = a[0] + ((b[0] - a[0]) * s) / L,
        y = a[1] + ((b[1] - a[1]) * s) / L,
        ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
      if (dH.D[ti] * M_T < 9 || dR.D[ti] * M_T < 9) return false;
      if (!okW && dW.D[ti] * M_T < 4) return false;
    }
    return true;
  };
  const devOK = (k0, k1, a, b) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    for (let k = k0; k <= k1; k++) {
      const p = P(all[k % n] >> 3);
      if (Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l > RR_DEV) return false;
    }
    return true;
  };
  const devOK2 = (a, b, pts) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    for (const p of pts)
      if (Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l > RR_DEV) return false;
    return true;
  };
  RAIL._clearLine = clearLine;
  RAIL._dist = { dH, dR, dW };
  for (let pass = 0; pass < 3; pass++) {
    const out = [V[0]],
      oa = [true],
      ok_ = [VK[0]];
    let i = 0;
    while (i < V.length) {
      let lim = i + 1;
      while (lim < V.length && !VA[lim] && lim < i + 14) lim++;
      let j = lim;
      for (; j > i + 1; j--) {
        const b = V[j % V.length];
        if (clearLine(V[i], b, false) && devOK(VK[i], j < V.length ? VK[j] : n, V[i], b)) break;
      }
      if (j <= i + 1) j = i + 1;
      if (j < V.length) {
        out.push(V[j]);
        oa.push(VA[j]);
        ok_.push(VK[j]);
      }
      i = j;
    }
    V = out;
    VA = oa;
    VK = ok_;
  }
  // de-jog: drop S-bends (short segment between opposite turns) and merge two same-way turns into one corner, while clear
  {
    const cl2 = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let q = 0; q <= L; q += 1.5) {
        const x = a[0] + ((b[0] - a[0]) * q) / L,
          y = a[1] + ((b[1] - a[1]) * q) / L,
          ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
        if (dH.D[ti] * M_T < 9 || dR.D[ti] * M_T < 9 || dW.D[ti] * M_T < 3) return false;
      }
      return true;
    };
    const crs = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    for (let it = 0; it < 6; it++) {
      let ch = false;
      for (let i = 0; i < V.length && V.length > 8; i++) {
        const m = V.length,
          a = V[(i - 1 + m) % m],
          b = V[i],
          c = V[(i + 1) % m],
          d = V[(i + 2) % m],
          bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
        if (bc > 90) continue;
        const s1 = Math.sign(crs(a, b, c)),
          s2 = Math.sign(crs(b, c, d));
        if (s1 && s2 && s1 !== s2) {
          if (cl2(a, d) && devOK2(a, d, [b, c])) {
            V.splice((i + 1) % m, 1);
            V.splice(V.indexOf(b), 1);
            ch = true;
          }
          continue;
        }
        if (s1 && s1 === s2) {
          const r = [b[0] - a[0], b[1] - a[1]],
            q = [d[0] - c[0], d[1] - c[1]],
            den = r[0] * q[1] - r[1] * q[0];
          if (Math.abs(den) < 1e-6) continue;
          const tt = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den;
          if (tt <= 0) continue;
          const X = [a[0] + r[0] * tt, a[1] + r[1] * tt];
          if (Math.hypot(X[0] - b[0], X[1] - b[1]) > 120) continue;
          if (cl2(a, X) && cl2(X, d)) {
            const j = V.indexOf(c);
            V[i] = X;
            V.splice(j, 1);
            ch = true;
          }
        }
      }
      if (!ch) break;
    }
  }
  // tight-corner cleanup: a corner that cannot take a 40 m+ radius is cut out when the chord across it stays clear (7 m margin)
  {
    const clr = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let q = 0; q <= L; q += 1.5) {
        const x = a[0] + ((b[0] - a[0]) * q) / L,
          y = a[1] + ((b[1] - a[1]) * q) / L,
          ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
        if (
          dH.D[ti] * M_T < 7.5 ||
          (dR.D[ti] * M_T < 7 && dR.D[ti] * M_T < Math.min(q, L - q)) ||
          dW.D[ti] * M_T < 2
        )
          return false;
      }
      return true;
    };
    const okArc = (pts) => {
      for (const [x, y] of pts) {
        const ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
        if (dH.D[ti] * M_T < 9 || dR.D[ti] * M_T < 9 || dW.D[ti] * M_T < 2) return false;
      }
      return true;
    };
    const bestR = (i) => {
      const m = V.length,
        a = V[(i - 1 + m) % m],
        b = V[i],
        c = V[(i + 1) % m];
      const u = [b[0] - a[0], b[1] - a[1]],
        v = [c[0] - b[0], c[1] - b[1]],
        lu = Math.hypot(...u),
        lv = Math.hypot(...v);
      const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
      if (th < 1e-3) return 1e9;
      const un = [u[0] / lu, u[1] / lu],
        vn = [v[0] / lv, v[1] / lv];
      for (const r of [200, 110, 60, 40]) {
        const t = r * Math.tan(th / 2);
        if (t > lu * 0.5 || t > lv * 0.5) continue;
        const p0 = [b[0] - un[0] * t, b[1] - un[1] * t],
          cr = un[0] * vn[1] - un[1] * vn[0],
          sg = cr > 0 ? 1 : -1,
          C = [p0[0] - un[1] * sg * r, p0[1] + un[0] * sg * r],
          a0 = Math.atan2(p0[1] - C[1], p0[0] - C[0]);
        const pts = [],
          NS_ = Math.max(8, Math.ceil((r * th) / 2));
        for (let k = 0; k <= NS_; k++) {
          const aa = a0 + (sg * th * k) / NS_;
          pts.push([C[0] + Math.cos(aa) * r, C[1] + Math.sin(aa) * r]);
        }
        if (okArc(pts)) return r;
      }
      return 0;
    };
    const freeBack = (b, dir, max) => {
      for (let q = 0; q <= max; q += 1) {
        const x = b[0] - dir[0] * q,
          y = b[1] - dir[1] * q,
          ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
        if (dR.D[ti] * M_T < 9 || dW.D[ti] * M_T < 3) return Math.max(0, q - 10);
      }
      return max;
    };
    const rOf = (i) => {
      const m = V.length,
        a = V[(i - 1 + m) % m],
        b = V[i],
        c = V[(i + 1) % m];
      const u = [b[0] - a[0], b[1] - a[1]],
        v = [c[0] - b[0], c[1] - b[1]],
        lu = Math.hypot(...u),
        lv = Math.hypot(...v);
      const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
      if (th < 1e-3) return 1e9;
      const un = [u[0] / lu, u[1] / lu],
        vn = [v[0] / lv, v[1] / lv],
        f0 = freeBack(b, un, lu * 0.5),
        f1 = freeBack(b, [-vn[0], -vn[1]], lv * 0.5);
      for (const r of [200, 110, 60, 40]) {
        const t = r * Math.tan(th / 2);
        if (t > f0 || t > f1) continue;
        const p0 = [b[0] - un[0] * t, b[1] - un[1] * t],
          cr = un[0] * vn[1] - un[1] * vn[0],
          sg = cr > 0 ? 1 : -1,
          C = [p0[0] - un[1] * sg * r, p0[1] + un[0] * sg * r],
          a0 = Math.atan2(p0[1] - C[1], p0[0] - C[0]);
        const pts = [],
          NS_ = Math.max(8, Math.ceil((r * th) / 2));
        for (let k = 0; k <= NS_; k++) {
          const aa = a0 + (sg * th * k) / NS_;
          pts.push([C[0] + Math.cos(aa) * r, C[1] + Math.sin(aa) * r]);
        }
        if (okArc(pts)) return r;
      }
      return 0;
    };
    const segOK = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let q = 0; q <= L; q += 1.5) {
        const x = a[0] + ((b[0] - a[0]) * q) / L,
          y = a[1] + ((b[1] - a[1]) * q) / L,
          ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
        if (dH.D[ti] * M_T < 7.5) return false;
      }
      return true;
    };
    const segNR = (a, b) => {
      if (!segOK(a, b)) return false;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let q = 0; q <= L; q += 1.5) {
        const x = a[0] + ((b[0] - a[0]) * q) / L,
          y = a[1] + ((b[1] - a[1]) * q) / L,
          ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
        if (dR.D[ti] * M_T < 9 || dW.D[ti] * M_T < 3) return false;
      }
      return true;
    };
    for (let it = 0; it < 8; it++) {
      let ch = false;
      for (let i = 0; i < V.length && V.length > 8; i++) {
        if (rOf(i) >= 40) continue;
        const m = V.length;
        if (clr(V[(i - 1 + m) % m], V[(i + 1) % m])) {
          V.splice(i, 1);
          ch = true;
          i--;
          continue;
        }
        // slide the corner (and the following segment) further along the incoming direction or back against the outgoing one
        const a = V[(i - 1 + m) % m],
          b = V[i],
          c = V[(i + 1) % m],
          d = V[(i + 2) % m],
          e0 = V[(i - 2 + m) % m];
        const un = (() => {
            const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
            return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
          })(),
          vn = (() => {
            const l = Math.hypot(c[0] - b[0], c[1] - b[1]);
            return [(c[0] - b[0]) / l, (c[1] - b[1]) / l];
          })();
        let done = false;
        for (const dist of [15, 30, 45, 60, 80, 100]) {
          for (const mode of [0, 1]) {
            const sh = mode ? [-vn[0] * dist, -vn[1] * dist] : [un[0] * dist, un[1] * dist];
            const B = [b[0] + sh[0], b[1] + sh[1]];
            const save = V.slice();
            if (mode === 0) {
              const C = [c[0] + sh[0], c[1] + sh[1]];
              V[i] = B;
              V[(i + 1) % m] = C;
              if (!(
                segOK(a, B) &&
                segOK(B, C) &&
                segNR(C, d) &&
                rOf(i) >= 40 &&
                rOf((i + 1) % m) >= 40
              )) {
                V = save;
                continue;
              }
            } else {
              const A = [a[0] + sh[0], a[1] + sh[1]];
              V[i] = B;
              V[(i - 1 + m) % m] = A;
              if (!(
                segNR(e0, A) &&
                segOK(A, B) &&
                segOK(B, c) &&
                rOf(i) >= 40 &&
                rOf((i - 1 + m) % m) >= 40
              )) {
                V = save;
                continue;
              }
            }
            done = true;
            ch = true;
            break;
          }
          if (!done) {
            // merge a short dog-leg: replace a and b by the intersection of lines e0-a and b-c
            const r = [a[0] - e0[0], a[1] - e0[1]],
              q = [c[0] - b[0], c[1] - b[1]],
              den = r[0] * q[1] - r[1] * q[0];
            if (Math.abs(den) > 1e-6) {
              const tt = ((b[0] - e0[0]) * q[1] - (b[1] - e0[1]) * q[0]) / den,
                X = [e0[0] + r[0] * tt, e0[1] + r[1] * tt];
              if (
                tt > 0.3 &&
                Math.hypot(X[0] - b[0], X[1] - b[1]) < 120 &&
                segOK(e0, X) &&
                segOK(X, c) &&
                segNR(a, X) &&
                segNR(X, b)
              ) {
                const save = V.slice(),
                  ia = (i - 1 + m) % m;
                V[i] = X;
                V.splice(ia, 1);
                done = true;
                ch = true;
              }
            }
          }
          if (done) break;
        }
      }
      if (!ch) break;
    }
    RAIL.route.slid = 1;
  }
  // fillets
  const raw = [];
  const nV = V.length;
  const tl = new Float32Array(nV),
    Rv = new Float32Array(nV);
  const geo = (i) => {
    const a = V[(i - 1 + nV) % nV],
      b = V[i],
      c = V[(i + 1) % nV];
    const u = [b[0] - a[0], b[1] - a[1]],
      v = [c[0] - b[0], c[1] - b[1]],
      lu = Math.hypot(u[0], u[1]),
      lv = Math.hypot(v[0], v[1]);
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    return { a, b, c, u: [u[0] / lu, u[1] / lu], v: [v[0] / lv, v[1] / lv], lu, lv, th };
  };
  const arcPts = (G_, R) => {
    const t = R * Math.tan(G_.th / 2),
      p0 = [G_.b[0] - G_.u[0] * t, G_.b[1] - G_.u[1] * t],
      cr = G_.u[0] * G_.v[1] - G_.u[1] * G_.v[0],
      sg = cr > 0 ? 1 : -1,
      nrm = [-G_.u[1] * sg, G_.u[0] * sg],
      C = [p0[0] + nrm[0] * R, p0[1] + nrm[1] * R];
    const a0 = Math.atan2(p0[1] - C[1], p0[0] - C[0]),
      pts = [];
    const steps = Math.max(2, Math.ceil((R * G_.th) / 2));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (sg * G_.th * k) / steps;
      pts.push([C[0] + Math.cos(a) * R, C[1] + Math.sin(a) * R]);
    }
    return pts;
  };
  const arcOK = (pts) => {
    for (const [x, y] of pts) {
      const ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
      if (dH.D[ti] * M_T < 9 || dR.D[ti] * M_T < 9 || dW.D[ti] * M_T < 2) return false;
    }
    return true;
  };
  const RS = [900, 700, 600, 450, 350, 260, 200, 150, 110, 80, 60, 50, 45, 41, 36, 32, 24, 16];
  const fit = (i, lim0, lim1) => {
    const G_ = geo(i);
    if (G_.th < 1e-3) return [0, 0];
    for (const r of RS) {
      const t = r * Math.tan(G_.th / 2);
      if (t > lim0 || t > lim1) continue;
      if (arcOK(arcPts(G_, r))) return [r, t];
    }
    for (const r of [24, 16, 12, 8, 5, 3]) {
      const t = r * Math.tan(G_.th / 2);
      if (t > lim0 || t > lim1) continue;
      if (arcOK(arcPts(G_, r))) return [r, t];
    }
    return [0, 0];
  };
  // free length at each end of every segment before its road crossing (fillets must not bend a crossing)
  const fr0 = new Float32Array(nV),
    fr1 = new Float32Array(nV); // segment i = V[i] -> V[i+1]
  for (let i = 0; i < nV; i++) {
    const a = V[i],
      b = V[(i + 1) % nV],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let f0 = L,
      f1 = L;
    for (let s2 = 0; s2 <= L; s2 += 1) {
      const x = a[0] + ((b[0] - a[0]) * s2) / L,
        y = a[1] + ((b[1] - a[1]) * s2) / L,
        ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T);
      if (dR.D[ti] * M_T < 9 || dW.D[ti] * M_T < 3) {
        f0 = Math.min(f0, s2);
        f1 = Math.min(f1, L - s2);
      }
    }
    fr0[i] = f0 >= L ? L : Math.max(0, f0 - 10);
    fr1[i] = f1 >= L ? L : Math.max(0, f1 - 10);
  }
  // station reservations: keep (platform/2 + 35 m) of straight either side of every station point lying on a segment
  {
    const SP = tgt.map((t) => ({
      p: P(t.c),
      h:
        (t.kind === "hub"
          ? HUB_HALF * 2
          : t.kind === "city"
            ? 200
            : t.kind === "town"
              ? 160
              : 120) /
          2 +
        35,
    }));
    const seg = (i) => {
      const a = V[i],
        b = V[(i + 1) % nV],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, L, ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L };
    };
    const HINT2 = { "Sound Coast": [840, 330], "Albion Central": [110, 540] };
    const RO = new Uint8Array(MW * MH);
    for (let i = 0; i < MW * MH; i++) if (G[i] === T.ROAD) RO[i] = 1;
    const dRO = rlDT(RO);
    RAIL.route.resv = [];
    SP.forEach((q, k) => {
      if (!{ Coppermine: 1, "Greyfell Sands": 1, "Albion Central": 1 }[RAIL_ST[k][0]]) return;
      const r = RAIL_ST[k],
        O = (HINT2[r[0]] || [r[1], r[2]]).map((v) => v * M_T);
      let best = null,
        bd = 1e18;
      const MG = r[0] === "Coppermine" ? 0 : r[0] === "Sandvale Parkway" ? 25 : 45;
      for (let i = 0; i < nV; i++) {
        const S = seg(i);
        if (S.L < 2 * q.h + 2 * MG) continue;
        for (let t = q.h + MG; t <= S.L - q.h - MG; t += 8) {
          const cx = S.a[0] + S.ux * t,
            cy = S.a[1] + S.uy * t,
            d = Math.hypot(cx - O[0], cy - O[1]);
          if (d >= bd) continue;
          let ok = true,
            near = 1e9;
          for (let u = -q.h + 20; u <= q.h - 20; u += 4) {
            const x = cx + S.ux * u,
              y = cy + S.uy * u,
              ti = Math.floor(y / M_T) * MW + Math.floor(x / M_T),
              dr = dR.D[ti] * M_T;
            if (dr < 11 || dW.D[ti] * M_T < 6 || dH.D[ti] * M_T < 7) {
              ok = false;
              break;
            }
            near = Math.min(near, dRO.D[ti] * M_T);
          }
          if (ok && near < 70) {
            bd = d;
            best = [i, t];
          }
        }
      }
      if (!best) {
        RAIL.route.resv.push([r[0], "none"]);
        return;
      }
      const [bi, t0] = best,
        S = seg(bi);
      fr0[bi] = Math.min(fr0[bi], Math.max(0, t0 - q.h));
      fr1[bi] = Math.min(fr1[bi], Math.max(0, S.L - t0 - q.h));
      RAIL.route.resv.push([r[0], Math.round(bd)]);
      RAIL.route.stations[k] = [r[0], (S.a[0] + S.ux * t0) / M_T, (S.a[1] + S.uy * t0) / M_T];
      (RAIL.route.resOK = RAIL.route.resOK || {})[r[0]] = 1;
    });
  }
  for (let i = 0; i < nV; i++) {
    const G_ = geo(i),
      a = (i - 1 + nV) % nV;
    [Rv[i], tl[i]] = fit(i, Math.min(G_.lu * 0.5, fr1[a]), Math.min(G_.lv * 0.5, fr0[i]));
  }
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < nV; i++) {
      const G_ = geo(i),
        a = (i - 1 + nV) % nV,
        b = (i + 1) % nV;
      const [r, t] = fit(
        i,
        Math.min(G_.lu - tl[a] - 1, fr1[a]),
        Math.min(G_.lv - tl[b] - 1, fr0[i]),
      );
      if (r > Rv[i]) {
        Rv[i] = r;
        tl[i] = t;
      }
    }
  for (let i = 0; i < nV; i++) {
    const G_ = geo(i);
    if (tl[i] > 0) for (const p of arcPts(G_, Rv[i])) raw.push(p);
    else raw.push(G_.b);
    // straight to next arc start
    const n2 = (i + 1) % nV,
      G2 = geo(n2),
      e = raw[raw.length - 1],
      s2 = [G2.b[0] - G2.u[0] * tl[n2], G2.b[1] - G2.u[1] * tl[n2]],
      L = Math.hypot(s2[0] - e[0], s2[1] - e[1]);
    for (let s = 2; s < L; s += 2)
      raw.push([e[0] + ((s2[0] - e[0]) * s) / L, e[1] + ((s2[1] - e[1]) * s) / L]);
  }
  // curvature report (radius over 30 m chords)
  {
    const m = raw.length;
    let mn = 1e9;
    const st = 15;
    for (let i = 0; i < m; i++) {
      const a = raw[(i - st + m) % m],
        b = raw[i],
        c = raw[(i + st) % m];
      const A2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (A2 < 1e-6) continue;
      const R =
        (Math.hypot(b[0] - a[0], b[1] - a[1]) *
          Math.hypot(c[0] - b[0], c[1] - b[1]) *
          Math.hypot(c[0] - a[0], c[1] - a[1])) /
        (2 * A2);
      if (R < mn) mn = R;
    }
    RAIL.route.minRsm = Math.round(mn);
  }
  RAIL.route.verts = nV;
  RAIL.route.minR = Math.round(Math.min(...Array.from(Rv).filter((r) => r > 0)));
  RAIL.route.radii = Array.from(Rv).map(Math.round);
  RAIL.route.small = V.map((v, i) => [
    Math.round(v[0] / M_T),
    Math.round(v[1] / M_T),
    Math.round(Rv[i]),
  ]).filter((q) => q[2] > 0 && q[2] < 100);
  RAIL.route.tgt = tgt;
  RAIL.route.ms = Math.round(performance.now() - t0);
  railCachePut(RKEY, raw);
  return raw;
}
// ---------- geometry
function railBuild(objs) {
  for (const _ of railBuildSteps(objs));
}
function* railBuildSteps(objs) {
  let raw = yield* railRouteSteps(objs);
  if (!raw) {
    raw = [];
    const W = RAIL_WP.map((p) => [p[0] * M_T, p[1] * M_T]),
      n = W.length;
    console.warn("rail router failed", RAIL.routeFail); // fallback: legacy spline
    for (let i = 0; i < n; i++) {
      const p0 = W[(i - 1 + n) % n],
        p1 = W[i],
        p2 = W[(i + 1) % n],
        p3 = W[(i + 2) % n],
        seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]),
        k = Math.ceil(seg / 2);
      for (let j = 0; j < k; j++) {
        const t = j / k,
          t2 = t * t,
          t3 = t2 * t;
        raw.push([
          0.5 *
            (2 * p1[0] +
              (-p0[0] + p2[0]) * t +
              (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
              (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 *
            (2 * p1[1] +
              (-p0[1] + p2[1]) * t +
              (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
              (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
  }
  yield "Laying the railway";
  // resample at exactly 1 m
  const cum = [0];
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1],
      b = raw[i % raw.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const L = Math.floor(cum[raw.length]);
  RAIL.L = L;
  const X = new Float32Array(L),
    Y = new Float32Array(L),
    NX = new Float32Array(L),
    NY = new Float32Array(L);
  let j = 0;
  for (let s = 0; s < L; s++) {
    const S = (s * cum[raw.length]) / L;
    while (cum[j + 1] < S) j++;
    const a = raw[j],
      b = raw[(j + 1) % raw.length],
      f = (S - cum[j]) / (cum[j + 1] - cum[j] || 1);
    X[s] = a[0] + (b[0] - a[0]) * f;
    Y[s] = a[1] + (b[1] - a[1]) * f;
  }
  {
    const L0 = L;
    let A = X,
      B = Y;
    for (let pass = 0; pass < 3; pass++) {
      const A2 = new Float32Array(L0),
        B2 = new Float32Array(L0),
        K = 5;
      let sx = 0,
        sy = 0;
      for (let d = -K; d <= K; d++) {
        sx += A[(d + L0) % L0];
        sy += B[(d + L0) % L0];
      }
      for (let i = 0; i < L0; i++) {
        A2[i] = sx / (2 * K + 1);
        B2[i] = sy / (2 * K + 1);
        const o = (i - K + L0) % L0,
          n = (i + K + 1) % L0;
        sx += A[n] - A[o];
        sy += B[n] - B[o];
      }
      A = A2;
      B = B2;
    }
    const c2 = new Float64Array(L0 + 1);
    for (let i = 1; i <= L0; i++) {
      const a = i - 1,
        b = i % L0;
      c2[i] = c2[i - 1] + Math.hypot(A[b] - A[a], B[b] - B[a]);
    }
    let q = 0;
    const tot = c2[L0];
    for (let s = 0; s < L0; s++) {
      const S2 = (s * tot) / L0;
      while (c2[q + 1] < S2) q++;
      const b = (q + 1) % L0,
        f = (S2 - c2[q]) / (c2[q + 1] - c2[q] || 1);
      X[s] = A[q] + (A[b] - A[q]) * f;
      Y[s] = B[q] + (B[b] - B[q]) * f;
    }
  } // smoothed centreline: no kinks at straight/arc joins
  for (let s = 0; s < L; s++) {
    const a = (s - 2 + L) % L,
      b = (s + 2) % L,
      tx = X[b] - X[a],
      ty = Y[b] - Y[a],
      l = Math.hypot(tx, ty) || 1;
    NX[s] = ty / l;
    NY[s] = -tx / l;
  } // left normal of +s travel
  Object.assign(RAIL, { X, Y, NX, NY });
  yield "Placing stations";
  // stations
  const STT =
    RAIL.route && RAIL.route.stations
      ? RAIL_ST.map((r, i) => [r[0], RAIL.route.stations[i][1], RAIL.route.stations[i][2], r[3]])
      : RAIL_ST;
  for (const [name, tx, ty, kind] of STT.concat([["Albion Airport", 435, 663, "city"]])) {
    let best = 0,
      bd = 1e18;
    for (let s = 0; s < L; s++) {
      const d = (X[s] - tx * M_T) ** 2 + (Y[s] - ty * M_T) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    const len = kind === "hub" ? HUB_HALF * 2 : kind === "city" ? 200 : kind === "town" ? 160 : 120;
    RAIL.stations.push({
      fixed: name === "Albion Airport",
      name,
      kind,
      s: best,
      s0: best,
      res: !!(RAIL.route && RAIL.route.resOK && RAIL.route.resOK[name]),
      len,
      dwell: kind === "hub" ? 40 : kind === "city" ? 30 : 20 + Math.round(rlHash(best) * 8),
    });
  }
  // keep every platform on dry land (no water/bridge/road under it) with a road within reach; slide along the track to the nearest such spot
  {
    const wet = (i, w, rd) => {
      const tx = Math.floor((X[i] + NX[i] * w) / M_T),
        ty = Math.floor((Y[i] + NY[i] * w) / M_T),
        g = get(tx, ty);
      return g === T.WATER || g === T.BRIDGE || (rd && g === T.ROAD);
    };
    const dry = (c, st) => {
      const h = st.len / 2 + 6;
      for (let s = c - h; s <= c + h; s += 2) {
        const i = rlMod(Math.round(s), L);
        for (let w = -12; w <= 12; w += 2) if (wet(i, w, 0)) return false;
      }
      return true;
    };
    const okAt = (c, st) => {
      const h = st.len / 2 + 12,
        hub = st.kind === "hub";
      for (let s = c - h; s <= c + h; s += 2) {
        const i = rlMod(Math.round(s), L);
        for (let w = hub ? -14 : -3; w <= (hub ? 19 : 7.5); w += 1.5)
          if (wet(i, w, 1)) return false;
      }
      for (const o of RAIL.stations)
        if (
          o !== st &&
          o._ok &&
          Math.abs(rlMod(o.s - c + L / 2, L) - L / 2) < (o.len + st.len) / 2 + 150
        )
          return false;
      if (st.res && Math.abs(rlMod(c - st.s0 + L / 2, L) - L / 2) <= 30) return true; // router-reserved straight, road-adjacent spot
      const tx = Math.floor(X[c] / M_T),
        ty = Math.floor(Y[c] / M_T),
        R = Math.ceil((st.kind === "hub" ? 130 : 70) / M_T);
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const g = get(tx + dx, ty + dy);
          if (g === T.ROAD) return true;
        }
      return false;
    };
    const straight = (c, st) => {
      const h = st.len / 2 + 30,
        m2 = rlMod(Math.round(c), L);
      for (let q = -h; q <= h; q += 8) {
        const a = rlMod(Math.round(c + q), L);
        if (NX[a] * NX[m2] + NY[a] * NY[m2] < 0.9992) return false;
      }
      return true;
    };
    for (const st of RAIL.stations) {
      if (st.fixed) continue;
      if (st.kind !== "hub" && okAt(st.s, st) && !straight(st.s, st)) {
        for (let d = 4; d <= 600; d += 4) {
          let hit = -1;
          for (const c of [st.s + d, st.s - d]) {
            const cc = rlMod(c, L);
            if (okAt(cc, st) && straight(cc, st)) {
              hit = cc;
              break;
            }
          }
          if (hit >= 0) {
            RAIL.moved = (RAIL.moved || []).concat([[st.name + " (straight)", d]]);
            st.s = hit;
            break;
          }
        }
      }
    }
    for (const st of RAIL.stations) {
      if (st.fixed || okAt(st.s, st)) {
        st._ok = 1;
        continue;
      }
      const ox = X[st.s],
        oy = Y[st.s];
      let hit = -1,
        hd = 1e18;
      for (const needS of [1, 0]) {
        if (hit >= 0) break;
        for (let c = 0; c < L; c += 4) {
          const d = (X[c] - ox) ** 2 + (Y[c] - oy) ** 2;
          if (
            d < hd &&
            d < 1500 * 1500 &&
            okAt(c, st) &&
            (!needS || st.kind === "hub" || straight(c, st))
          ) {
            hd = d;
            hit = c;
          }
        }
      }
      if (hit >= 0) {
        RAIL.moved = (RAIL.moved || []).concat([[st.name, Math.round(Math.sqrt(hd))]]);
        st.s = hit;
      }
      st._ok = 1;
    }
  }
  RAIL.stations.sort((a, b) => a.s - b.s);
  RAIL.hub = RAIL.stations.find((s) => s.kind === "hub");
  // tracks (lateral offset functions)
  const H = RAIL.hub.s,
    hb = (s, half, ramp) => {
      const d = Math.abs(rlMod(s - H + L / 2, L) - L / 2);
      return d < half ? 1 : d < half + ramp ? rlSm(1 - (d - half) / ramp) : 0;
    };
  RAIL.hubB = (s) => hb(s, HUB_HALF, HUB_RAMP);
  RAIL.tracks = [
    { id: "up", w: () => RW_P, s0: 0, s1: L, main: 1 },
    { id: "down", w: () => RW_F, s0: 0, s1: L, main: 1 },
    {
      id: "loop",
      w: (s) => RW_P + HUB_W * RAIL.hubB(s),
      s0: H - HUB_HALF - HUB_RAMP,
      s1: H + HUB_HALF + HUB_RAMP,
    },
    { id: "sid1", w: (s) => RW_F - 4.6 * hb(s, 110, 60), s0: H - 170, s1: H + 170 },
    { id: "sid2", w: (s) => RW_F - 9.2 * hb(s, 90, 70), s0: H - 160, s1: H + 160 },
  ];
  yield "Surveying the track";
  // sample tracks, classify ground under each sample
  const band = new Set();
  for (const tr of RAIL.tracks) {
    const P = [];
    for (let s = Math.floor(tr.s0); s <= Math.ceil(tr.s1); s++) {
      const i = rlMod(s, L),
        w = tr.w(s),
        x = X[i] + NX[i] * w,
        y = Y[i] + NY[i] * w;
      const tx = Math.floor(x / M_T),
        ty = Math.floor(y / M_T);
      let g = get(tx, ty),
        k = 0;
      if (g === T.WATER || (g === T.BRIDGE && !roadSegAt(tx, ty))) k = 2;
      else if (g === T.ROAD || g === T.BRIDGE) {
        const sg = roadSegAt(tx, ty);
        k = sg && sg.type === "hwy" ? 3 : 1;
      }
      P.push({ s, x, y, nx: NX[i], ny: NY[i], k });
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) band.add((ty + dy) * MW + tx + dx);
    }
    tr.P = P;
  }
  // stations' platforms keep their land clear too
  for (const st of RAIL.stations)
    for (let s = st.s - st.len / 2 - 10; s <= st.s + st.len / 2 + 10; s += 2) {
      const i = rlMod(Math.round(s), L);
      for (let w = 0; w <= (st.kind === "hub" ? 20 : 10); w += 2) {
        const tx = Math.floor((X[i] + NX[i] * w) / M_T),
          ty = Math.floor((Y[i] + NY[i] * w) / M_T);
        band.add(ty * MW + tx);
      }
    }
  yield "Clearing the rail corridor";
  // clear buildings/trees from the band (never roads, water or functional sites)
  const KILL = {
    bldg: 1,
    tree: 1,
    hedge: 1,
    bush: 1,
    rock: 1,
    scrub: 1,
    cactus: 1,
    bale: 1,
    fountain: 1,
    pond: 1,
    silo: 1,
    tank: 1,
    field: 1,
  };
  for (const o of objs) {
    if (!KILL[o.kind] || o._dead) continue;
    const x0 = Math.floor(o.x / TILE),
      y0 = Math.floor(o.y / TILE),
      x1 = Math.floor((o.x + (o.w || 0)) / TILE),
      y1 = Math.floor((o.y + (o.h || 0)) / TILE);
    let hit = false;
    for (let ty = y0; ty <= y1 && !hit; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (band.has(ty * MW + tx)) {
          hit = true;
          break;
        }
    if (hit) o._dead = 1;
  }
  for (const k of band) {
    const t = G[k];
    if (
      t === T.BLDG ||
      t === T.TREE ||
      t === T.HEDGE ||
      t === T.PGRASS ||
      t === T.PARK ||
      t === T.TANK ||
      t === T.PUMP ||
      t === T.CONT
    )
      G[k] = T.GRAVEL;
  }
  yield "Building level crossings";
  // crossings (from the centreline + both main tracks)
  const up = RAIL.tracks[0].P,
    dn = RAIL.tracks[1].P;
  let run = null;
  for (let s = 0; s <= L; s++) {
    const i = s % L,
      k = Math.max(
        up[i].k === 1 || up[i].k === 3 ? up[i].k : 0,
        dn[i].k === 1 || dn[i].k === 3 ? dn[i].k : 0,
      );
    if (k && s < L) {
      if (!run) run = { sa: s, sb: s, over: k === 3 };
      else {
        run.sb = s;
        if (k === 3) run.over = true;
      }
    } else if (run) {
      if (run.sb - run.sa < 60) RAIL.cross.push(run);
      run = null;
    }
  }
  for (const c of RAIL.cross) {
    const m = Math.round((c.sa + c.sb) / 2) % L;
    c.m = m;
    c.mx = X[m];
    c.my = Y[m];
    c.tx = -NY[m];
    c.ty = NX[m];
    c.nx = NX[m];
    c.ny = NY[m];
    c.half = (c.sb - c.sa) / 2 + 1.5;
    c.f = 0;
    c.lit = 0;
    c.za = c.sa - 3;
    c.zb = c.sb + 3;
    if (!c.over)
      for (let s = c.sa - 1; s <= c.sb + 1; s++)
        for (const tr of [up, dn]) {
          const p = tr[rlMod(s, L)];
          if (p.k === 1) p.k = 4;
        }
  } // 4 = level-crossing panel
  // per-chunk index of sample runs
  for (let ti = 0; ti < RAIL.tracks.length; ti++) {
    const P = RAIL.tracks[ti].P;
    for (let i = 0; i < P.length; i++) {
      const p = P[i],
        px = p.x * PPM,
        py = p.y * PPM,
        m = 8 * PPM;
      for (let cy = Math.floor((py - m) / CHUNK); cy <= Math.floor((py + m) / CHUNK); cy++)
        for (let cx = Math.floor((px - m) / CHUNK); cx <= Math.floor((px + m) / CHUNK); cx++) {
          const key = cx + "," + cy;
          let a = RAIL.chunkRuns.get(key);
          if (!a) RAIL.chunkRuns.set(key, (a = []));
          const last = a[a.length - 1];
          if (last && last[0] === ti && last[2] === i - 1) last[2] = i;
          else a.push([ti, i, i]);
        }
    }
  }
  for (const st of RAIL.stations) {
    const i = st.s;
    const key = Math.floor((X[i] * PPM) / CHUNK) + "," + Math.floor((Y[i] * PPM) / CHUNK);
  }
  yield "Building rail bridges";
  railBridges();
  yield "Writing the timetable";
  railTimetable();
  RAIL.ready = true;
}
function roadSegAt(tx, ty) {
  if (!inb(tx, ty)) return null;
  const i = idx(tx, ty),
    a = world.roadH[i],
    b = world.roadV[i];
  const k = a >= 0 ? a : b >= 0 ? b : -1;
  return k >= 0 ? world.segs[k] : null;
}
// ---------- timetable (pure functions of t in [0,cyc))
const RAIL_PAX = [
  { n: "Albion Express", c: "hst", cars: 7, liv: 0 },
  { n: "Kingsbridge Metro", c: "emu", cars: 4, liv: 3 },
  { n: "Sandreach InterCity", c: "hst", cars: 9, liv: 1 },
  { n: "Highmoor Sprinter", c: "dmu", cars: 3, liv: 2 },
];
const RAIL_FRT = [
  { n: "Coal", c: "hop", cars: 14, liv: 0 },
  { n: "Intermodal", c: "flat", cars: 11, liv: 1 },
  { n: "Fuel tanks", c: "tank", cars: 12, liv: 2, dbl: 1 },
  { n: "Mixed", c: "mix", cars: 10, liv: 3 },
];
const CAR_L = { hst: 20, coach: 23, emu: 20, dmu: 20, loco: 21, hop: 14, flat: 19, tank: 16 };
function railConsist(sp, frt) {
  const out = [];
  const add = (k, o) => out.push(Object.assign({ k, L: CAR_L[k], liv: sp.liv }, o || {}));
  if (!frt) {
    if (sp.c === "hst") {
      add("hst");
      for (let i = 0; i < sp.cars; i++) add("coach", { i });
      add("hst", { flip: 1 });
    } else
      for (let i = 0; i < sp.cars; i++)
        add(sp.c, {
          flip: i === sp.cars - 1 ? 1 : 0,
          mid: i > 0 && i < sp.cars - 1,
          first: i === 0,
        });
  } else {
    add("loco");
    if (sp.dbl) add("loco");
    for (let i = 0; i < sp.cars; i++) {
      const k = sp.c === "mix" ? ["hop", "flat", "tank"][(i * 7 + 3) % 3] : sp.c;
      add(k, { seed: i * 31 + sp.liv * 7 });
    }
  }
  let off = 0;
  for (const c of out) {
    c.off = off + c.L / 2;
    off += c.L + 1.2;
  }
  return { cars: out, len: off };
}
function railTimetable() {
  const L = RAIL.L,
    C = RAIL.cyc,
    st = RAIL.stations,
    n = st.length,
    A = 0.8;
  const dwell = st.reduce((a, b) => a + b.dwell, 0);
  const legs = st.map((s, i) => rlMod(st[(i + 1) % n].s - s.s, L) || L);
  const legT = (d, v) => {
    const da = (v * v) / A;
    return d >= da ? d / v + v / A : 2 * Math.sqrt(d / A);
  };
  let lo = 5,
    hi = 90;
  for (let it = 0; it < 60; it++) {
    const v = (lo + hi) / 2,
      T_ = dwell + legs.reduce((a, d) => a + legT(d, v), 0);
    if (T_ > C) lo = v;
    else hi = v;
  }
  const V = (lo + hi) / 2;
  RAIL.vP = V;
  // table at 0.25 s: arc position of a passenger train with phase 0 (starts departing station 0 after dwell)
  const N = C * 4,
    tab = new Float32Array(N + 1);
  let t = 0,
    k = 0;
  const ev = [];
  for (let i = 0; i < n; i++) {
    ev.push({ t0: t, t1: t + st[i].dwell, s0: st[i].s, d: 0 });
    t += st[i].dwell;
    const tt = legT(legs[i], V);
    ev.push({ t0: t, t1: t + tt, s0: st[i].s, d: legs[i] });
    t += tt;
  }
  const scale = C / t;
  for (const e of ev) {
    e.t0 *= scale;
    e.t1 *= scale;
  }
  for (let q = 0; q <= N; q++) {
    const tq = q / 4;
    while (k < ev.length - 1 && ev[k].t1 < tq) k++;
    const e = ev[k];
    let s = e.s0;
    if (e.d) {
      const T_ = e.t1 - e.t0,
        u = Math.max(0, Math.min(T_, tq - e.t0)),
        d = e.d,
        ta = T_ * 0.25,
        vm = d / (T_ - ta),
        a = vm / ta;
      s +=
        u < ta
          ? 0.5 * a * u * u
          : u < T_ - ta
            ? 0.5 * a * ta * ta + vm * (u - ta)
            : d - 0.5 * a * (T_ - u) ** 2;
    }
    tab[q] = rlMod(s, RAIL.L);
  }
  // make the cruise piece exact (distance-preserving)
  RAIL.tabP = tab;
  RAIL.ev = ev;
  RAIL.vF = L / RAIL.cycF; // freight: one lap per 1200 s
  // choose train counts: largest that passes the block self-test
  for (let np = 4; np >= 1; np--) {
    for (let nf = 4; nf >= 1; nf--) {
      railMakeTrains(np, nf);
      const r = railSelfTest(2, 1);
      if (r.ok) {
        RAIL.test = r;
        return;
      }
    }
  }
}
function railMakeTrains(np, nf) {
  const C = RAIL.cyc;
  RAIL.trains = [];
  for (let k = 0; k < np; k++) {
    const sp = RAIL_PAX[k % RAIL_PAX.length],
      cs = railConsist(sp, false);
    RAIL.trains.push({
      id: "P" + k,
      pax: 1,
      sp,
      cars: cs.cars,
      len: cs.len,
      ph: (k * C) / np,
      plat: k % 2,
    });
  }
  for (let k = 0; k < nf; k++) {
    const sp = RAIL_FRT[k % RAIL_FRT.length],
      cs = railConsist(sp, true);
    RAIL.trains.push({
      id: "F" + k,
      pax: 0,
      sp,
      cars: cs.cars,
      len: cs.len,
      ph: (k * RAIL.cycF) / nf,
    });
  }
}
function railTime() {
  return gameDay * DAY_LEN + (gameT * DAY_LEN) / 24;
} // absolute game seconds; every timetable is periodic in it
// head arc position (centreline s) at time t; passenger heads travel +s, freight heads travel -s
function railHead(tr, t) {
  const C = RAIL.cyc,
    L = RAIL.L;
  if (tr.pax) {
    const u = rlMod(t + tr.ph, C) * 4,
      q = Math.floor(u),
      f = u - q,
      a = RAIL.tabP[q],
      b = RAIL.tabP[Math.min(q + 1, C * 4)];
    let d = rlMod(b - a, L);
    if (d > L / 2) d -= L;
    return rlMod(a + d * f, L);
  }
  return rlMod(-(rlMod(t + tr.ph, RAIL.cycF) * RAIL.vF), L);
}
function railSpan(tr, t, m) {
  const h = railHead(tr, t);
  m = m || 0;
  return tr.pax ? [h - tr.len - m, h + m] : [h - m, h + tr.len + m];
} // occupied centreline arc, front to back
function rlOvl(a0, a1, b0, b1) {
  const L = RAIL.L,
    d = rlMod(a0 - b0, L);
  return d < b1 - b0 || d + (a1 - a0) > L;
}
function railDwelling(tr, t) {
  const C = RAIL.cyc,
    u = rlMod(t + tr.ph, C);
  for (const e of RAIL.ev)
    if (!e.d && u >= e.t0 && u < e.t1)
      return {
        st: RAIL.stations.find((s) => s.s === e.s0),
        ph: (u - e.t0) / (e.t1 - e.t0),
        T: e.t1 - e.t0,
      };
  return null;
}
// block signalling self-test: fixed step over several cycles; one train per block, one train in the hub points
function railSelfTest(days, step) {
  const L = RAIL.L,
    NB = Math.max(8, Math.floor(L / 600)),
    blk = L / NB,
    H = RAIL.hub.s;
  let minGap = 1e9,
    viol = 0,
    samples = 0;
  for (let t = 0; t < days * 3600; t += step) {
    samples++;
    for (const grp of [RAIL.trains.filter((x) => x.pax), RAIL.trains.filter((x) => !x.pax)]) {
      const occ = new Map();
      let hubN = 0;
      for (const tr of grp) {
        const [a, b] = railSpan(tr, t, 0);
        const b0 = Math.floor(rlMod(a, L) / blk),
          b1 = Math.floor(rlMod(b, L) / blk);
        for (let q = b0; ; q = (q + 1) % NB) {
          if (occ.has(q) && occ.get(q) !== tr) viol++;
          occ.set(q, tr);
          if (q === b1) break;
        }
        if (rlOvl(a, b, H - HUB_HALF - HUB_RAMP, H + HUB_HALF + HUB_RAMP)) hubN++;
      }
      if (hubN > 1) viol++;
      for (let i = 0; i < grp.length; i++)
        for (let j = 0; j < grp.length; j++) {
          if (i === j) continue;
          const A = railSpan(grp[i], t, 0),
            B = railSpan(grp[j], t, 0);
          const g = rlMod(B[0] - A[1], L);
          if (g < minGap) minGap = g;
          if (rlOvl(A[0], A[1], B[0], B[1])) viol++;
        }
    }
  }
  return {
    ok: viol === 0,
    viol,
    minGap: Math.round(minGap),
    samples,
    days,
    blocks: NB,
    trains: RAIL.trains.length,
  };
}
// ---------- crossings: barrier state from whole-train occupancy (front to back + margin)
function railOcc(c, t) {
  for (const tr of RAIL.trains) {
    const [a, b] = railSpan(tr, t, 4);
    if (rlOvl(a, b, c.za, c.zb)) return true;
  }
  if (typeof rlExtSpans === "function")
    for (const q of rlExtSpans()) if (rlOvl(q[0] - 4, q[1] + 4, c.za, c.zb)) return true;
  return false;
} // rl: yard trains on the main line close crossings too
function railCrossState(c, t) {
  if (railOcc(c, t)) {
    // failsafe: never closed for more than 150 s
    let closed = true;
    for (let k = 10; k <= 150; k += 10)
      if (!railOcc(c, t - k)) {
        closed = false;
        break;
      }
    return closed ? { f: 0, lit: 0 } : { f: 1, lit: 1 };
  }
  let ahead = 99;
  for (let k = 0.5; k <= 9; k += 0.5)
    if (railOcc(c, t + k)) {
      ahead = k;
      break;
    }
  let since = 99;
  for (let k = 0.5; k <= 2; k += 0.5)
    if (railOcc(c, t - k)) {
      since = k;
      break;
    }
  const down = ahead <= 6.5 ? rlSm((6.5 - ahead) / 3) : 0,
    up = since <= 2 ? 1 - since / 2 : 0;
  return { f: Math.max(down, up), lit: ahead <= 9 || since <= 1.5 ? 1 : 0 };
}
function railFrame() {
  if (!RAIL.ready) return;
  const t = railTime();
  if (RAIL._t === t) return;
  RAIL._t = t;
  const cx = cam.x / PPM,
    cy = cam.y / PPM,
    tx = truck.x,
    ty = truck.y;
  for (const c of RAIL.cross) {
    if (c.over) continue;
    if (Math.min(Math.hypot(c.mx - cx, c.my - cy), Math.hypot(c.mx - tx, c.my - ty)) > 900) {
      c.f = 0;
      c.lit = 0;
      continue;
    }
    const r = railCrossState(c, t);
    c.f = r.f;
    c.lit = r.lit;
  }
}
// AI traffic: treat a lit crossing like a red light at the barrier line
function railStopAcc(v, v0) {
  if (!RAIL.ready || v.h === undefined) return 1e9;
  let acc = 1e9;
  const d = fwd(v.h);
  for (const c of RAIL.cross) {
    if (!c.lit && c.f < 0.05) continue;
    const rx = v.x - c.mx,
      ry = v.y - c.my;
    if (rx * rx + ry * ry > 70 * 70) continue;
    const u = rx * c.tx + ry * c.ty,
      w = rx * c.nx + ry * c.ny,
      dn = d[0] * c.nx + d[1] * c.ny;
    if (Math.abs(u) > c.half + 4 || Math.abs(dn) < 0.35) continue;
    if (Math.sign(w) === Math.sign(dn)) continue; // moving away from the tracks
    const gap = (Math.abs(w) - 8.5) / Math.abs(dn) - v.L / 2;
    if (gap < -0.5) continue;
    acc = Math.min(acc, idmAcc(v, v0, Math.max(0.1, gap), 0));
  }
  return acc;
}
// player truck: barrier arms block movement INTO the crossing only, never out of it
function railBodyPts(s) {
  const pts = [],
    f = fwd(s.h),
    r = rgt(s.h);
  for (const ly of [CAB.front, 0, CAB.rear])
    for (const lx of [-CAB.w / 2, CAB.w / 2])
      pts.push([s.x - f[0] * ly + r[0] * lx, s.y - f[1] * ly + r[1] * lx]);
  if (s.trl) {
    const k = kingpin(s),
      ft = fwd(s.th),
      rt = rgt(s.th);
    for (const ly of [TRL.front, (TRL.front + TRL.rear) / 2, TRL.rear])
      for (const lx of [-TRL.w / 2, TRL.w / 2])
        pts.push([k[0] - ft[0] * ly + rt[0] * lx, k[1] - ft[1] * ly + rt[1] * lx]);
  }
  return pts;
}
function railBarrierHit(s, prev) {
  if (!RAIL.ready) return false;
  let near = null;
  for (const c of RAIL.cross) {
    if (c.over || c.f < 0.6) continue;
    if (Math.hypot(c.mx - s.x, c.my - s.y) < 45) {
      near = c;
      break;
    }
  }
  if (!near) return false;
  const c = near,
    A = railBodyPts(s),
    B = railBodyPts(Object.assign({}, s, prev)),
    AW = 6.6;
  for (const q of B) {
    const ub = (q[0] - c.mx) * c.tx + (q[1] - c.my) * c.ty,
      wb = (q[0] - c.mx) * c.nx + (q[1] - c.my) * c.ny;
    if (Math.abs(ub) < c.half + 0.5 && Math.abs(wb) < AW) return false;
  } // already on the crossing: always free to leave
  for (let i = 0; i < A.length; i++) {
    const ua = (A[i][0] - c.mx) * c.tx + (A[i][1] - c.my) * c.ty,
      wa = (A[i][0] - c.mx) * c.nx + (A[i][1] - c.my) * c.ny,
      wb = (B[i][0] - c.mx) * c.nx + (B[i][1] - c.my) * c.ny;
    if (Math.abs(ua) < c.half + 0.5 && Math.abs(wb) >= AW && Math.abs(wa) < AW) return true;
  }
  return false;
}
// ---------- baked track (chunk cache)
function railChunk(g, ox, oy, top) {
  if (!RAIL.ready) return;
  const runs = RAIL.chunkRuns.get(Math.floor(ox / CHUNK) + "," + Math.floor(oy / CHUNK));
  if (!runs) return;
  const S = PPM;
  g.save();
  g.translate(-ox, -oy);
  g.lineCap = "butt";
  g.lineJoin = "round";
  const path = (P, i0, i1, w) => {
    g.beginPath();
    for (let i = i0; i <= i1; i++) {
      const p = P[i];
      const x = (p.x + p.nx * w) * S,
        y = (p.y + p.ny * w) * S;
      i === i0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
  };
  const sub = (P, i0, i1, test, fn) => {
    let a = -1;
    for (let i = i0; i <= i1 + 1; i++) {
      const ok = i <= i1 && test(P[i].k);
      if (ok && a < 0) a = Math.max(i0, i - 1);
      if (!ok && a >= 0) {
        fn(a, Math.min(i1, i));
        a = -1;
      }
    }
  };
  const rails = (P, a, b) => {
    for (const w of [-0.75, 0.75]) {
      path(P, a, b, w);
      g.strokeStyle = "rgba(0,0,0,0.6)";
      g.lineWidth = 0.46 * S;
      g.stroke();
      g.strokeStyle = "#8e959e";
      g.lineWidth = 0.3 * S;
      g.stroke();
      g.strokeStyle = "#f6f9fc";
      g.lineWidth = 0.11 * S;
      g.stroke();
    }
  };
  const outer = (ti) => (ti === 1 || ti === 3 || ti === 4 ? -1 : 1);
  if (top) {
    // level-crossing panels + rails redrawn above road markings / junction paint
    for (const [ti, i0, i1] of runs) {
      const P = RAIL.tracks[ti].P;
      sub(
        P,
        i0,
        i1,
        (k) => k === 4,
        (a, b) => {
          path(P, a, b, 0);
          g.strokeStyle = "#3b3d41";
          g.lineWidth = 3.8 * S;
          g.stroke();
          g.strokeStyle = "#55585e";
          g.lineWidth = 3.3 * S;
          g.stroke();
          g.strokeStyle = "#d9d4c6";
          g.lineWidth = 0.16 * S;
          for (const w of [-1.85, 1.85]) {
            path(P, a, b, w);
            g.stroke();
          }
          for (let i = a; i < b; i++) {
            const p = P[i];
            g.fillStyle = "rgba(0,0,0,0.28)";
            for (const w of [-1.25, 0, 1.25])
              g.fillRect((p.x + p.nx * w) * S - 1, (p.y + p.ny * w) * S - 1, 2, 2);
          }
          rails(P, a, b);
        },
      );
    }
    g.restore();
    return;
  }
  for (const [ti, i0, i1] of runs) {
    const P = RAIL.tracks[ti].P;
    sub(
      P,
      i0,
      i1,
      (k) => k === 0,
      (a, b) => {
        path(P, a, b, 0);
        g.strokeStyle = "#463f38";
        g.lineWidth = 5.0 * S;
        g.stroke();
        g.strokeStyle = "#5f564d";
        g.lineWidth = 4.2 * S;
        g.stroke();
        g.strokeStyle = "#6a6056";
        g.lineWidth = 3.0 * S;
        g.stroke();
      },
    );
    sub(
      P,
      i0,
      i1,
      (k) => k === 2,
      (a, b) => {
        path(P, a, b, 0);
        g.strokeStyle = "rgba(0,0,0,0.4)";
        g.lineWidth = 5.6 * S;
        g.save();
        g.translate(22, 30);
        g.stroke();
        g.restore();
        g.strokeStyle = "#4a5058";
        g.lineWidth = 5.6 * S;
        g.stroke();
        g.strokeStyle = "#6b7179";
        g.lineWidth = 4.4 * S;
        g.stroke();
        const o = outer(ti);
        path(P, a, b, o * 2.55);
        g.strokeStyle = "#2c3036";
        g.lineWidth = 0.5 * S;
        g.stroke();
        g.strokeStyle = "#cfd4da";
        g.lineWidth = 0.22 * S;
        g.stroke();
        for (let i = a; i <= b; i += 3) {
          const p = P[i];
          g.fillStyle = "#2c3036";
          g.fillRect((p.x + p.nx * o * 2.55) * S - 1.5, (p.y + p.ny * o * 2.55) * S - 1.5, 3, 3);
        }
      },
    );
    sub(
      P,
      i0,
      i1,
      (k) => k === 4,
      (a, b) => {
        path(P, a, b, 0);
        g.strokeStyle = "#3b3d41";
        g.lineWidth = 3.8 * S;
        g.stroke();
      },
    );
  }
  for (const [ti, i0, i1] of runs) {
    const P = RAIL.tracks[ti].P;
    // ballast stones + sleepers
    for (let i = i0; i <= i1; i++) {
      const p = P[i];
      if (p.k !== 0 && p.k !== 2) continue;
      const tx = -p.ny,
        ty = p.nx;
      if (p.k === 0)
        for (let q = 0; q < 14; q++) {
          const h = rlHash((p.s * 13 + q) * 7919 + ti * 97),
            h2 = rlHash((h * 1e9) | 0),
            w = (h - 0.5) * 4.4,
            u = h2 - 0.5;
          const x = (p.x + p.nx * w + tx * u) * S,
            y = (p.y + p.ny * w + ty * u) * S;
          g.fillStyle = ["#7d7266", "#4b433b", "#8e8478", "#5a5148", "#9c9286", "#3f3832"][q % 6];
          g.fillRect(x, y, 1.5 + (q & 1) * 1.2, 1.5 + (q % 3 === 0 ? 1 : 0));
        }
      for (let k2 = 0; k2 < 2; k2++) {
        const u = k2 * 0.5;
        if (i === P.length - 1) break;
        const q = P[i + 1];
        const cx = (p.x + (q.x - p.x) * u) * S,
          cy = (p.y + (q.y - p.y) * u) * S,
          hx = p.nx * 1.35 * S,
          hy = p.ny * 1.35 * S,
          ax = tx * 0.15 * S,
          ay = ty * 0.15 * S;
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.beginPath();
        g.moveTo(cx - hx - ax + 1, cy - hy - ay + 1.5);
        g.lineTo(cx + hx - ax + 1, cy + hy - ay + 1.5);
        g.lineTo(cx + hx + ax + 1, cy + hy + ay + 1.5);
        g.lineTo(cx - hx + ax + 1, cy - hy + ay + 1.5);
        g.fill();
        g.fillStyle = p.k === 2 ? "#26282b" : "#2f2721";
        g.beginPath();
        g.moveTo(cx - hx - ax, cy - hy - ay);
        g.lineTo(cx + hx - ax, cy + hy - ay);
        g.lineTo(cx + hx + ax, cy + hy + ay);
        g.lineTo(cx - hx + ax, cy - hy + ay);
        g.fill();
        g.fillStyle = "#55473b";
        g.fillRect(cx - hx * 0.9 - 0.5, cy - hy * 0.9 - 0.5, 1, 1);
        g.fillStyle = "#5a5048";
        g.fillRect(cx + hx * 0.55 - 1, cy + hy * 0.55 - 1, 2, 2);
        g.fillRect(cx - hx * 0.55 - 1, cy - hy * 0.55 - 1, 2, 2);
      }
    }
    sub(
      P,
      i0,
      i1,
      (k) => k !== 3,
      (a, b) => rails(P, a, b),
    );
  }
  // suspension-bridge tower + cable shadows on the water (static, baked once per chunk)
  for (const br of RAIL.bridges || []) {
    if (
      br.cx * S < ox - 1500 ||
      br.cx * S > ox + CHUNK + 1500 ||
      br.cy * S < oy - 1500 ||
      br.cy * S > oy + CHUNK + 1500
    )
      continue;
    const sh = (x, y, h) => [x * S + h * S * 0.55, y * S + h * S * 0.75];
    g.strokeStyle = "rgba(0,20,40,0.28)";
    g.lineCap = "round";
    for (const sd of [-1, 1]) {
      g.lineWidth = 0.8 * S;
      g.beginPath();
      br.cab.forEach(([s, h], k) => {
        const d = railPt(s, sd * BR_LAT),
          q = sh(d[0], d[1], h);
        k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
      });
      g.stroke();
    }
    g.fillStyle = "rgba(0,20,40,0.32)";
    for (const sT of br.tw) {
      for (const sd of [-1, 1]) {
        const b = railPt(sT, sd * BR_TW);
        g.lineWidth = 2.4 * S;
        g.beginPath();
        g.moveTo(b[0] * S, b[1] * S);
        const q = sh(b[0], b[1], BR_H);
        g.lineTo(q[0], q[1]);
        g.stroke();
      }
      for (const f of [0.5, 0.78, 0.98]) {
        const l = railPt(sT, -BR_TW),
          r = railPt(sT, BR_TW),
          a1 = sh(l[0], l[1], BR_H * f),
          a2 = sh(r[0], r[1], BR_H * f);
        g.lineWidth = 1.4 * S;
        g.beginPath();
        g.moveTo(a1[0], a1[1]);
        g.lineTo(a2[0], a2[1]);
        g.stroke();
      }
    }
    g.lineCap = "butt";
  }
  // stations (platforms, shelters, canopies, signs)
  for (const st of RAIL.stations) {
    const px = RAIL.X[st.s] * S,
      py = RAIL.Y[st.s] * S;
    if (px < ox - 2600 || px > ox + CHUNK + 2600 || py < oy - 2600 || py > oy + CHUNK + 2600)
      continue;
    railBakeStation(g, st);
  }
  g.restore();
}
// rs: same look as the main line's plain-ground track (ballast bed, stones, sleepers, rails) for any sampled path P=[{x,y,nx,ny,s,k}] at 1 m spacing.
// k:0 full track, k:5 rails only (where a spur overlays the main line at a turnout). Used by yard sidings / spurs (owndepot.js).
function railDrawPlain(g, P, seed, vx0, vy0, vx1, vy1) {
  if (!P || P.length < 2) return;
  const S = PPM,
    m = 40;
  const vis = (p) =>
    p.x * S > vx0 - m && p.x * S < vx1 + m && p.y * S > vy0 - m && p.y * S < vy1 + m;
  g.save();
  g.lineCap = "butt";
  g.lineJoin = "round";
  const path = (a, b, w) => {
    g.beginPath();
    for (let i = a; i <= b; i++) {
      const p = P[i];
      const x = (p.x + p.nx * w) * S,
        y = (p.y + p.ny * w) * S;
      i === a ? g.moveTo(x, y) : g.lineTo(x, y);
    }
  };
  const runs = (test) => {
    const out = [];
    let a = -1;
    for (let i = 0; i <= P.length; i++) {
      const ok = i < P.length && test(P[i]) && vis(P[i]);
      if (ok && a < 0) a = Math.max(0, i - 1);
      if (!ok && a >= 0) {
        out.push([a, Math.min(P.length - 1, i)]);
        a = -1;
      }
    }
    return out;
  };
  for (const [a, b] of runs((p) => p.k === 0)) {
    path(a, b, 0);
    g.strokeStyle = "#463f38";
    g.lineWidth = 5.0 * S;
    g.stroke();
    g.strokeStyle = "#5f564d";
    g.lineWidth = 4.2 * S;
    g.stroke();
    g.strokeStyle = "#6a6056";
    g.lineWidth = 3.0 * S;
    g.stroke();
  }
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.k !== 0 || !vis(p)) continue;
    const tx = -p.ny,
      ty = p.nx;
    for (let q = 0; q < 14; q++) {
      const h = rlHash((p.s * 13 + q) * 7919 + seed * 97),
        h2 = rlHash((h * 1e9) | 0),
        w = (h - 0.5) * 4.4,
        u = h2 - 0.5;
      const x = (p.x + p.nx * w + tx * u) * S,
        y = (p.y + p.ny * w + ty * u) * S;
      g.fillStyle = ["#7d7266", "#4b433b", "#8e8478", "#5a5148", "#9c9286", "#3f3832"][q % 6];
      g.fillRect(x, y, 1.5 + (q & 1) * 1.2, 1.5 + (q % 3 === 0 ? 1 : 0));
    }
    for (let k2 = 0; k2 < 2; k2++) {
      const u = k2 * 0.5;
      if (i === P.length - 1) break;
      const q = P[i + 1];
      const cx = (p.x + (q.x - p.x) * u) * S,
        cy = (p.y + (q.y - p.y) * u) * S,
        hx = p.nx * 1.35 * S,
        hy = p.ny * 1.35 * S,
        ax = tx * 0.15 * S,
        ay = ty * 0.15 * S;
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.beginPath();
      g.moveTo(cx - hx - ax + 1, cy - hy - ay + 1.5);
      g.lineTo(cx + hx - ax + 1, cy + hy - ay + 1.5);
      g.lineTo(cx + hx + ax + 1, cy + hy + ay + 1.5);
      g.lineTo(cx - hx + ax + 1, cy - hy + ay + 1.5);
      g.fill();
      g.fillStyle = "#2f2721";
      g.beginPath();
      g.moveTo(cx - hx - ax, cy - hy - ay);
      g.lineTo(cx + hx - ax, cy + hy - ay);
      g.lineTo(cx + hx + ax, cy + hy + ay);
      g.lineTo(cx - hx + ax, cy - hy + ay);
      g.fill();
      g.fillStyle = "#55473b";
      g.fillRect(cx - hx * 0.9 - 0.5, cy - hy * 0.9 - 0.5, 1, 1);
      g.fillStyle = "#5a5048";
      g.fillRect(cx + hx * 0.55 - 1, cy + hy * 0.55 - 1, 2, 2);
      g.fillRect(cx - hx * 0.55 - 1, cy - hy * 0.55 - 1, 2, 2);
    }
  }
  for (const [a, b] of runs((p) => p.k === 0 || p.k === 5))
    for (const w of [-0.75, 0.75]) {
      path(a, b, w);
      g.strokeStyle = "rgba(0,0,0,0.6)";
      g.lineWidth = 0.46 * S;
      g.stroke();
      g.strokeStyle = "#8e959e";
      g.lineWidth = 0.3 * S;
      g.stroke();
      g.strokeStyle = "#f6f9fc";
      g.lineWidth = 0.11 * S;
      g.stroke();
    }
  g.restore();
}
// sample a polyline (metres) at 1 m with unit normals, for railDrawPlain
function railSample(pts, s0) {
  const out = [];
  let s = s0 || 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k],
      b = pts[k + 1],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    const tx = (b[0] - a[0]) / L,
      ty = (b[1] - a[1]) / L;
    for (let d = out.length ? 1 - (s % 1 || 1) + 0 : 0; d < L; d += 1) {
      out.push({ x: a[0] + tx * d, y: a[1] + ty * d, nx: -ty, ny: tx, s: Math.round(s + d), k: 0 });
    }
    s += L;
  }
  const e = pts[pts.length - 1],
    l = out[out.length - 1];
  if (l) out.push({ x: e[0], y: e[1], nx: l.nx, ny: l.ny, s: Math.round(s), k: 0 });
  return out;
}
// ---------- Golden-Gate-style suspension bridges (grey steel). Geometry precomputed once in railBridges(); towers/cables lean with height (parallax)
const BR_H = 58,
  BR_TW = 7.2,
  BR_LAT = 6.6,
  BR_PAR = 0.008;
function railBridges() {
  const P = RAIL.tracks[0].P,
    out = [];
  let a = -1;
  for (let i = 0; i <= P.length; i++) {
    const w = i < P.length && P[i].k === 2;
    if (w && a < 0) a = i;
    if (!w && a >= 0) {
      if (i - a >= 40) out.push([a - 6, i + 6]);
      a = -1;
    }
  }
  RAIL.bridges = out.map(([sA, sB]) => {
    const Lb = sB - sA,
      c = railPt((sA + sB) / 2, 0),
      t1 = sA + Lb * (Lb > 160 ? 0.2 : 0.12),
      t2 = sB - Lb * (Lb > 160 ? 0.2 : 0.12),
      cab = [],
      hang = [];
    const hAt = (s) => {
      if (s < t1) {
        const u = (s - sA) / (t1 - sA);
        return 2 + (BR_H - 3 - 2) * u * u;
      }
      if (s > t2) {
        const u = (sB - s) / (sB - t2);
        return 2 + (BR_H - 3 - 2) * u * u;
      }
      const u = (s - (t1 + t2) / 2) / ((t2 - t1) / 2);
      return 3.5 + (BR_H - 3 - 3.5) * u * u;
    };
    for (let s = sA; s <= sB; s += 4) {
      cab.push([s, hAt(s)]);
      if (Math.abs(s - t1) > 3 && Math.abs(s - t2) > 3 && s > sA + 2 && s < sB - 2)
        hang.push([s, hAt(s)]);
    }
    cab.push([sB, hAt(sB)]);
    return { sA, sB, cx: c[0], cy: c[1], tw: [t1, t2], cab, hang };
  });
}
function railLift(x, y, h) {
  const px = x * PPM,
    py = y * PPM,
    k = h * BR_PAR;
  return [px + (px - cam.x) * k, py + (py - cam.y) * k];
}
function drawRailBridges(vx0, vy0, vx1, vy1) {
  const S = PPM;
  for (const br of RAIL.bridges || []) {
    const a = railPt(br.sA, 0),
      b = railPt(br.sB, 0);
    if (
      Math.max(a[0], b[0]) * S < vx0 - 900 ||
      Math.min(a[0], b[0]) * S > vx1 + 900 ||
      Math.max(a[1], b[1]) * S < vy0 - 900 ||
      Math.min(a[1], b[1]) * S > vy1 + 900
    )
      continue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // hangers then main cables
    for (const sd of [-1, 1]) {
      ctx.strokeStyle = "rgba(205,210,216,0.85)";
      ctx.lineWidth = Math.max(1, 0.16 * S);
      ctx.beginPath();
      for (const [s, h] of br.hang) {
        const d = railPt(s, sd * BR_LAT),
          p0 = railLift(d[0], d[1], 1.2),
          p1 = railLift(d[0], d[1], h);
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
      }
      ctx.stroke();
      const cab = () => {
        ctx.beginPath();
        br.cab.forEach(([s, h], k) => {
          const d = railPt(s, sd * BR_LAT),
            q = railLift(d[0], d[1], h);
          k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        });
      };
      cab();
      ctx.strokeStyle = "#3e444b";
      ctx.lineWidth = 0.95 * S;
      ctx.stroke();
      ctx.strokeStyle = "#a9b0b8";
      ctx.lineWidth = 0.6 * S;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 0.18 * S;
      ctx.stroke();
    }
    // towers: twin legs, portal beams with arches, caps
    for (const sT of br.tw) {
      const L0 = railPt(sT, -BR_TW),
        R0 = railPt(sT, BR_TW);
      const leg = (B) => {
        const p0 = railLift(B[0], B[1], 0),
          p1 = railLift(B[0], B[1], BR_H);
        ctx.lineCap = "butt";
        ctx.strokeStyle = "#353a41";
        ctx.lineWidth = 3.6 * S;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
        ctx.strokeStyle = "#7d858e";
        ctx.lineWidth = 2.9 * S;
        ctx.stroke();
        ctx.strokeStyle = "#a7aeb6";
        ctx.lineWidth = 0.7 * S;
        ctx.stroke();
        return p1;
      };
      ctx.fillStyle = "#4d535b";
      for (const B of [L0, R0]) {
        const q = railLift(B[0], B[1], 0);
        ctx.fillRect(q[0] - 2 * S, q[1] - 2 * S, 4 * S, 4 * S);
      }
      leg(L0);
      leg(R0);
      for (const f of [0.42, 0.68, 0.9]) {
        const l = railLift(L0[0], L0[1], BR_H * f),
          r = railLift(R0[0], R0[1], BR_H * f),
          lu = railLift(L0[0], L0[1], BR_H * (f - 0.09)),
          ru = railLift(R0[0], R0[1], BR_H * (f - 0.09)),
          m = [(lu[0] + ru[0]) / 2, (lu[1] + ru[1]) / 2],
          mt = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2];
        ctx.beginPath();
        ctx.moveTo(l[0], l[1]);
        ctx.lineTo(r[0], r[1]);
        ctx.lineTo(ru[0], ru[1]);
        ctx.quadraticCurveTo(
          mt[0] + (m[0] - mt[0]) * 0.2,
          mt[1] + (m[1] - mt[1]) * 0.2,
          lu[0],
          lu[1],
        );
        ctx.closePath();
        ctx.fillStyle = "#6f777f";
        ctx.fill();
        ctx.strokeStyle = "#353a41";
        ctx.lineWidth = 0.35 * S;
        ctx.stroke();
      }
      for (const B of [L0, R0]) {
        const q = railLift(B[0], B[1], BR_H + 1);
        ctx.fillStyle = "#353a41";
        ctx.fillRect(q[0] - 1.7 * S, q[1] - 1.7 * S, 3.4 * S, 3.4 * S);
        ctx.fillStyle = "#b9c0c7";
        ctx.fillRect(q[0] - 1.3 * S, q[1] - 1.3 * S, 2.6 * S, 2.6 * S);
        if (DN.dark > 0.2) {
          ctx.fillStyle = "#ff3b2a";
          ctx.beginPath();
          ctx.arc(q[0], q[1], 0.5 * S, 0, 7);
          ctx.fill();
          dnLight(q[0], q[1], 24, "rgba(255,50,30,0.9)", 0.8);
        }
      }
    }
    ctx.restore();
  }
}
function railQuad(g, s0, s1, w0, w1, wf) {
  const L = RAIL.L;
  g.beginPath();
  for (let s = s0; s <= s1; s += 2) {
    const i = rlMod(Math.round(s), L),
      w = wf ? wf(s, w0) : w0;
    const x = (RAIL.X[i] + RAIL.NX[i] * w) * PPM,
      y = (RAIL.Y[i] + RAIL.NY[i] * w) * PPM;
    s === s0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  for (let s = s1; s >= s0; s -= 2) {
    const i = rlMod(Math.round(s), L),
      w = wf ? wf(s, w1) : w1;
    g.lineTo((RAIL.X[i] + RAIL.NX[i] * w) * PPM, (RAIL.Y[i] + RAIL.NY[i] * w) * PPM);
  }
  g.closePath();
}
function railPt(s, w) {
  const L = RAIL.L,
    sf = rlMod(s, L),
    i = Math.floor(sf),
    j = (i + 1) % L,
    f = sf - i;
  const x = RAIL.X[i] + (RAIL.X[j] - RAIL.X[i]) * f,
    y = RAIL.Y[i] + (RAIL.Y[j] - RAIL.Y[i]) * f;
  if (!w) return [x, y];
  let nx = RAIL.NX[i] + (RAIL.NX[j] - RAIL.NX[i]) * f,
    ny = RAIL.NY[i] + (RAIL.NY[j] - RAIL.NY[i]) * f;
  const nl = Math.hypot(nx, ny) || 1;
  return [x + (nx / nl) * w, y + (ny / nl) * w];
}
function railPlats(st) {
  const hub = st.kind === "hub";
  return hub
    ? [
        [3.6, 7.5],
        [12.7, 16.6],
      ]
    : [[3.6, 7.4]];
}
function railBakeStation(g, st) {
  const a = st.s - st.len / 2,
    b = st.s + st.len / 2,
    S = PPM,
    hub = st.kind === "hub";
  for (const [w0, w1] of railPlats(st)) {
    const ww = (s, w) => w;
    railQuad(g, a, b, w0, w1, ww);
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.save();
    g.translate(5, 6);
    g.fill();
    g.restore();
    g.fillStyle = "#cfc9bd";
    g.fill();
    g.strokeStyle = "#8f897d";
    g.lineWidth = 2;
    g.stroke();
    // paving joints
    g.strokeStyle = "rgba(120,112,100,0.35)";
    g.lineWidth = 1;
    for (let s = a; s <= b; s += 3) {
      const p = railPt(s, w0),
        q = railPt(s, w1);
      g.beginPath();
      g.moveTo(p[0] * S, p[1] * S);
      g.lineTo(q[0] * S, q[1] * S);
      g.stroke();
    }
    for (const [we, col, lw] of [
      [w0 + 0.15, "#f6f3ea", 2.5],
      [w0 + 0.65, "#f2c230", 2],
      [w1 - 0.15, "#f6f3ea", 2.5],
      [w1 - 0.65, "#f2c230", 2],
    ]) {
      if (!hub && we > w1 - 1) continue;
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.beginPath();
      for (let s = a; s <= b; s += 4) {
        const p = railPt(s, we);
        s === a ? g.moveTo(p[0] * S, p[1] * S) : g.lineTo(p[0] * S, p[1] * S);
      }
      g.stroke();
    }
  }
  if (hub) {
    // overall roof: glazed canopy with steel ribs + concourse
    railQuad(g, st.s - 90, st.s + 90, 2.4, 18, null);
    g.fillStyle = "rgba(30,40,55,0.25)";
    g.save();
    g.translate(10, 12);
    g.fill();
    g.restore();
    g.fillStyle = "rgba(170,205,230,0.55)";
    g.fill();
    g.strokeStyle = "#e7edf2";
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 2;
    for (let s = st.s - 90; s <= st.s + 90; s += 6) {
      const p = railPt(s, 2.4),
        q = railPt(s, 18);
      g.beginPath();
      g.moveTo(p[0] * S, p[1] * S);
      g.lineTo(q[0] * S, q[1] * S);
      g.stroke();
    }
    g.strokeStyle = "#5f6b78";
    g.lineWidth = 4;
    for (const w of [6.5, 10.2, 14]) {
      g.beginPath();
      for (let s = st.s - 90; s <= st.s + 90; s += 6) {
        const p = railPt(s, w);
        s === st.s - 90 ? g.moveTo(p[0] * S, p[1] * S) : g.lineTo(p[0] * S, p[1] * S);
      }
      g.stroke();
    }
    railQuad(g, st.s - 40, st.s + 40, 18, 30, null);
    g.fillStyle = "#8c3b2e";
    g.fill();
    g.fillStyle = "#b5523f";
    railQuad(g, st.s - 38, st.s + 38, 19, 29, null);
    g.fill();
  } else
    for (let s = a + 15; s <= b - 15; s += 38) {
      const [w0, w1] = railPlats(st)[0],
        wc = (w0 + w1) / 2 + 0.6;
      railQuad(g, s - 5, s + 5, wc - 1.4, wc + 1.4, null);
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.save();
      g.translate(6, 7);
      g.fill();
      g.restore();
      g.fillStyle = st.kind === "city" || st.kind === "town" ? "#2f5d8a" : "#4f7a3a";
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.25)";
      railQuad(g, s - 5, s + 5, wc - 1.4, wc - 0.6, null);
      g.fill();
    }
  // name boards
  const [w0, w1] = railPlats(st)[0];
  for (const s of [a + 8, b - 8]) {
    const p = railPt(s, w1 - 0.9),
      q = railPt(s + 1, w1 - 0.9),
      ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    g.save();
    g.translate(p[0] * S, p[1] * S);
    g.rotate(ang);
    g.font = "bold 15px system-ui,sans-serif";
    const tw = g.measureText(st.name).width + 14;
    g.fillStyle = "#16335c";
    g.fillRect(-tw / 2, -10, tw, 20);
    g.strokeStyle = "#fff";
    g.lineWidth = 1.5;
    g.strokeRect(-tw / 2 + 2, -8, tw - 4, 16);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(st.name, 0, 1);
    g.restore();
  }
}
// ---------- sprites
const RL_LIV = [
  { b: "#13284d", s: "#f5b82e", s2: "#ffffff", n: "#f7d417" },
  { b: "#f1f1ee", s: "#d7232e", s2: "#1b1b1b", n: "#ffd000" },
  { b: "#0f5a3c", s: "#a6e22e", s2: "#ecf7e6", n: "#ffd400" },
  { b: "#4b2380", s: "#ff4fa3", s2: "#ffffff", n: "#ffd400" },
];
const RL_FLIV = [
  { b: "#ff6a13", s: "#1b1b1b" },
  { b: "#1d8a4e", s: "#ffd200" },
  { b: "#ffcf1f", s: "#1d3e8a" },
  { b: "#c1121f", s: "#f1f1f1" },
];
const RL_CONT = [
  "#c0392b",
  "#2e86de",
  "#27ae60",
  "#f39c12",
  "#8e44ad",
  "#d35400",
  "#16a085",
  "#7f8c8d",
  "#e8e8e8",
];
function rlRR(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}
function railSprite(c, lit) {
  const key =
    c.k +
    "|" +
    c.liv +
    "|" +
    (c.flip ? 1 : 0) +
    "|" +
    ((c.seed || 0) % 9) +
    "|" +
    (lit ? 1 : 0) +
    "|" +
    (c.first ? 1 : 0);
  let sp = RAIL.spr[key];
  if (sp) return sp;
  const S = 12,
    Wm = 2.9,
    L = c.L,
    cv = mkCanvas(Math.ceil(L * S) + 4, Math.ceil(Wm * S) + 4),
    g = cv.getContext("2d"),
    W = Wm * S,
    Lp = L * S;
  g.translate(2, 2);
  const pax = c.k === "hst" || c.k === "coach" || c.k === "emu" || c.k === "dmu",
    lv = pax ? RL_LIV[c.liv % 4] : RL_FLIV[c.liv % 4];
  const across = (c0, c1, c2) => {
    const gr = g.createLinearGradient(0, 0, 0, W);
    gr.addColorStop(0, c0);
    gr.addColorStop(0.5, c1);
    gr.addColorStop(1, c2);
    return gr;
  };
  if (c.flip) {
    g.translate(Lp, W);
    g.rotate(Math.PI);
  }
  if (pax) {
    const nose =
      c.k === "hst"
        ? 5.5 * S
        : (c.k === "emu" || c.k === "dmu") && (c.first || c.flip)
          ? 2.6 * S
          : 0;
    // body sides (livery) + roof
    g.beginPath();
    g.moveTo(0, 2);
    g.lineTo(Lp - nose, 0);
    if (nose) {
      g.quadraticCurveTo(Lp, 0, Lp, W / 2);
      g.quadraticCurveTo(Lp, W, Lp - nose, W);
    } else {
      g.lineTo(Lp, 0);
      g.lineTo(Lp, W);
    }
    g.lineTo(0, W - 2);
    g.closePath();
    g.fillStyle = lv.b;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = lv.s;
    g.fillRect(0, W * 0.05, Lp, W * 0.13);
    g.fillRect(0, W * 0.82, Lp, W * 0.13);
    g.fillStyle = lv.s2;
    g.fillRect(0, W * 0.18, Lp, W * 0.035);
    g.fillRect(0, W * 0.785, Lp, W * 0.035);
    // windows band (lit at night)
    const wc = lit ? "#ffe7a0" : "#1c2633";
    g.fillStyle = wc;
    const wx0 = c.k === "hst" ? 2.5 * S : 1.2 * S,
      wx1 = Lp - nose - (c.k === "hst" ? 3 * S : 1.2 * S);
    if (c.k !== "hst" || 1)
      for (let x = wx0; x < wx1; x += 1.9 * S) {
        g.fillRect(x, W * 0.005, 1.5 * S, W * 0.045);
        g.fillRect(x, W * 0.95, 1.5 * S, W * 0.045);
      }
    // roof
    g.fillStyle = across("#6d727a", "#b9bec6", "#6d727a");
    g.fillRect(0, W * 0.22, Lp - nose * 0.6, W * 0.56);
    if (nose) {
      // raked cab: livery nose + warning yellow + windscreen
      g.fillStyle = lv.n;
      g.beginPath();
      g.moveTo(Lp - nose * 0.75, W * 0.12);
      g.quadraticCurveTo(Lp, W * 0.1, Lp, W / 2);
      g.quadraticCurveTo(Lp, W * 0.9, Lp - nose * 0.75, W * 0.88);
      g.closePath();
      g.fill();
      g.fillStyle = "#0d1219";
      g.beginPath();
      g.moveTo(Lp - nose * 0.95, W * 0.2);
      g.quadraticCurveTo(Lp - nose * 0.35, W * 0.18, Lp - nose * 0.4, W / 2);
      g.quadraticCurveTo(Lp - nose * 0.35, W * 0.82, Lp - nose * 0.95, W * 0.8);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(Lp - nose * 0.85, W * 0.26, nose * 0.12, W * 0.48);
    }
    // roof equipment
    g.fillStyle = "#41464d";
    if (c.k === "hst") {
      for (let k = 0; k < 3; k++) {
        g.fillRect(3 * S + k * 3.2 * S, W * 0.3, 2.6 * S, W * 0.4);
        g.fillStyle = "#2a2e33";
        for (let q = 0; q < 6; q++)
          g.fillRect(3 * S + k * 3.2 * S + q * 0.45 * S, W * 0.32, 1.5, W * 0.36);
        g.fillStyle = "#41464d";
      }
      g.beginPath();
      g.arc(13.5 * S, W / 2, W * 0.22, 0, 7);
      g.fill();
      g.strokeStyle = "#888";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(13.5 * S, W / 2, W * 0.16, 0, 7);
      g.stroke();
      g.beginPath();
      g.moveTo(13.5 * S - W * 0.16, W / 2);
      g.lineTo(13.5 * S + W * 0.16, W / 2);
      g.stroke();
    } else {
      for (let x = 3 * S; x < Lp - 4 * S; x += 5 * S) {
        g.fillStyle = "#8d939b";
        g.fillRect(x, W * 0.4, 1.6 * S, W * 0.2);
        g.fillStyle = "#5b6067";
        g.fillRect(x + 0.2 * S, W * 0.44, 1.2 * S, W * 0.12);
      }
      if (c.k === "emu" && c.mid) {
        g.strokeStyle = "#2b2f35";
        g.lineWidth = 2;
        const px = Lp * 0.35;
        g.beginPath();
        g.moveTo(px - 1.2 * S, W * 0.3);
        g.lineTo(px + 1.6 * S, W / 2);
        g.lineTo(px - 1.2 * S, W * 0.7);
        g.moveTo(px + 1.6 * S, W * 0.28);
        g.lineTo(px + 1.6 * S, W * 0.72);
        g.stroke();
        g.fillStyle = "#c9302c";
        g.fillRect(px - 1.6 * S, W * 0.36, 0.5 * S, W * 0.28);
      }
      if (c.k === "dmu") {
        g.fillStyle = "#222";
        g.beginPath();
        g.arc(Lp * 0.5, W * 0.5, W * 0.09, 0, 7);
        g.fill();
      }
    }
    g.restore();
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = 1.5;
    g.stroke();
  } else {
    const fl = RL_FLIV[c.liv % 4];
    if (c.k === "loco") {
      // freight diesel: long hood, cab at front, fans, exhaust, chevrons
      rlRR(g, 0, 0, Lp, W, 4);
      g.fillStyle = fl.b;
      g.fill();
      g.fillStyle = across("rgba(0,0,0,0.25)", "rgba(255,255,255,0.18)", "rgba(0,0,0,0.3)");
      g.fill();
      g.fillStyle = fl.s;
      g.fillRect(0, W * 0.06, Lp, W * 0.1);
      g.fillRect(0, W * 0.84, Lp, W * 0.1);
      g.fillStyle = across(shade(fl.b, 0.7), shade(fl.b, 1.15), shade(fl.b, 0.7));
      g.fillRect(1.5 * S, W * 0.2, Lp - 6 * S, W * 0.6);
      for (let k = 0; k < 3; k++) {
        const x = 3.5 * S + k * 3.4 * S;
        g.fillStyle = "#24272b";
        g.beginPath();
        g.arc(x, W / 2, W * 0.24, 0, 7);
        g.fill();
        g.strokeStyle = "#666b72";
        g.lineWidth = 1.2;
        for (let q = 0; q < 4; q++) {
          g.beginPath();
          g.arc(x, W / 2, W * (0.06 + q * 0.05), 0, 7);
          g.stroke();
        }
        g.beginPath();
        g.moveTo(x - W * 0.24, W / 2);
        g.lineTo(x + W * 0.24, W / 2);
        g.moveTo(x, W * 0.26);
        g.lineTo(x, W * 0.74);
        g.stroke();
      }
      g.fillStyle = "#1a1a1a";
      g.fillRect(13.5 * S, W * 0.4, 1.4 * S, W * 0.2);
      g.fillStyle = "#3b3b3b";
      g.fillRect(13.7 * S, W * 0.44, 1 * S, W * 0.12);
      g.fillStyle = "#34383e";
      for (let x = 15.5 * S; x < Lp - 5.5 * S; x += 0.5 * S) g.fillRect(x, W * 0.24, 1.5, W * 0.52);
      g.fillStyle = shade(fl.b, 0.85);
      g.fillRect(Lp - 5 * S, W * 0.12, 3.6 * S, W * 0.76);
      g.fillStyle = lit ? "#ffe7a0" : "#121820";
      g.fillRect(Lp - 2.1 * S, W * 0.18, 0.8 * S, W * 0.64);
      g.fillRect(Lp - 4.6 * S, W * 0.13, 2.2 * S, W * 0.07);
      g.fillRect(Lp - 4.6 * S, W * 0.8, 2.2 * S, W * 0.07);
      g.save();
      g.beginPath();
      g.rect(Lp - 1.2 * S, 0, 1.2 * S, W);
      g.clip();
      g.fillStyle = "#ffd400";
      g.fillRect(Lp - 1.2 * S, 0, 1.2 * S, W);
      g.fillStyle = "#111";
      for (let y = -W; y < W * 2; y += 0.6 * S) {
        g.beginPath();
        g.moveTo(Lp - 1.2 * S, y);
        g.lineTo(Lp, y + 0.6 * S);
        g.lineTo(Lp, y + 0.9 * S);
        g.lineTo(Lp - 1.2 * S, y + 0.3 * S);
        g.fill();
      }
      g.restore();
      g.fillStyle = "#ffd400";
      g.fillRect(0, 0, 0.5 * S, W);
      g.strokeStyle = "#d8d8d8";
      g.lineWidth = 1;
      g.strokeRect(0.6 * S, W * 0.03, Lp - 1.8 * S, W * 0.94);
      rlRR(g, 0, 0, Lp, W, 4);
      g.strokeStyle = "rgba(0,0,0,0.6)";
      g.lineWidth = 1.5;
      g.stroke();
    } else if (c.k === "hop") {
      g.fillStyle = "#2b2d31";
      rlRR(g, 0, 0, Lp, W, 2);
      g.fill();
      g.fillStyle = across("#3f4247", "#5a5e64", "#3f4247");
      g.fillRect(0.4 * S, W * 0.06, Lp - 0.8 * S, W * 0.88);
      g.fillStyle = "#15161a";
      rlRR(g, 1 * S, W * 0.14, Lp - 2 * S, W * 0.72, 6);
      g.fill();
      for (let q = 0; q < 160; q++) {
        const h = rlHash(q * 13 + (c.seed || 0) * 977),
          h2 = rlHash(q * 71 + 3 + (c.seed || 0));
        g.fillStyle = q % 4 ? "#26272b" : "#3c3d42";
        g.beginPath();
        g.arc(1.4 * S + h * (Lp - 2.8 * S), W * 0.2 + h2 * W * 0.6, 1.4 + h * 2, 0, 7);
        g.fill();
      }
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.beginPath();
      g.ellipse(Lp / 2, W / 2, Lp * 0.3, W * 0.14, 0, 0, 7);
      g.fill();
      g.fillStyle = "#4a4e54";
      for (let x = 2.4 * S; x < Lp - 1 * S; x += 2.8 * S) g.fillRect(x, 0, 0.25 * S, W);
      g.fillStyle = RL_FLIV[(c.seed || 0) % 4].b;
      g.fillRect(0, W * 0.44, 0.4 * S, W * 0.12);
    } else if (c.k === "flat") {
      g.fillStyle = "#3a3d42";
      g.fillRect(0, W * 0.15, Lp, W * 0.7);
      g.fillStyle = "#24262a";
      g.fillRect(0, W * 0.42, Lp, W * 0.16);
      const n = (c.seed || 0) % 5 === 0 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const cl = RL_CONT[((c.seed || 0) * 3 + k * 5) % RL_CONT.length],
          cl2 = n === 1 ? Lp - 1 * S : (Lp - 1.4 * S) / 2,
          x = 0.5 * S + k * (cl2 + 0.4 * S);
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.fillRect(x + 3, W * 0.04 + 3, cl2, W * 0.92);
        g.fillStyle = cl;
        g.fillRect(x, W * 0.04, cl2, W * 0.92);
        g.fillStyle = shade(cl, 0.72);
        for (let q = x + 4; q < x + cl2 - 2; q += 5) g.fillRect(q, W * 0.04, 1.5, W * 0.92);
        g.fillStyle = shade(cl, 1.3);
        g.fillRect(x, W * 0.04, cl2, W * 0.1);
        g.strokeStyle = "rgba(0,0,0,0.5)";
        g.lineWidth = 1;
        g.strokeRect(x, W * 0.04, cl2, W * 0.92);
        if (k === 0 && n === 2) {
          g.fillStyle = "rgba(255,255,255,0.85)";
          g.font = "bold 11px Arial";
          g.fillText(["MAERA", "COSCA", "EVERLINE", "HAPAG"][(c.seed || 0) % 4], x + 8, W * 0.6);
        }
      }
    } else if (c.k === "tank") {
      g.fillStyle = "#2a2c30";
      g.fillRect(0, W * 0.1, Lp, W * 0.8);
      const tc =
        (c.seed || 0) % 3 === 0
          ? ["#2c2f33", "#6e737a", "#2c2f33"]
          : ["#a9aeb4", "#f2f4f6", "#8d9298"];
      rlRR(g, 0.6 * S, W * 0.06, Lp - 1.2 * S, W * 0.88, W * 0.44);
      g.fillStyle = across(...tc);
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.4)";
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = "#e8a317";
      g.fillRect(Lp * 0.2, W * 0.46, Lp * 0.6, W * 0.08);
      g.fillStyle = "#555";
      g.fillRect(0.8 * S, W * 0.46, Lp - 1.6 * S, 1.5);
      g.fillStyle = "#5c6168";
      g.beginPath();
      g.arc(Lp / 2, W / 2, W * 0.15, 0, 7);
      g.fill();
      g.fillStyle = "#8a9098";
      g.beginPath();
      g.arc(Lp / 2, W / 2, W * 0.09, 0, 7);
      g.fill();
      g.fillStyle = "#ff6a00";
      g.fillRect(Lp * 0.12, W * 0.2, 1.6 * S, W * 0.18);
      g.fillStyle = "#fff";
      g.font = "bold 9px Arial";
      g.fillText("3", Lp * 0.12 + 5, W * 0.34);
    }
  }
  // couplers / buffers
  g.fillStyle = "#1d1f22";
  g.fillRect(-2, W * 0.42, 4, W * 0.16);
  g.fillRect(Lp - 2, W * 0.42, 4, W * 0.16);
  if (!pax) {
    g.fillRect(-1.5, W * 0.12, 3, W * 0.12);
    g.fillRect(-1.5, W * 0.76, 3, W * 0.12);
  }
  sp = { c: cv, S, W, L };
  RAIL.spr[key] = sp;
  return sp;
}
// ---------- dynamic drawing
function railCarPose(tr, c, head, trk) {
  const dir = tr.pax ? 1 : -1,
    sc = head - dir * c.off,
    w = (s) => (tr.pax ? (tr.plat ? RW_P + HUB_W * RAIL.hubB(s) : RW_P) : RW_F);
  const bo = c.L / 2 - 3.2,
    sf = sc + dir * bo,
    sr = sc - dir * bo,
    a = railPt(sf, w(sf)),
    b = railPt(sr, w(sr)),
    ang = Math.atan2(a[1] - b[1], a[0] - b[0]),
    x = (a[0] + b[0]) / 2,
    y = (a[1] + b[1]) / 2,
    ca = Math.cos(ang),
    sa = Math.sin(ang); // front + rear bogies sit on the curve
  return {
    x,
    y,
    ang,
    fx: x + (ca * c.L) / 2,
    fy: y + (sa * c.L) / 2,
    rx: x - (ca * c.L) / 2,
    ry: y - (sa * c.L) / 2,
  };
}
function railTrainPoses(tr, t) {
  const head = railHead(tr, t);
  return tr.cars.map((c) => Object.assign(railCarPose(tr, c, head), { c }));
}
function drawRail(vx0, vy0, vx1, vy1) {
  if (!RAIL.ready) return;
  railFrame();
  const t = railTime(),
    S = PPM,
    m = 300,
    lit = DN.dark > 0.3;
  const inV = (x, y, r) => x * S > vx0 - r && x * S < vx1 + r && y * S > vy0 - r && y * S < vy1 + r;
  // motorway overbridges (rails cross above the motorway)
  for (const c of RAIL.cross) {
    if (!c.over || !inV(c.mx, c.my, 600)) continue;
    railQuad(ctx, c.sa - 5, c.sb + 5, -4.8, 4.8, null);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.save();
    ctx.translate(14, 18);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#8a8e94";
    ctx.fill();
    ctx.strokeStyle = "#d6d9dd";
    ctx.lineWidth = 5;
    ctx.stroke();
    railQuad(ctx, c.sa - 5, c.sb + 5, -4, 4, null);
    ctx.fillStyle = "#958f84";
    ctx.fill();
    for (let s = c.sa - 5; s <= c.sb + 5; s += 0.66) {
      for (const w of [RW_P, RW_F]) {
        const p = railPt(s, w - 1.3),
          q = railPt(s, w + 1.3);
        ctx.strokeStyle = "#b9b3a7";
        ctx.lineWidth = 0.26 * S;
        ctx.beginPath();
        ctx.moveTo(p[0] * S, p[1] * S);
        ctx.lineTo(q[0] * S, q[1] * S);
        ctx.stroke();
      }
    }
    for (const w of [RW_P - 0.72, RW_P + 0.72, RW_F - 0.72, RW_F + 0.72]) {
      ctx.beginPath();
      for (let s = c.sa - 5; s <= c.sb + 5; s += 2) {
        const p = railPt(s, w);
        s === c.sa - 5 ? ctx.moveTo(p[0] * S, p[1] * S) : ctx.lineTo(p[0] * S, p[1] * S);
      }
      ctx.strokeStyle = "#7d8189";
      ctx.lineWidth = 0.2 * S;
      ctx.stroke();
      ctx.strokeStyle = "#eef3f8";
      ctx.lineWidth = 0.07 * S;
      ctx.stroke();
    }
  }
  // parked stock in the hub's holding sidings
  if (RAIL.hub && inV(RAIL.X[RAIL.hub.s], RAIL.Y[RAIL.hub.s], 2400)) {
    const H = RAIL.hub.s;
    [
      [-6.7, RAIL_FRT[0], 60],
      [-11.3, RAIL_FRT[1], 70],
    ].forEach(([w, sp, s0], q) => {
      const cs = railConsist(Object.assign({}, sp, { cars: 5 + q * 2 }), true);
      for (const c of cs.cars) {
        const sc = H + s0 - c.off,
          a = railPt(sc + c.L / 2, w),
          b = railPt(sc - c.L / 2, w);
        railBlit(
          c,
          (a[0] + b[0]) / 2,
          (a[1] + b[1]) / 2,
          Math.atan2(a[1] - b[1], a[0] - b[0]),
          lit,
        );
      }
    });
  }
  // trains
  for (const tr of RAIL.trains) {
    const head = railHead(tr, t);
    const hp = railPt(head, 0);
    const nearAny =
      inV(hp[0], hp[1], tr.len * S + m) || inV(...railPt(head - (tr.pax ? 1 : -1) * tr.len, 0), m);
    if (!nearAny) continue;
    let prev = null;
    for (let i = 0; i < tr.cars.length; i++) {
      const c = tr.cars[i],
        P = railCarPose(tr, c, head),
        pv = prev;
      prev = P;
      if (!inV(P.x, P.y, m)) continue;
      if (pv) {
        ctx.save();
        ctx.lineCap = "butt";
        ctx.strokeStyle = tr.pax ? "#2b2f36" : "#3a3530";
        ctx.lineWidth = (tr.pax ? 2.3 : 0.5) * S;
        ctx.beginPath();
        ctx.moveTo(pv.rx * S, pv.ry * S);
        ctx.lineTo(P.fx * S, P.fy * S);
        ctx.stroke();
        ctx.restore();
      } // gangway bellows / coupler bridge the gap on curves
      railBlit(c, P.x, P.y, P.ang, lit);
      if (i === 0 && DN.dark > 0.05) {
        dnLight(
          P.fx * S + Math.cos(P.ang) * 14,
          P.fy * S + Math.sin(P.ang) * 14,
          70,
          "rgba(255,250,225,0.95)",
          0.9,
        );
      }
      if (i === tr.cars.length - 1 && DN.dark > 0.05) {
        const bx = (P.x - (Math.cos(P.ang) * c.L) / 2) * S,
          by = (P.y - (Math.sin(P.ang) * c.L) / 2) * S;
        dnLight(bx, by, 24, "rgba(255,40,30,0.9)", 0.8);
      }
      if (lit && c.k !== "hop" && c.k !== "flat" && c.k !== "tank" && c.k !== "loco")
        dnLight(P.x * S, P.y * S, c.L * S * 0.55, "rgba(255,220,150,0.5)", 0.5);
    }
    if (tr.pax) {
      const p = railCarPose(tr, tr.cars[0], head);
      if (DN.dark < 0.05) {
      }
    }
  }
  // stations: waiting/boarding passengers
  for (const st of RAIL.stations) {
    const p0 = railPt(st.s, 5);
    if (!inV(p0[0], p0[1], st.len * S)) continue;
    railDrawPeds(st, t);
    if (DN.dark > 0.05)
      for (let s = st.s - st.len / 2 + 10; s < st.s + st.len / 2; s += 25) {
        const p = railPt(s, 6.8);
        dnLight(p[0] * S, p[1] * S, 60, "rgba(255,230,170,0.6)", 0.6);
      }
  }
  // level crossings: posts, red flashers, barrier arms
  for (const c of RAIL.cross) {
    if (c.over || !inV(c.mx, c.my, 500)) continue;
    railDrawCrossing(c, t);
  }
  drawRailBridges(vx0, vy0, vx1, vy1);
}
function railBlit(c, x, y, ang, lit) {
  const sp = railSprite(c, lit),
    S = PPM;
  ctx.save();
  ctx.translate(x * S, y * S);
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(10,15,25,0.3)";
  ctx.fillRect((-c.L * S) / 2 + 5, (((-sp.W / 12) * S) / 2) * 1 + 6, c.L * S, 2.9 * S);
  ctx.drawImage(
    sp.c,
    (-c.L * S) / 2 - (2 * S) / sp.S,
    (-2.9 * S) / 2 - (2 * S) / sp.S,
    (sp.c.width * S) / sp.S,
    (sp.c.height * S) / sp.S,
  );
  ctx.restore();
}
function railDrawPeds(st, t) {
  const S = PPM;
  let dw = null,
    trn = null;
  for (const tr of RAIL.trains) {
    if (!tr.pax) continue;
    const d = railDwelling(tr, t);
    if (d && d.st === st) {
      dw = d;
      trn = tr;
      break;
    }
  }
  const N = st.kind === "hub" ? 18 : st.kind === "city" ? 12 : 6,
    plat = railPlats(st)[0],
    wTrack = dw && trn && trn.plat && st.kind === "hub" ? RW_P + HUB_W : RW_P,
    platW = wTrack > RW_P ? plat[1] - 0.6 : plat[0] + 0.5;
  for (let i = 0; i < N; i++) {
    const h = rlHash(st.s * 31 + i * 7),
      h2 = rlHash(st.s * 17 + i * 13 + 5),
      sh = st.s + (h - 0.5) * st.len * 0.8,
      wHome = plat[0] + 1.5 + h2 * (plat[1] - plat[0] - 2);
    let s = sh,
      w = wHome;
    const boarding = i % 2 === 0;
    if (dw) {
      const head = railHead(trn, t),
        doorS = head - trn.len * (0.1 + 0.8 * h),
        ph = Math.max(0, Math.min(1, (dw.ph - 0.1 - h * 0.25) * 2.2));
      if (boarding) {
        s = sh + (doorS - sh) * ph;
        w = wHome + (platW - wHome) * ph;
        if (ph >= 1) continue;
      } // walks to a door then boards
      else {
        const pa = Math.max(0, Math.min(1, (dw.ph - 0.05 - h * 0.2) * 2.2));
        if (pa <= 0) continue;
        s = doorS + (sh - doorS) * pa;
        w = platW + (wHome - platW) * pa;
      }
    } // alights and walks off
    else if (!boarding && i % 4) continue;
    const p = railPt(s, w);
    const col = ["#d63b2f", "#2e86de", "#f5b82e", "#27ae60", "#8e44ad", "#333", "#e67e22"][i % 7];
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.arc(p[0] * S + 2, p[1] * S + 2, 4.2, 0, 7);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(p[0] * S, p[1] * S, 4.6, 3.4, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = ["#f1c27d", "#8d5524", "#e0ac69", "#c68642"][i % 4];
    ctx.beginPath();
    ctx.arc(p[0] * S, p[1] * S, 2.4, 0, 7);
    ctx.fill();
  }
}
function railDrawCrossing(c, t) {
  const S = PPM,
    flash = c.lit ? ((t * 1.6) % 1 < 0.5 ? 0 : 1) : -1;
  for (const sd of [-1, 1]) {
    const w = sd * 6.6;
    const base = railPt(c.m + (sd > 0 ? -1 : 1) * (c.half + 0.6), w),
      tip = railPt(c.m + (sd > 0 ? 1 : -1) * (c.half + 0.6), w);
    // post + lamp housing (styled like the traffic lights)
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(base[0] * S - 5 + 4, base[1] * S - 5 + 5, 10, 10);
    ctx.fillStyle = "#22252a";
    ctx.fillRect(base[0] * S - 5, base[1] * S - 5, 10, 10);
    ctx.strokeStyle = "#f2f2f2";
    ctx.lineWidth = 1;
    ctx.strokeRect(base[0] * S - 5, base[1] * S - 5, 10, 10);
    for (const k of [0, 1]) {
      const on = flash === k;
      const lx = base[0] * S + (k ? 4 : -4) * 1,
        ly = base[1] * S + sd * 7;
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(lx, ly, 3.6, 0, 7);
      ctx.fill();
      ctx.fillStyle = on ? "#ff2a1a" : "#4a1410";
      ctx.beginPath();
      ctx.arc(lx, ly, 2.6, 0, 7);
      ctx.fill();
      if (on) {
        ctx.fillStyle = "rgba(255,40,20,0.35)";
        ctx.beginPath();
        ctx.arc(lx, ly, 9, 0, 7);
        ctx.fill();
        dnLight(lx, ly, 30, "rgba(255,40,20,0.95)", 0.9);
      }
    }
    // arm: foreshortened when raised, full length when lowered; red/white bands
    const f = 0.12 + 0.88 * c.f,
      ex = base[0] + (tip[0] - base[0]) * f,
      ey = base[1] + (tip[1] - base[1]) * f,
      ang = Math.atan2(ey - base[1], ex - base[0]),
      len = Math.hypot(ex - base[0], ey - base[1]) * S;
    ctx.save();
    ctx.translate(base[0] * S, base[1] * S);
    ctx.rotate(ang);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(4, -2 + 5, len, 5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, -2.5, len, 5);
    ctx.fillStyle = "#e0261b";
    for (let x = 0; x < len; x += 16) ctx.fillRect(x, -2.5, 8, 5);
    if (c.f > 0.5) {
      ctx.fillStyle = flash >= 0 && flash === 1 ? "#ff3a2a" : "#5a1a14";
      for (let x = 20; x < len; x += 40) {
        ctx.beginPath();
        ctx.arc(x, 0, 1.8, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
// ---------- maps
function railMinimap() {
  if (!RAIL.ready || !MINIMAP) return;
  const g = MINIMAP.getContext("2d");
  g.fillStyle = "#4a3f38";
  for (let s = 0; s < RAIL.L; s += 2) {
    g.fillRect(Math.floor(RAIL.X[s] / M_T), Math.floor(RAIL.Y[s] / M_T), 1, 1);
  }
  g.fillStyle = "#ffffff";
  for (const st of RAIL.stations) {
    g.fillRect(Math.floor(RAIL.X[st.s] / M_T) - 1, Math.floor(RAIL.Y[st.s] / M_T) - 1, 3, 3);
  }
}
function railBigMap(BX, BY, z, R) {
  R = R || 5;
  if (!RAIL.ready) return;
  ctx.save();
  ctx.lineWidth = Math.max(2, z * 1.2);
  ctx.strokeStyle = "rgba(40,30,25,0.9)";
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let s = 0; s <= RAIL.L; s += 8) {
    const i = s % RAIL.L,
      x = BX(RAIL.X[i] / M_T),
      y = BY(RAIL.Y[i] / M_T);
    s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, z * 0.5);
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  railMapTrains(BX, BY, z, false);
  for (const st of RAIL.stations) {
    const x = BX(RAIL.X[st.s] / M_T),
      y = BY(RAIL.Y[st.s] / M_T);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#16335c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, st.kind === "hub" ? R : R * 0.75, 0, 7);
    ctx.fill();
    ctx.stroke();
    if (R >= 9) {
      ctx.fillStyle = "#16335c";
      ctx.font = "bold " + Math.round(R * 0.95) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(st.kind === "hub" ? "H" : "R", x, y + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    if (z > 0.9) mapLabel("\u{1F686} " + st.name, x + R * 0.75 + 4, y, "#d9ecff");
  }
  ctx.restore();
}

// ---------- trains on the world map / minimap: dots when zoomed out, a loco + coaches/wagons along the track when zoomed in
const RAIL_MAPC = {
  pax: { body: "#4fd1ff", cab: "#0f6fb8", edge: "#e9fbff" },
  frt: { loco: "#ff9f1a", edge: "#2a1a08", hop: "#8a5a3c", tank: "#aab3bd", flat: "#6b6f75" },
};
const RAIL_BOX = ["#d63b2f", "#2e86de", "#f5b82e", "#27ae60", "#8e44ad", "#e67e22"];
function railTrainInfo(tr) {
  if (tr.pax) {
    const h = railHead(tr, railTime()),
      L = RAIL.L;
    let nx = null,
      bd = 1e18;
    for (const st of RAIL.stations) {
      const d = rlMod(st.s - h, L);
      if (d > 2 && d < bd) {
        bd = d;
        nx = st;
      }
    }
    const dw = railDwelling(tr, railTime());
    return [
      "Passenger train: " + tr.sp.n,
      (dw ? "At " + dw.st.name : "Next stop " + (nx ? nx.name : "-")) +
        " \u00b7 " +
        tr.cars.length +
        " cars",
    ];
  }
  return [
    "Freight train: " + tr.sp.n,
    (tr.sp.c === "hop"
      ? "Coal hoppers"
      : tr.sp.c === "tank"
        ? "Fuel tankers"
        : tr.sp.c === "flat"
          ? "Container flats"
          : "Mixed wagons") +
      " \u00b7 " +
      tr.cars.filter((c) => c.k !== "loco").length +
      " wagons \u00b7 runs non-stop",
  ];
}
function railMapTrains(BX, BY, z, mini) {
  if (!RAIL.ready) return;
  const t = railTime();
  const hits = mini ? null : (RAIL.mapHits = []);
  const night = typeof nmK === "function" ? nmK() : 0;
  ctx.save();
  ctx.lineJoin = "round";
  for (const tr of RAIL.trains) {
    const ps = railTrainPoses(tr, t),
      lenPx = (tr.len / M_T) * z,
      mid = ps[ps.length >> 1];
    if (lenPx < 26) {
      const q = ps[0],
        x = BX(q.x / M_T),
        y = BY(q.y / M_T);
      ctx.fillStyle = tr.pax ? RAIL_MAPC.pax.body : RAIL_MAPC.frt.loco;
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (tr.pax) ctx.arc(x, y, 4.5, 0, 7);
      else ctx.rect(x - 4, y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
      if (hits) hits.push([x, y, 10, tr]);
      continue;
    }
    const W = Math.max(mini ? 3.6 : 4.5, Math.min(14, 0.95 * z)),
      sel = RAIL.mapSel === tr;
    if (night > 0.05 || sel) {
      ctx.shadowColor = sel
        ? "rgba(255,255,255,1)"
        : tr.pax
          ? "rgba(80,210,255,0.9)"
          : "rgba(255,160,40,0.9)";
      ctx.shadowBlur = sel ? 14 : 8 * Math.max(night, 0.5);
    }
    for (const P of ps) {
      const c = P.c,
        x = BX(P.x / M_T),
        y = BY(P.y / M_T),
        l = Math.max(2, (c.L / M_T) * z - Math.max(1, 0.3 * z));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(P.ang);
      const loco =
          c.k === "loco" || c.k === "hst" || c.first || (c.flip && !c.mid && c.k !== "coach"),
        nose = c.k === "loco" || c.k === "hst" || c.first || c.flip;
      const rr = (a, b, w, h, r) => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(a, b, w, h, r);
        else ctx.rect(a, b, w, h);
      };
      if (tr.pax) {
        rr(-l / 2, -W / 2, l, W, W * 0.45);
        ctx.fillStyle = RAIL_MAPC.pax.body;
        ctx.fill();
        ctx.lineWidth = Math.max(1, W * 0.14);
        ctx.strokeStyle = "#0a3358";
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (W >= 6) {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(-l / 2 + W * 0.4, -W * 0.14, l - W * 0.8, W * 0.28);
        } // window band
        if (nose) {
          const sgn = c.flip ? -1 : 1;
          ctx.fillStyle = RAIL_MAPC.pax.cab;
          ctx.beginPath();
          ctx.moveTo(sgn * (l / 2), 0);
          ctx.lineTo(sgn * (l / 2 - W * 1.1), -W / 2 + 0.5);
          ctx.lineTo(sgn * (l / 2 - W * 1.1), W / 2 - 0.5);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        const k = c.k;
        if (k === "loco") {
          rr(-l / 2, -W / 2, l, W, W * 0.2);
          ctx.fillStyle = RAIL_MAPC.frt.loco;
          ctx.fill();
          ctx.lineWidth = Math.max(1, W * 0.14);
          ctx.strokeStyle = RAIL_MAPC.frt.edge;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#2a1a08";
          ctx.fillRect(l / 2 - W * 0.9, -W / 2 + 1, W * 0.45, W - 2);
        } else {
          ctx.fillStyle =
            k === "hop"
              ? RAIL_MAPC.frt.hop
              : k === "tank"
                ? RAIL_MAPC.frt.tank
                : RAIL_MAPC.frt.flat;
          if (k === "tank") rr(-l / 2, -W * 0.42, l, W * 0.84, W * 0.42);
          else (ctx.beginPath(), ctx.rect(-l / 2, -W * 0.42, l, W * 0.84));
          ctx.fill();
          ctx.lineWidth = Math.max(1, W * 0.12);
          ctx.strokeStyle = "#ff9f1a";
          ctx.stroke();
          ctx.shadowBlur = 0;
          if (k === "flat") {
            ctx.fillStyle = RAIL_BOX[(c.seed || 0) % RAIL_BOX.length];
            ctx.fillRect(-l / 2 + 1, -W * 0.32, l - 2, W * 0.64);
          }
          if (k === "hop" && W >= 6) {
            ctx.fillStyle = "#1d1a18";
            ctx.fillRect(-l / 2 + W * 0.25, -W * 0.25, l - W * 0.5, W * 0.5);
          }
        }
      }
      ctx.restore();
      if (night > 0.05 || sel) {
        ctx.shadowColor = sel
          ? "rgba(255,255,255,1)"
          : tr.pax
            ? "rgba(80,210,255,0.9)"
            : "rgba(255,160,40,0.9)";
        ctx.shadowBlur = sel ? 14 : 8 * Math.max(night, 0.5);
      }
      if (hits) hits.push([x, y, Math.max(9, l / 2), tr]);
    }
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  if (!mini && RAIL.mapSel) {
    const tr = RAIL.mapSel,
      q = railTrainPoses(tr, t)[0],
      x = BX(q.x / M_T),
      y = BY(q.y / M_T),
      [l1, l2] = railTrainInfo(tr);
    ctx.save();
    ctx.font = "bold 15px system-ui,sans-serif";
    const w =
        Math.max(
          ctx.measureText(l1).width,
          ((ctx.font = "13px system-ui,sans-serif"), ctx.measureText(l2).width),
        ) + 26,
      h = 50;
    const bx = Math.max(24, Math.min(VW - w - 96, x + 14)),
      by = Math.max(46, Math.min(VH - h - 24, y - h - 12));
    ctx.fillStyle = "rgba(10,14,22,0.95)";
    ctx.fillRect(bx, by, w, h);
    ctx.strokeStyle = tr.pax ? RAIL_MAPC.pax.body : RAIL_MAPC.frt.loco;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, w, h);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = tr.pax ? RAIL_MAPC.pax.body : RAIL_MAPC.frt.loco;
    ctx.font = "bold 15px system-ui,sans-serif";
    ctx.fillText(l1, bx + 13, by + 21);
    ctx.fillStyle = "#e8eef5";
    ctx.font = "13px system-ui,sans-serif";
    ctx.fillText(l2, bx + 13, by + 40);
    ctx.restore();
  }
}
function railMapTrainAt(x, y) {
  let best = null,
    bd = 1e9;
  for (const [hx, hy, r, tr] of RAIL.mapHits || []) {
    const d = Math.hypot(x - hx, y - hy);
    if (d < r + 8 && d < bd) {
      bd = d;
      best = tr;
    }
  }
  return best;
}

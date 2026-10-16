"use strict";
// ===================== v27 emergency services: fire stations, police stations, hospitals =====================
// Generated deterministically from depots.js (after fuel/garages, before homes). Each site sits south of a non-motorway road with
// a driveway onto it (global summed-area search + access), so it never overlaps roads, rail, docks or other claimed plots.
// Future hooks (ambulances / police cars / fire engines): SVC.list entries carry metres-space data:
//   {id,type:'fire'|'police'|'hospital',name,town,region,x,y,rect:{x0,y0,x1,y1},entrance:{x,y},exit:{x,y,h,dir},bays:[{id,kind,x,y,h}],helipad?}
//   bay.h / exit.h use the traffic heading convention (0 = north, +PI/2 = east); exit.dir is the unit vector out onto the road.
const SVC = { list: [], byType: { fire: [], police: [], hospital: [] } };
const SVC_ICON = {
  fire: ["#d62828", "\u{1F692}", "Fire station"],
  police: ["#1d4fbf", "\u{1F693}", "Police station"],
  hospital: ["#0a8f6a", "+", "Hospital"],
};
const SVC_BAY = 0.8; // bay pitch in tiles (3.2 m)
const SVC_SIZE = {
  fire: [
    [22, 16],
    [18, 14],
    [16, 12],
    [14, 12],
  ],
  police: [
    [20, 16],
    [16, 13],
    [14, 12],
  ],
  hospital: [
    [34, 28],
    [28, 24],
    [24, 20],
    [22, 18],
    [22, 14],
    [20, 13],
    [20, 12],
    [18, 12],
  ],
};
function svcGen(K) {
  const { findSpot, access, clearObjs, region, objs } = K;
  const t0 = performance.now();
  SVC.list = [];
  SVC.byType = { fire: [], police: [], hospital: [] };
  const R = mulberry(2707),
    M = (v) => v * M_T,
    CN = {
      C1: "Albion",
      SV: "Sandvale",
      KB: "Kingsbridge",
      MF: "Millford",
      DW: "Dustwater",
      CM: "Coppermine",
      RH: "Redhill",
      FW: "Fenwick",
      AB: "Ashby",
    };
  const clrB = (x, y, w, h) => {
    const X0 = x * TILE,
      Y0 = y * TILE,
      X1 = (x + w) * TILE,
      Y1 = (y + h) * TILE;
    for (const o of objs) {
      if (
        o._dead ||
        !(o.kind === "bldg" || o.kind === "lot" || o.kind === "awning") ||
        o.w === undefined
      )
        continue;
      if (o.x < X1 && o.x + o.w > X0 && o.y < Y1 && o.y + o.h > Y0) {
        o._dead = 1;
        if (o.kind !== "awning") {
          const a = Math.floor(o.x / TILE),
            b = Math.floor(o.y / TILE);
          for (let j = b; j < b + Math.ceil(o.h / TILE); j++)
            for (let i = a; i < a + Math.ceil(o.w / TILE); i++)
              if (
                !world.reserved[idx(i, j)] &&
                (get(i, j) === T.BLDG || get(i, j) === T.LOT || get(i, j) === T.PLAZA)
              )
                set(i, j, T.PGRASS);
        }
      }
    }
  };
  // fast spot search: one summed-area table of unusable tiles for the whole map, candidates = plots directly south of every non-motorway
  // horizontal road (driveway 1-4 tiles), so each placement is O(candidates) instead of a ring search
  const okS = (t) =>
    t === T.GRASS ||
    t === T.TREE ||
    t === T.SAND ||
    t === T.FIELD ||
    t === T.HEDGE ||
    t === T.GRAVEL ||
    t === T.WALK ||
    t === T.PGRASS ||
    t === T.ROCK ||
    t === T.CONC ||
    t === T.BLDG ||
    t === T.LOT ||
    t === T.PLAZA;
  const OK = new Uint8Array(256);
  for (let t = 0; t < 256; t++) OK[t] = okS(t) ? 1 : 0;
  const SOFT = new Uint8Array(256);
  for (const t of [T.WALK, T.PLAZA, T.PGRASS, T.BLDG, T.LOT]) SOFT[t] = 1;
  const GR = new Uint8Array(256);
  for (const t of [T.GRASS, T.TREE, T.HEDGE, T.FIELD]) GR[t] = 1; // town blocks are reserved but may be rebuilt (as fuel stations do); claimed plots are CONC and stay off-limits
  const W1 = MW + 1,
    sat = new Int32Array(W1 * (MH + 1)),
    sg2 = new Int32Array(W1 * (MH + 1)),
    RS = world.reserved;
  for (let j = 0; j < MH; j++) {
    let row = 0,
      r2 = 0;
    const o = (j + 1) * W1,
      op = j * W1;
    let k = j * MW;
    for (let i = 0; i < MW; i++, k++) {
      const g = G[k],
        rg = RS[k] && GR[g];
      row += !OK[g] || (RS[k] && !SOFT[g] && !rg) ? 1 : 0;
      r2 += rg ? 1 : 0;
      sat[o + i + 1] = sat[op + i + 1] + row;
      sg2[o + i + 1] = sg2[op + i + 1] + r2;
    }
  }
  const resG = (x, y, w, h) =>
    sg2[(y + h) * W1 + x + w] - sg2[y * W1 + x + w] - sg2[(y + h) * W1 + x] + sg2[y * W1 + x] > 0; // reserved open ground: only usable inside a town's own footprint
  const bad = (x, y, w, h) =>
    x < 2 ||
    y < 2 ||
    x + w > MW - 2 ||
    y + h > MH - 2 ||
    sat[(y + h) * W1 + x + w] - sat[y * W1 + x + w] - sat[(y + h) * W1 + x] + sat[y * W1 + x] > 0;
  const taken = [],
    hit = (x, y, w, h) =>
      taken.some(
        (r) => x < r[0] + r[2] + 2 && x + w + 2 > r[0] && y < r[1] + r[3] + 2 && y + h + 2 > r[1],
      ),
    cand = {};
  const cands = (w, h) => {
    const key = w + "x" + h;
    if (cand[key]) return cand[key];
    const out = [];
    for (const sg of world.segs) {
      if (!sg || sg.dir !== "h" || sg.type === "hwy" || sg.b1 - sg.b0 < w + 2) continue;
      for (let x = sg.b0 + 1; x + w <= sg.b1; x += 2) {
        const c = x + (w >> 1);
        let rd = 0;
        const j0 = sg.a + sg.w - 1;
        for (let i = c - 2; i < c + 2; i++)
          if (world.roadH[idx(i, j0)] === sg.id && world.roadV[idx(i, j0)] < 0) rd++;
        if (rd < 4) continue;
        for (let gap = 1; gap <= 4; gap++) {
          const y = j0 + 1 + gap;
          if (bad(x - 1, y, w + 2, h + 1) || bad(c - 3, j0 + 1, 6, gap)) continue;
          out.push([x, y, gap]);
          break;
        }
      }
    }
    return (cand[key] = out);
  };
  const far = (type, d, x, y) => SVC.byType[type].some((s) => Math.hypot(s.tx - x, s.ty - y) < d);
  function place(type, tx, ty, name, town, sep, maxR, box) {
    for (const [w, h] of SVC_SIZE[type]) {
      let best = null,
        bd = maxR || 90;
      for (const c of cands(w, h)) {
        const d = Math.hypot(c[0] + w / 2 - tx, c[1] + h / 2 - ty);
        if (d >= bd) continue;
        if (
          hit(c[0], c[1] - c[2], w, h + c[2]) ||
          far(type, sep, c[0], c[1]) ||
          (resG(c[0] - 1, c[1] - c[2], w + 2, h + c[2] + 1) &&
            !(
              box &&
              c[0] > box[0] - 20 &&
              c[0] + w < box[2] + 20 &&
              c[1] > box[1] - 20 &&
              c[1] + h < box[3] + 20
            ))
        )
          continue;
        best = c;
        bd = d;
      }
      if (!best) continue;
      const [x, y, gap] = best;
      clrB(x - 1, y - gap, w + 2, h + gap);
      taken.push([x, y - gap, w, h + gap]);
      return build(type, x, y, w, h, gap, name, town);
    }
    return null;
  }
  function build(type, x, y, w, h, gap, name, town) {
    access(x, y, w, gap);
    clearObjs(x, y, w, h);
    fill(x, y, w, h, T.CONC);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) world.reserved[idx(i, j)] = 1;
    const cx = x + w / 2,
      s = {
        id: type[0].toUpperCase() + (SVC.byType[type].length + 1),
        type,
        name,
        town,
        region: region(x, y),
        tx: x,
        ty: y,
        w,
        h,
        x: M(cx),
        y: M(y + h / 2),
        rect: { x0: M(x), y0: M(y), x1: M(x + w), y1: M(y + h) },
        entrance: { x: M(cx), y: M(y - gap) },
        exit: { x: M(cx), y: M(y - gap), h: 0, dir: [0, -1] },
        bays: [],
        parts: {},
      };
    const bay = (kind, bx, by, hh) =>
        s.bays.push({ id: s.bays.length + 1, kind, x: M(bx), y: M(by), h: hh }),
      side = (kind, p) => {
        const n = Math.floor((p.h - 1.4) / SVC_BAY);
        for (const sd of [0, 1])
          for (let k = 0; k < n; k++)
            bay(
              kind,
              sd ? p.x + p.w - 0.75 : p.x + 0.75,
              p.y + 1 + (k + 0.5) * SVC_BAY,
              sd ? Math.PI / 2 : -Math.PI / 2,
            );
      },
      P = s.parts,
      B = (k, a, b, ww, hh, t) => {
        P[k] = { x: x + a, y: y + b, w: ww, h: hh };
        fill(x + a, y + b, ww, hh, t);
      };
    if (type === "fire") {
      B("house", 1, 6, w - 7, h - 7, T.BLDG);
      B("tower", w - 4, h - 6, 3, 4, T.BLDG);
      P.doors = 3;
      for (let k = 0; k < 3; k++) bay("appliance", x + 1 + (13 * (k + 0.5)) / 3, y + 3.6, 0);
    } else if (type === "police") {
      B("main", 1, 3, w - 9, h - 6, T.BLDG);
      B("park", w - 7, 1, 6, h - 2, T.LOT);
      side("patrol", P.park);
    } else {
      const big = w >= 34;
      const sm = h <= 14;
      B(
        "main",
        1,
        big ? 10 : sm ? 6 : 8,
        Math.round(w * 0.64),
        h - (big ? 11 : sm ? 7 : 9),
        T.BLDG,
      );
      const mw = P.main.w;
      B("park", mw + 2, 2, w - mw - 3, h - 3, T.LOT);
      P.canopy = { x: x + mw - 7, y: y + P.main.y - y - 4, w: 7, h: 4 };
      for (let k = 0; k < 3; k++)
        bay("ambulance", P.canopy.x + 1.2 + k * 2.2, P.canopy.y + 2, Math.PI);
      side("visitor", P.park);
      s.helipad = {
        x: M(P.main.x + P.main.w * 0.28),
        y: M(P.main.y + P.main.h * 0.55),
        r: M(Math.min(P.main.w, P.main.h) * 0.28),
      };
    }
    objs.push({
      kind: "svc",
      x: x * TILE,
      y: y * TILE,
      w: w * TILE,
      h: h * TILE,
      height: type === "fire" ? 34 : 24,
      s,
      seed: (R() * 1e9) | 0,
    });
    SVC.list.push(s);
    SVC.byType[type].push(s);
    return s;
  }
  for (const k in CN) {
    const c = world.cities[k];
    if (!c) continue;
    const x0 = c.xs[0],
      y0 = c.ys[0],
      x1 = c.X1,
      y1 = c.Y1,
      cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      hw = (x1 - x0) / 2,
      hh = (y1 - y0) / 2,
      big = Math.max(hw, hh) >= 90,
      sm = Math.max(hw, hh) < 40,
      MR = Math.round(Math.max(hw, hh) + 60),
      sep = Math.max(30, Math.min(hw, hh) * 0.8);
    const tg = [
        [0, 0],
        [-0.5, -0.4],
        [0.5, 0.4],
        [0.5, -0.4],
        [-0.5, 0.4],
        [0, -0.7],
        [0, 0.7],
        [-0.7, 0],
        [0.7, 0],
      ].map(([a, b]) => [Math.round(cx + a * hw), Math.round(cy + b * hh)]),
      town = CN[k];
    const want = { hospital: 1, fire: big ? 2 : 1, police: big ? 2 : 1 },
      Q = ["Central", "North", "South", "East", "West"];
    for (const type of ["hospital", "fire", "police"]) {
      let n = 0;
      const off = type === "fire" ? 1 : type === "police" ? 3 : 0;
      for (let t = 0; t < 5 && n < want[type]; t++) {
        const last = t === 4,
          [tx, ty] = last ? tg[0] : tg[(t + off) % tg.length];
        const nm =
          type === "hospital"
            ? town + (big ? " General Hospital" : " Community Hospital")
            : town +
              (want[type] > 1 ? " " + Q[n + 1] : "") +
              (type === "fire" ? " Fire Station" : " Police Station");
        if (
          place(
            type,
            tx,
            ty,
            nm,
            town,
            last ? sep * 0.5 : sep,
            last ? Math.max(MR + 60, 240) : Math.min(MR, type === "hospital" && t < 3 ? 55 : 90),
            [x0, y0, x1, y1],
          )
        )
          n++;
      }
      // v29: every town gets a hospital - fall back to the outskirts (road frontage) if the centre is full
      if (type === "hospital" && n < 1)
        for (const [a, b] of [
          [1.3, 0],
          [-1.3, 0],
          [0, 1.3],
          [0, -1.3],
          [1.1, 1.1],
          [-1.1, 1.1],
          [1.1, -1.1],
          [-1.1, -1.1],
        ]) {
          const nm = town + (big ? " General Hospital" : " Community Hospital");
          if (
            place(
              type,
              Math.round(cx + a * Math.max(hw, 30)),
              Math.round(cy + b * Math.max(hh, 30)),
              nm,
              town,
              0,
              260,
              [x0, y0, x1, y1],
            )
          ) {
            n++;
            break;
          }
        }
    }
  }
  // rural cover: a fire station (and police post) for open country more than ~300 tiles from any existing one
  for (let gy = 180; gy < MH - 150; gy += 340)
    for (let gx = 180; gx < MW - 150; gx += 340) {
      for (const type of ["fire", "police"]) {
        if (SVC.byType[type].some((s) => Math.hypot(s.tx - gx, s.ty - gy) < 300)) continue;
        const g = get(gx, gy);
        if (
          g === T.WATER ||
          Object.values(world.cities).some(
            (c) => c && gx > c.xs[0] - 90 && gx < c.X1 + 90 && gy > c.ys[0] - 90 && gy < c.Y1 + 90,
          )
        )
          continue;
        const rg = region(gx, gy);
        let nt = null,
          nd = 1e9;
        for (const k in CN) {
          const c = world.cities[k];
          if (!c) continue;
          const d = Math.hypot((c.xs[0] + c.X1) / 2 - gx, (c.ys[0] + c.Y1) / 2 - gy);
          if (d < nd) {
            nd = d;
            nt = CN[k];
          }
        }
        place(
          type,
          gx,
          gy,
          rg + (type === "fire" ? " Rural Fire Station" : " Rural Police Post"),
          nt,
          200,
          140,
        );
      }
    }
  if (typeof BigRig !== "undefined") {
    BigRig.services = svcList;
    BigRig.nearestService = svcNearest;
  }
  world.services = SVC.list;
  world.tmSvc = performance.now() - t0;
  console.log(
    "[services]",
    JSON.stringify({
      fire: SVC.byType.fire.length,
      police: SVC.byType.police.length,
      hospital: SVC.byType.hospital.length,
      ms: world.tmSvc | 0,
    }),
  );
}
// ---------- public hooks
function svcList(type) {
  return type ? SVC.byType[type] || [] : SVC.list;
}
function svcNearest(type, x, y) {
  let b = null,
    bd = 1e18;
  for (const s of svcList(type)) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bd) {
      bd = d;
      b = s;
    }
  }
  return b;
}
function svcMapIcons(icon, px, py) {
  for (const s of SVC.list) {
    const d = SVC_ICON[s.type];
    icon(px(s.entrance.x), py(s.entrance.y), d[0], d[1]);
  }
}
// ---------- night lights (called from dnBuild)
function svcLights(add) {
  for (const s of SVC.list) {
    const X = (t) => t * TILE,
      P = s.parts;
    add(X(s.tx + s.w / 2), X(s.ty + 2.5), Math.min(220, s.w * TILE * 0.45), "fl");
    for (const k in P) {
      const p = P[k];
      if (!p || p.w == null || k === "canopy") continue;
      if (k === "park") add(X(p.x + p.w / 2), X(p.y + p.h / 2), 150, "fl");
      else {
        const win = [],
          r = mulberry(s.tx * 7 + s.ty);
        for (let i = 0; i < Math.min(16, ((p.w * p.h) / 6) | 0); i++)
          win.push([X(p.x) + 6 + r() * (X(p.w) - 16), X(p.y) + 6 + r() * (X(p.h) - 14), true, 30]);
        add(X(p.x + p.w / 2), X(p.y + p.h / 2), X(Math.max(p.w, p.h)) * 0.55, "b", {
          o: { x: X(p.x), y: X(p.y), w: X(p.w), h: X(p.h) },
          win,
        });
      }
    }
    if (s.type === "police") {
      const m = P.main;
      add(X(m.x + m.w / 2), X(m.y) - 6, 16, "cl", { col: "rgba(60,130,255,1)", bl: 1 });
    }
    if (s.type === "fire") {
      const h = P.house;
      for (let k = 0; k < 3; k++) add(X(h.x + (h.w * (k + 0.5)) / 3), X(h.y) - 10, 70, "fl");
      add(X(P.tower.x + 2), X(P.tower.y + 2.5), 10, "cl", { col: "rgba(255,40,30,1)", bl: 2 });
    }
    if (s.type === "hospital") {
      const c = P.canopy;
      add(X(c.x + c.w / 2), X(c.y + c.h / 2), 110, "fl");
      add(X(c.x + c.w - 1), X(c.y + c.h) + 4, 14, "cl", { col: "rgba(255,50,50,1)" });
      const hp = s.helipad;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 6.283;
        add((hp.x + Math.cos(a) * hp.r) * PPM, (hp.y + Math.sin(a) * hp.r) * PPM, 5, "cl", {
          col: "rgba(90,255,120,1)",
        });
      }
    }
  }
}
// ---------- art (static chunk cache, top-down procedural)
function svcRoller(g, x, y, w, h) {
  h = Math.max(h, 22);
  g.fillStyle = "#3a3d42";
  g.fillRect(x - 3, y - 3, w + 6, h + 5);
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, "#e4e7ea");
  gr.addColorStop(1, "#aeb3b9");
  g.fillStyle = gr;
  g.fillRect(x, y, w, h); // v29: clearer roller doors: dark frame, bold slats, hazard sill
  g.fillStyle = "rgba(0,0,0,0.35)";
  for (let k = y + 3; k < y + h - 4; k += 4) g.fillRect(x + 1, k, w - 2, 1.6);
  g.fillStyle = "#c0392b";
  g.fillRect(x, y, w, 3);
  for (let k = 0; k < w; k += 8) {
    g.fillStyle = (k / 8) % 2 ? "#111" : "#f5c518";
    g.fillRect(x + k, y + h - 4, Math.min(8, w - k), 4);
  }
  g.strokeStyle = "#22252a";
  g.lineWidth = 2;
  g.strokeRect(x, y, w, h);
  g.lineWidth = 1;
}
function svcBays(g, p, label) {
  const X = (t) => t * TILE;
  g.fillStyle = "#3d4148";
  g.fillRect(X(p.x), X(p.y), X(p.w), X(p.h));
  g.strokeStyle = "rgba(245,245,240,0.85)";
  g.lineWidth = 2.5;
  const n = Math.floor((p.h - 1.4) / SVC_BAY);
  for (const side of [0, 1]) {
    const x0 = side ? X(p.x + p.w - 1.5) : X(p.x) + 3,
      x1 = side ? X(p.x + p.w) - 3 : X(p.x + 1.5);
    for (let k = 0; k <= n; k++) {
      const yy = X(p.y + 1 + k * SVC_BAY);
      g.beginPath();
      g.moveTo(x0, yy);
      g.lineTo(x1, yy);
      g.stroke();
    }
  }
  g.lineWidth = 1;
  if (label) {
    g.save();
    g.translate(X(p.x + p.w / 2), X(p.y + p.h / 2));
    g.rotate(-Math.PI / 2);
    g.fillStyle = "rgba(245,245,235,0.8)";
    g.font = "bold 16px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, 0, 0);
    g.restore();
  }
}
function svcSign(g, x, y, w, h, bg, fg, txt, font) {
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(x + 3, y + 3, w, h);
  g.fillStyle = bg;
  pill(g, x, y, w, h, 4);
  g.fill();
  g.fillStyle = fg;
  g.font = font || "900 " + Math.round(h * 0.62) + "px Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(txt, x + w / 2, y + h / 2 + 1);
}
OBJX.svc = (g, o) => {
  const s = o.s,
    P = s.parts,
    X = (t) => t * TILE;
  g.save();
  // apron edge + kerb
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 3;
  g.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
  g.lineWidth = 1;
  if (s.type === "fire") {
    const hs = P.house,
      hx = X(hs.x),
      hy = X(hs.y),
      hw = X(hs.w),
      hh = X(hs.h);
    // forecourt: red/white hatched keep-clear box in front of the doors
    g.fillStyle = "rgba(214,40,40,0.16)";
    g.fillRect(hx, o.y + X(1), hw, hy - o.y - X(1));
    g.strokeStyle = "#e8c21f";
    g.lineWidth = 3;
    g.strokeRect(hx + 2, o.y + X(1), hw - 4, hy - o.y - X(1) - 2);
    for (let k = hx + 10; k < hx + hw - 6; k += 24) {
      g.beginPath();
      g.moveTo(k, o.y + X(1) + 4);
      g.lineTo(k + 14, hy - 6);
      g.stroke();
    }
    g.lineWidth = 1;
    g.fillStyle = "rgba(245,245,235,0.9)";
    g.font = "bold 18px Arial";
    g.textAlign = "center";
    g.fillText("KEEP CLEAR \u2022 FIRE ENGINES", hx + hw / 2, o.y + X(1) + 22);
    drawShadowRect(g, hx, hy, hw, hh, 18);
    const gr = g.createLinearGradient(hx, hy, hx, hy + hh);
    gr.addColorStop(0, "#c0392b");
    gr.addColorStop(0.5, "#9e2b20");
    gr.addColorStop(1, "#c0392b");
    g.fillStyle = gr;
    g.fillRect(hx, hy, hw, hh);
    g.fillStyle = "rgba(0,0,0,0.18)";
    for (let k = hx + 12; k < hx + hw; k += 16) g.fillRect(k, hy, 2, hh);
    g.fillStyle = "#7a1f17";
    g.fillRect(hx, hy + hh / 2 - 3, hw, 6);
    const dw = (hw - 16) / 3;
    for (let k = 0; k < 3; k++) svcRoller(g, hx + 4 + k * (dw + 4), hy - 2, dw, 22);
    svcSign(g, hx + hw * 0.15, hy + hh * 0.62, hw * 0.7, 30, "#f4f4f0", "#b0201a", "FIRE STATION");
    g.fillStyle = "#fff";
    g.font = "bold 14px Arial";
    g.textAlign = "center";
    g.fillText(s.town.toUpperCase(), hx + hw / 2, hy + hh * 0.3);
    const t = P.tower,
      tx = X(t.x),
      ty = X(t.y),
      tw = X(t.w),
      th = X(t.h);
    drawShadowRect(g, tx, ty, tw, th, 52);
    g.fillStyle = "#9ea3a8";
    g.fillRect(tx, ty, tw, th);
    g.fillStyle = "#c0392b";
    g.fillRect(tx + 6, ty + 6, tw - 12, th - 12);
    g.fillStyle = "#6d7177";
    g.fillRect(tx + tw / 2 - 10, ty + 8, 20, th - 16);
    g.strokeStyle = "#e8e8e8";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(tx + tw / 2 - 7, ty + 8);
    g.lineTo(tx + tw / 2 - 7, ty + th - 8);
    g.moveTo(tx + tw / 2 + 7, ty + 8);
    g.lineTo(tx + tw / 2 + 7, ty + th - 8);
    for (let k = ty + 14; k < ty + th - 8; k += 9) {
      g.moveTo(tx + tw / 2 - 7, k);
      g.lineTo(tx + tw / 2 + 7, k);
    }
    g.stroke();
    g.lineWidth = 1;
    g.fillStyle = "#fff";
    g.font = "bold 11px Arial";
    g.fillText("DRILL", tx + tw / 2, ty + th + 14);
  } else if (s.type === "police") {
    const m = P.main,
      mx = X(m.x),
      my = X(m.y),
      mw = X(m.w),
      mh = X(m.h),
      pk = P.park;
    svcBays(g, pk, "POLICE ONLY");
    g.strokeStyle = "#2b2f36";
    g.lineWidth = 4;
    g.setLineDash([10, 4]);
    g.beginPath();
    const px0 = X(pk.x) - 2,
      px1 = X(pk.x + pk.w) + 2,
      py0 = X(pk.y) - 2,
      py1 = X(pk.y + pk.h) + 2;
    g.moveTo(px0 + X(2.5), py0);
    g.lineTo(px0, py0);
    g.lineTo(px0, py1);
    g.lineTo(px1, py1);
    g.lineTo(px1, py0);
    g.lineTo(px1 - X(2.5), py0);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = "#e8c21f";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(px0 + X(2.5), py0);
    g.lineTo(px1 - X(2.5), py0);
    g.stroke();
    g.lineWidth = 1;
    drawShadowRect(g, mx, my, mw, mh, 16);
    const gr = g.createLinearGradient(mx, my, mx + mw, my + mh);
    gr.addColorStop(0, "#d9dadd");
    gr.addColorStop(1, "#aeb2b8");
    g.fillStyle = gr;
    g.fillRect(mx, my, mw, mh);
    g.fillStyle = "#8f949b";
    for (let k = 0; k < 4; k++)
      g.fillRect(mx + mw * 0.55 + (k % 2) * 28, my + mh * 0.45 + ((k / 2) | 0) * 26, 20, 14);
    g.fillStyle = "#1d4fbf";
    g.fillRect(mx, my, mw, 14);
    g.fillStyle = "#fff";
    for (let k = mx; k < mx + mw; k += 20) g.fillRect(k, my + 4, 10, 6);
    svcSign(g, mx + mw * 0.08, my + 24, mw * 0.5, 30, "#1d4fbf", "#fff", "POLICE");
    g.fillStyle = "#24303f";
    g.font = "bold 13px Arial";
    g.textAlign = "left";
    g.fillText(s.town.toUpperCase(), mx + mw * 0.08, my + 70);
    const lx = mx + mw / 2,
      ly = my - 6;
    g.fillStyle = "#222";
    g.fillRect(lx - 3, ly, 6, 10);
    g.fillStyle = "#2f6dff";
    g.beginPath();
    g.arc(lx, ly, 8, 0, 7);
    g.fill();
    g.strokeStyle = "#fff";
    g.lineWidth = 2;
    g.stroke();
    g.lineWidth = 1;
    g.fillStyle = "#fff";
    g.font = "bold 7px Arial";
    g.textAlign = "center";
    g.fillText("POLICE", lx, ly + 3);
  } else {
    const m = P.main,
      mx = X(m.x),
      my = X(m.y),
      mw = X(m.w),
      mh = X(m.h),
      pk = P.park,
      c = P.canopy;
    svcBays(g, pk);
    g.fillStyle = "rgba(245,245,235,0.8)";
    g.font = "bold 15px Arial";
    g.textAlign = "center";
    g.fillText("P", X(pk.x + pk.w / 2), X(pk.y) + 18);
    drawShadowRect(g, mx, my, mw, mh, 26);
    const gr = g.createLinearGradient(mx, my, mx, my + mh);
    gr.addColorStop(0, "#eceae4");
    gr.addColorStop(1, "#cfccc4");
    g.fillStyle = gr;
    g.fillRect(mx, my, mw, mh);
    g.strokeStyle = "rgba(0,0,0,0.2)";
    g.lineWidth = 3;
    g.strokeRect(mx + 1.5, my + 1.5, mw - 3, mh - 3);
    g.fillStyle = "#d5d2ca";
    g.fillRect(mx + mw * 0.58, my + mh * 0.12, mw * 0.36, mh * 0.76);
    g.lineWidth = 1;
    g.fillStyle = "#9aa0a6";
    for (let k = 0; k < 5; k++)
      g.fillRect(mx + mw * 0.62 + (k % 2) * 40, my + mh * 0.2 + ((k / 2) | 0) * 40, 26, 18);
    const hp = s.helipad,
      hx = hp.x * PPM,
      hy = hp.y * PPM,
      hr = hp.r * PPM;
    g.fillStyle = "#4a5058";
    g.beginPath();
    g.arc(hx, hy, hr, 0, 7);
    g.fill();
    g.strokeStyle = "#f2c230";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(hx, hy, hr - 7, 0, 7);
    g.stroke();
    g.lineWidth = 1;
    g.fillStyle = "#fff";
    g.font = "900 " + Math.round(hr * 1.1) + "px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("H", hx, hy + 2);
    g.textBaseline = "alphabetic";
    svcSign(g, mx + mw * 0.08, my + mh - 40, mw * 0.5, 28, "#005eb8", "#fff", "HOSPITAL");
    g.fillStyle = "#24303f";
    g.font = "bold 12px Arial";
    g.textAlign = "left";
    g.fillText(s.name.toUpperCase(), mx + mw * 0.08, my + mh - 48);
    const cx = X(c.x),
      cy = X(c.y),
      cw = X(c.w),
      ch = X(c.h);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(cx + 6, cy + 6, cw, ch);
    g.fillStyle = "rgba(236,240,244,0.92)";
    g.fillRect(cx, cy, cw, ch);
    g.fillStyle = "#d62828";
    g.fillRect(cx, cy, cw, 8);
    g.fillRect(cx, cy + ch - 6, cw, 6);
    g.strokeStyle = "#f2c230";
    g.lineWidth = 3;
    for (let k = 1; k < 3; k++) {
      g.beginPath();
      g.moveTo(cx + X(0.1 + k * 2.2), cy + 10);
      g.lineTo(cx + X(0.1 + k * 2.2), cy + ch - 8);
      g.stroke();
    }
    g.lineWidth = 1;
    g.fillStyle = "#d62828";
    g.font = "bold 13px Arial";
    g.textAlign = "center";
    g.fillText("AMBULANCE ONLY", cx + cw / 2, cy + ch / 2 + 5);
    svcSign(g, cx + cw - 62, cy + ch + 2, 58, 22, "#d62828", "#fff", "A&E");
  }
  g.restore();
};

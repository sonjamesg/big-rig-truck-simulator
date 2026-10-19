/**
 * @file peds.js — PEDESTRIANS (v53c, James 19 Oct): people walk trips along pavements, footpaths, parks and squares
 *   (planned on the walkable tile grid, string-pulled into straight legs, each walker keeping a side of the pavement),
 *   linger in parks and squares, and cross roads only on the UK junction crossings while the green man shows. Density
 *   follows the area (city centre > edge of town > rural); counts are capped harder on Low quality. Each walker has its
 *   own top, bottoms, skin and hair. Casualty fields (down / cas / fix / prog / col) are shared with ambulance.js and
 *   police.js.
 * Exposes (globals): WALKABLE, PED_SOLID, pedMask, pedOk, PEDX, pedXings, pedXAt, pedOnX, PED_TOPS, PED_BOTS,
 *   PED_SKIN, PED_HAIR, pedLook, pedDensity, pedSpawn, pedPlan, pedLos, updatePeds, PED_SCALE, drawPeds
 * Depends on: world.js (G, T, get, idx, inb, world), traffic.js (traffic, tRand, onScreen, playerBoxes, ptBoxDist,
 *   ang), physics.js (fwd), signals.js (sigPedLeft), daynight.js (slZone), gfx.js (GFX), truck (lorry.js)
 * Load order: after signals.js in build.py. Shared global scope.
 */
"use strict";
const WALKABLE = new Uint8Array(32);
[T.WALK, T.PLAZA, T.PARK].forEach((t) => (WALKABLE[t] = 1));
// v15: footprints of solid objects (containers, buildings, cranes...) and the port yard are never walkable, whatever tile lies beneath
const PED_SOLID = {
  cont: 1,
  bldg: 1,
  tank: 1,
  silo: 1,
  canopy: 1,
  pump: 1,
  stower: 1,
  mast: 1,
  turbine: 1,
  pallets: 1,
  tree: 1,
  rock: 1,
  hedge: 1,
  susp: 1,
  fountain: 1,
  pond: 1,
  runway: 1,
};
let pedBlk = null;
function pedMask() {
  if (pedBlk) return pedBlk;
  const blk = new Set();
  const mark = (x0, y0, x1, y1) => {
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) blk.add(x * 65536 + y);
  };
  for (const o of world.objects) {
    if (o.kind === "tree" && o.r) {
      mark(o.x / TILE - 0.3, o.y / TILE - 0.3, o.x / TILE + 0.3, o.y / TILE + 0.3);
      continue;
    }
    if (!PED_SOLID[o.kind] || o.w == null || o.h == null) continue;
    mark(o.x / TILE - 0.3, o.y / TILE - 0.3, (o.x + o.w) / TILE + 0.3, (o.y + o.h) / TILE + 0.3);
  }
  const P = world.port;
  if (P) mark(P.x0 + 4, P.y0 - 1, P.edge + 3, P.y1 + 1);
  if (world.kbPort) mark(1538, 1844, 1756, 1885 + DOCK_W + 2); // dg: no pedestrians in either dock // whole yard/quay/crane rails except the gate strip
  return (pedBlk = blk);
}
function pedOk(tx, ty) {
  return WALKABLE[get(tx, ty)] && !pedMask().has(tx * 65536 + ty);
}
// ---- crossings: the stud crossing row of every UK junction arm (tile 3 out from the box edge), kerb to kerb
const PEDX = { map: null };
function pedXings() {
  if (PEDX.map) return PEDX.map;
  const M = new Map();
  for (const o of world.overhead) {
    if (o.kind !== "ukjx") continue;
    const J = o.J;
    for (const A of o.arms) {
      if (!A) continue;
      const f = A.f,
        sg = world.segs[f[0] ? J.hs : J.vs],
        along = f[0] < 0 ? J.x - 4 : f[0] > 0 ? J.x + J.w + 3 : f[1] < 0 ? J.y - 4 : J.y + J.h + 3,
        at = (k) => (f[0] ? [along, k] : [k, along]),
        e0 = at(sg.a - 1),
        e1 = at(sg.a + sg.w);
      if (!pedOk(e0[0], e0[1]) || !pedOk(e1[0], e1[1])) continue; // no pavement at one end: no crossing
      const X = { J, len: sg.w * M_T };
      for (let k = sg.a; k < sg.a + sg.w; k++) {
        const t = at(k);
        M.set(t[0] * 65536 + t[1], X);
      }
    }
  }
  return (PEDX.map = M);
}
function pedXAt(tx, ty) {
  return pedXings().get(tx * 65536 + ty) || null;
}
// vehicles: is anyone walking on this junction's crossings?
function pedOnX(J) {
  for (const p of traffic.peds)
    if (p.onX && p.onX.J === J && pedXAt(Math.floor(p.x / M_T), Math.floor(p.y / M_T))) return true;
  return false;
}
// ---- looks: varied clothes, skin and hair (top-down)
const PED_TOPS = [
  "#c0392b",
  "#2980b9",
  "#27ae60",
  "#f1c40f",
  "#8e44ad",
  "#ecf0f1",
  "#2c3e50",
  "#e67e22",
  "#16a085",
  "#7f8c8d",
  "#d35f8d",
  "#1f3a5f",
  "#6b8e23",
  "#b03a2e",
  "#f5d0a9",
  "#3b3b3b",
  "#5dade2",
  "#a04000",
];
const PED_BOTS = [
  "#2c3e66",
  "#1c1c22",
  "#4a4f57",
  "#6d5a3f",
  "#33415c",
  "#7a6a55",
  "#5b2c3a",
  "#3e5c3a",
];
const PED_SKIN = ["#f2d0b5", "#e8b896", "#d29f78", "#b07a52", "#8d5a3b", "#5e3b26"];
const PED_HAIR = [
  "#1b1410",
  "#3b2416",
  "#6b4423",
  "#a8743a",
  "#d9c27a",
  "#8a8a8a",
  "#c8c8c8",
  "#7a2e1c",
];
function pedLook(r) {
  const pick = (a) => a[(r() * a.length) | 0];
  const top = pick(PED_TOPS);
  return {
    col: top,
    top,
    bot: pick(PED_BOTS),
    skin: pick(PED_SKIN),
    hair: pick(PED_HAIR),
    style: r() < 0.12 ? 0 : r() < 0.6 ? 1 : 2, // 0 bald/shaved, 1 short, 2 long
    bag: r() < 0.25 ? pick(["#5a3a22", "#1c1c22", "#b03a2e", "#2c3e66"]) : null,
  };
}
// ---- density: walkable share of the area round the player, weighted by how central it is
function pedDensity(x, y) {
  let w = 0;
  const r = tRand;
  for (let k = 0; k < 48; k++) {
    const a = r() * 6.283,
      d = 10 + r() * 120,
      tx = Math.floor((x + Math.cos(a) * d) / M_T),
      ty = Math.floor((y + Math.sin(a) * d) / M_T);
    if (!inb(tx, ty) || !pedOk(tx, ty)) continue;
    const z = typeof slZone === "function" ? slZone(tx, ty) : 2;
    w += z === 0 ? 1 : z === 1 ? 0.45 : get(tx, ty) === T.WALK ? 0.18 : 0.06;
  }
  return Math.min(1, (w / 48) * 4);
}
function pedSpawn(P, any) {
  const r = tRand;
  for (let t = 0; t < 10; t++) {
    const a = r() * 6.283,
      d = 30 + r() * 100,
      x = P.x + Math.cos(a) * d,
      y = P.y + Math.sin(a) * d,
      tx = Math.floor(x / M_T),
      ty = Math.floor(y / M_T);
    if (!pedOk(tx, ty) || (!any && onScreen(x, y, 6))) continue;
    const z = typeof slZone === "function" ? slZone(tx, ty) : 2;
    if (r() > (z === 0 ? 1 : z === 1 ? 0.6 : 0.3)) continue; // quieter streets get fewer of the walkers
    const p = Object.assign(pedLook(r), {
      x: (tx + 0.5) * M_T,
      y: (ty + 0.5) * M_T,
      h: r() * 6.283,
      sp: 1.15 + r() * 0.45,
      lat: (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.9), // the side of the pavement this walker keeps to (m)
      ph: r() * 6,
      flee: 0,
      down: 0,
      path: null,
      i: 0,
      wait: 0,
      onX: null,
    });
    p.dx = Math.sin(p.h);
    p.dy = -Math.cos(p.h);
    return p;
  }
  return null;
}
// straight walkable line between tile centres (no crossings, 0.3-tile clearance either side)
function pedLos(ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    L = Math.hypot(dx, dy),
    n = Math.ceil(L * 4),
    nx = L ? (-dy / L) * 0.3 : 0,
    ny = L ? (dx / L) * 0.3 : 0;
  for (let k = 1; k < n; k++) {
    const u = k / n,
      x = ax + 0.5 + dx * u,
      y = ay + 0.5 + dy * u;
    for (const s of [0, 1, -1]) {
      const tx = Math.floor(x + nx * s),
        ty = Math.floor(y + ny * s);
      if (!pedOk(tx, ty)) return false;
    }
  }
  return true;
}
const PED_R = 44,
  PED_N = (PED_R * 2 + 1) * (PED_R * 2 + 1),
  PED_PAR = new Int32Array(PED_N),
  PED_D = new Int16Array(PED_N);
// plan a trip: BFS over pavements / parks / squares (+ UK crossings) round the walker, pick a destination 10-44 tiles
// away (parks and squares preferred a third of the time), string-pull into straight legs, offset to the walker's side
function pedPlan(p) {
  const sx = Math.floor(p.x / M_T),
    sy = Math.floor(p.y / M_T),
    W = PED_R * 2 + 1,
    id = (tx, ty) => (ty - sy + PED_R) * W + (tx - sx + PED_R);
  if (!pedOk(sx, sy) && !pedXAt(sx, sy)) return false;
  PED_D.fill(-1);
  const q = [id(sx, sy)];
  PED_D[q[0]] = 0;
  PED_PAR[q[0]] = -1;
  const far = [],
    green = [];
  for (let h = 0; h < q.length; h++) {
    const c = q[h],
      cx = (c % W) + sx - PED_R,
      cy = ((c / W) | 0) + sy - PED_R,
      dc = PED_D[c];
    if (dc >= 10) {
      far.push(c);
      const t = get(cx, cy);
      if (t === T.PARK || t === T.PLAZA) green.push(c);
    }
    if (dc >= 44) continue;
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + ox,
        ny = cy + oy;
      if (Math.abs(nx - sx) > PED_R || Math.abs(ny - sy) > PED_R) continue;
      const n = id(nx, ny);
      if (PED_D[n] >= 0) continue;
      // crossings are only reachable from their kerb ends (the tiles along the arm either side are carriageway)
      if (!(pedOk(nx, ny) || pedXAt(nx, ny))) continue;
      PED_D[n] = dc + 1;
      PED_PAR[n] = c;
      q.push(n);
    }
  }
  const pool = green.length && tRand() < 0.35 ? green : far;
  if (!pool.length) return false;
  let c = pool[(tRand() * pool.length) | 0];
  const tiles = [];
  for (; c >= 0; c = PED_PAR[c]) tiles.push([(c % W) + sx - PED_R, ((c / W) | 0) + sy - PED_R]);
  tiles.reverse();
  // legs: string-pull the pavement runs; crossings stay kerb-to-kerb straight lines with a wait point on the kerb
  const pts = [],
    XA = (t) => pedXAt(t[0], t[1]);
  let i = 0;
  while (i < tiles.length) {
    const X = XA(tiles[i]);
    if (X) {
      if (pts.length) pts[pts.length - 1].x = X; // wait on the kerb for the green man
      while (i < tiles.length && XA(tiles[i]) === X) i++;
      if (i < tiles.length) pts.push({ t: tiles[i], x: null, kerb: 1 });
      i++;
      continue;
    }
    if (!pts.length || pts[pts.length - 1].t !== tiles[i]) pts.push({ t: tiles[i], x: null });
    let j = i;
    while (
      j + 1 < tiles.length &&
      !XA(tiles[j + 1]) &&
      pedLos(tiles[i][0], tiles[i][1], tiles[j + 1][0], tiles[j + 1][1])
    )
      j++;
    i = j > i ? j : i + 1;
  }
  const last = tiles[tiles.length - 1];
  if (!pts.length || pts[pts.length - 1].t !== last) pts.push({ t: last, x: null });
  // world coords, offset to the walker's side of each leg where that stays walkable
  const out = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k].t,
      b = (pts[k + 1] || pts[k - 1] || pts[k]).t,
      sgn = pts[k + 1] ? 1 : -1,
      dx = (b[0] - a[0]) * sgn,
      dy = (b[1] - a[1]) * sgn,
      L = Math.hypot(dx, dy) || 1,
      ox = (-dy / L) * p.lat,
      oy = (dx / L) * p.lat;
    let x = (a[0] + 0.5) * M_T,
      y = (a[1] + 0.5) * M_T;
    if (
      !pts[k].x &&
      !pts[k].kerb &&
      pedOk(Math.floor((x + ox) / M_T), Math.floor((y + oy) / M_T))
    ) {
      x += ox;
      y += oy;
    }
    out.push({ x, y, X: pts[k].x });
  }
  p.path = out;
  p.i = out.length > 1 ? 1 : 0;
  return true;
}
function updatePeds(dt) {
  const P = truck,
    ps = traffic.peds,
    lo = typeof GFX !== "undefined" && GFX.lvl === "low";
  if (!(traffic.pedT > 0)) {
    traffic.pedT = 2;
    traffic.pedW = Math.round((lo ? 30 : 90) * pedDensity(P.x, P.y));
  }
  traffic.pedT -= dt;
  const want = traffic.pedW || 0;
  for (let t = 0; t < 4 && ps.length < want; t++) {
    const p = pedSpawn(P, !traffic.pedInit);
    if (p) ps.push(p);
  }
  if (ps.length >= want) traffic.pedInit = true;
  let plans = lo ? 2 : 4;
  const pb = playerBoxes();
  for (let k = ps.length - 1; k >= 0; k--) {
    const p = ps[k];
    const d = Math.hypot(p.x - P.x, p.y - P.y);
    if (
      (d > 160 && !(p.cas && d < 1500)) ||
      (ps.length > want + 6 && d > 90 && !p.cas && !onScreen(p.x, p.y, 8))
    ) {
      ps.splice(k, 1);
      continue;
    } // v28: casualties stay where they fell until treated
    if (p.down > 0) {
      p.down -= dt;
      continue;
    }
    let sp = p.sp;
    const close = Math.min(...pb.map((b) => ptBoxDist(p.x, p.y, b)));
    if (close < 0.3 && Math.abs(P.v) > 1 && !p.cas) {
      p.down = 1e9;
      p.cas = true;
      p.fix = 0;
      p.prog = 0;
      p.onX = null;
      const f = fwd(P.h);
      p.x += f[0] * 1.5;
      p.y += f[1] * 1.5;
      try {
        if (typeof ambPedHit === "function") ambPedHit(p);
        if (typeof polPedHit === "function") polPedHit(p);
      } catch (e) {
        console.warn("ped hit hook", e);
      }
      continue;
    } // v28: knocked down, stays down (no gore) until paramedics arrive
    if (close < 7 && Math.abs(P.v) > 2 && !p.onX) {
      // step back from a lorry coming at us, then carry on with a fresh plan
      const ax = p.x - pb[0].x,
        ay = p.y - pb[0].y,
        L = Math.hypot(ax, ay) || 1,
        nx = p.x + (ax / L) * 4.2 * dt,
        ny = p.y + (ay / L) * 4.2 * dt;
      if (pedOk(Math.floor(nx / M_T), Math.floor(ny / M_T))) {
        p.x = nx;
        p.y = ny;
        p.h = ang(ax, ay);
      }
      p.flee = 1;
      p.path = null;
      p.ph += dt * 20;
      continue;
    }
    if (p.wait > 0) {
      p.wait -= dt;
      continue;
    } // lingering in a park / square, or at the end of a trip
    if (!p.path) {
      if (plans > 0) {
        plans--;
        if (!pedPlan(p)) p.wait = 1 + tRand() * 2;
      }
      continue;
    }
    const w = p.path[p.i];
    if (!w) {
      const t = get(Math.floor(p.x / M_T), Math.floor(p.y / M_T));
      p.wait = t === T.PARK || t === T.PLAZA ? 4 + tRand() * 14 : tRand() * 2.5;
      p.path = null;
      continue;
    }
    let tx = w.x - p.x,
      ty = w.y - p.y,
      L = Math.hypot(tx, ty);
    // on the kerb before a crossing: wait for a green man long enough to get over (the intergreen covers the tail)
    const prev = p.path[p.i - 1];
    if (prev && prev.X && !p.onX) {
      const left = sigPedLeft(prev.X.J);
      if (left < Math.max(1.5, prev.X.len / 1.6 - 6)) {
        p.h = ang(tx, ty);
        continue;
      }
      p.onX = prev.X;
    }
    if (p.onX) sp *= 1.25;
    // keep clear of the walker just ahead (side-step), cheap n^2 over the few nearby
    for (const o of ps) {
      if (p.onX) break; // on a crossing: straight over, no side-steps into the road
      if (o === p || o.down > 0) continue;
      const ox = o.x - p.x,
        oy = o.y - p.y;
      if (Math.abs(ox) > 1.2 || Math.abs(oy) > 1.2) continue;
      if (ox * tx + oy * ty > 0) {
        tx += (-ty / (L || 1)) * 0.6;
        ty += (tx / (L || 1)) * 0.6;
        L = Math.hypot(tx, ty);
        sp *= 0.85;
        break;
      }
    }
    const st = Math.min(L, sp * dt);
    if (L < 0.35) {
      p.i++;
      if (p.onX && !(p.path[p.i - 1] && p.path[p.i - 1].X)) p.onX = null;
      continue;
    }
    const nx = p.x + (tx / L) * st,
      ny = p.y + (ty / L) * st;
    const ntx = Math.floor(nx / M_T),
      nty = Math.floor(ny / M_T);
    if (pedOk(ntx, nty) || pedXAt(ntx, nty)) {
      p.x = nx;
      p.y = ny;
    } else {
      p.path = null; // knocked off the plan (fled, side-stepped into a wall): plan again
      p.onX = null;
    }
    const ht = ang(tx, ty),
      dh = Math.atan2(Math.sin(ht - p.h), Math.cos(ht - p.h));
    p.h += dh * Math.min(1, dt * 8);
    p.dx = Math.sin(p.h);
    p.dy = -Math.cos(p.h);
    p.ph += dt * sp * 5;
  }
}
// called from drawTraffic (under the vehicles); inV culls in metres
// drawn a touch larger than life so clothing reads at driving zoom
const PED_SCALE = 1.35;
function drawPeds(inV) {
  for (const p of traffic.peds) {
    if (!inV(p.x, p.y)) continue;
    const X = p.x * PPM,
      Y = p.y * PPM;
    if (p.down > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(X - 6, Y - 1, 13, 5);
      ctx.fillStyle = p.bot || "#2b2b33";
      ctx.fillRect(X - 8, Y - 2.5, 5, 4);
      ctx.fillStyle = p.col;
      ctx.fillRect(X - 4, Y - 3, 7, 5);
      ctx.fillStyle = p.skin || "#e0b48c";
      ctx.beginPath();
      ctx.arc(X + 5, Y - 1, 2.2, 0, 7);
      ctx.fill();
      if (p.cas) {
        const pu = 0.5 + 0.5 * Math.sin(timeS * 4);
        ctx.save();
        ctx.strokeStyle = "rgba(255,190,40," + (0.25 + 0.2 * pu) + ")";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(X, Y, 10, 0, 7);
        ctx.stroke();
        if (!(p.prog > 0)) {
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.beginPath();
          ctx.arc(X, Y - 15, 3.6, 0, 7);
          ctx.fill();
          ctx.fillStyle = "rgba(214,40,40,0.85)";
          ctx.fillRect(X - 0.7, Y - 17.4, 1.4, 4.8);
          ctx.fillRect(X - 2.4, Y - 15.7, 4.8, 1.4);
        }
        ctx.restore();
      }
      continue;
    }
    const moving = !(p.wait > 0) && p.path,
      sw = moving ? Math.sin(p.ph) * 2.2 : 0;
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(p.h); // +y = backwards, -y = the way we face
    ctx.scale(PED_SCALE, PED_SCALE);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(2, 2, 3.6, 2.6, 0, 0, 7);
    ctx.fill();
    // legs (bottoms colour) stride fore and aft, then arms swing opposite
    ctx.fillStyle = p.bot || "#2b2b33";
    ctx.fillRect(-2.1, -1.4 + sw, 1.7, 3.4);
    ctx.fillRect(0.4, -1.4 - sw, 1.7, 3.4);
    ctx.fillStyle = p.top || p.col;
    ctx.fillRect(-4.1, -0.9 - sw * 0.6, 1.3, 2.6);
    ctx.fillRect(2.8, -0.9 + sw * 0.6, 1.3, 2.6);
    ctx.fillStyle = p.skin || "#e0b48c";
    ctx.fillRect(-4.1, 1.3 - sw * 0.6, 1.3, 1);
    ctx.fillRect(2.8, 1.3 + sw * 0.6, 1.3, 1);
    ctx.fillStyle = p.top || p.col;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, 2.1, 0, 0, 7);
    ctx.fill();
    if (p.bag) {
      ctx.fillStyle = p.bag;
      ctx.fillRect(-2, 1.4, 4, 1.8);
    }
    ctx.fillStyle = p.skin || "#e0b48c";
    ctx.beginPath();
    ctx.arc(0, -0.2, 1.8, 0, 7);
    ctx.fill();
    if (p.style) {
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      if (p.style === 2) ctx.ellipse(0, 0.5, 1.9, 2.3, 0, 0, 7);
      else ctx.arc(0, 0.25, 1.65, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
}

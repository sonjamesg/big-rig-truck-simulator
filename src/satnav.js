/**
 * @file satnav.js — SAT NAV: A* over the road tiles, route guidance; world arrows follow a smoothed
 *   keep-left path (navSmoothPath / navSmoothAt, NAV_ARROW_SP spacing, none in junction boxes)
 * Exposes (globals): NAV, NAV_COST, NAV_SPEED, navUp, navTileInfo, isRoadT, navSnap,
 *   navSnapTruck, navAStar, navBuild, setRoute, clearRoute, navIsMission, userCancelRoute, mapPOIList,
 *   ftJobBlock (+36
 *   more)
 * Depends on: world.js, ltg.js (ltgPOI), lorry.js, physics.js, audio.js, traffic.js, depots.js, career.js, ui.js,
 *   mp.js, breakdown.js, owndepot.js, homes.js, rail.js, nightmap.js, main.js, police.js
 * Load order: #18 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== SAT NAV: A* over the road tiles, route guidance =====================
const NAV = { route: null, reroutes: 0, offT: 0, lastCalc: -9, hover: null };
const NAV_OFF = ["off", 1, 11];
const NAV_COST = {
  hwy: 0.55,
  dual: 0.7,
  rural: 0.9,
  city: 1.0,
  town: 1.0,
  res: 1.7,
  lane: 3.2,
  dirt: 2.6,
}; // lorry-legal: narrow lanes / estates heavily penalised
const NAV_SPEED = { hwy: 25, dual: 20, rural: 15, city: 11, town: 11, res: 8, lane: 7, dirt: 7 };
let navUp = null,
  navClosed = null,
  navG = null,
  navStamp = null,
  navFrom = null,
  navGen = 1;
function navTileInfo(i) {
  const h = world.roadH[i],
    v = world.roadV[i];
  if (h === -1 && v === -1) return null;
  if (h === -2) return ["rb", 0.8, 8];
  if (h === -3) return ["curve", 0.7, 20];
  const s = world.segs[h >= 0 ? h : v];
  return [s.type, NAV_COST[s.type] || 1, NAV_SPEED[s.type] || 11];
}
const isRoadT = (i) => {
  const t = G[i];
  return (t === T.ROAD || t === T.BRIDGE) && !(world.roadH[i] === -1 && world.roadV[i] === -1);
};
function navSnap(tx, ty, rmax) {
  tx = Math.round(tx);
  ty = Math.round(ty);
  for (let r = 0; r <= (rmax || 60); r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx,
          y = ty + dy;
        if (inb(x, y) && isRoadT(idx(x, y))) return [x, y];
      }
  return null;
}
// v14: snap the route start to the road the truck is actually on (never a nearby motorway / overpass it isn't using)
function navSnapTruck() {
  const t = truck,
    f = fwd(t.h);
  for (const d of [0, 2, -2, 4]) {
    const x = Math.floor((t.x + f[0] * d) / M_T),
      y = Math.floor((t.y + f[1] * d) / M_T);
    if (inb(x, y) && isRoadT(idx(x, y))) return [x, y];
  }
  // v15: breadth-first over drivable ground (no water/buildings/containers) to the nearest road tile the truck can actually reach
  const sx = Math.floor(t.x / M_T),
    sy = Math.floor(t.y / M_T);
  if (!inb(sx, sy)) return null;
  const seen = new Map(),
    q = [[sx, sy, 0]];
  seen.set(sx * 65536 + sy, 1);
  let best = null,
    bs = 1e9;
  for (let h = 0; h < q.length && h < 20000; h++) {
    const [x, y, d] = q[h];
    if (best && d > bs + 3) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = nx * 65536 + ny;
      if (!inb(nx, ny) || seen.has(k)) continue;
      seen.set(k, 1);
      const i = idx(nx, ny);
      if (isRoadT(i)) {
        const ti = navTileInfo(i),
          hw = ti && (ti[0] === "hwy" || ti[0] === "ramp"),
          fw = dx * f[0] + dy * f[1];
        const sc = d + 1 + (hw ? 30 : 0) + (G[i] === T.BRIDGE ? 8 : 0) - fw * 0.5;
        if (sc < bs) {
          bs = sc;
          best = [nx, ny];
        }
        continue;
      }
      if (SOLID[G[i]] || d > 40) continue;
      q.push([nx, ny, d + 1]);
    }
  }
  return best;
}
function navAStar(sx, sy, gx, gy) {
  const N = MW * MH;
  if (!navG) {
    navG = new Float32Array(N);
    navStamp = new Int32Array(N);
    navFrom = new Int32Array(N);
    navClosed = new Int32Array(N);
  }
  if (!navUp) navUp = new Uint8Array(N);
  const FF = world.foF;
  const gen = ++navGen,
    S = idx(sx, sy),
    Gl = idx(gx, gy);
  const hx = (i) => (Math.abs((i % MW) - gx) + Math.abs(((i / MW) | 0) - gy)) * 0.9;
  let hp = [],
    hf = [];
  const push = (i, f) => {
    hp.push(i);
    hf.push(f);
    let k = hp.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hf[p] <= hf[k]) break;
      {
        const a = hp[p];
        hp[p] = hp[k];
        hp[k] = a;
        const b = hf[p];
        hf[p] = hf[k];
        hf[k] = b;
      }
      k = p;
    }
  };
  const pop = () => {
    const top = hp[0],
      li = hp.pop(),
      lf = hf.pop();
    if (hp.length) {
      hp[0] = li;
      hf[0] = lf;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1,
          r = l + 1;
        let m = k;
        if (l < hp.length && hf[l] < hf[m]) m = l;
        if (r < hp.length && hf[r] < hf[m]) m = r;
        if (m === k) break;
        {
          const a = hp[m];
          hp[m] = hp[k];
          hp[k] = a;
          const b = hf[m];
          hf[m] = hf[k];
          hf[k] = b;
        }
        k = m;
      }
    }
    return top;
  };
  navStamp[S] = gen;
  navG[S] = 0;
  navFrom[S] = -1;
  navUp[S] = 0;
  push(S, hx(S));
  let it = 0;
  while (hp.length) {
    const i = pop();
    if (navClosed[i] === gen) continue;
    navClosed[i] = gen;
    if (i === Gl) break;
    if (++it > 4000000) {
      NAV.lastIt = it;
      return null;
    }
    const gi = navG[i],
      ci = (navTileInfo(i) || NAV_OFF)[1]; // v50: a start tile on tarmac but off every segment (curve mouth) no longer throws
    for (const d of [1, -1, MW, -MW]) {
      let j = i + d,
        k = 1;
      if (j < 0 || j >= N) continue;
      // small gaps (roundabout aprons, junction mouths drawn as kerb/grass): hop up to 5 tiles straight across
      if (!isRoadT(j)) {
        if (world.roadH[i] === -1 && world.roadV[i] === -1) continue;
        for (k = 2; k <= 6; k++) {
          j = i + d * k;
          if (j < 0 || j >= N || Math.abs((j % MW) - (i % MW)) > 6) {
            j = -1;
            break;
          }
          if (isRoadT(j)) break;
        }
        if (j < 0 || k > 6 || !isRoadT(j)) continue;
        const Gj = G[i + d];
        if (Gj === T.WATER || Gj === T.BLDG) continue;
      }
      let up = 0;
      if (FF && (FF[i] || FF[j])) {
        const r = foNavStep(i, j, d, k, FF);
        if (r < 0) continue;
        up = r;
      }
      const nc = gi + (ci + navTileInfo(j)[1]) * 0.5 * k + (k > 1 ? k * 0.6 : 0);
      if (navClosed[j] !== gen && (navStamp[j] !== gen || nc < navG[j])) {
        navStamp[j] = gen;
        navG[j] = nc;
        navFrom[j] = i;
        navUp[j] = up;
        push(j, nc + hx(j));
      }
    }
  }
  NAV.lastIt = it;
  if (navStamp[Gl] !== gen) return null;
  const rp = [];
  for (let i = Gl; i !== -1; i = navFrom[i]) rp.push(i);
  rp.reverse();
  const path = [rp[0]];
  for (let k = 1; k < rp.length; k++) {
    const a = rp[k - 1],
      b = rp[k],
      d = b - a,
      st = Math.abs(d) < MW ? Math.sign(d) : Math.sign(d) * MW;
    if (Math.abs(d) !== 1 && Math.abs(d) !== MW)
      for (let j = a + st; j !== b; j += st) path.push(j);
    path.push(b);
  }
  return path;
}
function navBuild(path, target) {
  const P = path.map((i) => [((i % MW) + 0.5) * M_T, (((i / MW) | 0) + 0.5) * M_T]),
    n = P.length,
    cum = new Float32Array(n),
    eta = new Float32Array(n);
  // v31: through a roundabout the route follows the AI's clockwise lane (outer for 1st exit, middle ahead, inner beyond)
  for (let k = 0; k < n; k++) {
    if (world.roadH[path[k]] !== -2) continue;
    let k1 = k;
    while (k1 + 1 < n && world.roadH[path[k1 + 1]] === -2) k1++;
    const rb = rbAtTile(path[k] % MW, (path[k] / MW) | 0);
    if (rb && k > 0 && k1 < n - 1) {
      const C = [rb.cx * M_T, rb.cy * M_T],
        A = P[k - 1],
        B = P[k1 + 1],
        a0 = Math.atan2(A[1] - C[1], A[0] - C[0]),
        a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
      let dl = a1 - a0;
      while (dl < 0.3) dl += Math.PI * 2;
      while (dl > Math.PI * 2 + 0.3) dl -= Math.PI * 2;
      const Rm = rbLaneR(rb, dl) * M_T,
        m = k1 - k + 1;
      for (let q = 0; q < m; q++) {
        const t = (q + 1) / (m + 1),
          sp = Math.sin(Math.PI * t),
          rr = Rm * sp + rb.rout * M_T * (1 - sp),
          a = a0 + dl * t;
        P[k + q] = [C[0] + Math.cos(a) * rr, C[1] + Math.sin(a) * rr];
      }
    }
    k = k1;
  }
  for (let k = 1; k < n; k++) {
    cum[k] = cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
  }
  for (let k = n - 2; k >= 0; k--)
    eta[k] = eta[k + 1] + (cum[k + 1] - cum[k]) / (navTileInfo(path[k]) || [0, 0, 11])[2];
  // turn instructions: heading change over a +/-4 tile window, local maxima only
  const turns = [];
  const W = 4;
  let lastK = -99;
  const hd = (a, b) => Math.atan2(P[b][0] - P[a][0], -(P[b][1] - P[a][1]));
  for (let k = W; k < n - W; k++) {
    const d = wrapA(hd(k, k + W) - hd(k - W, k));
    if (Math.abs(d) < 0.7) continue;
    let mx = true;
    for (let q = k - 3; q <= k + 3; q++)
      if (
        q !== k &&
        q >= W &&
        q < n - W &&
        Math.abs(wrapA(hd(q, q + W) - hd(q - W, q))) > Math.abs(d)
      )
        mx = false;
    if (!mx || k - lastK < 8) continue;
    let rb = false;
    for (let q = k - 6; q <= k + 6; q++)
      if (q >= 0 && q < n && world.roadH[path[q]] === -2) rb = true;
    if (
      rb &&
      turns.length &&
      turns[turns.length - 1].kind === "rb" &&
      k - turns[turns.length - 1].k < 40
    )
      continue;
    turns.push({ k, kind: rb ? "rb" : Math.abs(d) > 2.4 ? "u" : d > 0 ? "R" : "L", ang: d });
    lastK = k;
  }
  turns.push({ k: n - 1, kind: "arrive" });
  return { target, path, P, cum, eta, turns, idx: 0, len: cum[n - 1] };
}
function setRoute(target) {
  if (!NAV._restoring) NAV.missOff = null;
  let tx, ty, name;
  if (typeof target === "string") {
    const d = world.depots.find((o) => o.id === target || o.code === target),
      f = world.fuel.find((o) => o.id === target),
      g = world.garages.find((o) => o.id === target);
    target = d || f || g;
    if (!target) return null;
  }
  if (target.entrance) {
    const ne = target.navE || target.entrance; // v66: private-road yards route to the mouth on the public road
    tx = ne.x / M_T;
    ty = ne.y / M_T;
    name = target.name;
  } else {
    tx = target.x / M_T;
    ty = target.y / M_T;
    name = target.name || target.label || "Map point";
  }
  const tgt = { x: tx * M_T, y: ty * M_T, name, ref: target };
  const st = navSnapTruck(),
    en = navSnap(tx, ty, 70);
  if (!st || !en) {
    NAV.fail = !st ? "snapStart" : "snapEnd";
    flash("Sat nav: no road route found");
    return null;
  }
  const t0 = performance.now();
  const p = navAStar(st[0], st[1], en[0], en[1]);
  if (!p) {
    NAV.fail = "astar";
    flash("Sat nav: no road route found");
    return null;
  }
  NAV.route = navBuild(p, tgt);
  NAV.route.ms = performance.now() - t0;
  NAV.offT = 0;
  NAV.lastCalc = timeS;
  BigRig.emit("route", { target: tgt, length: NAV.route.len, ms: NAV.route.ms });
  return NAV.route;
}
function clearRoute() {
  NAV.route = null;
}
// player-facing cancel (✕ chip, map button, X key, RB-hold): custom routes clear at once; a mission route needs a second tap within 4 s and then stays hidden until the mission target changes
function navIsMission() {
  try {
    const t = typeof missionTarget === "function" && missionTarget();
    return !!(t && NAV.route && NAV.route.target && NAV.route.target.name === t.name);
  } catch (e) {
    return false;
  }
}
function userCancelRoute() {
  if (!NAV.route) return;
  if (navIsMission()) {
    if (!(NAV.cfmT != null && timeS - NAV.cfmT < 4)) {
      NAV.cfmT = timeS;
      flash("Mission route \u2022 press \u2715 again to hide it (the job stays active)");
      return;
    }
    NAV.missOff = NAV.route.target.name;
    NAV.cfmT = null;
    clearRoute();
    flash("Mission route hidden \u2022 set it again from the map");
    return;
  }
  clearRoute();
  flash("Route cancelled");
}
function chime() {
  const c = audio.ctx;
  if (!c) return;
  const t = c.currentTime;
  [
    [880, 0],
    [1175, 0.16],
    [1568, 0.32],
  ].forEach(([f, dt]) => {
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + dt);
    g.gain.exponentialRampToValueAtTime(0.25, t + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.5);
    o.connect(g);
    g.connect(audio.master);
    o.start(t + dt);
    o.stop(t + dt + 0.55);
  });
}
function updateNav(dt) {
  const R = NAV.route;
  if (!R) return;
  const f = fwd(truck.h),
    cx = truck.x + f[0] * 2,
    cy = truck.y + f[1] * 2;
  let best = R.idx,
    bd = 1e9;
  const a = Math.max(0, R.idx - 20),
    b = Math.min(R.P.length - 1, R.idx + 120);
  for (let k = a; k <= b; k++) {
    const d = Math.hypot(R.P[k][0] - cx, R.P[k][1] - cy);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  if (bd > 40) {
    for (let k = 0; k < R.P.length; k += 3) {
      const d = Math.hypot(R.P[k][0] - cx, R.P[k][1] - cy);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
  }
  R.idx = Math.max(R.idx, best);
  R.off = bd;
  if (Math.hypot(R.target.x - cx, R.target.y - cy) < 30 || (R.len - R.cum[R.idx] < 25 && bd < 25)) {
    if (!R.arrived) {
      R.arrived = 1;
      flash("You have arrived: " + R.target.name);
      BigRig.emit("routeArrived", { target: R.target });
    }
    const ca = typeof career !== "undefined" && career.active;
    if (!(ca && (ca.phase === "pickup" || ca.phase === "deliver" || ca.phase === "recouple"))) {
      NAV.route = null;
      return;
    }
    R.idx = Math.min(R.idx, R.P.length - 1);
  } // v33: on a mission the route stays up (reroutes back) until the step is done
  if (bd > 18 && Math.hypot(R.target.x - cx, R.target.y - cy) > 45) {
    NAV.offT += dt;
    if (NAV.offT > 1.0 && timeS - NAV.lastCalc > 1.5) {
      NAV.reroutes++;
      const tg = R.target;
      const nr = setRoute(tg.ref && tg.ref.name ? tg.ref : { x: tg.x, y: tg.y, name: tg.name });
      if (nr) {
        flash("Rerouting\u2026");
        BigRig.emit("reroute", { n: NAV.reroutes });
      }
    }
  } else NAV.offT = 0;
}
// UK keep-left: route drawn on the left-hand carriageway, lane picked for the next turn; one-way/slip roads stay centred on the lane
function navInJ(t) {
  return !!(world.jMask && world.jMask[t]);
}
function navRaw(R, k) {
  const n = R.P.length,
    a = R.P[Math.max(0, k - 2)],
    b = R.P[Math.min(n - 1, k + 2)],
    l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
    tx = (b[0] - a[0]) / l,
    ty = (b[1] - a[1]) / l,
    lx = ty,
    ly = -tx,
    p = R.P[k];
  if (R.oneway && R.oneway[k]) return 0;
  {
    const t = R.path && R.path[k];
    if (t != null && !navInJ(t)) {
      const hz = Math.abs(tx) >= Math.abs(ty),
        sid = hz ? world.roadH[t] : world.roadV[t];
      const sg = sid >= 0 ? world.segs[sid] : null; // v29: exact keep-left lane centre from the road segment (no width probing -> no swerves at junction mouths)
      if (sg && (sg.dir === "h") === hz) {
        const dir = (hz ? tx : ty) > 0 ? 1 : -1,
          nl = nLanes(sg);
        let lane = 0;
        const nt = R.turns.find((q) => q.k >= k && q.k - k < 12);
        if (nt && nt.kind === "R") lane = nl - 1;
        const along = (hz ? p[0] : p[1]) / M_T,
          q = lanePt(sg, dir, Math.min(lane, nl - 1), along);
        return (q[0] - p[0]) * lx + (q[1] - p[1]) * ly;
      }
    }
  }
  {
    const t = R.path && R.path[k];
    if (t != null && navInJ(t)) return NaN;
  }
  /* v29: in a junction box blend from approach/exit lanes (no loops) */ let dl = 0,
    dr = 0;
  while (dl < 16 && onRoadM(p[0] + lx * (dl + 0.5), p[1] + ly * (dl + 0.5))) dl += 0.5;
  while (dr < 16 && onRoadM(p[0] - lx * (dr + 0.5), p[1] - ly * (dr + 0.5))) dr += 0.5;
  const W = dl + dr;
  if (W < 4.5) return (dl - dr) / 2;
  const wl = W / 2,
    nL = Math.max(1, Math.round(wl / 3.5));
  let lane = 0;
  const nt = R.turns.find((t) => t.k >= k && t.k - k < 45 / (R.cum[1] - R.cum[0] || 2));
  if (nt && nt.kind === "R") lane = nL - 1;
  return dl - ((lane + 0.5) * wl) / nL;
}
function navOff(R, k) {
  if (!R.offC) {
    R.offC = new Float32Array(R.P.length).fill(NaN);
  }
  if (isNaN(R.offC[k])) {
    let s = 0,
      c = 0;
    for (let q = k - 4; q <= k + 4; q++) {
      if (q < 0 || q >= R.P.length) continue;
      if (!R.raw) R.raw = new Float32Array(R.P.length).fill(NaN);
      if (!R.rawS) R.rawS = new Uint8Array(R.P.length);
      if (!R.rawS[q]) {
        R.raw[q] = navRaw(R, q);
        R.rawS[q] = 1;
      }
      const w = R.raw[q];
      if (!Number.isNaN(w)) {
        s += w;
        c++;
      }
    }
    if (!c) {
      for (let q = k - 12; q <= k + 12; q += 1) {
        if (q < 0 || q >= R.P.length) continue;
        if (!R.rawS[q]) {
          R.raw[q] = navRaw(R, q);
          R.rawS[q] = 1;
        }
        const w = R.raw[q];
        if (!Number.isNaN(w)) {
          s += w * 0.6;
          c++;
        }
      }
    }
    R.offC[k] = c ? s / c : 0;
  }
  const n = R.P.length,
    a = R.P[Math.max(0, k - 2)],
    b = R.P[Math.min(n - 1, k + 2)],
    l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
    o = R.offC[k] || 0;
  return [R.P[k][0] + ((b[1] - a[1]) / l) * o, R.P[k][1] - ((b[0] - a[0]) / l) * o];
}
function navLine(px, py, w, col) {
  const R = NAV.route;
  if (!R) return;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = w + 3;
  ctx.beginPath();
  {
    const S = R.P[Math.min(R.idx, R.P.length - 1)];
    if (Math.hypot(S[0] - truck.x, S[1] - truck.y) <= 15) ctx.moveTo(px(truck.x), py(truck.y));
    else ctx.moveTo(px(S[0]), py(S[1]));
  }
  let lq = null;
  for (let k = R.idx; k < R.P.length; k += 2) {
    const Q = k - R.idx < 400 ? navOff(R, k) : R.P[k];
    if (!isFinite(Q[0]) || !isFinite(Q[1])) continue;
    if (lq && k + 2 < R.P.length) {
      const t0 = R.P[Math.max(0, k - 2)],
        t1 = R.P[k + 2];
      if ((Q[0] - lq[0]) * (t1[0] - t0[0]) + (Q[1] - lq[1]) * (t1[1] - t0[1]) <= 0) continue;
    }
    if (lq && Math.hypot(Q[0] - lq[0], Q[1] - lq[1]) > 20) ctx.moveTo(px(Q[0]), py(Q[1]));
    else ctx.lineTo(px(Q[0]), py(Q[1]));
    lq = Q;
  }
  const e = R.P[R.P.length - 1];
  ctx.lineTo(px(e[0]), py(e[1]));
  ctx.stroke();
  if (typeof nmK === "function" && nmK() > 0.05) {
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.fillStyle = "#ff3df0";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px(R.target.x), py(R.target.y), 6, 0, 7);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
// v48: smoothed route centreline for the painted arrows: keep-left offset points (navOff), [1,2,3,2,1] smoothing passes
// so tile stair-steps round off, then regular arc-length sampling with headings from the smoothed tangent
function navSmoothPath(R, k0, k1) {
  let P = [];
  for (let k = k0; k <= k1; k++) {
    const q = navOff(R, k);
    if (isFinite(q[0]) && isFinite(q[1])) P.push([q[0], q[1], k]);
  }
  for (let pass = 0; pass < 4; pass++) {
    const O = P.map((p) => p.slice());
    for (let i = 2; i < P.length - 2; i++)
      for (let j = 0; j < 2; j++)
        O[i][j] = (P[i - 2][j] + 2 * P[i - 1][j] + 3 * P[i][j] + 2 * P[i + 1][j] + P[i + 2][j]) / 9;
    P = O;
  }
  const S = [0];
  for (let i = 1; i < P.length; i++)
    S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { P, S };
}
function navSmoothAt(L, s) {
  const { P, S } = L;
  let i = 1;
  while (i < S.length - 1 && S[i] < s) i++;
  const t = Math.max(0, Math.min(1, (s - S[i - 1]) / (S[i] - S[i - 1] || 1)));
  return [
    P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t,
    P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t,
    t < 0.5 ? P[i - 1][2] : P[i][2],
  ];
}
const NAV_ARROW_SP = 11; // m between painted arrows
function drawNavWorld() {
  const R = NAV.route;
  if (!R) return;
  const end = Math.min(R.P.length - 1, R.idx + 110);
  if (end - R.idx < 6) return;
  const L = navSmoothPath(R, R.idx, end),
    tot = L.S[L.S.length - 1];
  if (L.P.length < 6) return;
  const s0 = NAV_ARROW_SP - (R.cum[L.P[0][2]] % NAV_ARROW_SP);
  for (let s = s0; s < tot - 6; s += NAV_ARROW_SP) {
    if (s < 6) continue;
    const p = navSmoothAt(L, s),
      a1 = navSmoothAt(L, s - 3),
      b1 = navSmoothAt(L, s + 3),
      a2 = navSmoothAt(L, s - 7),
      b2 = navSmoothAt(L, s + 7);
    const t = R.path && R.path[p[2]];
    if (t != null && navInJ(t)) continue; // never in a junction box (stair-steps)
    const h = Math.atan2(b1[0] - a1[0], -(b1[1] - a1[1])),
      hA = Math.atan2(p[0] - a2[0], -(p[1] - a2[1])),
      hB = Math.atan2(b2[0] - p[0], -(b2[1] - p[1]));
    if (Math.abs(wrapA(hB - hA)) > 0.75) continue; // too sharp a kink to say which way the lane runs
    const a = 0.8 * Math.min(1, s / 18);
    ctx.save();
    ctx.translate(p[0] * PPM, p[1] * PPM);
    ctx.rotate(h);
    ctx.fillStyle = "rgba(60,210,255," + a.toFixed(2) + ")";
    ctx.strokeStyle = "rgba(0,40,70," + (a * 0.6).toFixed(2) + ")";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(13, 4);
    ctx.lineTo(6, 4);
    ctx.lineTo(0, -4);
    ctx.lineTo(-6, 4);
    ctx.lineTo(-13, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
const NAVP = { x: 960 - 252, y: 56, w: 236, h: 96 };
function fmtD(m) {
  return m >= 1000
    ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + " km"
    : Math.round(m / 10) * 10 + " m";
}
function drawTurnIcon(kind, ang, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "arrive") {
    ctx.beginPath();
    ctx.arc(0, -6, 10, 0, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.lineTo(0, 18);
    ctx.lineTo(6, 6);
    ctx.fill();
  } else if (kind === "rb") {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 4, 10, 0, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(0, 14);
    ctx.stroke();
    const a = Math.PI / 2 + (ang || 0) - Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 10, 4 + Math.sin(a) * 10);
    ctx.lineTo(Math.cos(a) * 20, 4 + Math.sin(a) * 20);
    ctx.stroke();
  } else {
    const s = kind === "L" ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(-s * 4, 20);
    ctx.lineTo(-s * 4, 0);
    if (kind === "u") {
      ctx.arc(s * 4, 0, 8, Math.PI, 0, s > 0);
      ctx.lineTo(s * 12, 12);
    } else {
      ctx.quadraticCurveTo(-s * 4, -8, s * 12, -8);
    }
    ctx.stroke();
    ctx.beginPath();
    if (kind === "u") {
      ctx.moveTo(s * 12, 20);
      ctx.lineTo(s * 5, 10);
      ctx.lineTo(s * 19, 10);
    } else {
      ctx.moveTo(s * 18, -8);
      ctx.lineTo(s * 9, -16);
      ctx.lineTo(s * 9, 0);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function drawNavHUD() {
  const R = NAV.route;
  if (!R) return;
  const { x, y, w, h } = NAVP;
  const nt = R.turns.find((t) => t.k > R.idx + 1) || R.turns[R.turns.length - 1];
  const dTurn = Math.max(0, R.cum[nt.k] - R.cum[R.idx]),
    dTot = Math.max(0, R.len - R.cum[R.idx]),
    eta = R.eta[R.idx];
  ctx.save();
  ctx.fillStyle = "rgba(10,14,22,0.85)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, 12) : ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.fillStyle = "#1e88e5";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x + 8, y + 8, 64, 64, 10) : ctx.rect(x + 8, y + 8, 64, 64);
  ctx.fill();
  drawTurnIcon(nt.kind, nt.ang, x + 40, y + 38);
  {
    const cx = x + w - 19,
      cy = y + 19,
      m = navIsMission();
    ctx.fillStyle = m ? "rgba(120,130,145,0.9)" : "rgba(214,48,49,0.92)";
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - 4.5, cy - 4.5);
    ctx.lineTo(cx + 4.5, cy + 4.5);
    ctx.moveTo(cx + 4.5, cy - 4.5);
    ctx.lineTo(cx - 4.5, cy + 4.5);
    ctx.stroke();
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 26px system-ui,sans-serif";
  ctx.fillText(fmtD(dTurn), x + 82, y + 36);
  ctx.font = "12px system-ui,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(
    { L: "Turn left", R: "Turn right", u: "U-turn", rb: "At the roundabout", arrive: "Arrive" }[
      nt.kind
    ],
    x + 82,
    y + 56,
  );
  ctx.fillStyle = "#7fdcff";
  ctx.font = "bold 12px system-ui,sans-serif";
  const m = Math.max(1, Math.round(eta / 60));
  ctx.fillText(fmtD(dTot) + " \u2022 ETA " + m + " min", x + 10, y + 88);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "11px system-ui,sans-serif";
  const nm = R.target.name.length > 20 ? R.target.name.slice(0, 19) + "\u2026" : R.target.name;
  ctx.textAlign = "right";
  ctx.fillText("\u2192 " + nm, x + w - 10, y + 88);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x + w - 30, y + 8, 22, 22);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 13px system-ui";
  ctx.fillText("\u2715", x + w - 19, y + 23);
  if (R.off > 22) {
    ctx.fillStyle = "#ffb020";
    ctx.textAlign = "left";
    ctx.fillText("Off route", x + 82, y + 14);
  }
  ctx.restore();
}
function navPanelClick(x, y) {
  if (
    NAV.route &&
    x >= NAVP.x + NAVP.w - 40 &&
    x <= NAVP.x + NAVP.w + 4 &&
    y >= NAVP.y - 4 &&
    y <= NAVP.y + 36
  ) {
    userCancelRoute();
    return true;
  }
  return false;
}
// big-map icon hit test
// icon radius on the big map grows with zoom (canvas px), clamped
function mapIconR(z) {
  return Math.max(7, Math.min(18, 5 + 2.2 * z));
}
// hit radius: icon + margin, and at least ~44 CSS px across on touch screens
function mapHitR() {
  const r = mapIconR(bigmap.z) + 5;
  if (!document.body.classList.contains("touch")) return Math.max(11, r);
  const cw = cv.getBoundingClientRect().width || VW;
  return Math.max(r, (22 * VW) / cw);
}
let RAIL_POI = null;
function railPOIs() {
  if (typeof RAIL === "undefined" || !RAIL.ready) return [];
  if (!RAIL_POI || RAIL_POI.length !== RAIL.stations.length)
    RAIL_POI = RAIL.stations.map((st) => ({
      name: st.name + (st.kind === "hub" ? "" : " station"),
      st,
      x: RAIL.X[st.s],
      y: RAIL.Y[st.s],
      entrance: { x: RAIL.X[st.s], y: RAIL.Y[st.s] },
    }));
  return RAIL_POI;
}
// v50: every clickable big-map icon, from the same live data the icons are drawn from (drawPOIs / bmMapIcons / hlDrawMap /
// railBigMap): cb(o, mx, my, kind) with the icon's position in metres. navPOIAt, fast travel and tests/fasttravel_poi_test.py use it.
function mapPOIList(cb) {
  for (const s of railPOIs()) cb(s, s.x, s.y, "Station");
  if (typeof hidePOIs === "function") for (const h of hidePOIs()) cb(h, h.x, h.y, "Hide box");
  for (const d of world.depots)
    cb(d, d.entrance.x, d.entrance.y, /Port/.test(d.name) ? "Port" : "Depot");
  for (const f of world.fuel) cb(f, f.x, f.y, "Fuel");
  for (const g of world.garages) cb(g, g.x, g.y, "Garage");
  for (const m of world.malls || [])
    cb(m, m.entrance.x, m.entrance.y, m.kind === "mall" ? "Mall" : "Supermarket");
  for (const d of world.dealers || []) cb(d, d.entrance.x, d.entrance.y, "Truck dealer");
  for (const y of world.forSale || [])
    cb(
      y,
      y.entrance.x,
      y.entrance.y,
      typeof ownedYard === "function" && ownedYard(y) ? "Your yard" : "Yard for sale",
    );
  if (typeof SVC !== "undefined")
    for (const s of SVC.list) cb(s, s.entrance.x, s.entrance.y, SVC_ICON[s.type][2]);
  if (typeof homePOIs === "function") homePOIs(cb);
  if (typeof bmPOIs === "function") bmPOIs(cb);
  if (typeof hlMapPOIs === "function") hlMapPOIs(cb);
  {
    const p = ltgPOI();
    cb(p, p.x, p.y, "Training ground");
  }
  if (typeof mbMapPOI === "function") {
    const b = mbMapPOI();
    if (b) cb(b, b.x, b.y, "Military base");
  }
}
function navPOIAt(x, y, BX, BY) {
  let best = null,
    bd = mapHitR();
  mapPOIList((o, mx, my, kind) => {
    const d = Math.hypot(BX(mx / M_T) - x, BY(my / M_T) - y);
    if (d < bd) {
      bd = d;
      best = { o, kind, name: o.name, x: mx, y: my };
    }
  });
  if (best && best.o.brand) best.name = best.o.brand.name;
  return best;
}
BigRig.setRoute = setRoute;
BigRig.clearRoute = clearRoute;
BigRig.route = () =>
  NAV.route && {
    target: NAV.route.target,
    length: NAV.route.len,
    remaining: NAV.route.len - NAV.route.cum[NAV.route.idx],
    turns: NAV.route.turns.length,
    reroutes: NAV.reroutes,
  };
BigRig._navDiag = function (target) {
  const N = MW * MH;
  const r = setRoute(target);
  if (r) return "ok";
  const gen = navGen;
  const A = (i) => navStamp[i] === gen;
  const e = target.navE || target.entrance || target,
    E = navSnap(e.x / M_T, e.y / M_T, 70);
  const seen = new Uint8Array(N),
    s0 = idx(E[0], E[1]);
  const q = [s0];
  seen[s0] = 1;
  let n = 0;
  while (q.length) {
    const i = q.pop();
    n++;
    for (const d of [1, -1, MW, -MW]) {
      const j = i + d;
      if (j >= 0 && j < N && !seen[j] && isRoadT(j)) {
        seen[j] = 1;
        q.push(j);
      }
    }
  }
  let best = [99];
  for (let i = 0; i < N; i++)
    if (seen[i] && i % 2 === 0) {
      const x = i % MW,
        y = (i / MW) | 0;
      for (let dy = -25; dy <= 25; dy++)
        for (let dx = -25; dx <= 25; dx++) {
          const j = i + dx + dy * MW;
          if (j >= 0 && j < N && A(j)) {
            const dd = Math.hypot(dx, dy);
            if (dd < best[0]) best = [dd, x, y, x + dx, y + dy];
          }
        }
    }
  if (best.length > 1) {
    const L = [];
    const m = Math.ceil(best[0]);
    for (let k = 0; k <= m; k++) {
      const x = Math.round(best[1] + ((best[3] - best[1]) * k) / m),
        y = Math.round(best[2] + ((best[4] - best[2]) * k) / m);
      L.push(G[idx(x, y)] + "/" + world.roadH[idx(x, y)] + "/" + world.roadV[idx(x, y)]);
    }
    best.push(L);
  }
  return { endN: n, gap: best };
};
// ===================== FAST TRAVEL (free): big-map depot tooltip -> spawn in that depot's yard facing the exit =====================
function ftClear(x, y, h, trl) {
  const f = fwd(h),
    r = rgt(h),
    s0 = trl ? -12.3 : -1.4;
  for (let s = s0; s <= 5.2; s += 0.8)
    for (const w of [-1.4, 0, 1.4]) {
      const px = x + f[0] * s + r[0] * w,
        py = y + f[1] * s + r[1] * w;
      if (solidAtM(px, py)) return false;
      for (const t of world.trailers) {
        if (t === trl) continue;
        const tf = fwd(t.th);
        for (let q = -1.2; q <= 12.4; q += 1.5) {
          if (Math.hypot(t.x - tf[0] * q - px, t.y - tf[1] * q - py) < 2.2) return false;
        }
      }
    }
  return true;
}
function ftSpot(dp) {
  const trl = truck.trl,
    ex = dp.entrance.x,
    ey = dp.entrance.y,
    cands = [];
  for (let j = dp.y + 1; j < dp.y + dp.h - 5; j += 0.5)
    for (let i = dp.x + 1; i < dp.x + dp.w - 1; i += 0.5) {
      const x = i * M_T,
        y = j * M_T,
        h = Math.atan2(ex - x, -(ey - y)),
        hs = Math.round(h / (Math.PI / 2)) * (Math.PI / 2);
      cands.push([
        Math.hypot(ex - x, ey - y) - 3 * Math.abs(i - (dp.x + dp.w / 2)) * M_T,
        x,
        y,
        hs,
      ]);
    }
  cands.sort((a, b) => b[0] - a[0]); // furthest from the gate first, so the whole rig sits inside the yard
  for (const [, x, y, h] of cands) {
    if (ftClear(x, y, h, trl)) {
      const f = fwd(h);
      if (trl) {
        const rx = x - f[0] * 12.3,
          ry = y - f[1] * 12.3;
        if (
          rx < dp.x * M_T ||
          rx > (dp.x + dp.w) * M_T ||
          ry < dp.y * M_T ||
          ry > (dp.y + dp.h - 5) * M_T
        )
          continue;
      }
      return { x, y, h };
    }
  }
  // no room in the yard: line the trailer up in a free bay, cab facing out
  for (const b of dp.bays) {
    if (b.trailer) continue;
    const h = b.th || 0,
      f = fwd(h);
    return { x: b.kx - f[0] * 0.3, y: b.ky - f[1] * 0.3, h, bay: true };
  }
  return null;
}
// generic: nearest clear spot in the LEFT-hand (kerbside) lane of a straight segment, facing the way that lane's traffic flows (UK),
// with the whole rig (cab + trailer) on that segment's own tiles, clear of junctions, buildings, trailers and AI traffic
function rigHeading(sg, dir) {
  return sg.dir === "h" ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? Math.PI : 0;
}
function ftRoadSpot(mx, my) {
  const trl = truck.trl,
    back = trl ? 15 : 5,
    front = 6,
    C = [];
  const inMB = typeof mbInside === "function" && mbInside(mx / M_T, my / M_T);
  for (const sg of world.segs) {
    if (!sg || sg.b1 - sg.b0 < (back + front) / M_T + 6) continue;
    if (sg.mil && !inMB) continue; // v50: never drop the rig behind the base fence for an outside place
    const lat = (sg.a + sg.w / 2) * M_T;
    const lo = sg.b0 * M_T,
      hi = (sg.b1 + 1) * M_T,
      t = Math.max(lo, Math.min(hi, sg.dir === "h" ? mx : my));
    const d0 =
      Math.abs((sg.dir === "h" ? my : mx) - lat) + Math.abs((sg.dir === "h" ? mx : my) - t);
    if (d0 < 2500) C.push([d0, sg]);
  }
  C.sort((a, b) => a[0] - b[0]);
  // v50: first clear spot on each of the nearest segments, keep the one closest to the target (was: first segment only,
  // which could put the rig 20+ tiles along a road when a closer street was right beside the place)
  let best = null,
    bd = 1e9;
  for (const [d0, sg] of C) {
    if (d0 > bd * 1.5) break;
    const tgt = (sg.dir === "h" ? mx : my) / M_T,
      opts = [];
    for (let al = sg.b0 + 2; al <= sg.b1 - 1; al += 1) opts.push(al + 0.5);
    opts.sort((a, b) => Math.abs(a - tgt) - Math.abs(b - tgt));
    let found = null;
    for (const al of opts) {
      if (Math.abs(al - tgt) * M_T > bd) break;
      for (const dir of [1, -1]) {
        const p = rigLaneOK(sg, dir, al, back, front, trl);
        if (p) {
          const d = Math.hypot(p.x - mx, p.y - my);
          if (d < bd) {
            bd = d;
            best = p;
          }
          found = p;
        }
      }
      if (found) break;
    }
  }
  return best;
}
function rigLaneOK(sg, dir, al, back, front, trl) {
  const r0 = al - (dir * back) / M_T,
    r1 = al + (dir * front) / M_T,
    A = Math.min(r0, r1),
    B = Math.max(r0, r1);
  if (A < sg.b0 + 1 || B > sg.b1) return null;
  for (const J of sg.js) {
    const [a, b] = jRange(sg, J);
    if (B > a - 4 && A < b + 4) return null;
  }
  const lane = 0,
    lat = laneLat(sg, dir, lane);
  for (let q = Math.floor(A); q <= Math.floor(B); q++)
    for (let k = 0; k < sg.w; k++) {
      const x = sg.dir === "h" ? q : sg.a + k,
        y = sg.dir === "h" ? sg.a + k : q;
      if (!inb(x, y)) return null;
      const i = idx(x, y);
      if ((sg.dir === "h" ? world.roadH[i] : world.roadV[i]) !== sg.id) return null;
      if (world.roadH[i] >= 0 && world.roadV[i] >= 0) return null;
    }
  const p = lanePt(sg, dir, lane, al),
    h = rigHeading(sg, dir);
  if (!ftClear(p[0], p[1], h, trl)) return null;
  if (typeof traffic !== "undefined")
    for (const v of traffic.vs) {
      const ap = sg.dir === "h" ? v.x / M_T : v.y / M_T,
        lt = sg.dir === "h" ? v.y / M_T : v.x / M_T;
      if (Math.abs(lt - (lat + 0.5)) < 1.2 && ap > A - 6 && ap < B + 6) return null;
    }
  return { x: p[0], y: p[1], h, seg: sg.id, dir, lane };
}
// put the rig at a pose: cab, trailer lined up straight behind it, AI cars cleared out of the rig's footprint
function rigPlace(p) {
  const s = truck;
  if (typeof trigReset === "function") trigReset(); // no popup for the trigger we land on
  s.x = p.x;
  s.y = p.y;
  s.h = s.th = p.h;
  s.v = 0;
  s.steer = 0;
  if (s.vx !== undefined) {
    s.vx = 0;
    s.vy = 0;
  }
  if (s.av !== undefined) s.av = 0;
  if (s.trl) {
    const k = kingpin(s);
    s.trl.th = p.h;
    if (k) {
      s.trl.x = k[0];
      s.trl.y = k[1];
    }
    if (s.trl.v !== undefined) s.trl.v = 0;
  }
  if (typeof traffic !== "undefined") {
    const f = fwd(p.h);
    for (let n = traffic.vs.length - 1; n >= 0; n--) {
      const v = traffic.vs[n];
      for (let q = -16; q <= 8; q += 2)
        if (Math.hypot(v.x - (p.x + f[0] * q), v.y - (p.y + f[1] * q)) < 4.5) {
          traffic.vs.splice(n, 1);
          traffic.despawned++;
          break;
        }
    }
  }
  if (typeof cam !== "undefined") {
    cam.x = p.x * PPM;
    cam.y = p.y * PPM;
  }
}
BigRig.rigPlace = rigPlace;
BigRig.ftRoadSpot = ftRoadSpot;
function ftFee(o) {
  const e = o.entrance || o,
    km = Math.hypot(e.x - truck.x, e.y - truck.y) / 1000;
  return Math.round(25 + 8 * km);
}
// rules: stopped, not broken down, not carrying a job's cargo (deliver/unloading/recouple), can afford the fee
function ftStill() {
  const s = truck;
  if (Math.abs(s.v) < 1.35) {
    s.v = 0;
    if (s.vx !== undefined) {
      s.vx = 0;
      s.vy = 0;
    }
    if (s.trl) s.trl.v = 0;
    return true;
  }
  return false;
} // v29: under ~3 mph just stop and go (residual creep used to block it)
// v50: no fast travel during any job (career job, Black Market job / heist) or any wanted level / chase
const FT_JOB_MSG = "Fast travel unavailable during a job";
function ftJobBlock() {
  if (typeof career !== "undefined" && career.active) return FT_JOB_MSG;
  if (typeof BM !== "undefined" && BM.act) return FT_JOB_MSG;
  if (typeof WANT !== "undefined" && (WANT.lvl || (typeof POL !== "undefined" && POL.chase)))
    return FT_JOB_MSG;
  return null;
}
BigRig.ftJobBlock = ftJobBlock;
function ftBlock(o, peek) {
  const s = truck;
  const jb = ftJobBlock();
  if (jb) return jb;
  const bmb = typeof bmBlockFT === "function" && bmBlockFT();
  if (bmb) return bmb;
  if (o && o.hide) return "No fast travel to hide boxes \u2014 use sat nav and drive there";
  if (Math.abs(s.v) >= 1.35)
    return (
      "Fast travel: slow down and stop first (you\u2019re doing " +
      Math.round(Math.abs(s.v) * 2.237) +
      " mph)"
    );
  if (!peek) ftStill();
  if (typeof BREAKDOWN !== "undefined" && BREAKDOWN.active)
    return "Fast travel unavailable while broken down";
  const f = ftFee(o);
  if (s.money < f) return "Fast travel costs \u00a3" + f + " \u2014 not enough money";
  return null;
}
// where fast travel puts the rig: inside a depot / yard (tile rect), else the nearest kerbside lane to the map icon
// (at = the icon position {x,y} in metres from mapPOIList / navPOIAt; defaults to the entrance)
function ftTarget(dp, at) {
  const e = at && at.x !== undefined ? at : dp.entrance || dp;
  if (dp.x0 !== undefined && dp.w) {
    const p = ftSpot({ x: dp.x0, y: dp.y0, w: dp.w, h: dp.h, entrance: e, bays: dp.bays });
    if (p) return p;
  } // haulage yards store x/y in metres, rect in x0/y0 tiles
  else if (
    dp.bays &&
    dp.x !== undefined &&
    dp.w &&
    Math.abs(dp.x * M_T - e.x) < (dp.w + 40) * M_T
  ) {
    const p = ftSpot(dp);
    if (p) return p;
  }
  const q = ftPlaceSpot(dp);
  if (q) return q;
  const r = ftRoadSpot(e.x, e.y),
    c = ftCurveSpot(e.x, e.y, r ? Math.hypot(r.x - e.x, r.y - e.y) : 1e9);
  return c || r;
}
// v50: kerbside lane of a curved road (world.curves polylines, tiles) when it is closer than any straight segment
// (stations / pads beside bends); the rig sits on the chord between two polyline points, wholly on road, clear of solids
function ftCurveSpot(mx, my, lim) {
  const trl = truck.trl,
    back = trl ? 15 : 5,
    tx = mx / M_T,
    ty = my / M_T;
  let best = null,
    bd = lim;
  for (const cv of world.curves || []) {
    const P = cv.pts,
      off = (cv.w / 4) * M_T;
    for (let k = 1; k < P.length - 1; k++) {
      const dd = Math.hypot(P[k][0] - tx, P[k][1] - ty) * M_T;
      if (dd - off > bd) continue;
      for (const sd of [1, -1]) {
        const a = P[k - sd] || P[k],
          b = P[k + sd] || P[k],
          h = Math.atan2(b[0] - a[0], -(b[1] - a[1])),
          f = fwd(h),
          rr = rgt(h),
          x = P[k][0] * M_T - rr[0] * off,
          y = P[k][1] * M_T - rr[1] * off,
          d = Math.hypot(x - mx, y - my);
        if (d >= bd) continue;
        let ok = true;
        for (let q = -back; q <= 6 && ok; q += 1)
          for (const w of [-1.2, 1.2]) {
            const px = x + f[0] * q + rr[0] * w,
              py = y + f[1] * q + rr[1] * w,
              i = idx(Math.floor(px / M_T), Math.floor(py / M_T));
            if (!isRoadT(i)) ok = false;
          }
        if (ok && ftClear(x, y, h, trl)) {
          bd = d;
          best = { x, y, h, curve: cv.id };
        }
      }
    }
  }
  return best;
}
// v50: places you drive into: fuel stations (rig -> the HGV diesel lane, cab only -> the forecourt) and garages (the repair bay)
function ftPlaceSpot(dp) {
  const trl = truck.trl,
    back = trl ? 14 : 2.5,
    rects = [];
  if (dp.hgv) for (const b of dp.hgv) rects.push([b.x0, b.y0, b.x1, b.y1]);
  if (dp.zones && (!trl || !dp.hgv)) for (const z of dp.zones) rects.push(z);
  if (dp.bay && dp.bay.x !== undefined && dp.ratePerPct !== undefined) {
    const b = dp.bay;
    rects.push([b.x - 8, b.y - 8, b.x + 8, b.y + 8]);
  }
  for (const [x0, y0, x1, y1] of rects) {
    const hz = x1 - x0 >= y1 - y0,
      L0 = hz ? x0 : y0,
      L1 = hz ? x1 : y1,
      W0 = hz ? y0 : x0,
      W1 = hz ? y1 : x1,
      mid = (W0 + W1) / 2,
      C = [];
    for (let w = W0 + 1.6; w <= W1 - 1.6; w += 0.8)
      for (let a = L0 + 1; a <= L1 - 1; a += 1)
        for (const d of [1, -1]) {
          const f0 = a + d * 5.2,
            r0 = a - d * back;
          if (Math.min(f0, r0) < L0 + 0.5 || Math.max(f0, r0) > L1 - 0.5) continue;
          C.push([Math.abs(w - mid) + 0.02 * Math.abs(a - (L0 + L1) / 2), a, w, d]);
        }
    C.sort((p, q) => p[0] - q[0]);
    for (const [, a, w, d] of C) {
      const x = hz ? a : w,
        y = hz ? w : a,
        h = hz ? (d > 0 ? Math.PI / 2 : -Math.PI / 2) : d > 0 ? Math.PI : 0;
      if (ftClear(x, y, h, trl)) return { x, y, h, place: true };
    }
  }
  return null;
}
BigRig.ftTarget = ftTarget;
BigRig.mapPOIs = () => {
  const L = [];
  mapPOIList((o, x, y, kind) => L.push({ o, x, y, kind, name: o.name }));
  return L;
};
function fastTravel(dp, at) {
  const s = truck;
  const why = ftBlock(dp);
  if (why) {
    flash(why);
    return false;
  }
  const p = ftTarget(dp, at);
  if (!p) {
    flash("Fast travel: no clear spot at " + dp.name);
    return false;
  }
  const fee = ftFee(dp);
  const fr = document.getElementById("frame") || document.body;
  let ov = document.getElementById("ftfade");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "ftfade";
    ov.style.cssText =
      "position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .28s;z-index:50";
    fr.appendChild(ov);
  }
  ov.style.opacity = "1";
  if (typeof closeMap === "function") closeMap();
  setTimeout(() => {
    rigPlace(p);
    s.money -= fee;
    if (NAV.route && NAV.route.target) {
      const t = NAV.route.target;
      setRoute(t.ref || { x: t.x, y: t.y, name: t.name });
    }
    flash(
      "Fast travelled to " +
        dp.name +
        " (\u00a3" +
        fee +
        ")" +
        (p.bay ? " \u2014 parked at a bay" : ""),
    );
    BigRig.emit("fastTravel", { depot: dp.id, name: dp.name, x: p.x, y: p.y, fee });
    setTimeout(() => (ov.style.opacity = "0"), 60);
  }, 300);
  return true;
}
BigRig.fastTravel = fastTravel;
BigRig.ftSpotFor = (dp) => {
  const e = dp.entrance || dp;
  return dp.bays && dp.x !== undefined ? ftSpot(dp) : ftRoadSpot(e.x, e.y);
};
// tooltip button hit-boxes (set when drawn)
let FT_BTN = null,
  NAV_BTN = null;

// v20 flyovers: tiles of the lower road under a deck (FF) carry two roads that don't connect. Returns -1 (move not allowed), 0 (lower) or 1 (on the deck).
function foNavStep(i, j, d, k, FF) {
  if (k > 1) return -1;
  const along = (t) => {
    const h = world.roadH[t],
      v = world.roadV[t];
    return (h >= 0 && Math.abs(d) === 1) || (v >= 0 && Math.abs(d) === MW);
  };
  const cv = (t) => world.roadH[t] === -3;
  if (!FF[i]) {
    if (cv(i)) return 1;
    return along(j) ? 0 : -1;
  } // entering: from the curve onto the deck, or straight along the lower road
  if (navUp[i]) {
    return FF[j] ? 1 : cv(j) ? 0 : -1;
  } // on the deck: stay on it until it lands back on the curve
  if (cv(j)) return -1;
  return along(j) && along(i) ? 0 : -1;
} // under it: straight along the lower road only

// v31: persistent mission sat nav - while a mission step is active the route to its target is restored (about every second) whenever it goes missing
function missionTarget() {
  const a = typeof career !== "undefined" && career.active;
  if (!a || !a.job) return null;
  if (a.phase === "pickup") {
    const b = a.pickBay,
      t = a.trailer;
    return t
      ? {
          x: t.x,
          y: t.y,
          name: a.job.from.name + (b && b.id != null ? " \u2022 bay " + b.id : ""),
          ref: a.job.from,
        }
      : a.job.from;
  }
  if (a.phase === "recouple" && a.trailer)
    return { x: a.trailer.x, y: a.trailer.y, name: "Your cargo" };
  if (a.phase === "deliver") return jobBayTarget(a);
  return null;
}
function missionFlag(X, Y, big) {
  const t = missionTarget();
  if (!t) return;
  const tx = t.x != null ? t.x : t.entrance && t.entrance.x,
    ty = t.y != null ? t.y : t.entrance && t.entrance.y;
  if (tx == null) return;
  const x = X(tx),
    y = Y(ty),
    pu = 0.5 + 0.5 * Math.sin(performance.now() / 260),
    s = big ? 1.3 : 0.9;
  ctx.save();
  ctx.strokeStyle = "rgba(255,214,0," + (0.35 + 0.4 * pu) + ")";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, (6 + 6 * pu) * s, 0, 7);
  ctx.stroke();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 16 * s);
  ctx.stroke();
  ctx.fillStyle = "#ffd600";
  ctx.beginPath();
  ctx.moveTo(x, y - 16 * s);
  ctx.lineTo(x + 10 * s, y - 12.5 * s);
  ctx.lineTo(x, y - 9 * s);
  ctx.fill();
  const nm = String(t.name || "Mission").replace(
    /^.*\u2022\s*/,
    big ? String(t.name).split(" \u2022")[0] + " \u2022 " : "",
  );
  ctx.font = "bold " + (big ? 12 : 9) + "px sans-serif";
  const w = ctx.measureText(nm).width + 6;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x + 11 * s, y - 20 * s, w, big ? 15 : 11);
  ctx.fillStyle = "#ffd600";
  ctx.fillText(nm, x + 11 * s + 3, y - 20 * s + (big ? 12 : 9));
  ctx.restore();
}
setTimeout(() => {
  const un = updateNav;
  let acc = 0;
  updateNav = function (dt) {
    un.apply(this, arguments);
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    try {
      const t = missionTarget();
      if (!t || NAV.missOff === t.name) return;
      if (NAV.route && !(NAV.route.arrived && NAV.route.target.name !== t.name)) return;
      const fl = flash;
      flash = () => {};
      NAV._restoring = 1;
      try {
        setRoute(t);
        NAV.restored = (NAV.restored || 0) + 1;
      } finally {
        flash = fl;
        NAV._restoring = 0;
      }
    } catch (e) {}
  };
}, 0);
// v31: an uncoupled trailer abandoned on a road / junction is cleared after ~60 s off screen with the player (and every MP player) over a screen away;
// coming back resets the timer. Bay/yard trailers stay. A mission trailer goes back to its pickup bay and the job stays valid (sat nav restores).
function trlOnRoad(t) {
  const tx = Math.floor(t.x / M_T),
    ty = Math.floor(t.y / M_T);
  if (!inb(tx, ty)) return false;
  const i = idx(tx, ty);
  return isRoadT(i) || !!(world.jMask && world.jMask[i]);
}
function trlNearPlayer(t, R) {
  if (Math.hypot(t.x - truck.x, t.y - truck.y) < R) return true;
  if (typeof MP !== "undefined" && MP.on)
    for (const k in MP.players) {
      const p = MP.players[k],
        q = p && p.buf && p.buf[p.buf.length - 1];
      const x = p && (p.x != null ? p.x : q && q[0]),
        y = p && (p.y != null ? p.y : q && q[1]);
      if (x != null && Math.hypot(t.x - x, t.y - y) < R) return true;
    }
  return false;
}
function trlSweep(dt) {
  const vr = viewRectM(),
    R = Math.max(vr[2] - vr[0], vr[3] - vr[1]) * 1.0;
  const a = typeof career !== "undefined" && career.active;
  for (let i = world.trailers.length - 1; i >= 0; i--) {
    const t = world.trailers[i];
    if (t.coupled || t.bay || t.inBay || !trlOnRoad(t)) {
      t.awayT = 0;
      continue;
    }
    if (onScreen(t.x, t.y, 10) || trlNearPlayer(t, R)) {
      t.awayT = 0;
      continue;
    }
    t.awayT = (t.awayT || 0) + dt;
    if (t.awayT < 60) continue;
    t.awayT = 0;
    if (a && a.trailer === t) {
      const b = a.pickBay;
      if (b) {
        t.x = b.kx;
        t.y = b.ky;
        t.th = b.th;
        if (t.h != null) t.h = b.th;
        t.bay = b;
        b.trailer = t;
        b.target = true;
        t.target = true;
        if (a.phase === "deliver" || a.phase === "recouple") a.phase = "pickup";
        if (typeof clearRoute === "function") clearRoute();
        TRLSW.back++;
      }
      continue;
    }
    world.trailers.splice(i, 1);
    TRLSW.gone++;
  }
}
const TRLSW = { gone: 0, back: 0 };
setTimeout(() => {
  const un = updateNav;
  let acc = 0;
  updateNav = function (dt) {
    un.apply(this, arguments);
    acc += dt;
    if (acc < 1) return;
    const d = acc;
    acc = 0;
    try {
      trlSweep(d);
    } catch (e) {
      console.warn("[trlSweep]", e);
    }
  };
}, 0);

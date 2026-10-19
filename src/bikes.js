/**
 * @file bikes.js — MOTORBIKES in AI traffic: sport / cruiser / scooter / delivery bikes with riders, a single headlamp,
 *   engine buzz; lane filtering past slow queues; crashes (rider thrown off, bike slides); biker gangs (4-8 cruisers in a
 *   staggered formation on motorways, dual carriageways and rural roads); biker revenge (knock enough riders off and a gang
 *   hunts you: rides alongside and shoots, bulletproof panels cut the damage; escape by distance, by breaking line of sight,
 *   or by knocking them off; never during a job, Black Market job or heist, and an active gang backs off when one starts)
 * Exposes (globals): BK, BK_T, BK_DMG, makeBikeArt, bkIsBike, bkKnock, bkUpdate, bkDraw, bkHUD, bkSpawnGang, bkRevenge,
 *   bkEnd, bkBlocked
 * Depends on: traffic.js, police.js (emYield / emShift), wanted.js (wantHit), bm.js (bmHitBox / bmGunSound), peds.js (pedAlarm), audio.js,
 *   main.js (drawHUD, cam), daynight.js (dnLight; single lamp for bikes)
 * Load order: #55 of 60 in build.py (after fire.js); all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v51 motorbikes (James 17 Oct) =====================
// bike kinds join VTYPES at load (never MIX: parked cars and the map data stay as they are); random spawns pick a bike by road type
const BK_T = {
  sport: { L: 2.1, W: 0.8, heavy: false, acc: 3.4, bike: 1, vmax: 34 },
  cruiser: { L: 2.45, W: 0.95, heavy: false, acc: 2.6, bike: 1, vmax: 30 },
  scooter: { L: 1.85, W: 0.72, heavy: false, acc: 1.9, bike: 1, vmax: 14 },
  dbike: { L: 2.0, W: 0.8, heavy: false, acc: 2.0, bike: 1, vmax: 15 },
};
Object.assign(VTYPES, BK_T);
const BK_MIX = {
  city: [0.09, { scooter: 3, dbike: 3, sport: 2, cruiser: 1 }],
  town: [0.08, { scooter: 2, dbike: 2, sport: 2, cruiser: 2 }],
  res: [0.05, { scooter: 2, dbike: 1, sport: 1 }],
  hwy: [0.06, { sport: 3, cruiser: 3 }],
  dual: [0.07, { sport: 3, cruiser: 3, scooter: 1 }],
  rural: [0.09, { sport: 3, cruiser: 3, scooter: 1 }],
  lane: [0.04, { scooter: 1, cruiser: 1 }],
};
const BK_DMG = 0.4; // % truck damage per round that lands (x bulletproof panels)
const BK = {
  wr: [], // wrecks: sliding bikes + thrown riders
  tr: [], // tracers
  fx: [], // muzzle flashes / sparks
  gangs: [], // cruising formations
  heat: 0, // decaying count of riders knocked off (biker revenge)
  need: 4.5, // re-rolled 4-5 after each chase (fixed at load so verify_map sees identical globals)
  hunt: null, // active revenge chase
  nextGang: 60,
  coolT: 0,
  msg: null,
  ptr: { x: [], y: [], h: [], d: [] }, // the player's recent path (hunters ride it)
  snd: null,
  stats: { spawned: 0, knocked: 0, gangs: 0, hunts: 0, shots: 0, hits: 0, filt: 0 },
};
const bkIsBike = (v) => !!(v && BK_T[v.kind]);
const BK_HELM = [
  "#e74c3c",
  "#f1c40f",
  "#ecf0f1",
  "#2980b9",
  "#111",
  "#27ae60",
  "#8e44ad",
  "#e67e22",
];
// ---------- art: top-down, front at the top of the canvas (same as the cars)
function makeBikeArt(kind, col, helm, gang) {
  const t = BK_T[kind],
    L = t.L,
    W = t.W,
    c = vCanvas(L, W),
    g = c.getContext("2d"),
    cx = c.width / 2,
    y0 = 0.15 * VS,
    X = (m) => cx + m * VS,
    Y = (m) => y0 + m * VS,
    S = (m) => m * VS;
  const wide = kind === "cruiser" ? 0.24 : kind === "sport" ? 0.2 : 0.16;
  // tyres
  g.fillStyle = "#101010";
  rr(g, X(-wide / 2), Y(0), S(wide), S(0.62), S(0.08));
  g.fill();
  rr(g, X(-wide / 2 - 0.02), Y(L - 0.66), S(wide + 0.04), S(0.66), S(0.08));
  g.fill();
  // frame / bodywork
  if (kind === "scooter" || kind === "dbike") {
    g.fillStyle = grad(g, X(-0.3), X(0.3), col);
    rr(g, X(-0.3), Y(0.32), S(0.6), S(L - 0.75), S(0.24)); // leg shield + footboard + rear body
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(X(-0.22), Y(0.62), S(0.44), S(0.42)); // footboard
  } else {
    g.fillStyle = kind === "cruiser" ? "#c9ced6" : "#2a2a2e"; // engine / chrome
    rr(g, X(-0.26), Y(L * 0.42), S(0.52), S(0.42), S(0.1));
    g.fill();
    g.fillStyle = grad(g, X(-0.24), X(0.24), col); // tank + fairing / tail
    rr(g, X(-0.22), Y(0.42), S(0.44), S(L * 0.42), S(0.2));
    g.fill();
    rr(g, X(-0.14), Y(L - 0.95), S(0.28), S(0.48), S(0.1));
    g.fill();
    if (kind === "sport") {
      g.fillStyle = "rgba(160,210,255,0.55)"; // screen
      rr(g, X(-0.15), Y(0.3), S(0.3), S(0.16), S(0.06));
      g.fill();
    }
  }
  // handlebars + mirrors
  const hb = kind === "cruiser" ? 0.42 : kind === "sport" ? 0.3 : 0.32;
  g.strokeStyle = kind === "cruiser" ? "#dfe4ea" : "#222";
  g.lineWidth = S(0.07);
  g.beginPath();
  g.moveTo(X(-hb), Y(kind === "cruiser" ? 0.62 : 0.5));
  g.quadraticCurveTo(X(0), Y(0.42), X(hb), Y(kind === "cruiser" ? 0.62 : 0.5));
  g.stroke();
  g.fillStyle = "#333";
  for (const s of [-1, 1]) g.fillRect(X(s * hb) - S(0.05), Y(0.38), S(0.1), S(0.08));
  // delivery top box
  if (kind === "dbike") {
    g.fillStyle = "#f4f4f4";
    rr(g, X(-0.3), Y(L - 0.72), S(0.6), S(0.5), S(0.06));
    g.fill();
    g.fillStyle = "#d63031";
    g.fillRect(X(-0.3), Y(L - 0.52), S(0.6), S(0.12));
  }
  // rider: arms to the bars, jacket, helmet with visor shine
  const ry = kind === "cruiser" ? L * 0.56 : kind === "sport" ? L * 0.46 : L * 0.5;
  g.strokeStyle = gang ? "#1b1b1b" : "#2c3e50";
  g.lineWidth = S(0.11);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(X(s * 0.2), Y(ry - 0.12));
    g.lineTo(X(s * (hb - 0.04)), Y(kind === "cruiser" ? 0.64 : 0.52));
    g.stroke();
  }
  g.fillStyle = gang
    ? "#151515"
    : ["#2c3e50", "#34495e", "#5d4037", "#1e272e"][(helm.length * 7) % 4];
  g.beginPath();
  g.ellipse(X(0), Y(ry + 0.05), S(0.26), S(0.2), 0, 0, 7);
  g.fill();
  if (gang) {
    // back patch: the club colours (a small skull roundel)
    g.fillStyle = "#e1b12c";
    g.beginPath();
    g.arc(X(0), Y(ry + 0.12), S(0.09), 0, 7);
    g.fill();
    g.fillStyle = "#151515";
    g.fillRect(X(-0.03), Y(ry + 0.1), S(0.06), S(0.04));
  }
  g.fillStyle = helm;
  g.beginPath();
  g.arc(X(0), Y(ry - 0.16), S(0.15), 0, 7);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.beginPath();
  g.arc(X(-0.04), Y(ry - 0.22), S(0.05), 0, 7);
  g.fill();
  g.fillStyle = "rgba(20,20,30,0.85)"; // visor (faces forward = up)
  g.fillRect(X(-0.1), Y(ry - 0.31), S(0.2), S(0.06));
  return c;
}
function bkArt(kind, r, gang) {
  const col = gang ? "#141414" : CAR_COLS[(r() * CAR_COLS.length) | 0],
    helm = gang ? "#111" : BK_HELM[(r() * BK_HELM.length) | 0],
    key = "bk" + kind + col + helm + (gang ? "g" : "");
  if (!traffic.arts[key]) {
    const c = makeBikeArt(kind, col, helm, gang);
    traffic.arts[key] = { c, sh: shadowOf(c) };
  }
  return { body: traffic.arts[key], helm, col };
}
{
  const af = artFor;
  artFor = function (kind, r) {
    if (BK_T[kind]) return bkArt(kind, r, false);
    return af(kind, r);
  };
}
// ---------- spawning: random spawns sometimes become a bike (by road type)
{
  const sp = spawnVehicle;
  spawnVehicle = function (x, y, force, opt) {
    if (!opt || !opt.kind) {
      const tx = Math.floor(x / M_T),
        ty = Math.floor(y / M_T);
      if (inb(tx, ty)) {
        const i = idx(tx, ty),
          sid = opt && opt.seg != null ? opt.seg : Math.max(world.roadH[i], world.roadV[i]),
          sg = sid >= 0 && world.segs[sid];
        const M = sg && !sg.mil && BK_MIX[sg.type];
        if (M && Math.random() < M[0]) {
          const v = sp(
            x,
            y,
            force,
            Object.assign({}, opt || {}, { kind: pickW(M[1], Math.random()) }),
          );
          if (v) BK.stats.spawned++;
          return v;
        }
      }
    }
    return sp(x, y, force, opt);
  };
}
// ---------- lane filtering + bike speed caps (inside stepVeh via emYield, which runs once per sub-step for every vehicle)
function bkFilterAhead(v, lat0, range) {
  const f = fwd(v.h || 0),
    r = rgt(v.h || 0);
  let best = null;
  for (const o of traffic.vs) {
    if (o === v || bkIsBike(o)) continue;
    const dx = o.x - v.x,
      dy = o.y - v.y;
    if (Math.abs(dx) > range + 12 || Math.abs(dy) > range + 12) continue;
    const al = dx * f[0] + dy * f[1],
      la = dx * r[0] + dy * r[1] - lat0;
    if (al < 0 || al > range || Math.abs(la) > 1.6) continue;
    if (Math.cos((o.h || 0) - (v.h || 0)) < 0.8) continue;
    if (!best || al < best.al) best = { o, al };
  }
  return best;
}
function bkFilter(v, dt) {
  const sg = world.segs[v.plan.seg];
  if (!sg || nLanes(sg) < 2 || v.bkK) return false;
  const F = v.bkF;
  v.bkFT = (v.bkFT || 0) - dt;
  if (v.bkFT > 0) return !!F;
  v.bkFT = 0.25;
  if (!F) {
    if (v.v > 9 || v.ring != null || v.jHeld || v.turnJ || v.filterJ) return false;
    const a = bkFilterAhead(v, -(v.emO || 0), 13);
    if (!a || a.o.v > 4) return false;
    // filter towards the neighbouring lane (offside first, the UK norm), between the two queues
    const lane = v.plan.lane | 0,
      nl = nLanes(sg),
      p0 = lanePt(sg, v.plan.dir, lane, v.plan.pos),
      rv = rgt(v.h || 0);
    let side = 0;
    for (const nb of [lane - 1, lane + 1]) {
      if (nb < 0 || nb >= nl) continue;
      const p1 = lanePt(sg, v.plan.dir, nb, v.plan.pos),
        sd = Math.sign((p1[0] - p0[0]) * rv[0] + (p1[1] - p0[1]) * rv[1]);
      if (!side || sd > 0) side = sd;
    }
    if (!side) return false;
    v.bkF = { o: side * (M_T / 2), t: timeS, clr: 0 };
    BK.stats.filt++;
    return true;
  }
  // keep filtering while the queue beside us is still slow; rejoin our lane only once its spot is clear
  const lc = -(v.emO || 0), // own lane centre, relative to where the bike is now
    slow = bkFilterAhead(v, lc, 18),
    room = !bkFilterAhead(v, lc, 7) && !bkBehindNear(v);
  if ((!slow || slow.o.v > 7) && room) F.clr += 0.25;
  else F.clr = 0;
  if (F.clr > 1 || timeS - F.t > 60) v.bkF = null;
  return !!v.bkF;
}
function bkBehindNear(v) {
  const f = fwd(v.h || 0),
    r = rgt(v.h || 0);
  for (const o of traffic.vs) {
    if (o === v) continue;
    const dx = o.x - v.x,
      dy = o.y - v.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) continue;
    const al = dx * f[0] + dy * f[1],
      la = dx * r[0] + dy * r[1] + (v.emO || 0);
    if (al > -6 && al < 2 && Math.abs(la) < 1.6) return true;
  }
  return false;
}
{
  const ey = emYield;
  emYield = function (v, acc, dt) {
    if (!bkIsBike(v)) return ey(v, acc, dt);
    const T = BK_T[v.kind];
    if (v.v > T.vmax) acc = Math.min(acc, -1.5);
    if (v.bkG && v.bkG.lead === v) acc = Math.min(acc, (Math.min(T.vmax, 24) - v.v) * 0.8); // gangs cruise, they don't race
    if (bkFilter(v, dt) && v.bkF) {
      emShift(v, v.bkF.o, dt, 1.3);
      acc = Math.min(acc, (6.5 - v.v) * 1.2); // UK filtering: walking-pace-plus, never fast
      return acc;
    }
    return ey(v, acc, dt);
  };
}
// ---------- kinematic bikes (gang followers, revenge hunters): skip the lane model, ride a recorded trail / steer freely
function bkKinPath(v) {
  const f = fwd(v.h || 0);
  v.px = [v.x - f[0] * 2, v.x + f[0] * 10];
  v.py = [v.y - f[1] * 2, v.y + f[1] * 10];
  v.pd = [0, 12];
  v.i = 0;
  v.s = 2;
  v.offX = 0;
  v.offY = 0;
  v.mk = [];
}
function bkTrailAt(T, d) {
  const D = T.d,
    n = D.length;
  if (!n) return null;
  if (d <= D[0]) return [T.x[0], T.y[0], T.h[0], 0];
  if (d >= D[n - 1]) return [T.x[n - 1], T.y[n - 1], T.h[n - 1], n - 1];
  let lo = 0,
    hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (D[m] <= d) lo = m;
    else hi = m;
  }
  const t = (d - D[lo]) / (D[hi] - D[lo] || 1);
  return [
    T.x[lo] + (T.x[hi] - T.x[lo]) * t,
    T.y[lo] + (T.y[hi] - T.y[lo]) * t,
    T.h[lo] + wrapA(T.h[hi] - T.h[lo]) * t,
    lo,
  ];
}
function bkTrailPush(T, x, y, h, extra) {
  const n = T.d.length;
  if (n) {
    const dd = Math.hypot(x - T.x[n - 1], y - T.y[n - 1]);
    if (dd < 0.5) return;
    T.d.push(T.d[n - 1] + dd);
  } else T.d.push(0);
  T.x.push(x);
  T.y.push(y);
  T.h.push(h);
  if (T.f) T.f.push(extra || 0);
  if (T.d.length > 1600) for (const k of ["x", "y", "h", "d", "f"]) if (T[k]) T[k].splice(0, 400);
}
function bkBlocked(v, x, y) {
  for (const o of traffic.vs) {
    if (o === v || (o.bkG && o.bkG === v.bkG) || o.bkHunt) continue;
    if (Math.abs(o.x - x) > 8 || Math.abs(o.y - y) > 8) continue;
    for (const b of boxesOf(o)) if (ptBoxDist(x, y, b) < 0.6) return o;
  }
  return null;
}
function bkKin(v, dt) {
  const K = v.bkK;
  v.layer = 0;
  {
    // how fast the truck closes on this bike (sideways or from behind), for the knock-off test
    const s = truck,
      r = rgt(s.h),
      f = fwd(s.h),
      dx = v.x - s.x,
      dy = v.y - s.y,
      la = Math.abs(dx * r[0] + dy * r[1]),
      al = dx * f[0] + dy * f[1];
    if (K.la != null && dt > 0) {
      const lc = (K.la - la) / dt,
        ac = al > 0 ? (K.al - al) / dt : 0;
      K.cl = K.cl * 0.6 + Math.max(lc, ac) * 0.4;
    } else K.cl = 0;
    K.la = la;
    K.al = al;
  }
  if (K.mode === "f") {
    const G = v.bkG,
      L = G.lead;
    if (!L || L.bkDown || !traffic.vs.includes(L)) K.mode = "stop";
    else {
      const td = G.T.d[G.T.d.length - 1] - K.k * 4.6;
      let sp = Math.max(0, Math.min(L.v + 6, L.v + (td - K.gd) * 0.9));
      const ahead = bkTrailAt(G.T, K.gd + 3);
      const b = ahead && bkBlocked(v, ahead[0], ahead[1]);
      if (b) sp = Math.min(sp, Math.max(0, b.v - 0.5));
      v.v += Math.max(-7, Math.min(4, sp - v.v)) * Math.min(1, dt * 3);
      v.v = Math.max(0, v.v);
      K.gd = Math.min(td, K.gd + v.v * dt);
      const p = bkTrailAt(G.T, K.gd);
      if (p) {
        const fl = G.T.f[p[3]] || 0,
          st = (K.k % 2 ? 0.8 : -0.55) * (1 - fl),
          r = rgt(p[2]);
        K.st += (st - K.st) * Math.min(1, dt * 1.5);
        v.x = p[0] + r[0] * K.st;
        v.y = p[1] + r[1] * K.st;
        v.h = p[2];
      }
    }
  }
  if (K.mode === "stop") {
    v.v = Math.max(0, v.v - 6 * dt);
    const f = fwd(v.h);
    v.x += f[0] * v.v * dt;
    v.y += f[1] * v.v * dt;
    v.stopT = v.v < 0.2 ? (v.stopT || 0) + dt : 0;
  }
  if (K.mode === "h") bkHuntStep(v, K, dt);
  if (K.mode === "leave") {
    // back off: brake and drop behind on the road, then vanish once off screen
    v.v = Math.max(0, v.v - 4 * dt);
    const f = fwd(v.h);
    v.x += f[0] * v.v * dt;
    v.y += f[1] * v.v * dt;
    v.pinT = 0;
    v.stopT = 99;
    v.brake = v.v > 0.5;
  }
  if (K.mode !== "leave") v.brake = false;
  v.dist += v.v * dt;
  bkKinPath(v);
}
{
  const sv = stepVeh;
  stepVeh = function (v, dt, pbs) {
    if (v.bkK) return bkKin(v, dt);
    return sv(v, dt, pbs);
  };
}
function bkMakeKin(kind, x, y, h, gang) {
  const t = BK_T[kind],
    r = mulberry((Math.random() * 1e9) | 0),
    v = {
      id: traffic.nextId++,
      kind,
      L: t.L,
      W: t.W,
      heavy: false,
      amax: t.acc,
      art: bkArt(kind, r, gang),
      px: [],
      py: [],
      pd: [],
      i: 0,
      s: 0,
      mk: [],
      plan: { seg: 0, dir: 1, lane: 0, pos: 0 },
      v: 0,
      x,
      y,
      h,
      offX: 0,
      offY: 0,
      stopT: 0,
      honkT: 0,
      blockT: 0,
      shakeT: 0,
      ghostT: 0,
      pinT: timeS + 60,
      brake: false,
      sig: 0,
      drv: 1,
      r,
      born: timeS,
      dist: 0,
    };
  bkKinPath(v);
  traffic.vs.push(v);
  return v;
}
// ---------- crashes: the truck knocks a rider off -> bike slides (sparks), rider tumbles, gets up after a bit
{
  const wh = typeof wantHit === "function" ? wantHit : null;
  if (wh)
    wantHit = function (v, imp) {
      if (bkIsBike(v) && imp >= 1.2 && !v.bkDown) {
        // a kinematic biker who rides into a braking truck just bounces off; you knock him off by steering / driving into him
        if (v.bkK && (v.bkK.cl || 0) < 0.8) {
          v.v *= 0.5;
          if (v.bkK.mode === "h") v.bkK.cd += 0.8;
          return;
        }
        bkKnock(v, imp);
      }
      return wh.apply(this, arguments);
    };
}
function bkKnock(v, imp) {
  v.bkDown = true;
  const s = truck,
    tf = fwd(s.h),
    dx = v.x - s.x,
    dy = v.y - s.y,
    dl = Math.hypot(dx, dy) || 1,
    push = Math.min(16, 3 + Math.abs(s.v) * 0.9 + (imp || 0) * 0.4),
    bvx = (tf[0] * Math.sign(s.v || 1) * 0.6 + (dx / dl) * 0.6) * push + fwd(v.h)[0] * v.v * 0.6,
    bvy = (tf[1] * Math.sign(s.v || 1) * 0.6 + (dy / dl) * 0.6) * push + fwd(v.h)[1] * v.v * 0.6;
  BK.wr.push({
    v,
    x: v.x,
    y: v.y,
    h: v.h,
    vx: bvx,
    vy: bvy,
    w: (Math.random() - 0.5) * 7,
    rx: v.x,
    ry: v.y,
    rh: v.h,
    rvx: bvx * 1.15 + (Math.random() - 0.5) * 3,
    rvy: bvy * 1.15 + (Math.random() - 0.5) * 3,
    rw: (Math.random() - 0.5) * 9,
    t: 0,
    helm: (v.art && v.art.helm) || "#e74c3c",
    gang: !!(v.bkG || v.bkHunt),
  });
  BK.stats.knocked++;
  BK.heat += 1;
  if (v.bkHunt && BK.hunt) BK.hunt.down++;
  const i = traffic.vs.indexOf(v);
  if (i >= 0) traffic.vs.splice(i, 1);
  if (typeof noiseBurst === "function" && audio.ctx) {
    noiseBurst(0.25, 900, 0.8, 0.5);
    noiseBurst(0.6, 2600, 0.6, 0.25, "highpass"); // scrape
  }
  if (typeof cam !== "undefined") cam.shake = Math.max(cam.shake || 0, 0.8);
}
function bkWreckStep(dt) {
  for (let i = BK.wr.length - 1; i >= 0; i--) {
    const w = BK.wr[i];
    w.t += dt;
    const sp = Math.hypot(w.vx, w.vy);
    if (sp > 0.05) {
      const k = Math.max(0, sp - 6.5 * dt) / sp;
      w.vx *= k;
      w.vy *= k;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.h += w.w * dt;
      w.w *= Math.exp(-dt * 1.6);
      if (sp > 3 && Math.random() < dt * 30)
        BK.fx.push({
          k: "spark",
          x: w.x,
          y: w.y,
          vx: (Math.random() - 0.5) * 6 + w.vx * 0.3,
          vy: (Math.random() - 0.5) * 6 + w.vy * 0.3,
          t: 0,
          life: 0.25,
        });
    }
    if (w.t < 2.6) {
      const rs = Math.hypot(w.rvx, w.rvy);
      if (rs > 0.05) {
        const k = Math.max(0, rs - 8 * dt) / rs;
        w.rvx *= k;
        w.rvy *= k;
        w.rx += w.rvx * dt;
        w.ry += w.rvy * dt;
        w.rh += w.rw * dt;
        w.rw *= Math.exp(-dt * 2);
      }
    } else if (w.t > 4 && w.t < 9) {
      // dusts himself off and limps back to the bike
      const dx = w.x - w.rx,
        dy = w.y - w.ry,
        d = Math.hypot(dx, dy);
      if (d > 1.2) {
        w.rx += (dx / d) * 1.3 * dt;
        w.ry += (dy / d) * 1.3 * dt;
        w.rh = ang(dx, dy);
      }
    }
    if ((w.t > 14 && !onScreen(w.x, w.y, 20)) || w.t > 60) BK.wr.splice(i, 1);
  }
  for (let i = BK.fx.length - 1; i >= 0; i--) {
    const q = BK.fx[i];
    q.t += dt;
    q.x += (q.vx || 0) * dt;
    q.y += (q.vy || 0) * dt;
    if (q.t > q.life) BK.fx.splice(i, 1);
  }
  for (let i = BK.tr.length - 1; i >= 0; i--) if ((BK.tr[i].t -= dt) <= 0) BK.tr.splice(i, 1);
}
// ---------- biker gangs: a leader in the lane model + followers riding its trail in a staggered formation
const BK_GANG_ROADS = { hwy: 1, dual: 1, rural: 1 };
function bkSpawnGang(n, near) {
  const s = truck;
  n = n || 4 + ((Math.random() * 5) | 0);
  for (let tries = 0; tries < 40; tries++) {
    const a = Math.random() * 6.283,
      d = near ? 60 + Math.random() * 30 : 120 + Math.random() * 90,
      x = s.x + Math.cos(a) * d,
      y = s.y + Math.sin(a) * d;
    if (!near && onScreen(x, y, 30)) continue;
    const tx = Math.floor(x / M_T),
      ty = Math.floor(y / M_T);
    if (!inb(tx, ty)) continue;
    const i = idx(tx, ty),
      sid = Math.max(world.roadH[i], world.roadV[i]),
      sg = sid >= 0 && world.segs[sid];
    if (!sg || sg.mil || !BK_GANG_ROADS[sg.type]) continue;
    const L = spawnVehicle(x, y, true, { kind: "cruiser", seg: sid, lane: 0, clear: 30 });
    if (!L) continue;
    L.art = bkArt("cruiser", L.r, true);
    const G = { lead: L, T: { x: [], y: [], h: [], d: [], f: [] }, n, mem: [L], born: timeS };
    L.bkG = G;
    // seed the trail backwards along the lane so the formation starts strung out behind the leader
    // seed the trail straight back from the leader so the formation starts strung out behind it (spawns sit on straights)
    const lf = fwd(L.h || 0);
    for (let k = Math.ceil(n * 4.6 + 4) * 2; k >= 0; k--)
      bkTrailPush(G.T, L.x - lf[0] * k * 0.5, L.y - lf[1] * k * 0.5, L.h || 0, 0);
    for (let k = 1; k < n; k++) {
      const gd = G.T.d[G.T.d.length - 1] - k * 4.6,
        p = bkTrailAt(G.T, gd);
      const v = bkMakeKin("cruiser", p[0], p[1], p[2], true);
      v.bkG = G;
      v.bkK = { mode: "f", k, gd, st: 0 };
      v.v = L.v;
      v.plan = Object.assign({}, L.plan);
      G.mem.push(v);
    }
    BK.gangs.push(G);
    BK.stats.gangs++;
    return G;
  }
  return null;
}
function bkGangStep(dt) {
  for (let i = BK.gangs.length - 1; i >= 0; i--) {
    const G = BK.gangs[i],
      L = G.lead;
    const alive = G.mem.filter((v) => traffic.vs.includes(v));
    if (!alive.length) {
      BK.gangs.splice(i, 1);
      continue;
    }
    const T = G.T,
      n = T.d.length;
    if (L && n && Math.hypot(L.x - T.x[n - 1], L.y - T.y[n - 1]) > 30) {
      // the leader jumped (respawn / recovery ghost): the formation breaks up rather than ride a straight line through the map
      for (const v of alive) if (v.bkK) v.bkK.mode = "leave";
      G.lead = null;
    }
    if (G.lead && traffic.vs.includes(L) && !L.bkDown) {
      bkTrailPush(G.T, L.x, L.y, L.h || 0, L.bkF ? 1 : 0);
      L.pinT = Math.max(L.pinT, timeS + 5);
      for (const v of alive) v.plan = Object.assign({}, L.plan);
    }
  }
  if (BK.hunt) return;
  BK.nextGang -= dt;
  if (BK.nextGang <= 0) {
    BK.nextGang = 70 + Math.random() * 80;
    if (BK.gangs.length < 2 && !bkSpawnGang()) BK.nextGang = 8; // no motorway / rural road nearby yet: look again soon
  }
}
// ---------- biker revenge
function bkJobOn() {
  return (
    (typeof career !== "undefined" && !!career.active) || (typeof BM !== "undefined" && !!BM.act)
  );
}
function bkRevenge(force) {
  if (BK.hunt || bkJobOn()) return null;
  const s = truck,
    P = BK.ptr,
    n = 4 + ((Math.random() * 3) | 0),
    H = { mem: [], t0: timeS, down: 0, n, los: 0, far: 0, msgT: timeS, lostT: 0, spawned: 0 };
  // start them on the road we just drove, ~150 m back and off screen (or off screen on any road if we haven't driven far)
  const D = P.d,
    end = D.length ? D[D.length - 1] : 0;
  let back = 150;
  while (back < 400 && end - back > 0) {
    const p = bkTrailAt(P, end - back);
    if (!onScreen(p[0], p[1], 20)) break;
    back += 25;
  }
  for (let k = 0; k < n; k++) {
    let x, y, h, gd;
    if (end - back - k * 5 > 0) {
      gd = end - back - k * 5;
      const p = bkTrailAt(P, gd);
      x = p[0];
      y = p[1];
      h = p[2];
    } else {
      const a = s.h + Math.PI + (Math.random() - 0.5) * 0.6;
      x = s.x + Math.sin(a) * (140 + k * 6);
      y = s.y - Math.cos(a) * (140 + k * 6);
      h = ang(s.x - x, s.y - y);
      gd = -1;
    }
    const v = bkMakeKin(k % 3 === 2 ? "sport" : "cruiser", x, y, h, true);
    v.bkHunt = H;
    v.bkK = { mode: "h", k, gd, side: k % 2 ? 1 : -1, cd: 1.5 + Math.random() * 2, slot: k >> 1 };
    v.v = Math.max(12, Math.abs(s.v));
    H.mem.push(v);
  }
  BK.hunt = H;
  BK.stats.hunts++;
  BK.heat = 0;
  BK.need = 4 + (Math.random() < 0.5 ? 1 : 0);
  bkMsg("\u{1F3CD} Biker gang after you!", "#ff5a4a", 4);
  return H;
}
function bkLOS(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0),
    n = Math.ceil(d / 2);
  for (let i = 1; i < n; i++) {
    const tx = Math.floor((x0 + ((x1 - x0) * i) / n) / M_T),
      ty = Math.floor((y0 + ((y1 - y0) * i) / n) / M_T);
    if (inb(tx, ty) && get(tx, ty) === T.BLDG) return false;
  }
  return true;
}
function bkHuntStep(v, K, dt) {
  const s = truck,
    H = v.bkHunt,
    dx = s.x - v.x,
    dy = s.y - v.y,
    d = Math.hypot(dx, dy);
  v.pinT = timeS + 60;
  const sees = d < 140 && bkLOS(v.x, v.y, s.x, s.y);
  K.sees = sees;
  const tsp = Math.abs(s.v);
  if (d > 24 && K.gd >= 0 && BK.ptr.d.length) {
    // ride the player's own path (stays on the roads he took); slower round tight bends, slower still when searching
    const P = BK.ptr,
      end = P.d[P.d.length - 1];
    const a = bkTrailAt(P, K.gd),
      b = bkTrailAt(P, Math.min(end, K.gd + 12)),
      bend = Math.abs(wrapA(b[2] - a[2]));
    let want = Math.min(33, tsp + 9 + d * 0.04);
    if (bend > 0.5) want = Math.min(want, 15);
    if (!sees && d > 60) want = Math.min(want, 21); // lost sight: searching
    v.v += Math.max(-8, Math.min(5, want - v.v)) * Math.min(1, dt * 2);
    K.gd = Math.min(end, K.gd + v.v * dt);
    const p = bkTrailAt(P, K.gd),
      r = rgt(p[2]);
    v.x = p[0] + r[0] * K.side * 0.7;
    v.y = p[1] + r[1] * K.side * 0.7;
    v.h += wrapA(p[2] - v.h) * Math.min(1, dt * 8);
    if (K.gd >= end - 1) K.gd = -1;
  } else {
    // alongside: hold a slot beside the cab / trailer, matching the truck's heading and speed
    const f = fwd(s.h),
      r = rgt(s.h),
      back = 1 + K.slot * 4.5,
      side = K.side * 3.0,
      gx = s.x + r[0] * side - f[0] * back,
      gy = s.y + r[1] * side - f[1] * back,
      ex = gx - v.x,
      ey = gy - v.y,
      ed = Math.hypot(ex, ey),
      want = Math.min(36, Math.max(0, tsp + ed * 1.4) * (ed < 0.5 ? 0.98 : 1));
    v.v += Math.max(-9, Math.min(6, want - v.v)) * Math.min(1, dt * 3);
    const hw = ed > 1.5 ? ang(ex, ey) : s.h;
    v.h += wrapA(hw - v.h) * Math.min(1, dt * 4);
    const fv = fwd(v.h);
    v.x += fv[0] * v.v * dt;
    v.y += fv[1] * v.v * dt;
    if (d > 60 && BK.ptr.d.length) {
      // dropped back: rejoin the player's path at the nearest recent point
      const P = BK.ptr;
      let bi = P.d.length - 1,
        bd = 1e9;
      for (let i = P.d.length - 1; i >= Math.max(0, P.d.length - 400); i -= 4) {
        const q = Math.hypot(P.x[i] - v.x, P.y[i] - v.y);
        if (q < bd) {
          bd = q;
          bi = i;
        }
      }
      if (bd < 12) K.gd = P.d[bi];
    }
  }
  // shooting: only with a clear line of sight, inside ~32 m
  K.cd -= dt;
  if (sees && d < 32 && K.cd <= 0) {
    K.cd = 1.6 + Math.random() * 1.6;
    bkShoot(v, d);
  }
}
function bkShoot(v, d) {
  const s = truck,
    g = (Math.random() + Math.random() - 1) * (0.07 + Math.abs(s.v) * 0.003 + d * 0.002),
    a = Math.atan2(s.y - v.y, s.x - v.x) + g,
    miss = Math.random() < 0.3,
    dist = d * (miss ? 0.5 + Math.random() * 0.7 : 0.95 + Math.random() * 0.15),
    ix = v.x + Math.cos(a) * dist,
    iy = v.y + Math.sin(a) * dist,
    h = !miss && typeof bmHitBox === "function" && bmHitBox(ix, iy);
  BK.stats.shots++;
  BK.tr.push({ x0: v.x, y0: v.y, x1: ix, y1: iy, t: 0.14 });
  BK.fx.push({
    k: "flash",
    x: v.x + Math.cos(a) * 0.8,
    y: v.y + Math.sin(a) * 0.8,
    a,
    t: 0,
    life: 0.07,
  });
  if (typeof bmGunSound === "function") bmGunSound(false, d);
  if (typeof pedAlarm === "function") pedAlarm(v.x, v.y, 45, "gun"); // v53d: walkers run from gunfire
  if (h) {
    const tk = document.body.classList.contains("touch") ? 0.8 : 1,
      dm = BK_DMG * tk * (truck.bulM || 1);
    truck.damage = Math.min(100, (truck.damage || 0) + dm);
    BK.stats.hits++;
    BK.hunt && (BK.hunt.dmg = (BK.hunt.dmg || 0) + dm);
    cam.shake = Math.max(cam.shake || 0, 1);
    for (let k = 0; k < 4; k++)
      BK.fx.push({
        k: "spark",
        x: ix,
        y: iy,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        t: 0,
        life: 0.2,
      });
    if (typeof noiseBurst === "function" && audio.ctx) noiseBurst(0.05, 3800, 3, 0.22, "bandpass");
  }
}
function bkEnd(why) {
  const H = BK.hunt;
  if (!H) return;
  BK.hunt = null;
  BK.coolT = timeS + 90;
  for (const v of H.mem) if (v.bkK && traffic.vs.includes(v)) v.bkK.mode = "leave";
  const m =
    why === "wiped"
      ? ["\u2714 Biker gang knocked off \u2014 you escaped!", "#7dff8a"]
      : why === "job"
        ? ["The bikers backed off", "#cfe3ff"]
        : why === "lost"
          ? ["\u2714 You lost the biker gang \u2014 escaped!", "#7dff8a"]
          : ["\u2714 You outran the biker gang \u2014 escaped!", "#7dff8a"];
  bkMsg(m[0], m[1], 4.5);
  H.why = why;
  BK.last = H;
}
function bkHuntUpdate(dt) {
  const H = BK.hunt;
  if (!H) {
    BK.heat *= Math.exp(-dt / 300); // ~5 min memory
    if (!bkJobOn() && timeS > BK.coolT && BK.heat >= BK.need - 0.4 && started) bkRevenge();
    return;
  }
  if (bkJobOn()) return bkEnd("job");
  const live = H.mem.filter((v) => traffic.vs.includes(v) && !v.bkDown);
  if (!live.length) return bkEnd("wiped");
  const s = truck;
  let near = 1e9,
    seen = false;
  for (const v of live) {
    const d = Math.hypot(v.x - s.x, v.y - s.y);
    near = Math.min(near, d);
    if (v.bkK.sees) seen = true;
  }
  H.far = near > 230 ? H.far + dt : 0;
  H.lostT = !seen && near > 50 ? H.lostT + dt : 0;
  H.near = near;
  if (H.far > 3) return bkEnd("far");
  if (H.lostT > 9) return bkEnd("lost");
}
// ---------- audio: one engine voice for the nearest bike + the chase music bed
function bkAudio(dt) {
  if (typeof audio === "undefined" || !audio.ctx || !audio.master || audio.ctx.state !== "running")
    return;
  const ac = audio.ctx;
  if (!BK.snd) {
    const o = ac.createOscillator(),
      o2 = ac.createOscillator(),
      f = ac.createBiquadFilter(),
      g = ac.createGain(),
      lfo = ac.createOscillator(),
      lg = ac.createGain();
    o.type = "sawtooth";
    o2.type = "square";
    f.type = "lowpass";
    f.frequency.value = 900;
    g.gain.value = 0;
    lfo.frequency.value = 9;
    lg.gain.value = 0;
    lfo.connect(lg);
    lg.connect(g.gain);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(audio.master);
    o.start();
    o2.start();
    lfo.start();
    // chase bed: two detuned low saws, pulsing
    const c1 = ac.createOscillator(),
      c2 = ac.createOscillator(),
      cf = ac.createBiquadFilter(),
      cg = ac.createGain(),
      pl = ac.createOscillator(),
      pg = ac.createGain();
    c1.type = c2.type = "sawtooth";
    c1.frequency.value = 55;
    c2.frequency.value = 55.7;
    cf.type = "lowpass";
    cf.frequency.value = 380;
    cg.gain.value = 0;
    pl.type = "square";
    pl.frequency.value = 2.4;
    pg.gain.value = 0;
    pl.connect(pg);
    pg.connect(cg.gain);
    c1.connect(cf);
    c2.connect(cf);
    cf.connect(cg);
    cg.connect(audio.master);
    c1.start();
    c2.start();
    pl.start();
    BK.snd = { o, o2, f, g, lfo, lg, cg, pg, c1, c2 };
  }
  const S = BK.snd,
    s = truck,
    t = ac.currentTime;
  let best = null,
    bd = 1e9;
  for (const v of traffic.vs) {
    if (!bkIsBike(v)) continue;
    const d = Math.hypot(v.x - s.x, v.y - s.y);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  let gain = 0;
  if (best && bd < 70) {
    const k = best.kind,
      base = k === "cruiser" ? 32 : k === "sport" ? 70 : 85,
      per = k === "cruiser" ? 3.2 : k === "sport" ? 9 : 6;
    S.o.frequency.setTargetAtTime(base + best.v * per, t, 0.08);
    S.o2.frequency.setTargetAtTime((base + best.v * per) * 0.5, t, 0.08);
    S.lfo.frequency.setTargetAtTime(k === "cruiser" ? 7 : 22, t, 0.2);
    S.lg.gain.setTargetAtTime(k === "cruiser" ? 0.03 : 0.008, t, 0.2);
    gain = (k === "scooter" || k === "dbike" ? 0.05 : 0.09) / (1 + (bd / 22) ** 2);
    if (BK.hunt) gain *= 1.6;
  }
  S.g.gain.setTargetAtTime(gain, t, 0.12);
  const on = BK.hunt ? 0.09 : 0;
  S.cg.gain.setTargetAtTime(on * 0.5, t, 0.4);
  S.pg.gain.setTargetAtTime(on * 0.5, t, 0.4);
}
// ---------- per frame (runs before the traffic step)
function bkMsg(t, col, dur) {
  BK.msg = { t, col, until: timeS + dur };
}
function bkUpdate(dt) {
  if (!world.ready) return;
  const s = truck,
    P = BK.ptr;
  bkTrailPush(P, s.x, s.y, s.h, 0);
  for (let i = traffic.vs.length - 1; i >= 0; i--)
    if (traffic.vs[i].bkDown) traffic.vs.splice(i, 1);
  bkGangStep(dt);
  bkHuntUpdate(dt);
  bkWreckStep(dt);
  bkAudio(dt);
}
{
  const ut = updateTraffic;
  updateTraffic = function (dt) {
    try {
      bkUpdate(dt);
    } catch (e) {
      if (!BK.err) console.warn("bikes", e);
      BK.err = e;
    }
    return ut.apply(this, arguments);
  };
}
// ---------- drawing (world layer, after traffic): wrecks, riders, tracers, flashes, sparks
function bkDraw() {
  for (const w of BK.wr) {
    const a = w.v.art && w.v.art.body;
    // scrape mark behind the sliding bike
    if (a) {
      blitV(a.sh, w.x, w.y, w.h + Math.PI / 2, w.v.L, w.v.W, 3, 3);
      ctx.save();
      ctx.translate(w.x * PPM, w.y * PPM);
      ctx.rotate(w.h + Math.PI / 2);
      ctx.scale(1, 0.75); // on its side: foreshortened
      ctx.drawImage(
        a.c,
        ((-a.c.width / 2) * PPM) / VS,
        ((-a.c.height / 2) * PPM) / VS,
        (a.c.width * PPM) / VS,
        (a.c.height * PPM) / VS,
      );
      ctx.restore();
    }
    // rider
    const X = w.rx * PPM,
      Y = w.ry * PPM,
      up = w.t > 4;
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(w.rh);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(2, 2, up ? 4 : 6, up ? 3 : 3.5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = w.gang ? "#151515" : "#2c3e50";
    ctx.beginPath();
    if (up) ctx.ellipse(0, 0, 3.6, 2.3, 0, 0, 7);
    else ctx.ellipse(0, 1.5, 2.6, 6, 0, 0, 7); // lying flat
    ctx.fill();
    ctx.fillStyle = w.helm;
    ctx.beginPath();
    ctx.arc(0, up ? 0 : -4.5, 2.4, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.lineCap = "round";
  for (const t of BK.tr) {
    ctx.strokeStyle = "rgba(255,225,130," + Math.min(1, t.t * 8) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((t.x0 + (t.x1 - t.x0) * 0.55) * PPM, (t.y0 + (t.y1 - t.y0) * 0.55) * PPM);
    ctx.lineTo(t.x1 * PPM, t.y1 * PPM);
    ctx.stroke();
  }
  for (const q of BK.fx) {
    const u = q.t / q.life;
    if (q.k === "flash") {
      ctx.save();
      ctx.translate(q.x * PPM, q.y * PPM);
      ctx.rotate(q.a);
      ctx.fillStyle = "rgba(255,230,140," + (1 - u) + ")";
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (typeof dnLight === "function")
        dnLight(q.x * PPM, q.y * PPM, 40, "rgba(255,220,140,1)", 0.9);
    } else {
      ctx.fillStyle = "rgba(255," + ((200 - u * 120) | 0) + ",60," + (1 - u) + ")";
      ctx.fillRect(q.x * PPM - 1, q.y * PPM - 1, 2.2, 2.2);
    }
  }
  ctx.restore();
}
{
  const dt0 = drawTraffic;
  drawTraffic = function () {
    const r = dt0.apply(this, arguments);
    try {
      bkDraw();
    } catch (e) {
      if (!BK.err) console.warn("bikes draw", e);
      BK.err = e;
    }
    return r;
  };
}
// ---------- HUD banner (screen space, VW x VH like the other HUD pills)
function bkHUD() {
  const H = BK.hunt,
    M = BK.msg && BK.msg.until > timeS ? BK.msg : null;
  if (!H && !M) return;
  const t = H
      ? "\u{1F3CD} Biker gang after you! \u2022 " +
        H.mem.filter((v) => traffic.vs.includes(v)).length +
        " left"
      : M.t,
    col = H ? "#ff5a4a" : M.col;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = H ? 0.85 + 0.15 * Math.sin(timeS * 6) : Math.min(1, (M.until - timeS) * 2);
  ctx.font = "800 16px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(t).width + 30,
    x = VW / 2 - w / 2,
    y = 112;
  ctx.fillStyle = "rgba(13,15,20,0.88)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, 30, 15) : ctx.rect(x, y, w, 30);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.fillText(t, VW / 2, y + 15.5);
  if (H && H.near < 1e8) {
    ctx.font = "700 11px system-ui,sans-serif";
    ctx.fillStyle = "#cfd6e0";
    ctx.fillText(
      H.lostT > 0
        ? "out of sight \u2022 keep going (" + Math.max(0, 9 - H.lostT).toFixed(0) + ")"
        : "ram them off, break line of sight, or outrun them",
      VW / 2,
      y + 40,
    );
  }
  ctx.restore();
}
{
  const dh = drawHUD;
  drawHUD = function () {
    const r = dh.apply(this, arguments);
    try {
      bkHUD();
    } catch (e) {
      if (!BK.err) console.warn("bikes hud", e);
      BK.err = e;
    }
    return r;
  };
}

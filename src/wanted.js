/**
 * @file wanted.js — wanted stars (capped at 2 for now): heat score, 2-star police response, roadblocks
 * Exposes (globals): HEAT, RB, wantStars, wantHeat, wantProp, wantHit, want2Update, rbCands,
 *   rbTry, rbExtent, rbMake, rbRemove, rbUpdate, wantStarsHUD (+1 more)
 * Depends on: world.js, physics.js, traffic.js, ui.js, satnav.js, port.js, porttrucks.js,
 *   main.js, roadlaw.js, police.js
 * Load order: #46 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v44 wanted stars (capped at 2 for now): heat score, 2-star police response, roadblocks
// 1 star = the existing wanted / chase behaviour. Heat builds from offences (more while already wanted); WANT2_HEAT (180) heat while wanted -> 2 stars.
const HEAT = {
  pedestrian: 50,
  property: 22,
  police: 40,
  car: 12,
  speeding: 6,
  redlight: 8,
  flee: 15,
};
const RB = { list: [], cool: 0, made: 0, removed: 0 };
// v44b: 2 stars came far too easily (100 heat). Raised threshold, gentler while-wanted multiplier, faster decay.
const WANT2_HEAT = 180,
  WANT2_DROP = 90,
  WANT_PURSUE_S = 15; // v49: s since the last sighting that 2-star pursuers keep coming
WANT.heat = 0;
WANT.star = -9;
function wantStars() {
  return WANT.lvl || (POL.chase ? 1 : 0);
}
function wantHeat(type, amt) {
  amt = amt ?? HEAT[type] ?? 10;
  if (wantStars()) amt *= 1.2;
  WANT.heat = Math.min(300, (WANT.heat || 0) + amt);
  WANT.ht = timeS;
  if (WANT.heat >= WANT2_HEAT && wantStars() >= 1 && WANT.lvl < 2) {
    WANT.lvl = 2;
    WANT.t = Math.max(WANT.t || 0, 90);
    WANT.star = timeS;
    if (typeof toast === "function")
      toast("\u2605\u2605 Wanted level 2 \u2014 more police, roadblocks ahead");
  }
}
// hooks from physics (wall / solid hit) and traffic (hit a car)
function wantProp(imp) {
  if (imp < 5) return;
  if (wantStars() || polCanSee().length) wantHeat("property", imp > 10 ? 30 : 20);
}
function wantHit(v, imp) {
  if (imp < 2) return;
  if (v.rb || v.role === "police") {
    wantHeat("police");
    if (!wantStars()) {
      WANT.lvl = 1;
      WANT.t = 60;
      WANT.sp = 1;
      WANT.star = timeS;
    }
    return;
  }
  if (v.parked) {
    wantProp(imp * 1.2);
    return;
  }
  if (wantStars() || polCanSee().length) wantHeat("car", imp > 8 ? 18 : 12);
}
setTimeout(() => {
  const po = polOffence;
  polOffence = function (type) {
    const had = wantStars(),
      lv = WANT.lvl;
    const r = po.apply(this, arguments);
    if (lv >= 2) WANT.lvl = lv;
    wantHeat(type);
    if (!had && wantStars()) WANT.star = timeS;
    return r;
  };
  const ph = polPedHit;
  polPedHit = function () {
    const had = wantStars(),
      lv = WANT.lvl;
    const r = ph.apply(this, arguments);
    if (lv >= 2) WANT.lvl = lv;
    wantHeat("pedestrian", had ? HEAT.pedestrian : HEAT.pedestrian);
    if (!had && wantStars()) WANT.star = timeS;
    return r;
  };
  const pl = polLose;
  polLose = function () {
    const lv = WANT.lvl;
    const r = pl.apply(this, arguments);
    if (lv >= 2 || WANT.heat >= WANT2_HEAT) {
      WANT.lvl = 2;
      WANT.t = Math.max(WANT.t, 60);
    }
    wantHeat("flee");
    return r;
  };
  const wc = wantClear;
  wantClear = function () {
    if (WANT.lvl >= 2 && WANT.heat >= WANT2_DROP && !WANT.chased) return;
    WANT.heat = 0;
    return wc.apply(this, arguments);
  };
  const up = updatePolice;
  updatePolice = function (dt) {
    const r = up.apply(this, arguments);
    try {
      want2Update(dt);
    } catch (e) {
      WANT.err = String((e && e.stack) || e);
    }
    return r;
  };
  const dp = drawPolice;
  drawPolice = function (a, b, c, d) {
    const r = dp.apply(this, arguments);
    for (const B of RB.list) for (const v of B.cars) emDrawBar(v, true, "police");
    return r;
  };
  if (typeof ptBodies === "function") {
    const pb = ptBodies;
    ptBodies = function () {
      const o = pb.apply(this, arguments);
      for (const B of RB.list)
        for (const v of B.cars) {
          const f = fwd(v.h);
          o.push([v.x, v.y], [v.x + f[0] * 2, v.y + f[1] * 2], [v.x - f[0] * 2, v.y - f[1] * 2]);
        }
      return o;
    };
  }
}, 0);
function want2Update(dt) {
  if (!world.ready) return;
  const seen =
    polCanSee().length > 0 ||
    (POL.chase && onView(POL.chase.v.x, POL.chase.v.y)) ||
    POL.aux.some((c) => onView(c.v.x, c.v.y));
  if (seen) {
    WANT.seenT = timeS;
    WANT.lx = truck.x;
    WANT.ly = truck.y;
  }
  // heat decays out of sight (fast in a hide box), slowly even while seen; 2 stars drops back to 1 below WANT2_DROP
  if (!seen && !POL.chase) {
    const hid = WANT.hid;
    WANT.heat = Math.max(0, (WANT.heat || 0) - dt * (hid ? 24 : 7));
  } else if (timeS - (WANT.ht || 0) > 8) WANT.heat = Math.max(0, (WANT.heat || 0) - dt * 1.5);
  if (WANT.lvl >= 2) {
    if (WANT.heat < WANT2_DROP && !POL.chase) {
      WANT.lvl = 1;
      WANT.t = Math.min(WANT.t, 45);
    } else if (!POL.chase) WANT.t = Math.max(WANT.t, 20);
    // v49: active pursuit: keep 3-5 chase cars on the player while they've been seen in the last few seconds
    // (spawned off-screen, topped up); out of sight they head for the last sighting instead, so you can still get away
    const recent = timeS - (WANT.seenT ?? -99) < WANT_PURSUE_S || timeS < (WANT.pursueUntil || 0);
    for (const c of POL.aux) c.goal = recent ? null : [WANT.lx, WANT.ly];
    if (recent && timeS > (WANT.auxT || 0)) {
      WANT.auxT = timeS + 1.2;
      WANT.auxN = WANT.auxN || 3 + ((Math.random() * 3) | 0);
      if (POL.aux.length + (POL.chase ? 1 : 0) < WANT.auxN) polAuxSpawn();
    }
    // more police: extra searchers, sent close to the player
    WANT.sp2 = (WANT.sp2 || 0) - dt;
    const n = POL.cars.filter((v) => v.pol && v.pol.search).length;
    if (WANT.sp2 <= 0 && n + POL.aux.length < 7) {
      WANT.sp2 = 3 + Math.random() * 2;
      const v = polSpawn();
      if (v) {
        v.pol.search = true;
        v.pinT = timeS + 1e6;
        aiGoal(v, { entrance: { x: truck.x, y: truck.y }, name: "search" });
        v.pol.sg = timeS + 6;
      }
    }
    for (const v of POL.cars)
      if (v.pol && v.pol.search && timeS > v.pol.sg && traffic.vs.includes(v)) {
        aiGoal(v, {
          entrance: {
            x: truck.x + (Math.random() - 0.5) * 30,
            y: truck.y + (Math.random() - 0.5) * 30,
          },
          name: "search",
        });
        v.pol.sg = timeS + 6 + Math.random() * 4;
      }
    // ram: the chase car drives into the rig (real contact: speed loss, bump, slight yaw)
    for (const c of [POL.chase, ...POL.aux]) {
      if (!c || !c.v) continue;
      const d = Math.hypot(truck.x - c.v.x, truck.y - c.v.y);
      if (d < 5.6 && timeS - (c.ramT || 0) > 1.4 && c.sp > 2) {
        c.ramT = timeS;
        POL.rams = (POL.rams || 0) + 1;
        truck.v *= 0.88;
        truck.bump = Math.min(1, (truck.bump || 0) + 0.45);
        truck.h += (Math.random() < 0.5 ? -1 : 1) * 0.03;
        c.sp *= 0.5;
      }
    }
    rbTry();
  } else {
    WANT.auxN = 0;
    for (const c of POL.aux.slice()) polAuxDrop(c, true);
  }
  rbUpdate();
}
// ---------- roadblocks (2 stars): angled police cars across the road ahead / on the sat-nav route, narrow gap, never placed on screen
function rbCands() {
  const R = polViewR(),
    D0 = R * 1.35 + 40,
    out = [];
  const r = NAV.route;
  if (r && r.P && r.cum) {
    const c0 = r.cum[r.idx || 0];
    for (const D of [D0, D0 + 25, D0 + 50, D0 + 80]) {
      let k = r.idx || 0;
      while (k < r.P.length - 3 && r.cum[k] - c0 < D) k++;
      if (k >= r.P.length - 3) break;
      const a = r.P[Math.max(0, k - 3)],
        b = r.P[Math.min(r.P.length - 1, k + 3)],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      out.push([r.P[k][0], r.P[k][1], (b[0] - a[0]) / l, (b[1] - a[1]) / l]);
    }
  }
  const f = fwd(truck.h);
  if (Math.abs(truck.v) > 1 || !out.length)
    for (const D of [D0, D0 + 25, D0 + 50])
      out.push([truck.x + f[0] * D, truck.y + f[1] * D, f[0], f[1]]);
  return out;
}
function rbTry() {
  if (RB.list.length || timeS < RB.cool) return;
  RB.tryT = (RB.tryT || 0) - 1;
  if (RB.tryT > 0) return;
  RB.tryT = 20; // every ~20 frames
  for (const [x, y, ux, uy] of rbCands()) {
    const sg = slSegAt(x, y);
    if (!sg || !sg.w) continue;
    const h = sg.dir === "h";
    if (h ? Math.abs(ux) < 0.75 : Math.abs(uy) < 0.75) continue;
    const al = (h ? x : y) / M_T;
    if (al < sg.b0 + 3 || al > sg.b1 - 3) continue;
    const B = rbMake(sg, h ? x : y, h ? ux : uy);
    if (B) {
      RB.list.push(B);
      RB.made++;
      return;
    }
  }
}
function rbExtent(sg, along) {
  const h = sg.dir === "h",
    t = Math.floor(along / M_T),
    rd = (c) => {
      const tx = h ? t : c,
        ty = h ? c : t;
      if (!inb(tx, ty)) return false;
      const i = idx(tx, ty);
      return world.roadH[i] >= 0 || world.roadV[i] >= 0 || get(tx, ty) === T.ROAD;
    };
  let lo = sg.a,
    hi = sg.a + sg.w - 1;
  while (lo - 1 > sg.a - 12 && rd(lo - 1)) lo--;
  while (hi + 1 < sg.a + sg.w + 12 && rd(hi + 1)) hi++;
  return [lo * M_T, (hi + 1 - lo) * M_T];
}
function rbMake(sg, along, dirSign) {
  const h = sg.dir === "h",
    EX = rbExtent(sg, along),
    c0 = EX[0],
    W = EX[1];
  ((gap = 3.4),
    (gs =
      Math.random() < 0.5
        ? c0 + 0.6 + Math.random() * 1.2
        : c0 + W - 0.6 - gap - Math.random() * 1.2),
    (P = []));
  const fill = (s, e) => {
    const L = e - s;
    if (L < 1.2) return;
    const n = Math.max(1, Math.ceil(L / 4.4));
    for (let i = 0; i < n; i++) P.push(s + ((i + 0.5) * L) / n);
  };
  fill(c0 - 0.4, gs - 0.9);
  fill(gs + gap + 0.9, c0 + W + 0.4);
  if (P.length < 1) return null;
  for (const o of traffic.vs) {
    const al2 = h ? o.x : o.y,
      cr = h ? o.y : o.x;
    if (Math.abs(al2 - along) < 9 && cr > c0 - 2 && cr < c0 + W + 2) return null;
  }
  const cars = [];
  for (let k = 0; k < P.length; k++) {
    const cx = h ? along : P[k],
      cy = h ? P[k] : along;
    if (onScreen(cx, cy, 14)) return null;
    const ang = (k % 2 ? -1 : 1) * 0.55;
    const hd = (h ? 0 : Math.PI / 2) + ang + (Math.random() - 0.5) * 0.12,
      pt = POL_T[(Math.random() * 3) | 0],
      t = VTYPES.estate;
    cars.push({
      parked: true,
      kind: "estate",
      L: t.L,
      W: t.W,
      heavy: true,
      x: cx,
      y: cy,
      h: hd,
      offX: 0,
      offY: 0,
      art: { body: emArt(pt).body },
      v: 0,
      rb: 1,
      role: "police",
      polT: pt,
    });
  }
  for (const v of cars) {
    traffic.parked.push(v);
    const k = Math.floor(v.x / 64) + "," + Math.floor(v.y / 64);
    let a = traffic.parkedIdx.get(k);
    if (!a) {
      a = [];
      traffic.parkedIdx.set(k, a);
    }
    a.push(v);
  }
  const cx = h ? along : c0 + W / 2,
    cy = h ? c0 + W / 2 : along;
  return {
    cars,
    x: cx,
    y: cy,
    u: h ? [Math.sign(dirSign) || 1, 0] : [0, Math.sign(dirSign) || 1],
    t: timeS,
    gap: [gs, gs + gap],
    seg: sg.id,
  };
}
function rbRemove(B) {
  for (const v of B.cars) {
    const i = traffic.parked.indexOf(v);
    if (i >= 0) traffic.parked.splice(i, 1);
    const a = traffic.parkedIdx.get(Math.floor(v.x / 64) + "," + Math.floor(v.y / 64));
    if (a) {
      const j = a.indexOf(v);
      if (j >= 0) a.splice(j, 1);
    }
  }
  RB.list.splice(RB.list.indexOf(B), 1);
  RB.removed++;
  RB.cool = timeS + 25;
}
function rbUpdate() {
  for (const B of RB.list.slice()) {
    const past = (truck.x - B.x) * B.u[0] + (truck.y - B.y) * B.u[1] > 20,
      far = Math.hypot(truck.x - B.x, truck.y - B.y) > polViewR() * 3.5,
      off = !B.cars.some((v) => onScreen(v.x, v.y, 10));
    if (past && !B.pt) {
      B.pt = timeS;
    }
    if (off && (past || far || WANT.lvl < 2 || timeS - B.t > 120)) rbRemove(B);
  }
}
// ---------- HUD: stars (2 slots), flash + pulse when a star is gained
function wantStarsHUD() {
  const n = wantStars();
  if (!n) return;
  const S = 2,
    x0 = VW - 34 - (S - 1) * 38,
    y = VH * 0.13 + 70,
    ft = timeS - WANT.star,
    gain = ft >= 0 && ft < 1.6;
  ctx.save();
  for (let s = 0; s < S; s++) {
    const on = s < n,
      x = x0 + s * 38,
      pul = gain && s === n - 1 ? 1 + 0.45 * Math.sin(Math.min(1, ft / 1.6) * Math.PI) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pul, pul);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7 : 17,
        a = (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    const blink = on && !POL.chase && WANT.t <= 10 && (timeS * 4) % 1 > 0.6;
    ctx.fillStyle = on
      ? gain && s === n - 1 && (ft * 8) % 1 < 0.5
        ? "#ffffff"
        : blink
          ? "rgba(255,210,30,0.35)"
          : "#ffd21e"
      : "rgba(20,24,30,0.55)";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();
    if (!on) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
  if (gain) {
    ctx.globalAlpha = Math.max(0, 1 - ft / 1.6) * 0.35;
    ctx.fillStyle = "#ffd21e";
    ctx.fillRect(0, 0, VW, 6);
    ctx.fillRect(0, VH - 6, VW, 6);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.font = "bold 13px system-ui,sans-serif";
  ctx.textAlign = "center";
  const tx = POL.chase ? "CHASE" : WANT.lvl ? "WANTED " + Math.ceil(WANT.t) + "s" : "";
  const mx = x0 + (S - 1) * 19;
  if (tx) {
    ctx.strokeText(tx, mx, y + 32);
    ctx.fillText(tx, mx, y + 32);
  }
  if (n >= 2 && RB.list.length) {
    ctx.font = "bold 11px system-ui,sans-serif";
    ctx.strokeText("ROADBLOCK AHEAD", mx, y + 48);
    ctx.fillStyle = "#ff9b9b";
    ctx.fillText("ROADBLOCK AHEAD", mx, y + 48);
  }
  ctx.restore();
}
// sirens: wail far away, yelp when close (ambulance/fire use their own tones)
function emSirMode(sr, kind, o) {
  if (!sr || !o || o._sd == null) return;
  sr.mode(o._sd < 45 ? kind + "yelp" : kind);
}

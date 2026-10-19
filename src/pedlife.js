/**
 * @file pedlife.js — EVERYDAY STREET LIFE for the walkers in peds.js (v53d, James 19 Oct): bus stops (shelter, flag,
 *   yellow BUS STOP box) with queues that board the AI buses which pull in, dog walkers, joggers, cyclists on the
 *   footpaths, groups (couples, friends, families with pushchairs, chats outside shops), workers in
 *   hi-vis at depots and mall goods yards, builders at fenced pavement works, shoppers with bags milling outside the malls, and benches in parks and squares that people sit on.
 *   Stops and benches are derived from the map at runtime (no map data change).
 * Exposes (globals): PED_STOPS, pedStops, pedStopsNear, busStopAcc, PED_BENCH, pedBenches, pedBenchNear, pedRole,
 *   pedLifeSpawn, pedSpawnAt, pedStopWalk, pedRelease, pedMallWalk, pedDogTick, PED_SPORT, PED_DOGC, PED_BIKEC,
 *   drawPedLife, drawPedExtra, pedGroup, pedFollow, pedDrawPram, PED_WORKS,
 *   pedWorks, pedWorkSites, pedWorkers, pedWorkWalk, drawPedWorks
 * Depends on: peds.js (pedOk, pedLook, traffic.peds, PED_SCALE), traffic.js (laneLat, jRange, nLanes, idmAcc, tRand,
 *   traffic), world.js (world, G, T, get, idx, inb, TILE, M_T), gfxcity.js (gcHash), physics.js (fwd)
 * Load order: after peds.js in build.py. Shared global scope.
 */
"use strict";
// ---- bus stops: kerb lane of city / town roads, ~50 tiles apart, clear of junctions, pavement alongside
let PED_STOPS = null;
const PED_STOP_GRID = new Map();
function pedStops() {
  if (PED_STOPS) return PED_STOPS;
  PED_STOPS = [];
  for (const sg of world.segs || []) {
    if (!sg || (sg.type !== "city" && sg.type !== "town") || sg.w < 2) continue;
    for (const d of [1, -1]) {
      const ln = laneLat(sg, d, 0),
        out = ln === sg.a ? sg.a - 1 : sg.a + sg.w,
        side = ln === sg.a ? -1 : 1;
      for (let a = sg.b0 + 14 + (d > 0 ? 0 : 25); a < sg.b1 - 14; a += 50) {
        if (
          (sg.js || []).some((J) => {
            const [js, je] = jRange(sg, J);
            return a > js - 12 && a < je + 12;
          })
        )
          continue;
        const tl = (u) => (sg.dir === "h" ? [u, out] : [out, u]);
        if (![-2, 0, 2].every((k) => pedOk(...tl(a + k)))) continue;
        const h = sg.dir === "h" ? (d > 0 ? Math.PI / 2 : -Math.PI / 2) : d > 0 ? Math.PI : 0,
          lat = (ln + 0.5) * M_T,
          pw = (out + 0.5) * M_T,
          al = a * M_T;
        const S = {
          sg,
          d,
          h,
          bx: sg.dir === "h" ? al : lat, // kerb lane, where the bus front stops
          by: sg.dir === "h" ? lat : al,
          wx: sg.dir === "h" ? al : pw, // waiting point on the pavement
          wy: sg.dir === "h" ? pw : al,
          ax: sg.dir === "h" ? d : 0, // travel direction
          ay: sg.dir === "h" ? 0 : d,
          ox: sg.dir === "h" ? 0 : side, // outward (towards the pavement)
          oy: sg.dir === "h" ? side : 0,
          q: [],
          bus: null,
        };
        PED_STOPS.push(S);
        const k = Math.floor(S.bx / 64) + "," + Math.floor(S.by / 64);
        if (!PED_STOP_GRID.has(k)) PED_STOP_GRID.set(k, []);
        PED_STOP_GRID.get(k).push(S);
      }
    }
  }
  return PED_STOPS;
}
function pedStopsNear(x, y) {
  pedStops();
  const out = [],
    cx = Math.floor(x / 64),
    cy = Math.floor(y / 64);
  for (let j = cy - 1; j <= cy + 1; j++)
    for (let i = cx - 1; i <= cx + 1; i++)
      for (const S of PED_STOP_GRID.get(i + "," + j) || []) out.push(S);
  return out;
}
// AI buses (stepVeh): pull in at a stop in the kerb lane when people are waiting (or someone gets off), dwell, go
function busStopAcc(v, v0, dt) {
  if (v.busT > 0) {
    const S = v.busS;
    v.busT -= dt;
    if (v.busT <= 0 || !S) {
      v.busDone = S;
      if (S) S.bus = null;
      v.busS = null;
    }
    return S && v.busT > 0 ? -6 : 1e9;
  }
  const f = [Math.sin(v.h), -Math.cos(v.h)];
  let acc = 1e9;
  for (const S of pedStopsNear(v.x, v.y)) {
    if (S === v.busDone) continue;
    const dh = Math.atan2(Math.sin(S.h - v.h), Math.cos(S.h - v.h));
    if (Math.abs(dh) > 0.35) continue;
    const rx = S.bx - v.x,
      ry = S.by - v.y,
      ahead = rx * f[0] + ry * f[1],
      lat = rx * -f[1] + ry * f[0];
    if (Math.abs(lat) > 1.4 || ahead < -2 || ahead > 45) continue;
    if (v.busSkip !== S) {
      if (!S.q.length && gcHash(v.id | 0, Math.round(S.bx), 4) > 0.35) {
        v.busSkip = S; // nobody waiting, nobody getting off
        v.busDone = S;
        continue;
      }
      v.busSkip = S;
    }
    const gap = ahead - v.L / 2;
    if (gap < 1.5 && v.v < 0.6) {
      v.busT = Math.min(14, 4 + S.q.length * 1.3);
      v.busS = S;
      S.bus = v;
      // someone gets off
      for (let k = 0, n = (tRand() * 2.4) | 0; k < n; k++) {
        const p = pedSpawnAt(S.wx + S.ax * (k - 1), S.wy + S.ay * (k - 1));
        if (p) traffic.peds.push(p);
      }
      return -6;
    }
    acc = Math.min(acc, idmAcc(v, v0, Math.max(0.1, gap + 2), 0)); // +2: IDM keeps its 2.2 m standstill gap
  }
  return acc;
}
// a walker that just got off a bus (or out of a shop), on the pavement at (x, y) m
function pedSpawnAt(x, y) {
  if (!pedOk(Math.floor(x / M_T), Math.floor(y / M_T))) return null;
  const r = tRand,
    p = Object.assign(pedLook(r), {
      x,
      y,
      h: r() * 6.283,
      sp: 1.15 + r() * 0.45,
      lat: (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.9),
      ph: r() * 6,
      flee: 0,
      down: 0,
      path: null,
      i: 0,
      onX: null,
      hot: null,
      wait: 0.3,
    });
  p.dx = Math.sin(p.h);
  p.dy = -Math.cos(p.h);
  return p;
}
// queued walkers: stand in line; when the bus is in, walk to its door and get on
function pedStopWalk(p, dt) {
  const S = p.stop,
    k = S.q.indexOf(p);
  if (k < 0) {
    p.stop = null;
    p.wait = 0;
    return false;
  }
  const B = S.bus;
  let tx, ty;
  if (B && traffic.vs.includes(B)) {
    const f = [Math.sin(B.h), -Math.cos(B.h)];
    tx = B.x + f[0] * (B.L / 2 - 1.6) + S.ox * 1.4; // front door, kerb side
    ty = B.y + f[1] * (B.L / 2 - 1.6) + S.oy * 1.4;
    if (k > 0 && S.q[k - 1].stop === S) {
      // follow the one in front
      tx = S.q[k - 1].x - S.ax * 0.7;
      ty = S.q[k - 1].y - S.ay * 0.7;
    }
  } else {
    tx = S.wx - S.ax * (1.2 + k * 0.85) + S.ox * 0.6;
    ty = S.wy - S.ay * (1.2 + k * 0.85) + S.oy * 0.6;
  }
  const dx = tx - p.x,
    dy = ty - p.y,
    L = Math.hypot(dx, dy);
  if (B && k === 0 && L < 0.6) {
    // on board
    S.q.splice(0, 1);
    p.gone = true;
    return true;
  }
  if (L > 0.1) {
    const st = Math.min(L, p.sp * dt);
    p.x += (dx / L) * st;
    p.y += (dy / L) * st;
    p.h = Math.atan2(dx, -dy);
    p.ph += dt * p.sp * 5;
    p.moving = true;
  } else {
    p.h = Math.atan2(-S.ox, S.oy) + Math.PI; // face the road
    p.moving = false;
  }
  return true;
}
// a walker leaving the scene (despawn, fright): free its queue place / bench
function pedRelease(p) {
  if (p.stop) {
    const k = p.stop.q.indexOf(p);
    if (k >= 0) p.stop.q.splice(k, 1);
    p.stop = null;
    p.wait = 0;
  }
  p.left = true; // followers go their own way
  for (const b of [p.sit, p.sitB]) if (b && b.who === p) b.who = null;
  p.sit = p.sitB = null;
}
// ---- benches in parks and squares (deterministic per tile)
const PED_BENCH = new Map();
function pedBenches(cx, cy) {
  const k = cx + "," + cy;
  let a = PED_BENCH.get(k);
  if (a) return a;
  a = [];
  for (let ty = cy * 16; ty < cy * 16 + 16; ty++)
    for (let tx = cx * 16; tx < cx * 16 + 16; tx++) {
      const t = get(tx, ty);
      if ((t !== T.PARK && t !== T.PLAZA) || !pedOk(tx, ty) || gcHash(tx, ty, 31) > 0.035) continue;
      const hz = gcHash(tx, ty, 32) < 0.5;
      a.push({ x: (tx + 0.5) * M_T, y: (ty + 0.5) * M_T, h: hz ? 0 : Math.PI / 2, who: null });
    }
  PED_BENCH.set(k, a);
  return a;
}
function pedBenchNear(x, y, R) {
  const cx = Math.floor(x / M_T / 16),
    cy = Math.floor(y / M_T / 16);
  let best = null,
    bd = R;
  for (let j = cy - 1; j <= cy + 1; j++)
    for (let i = cx - 1; i <= cx + 1; i++)
      for (const b of pedBenches(i, j)) {
        const d = Math.hypot(b.x - x, b.y - y);
        if (!b.who && d < bd) {
          bd = d;
          best = b;
        }
      }
  return best;
}
// ---- roles at spawn: joggers, dog walkers, cyclists (more of them away from the busiest streets)
const PED_SPORT = ["#ff4081", "#00e5ff", "#76ff03", "#ff9100", "#ffea00", "#e040fb"],
  PED_DOGC = ["#3b2a1a", "#c8a165", "#f2efe8", "#1b1b1b", "#8a5a2b", "#9e9e9e"],
  PED_BIKEC = ["#d32f2f", "#1976d2", "#212121", "#388e3c", "#fbc02d", "#eeeeee"];
function pedRole(p, r, tx, ty) {
  const z = typeof slZone === "function" ? slZone(tx, ty) : 2,
    t = get(tx, ty),
    green = t === T.PARK || t === T.PLAZA,
    u = r(),
    jog = z === 0 && !green ? 0.03 : 0.08,
    dog = z === 0 && !green ? 0.03 : 0.1,
    bike = z === 0 ? 0.02 : 0.05;
  if (u < jog) {
    p.jog = 1;
    p.sp = 2.7 + r() * 0.7;
    p.top = p.col = PED_SPORT[(r() * PED_SPORT.length) | 0];
    p.bot = "#1c1c22";
    p.bag = null;
    p.umb = null;
  } else if (u < jog + dog) {
    const big = r() < 0.5;
    p.dog = {
      x: p.x,
      y: p.y + 1.5,
      h: p.h,
      col: PED_DOGC[(r() * PED_DOGC.length) | 0],
      s: big ? 1 : 0.7,
      ph: 0,
    };
    p.sp = 1 + r() * 0.3;
  } else if (u < jog + dog + bike) {
    p.bike = PED_BIKEC[(r() * PED_BIKEC.length) | 0];
    p.sp = 4 + r() * 1.2;
    p.umb = null;
  }
}
// spawn at a gathering point that has its own behaviour: bus stop queue, mall shoppers; else a role
function pedLifeSpawn(p, hs, r, tx, ty) {
  const H = hs && hs[2];
  if (H && H.k === "bus" && H.S.q.length < 7) {
    const S = H.S;
    S.q.push(p);
    p.stop = S;
    p.hot = null;
    p.wait = 0;
    p.x = S.wx - S.ax * (1.2 + (S.q.length - 1) * 0.85) + S.ox * 0.6;
    p.y = S.wy - S.ay * (1.2 + (S.q.length - 1) * 0.85) + S.oy * 0.6;
    return;
  }
  if (H && H.k === "mall") {
    p.mall = H.m;
    p.hot = null;
    p.wait = 0;
    p.bag = H.m.col || "#c0392b";
    p.bag2 = r() < 0.6 ? "#f5f5f5" : p.bag;
    p.umb = null;
    return;
  }
  pedRole(p, r, tx, ty);
}
// mall shoppers: wander the forecourt in front of the store, now and then go in through the door
function pedMallWalk(p, dt) {
  const m = p.mall,
    by = m.ty + m.h - (m.kind === "mall" ? 9 : 8);
  if (!p.mt) {
    const r = tRand;
    p.door = r() < 0.18;
    p.mt = p.door
      ? [(m.tx + m.w / 2) * M_T, (by + 0.2) * M_T]
      : [(m.tx + 2 + r() * (m.w - 4)) * M_T, (by - 0.5 - r() * 2.2) * M_T];
  }
  const dx = p.mt[0] - p.x,
    dy = p.mt[1] - p.y,
    L = Math.hypot(dx, dy);
  if (L < 0.3) {
    if (p.door) p.gone = true;
    p.mt = null;
    p.wait = 1 + tRand() * 5;
    return;
  }
  const st = Math.min(L, p.sp * dt);
  p.x += (dx / L) * st;
  p.y += (dy / L) * st;
  const ht = Math.atan2(dx, -dy),
    dh = Math.atan2(Math.sin(ht - p.h), Math.cos(ht - p.h));
  p.h += dh * Math.min(1, dt * 8);
  p.ph += dt * p.sp * 5;
}
// the dog trots after its walker on a lead
function pedDogTick(p, dt) {
  const D = p.dog,
    b = [
      p.x - Math.sin(p.h) * 1.4 + Math.cos(p.h) * 0.5,
      p.y + Math.cos(p.h) * 1.4 + Math.sin(p.h) * 0.5,
    ],
    dx = b[0] - D.x,
    dy = b[1] - D.y,
    L = Math.hypot(dx, dy);
  if (L > 0.15) {
    const st = Math.min(L, (L > 2.5 ? 4 : 1.6) * dt);
    D.x += (dx / L) * st;
    D.y += (dy / L) * st;
    D.h = Math.atan2(dx, -dy);
    D.ph += dt * 14;
  }
}
// ---- drawing (world px, under the vehicles): stop boxes, shelters, benches
function drawPedLife(inV) {
  drawPedWorks(inV);
  for (const S of PED_STOPS || []) {
    if (!inV(S.wx, S.wy)) continue;
    const X = S.bx * PPM,
      Y = S.by * PPM;
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(S.h);
    // yellow BUS STOP box on the kerb lane (bus front at the near end)
    ctx.strokeStyle = "rgba(242,193,46,0.85)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(-1.5 * PPM, 0, 3 * PPM, 15 * PPM);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(242,193,46,0.85)";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(0, 9 * PPM);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("BUS STOP", 0, 3);
    ctx.restore();
    ctx.restore();
    // shelter on the pavement + flag at the kerb
    ctx.save();
    ctx.translate(S.wx * PPM, S.wy * PPM);
    ctx.rotate(S.h);
    const o = S.ox * Math.cos(S.h) + S.oy * Math.sin(S.h) >= 0 ? 1 : -1; // outward in local x
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(o * 0.6 * PPM + 2, -2.4 * PPM + 2, o * 1.3 * PPM, 3.6 * PPM);
    ctx.fillStyle = "rgba(160,200,215,0.55)";
    ctx.fillRect(o * 0.6 * PPM, -2.4 * PPM, o * 1.3 * PPM, 3.6 * PPM);
    ctx.strokeStyle = "#2b3138";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(o * 0.6 * PPM, -2.4 * PPM, o * 1.3 * PPM, 3.6 * PPM);
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.arc(-o * 0.6 * PPM, 1.6 * PPM, 3, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-o * 0.6 * PPM - 1.6, 1.6 * PPM - 0.6, 3.2, 1.2);
    ctx.restore();
  }
  // benches
  const vb = traffic.pedVB;
  if (vb)
    for (let j = vb[1]; j <= vb[3]; j++)
      for (let i = vb[0]; i <= vb[2]; i++)
        for (const b of pedBenches(i, j)) {
          if (!inV(b.x, b.y)) continue;
          ctx.save();
          ctx.translate(b.x * PPM, b.y * PPM);
          ctx.rotate(b.h);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(-6.5 + 1.5, -2 + 1.5, 13, 4.4);
          ctx.fillStyle = "#7a5230";
          ctx.fillRect(-6.5, -2, 13, 4.4);
          ctx.fillStyle = "#5a3a20";
          ctx.fillRect(-6.5, -0.4, 13, 0.7);
          ctx.fillRect(-6.5, 1.3, 13, 0.7);
          ctx.fillStyle = "#2b2b2b";
          ctx.fillRect(-6.5, -2.6, 1.2, 5.6);
          ctx.fillRect(5.3, -2.6, 1.2, 5.6);
          ctx.restore();
        }
}
// per-walker extras drawn in the walker's rotated, scaled frame: bike under the rider; dog drawn in world frame
function drawPedExtra(p, X, Y) {
  if (p.dog) {
    const D = p.dog,
      dx = D.x * PPM,
      dy = D.y * PPM;
    ctx.strokeStyle = "rgba(40,30,20,0.8)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(X + Math.cos(p.h) * 3, Y + Math.sin(p.h) * 3);
    ctx.lineTo(dx, dy);
    ctx.stroke();
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(D.h);
    ctx.scale(D.s * PED_SCALE, D.s * PED_SCALE);
    const w = Math.sin(D.ph) * 0.8;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(1, 1, 2.2, 4, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = D.col;
    ctx.fillRect(-1.6, -1.2 + w, 0.9, 1.4);
    ctx.fillRect(0.7, -1.2 - w, 0.9, 1.4);
    ctx.fillRect(-1.6, 1.4 - w, 0.9, 1.4);
    ctx.fillRect(0.7, 1.4 + w, 0.9, 1.4);
    ctx.beginPath();
    ctx.ellipse(0, 0.4, 1.7, 3, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -3, 1.4, 0, 7);
    ctx.fill();
    ctx.fillRect(-0.3, 3, 0.6, 1.8 + w);
    ctx.restore();
  }
}
// ---- groups (v53d): couples and friends side by side, families with a pushchair and children, chats outside shops
function pedGroup(p, r) {
  if (p.stop || p.mall || p.jog || p.bike || p.lead) return [];
  const shop = p.hot && (p.hot.k === "shop" || p.hot.k === "pub"),
    u = r();
  let slots = null;
  if (shop && u < 0.55) {
    // a little crowd chatting in a ring
    const n = 1 + ((r() * 3) | 0);
    slots = [];
    for (let k = 0; k < n; k++) {
      const a = ((k + 1) / (n + 1)) * Math.PI * 2;
      slots.push([Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0, 1]);
    }
  } else if (u < 0.1)
    slots = [[1, 0, 0]]; // couple / pair of friends
  else if (u < 0.15)
    slots = [
      [-1, 0, 0],
      [1, 0, 0],
    ]; // three friends abreast
  else if (u < 0.2) {
    // family: pushchair in front of a parent, the other parent and a child alongside
    p.pram = ["#263238", "#5d4037", "#1565c0", "#ad1457"][(r() * 4) | 0];
    p.sp = Math.min(p.sp, 1.15);
    slots = [
      [1.1, 0.2, 0],
      [-1, 0.5, 0.65],
    ];
  }
  if (!slots) return [];
  return slots
    .map(([sx, sy, kid, chat]) => {
      const f = pedSpawnAt(p.x + sx, p.y + sy) || pedSpawnAt(p.x, p.y);
      if (!f) return null;
      f.lead = p;
      f.slot = [sx, sy];
      f.chat = chat || 0;
      f.sp = p.sp;
      f.umb = p.umb && r() < 0.5 ? null : f.umb;
      if (kid) {
        f.kid = kid;
        f.bag = null;
      }
      return f;
    })
    .filter(Boolean);
}
// a follower keeps its slot beside the leader (rotated with the leader's heading); false = on its own now
function pedFollow(p, dt) {
  const L = p.lead;
  if (L.left || L.cas || L.scare > 0 || L.stop || Math.hypot(L.x - p.x, L.y - p.y) > 12) {
    p.lead = null;
    p.path = null;
    p.kid = p.kid ? p.kid : 0;
    return false;
  }
  const c = Math.cos(L.h),
    s = Math.sin(L.h),
    tx = p.chat ? L.x + p.slot[0] : L.x + p.slot[0] * c - p.slot[1] * s,
    ty = p.chat ? L.y + p.slot[1] : L.y + p.slot[0] * s + p.slot[1] * c,
    xs = !L.onX && pedXAt(Math.floor(tx / M_T), Math.floor(ty / M_T)),
    dx = (xs ? L.x : tx) - p.x,
    dy = (xs ? L.y : ty) - p.y,
    d = Math.hypot(dx, dy);
  if (d > 0.08) {
    const st = Math.min(d, Math.max(L.sp, 0.6) * 1.4 * dt);
    const nx = p.x + (dx / d) * st,
      ny = p.y + (dy / d) * st,
      tX = Math.floor(nx / M_T),
      tY = Math.floor(ny / M_T);
    if (pedOk(tX, tY) || pedXAt(tX, tY) || d > 3) {
      p.x = nx;
      p.y = ny;
    }
    p.ph += dt * p.sp * 5;
    p.moving = d > 0.25;
  } else p.moving = false;
  // on the crossing only while the leader is crossing (cars wait for us too); otherwise tuck in on the kerb behind
  const X = pedXAt(Math.floor(p.x / M_T), Math.floor(p.y / M_T));
  p.onX = X && L.onX ? X : null;
  if (X && !L.onX) {
    p.x += (L.x - p.x) * Math.min(1, dt * 4);
    p.y += (L.y - p.y) * Math.min(1, dt * 4);
  }
  // chatting: face the one in the middle; walking: same way as the leader
  p.h = p.chat ? Math.atan2(L.x - p.x, -(L.y - p.y)) : p.moving ? Math.atan2(dx, -dy) : L.h;
  p.wait = 0;
  return true;
}
function pedDrawPram(p) {
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(-1.6, -9.6, 3.6, 5);
  ctx.fillStyle = p.pram;
  ctx.fillRect(-1.8, -10, 3.6, 5);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(0, -9.4, 1.8, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.fillRect(-2.2, -5.4, 4.4, 0.7);
}
// ---- workers (v53d): staff in hi-vis at depots and mall goods yards, builders at fenced pavement works
let PED_WORKS = null;
// deterministic pavement works: a 1-tile pit on a pavement at least two tiles wide (walkers pass on the inner tile)
function pedWorks(blk) {
  if (PED_WORKS) return PED_WORKS;
  PED_WORKS = [];
  for (let ty = 2; ty < MH - 2; ty++)
    for (let tx = 2; tx < MW - 2; tx++) {
      if (G[idx(tx, ty)] !== T.WALK || gcHash(tx, ty, 41) > 0.005) continue;
      for (const [ox, oy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (G[idx(tx + ox, ty + oy)] !== T.ROAD || G[idx(tx - ox, ty - oy)] !== T.WALK) continue;
        const z = typeof slZone === "function" ? slZone(tx, ty) : 2;
        if (z > 1) break;
        PED_WORKS.push({ tx, ty, x: (tx + 0.5) * M_T, y: (ty + 0.5) * M_T });
        if (blk) blk.add(tx * 65536 + ty);
        break;
      }
    }
  return PED_WORKS;
}
// workplaces near the lorry: [{key, n, spots:[[x, y]...], box:[x0, y0, x1, y1], build}]
function pedWorkSites(P) {
  const out = [],
    near = (x, y, R) => Math.abs(x - P.x) < R && Math.abs(y - P.y) < R;
  for (const d of world.depots || []) {
    const cx = (d.x + d.w / 2) * M_T,
      cy = (d.y + d.h / 2) * M_T;
    if (!near(cx, cy, 150) || !d.bays || !d.bays.length) continue;
    const spots = d.bays.map((b) => [b.cx + b.w * 0.6, b.dock - 1.2]);
    spots.push([(d.x + 4) * M_T, (d.y + 5.6) * M_T]);
    out.push({
      key: d,
      n: 2 + (d.bays.length > 4 ? 2 : 1),
      spots,
      box: [d.x * M_T, d.y * M_T, (d.x + d.w) * M_T, (d.y + d.h) * M_T],
    });
  }
  for (const m of world.malls || []) {
    if (!m.bays || !m.bays.length || !near(m.x, m.y, 150)) continue;
    const spots = m.bays.map((b) => [b.cx + b.w * 0.6, b.dock - 1.2]);
    const xs = spots.map((q) => q[0]);
    out.push({
      key: m,
      n: 2,
      spots,
      box: [Math.min(...xs) - 4, m.bays[0].dock - 12, Math.max(...xs) + 4, m.bays[0].dock],
    });
  }
  for (const w of pedWorks(null))
    if (near(w.x, w.y, 120))
      out.push({
        key: w,
        n: 2,
        spots: [
          [w.x - 0.9, w.y],
          [w.x + 0.9, w.y + 0.4],
        ],
        box: [w.x - 2, w.y - 2, w.x + 2, w.y + 2],
        build: 1,
      });
  return out;
}
// top up each nearby workplace to its crew size; returns how many workers are out
function pedWorkers(P, ps) {
  const sites = pedWorkSites(P),
    have = new Map();
  let n = 0;
  for (const p of ps)
    if (p.work) {
      have.set(p.work.key, (have.get(p.work.key) || 0) + 1);
      n++;
    }
  const r = tRand;
  for (const S of sites)
    for (let k = have.get(S.key) || 0; k < S.n; k++) {
      const sp = S.spots[(r() * S.spots.length) | 0];
      const p = Object.assign(pedLook(r), {
        x: sp[0],
        y: sp[1],
        h: r() * 6.283,
        sp: 1 + r() * 0.3,
        ph: r() * 6,
        down: 0,
        wait: r() * 4,
        i: 0,
        path: null,
        onX: null,
        lat: 0,
      });
      p.work = S;
      p.top = p.col = r() < 0.6 ? "#ff8f00" : "#d4e000";
      p.bot = S.build ? "#3e3e3e" : "#1f2a44";
      p.hat = S.build ? (r() < 0.7 ? "#ffd600" : "#fafafa") : r() < 0.5 ? "#fafafa" : null;
      if (!p.hat) p.hat = null;
      p.bag = p.umb = null;
      p.dig = S.build && k === 0 ? 1 : 0;
      ps.push(p);
      n++;
    }
  return n;
}
// workers stroll between bays and the warehouse door (builders stay at their pit), keeping inside their site
function pedWorkWalk(p, dt, close, pb) {
  const S = p.work,
    b = S.box;
  if (close < 6 && Math.abs(truck.v) > 1.5) {
    // step clear of a reversing / passing lorry
    const ax = p.x - pb[0].x,
      ay = p.y - pb[0].y,
      L = Math.hypot(ax, ay) || 1;
    p.x = Math.max(b[0], Math.min(b[2], p.x + (ax / L) * 3.5 * dt));
    p.y = Math.max(b[1], Math.min(b[3], p.y + (ay / L) * 3.5 * dt));
    p.h = Math.atan2(ax, -ay);
    p.moving = true;
    p.ph += dt * 20;
    return;
  }
  if (p.dig) {
    p.ph += dt * 4;
    p.moving = false;
    return;
  }
  if (p.wait > 0) {
    p.wait -= dt;
    p.moving = false;
    return;
  }
  if (!p.wt) p.wt = S.spots[(tRand() * S.spots.length) | 0];
  const dx = p.wt[0] - p.x,
    dy = p.wt[1] - p.y,
    L = Math.hypot(dx, dy);
  if (L < 0.3) {
    p.wt = null;
    p.wait = 3 + tRand() * 10;
    p.moving = false;
    return;
  }
  const st = Math.min(L, p.sp * dt);
  p.x += (dx / L) * st;
  p.y += (dy / L) * st;
  p.h = Math.atan2(dx, -dy);
  p.ph += dt * p.sp * 5;
  p.moving = true;
}
// fenced pit for pavement works (red / white barriers round a dug patch)
function drawPedWorks(inV) {
  for (const w of PED_WORKS || []) {
    if (!inV(w.x, w.y)) continue;
    const X = (w.x - 2) * PPM,
      Y = (w.y - 2) * PPM,
      S = 4 * PPM;
    ctx.fillStyle = "#6d5a45";
    ctx.fillRect(X + 4, Y + 4, S - 8, S - 8);
    ctx.fillStyle = "#4e3f30";
    ctx.fillRect(X + 9, Y + 9, S - 18, S - 18);
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? "#e53935" : "#fafafa";
      const t = k * (S / 8);
      ctx.fillRect(X + t, Y, S / 8, 2);
      ctx.fillRect(X + t, Y + S - 2, S / 8, 2);
      ctx.fillRect(X, Y + t, 2, S / 8);
      ctx.fillRect(X + S - 2, Y + t, 2, S / 8);
    }
  }
}

/**
 * @file pedlife.js — EVERYDAY STREET LIFE for the walkers in peds.js (v53d, James 19 Oct): bus stops (shelter, flag,
 *   yellow BUS STOP box) with queues that board the AI buses which pull in, dog walkers, joggers, cyclists on the
 *   footpaths, shoppers with bags milling outside the malls, and benches in parks and squares that people sit on.
 *   Stops and benches are derived from the map at runtime (no map data change).
 * Exposes (globals): PED_STOPS, pedStops, pedStopsNear, busStopAcc, PED_BENCH, pedBenches, pedBenchNear, pedRole,
 *   pedLifeSpawn, pedSpawnAt, pedStopWalk, pedRelease, pedMallWalk, pedDogTick, PED_SPORT, PED_DOGC, PED_BIKEC,
 *   drawPedLife, drawPedExtra
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
    if (gap < 0.8 && v.v < 0.5) {
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
    acc = Math.min(acc, idmAcc(v, v0, Math.max(0.1, gap), 0));
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

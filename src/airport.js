/**
 * @file airport.js — ALBION AIRPORT: runway, taxiways, HAS dispersals, hangars, civil terminal, landside car parks; aircraft as pure functions of timeS
 * Exposes (globals): APX, apA, apT, apCR, apPath, apAt, apSm, AP_LOOP, apBuild, apFillet,
 *   apTimed, apAtT, AP_G, apApp (+42 more)
 * Depends on: world.js, traffic.js, ambient.js, porttrucks.js, repair.js, daynight.js, main.js
 * Load order: #48 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v35 ALBION AIRPORT (Honington-style): 08/26 runway (081 deg), perimeter taxiway loop, HAS dispersals,
// 4 Type C hangars + military apron, civil terminal over the main line (Airport station), landside forecourt + car parks.
// All aircraft are pure functions of timeS (no state) and follow the same splines the taxiways are drawn from.
const APX = { A: null };
function apA() {
  if (APX.A !== null) return APX.A;
  const ap = (world.airports || []).find((a) => a.albion);
  APX.A = ap ? ap.albion : false;
  if (APX.A) apBuild(APX.A);
  return APX.A;
}
// runway frame: u along 08->26, v to the right (south side positive)
function apT(A, u, v) {
  const c = Math.cos(A.rwA),
    s = Math.sin(A.rwA);
  return [A.rwC[0] + u * c - v * s, A.rwC[1] + u * s + v * c];
}
function apCR(P, closed, step) {
  const n = P.length,
    out = [];
  const g = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1),
      p1 = g(i),
      p2 = g(i + 1),
      p3 = g(i + 2),
      L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]),
      m = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < m; k++) {
      const t = k / m,
        t2 = t * t,
        t3 = t2 * t;
      out.push(
        [0, 1].map(
          (j) =>
            0.5 *
            (2 * p1[j] +
              (-p0[j] + p2[j]) * t +
              (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
              (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3),
        ),
      );
    }
  }
  if (!closed) out.push(P[n - 1].slice());
  return out;
}
function apPath(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++)
    L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, L, len: L[L.length - 1] };
}
function apAt(P, d) {
  d = Math.max(0, Math.min(P.len, d));
  let lo = 1,
    hi = P.L.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (P.L[m] < d) lo = m + 1;
    else hi = m;
  }
  const i = lo,
    a = P.pts[i - 1],
    b = P.pts[i],
    u = (d - P.L[i - 1]) / Math.max(1e-6, P.L[i] - P.L[i - 1]);
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])];
}
function apSm(A, uv, extra) {
  const P = uv.map((p) => (p.length === 3 ? [p[0], p[1]] : apT(A, p[0], p[1])));
  return apPath(apCR(P, false, 1));
}
const AP_LOOP = [
  [-200, 0],
  [-194, -24],
  [-140, -30],
  [0, -30],
  [140, -30],
  [194, -24],
  [200, 0],
  [194, 28],
  [140, 34],
  [0, 34],
  [-140, 34],
  [-194, 28],
];
function apBuild(A) {
  A.loop = apCR(
    AP_LOOP.map((p) => apT(A, p[0], p[1])),
    true,
    1,
  );
  A.links = [-120, 0, 120].map((u) => [apT(A, u, -30), apT(A, u, 34)]);
  // dispersals: north-west, south-west, east (HAS pads), each with a spur to the loop
  A.has = [];
  for (const u of [-182, -162, -142]) A.has.push({ u, v: -48, side: -1 });
  for (const u of [-178, -156]) A.has.push({ u, v: 52, side: 1 });
  for (const u of [176, 196]) A.has.push({ u, v: 50, side: 1 });
  for (const h of A.has) {
    h.p = apT(A, h.u, h.v);
    h.q = apT(A, h.u, h.side * (h.side < 0 ? 31 : 35));
    h.a = Math.atan2(h.q[1] - h.p[1], h.q[0] - h.p[0]);
  }
  // civil apron + stands (nose-in to the terminal, south), military apron + Type C hangars
  A.civ = { x0: 360, y0: 582, x1: 452, y1: 640, lane: 589 };
  A.civLink = [apT(A, 0, 34), [405, A.civ.lane, 0]];
  A.stands = [0, 1, 2].map((k) => ({
    k,
    x: 376 + k * 28,
    big: true,
    sc: k === 1 ? 8.6 : 7.6,
    ph: k * 87,
    col: ["#c0392b", "#1f4e9c", "#117a65"][k],
    tail: ["#e74c3c", "#f1c40f", "#16a085"][k],
  }));
  A.mil = { x0: 468, y0: 566, x1: 590, y1: 608 };
  A.milLink = [apT(A, 120, 34)];
  A.hang = [0, 1, 2, 3].map((k) => ({ x0: 472 + k * 30, y0: 614, x1: 498 + k * 30, y1: 632, k }));
  A.fire = { x0: 290, y0: 600, x1: 316, y1: 614 };
  A.tower = [338, 600];
  A.fuel = { x0: 592, y0: 584, x1: 614, y1: 610 };
  A.fighters = A.has.map((h, i) => ({ h, i, ph: i * 53, col: "#8e9aa4" }));
  // fence gaps where roads cross the perimeter
  const T_ = TILE,
    gates = [];
  const scan = (fx, fy, len, dx, dy) => {
    let run = null;
    for (let i = 0; i <= len; i++) {
      const x = fx + dx * i,
        y = fy + dy * i,
        rd = inb(x, y) && G[idx(x, y)] === T.ROAD;
      if (rd && !run) run = { i0: i };
      if ((!rd || i === len) && run) {
        gates.push({
          x: fx + (dx * (run.i0 + i)) / 2,
          y: fy + (dy * (run.i0 + i)) / 2,
          w: i - run.i0,
          dx,
          dy,
        });
        run = null;
      }
    }
  };
  scan(A.x0, A.y0, A.x1 - A.x0, 1, 0);
  scan(A.x0, A.y0, A.y1 - A.y0, 0, 1);
  scan(A.x1, A.y0, A.y1 - A.y0, 0, 1);
  scan(A.x0, A.y1, A.term.x0 - A.x0, 1, 0);
  scan(A.term.x1, A.y1, A.x1 - A.term.x1, 1, 0);
  A.gates = gates.filter((g) => g.w >= 2);
  if (!A.gates.length) A.gates.push({ x: 586, y: A.y1, w: 3, dx: 1, dy: 0, svc: 1 }); // airside service gate on the south fence
  A.posts = [];
  const edge = (x0, y0, x1, y1) => {
    const L = Math.hypot(x1 - x0, y1 - y0);
    for (let s = 0; s <= L; s += 16) {
      const x = x0 + ((x1 - x0) * s) / L,
        y = y0 + ((y1 - y0) * s) / L;
      if (A.gates.some((g) => Math.hypot(g.x - x, g.y - y) < g.w / 2 + 3)) continue;
      A.posts.push([x, y]);
    }
  };
  A.segs = [
    [A.x0, A.y0, A.x1, A.y0],
    [A.x0, A.y0, A.x0, A.y1],
    [A.x1, A.y0, A.x1, A.y1],
    [A.x0, A.y1, A.term.x0, A.y1],
    [A.term.x1, A.y1, A.x1, A.y1],
  ];
  for (const s of A.segs) edge(...s);
  const tb = A.term;
  for (const o of world.objects) {
    if (!/^(tree|bush|scrub|rock|hedge|cactus)$/.test(o.kind)) continue;
    const x = o.x / T_,
      y = o.y / T_;
    if (x > A.x0 && x < A.x1 && y > A.y0 && y < A.y1 + 2) o._dead = 1;
    if (x > tb.x0 - 12 && x < tb.x1 + 2 && y > tb.y0 - 2 && y < tb.y1 + 32) o._dead = 1;
  }
  // aircraft paths (tiles)
  // ---- taxi routes built from the painted centrelines: straight legs + loop slices, corners filleted (the same paths are painted) ----
  const W = (u, v) => apT(A, u, v),
    Ln = A.loop.length;
  const near = (p) => {
    let b = 0,
      bd = 1e9;
    for (let i = 0; i < Ln; i++) {
      const d = (A.loop[i][0] - p[0]) ** 2 + (A.loop[i][1] - p[1]) ** 2;
      if (d < bd) {
        bd = d;
        b = i;
      }
    }
    return b;
  };
  const slice = (a, b, dir) => {
    const i0 = near(a),
      i1 = near(b),
      out = [];
    for (let i = i0; ; i = (i + dir + Ln) % Ln) {
      out.push(A.loop[i].slice());
      if (i === i1 || out.length > Ln) break;
    }
    return out;
  };
  const dirTo = (a, b) => {
    const i0 = near(a),
      i1 = near(b);
    return (i1 - i0 + Ln) % Ln < Ln / 2 ? 1 : -1;
  };
  const lp = (a, b) => slice(a, b, dirTo(a, b));
  A.taxiPaint = [];
  const route = (legs, r, paint) => {
    const P = [];
    for (const g of legs)
      for (const p of g) {
        const q = P[P.length - 1];
        if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.3) P.push(p);
      }
    const R0 = apFillet(P, r),
      R = [R0[0]];
    for (let i = 1; i < R0.length; i++) {
      const a = R0[i - 1],
        b = R0[i],
        d = Math.hypot(b[0] - a[0], b[1] - a[1]),
        m = Math.ceil(d / 1.5);
      for (let k = 1; k <= m; k++)
        R.push([a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m]);
    }
    if (paint) A.taxiPaint.push(R);
    return R;
  };
  const lane = A.civ.lane,
    cl0 = W(0, 34);
  A.pIn = A.stands.map((st) => {
    const sy = A.civ.y1 - 1.5 - (30 * st.sc) / 32;
    st.sy = sy;
    return apTimed(
      route(
        [
          [W(-172, 0), W(120, 0)],
          [W(120, 34)],
          lp(W(120, 34), cl0),
          [
            [405, 573],
            [405, lane],
            [st.x, lane],
            [st.x, sy],
          ],
        ],
        5,
        true,
      ),
      { v0: 12, stop: 1 },
    );
  });
  A.pOut = A.stands.map((st) =>
    apTimed(
      route(
        [
          [[st.x, lane]],
          [
            [405, lane],
            [405, 573],
          ],
          lp(cl0, W(-120, 34)),
          [W(-120, 10)],
        ],
        5,
        true,
      ),
      { stop: 1 },
    ),
  );
  A.lineup = apTimed(route([[W(-120, 10), W(-120, 0), W(-100, 0)]], 5, true), { stop: 1 });
  A.lineupN = apTimed(route([[W(-120, -10), W(-120, 0), W(-100, 0)]], 5, true), { stop: 1 });
  for (const f of A.fighters) {
    const h = f.h;
    f.fly = f.i === 0 || f.i === 3;
    if (!f.fly) continue;
    const q = [h.q[0], h.q[1]],
      p = [h.p[0], h.p[1]],
      N = h.v < 0;
    f.pOut = apTimed(
      route([[p, q], lp(q, W(-120, N ? -30 : 34)), [W(-120, N ? -10 : 10)]], 4, true),
      { stop: 1 },
    );
    f.pIn = apTimed(
      route([[W(-172, 0), W(0, 0), W(0, N ? -30 : 34)], lp(W(0, N ? -30 : 34), q), [q]], 4, true),
      { v0: 12, stop: 1 },
    );
    f.rev = apPath([q, p]);
    f.P = 900 + ((f.i * 7919) % 600);
  }
}
// ---------- timelines ----------
function apFillet(P, r) {
  const out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1],
      b = P[i],
      c = P[i + 1],
      l1 = Math.hypot(b[0] - a[0], b[1] - a[1]),
      l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const u1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1],
      u2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2],
      th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    if (th < 0.12 || l1 < 1.5 || l2 < 1.5) {
      out.push(b);
      continue;
    }
    const d = Math.min(r * Math.tan(th / 2), l1 * 0.48, l2 * 0.48),
      p1 = [b[0] - u1[0] * d, b[1] - u1[1] * d],
      p2 = [b[0] + u2[0] * d, b[1] + u2[1] * d],
      n = Math.max(4, Math.ceil(th * 8));
    for (let k = 0; k <= n; k++) {
      const t = k / n,
        m = 1 - t;
      out.push([
        m * m * p1[0] + 2 * m * t * b[0] + t * t * p2[0],
        m * m * p1[1] + 2 * m * t * b[1] + t * t * p2[1],
      ]);
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
// time table: taxi 2.3 tiles/s (~33 km/h) on straights, ~1 tile/s through turns, gentle accel/brake
function apTimed(pts, o) {
  const P = apPath(pts),
    n = pts.length,
    vm = new Array(n).fill(2.3);
  o = o || {};
  for (let i = 1; i < n - 1; i++) {
    const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]),
      b = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    let d = Math.abs(b - a);
    if (d > Math.PI) d = 2 * Math.PI - d;
    const k = d / Math.max(0.2, (P.L[i + 1] - P.L[i - 1]) / 2);
    if (k > 0.02) vm[i] = Math.max(0.9, Math.min(vm[i], 0.32 / Math.sqrt(k)));
  }
  if (o.v0) {
    for (let i = 0; i < n && P.L[i] < 250; i++) vm[i] = Math.max(vm[i], o.v0);
  }
  const v = vm.slice();
  v[0] = o.v0 || 0.3;
  const ac = 0.35,
    dc = o.v0 ? 0.9 : 0.35;
  for (let i = 1; i < n; i++)
    v[i] = Math.min(vm[i], Math.sqrt(v[i - 1] ** 2 + 2 * ac * (P.L[i] - P.L[i - 1])));
  if (o.stop) v[n - 1] = 0.25;
  for (let i = n - 2; i >= 0; i--)
    v[i] = Math.min(
      v[i],
      Math.sqrt(v[i + 1] ** 2 + 2 * (o.v0 && P.L[i] < 300 ? dc : 0.35) * (P.L[i + 1] - P.L[i])),
    );
  const T = [0];
  for (let i = 1; i < n; i++)
    T.push(T[i - 1] + (2 * (P.L[i] - P.L[i - 1])) / Math.max(0.05, v[i] + v[i - 1]));
  P.T = T;
  P.dur = T[n - 1];
  let ir = 0;
  while (ir < n - 1 && P.L[ir] < 290) ir++;
  P.tRoll = o.v0 ? T[ir] : 0;
  return P;
}
function apAtT(P, t) {
  t = Math.max(0, Math.min(P.dur, t));
  let lo = 1,
    hi = P.T.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (P.T[m] < t) lo = m + 1;
    else hi = m;
  }
  const i = lo,
    a = P.pts[i - 1],
    b = P.pts[i],
    u = (t - P.T[i - 1]) / Math.max(1e-6, P.T[i] - P.T[i - 1]);
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])];
}
const AP_G = (x, y, h, ph, ex) => Object.assign({ x, y, h, alt: 0, ph }, ex || {});
// approach: 3° glide down the centreline, flare from ~15 m to touchdown at u=-172
function apApp(A, o, dur, s) {
  const tdU = -172,
    v = s || 14,
    u = tdU - (dur - o) * v,
    p = apT(A, u, 0),
    d = tdU - u,
    fl = 24,
    alt = d > fl ? 0.12 + (d - fl) * 0.0105 : 0.12 * (d / fl) ** 2;
  return { x: p[0], y: p[1], h: A.rwA, alt, ph: "app", gear: 1, ldg: 1, nose: d < fl ? 1 : 0 };
}
function apTko(A, o, acc, rotU) {
  const u = -100 + 0.5 * acc * o * o,
    p = apT(A, Math.min(u, 700), 0),
    alt = u > rotU ? Math.min(4, (u - rotU) * 0.012 + ((u - rotU) / 220) ** 2) : 0;
  return alt > 3.6
    ? null
    : { x: p[0], y: p[1], h: A.rwA, alt, ph: "tko", gear: alt < 0.6 ? 1 : 0, ldg: 1 };
}
function apCivil(A, st, t) {
  const pin = A.pIn[st.k],
    pout = A.pOut[st.k],
    C = 640,
    tt = (((t + st.ph * 2.3) % C) + C) % C;
  let o = tt;
  if (o < 24) return apApp(A, o, 24);
  o -= 24;
  if (o < pin.dur) {
    const p = apAtT(pin, o),
      lead = o > pin.dur * 0.25 && o < pin.dur - 6;
    return AP_G(p[0], p[1], p[2], o < pin.tRoll ? "roll" : "taxi", {
      fm: lead ? apAtT(pin, Math.min(pin.dur, o + 9)) : null,
      marsh: o > pin.dur - 30,
      st,
    });
  }
  o -= pin.dur;
  if (o < 120) return AP_G(st.x, st.sy, Math.PI / 2, "park", { tp: o });
  o -= 120;
  if (o < 14) {
    const u = o / 14,
      e = u * u * (3 - 2 * u),
      hh = Math.PI / 2 + (st.x < 405 ? -1 : 1) * 0 * e;
    return AP_G(st.x, st.sy + (A.civ.lane - st.sy) * e, hh, "push");
  }
  o -= 14;
  if (o < 4) {
    const h1 = apAtT(pout, 0.5)[2];
    let dh = h1 - Math.PI / 2;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    return AP_G(st.x, A.civ.lane, Math.PI / 2 + dh * (o / 4), "start");
  }
  o -= 4;
  if (o < pout.dur) {
    const p = apAtT(pout, o);
    return AP_G(p[0], p[1], p[2], "taxo");
  }
  o -= pout.dur;
  if (o < 20) {
    const p = apAtT(pout, pout.dur);
    return AP_G(p[0], p[1], p[2], "hold");
  }
  o -= 20;
  if (o < A.lineup.dur) {
    const p = apAtT(A.lineup, o);
    return AP_G(p[0], p[1], p[2], "line");
  }
  o -= A.lineup.dur;
  if (o < 5) {
    const p = apT(A, -100, 0);
    return AP_G(p[0], p[1], A.rwA, "line");
  }
  o -= 5;
  return apTko(A, o, 1.15, 60);
}
function apFighter(A, f, t) {
  const h = f.h,
    park = AP_G(h.p[0], h.p[1], h.a, "has");
  if (!f.fly) return park;
  const P = f.P,
    tt = (((t + f.i * 311) % P) + P) % P;
  let o = tt - (P - 420);
  if (o < 0) return park;
  if (o < 8) return Object.assign(park, { ph: "start" });
  o -= 8;
  if (o < f.pOut.dur) {
    const p = apAtT(f.pOut, o);
    return AP_G(p[0], p[1], p[2], "taxo");
  }
  o -= f.pOut.dur;
  const lu = h.v < 0 ? A.lineupN : A.lineup;
  if (o < 12) {
    const p = apAtT(f.pOut, f.pOut.dur);
    return AP_G(p[0], p[1], p[2], "hold");
  }
  o -= 12;
  if (o < lu.dur) {
    const p = apAtT(lu, o);
    return AP_G(p[0], p[1], p[2], "line");
  }
  o -= lu.dur;
  if (o < 3) {
    const p = apT(A, -100, 0);
    return AP_G(p[0], p[1], A.rwA, "line", { ab: 1 });
  }
  o -= 3;
  if (o < 20) {
    const r = apTko(A, o, 2.6, -20);
    if (r) r.ab = 1;
    return r;
  }
  o -= 20;
  if (o < 80) return null;
  o -= 80;
  if (o < 16) return apApp(A, o, 16, 16);
  o -= 16;
  if (o < f.pIn.dur) {
    const p = apAtT(f.pIn, o);
    return AP_G(p[0], p[1], p[2], "taxi");
  }
  o -= f.pIn.dur;
  if (o < 10) {
    const p = apAt(f.rev, f.rev.len * (o / 10));
    return AP_G(p[0], p[1], h.a, "push");
  }
  return park;
}
// ---------- drawing helpers ----------
function apJet(g, s, col, tail) {
  g.fillStyle = "#f3f5f7";
  g.save();
  g.rotate(Math.PI / 2);
  planeShape(s);
  g.restore();
  g.fillStyle = tail;
  g.fillRect(-27 * s, -1.8 * s, 8 * s, 3.6 * s);
  g.fillStyle = col;
  g.fillRect(-18 * s, -0.7 * s, 40 * s, 1.4 * s);
  g.fillStyle = "#7f8c8d";
  for (const ey of [9, 17, -9, -17]) {
    g.beginPath();
    g.ellipse(1 * s, ey * s, 3.6 * s, 1.4 * s, 0, 0, 7);
    g.fill();
  }
  g.fillStyle = "#2c3e50";
  g.fillRect(24 * s, -2.2 * s, 2.6 * s, 4.4 * s);
}
function apFtr(g, s, shadow) {
  g.beginPath();
  const P = [
    [30, 0],
    [14, -3],
    [-10, -18],
    [-14, -18],
    [-12, -4],
    [-24, -9],
    [-27, -9],
    [-24, 0],
    [-27, 9],
    [-24, 9],
    [-12, 4],
    [-14, 18],
    [-10, 18],
    [14, 3],
  ];
  P.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
  g.closePath();
  g.fill();
  if (!shadow) {
    g.fillStyle = "#2c3e50";
    g.beginPath();
    g.ellipse(14 * s, 0, 5 * s, 1.6 * s, 0, 0, 7);
    g.fill();
    g.fillStyle = "#6c7a86";
    g.fillRect(-26 * s, -1 * s, 10 * s, 2 * s);
  }
}
function apNav(X, Y, h, w, beacon) {
  if (typeof dnLight !== "function") return;
  const c = Math.cos(h),
    sn = Math.sin(h);
  dnLight(X - sn * w, Y + c * w, 28, "rgba(40,255,90,0.9)", 0.9);
  dnLight(X + sn * w, Y - c * w, 28, "rgba(255,40,40,0.9)", 0.9);
  if (beacon && (timeS * 1.1) % 1 < 0.12) dnLight(X, Y, 70, "rgba(255,255,255,0.9)", 1);
}
function apDrawCivil(st, p) {
  const g = ctx,
    T_ = TILE,
    X = p.x * T_,
    Y = p.y * T_,
    s = st.sc,
    a = p.alt || 0,
    sc = s * (1 + a * 0.35);
  g.save();
  g.translate(X + a * 70, Y + a * 70);
  g.rotate(p.h);
  g.fillStyle = "rgba(10,15,25," + Math.max(0.08, 0.32 - a * 0.08) + ")";
  g.save();
  g.rotate(Math.PI / 2);
  planeShape(s * (1 - Math.min(0.3, a * 0.08)));
  g.restore();
  g.restore();
  g.save();
  g.translate(X, Y);
  g.rotate(p.h);
  if (a < 0.5)
    apGear(g, sc, [
      [22, 0, 1.6],
      [-4, -5, 3],
      [-4, 5, 3],
    ]);
  apJet(g, sc, st.col, st.tail);
  g.restore();
  apNav(X, Y, p.h, 26 * sc, true);
  if (p.ph !== "park" && typeof dnLight === "function")
    dnLight(
      X + Math.cos(p.h) * 34 * sc,
      Y + Math.sin(p.h) * 34 * sc,
      p.ldg ? 200 : 90,
      "rgba(255,245,210,0.6)",
      0.8,
    );
  apLights(X, Y, p, 26 * sc);
  if (p.fm) apVeh(ctx, p.fm[0] * T_, p.fm[1] * T_, p.fm[2], "follow");
  if (p.marsh) apMarsh(st.x * T_, (st.sy + (40 * st.sc) / 32) * T_);
}
function apGear(g, s, pts) {
  g.fillStyle = "#1b1f24";
  for (const [x, y, w] of pts) {
    g.fillRect((x - 1.6) * s, (y - w / 2) * s, 3.2 * s, w * s);
  }
}
function apLights(X, Y, p, w) {
  if (typeof dnLight !== "function" || p.ph === "has" || p.ph === "park") return;
  const c = Math.cos(p.h),
    sn = Math.sin(p.h),
    t = (timeS * 1.3) % 1;
  if (t < 0.06 || (t > 0.12 && t < 0.18)) {
    dnLight(X - sn * w, Y + c * w, 60, "rgba(255,255,255,0.95)", 1);
    dnLight(X + sn * w, Y - c * w, 60, "rgba(255,255,255,0.95)", 1);
  }
}
function apMarsh(x, y) {
  const g = ctx,
    k = Math.sin(timeS * 4) * 0.6;
  g.fillStyle = "#f39c12";
  g.beginPath();
  g.arc(x, y, 5, 0, 7);
  g.fill();
  g.fillStyle = "#2c3e50";
  g.beginPath();
  g.arc(x, y, 2.6, 0, 7);
  g.fill();
  g.strokeStyle = "#ff5a1f";
  g.lineWidth = 2.4;
  for (const sg of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + sg * 4, y);
    g.lineTo(x + sg * (4 + 9 * Math.cos(k)), y - 9 * Math.sin(Math.abs(k) + 0.5));
    g.stroke();
  }
  if (typeof dnLight === "function") {
    dnLight(x - 8, y - 6, 24, "rgba(255,110,40,0.9)", 0.8);
    dnLight(x + 8, y - 6, 24, "rgba(255,110,40,0.9)", 0.8);
  }
}
function apDrawFighter(f, p) {
  const g = ctx,
    T_ = TILE,
    X = p.x * T_,
    Y = p.y * T_,
    a = p.alt || 0,
    s = 1.55 * (1 + a * 0.3);
  g.save();
  g.translate(X + a * 60, Y + a * 60);
  g.rotate(p.h);
  g.fillStyle = "rgba(10,15,25," + (0.32 - a * 0.1) + ")";
  apFtr(g, 1.55, true);
  g.restore();
  g.save();
  g.translate(X, Y);
  g.rotate(p.h);
  if (a < 0.5)
    apGear(g, s, [
      [16, 0, 1.2],
      [-8, -4, 2],
      [-8, 4, 2],
    ]);
  g.fillStyle = f.col;
  apFtr(g, s, false);
  if (p.ab || p.ph === "tko") {
    g.fillStyle = "rgba(255,150,40,0.85)";
    g.beginPath();
    g.ellipse(-30 * s, 0, 6 * s, 2 * s, 0, 0, 7);
    g.fill();
  }
  g.restore();
  apNav(X, Y, p.h, 18 * s, p.ph !== "has");
  apLights(X, Y, p, 18 * s);
}
function apVeh(g, x, y, h, kind) {
  g.save();
  g.translate(x, y);
  g.rotate(h);
  const R = (c, a, b, w, l) => {
    g.fillStyle = c;
    g.beginPath();
    g.roundRect(a, b, w, l, 3);
    g.fill();
  };
  if (kind === "tug") {
    R("#f1c40f", -14, -9, 28, 18);
    R("#2c3e50", 4, -7, 8, 14);
  } else if (kind === "cart") {
    R("#7f8c8d", -12, -9, 24, 18);
    R("#d35400", -9, -6, 8, 6);
    R("#2980b9", 1, -6, 8, 6);
  } else if (kind === "fuel") {
    R("#ecf0f1", -34, -11, 52, 22);
    R("#c0392b", -34, -11, 52, 4);
    R("#2c3e50", 20, -10, 14, 20);
  } else if (kind === "cater") {
    R("#bdc3c7", -30, -11, 22, 22);
    R("#fdfefe", -8, -12, 34, 24);
    R("#2471a3", -8, -12, 34, 4);
  } else if (kind === "push") {
    R("#f39c12", -20, -12, 40, 24);
    R("#2c3e50", -6, -8, 12, 16);
  } else if (kind === "follow") {
    R("#f1c40f", -18, -9, 36, 18);
    R("#2c3e50", -2, -7, 9, 14);
    g.fillStyle = "#111";
    for (let i = -16; i < 16; i += 6) g.fillRect(i, -9, 3, 3);
    if ((timeS * 3) % 1 < 0.5) {
      g.fillStyle = "#ff9f1a";
      g.fillRect(-6, -3, 4, 6);
    }
  } else if (kind === "mil") {
    R("#556b2f", -22, -10, 44, 20);
    R("#3d4f22", 6, -8, 12, 16);
  }
  g.restore();
}
function apService(st, p, X, Y) {
  const T_ = TILE,
    tp = p.tp,
    k = Math.min(1, tp / 8) * (1 - Math.max(0, Math.min(1, (tp - 104) / 10)));
  if (k <= 0.01) return;
  const s = st.sc,
    off = (1 - k) * 14 * T_,
    g = ctx;
  apVeh(g, X + 20 * s + off, Y + 4 * s, Math.PI, "fuel");
  apVeh(g, X - 10 * s - off, Y - 12 * s, 0, "cater");
  apVeh(g, X + 8 * s + off, Y - 14 * s, Math.PI, "cater");
  for (let c = 0; c < 3; c++) apVeh(g, X - 12 * s - off - c * 28, Y + 10 * s, 0, "cart");
  apVeh(g, X - 12 * s - off - 84, Y + 10 * s, 0, "tug");
}
function apRR(g, x0, y0, x1, y1, r) {
  g.beginPath();
  g.roundRect(x0, y0, x1 - x0, y1 - y0, r);
}
function apStroke(g, pts, w, col, T_) {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0] * T_, p[1] * T_) : g.moveTo(p[0] * T_, p[1] * T_)));
  g.stroke();
}
// ---------- main ground layer ----------
function apDrawLow(vx0, vy0, vx1, vy1) {
  const A = apA();
  if (!A) return;
  const T_ = TILE,
    g = ctx;
  if (
    vx1 < A.x0 * T_ - 1500 ||
    vx0 > A.x1 * T_ + 1500 ||
    vy1 < A.y0 * T_ - 900 ||
    vy0 > (A.term.y1 + 40) * T_
  )
    return;
  const night = typeof DN !== "undefined" ? DN.dark : 0,
    vis = (x, y, m) => x * T_ > vx0 - m && x * T_ < vx1 + m && y * T_ > vy0 - m && y * T_ < vy1 + m;
  // grass infield over the concrete (airfield is grass apart from paved surfaces), rounded edges
  g.fillStyle = "#6a9e45";
  apRR(g, (A.x0 + 3) * T_, (A.y0 + 3) * T_, (A.x1 - 3) * T_, (A.y1 - 2) * T_, (40 * T_) / 8);
  g.fill();
  g.fillStyle = "rgba(255,255,230,0.05)";
  for (let x = A.x0 + 4; x < A.x1 - 4; x += 8)
    g.fillRect(x * T_, (A.y0 + 3) * T_, 4 * T_, (A.y1 - A.y0 - 5) * T_);
  // perimeter road just inside the fence
  g.strokeStyle = "#6d7074";
  g.lineWidth = 2.6 * T_;
  g.lineJoin = "round";
  apRR(g, (A.x0 + 2) * T_, (A.y0 + 2) * T_, (A.x1 - 2) * T_, (A.y1 - 1) * T_, 10 * T_);
  g.stroke();
  // paved: aprons (rounded), runway, loop, links, spurs
  const PAVE = "#4a4d52",
    CON = "#b5b4ae";
  g.fillStyle = CON;
  for (const r of [A.civ, A.mil]) {
    apRR(g, r.x0 * T_, r.y0 * T_, r.x1 * T_, r.y1 * T_, 4 * T_);
    g.fill();
  }
  g.fillStyle = CON;
  apRR(g, A.mil.x0 * T_, (A.mil.y1 - 2) * T_, A.mil.x1 * T_, (A.hang[0].y0 + 2) * T_, 2 * T_);
  g.fill();
  for (const h of A.has) {
    g.save();
    g.translate(h.p[0] * T_, h.p[1] * T_);
    g.rotate(h.a);
    g.fillStyle = CON;
    apRR(g, -8 * T_, -7 * T_, 8 * T_, 7 * T_, 3 * T_);
    g.fill();
    g.restore();
    apStroke(g, [h.p, h.q], 3.2 * T_, PAVE, T_);
  }
  apStroke(g, A.loop.concat([A.loop[0]]), 4 * T_, PAVE, T_);
  for (const [a, b] of A.links) apStroke(g, [a, b], 3.6 * T_, PAVE, T_);
  apStroke(g, [A.civLink[0], [405, 573], [405, A.civ.lane]], 3.6 * T_, PAVE, T_);
  apStroke(g, [A.milLink[0], [A.milLink[0][0], A.mil.y0 + 2]], 3.6 * T_, PAVE, T_);
  apStroke(g, [apT(A, -120, 0), apT(A, -20, 0)], 0, PAVE, T_);
  // true kerb fillets at every join: square-minus-quarter-circle pieces in both inside corners
  g.fillStyle = PAVE;
  const n = (v) => {
    const l = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / l, v[1] / l];
  };
  const fil = (J, t, bd, wm, wb, r) => {
    t = n(t);
    bd = n(bd);
    for (const sg of [1, -1]) {
      const C = [J[0] + bd[0] * wm + sg * t[0] * wb, J[1] + bd[1] * wm + sg * t[1] * wb],
        u1 = [sg * t[0], sg * t[1]],
        O = [C[0] + (u1[0] + bd[0]) * r, C[1] + (u1[1] + bd[1]) * r],
        P1 = [C[0] + u1[0] * r, C[1] + u1[1] * r],
        P2 = [C[0] + bd[0] * r, C[1] + bd[1] * r];
      const a1 = Math.atan2(P1[1] - O[1], P1[0] - O[0]),
        a2 = Math.atan2(P2[1] - O[1], P2[0] - O[0]);
      let da = a2 - a1;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      g.beginPath();
      g.moveTo(C[0] * T_, C[1] * T_);
      g.lineTo(P1[0] * T_, P1[1] * T_);
      g.arc(O[0] * T_, O[1] * T_, r * T_, a1, a1 + da, da < 0);
      g.closePath();
      g.fill();
    }
  };
  const loopT = (p) => {
    let bi = 0,
      bd = 1e18;
    for (let i = 0; i < A.loop.length; i++) {
      const q = A.loop[i],
        d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const L = A.loop.length,
      q0 = A.loop[(bi + L - 2) % L],
      q1 = A.loop[(bi + 2) % L];
    return [q1[0] - q0[0], q1[1] - q0[1]];
  };
  const rd = [Math.cos(A.rwA), Math.sin(A.rwA)],
    rn = [-rd[1], rd[0]];
  for (const [a, b] of A.links) {
    const dir = [b[0] - a[0], b[1] - a[1]];
    fil(a, loopT(a), dir, 2, 1.8, 3.5);
    fil(b, loopT(b), [-dir[0], -dir[1]], 2, 1.8, 3.5);
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      c = [m[0], m[1]];
    const uC = (m[0] - A.rwC[0]) * rd[0] + (m[1] - A.rwC[1]) * rd[1];
    const J = apT(A, uC, 0);
    fil(J, rd, rn, A.rwW / 2, 1.8, 4);
    fil(J, rd, [-rn[0], -rn[1]], A.rwW / 2, 1.8, 4);
  }
  for (const h of A.has) fil(h.q, loopT(h.q), [h.p[0] - h.q[0], h.p[1] - h.q[1]], 2, 1.6, 3);
  fil(A.civLink[0], loopT(A.civLink[0]), [0, 1], 2, 1.8, 3.5);
  fil([405, A.civ.y0], [1, 0], [0, -1], 0, 1.8, 3.5);
  fil(A.milLink[0], loopT(A.milLink[0]), [0, 1], 2, 1.8, 3.5);
  fil([A.milLink[0][0], A.mil.y0], [1, 0], [0, -1], 0, 1.8, 3.5);
  // runway (rounded ends) + markings
  g.save();
  const c0 = apT(A, 0, 0);
  g.translate(c0[0] * T_, c0[1] * T_);
  g.rotate(A.rwA);
  const L = (A.rwL * T_) / 2,
    Wd = (A.rwW * T_) / 2;
  g.fillStyle = "#3a3d42";
  apRR(g, -L - T_, -Wd, L + T_, Wd, Wd * 0.6);
  g.fill();
  g.fillStyle = "#f0f0f0";
  for (const sg of [1, -1]) {
    const e = -sg * L;
    for (let k = 0; k < 8; k++) {
      const v = -Wd + T_ * 0.6 + (k * (Wd * 2 - T_ * 1.2)) / 8;
      g.fillRect(sg > 0 ? e + T_ : e - T_ * 9, v, T_ * 8, T_ * 0.45);
    }
    for (let k = 0; k < 3; k++) {
      const u = e + sg * (T_ * 30 + k * T_ * 12);
      g.fillRect(sg > 0 ? u : u - T_ * 6, -Wd + T_ * 1.2, T_ * 6, T_ * 0.7);
      g.fillRect(sg > 0 ? u : u - T_ * 6, Wd - T_ * 1.9, T_ * 6, T_ * 0.7);
    }
    const u = e + sg * T_ * 64;
    g.fillRect(sg > 0 ? u : u - T_ * 11, -Wd + T_ * 1, T_ * 11, T_ * 1.4);
    g.fillRect(sg > 0 ? u : u - T_ * 11, Wd - T_ * 2.4, T_ * 11, T_ * 1.4);
    g.save();
    g.translate(e + sg * T_ * 16, 0);
    g.rotate(sg > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.scale(1, 1);
    g.font = "bold " + 4 * T_ + "px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(sg > 0 ? "08" : "26", 0, 0);
    g.restore();
  }
  for (let u = -L + T_ * 90; u < L - T_ * 90; u += T_ * 8)
    g.fillRect(u, -T_ * 0.2, T_ * 4.5, T_ * 0.4);
  g.fillStyle = "rgba(240,240,240,0.9)";
  g.fillRect(-L, -Wd + T_ * 0.25, 2 * L, T_ * 0.25);
  g.fillRect(-L, Wd - T_ * 0.5, 2 * L, T_ * 0.25);
  // approach light bars beyond both ends
  for (const sg of [1, -1]) {
    for (let k = 1; k <= 10; k++) {
      const u = -sg * (L + T_ * 2 + k * T_ * 3.2);
      g.fillStyle = "#d7d2b0";
      g.fillRect(u - 3, -3, 6, 6);
      if (k % 3 === 0) for (const dv of [-3, -1.5, 1.5, 3]) g.fillRect(u - 3, dv * T_ - 3, 6, 6);
      if (night > 0.05 && typeof dnLight === "function") {
        const q = apT(A, u / T_, 0);
        const blink = (timeS * 2 - k * 0.1) % 1 < 0.15;
        dnLight(q[0] * T_, q[1] * T_, blink ? 60 : 30, "rgba(255,250,220,0.95)", blink ? 1 : 0.6);
      }
    }
  }
  g.restore();
  // taxiway centrelines (yellow) + blue edge dots at night
  const yel = (pts) => apStroke(g, pts, 0.22 * T_, "#e8b923", T_);
  yel(A.loop.concat([A.loop[0]]));
  for (const [a, b] of A.links) yel([a, b]);
  yel([A.civLink[0], [405, 573], [405, A.civ.lane]]);
  for (const h of A.has) yel([h.p, h.q]);
  {
    const sA = Math.sin(A.rwA),
      cA = Math.cos(A.rwA),
      vv = (p) => -(p[0] - A.rwC[0]) * sA + (p[1] - A.rwC[1]) * cA;
    for (const R of A.taxiPaint || []) {
      let run = [];
      for (const p of R) {
        if (Math.abs(vv(p)) > 0.45) run.push(p);
        else {
          if (run.length > 1) yel(run);
          run = [];
        }
      }
      if (run.length > 1) yel(run);
    }
    // runway-holding positions: 2 solid + 2 dashed bars across each link at v=±10 (dashes face the runway)
    g.fillStyle = "#e8b923";
    for (const u of [-120, 0, 120])
      for (const sv of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const vb = sv * (10.6 - k * 0.42);
          for (let w = -2.4; w < 2.4; w += k < 2 ? 4.8 : 0.9) {
            const a = apT(A, u + w, vb),
              b = apT(A, u + Math.min(2.4, w + (k < 2 ? 4.8 : 0.55)), vb);
            g.save();
            g.translate(a[0] * T_, a[1] * T_);
            g.rotate(A.rwA);
            g.fillRect(0, -0.08 * T_, Math.hypot(b[0] - a[0], b[1] - a[1]) * T_, 0.16 * T_);
            g.restore();
          }
        }
      }
  }
  yel([
    [A.civ.x0 + 3, A.civ.lane],
    [A.civ.x1 - 3, A.civ.lane],
  ]);
  for (const st of A.stands) {
    yel([
      [st.x, A.civ.lane],
      [st.x, A.civ.y1 - 2],
    ]);
    const ny = st.sy + (30 * st.sc) / 32;
    g.fillStyle = "#e8b923";
    g.fillRect((st.x - 2.2) * T_, (ny + 0.2) * T_, 4.4 * T_, 0.45 * T_);
    g.fillStyle = "#f0f0f0";
    g.fillRect((st.x - 1.4) * T_, (ny - 1.6) * T_, 2.8 * T_, 0.3 * T_);
    g.font = "bold 22px sans-serif";
    g.fillStyle = "#e8b923";
    g.fillText("STOP", (st.x + 2.6) * T_, (ny + 0.8) * T_);
  }
  // holding points
  g.fillStyle = "#e8b923";
  for (const [a, b] of A.links)
    for (const p of [a, b]) {
      const q = [p[0] + (apT(A, 0, 0)[0] - p[0]) * 0.0, p[1]];
    }
  if (night > 0.05 && typeof dnLight === "function") {
    for (let i = 0; i < A.loop.length; i += 10) {
      const p = A.loop[i];
      if (vis(p[0], p[1], 300)) dnLight(p[0] * T_, p[1] * T_, 16, "rgba(70,140,255,0.9)", 0.8);
    }
    for (let u = -A.rwL / 2; u <= A.rwL / 2; u += 8)
      for (const v of [-A.rwW / 2 - 0.6, A.rwW / 2 + 0.6]) {
        const p = apT(A, u, v);
        if (vis(p[0], p[1], 200)) dnLight(p[0] * T_, p[1] * T_, 18, "rgba(255,240,190,0.95)", 0.85);
      }
    for (const sg of [1, -1])
      for (let v = -A.rwW / 2; v <= A.rwW / 2; v += 1.5) {
        const p = apT(A, (sg * A.rwL) / 2, v);
        dnLight(
          p[0] * T_,
          p[1] * T_,
          16,
          sg < 0 ? "rgba(60,255,110,0.95)" : "rgba(255,60,60,0.95)",
          0.9,
        );
      }
  }
  // stand boxes + numbers
  g.strokeStyle = "rgba(240,240,240,0.7)";
  g.lineWidth = 3;
  for (const st of A.stands) {
    const w = (56 * st.sc) / 32,
      l = (62 * st.sc) / 32;
    apRR(g, (st.x - w / 2) * T_, (A.civ.y1 - 1 - l) * T_, w * T_, 0, 0);
    g.beginPath();
    g.roundRect((st.x - w / 2) * T_, (A.civ.y1 - 1 - l) * T_, w * T_, l * T_, T_);
    g.stroke();
    g.fillStyle = "#fff";
    g.font = "bold 40px sans-serif";
    g.fillText(String(st.k + 1), (st.x + w / 2 - 2) * T_, (A.civ.y1 - 1.6) * T_);
  }
  // buildings: HAS shelters, Type C hangars, fire station, tower, fuel farm
  for (const h of A.has) {
    g.save();
    g.translate(h.p[0] * T_, h.p[1] * T_);
    g.rotate(h.a);
    g.fillStyle = "rgba(0,0,0,0.25)";
    apRR(g, -6 * T_ + 10, -5 * T_ + 10, 4 * T_ + 10, 5 * T_ + 10, 2.4 * T_);
    g.fill();
    g.fillStyle = "#6f7a63";
    apRR(g, -6 * T_, -5 * T_, 4 * T_, 5 * T_, 2.4 * T_);
    g.fill();
    g.strokeStyle = "#5c6652";
    g.lineWidth = 3;
    for (let k = -4.5; k < 3.6; k += 1.4) {
      g.beginPath();
      g.moveTo(k * T_, -4.6 * T_);
      g.lineTo(k * T_, 4.6 * T_);
      g.stroke();
    }
    g.fillStyle = "#3e4636";
    g.fillRect(3.6 * T_, -4 * T_, 0.6 * T_, 8 * T_);
    g.restore();
  }
  for (const hg of A.hang) {
    g.fillStyle = "rgba(0,0,0,0.25)";
    apRR(g, hg.x0 * T_ + 14, hg.y0 * T_ + 14, hg.x1 * T_ + 14, hg.y1 * T_ + 14, T_);
    g.fill();
    g.fillStyle = "#9aa3ab";
    apRR(g, hg.x0 * T_, hg.y0 * T_, hg.x1 * T_, hg.y1 * T_, T_);
    g.fill();
    g.strokeStyle = "#87909a";
    g.lineWidth = 4;
    for (let y = hg.y0 + 2; y < hg.y1 - 1; y += 2) {
      g.beginPath();
      g.moveTo((hg.x0 + 1) * T_, y * T_);
      g.lineTo((hg.x1 - 1) * T_, y * T_);
      g.stroke();
    }
    g.fillStyle = "#2c3e50";
    g.font = "bold 60px sans-serif";
    g.fillText("C" + (hg.k + 1), (hg.x0 + 11) * T_, (hg.y0 + 11) * T_);
    g.fillStyle = "#4b5560";
    g.fillRect((hg.x0 + 2) * T_, (hg.y0 - 0.4) * T_, (hg.x1 - hg.x0 - 4) * T_, 0.6 * T_);
  }
  {
    const r = A.fire;
    g.fillStyle = "#c0392b";
    apRR(g, r.x0 * T_, r.y0 * T_, r.x1 * T_, r.y1 * T_, T_ * 0.8);
    g.fill();
    g.fillStyle = "#e74c3c";
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.roundRect((r.x0 + 1.5 + k * 6) * T_, r.y1 * T_, 4 * T_, 3 * T_, 8);
      g.fill();
    }
    g.fillStyle = "#fff";
    g.font = "bold 44px sans-serif";
    g.fillText("FIRE", (r.x0 + 8) * T_, (r.y0 + 8.5) * T_);
  }
  {
    const [x, y] = A.tower;
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.arc(x * T_ + 16, y * T_ + 16, 4.4 * T_, 0, 7);
    g.fill();
    g.fillStyle = "#4b5560";
    g.beginPath();
    g.arc(x * T_, y * T_, 4.4 * T_, 0, 7);
    g.fill();
    g.fillStyle = "#7fb3d5";
    g.beginPath();
    g.arc(x * T_, y * T_, 3.6 * T_, 0, 7);
    g.fill();
    g.fillStyle = "#d9dde2";
    g.beginPath();
    g.arc(x * T_, y * T_, 2 * T_, 0, 7);
    g.fill();
    if (night > 0.05 && typeof dnLight === "function") {
      dnLight(x * T_, y * T_, 120, "rgba(150,220,255,0.7)", 0.8);
      if (timeS % 2 < 0.3) dnLight(x * T_, y * T_, 60, "rgba(255,40,40,0.9)", 1);
    }
  }
  {
    const r = A.fuel;
    g.fillStyle = "#9c9a8f";
    apRR(g, r.x0 * T_, r.y0 * T_, r.x1 * T_, r.y1 * T_, T_);
    g.fill();
    g.fillStyle = "#e8e8e2";
    g.strokeStyle = "#888";
    g.lineWidth = 3;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 3; j++) {
        g.beginPath();
        g.arc((r.x0 + 5 + i * 10) * T_, (r.y0 + 4.5 + j * 7.5) * T_, 3.2 * T_, 0, 7);
        g.fill();
        g.stroke();
      }
  }
  // fence: wire + barbed coil + posts, gates with guard huts
  g.strokeStyle = "#8a9096";
  g.lineWidth = 2;
  for (const [a, b, c, d] of A.segs) {
    g.beginPath();
    g.moveTo(a * T_, b * T_);
    g.lineTo(c * T_, d * T_);
    g.stroke();
  }
  g.strokeStyle = "rgba(60,64,70,0.9)";
  g.lineWidth = 1.2;
  for (const [a, b, c, d] of A.segs) {
    if (
      Math.max(a, c) * T_ < vx0 - 50 ||
      Math.min(a, c) * T_ > vx1 + 50 ||
      Math.max(b, d) * T_ < vy0 - 50 ||
      Math.min(b, d) * T_ > vy1 + 50
    )
      continue;
    const Ln = Math.hypot(c - a, d - b) * T_,
      ux = ((c - a) * T_) / Ln,
      uy = ((d - b) * T_) / Ln;
    g.beginPath();
    for (let s = 0; s < Ln; s += 6) {
      const x = a * T_ + ux * s,
        y = b * T_ + uy * s,
        o = (s / 6) & 1 ? 4 : -4;
      if (A.gates.some((q) => Math.hypot(q.x * T_ - x, q.y * T_ - y) < (q.w / 2 + 0.5) * T_)) {
        g.moveTo(x, y);
        continue;
      }
      g.lineTo(x - uy * o, y + ux * o);
    }
    g.stroke();
  }
  g.fillStyle = "#5d6166";
  for (const [x, y] of A.posts) g.fillRect(x * T_ - 3, y * T_ - 3, 6, 6);
  for (const q of A.gates) {
    const x = q.x * T_,
      y = q.y * T_,
      hw = (q.w / 2) * T_;
    g.fillStyle = "#ecf0f1";
    apRR(
      g,
      x - (q.dx ? hw + 60 : 30),
      y - (q.dy ? hw + 60 : 30),
      x - (q.dx ? hw : -30),
      y - (q.dy ? hw : -30),
      8,
    );
    g.fill();
    g.fillStyle = "#2c3e50";
    g.fillRect(x - (q.dx ? hw + 56 : 26), y - (q.dy ? hw + 56 : 26), 52, 8);
    g.fillStyle = "#5dade2";
    g.fillRect(x - (q.dx ? hw + 52 : 22), y - (q.dy ? hw + 40 : 10), 44, 12);
    g.strokeStyle = "#e74c3c";
    g.lineWidth = 5;
    g.beginPath();
    if (q.dx) {
      g.moveTo(x - hw, y);
      g.lineTo(x - hw + 12, y - 60);
    } else {
      g.moveTo(x, y - hw);
      g.lineTo(x - 60, y - hw + 12);
    }
    g.stroke();
  }
  // landside forecourt: drop-off loop, multi-storey + surface car parks
  apLandside(A, night);
  // parked/static military: fighters on the apron + one in hangar C2's doorway, a fuel bowser, tugs
  for (let k = 0; k < 3; k++) {
    const x = (A.mil.x0 + 16 + k * 32) * T_,
      y = (A.mil.y0 + 14) * T_;
    apDrawFighter({ col: "#8e9aa4" }, { x: x / T_, y: y / T_, h: Math.PI / 2, alt: 0, ph: "has" });
    apVeh(g, x + 70, y + 40, 0, "mil");
  }
  apDrawFighter(
    { col: "#7d8a95" },
    { x: A.hang[1].x0 + 14, y: A.hang[1].y0 + 3, h: -Math.PI / 2, alt: 0, ph: "has" },
  );
  apFieldLights(A, vx0, vy0, vx1, vy1);
  // aircraft on the ground
  if (!APX.noAc)
    for (const st of A.stands) {
      const p = apCivil(A, st, apLT(st));
      if (p && p.alt <= 0.05 && vis(p.x, p.y, 900)) {
        apDrawCivil(st, p);
        if (p.ph === "park") apService(st, p, p.x * T_, p.y * T_);
        if (p.ph === "push")
          apVeh(g, p.x * T_, (p.y + (33 * st.sc) / 32) * T_, Math.PI / 2, "push");
      }
      apBridge(A, st, p);
    }
  if (!APX.noAc)
    for (const f of A.fighters) {
      const p = apFighter(A, f, apLT(f));
      if (p && p.alt <= 0.05 && vis(p.x, p.y, 600)) apDrawFighter(f, p);
    }
  apTerminal(A, vx0, vy0, vx1, vy1, night);
}
function apBridge(A, st, p) {
  const g = ctx,
    T_ = TILE,
    ty = A.civ.y1 * T_,
    X = st.x * T_,
    ny = (st.sy + (24 * st.sc) / 32) * T_,
    ext = p && p.ph === "park" && p.tp > 3 && p.tp < 116,
    y1 = ext ? ny : ty - 3 * T_,
    dx = X - 6 * st.sc;
  g.fillStyle = "#4f5b66";
  g.beginPath();
  g.roundRect(dx - 12, y1, 24, ty - y1, 6);
  g.fill();
  g.fillStyle = "#aab7c4";
  g.fillRect(dx - 9, y1 + 2, 18, ty - y1 - 4);
  g.fillStyle = "#34495e";
  g.beginPath();
  g.roundRect(dx - 16, y1 - 6, 32, 10, 4);
  g.fill();
}
function apLandside(A, night) {
  const g = ctx,
    T_ = TILE,
    rnd = mulberry(77);
  // drop-off loop + kerbside along the terminal front (real road tiles already laid; this is the painted surface)
  // v41: arrivals frontage is a real road now (392..433 x 692..694, v44: moved south clear of the canopy); paint drop-off bays + DROP OFF lettering on the kerb lane by the doors, zebras across to the car parks
  g.strokeStyle = "#f0f0f0";
  g.lineWidth = 0.14 * T_;
  for (const bx of APX_BAYS) {
    g.strokeRect((bx - 2.4) * T_, 692.1 * T_, 4.8 * T_, 1.1 * T_);
  }
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "bold " + 0.55 * T_ + "px sans-serif";
  g.textAlign = "center";
  for (const bx of APX_BAYS) g.fillText("DROP OFF", bx * T_, 692.85 * T_);
  g.textAlign = "left";
  g.fillStyle = "#f0f0f0";
  for (const zx of [398, 424]) {
    for (let k = 0; k < 5; k++) g.fillRect((zx + k * 0.7) * T_, 692.2 * T_, 0.4 * T_, 2.6 * T_);
  }
  // v40: tidy outer kerb on the access road's south-east L-bend (410..414,716..720): pave outside a 4-tile arc round the inner corner
  {
    const cx = 410 * T_,
      cy = 716 * T_,
      r = 4 * T_;
    g.fillStyle = "#c4c2bb";
    g.beginPath();
    g.moveTo(cx + r, cy + r);
    g.lineTo(cx + r, cy);
    g.arc(cx, cy, r, 0, Math.PI / 2, false);
    g.closePath();
    g.fill();
    g.strokeStyle = "#e2dfd6";
    g.lineWidth = 0.18 * T_;
    g.beginPath();
    g.arc(cx, cy, r - 0.1 * T_, 0, Math.PI / 2, false);
    g.stroke();
  }
  // v42: multi-storey = open top deck (real parked cars come from initParked on its lot object): parapet wall, stair/lift cores, ramp, signs
  {
    const m = A.ms,
      x0 = m.x0 * T_,
      y0 = m.y0 * T_,
      w = (m.x1 - m.x0) * T_,
      h = (m.y1 - m.y0) * T_,
      t = 0.9 * T_;
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(x0 + w, y0 + 10, 12, h);
    g.fillRect(x0 + 10, y0 + h, w, 12);
    g.fillStyle = "#b9bec4";
    g.fillRect(x0, y0, w, t);
    g.fillRect(x0, y0 + h - t, w, t);
    g.fillRect(x0, y0, t, h);
    g.fillRect(x0 + w - t, y0, t, 8 * T_);
    g.fillRect(x0 + w - t, y0 + 12 * T_, t, h - 12 * T_);
    g.fillStyle = "#d5d9dd";
    g.fillRect(x0, y0, w, 0.3 * T_);
    g.fillRect(x0, y0, 0.3 * T_, h);
    for (const [cx, cy] of [
      [m.x1 - 3, m.y0 + 2.2],
      [m.x0 + 2.2, m.y1 - 3],
    ]) {
      g.fillStyle = "#6c7a89";
      g.fillRect((cx - 1.4) * T_, (cy - 1.4) * T_, 2.8 * T_, 2.8 * T_);
      g.fillStyle = "#2e86c1";
      g.fillRect((cx - 0.9) * T_, (cy - 0.9) * T_, 1.8 * T_, 1.8 * T_);
      g.fillStyle = "#fff";
      g.font = "bold " + 0.9 * T_ + "px sans-serif";
      g.textAlign = "center";
      g.fillText("⇅", cx * T_, (cy + 0.35) * T_);
      g.textAlign = "left";
    }
    g.fillStyle = "rgba(255,255,255,0.85)";
    for (let x = m.x1 - 6; x > m.x0 + 3; x -= 7) {
      const X = x * T_,
        Y = 702 * T_;
      g.beginPath();
      g.moveTo(X - 1.4 * T_, Y);
      g.lineTo(X, Y - 0.6 * T_);
      g.lineTo(X, Y - 0.25 * T_);
      g.lineTo(X + 1.4 * T_, Y - 0.25 * T_);
      g.lineTo(X + 1.4 * T_, Y + 0.25 * T_);
      g.lineTo(X, Y + 0.25 * T_);
      g.lineTo(X, Y + 0.6 * T_);
      g.closePath();
      g.fill();
    }
    g.fillStyle = "#f4d03f";
    g.font = "bold 70px sans-serif";
    g.fillText("P", (m.x0 + 1) * T_, (m.y0 - 0.5) * T_);
    g.fillStyle = "#2c3e50";
    g.font = "bold 30px sans-serif";
    g.fillText("MULTI-STOREY • ENTRANCE →", (m.x0 + 4) * T_, (m.y0 - 0.6) * T_);
  }
  // surface car park bay paint (cars come from initParked on the lot objects)
  for (const L of A.lots || []) {
    g.fillStyle = "#f4d03f";
    g.font = "bold 50px sans-serif";
    g.fillText("P", (L.x0 + 0.6) * T_, (L.y0 + 1.9) * T_);
  }
  // animated cars: loop from the access road into a bay then leave (pure function of timeS)
  // pedestrians between parks, drop-off and the terminal doors
  apPeds(A);
  apDropPeds();
  if (night > 0.05 && typeof dnLight === "function") {
    for (let x = 360; x < 442; x += 10) dnLight(x * T_, 691 * T_, 90, "rgba(255,225,170,0.7)", 0.7);
    dnLight(431 * T_, 710 * T_, 160, "rgba(255,225,170,0.6)", 0.6);
    dnLight(370 * T_, 702 * T_, 200, "rgba(255,225,170,0.55)", 0.55);
  }
}
function apCar(g, x, y, h, col, L) {
  g.save();
  g.translate(x, y);
  g.rotate(h - Math.PI / 2);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.roundRect(-L * 0.45 + 4, -10, L * 0.9, 20, 4);
  g.fill();
  g.fillStyle = col;
  g.beginPath();
  g.roundRect(-L * 0.45, -9, L * 0.9, 18, 4);
  g.fill();
  g.fillStyle = "#7f8c8d";
  g.fillRect(-L * 0.15, -7, L * 0.35, 14);
  g.restore();
}
// v40: real park/leave cycle. Parked AI cars at a few kerb-row slots next to the 708 car-park road are lifted out of traffic.parked
// and animated: drive in along the lane, swing into the slot, park (driver walks to the terminal), pull out and drive on.
function apSlots(A) {
  if (A.slots) return A.slots;
  A.slots = [];
  if (typeof traffic === "undefined" || !traffic.parked || !traffic.parked.length) return A.slots;
  for (const L of A.lots || []) {
    const xs = L.x0 * 4,
      xe = L.x1 * 4;
    const row = traffic.parked
      .filter((v) => v.x > xs + 3 && v.x < xe - 3 && v.y > 2822 && v.y < 2832)
      .sort((a, b) => a.x - b.x);
    if (!row.length) continue;
    const ry = row[0].y,
      pick = [];
    for (let x = xs + 4; x < xe - 4; x += 2.8) {
      if (pick.length >= 5) break;
      if (((x * 7) | 0) % 3 === 0) pick.push(x);
    }
    for (const x of pick) {
      for (let k = traffic.parked.length - 1; k >= 0; k--) {
        const v = traffic.parked[k];
        if (Math.abs(v.x - x) < 1.6 && Math.abs(v.y - ry) < 1.5) traffic.parked.splice(k, 1);
      }
      if (traffic.parkedIdx)
        for (const arr of traffic.parkedIdx.values())
          for (let k = arr.length - 1; k >= 0; k--)
            if (Math.abs(arr[k].x - x) < 1.6 && Math.abs(arr[k].y - ry) < 1.5) arr.splice(k, 1);
      A.slots.push({ x, y: ry, i: A.slots.length });
    }
  }
  return A.slots;
}
function apSlotState(sl, t) {
  const P = 140 + sl.i * 23,
    tt = (((t + sl.i * 37) % P) + P) % P,
    lane = 2835,
    x0 = 1650,
    xEnd = 1950,
    sp = 8,
    E = Math.PI / 2; // headings: game convention (0 = north, PI/2 = east)
  const tIn = (sl.x - 4 - x0) / sp;
  if (tt < tIn) return { x: x0 + tt * sp, y: lane, h: E, ph: "in" };
  let o = tt - tIn;
  if (o < 3.5) {
    const u = o / 3.5,
      a = (u * Math.PI) / 2;
    return {
      x: sl.x - 4 + 4 * Math.sin(a),
      y: lane - (lane - sl.y) * (1 - Math.cos(a)) * 0.55 - (lane - sl.y) * 0.45 * u * u,
      h: E * (1 - u),
      ph: "turn",
    };
  }
  o -= 3.5;
  if (o < 80) return { x: sl.x, y: sl.y, h: 0, ph: "park", tp: o };
  o -= 80;
  if (o < 3.5) {
    const u = o / 3.5;
    return {
      x: sl.x + 2 * u * u,
      y: sl.y + (lane - sl.y) * Math.sin((u * Math.PI) / 2),
      h: E * u * u,
      ph: "out",
    };
  }
  o -= 3.5; // reverse out, swing round to face east
  const x = sl.x + 2 + o * sp;
  if (x > xEnd) return null;
  return { x, y: lane, h: E, ph: "away" };
}
function apParkFlow(A) {
  const g = ctx,
    cols = ["#c0392b", "#2980b9", "#ecf0f1", "#2c3e50", "#f1c40f", "#27ae60", "#8e44ad"];
  // drop-off loop circulation
  for (const sl of apSlots(A)) {
    const p = apSlotState(sl, timeS);
    if (!p) continue;
    apCar(g, p.x * PPM, p.y * PPM, p.h, cols[sl.i % cols.length], 35);
  }
  // multi-storey ramp: one car up, one down
  {
    const t = (timeS * 0.08) % 1;
    apCar(g, (390 + t * 20) * TILE, 701.2 * TILE, Math.PI / 2, cols[1], 35);
    const u = (timeS * 0.08 + 0.5) % 1;
    apCar(g, (410 - u * 20) * TILE, 702.4 * TILE, -Math.PI / 2, cols[4], 35);
  }
}
function apPedDraw(g, x, y, col, ph) {
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.ellipse(x + 1.5, y + 1.5, 4, 3, 0, 0, 7);
  g.fill();
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y, 4.2, 3, 0, 0, 7);
  g.fill();
  g.fillStyle = "#2b1d0e";
  g.beginPath();
  g.arc(x, y, 2.3, 0, 7);
  g.fill();
  const sw = Math.sin(ph) * 2;
  g.fillStyle = "#34495e";
  g.fillRect(x - 3 + sw, y + 2, 1.6, 2.4);
  g.fillRect(x + 1.4 - sw, y + 2, 1.6, 2.4);
}
function apWalk(P, u) {
  let L = 0;
  const seg = [];
  for (let i = 1; i < P.length; i++) {
    const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    seg.push(d);
    L += d;
  }
  let d = u * L;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) {
      const f = d / seg[i];
      return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f];
    }
    d -= seg[i];
  }
  return P[P.length - 1];
}
function apPeds(A) {
  const g = ctx,
    T_ = TILE,
    cols = ["#c0392b", "#2980b9", "#27ae60", "#f1c40f", "#8e44ad", "#ecf0f1", "#e67e22"];
  // v42: footway-only routes: MSCP lift core -> x388 footpath -> terminal-front pavement (row 688) -> doors; surface parks -> their north footpath -> plaza -> east doors.
  const paths = [
    [
      [385, 694.2],
      [388.5, 694.2],
      [388.5, 688.5],
      [402, 688.5],
    ],
    [
      [388.5, 697],
      [388.5, 688.5],
      [372, 688.5],
    ],
    [
      [440, 695.5],
      [440, 688.5],
      [452, 688.5],
    ],
    [
      [470, 695.5],
      [470, 688.5],
      [462, 688.5],
    ],
    [
      [484, 695.5],
      [484, 688.5],
      [478, 688.5],
    ],
  ];
  for (let i = 0; i < 12; i++) {
    const P = paths[i % paths.length],
      u = (timeS * 0.035 + i * 0.173) % 1,
      q = apWalk(i % 2 ? P : P.slice().reverse(), u);
    apPedDraw(g, q[0] * T_, q[1] * T_, cols[i % cols.length], timeS * 9 + i);
  }
}
function apHall(g, x0, y0, x1, y1, T_, vaultDir) {
  const W = x1 - x0,
    H = y1 - y0,
    cx = (x0 + x1) / 2,
    R = Math.min(3 * T_, H / 3);
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.beginPath();
  g.roundRect(x0 + 1.2 * T_, y0 + 1.2 * T_, W, H, R);
  g.fill();
  g.fillStyle = "#8f9aa5";
  g.beginPath();
  g.roundRect(x0, y0 + 0.8 * T_, W + 0.6 * T_, H, R);
  g.fill();
  const vg = g.createLinearGradient(0, y0, 0, y1);
  vg.addColorStop(0, "#cfe6f7");
  vg.addColorStop(0.35, "#8cc1e8");
  vg.addColorStop(0.65, "#5b9fd6");
  vg.addColorStop(1, "#3d7fb8");
  g.fillStyle = vg;
  g.beginPath();
  g.roundRect(x0, y0, W, H, R);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 0.18 * T_;
  for (let x = x0 + 3 * T_; x < x1 - 2 * T_; x += 5 * T_) {
    g.beginPath();
    g.moveTo(x, y0 + 0.4 * T_);
    g.quadraticCurveTo(x + 1.2 * T_, (y0 + y1) / 2, x, y1 - 0.4 * T_);
    g.stroke();
  }
  g.lineWidth = 0.12 * T_;
  g.strokeStyle = "rgba(255,255,255,0.55)";
  for (let k = 1; k < 6; k++) {
    const yy = y0 + (k * H) / 6;
    g.beginPath();
    g.moveTo(x0 + 1.5 * T_, yy);
    g.quadraticCurveTo(cx, yy - (k - 3) * 0.5 * T_, x1 - 1.5 * T_, yy);
    g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.28)";
  g.beginPath();
  g.roundRect(x0 + 2 * T_, y0 + H * 0.2, W - 4 * T_, H * 0.1, H * 0.05);
  g.fill();
  g.fillStyle = "#d5dbe0";
  g.fillRect(x0 + R * 0.5, vaultDir > 0 ? y1 - 0.5 * T_ : y0, W - R, 0.5 * T_);
} // parapet along the station side
function apTerminal(A, vx0, vy0, vx1, vy1, night) {
  const T_ = TILE,
    g = ctx,
    t = A.term,
    x0 = t.x0 * T_,
    x1 = t.x1 * T_,
    y0 = t.y0 * T_,
    y1 = t.y1 * T_,
    W = x1 - x0,
    H = y1 - y0;
  if (x1 < vx0 - 200 || x0 > vx1 + 200 || y1 < vy0 - 200 || y0 > vy1 + 200) return;
  const rs0 = 669.6 * T_,
    rs1 = 676.4 * T_; // rail corridor open to the sky between the airside (north) and landside (south) halls
  apHall(g, x0, y0, x1, rs0, T_, 1);
  apHall(g, x0, rs1, x1, y1, T_, -1);
  // jet bridge pier roots (airside hall)
  g.fillStyle = "#b8c3cd";
  for (const st of A.stands) {
    g.beginPath();
    g.roundRect(st.x * T_ - 1.5 * T_, y0 - 1.2 * T_, 3 * T_, 1.6 * T_, 0.5 * T_);
    g.fill();
  }
  // landside canopy + DEPARTURES sign over the doors
  {
    const px = x0 + W * 0.22,
      py = y1 - 0.6 * T_,
      pw = W * 0.36;
    g.fillStyle = "#e9eef2";
    g.beginPath();
    g.roundRect(px, py, pw, 2.2 * T_, 0.8 * T_);
    g.fill();
    g.strokeStyle = "#8a949e";
    g.lineWidth = 0.15 * T_;
    g.stroke();
    g.fillStyle = "#1f4e9c";
    g.beginPath();
    g.roundRect(px + pw * 0.3, py + 0.3 * T_, pw * 0.4, 1.6 * T_, 0.4 * T_);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold " + 1.1 * T_ + "px sans-serif";
    g.textAlign = "center";
    fitText(g, "\u2708 DEPARTURES", px + pw * 0.5, py + 1.5 * T_, pw * 0.4 - 0.3 * T_, "apt-departures", { wrap: false });
    g.textAlign = "left";
  }
  // roof lettering: airside hall + landside hall
  g.textAlign = "center";
  g.fillStyle = "rgba(20,50,100,0.85)";
  g.font = "bold " + 3.6 * T_ + "px sans-serif";
  fitText(g, "ALBION AIRPORT", x0 + W * 0.36, y0 + (rs0 - y0) * 0.55, W * 0.6, "apt-roof");
  g.font = "bold " + 1.4 * T_ + "px sans-serif";
  fitText(g, "\u2708 Gates 1\u20133  \u2022  Airside", x0 + W * 0.36, y0 + (rs0 - y0) * 0.55 + 2.2 * T_, W * 0.6, "apt-roof2", { wrap: false });
  g.font = "bold " + 1.6 * T_ + "px sans-serif";
  fitText(g, "Check-in  \u2022  Arrivals  \u2022  \u{1F686} Airport Station", x0 + W * 0.4, rs1 + (y1 - rs1) * 0.5, W * 0.72, "apt-roof3", { wrap: false });
  g.textAlign = "left";
  if (night > 0.2 && typeof dnLight === "function") {
    for (let x = x0 + 6 * T_; x < x1; x += 12 * T_) {
      dnLight(x, y0 + T_, 140, "rgba(180,220,255,0.75)", 0.7);
      dnLight(x, y1, 130, "rgba(255,235,180,0.7)", 0.7);
      dnLight(x, rs0 + T_, 120, "rgba(255,240,200,0.8)", 0.8);
      dnLight(x, rs1 - T_, 120, "rgba(255,240,200,0.8)", 0.8);
    }
  }
}
// over the trains: two glass footbridges joining the halls + platform nameboards
function apStationHigh(A, night) {
  const T_ = TILE,
    g = ctx,
    t = A.term,
    rs0 = 669.6 * T_,
    rs1 = 676.4 * T_,
    W = (t.x1 - t.x0) * T_;
  for (const f of [0.3, 0.62]) {
    const bx = t.x0 * T_ + W * f;
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(bx - 1.1 * T_ + 0.6 * T_, rs0 + 0.6 * T_, 3.2 * T_, rs1 - rs0);
    g.fillStyle = "#9aa6b1";
    g.fillRect(bx - 1.1 * T_, rs0, 3.2 * T_, rs1 - rs0);
    const gg = g.createLinearGradient(bx - T_, 0, bx + 2 * T_, 0);
    gg.addColorStop(0, "#bfe0f5");
    gg.addColorStop(1, "#6fa8d8");
    g.fillStyle = gg;
    g.fillRect(bx - 0.9 * T_, rs0, 2.8 * T_, rs1 - rs0);
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 0.1 * T_;
    for (let y = rs0; y < rs1; y += 1.1 * T_) {
      g.beginPath();
      g.moveTo(bx - 0.9 * T_, y);
      g.lineTo(bx + 1.9 * T_, y);
      g.stroke();
    }
    if (night > 0.2 && typeof dnLight === "function")
      dnLight(bx + 0.5 * T_, (rs0 + rs1) / 2, 90, "rgba(220,240,255,0.8)", 0.8);
  }
  g.font = "bold " + 0.8 * T_ + "px sans-serif";
  g.textAlign = "center";
  for (const x of [416, 440, 458])
    for (const y of [rs0 + 0.15 * T_, rs1 - 1.15 * T_]) {
      const X = x * T_;
      g.fillStyle = "#1f4e9c";
      g.fillRect(X - 3.2 * T_, y, 6.4 * T_, T_);
      g.fillStyle = "#fff";
      fitText(g, "ALBION AIRPORT \u2708", X, y + 0.78 * T_, 6.4 * T_ - 0.4 * T_, "apt-banner", { wrap: false });
    }
  g.textAlign = "left";
}

function apDrawHigh() {
  const A = apA();
  if (!A) return;
  {
    const t = A.term;
    if (Math.abs(t.x0 * TILE - cam.x) < 2600 / cam.z)
      apStationHigh(A, typeof DN !== "undefined" ? DN.dark : 0);
  }
  for (const st of A.stands) {
    const p = apCivil(A, st, apLT(st));
    if (p && p.alt > 0.05) apDrawCivil(st, p);
  }
  for (const f of A.fighters) {
    const p = apFighter(A, f, apLT(f));
    if (p && p.alt > 0.05) apDrawFighter(f, p);
  }
}
setTimeout(() => {
  if (typeof drawPortTrucksLow === "function") {
    const d = drawPortTrucksLow;
    drawPortTrucksLow = function (a, b, c, e) {
      const r = d.apply(this, arguments);
      try {
        apDrawLow(a, b, c, e);
      } catch (err) {
        if (!APX.err) {
          APX.err = String((err && err.stack) || err);
          console.error(err);
        }
      }
      return r;
    };
  }
  if (typeof drawPlanes === "function") {
    const d = drawPlanes;
    drawPlanes = function (v) {
      const r = d.apply(this, arguments);
      try {
        apDrawHigh();
      } catch (err) {
        APX.err2 = String(err);
      }
      return r;
    };
  }
  if (typeof siteLights === "function") {
    const sl = siteLights;
    siteLights = function (add) {
      sl.apply(this, arguments);
      const A = apA();
      if (!A) return;
      const T_ = TILE;
      A.posts.forEach(([x, y], i) => {
        if (i % 2 === 0) add(x * T_, y * T_, 170, "fl");
      });
      for (const q of A.gates) add(q.x * T_, q.y * T_, 240, "fl");
      for (const st of A.stands) add(st.x * T_, (A.civ.y1 - 12) * T_, 320, "fl");
      for (let k = 0; k < 3; k++)
        add((A.mil.x0 + 16 + k * 32) * T_, (A.mil.y0 + 10) * T_, 300, "fl");
    };
  }
}, 0);
// ---------- solid aircraft: fuselage + wing + tailplane rectangles (tiles), rebuilt once per game tick ----------
function apPlaneSolids() {
  const A = apA();
  if (!A) return null;
  if (A._solT === timeS) return A._sol;
  const L = [];
  const add = (p, s, k) => {
    if (!p || p.alt > 0.05) return;
    L.push({ x: p.x, y: p.y, c: Math.cos(p.h), s: Math.sin(p.h), k, sc: s / TILE });
  };
  for (const st of A.stands) add(apCivil(A, st, apLT(st)), st.sc, 0);
  for (const f of A.fighters) add(apFighter(A, f, apLT(f)), 1.55, 1);
  for (let k = 0; k < 3; k++)
    add({ x: A.mil.x0 + 16 + k * 32, y: A.mil.y0 + 14, h: Math.PI / 2, alt: 0 }, 1.55, 1);
  A._solT = timeS;
  A._sol = L;
  return L;
}
// shapes in plane-local units (x along nose, y across): civil = planeShape rotated, fighter = apFtr
const AP_BOX = [
  [
    [-27, 30, -4, 4],
    [-8, 4, -26, 26],
    [-29, -20, -11, 11],
  ],
  [
    [-24, 30, -3, 3],
    [-14, 6, -17, 17],
    [-27, -22, -9, 9],
  ],
];
function apSolidM(mx, my) {
  const A = apA();
  if (!A) return false;
  const x = mx / M_T,
    y = my / M_T;
  // v44: the whole terminal (both halls + the roofed rail corridor between them) is solid: no driving under / onto the roof
  if (A.term && x >= A.term.x0 && x < A.term.x1 && y >= A.term.y0 && y < A.term.y1) return true;
  if (x < A.x0 || x > A.x1 || y < A.y0 || y > A.y1) return false;
  const L = apPlaneSolids();
  if (!L) return false;
  for (const q of L) {
    const dx = x - q.x,
      dy = y - q.y;
    if (dx * dx + dy * dy > 100) continue;
    const a = (dx * q.c + dy * q.s) / q.sc,
      b = (-dx * q.s + dy * q.c) / q.sc;
    for (const r of AP_BOX[q.k]) if (a > r[0] && a < r[1] && b > r[2] && b < r[3]) return true;
  }
  return false;
}

// ---------- v41: real AI traffic on the arrivals road pulls into a drop-off bay, pauses while a passenger gets out and walks in, then leaves ----------
const APX_BAYS = [404, 418];
const APDROP = { peds: [] };
setTimeout(() => {
  if (typeof updateTraffic !== "function") return;
  const ut = updateTraffic;
  updateTraffic = function (dt) {
    const A = apA(),
      held = [];
    if (A && traffic && traffic.vs)
      for (const v of traffic.vs) {
        if (v.kind === "lorry" || v.ptruck || v.police) continue;
        const tx = v.x / M_T,
          ty = v.y / M_T;
        if (v._drop) {
          const e = timeS - v._drop.t;
          if (e < 9) {
            held.push([v, v._drop.x, v._drop.y, v.h]);
          }
          continue;
        }
        if (ty > 692 && ty < 695 && ((v.id * 2654435761) >>> 0) % 3 === 0)
          for (const bx of APX_BAYS)
            if (Math.abs(tx - bx) < 0.8) {
              v._drop = { t: timeS, x: v.x, y: v.y };
              APDROP.peds.push({
                x: tx,
                y: 691.6,
                t: timeS,
                c: ["#e67e22", "#2980b9", "#8e44ad", "#16a085"][v.id % 4],
              });
              held.push([v, v.x, v.y, v.h]);
              break;
            }
      }
    const r = ut.apply(this, arguments);
    for (const [v, x, y, h] of held) {
      v.x = x;
      v.y = y;
      v.h = h;
      v.v = 0;
    }
    APDROP.peds = APDROP.peds.filter((p) => timeS - p.t < 12);
    return r;
  };
}, 0);
function apDropPeds() {
  const g = ctx,
    T_ = TILE;
  for (const p of APDROP.peds) {
    const e = timeS - p.t;
    if (e < 1.5) continue;
    const k = Math.min(1, (e - 1.5) / 6),
      x = (p.x + 0.6) * T_,
      y = (691.6 - k * 3.1) * T_; // v44: walks north across the drop-off plaza to the doors
    if (k >= 1) continue;
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.arc(x + 2, y + 2, 4, 0, 7);
    g.fill();
    g.fillStyle = p.c;
    g.beginPath();
    g.arc(x, y, 4.2, 0, 7);
    g.fill();
    g.fillStyle = "#3b2a20";
    g.beginPath();
    g.arc(x, y, 2.2, 0, 7);
    g.fill();
    g.fillStyle = "#555";
    g.fillRect(x + 4, y - 1, 4, 3);
  }
}
// ---------- v42: ATC. Every aircraft runs on its own clock (lt) that only advances when it is cleared:
// one aircraft on the runway at a time (arrivals hold out on the approach, departures hold at the bars), the two-way apron link and the
// south-west taxiway merge are single-occupancy blocks, and taxiing aircraft keep 14 tiles behind whatever is ahead.
function apLT(o) {
  if (o.lt == null) o.lt = timeS;
  return o.lt;
}
const AP_RWY_PH = { app: 1, roll: 1, line: 1, tko: 1 };
function apRwV(A, p) {
  return -(p.x - A.rwC[0]) * Math.sin(A.rwA) + (p.y - A.rwC[1]) * Math.cos(A.rwA);
}
function apRwU(A, p) {
  return (p.x - A.rwC[0]) * Math.cos(A.rwA) + (p.y - A.rwC[1]) * Math.sin(A.rwA);
}
function apZone(A, p) {
  if (!p || p.alt > 0.05) return 0;
  if (p.x > 368 && p.x < 442 && p.y > 572 && p.y < 600) return 1;
  const u = apRwU(A, p),
    v = apRwV(A, p);
  if (u > -136 && u < -104 && v > 7 && v < 42) return 2;
  if (u > -16 && u < 16 && v > 22 && v < 44) return 3;
  if (u > -16 && u < 16 && v < -22 && v > -44) return 4;
  return 0;
}
function apATC(dt) {
  const A = apA();
  if (!A || !A.lineup) return;
  const L = [];
  for (const st of A.stands) L.push({ o: st, f: (t) => apCivil(A, st, t) });
  for (const f of A.fighters) if (f.fly) L.push({ o: f, f: (t) => apFighter(A, f, t) });
  for (const q of L) {
    q.cur = q.f(apLT(q.o));
    q.nxt = q.f(q.o.lt + dt);
  }
  const onRwy = (p) =>
    p &&
    p.alt < 1.5 &&
    (AP_RWY_PH[p.ph] || (Math.abs(apRwV(A, p)) < 7 && Math.abs(apRwU(A, p)) < 215));
  // runway token
  const keep = (p) =>
    p &&
    (p.ph === "app" ||
      p.ph === "roll" ||
      p.ph === "line" ||
      (p.ph === "tko" && p.alt < 1.5) ||
      (p.alt < 0.05 && Math.abs(apRwV(A, p)) < 7 && Math.abs(apRwU(A, p)) < 215));
  if (A.rwy && !L.some((q) => q.o === A.rwy && keep(q.cur))) A.rwy = null;
  for (const q of L) {
    const c = q.cur,
      n = q.nxt;
    let hold = false;
    q.o.why = null;
    const wantsRwy =
      n &&
      ((n.ph === "app" && (!c || c.ph !== "app")) || (n.ph === "line" && (!c || c.ph === "hold")));
    if (wantsRwy && A.rwy !== q.o) {
      if (A.rwy) {
        hold = true;
        q.o.why = "rwy";
      } else A.rwy = q.o;
    }
    const moving =
      n &&
      n.alt < 0.05 &&
      (n.ph === "taxi" || n.ph === "taxo" || n.ph === "push" || n.ph === "start");
    if (!hold && moving) {
      const zn = apZone(A, n),
        zc = apZone(A, c);
      if (
        zn &&
        zn !== zc &&
        L.some(
          (o) => o !== q && apZone(A, o.cur) === zn && o.cur.ph !== "park" && o.cur.ph !== "has",
        )
      ) {
        hold = true;
        q.o.why = "zone" + zn;
      }
      if (!hold && A.rwy !== q.o && (n.ph === "taxi" || n.ph === "taxo"))
        for (const o of L) {
          if (o === q || !o.cur || o.cur.alt > 0.05 || o.cur.ph === "park" || o.cur.ph === "has")
            continue;
          {
            const ax = o.cur.x - n.x,
              ay = o.cur.y - n.y,
              al = Math.hypot(ax, ay) || 1;
            if ((ax * Math.cos(n.h) + ay * Math.sin(n.h)) / al < 0.85) continue;
          }
          const dn = Math.hypot(n.x - o.cur.x, n.y - o.cur.y),
            dc = Math.hypot(c.x - o.cur.x, c.y - o.cur.y);
          if (dn < 14 && dn < dc - 1e-4) {
            hold = true;
            q.o.why = "follow:" + (o.o.k != null ? "c" + o.o.k : "f" + o.o.i);
            break;
          }
        }
    }
    if (!hold) q.o.lt += dt;
    q.o.held = hold;
  }
}
// ---------- v42: airfield lighting (night): runway edge/centreline, threshold/end bars, approach lights, PAPI, taxiway centreline/edges, stop bars
function apFieldLights(A, vx0, vy0, vx1, vy1) {
  if (typeof DN === "undefined" || DN.dark < 0.05 || typeof dnLight !== "function") return;
  const T_ = TILE,
    m = 60;
  const L = (u, v, r, c, a) => {
    const p = apT(A, u, v),
      x = p[0] * T_,
      y = p[1] * T_;
    if (x < vx0 - m || x > vx1 + m || y < vy0 - m || y > vy1 + m) return;
    dnLight(x, y, r, c, a);
  };
  const h = A.rwW / 2,
    uE = A.rwL / 2,
    W = "rgba(255,250,235,0.95)";
  for (let u = -uE; u <= uE; u += 15) {
    L(u, -h, 22, W, 0.9);
    L(u, h, 22, W, 0.9);
  }
  for (let u = -uE + 6; u < uE; u += 8)
    L(u, 0, 12, u > uE - 60 ? (((u / 8) | 0) % 2 ? "rgba(255,60,50,0.95)" : W) : W, 0.8);
  for (let v = -h; v <= h + 0.01; v += h / 4) {
    L(-uE, v, 16, "rgba(60,255,110,0.95)", 1);
    L(uE, v, 16, "rgba(255,50,40,0.95)", 1);
    L(uE + 1.2, v, 14, "rgba(60,255,110,0.9)", 0.8);
    L(-uE - 1.2, v, 14, "rgba(255,50,40,0.9)", 0.8);
  }
  for (let u = -uE - 6; u >= -uE - 90; u -= 6) L(u, 0, 18, W, 0.95);
  for (let v = -6; v <= 6; v += 1.5) L(-uE - 45, v, 14, W, 0.9);
  {
    const sg = ((timeS * 2) % 1) * 90;
    L(-uE - 90 + sg, 0, 40, "rgba(255,255,255,0.9)", 1);
  } // sequenced flasher ("rabbit")
  for (let k = 0; k < 4; k++)
    L(-172 + 6, -h - 3 - k * 1.2, 14, k < 2 ? W : "rgba(255,50,40,0.95)", 1); // PAPI: 2 white + 2 red = on slope
  const G_ = "rgba(60,255,120,0.9)",
    B_ = "rgba(70,120,255,0.95)";
  const pts = (P, step, fn) => {
    let acc = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1],
        b = P[i],
        d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc += d;
      if (acc >= step) {
        acc = 0;
        fn(b, a);
      }
    }
  };
  const W2 = (p, r, c, a) => {
    const x = p[0] * T_,
      y = p[1] * T_;
    if (x < vx0 - m || x > vx1 + m || y < vy0 - m || y > vy1 + m) return;
    dnLight(x, y, r, c, a);
  };
  const sA = Math.sin(A.rwA),
    cA = Math.cos(A.rwA),
    onR = (p) => Math.abs(-(p[0] - A.rwC[0]) * sA + (p[1] - A.rwC[1]) * cA) < h + 1;
  pts(A.loop, 5, (p) => W2(p, 10, G_, 0.85));
  pts(A.loop, 9, (p, a) => {
    const dx = p[0] - a[0],
      dy = p[1] - a[1],
      l = Math.hypot(dx, dy) || 1,
      nx = (-dy / l) * 2.4,
      ny = (dx / l) * 2.4;
    W2([p[0] + nx, p[1] + ny], 10, B_, 0.9);
    W2([p[0] - nx, p[1] - ny], 10, B_, 0.9);
  });
  for (const R of A.taxiPaint || [])
    pts(R, 5, (p) => {
      if (!onR(p)) W2(p, 10, G_, 0.85);
    });
  for (const u of [-120, 0, 120])
    for (const sv of [-1, 1]) {
      const busy = !!A.rwy;
      for (let w = -2; w <= 2; w += 1)
        L(
          u + w,
          sv * 10.9,
          10,
          busy ? "rgba(255,40,30,1)" : "rgba(255,40,30,0.35)",
          busy ? 1 : 0.5,
        );
    }
  for (const st of A.stands) W2([st.x, A.civ.lane + 6], 260, "rgba(255,240,200,0.5)", 0.5);
  for (let k = 0; k < 3; k++)
    W2([A.mil.x0 + 16 + k * 32, A.mil.y0 + 8], 260, "rgba(255,240,200,0.45)", 0.5);
}
setTimeout(() => {
  if (typeof updateTraffic !== "function") return;
  const ut = updateTraffic;
  updateTraffic = function (dt) {
    const r = ut.apply(this, arguments);
    try {
      apATC(dt);
    } catch (e) {
      APX.err3 = String((e && e.stack) || e);
    }
    return r;
  };
}, 0);

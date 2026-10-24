/**
 * @file j103.js — J103 grade-separated motorway junction (James 24 Oct): the motorway (seg 58) carries straight on over a
 * give-way roundabout on a bridge deck (x 886-916); four slip roads and the rural road (seg 145) join the 2-lane ring.
 * No traffic lights. UK clockwise ring, left-hand driving. Lower layer = ring / slips (layer 0), deck = motorway (layer 1).
 * Built at load (j103Build from main.js) on top of the baked map; AI paths (j103Plan from traffic.js planPiece),
 * sat nav two levels (satnav.js navAStar virtual under-deck nodes), player / police layers, chunk art, live deck pass.
 */
const J3 = {
  cx: 901, cy: 100, RO: 11, RI: 7, X0: 886, X1: 916, DY0: 96.2, DY1: 103.8,
  Rout: 10, Rin: 8, // circulating lane radii (outer / inner)
  zone: [884, 918, 94.5, 105.5], // tiles: deck interaction zone (two layers)
  ZID: 250, on: false, J: null, rb: null,
};
{
  const E = J3.RO - 1.6, P = (th, R) => [J3.cx + R * Math.cos((th * Math.PI) / 180), J3.cy + R * Math.sin((th * Math.PI) / 180)];
  // cubic slips (tiles), from the approved mock-up. ring: 1 = slip ends at the ring (off-slip), 0 = starts at it (on-slip)
  J3.slips = {
    ebOff: { b: [[835, 96.0], [862, 96.0], [884, 91], P(210, E)], ring: 1, mouth: 210, d: 1 },
    ebOn: { b: [P(330, E), [918, 91], [940, 96.0], [967, 96.0]], ring: 0, mouth: 330, d: 1 },
    wbOff: { b: [[967, 104.0], [940, 104.0], [918, 109], P(30, E)], ring: 1, mouth: 30, d: -1 },
    wbOn: { b: [P(150, E), [884, 109], [862, 104.0], [835, 104.0]], ring: 0, mouth: 150, d: -1 },
  };
  J3.rural = { b: [[901, 135], [901, 125], [901, 118], [901, 100 + E]], mouth: 90 };
}
function j3bz(b, t) {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * b[0][i] + 3 * u * u * t * b[1][i] + 3 * u * t * t * b[2][i] + t * t * t * b[3][i]);
}
function j3samp(b, n) {
  const o = [];
  for (let i = 0; i <= n; i++) o.push(j3bz(b, i / n));
  return o;
}
const j3r = (p) => Math.hypot(p[0] - J3.cx, p[1] - J3.cy);
const j3inZone = (x, y) => x >= J3.zone[0] && x <= J3.zone[1] && y >= J3.zone[2] && y <= J3.zone[3];
// tarmac half-width of a slip at parameter t (widened flared mouth at the ring end, ~2.1 m lane -> +2.2 tiles)
function j3hw(sl, t, base) {
  const d = sl.ring ? t : 1 - t, f = Math.max(0, (d - 0.72) / 0.28);
  return (base + 2.2 * f * f) / 2;
}
// is the point (tiles) on lower-level tarmac (ring, slips, rural mouth, services spur)?
function j3onLower(x, y) {
  const r = Math.hypot(x - J3.cx, y - J3.cy);
  if (r <= J3.RO && r >= J3.RI) return true;
  if (x >= 900 && x < 902 && y >= 100 && y <= 136) return r >= J3.RI;
  if (x >= 902 && x <= 907.2 && y >= 118.3 && y <= 120.4) return true;
  for (const k in J3.slips) {
    const sl = J3.slips[k], S = sl.S;
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey || 1;
      const u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l2));
      const d = Math.hypot(x - a[0] - ex * u, y - a[1] - ey * u);
      if (d <= j3hw(sl, (i + u) / (S.length - 1), 2.1)) return true;
    }
  }
  return false;
}

// ---------------- build (once, after the baked map is loaded) ----------------
function j103Build() {
  if (J3.on || !world.segs || !world.segs[58] || !world.segs[145]) return;
  const J = (world.junctions || []).find((j) => j.hs === 58 && j.vs === 145);
  if (!J) return;
  J3.J = J;
  J.gs = true;
  J.lights = false;
  for (const k in J.appr) J.appr[k].lights = false;
  world.overhead = world.overhead.filter((o) => !(o.kind === "mast" && o.J === J)); // signal gantries gone
  for (const k in J3.slips) J3.slips[k].S = j3samp(J3.slips[k].b, 80);
  // pseudo roundabout for the give-way logic in traffic.js (not in world.rbs: no arms, no generator paint)
  J3.rb = { cx: J3.cx, cy: J3.cy, rin: J3.RI, rout: J3.RO, arms: [], id: 900 + J.id, j103: true };
  // 1) Old Desert Road Fuel (NORTHGAS + HGV DIESEL) moves 11 tiles south, off the ring, onto its own spur
  const DX0 = 906, DX1 = 926, DY0 = 102, DY1 = 116, SH = 11;
  const f = (world.fuel || []).find((o) => o.x / M_T > DX0 && o.x / M_T < DX1 && o.y / M_T > DY0 && o.y / M_T < DY1);
  if (f) {
    const keep = [];
    for (let y = DY1; y >= 103; y--)
      for (let x = 907; x < 925; x++) {
        const i = idx(x, y), t = G[i];
        if (t === T.CONC || t === T.PUMP || t === T.BLDG) keep.push([x, y, t, world.reserved ? world.reserved[i] : 0]);
      }
    for (const [x, y] of keep) {
      const i = idx(x, y);
      G[i] = T.SAND;
      if (world.reserved) world.reserved[i] = 0;
    }
    for (const [x, y, t, rs] of keep) {
      const i = idx(x, y + SH);
      G[i] = t;
      if (world.reserved) world.reserved[i] = rs;
    }
    const inR = (o) => o.x / TILE >= DX0 && o.x / TILE < DX1 && o.y / TILE >= DY0 && o.y / TILE < DY1;
    for (const o of world.objects) if (!o._dead && inR(o)) {
      if (o.kind === "scrub" || o.kind === "rock" || o.kind === "cactus") continue;
      o.y += SH * TILE;
    }
    for (const o of world.overhead) if (o.kind === "canopy" && inR(o)) o.y += SH * TILE;
    const m = SH * M_T;
    f.y += m;
    if (f.y0 !== undefined) f.y0 += m;
    for (const z of f.zones || []) { z[1] += m; z[3] += m; }
    for (const b of f.hgv || []) { b.y0 += m; b.y1 += m; }
    for (const s of f.spots || []) s.y += m;
    f.j103 = 1;
    J3.fuel = f;
  }
  // 2) lower-level tiles: ring, slips, rural mouth, services spur. Fully covered tiles become road (-2, no rb mask)
  const N = MW * MH;
  const lo = (J3.lo = new Uint8Array(N));
  const s145 = world.segs[145];
  for (let ty = 84; ty <= 137; ty++)
    for (let tx = 812; tx <= 990; tx++) {
      const i = idx(tx, ty);
      if (world.roadH[i] === 58) continue;
      let n = 0;
      for (const [ox, oy] of [[0.5, 0.5], [0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]) if (j3onLower(tx + ox, ty + oy)) n++;
      const r = Math.hypot(tx + 0.5 - J3.cx, ty + 0.5 - J3.cy);
      if (j3onLower(tx + 0.5, ty + 0.5) && !(tx >= 900 && tx < 902 && ty > 112)) {
        lo[i] = 1;
        G[i] = T.ROAD;
        world.roadH[i] = world.roadV[i] = -2;
        if (world.rbMask) world.rbMask[i] = 0;
      } else if (tx >= 900 && tx < 902 && ty > 112) lo[i] = 1; // the rural road itself (seg 145)
      else if (r < J3.RI - 0.3) {
        G[i] = T.ISLAND;
        world.roadH[i] = world.roadV[i] = -1;
      } else if (n > 0 && (world.roadV[i] === 145 || world.roadH[i] === 145 || G[i] === T.ROAD)) {
        G[i] = T.SAND;
        world.roadH[i] = world.roadV[i] = -1;
      } else if (world.roadV[i] === 145 && ty <= 112) {
        G[i] = T.SAND;
        world.roadH[i] = world.roadV[i] = -1;
      }
      if (n > 0 && lo[i] !== 1 && G[i] === T.CONC) G[i] = T.SAND;
    }
  s145.b0 = 113; // rural road now starts at the ring mouth
  // 3) two layers under the deck: foZ zone + sat nav virtual lower nodes on motorway tiles the ring passes under
  if (!world.foZ) world.foZ = new Uint8Array(N);
  J3.vr = [];
  J3.vmap = new Map();
  for (let ty = Math.floor(J3.zone[2]); ty <= Math.ceil(J3.zone[3]); ty++)
    for (let tx = J3.zone[0]; tx <= J3.zone[1]; tx++) {
      const i = idx(tx, ty);
      if (!world.foZ[i]) world.foZ[i] = J3.ZID;
      if (world.roadH[i] === 58) {
        const r = Math.hypot(tx + 0.5 - J3.cx, ty + 0.5 - J3.cy);
        if (r >= J3.RI - 0.2 && r <= J3.RO + 0.2) {
          J3.vmap.set(i, N + J3.vr.length);
          J3.vr.push(i);
        }
      }
    }
  if (world.chunkObjs && typeof worldChunkIndex === "function") worldChunkIndex(world.objects);
  if (typeof chunkCache !== "undefined") chunkCache.clear();
  J3.on = true;
  world.j103 = J3;
}

// ---------------- sat nav: virtual under-deck nodes ----------------
// returns the node to step to from node i (real or virtual) in direction d, or -1. Called by navAStar for nodes in the J103 box.
function j3NavBox(t) {
  const x = t % MW, y = (t / MW) | 0;
  return x >= 860 && x <= 945 && y >= 84 && y <= 126;
}
function j3NavStep(i, d) {
  const N = MW * MH, V = i >= N;
  const ri = V ? J3.vr[i - N] : i, j = ri + d, vert = Math.abs(d) === MW;
  if (j < 0 || j >= N) return -1;
  const mw = (t) => world.roadH[t] === 58, lo = (t) => J3.lo[t] === 1;
  const xj = j % MW, far = xj < 872 || xj > 930;
  if (V) {
    if (!vert) return -1;
    if (J3.vmap.has(j)) return J3.vmap.get(j);
    return lo(j) ? j : -1;
  }
  if (lo(ri) && mw(j)) {
    if (vert && J3.vmap.has(j)) return J3.vmap.get(j);
    return far ? j : -1;
  }
  if (mw(ri) && lo(j)) return far ? j : -1;
  return j;
}
const j3NavReal = (i) => (i >= MW * MH ? J3.vr[i - MW * MH] : i);

// ---------------- AI ----------------
function j3cubic(v, p0, t0, p1, t1) {
  // tiles in, metres pushed; t0/t1 unit tangents
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 0.42;
  const b = [p0, [p0[0] + t0[0] * L, p0[1] + t0[1] * L], [p1[0] - t1[0] * L, p1[1] - t1[1] * L], p1];
  const n = Math.max(6, Math.ceil(L * 3));
  for (let k = 1; k <= n; k++) {
    const q = j3bz(b, k / n);
    pathPush(v, q[0] * M_T, q[1] * M_T);
  }
}
const j3tan = (a) => [-Math.sin(a), Math.cos(a)]; // clockwise (screen) ring tangent at angle a
const j3ringPt = (a, R) => [J3.cx + Math.cos(a) * R, J3.cy + Math.sin(a) * R];
const j3unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
// enter the ring from point A (tiles, heading tA) at mouth angle mouth (deg); returns {aJ, dGw}
function j3enter(v, A, tA, mouth, R) {
  const aJ = (mouth * Math.PI) / 180 + 0.34;
  const d0 = pathEnd(v);
  const J = j3ringPt(aJ, R);
  j3cubic(v, A, tA, J, j3tan(aJ));
  // give-way line: where the path crosses the ring's outer edge
  let dGw = pathEnd(v);
  for (let k = v.px.length - 1; k >= 0 && v.pd[k] >= d0; k--)
    if (Math.hypot(v.px[k] / M_T - J3.cx, v.py[k] / M_T - J3.cy) > J3.RO + 0.35) { dGw = v.pd[k]; break; }
  return { aJ, dGw };
}
function j3ring(v, a0, a1, R) {
  let del = mod2pi(a1 - a0);
  if (del < 0.3) del += 2 * Math.PI;
  const k = Math.ceil((del * R * M_T) / 2);
  for (let i = 1; i <= k; i++) {
    const p = j3ringPt(a0 + (del * i) / k, R);
    pathPush(v, p[0] * M_T, p[1] * M_T);
  }
  return del;
}
// follow a slip polyline S between parameters t0..t1 (0..1)
function j3follow(v, S, t0, t1) {
  const n = S.length - 1, s = Math.sign(t1 - t0) || 1;
  for (let i = Math.round(t0 * n); s > 0 ? i <= Math.round(t1 * n) : i >= Math.round(t1 * n); i += s) pathPush(v, S[i][0] * M_T, S[i][1] * M_T);
}
// parameter along a slip where it first (from the motorway end) reaches radius rr from the ring centre
function j3tAt(sl, rr) {
  const S = sl.S, n = S.length - 1;
  if (sl.ring) { for (let i = 0; i <= n; i++) if (j3r(S[i]) < rr) return i / n; return 1; }
  for (let i = n; i >= 0; i--) if (j3r(S[i]) < rr) return i / n;
  return 0;
}
// the ring part shared by every movement: give way, circulate, leave. aOut = exit angle (rad)
function j3ringMove(v, en, aOut, R, key) {
  const mrb = { kind: "rb", d: en.dGw, rb: J3.rb, ang: en.aJ + 0.18, key, ln: 0, join: en.dGw + 6 };
  v.mk.push(mrb);
  const dIn = en.dGw - 25;
  const del = j3ring(v, en.aJ, aOut, R);
  const d1 = pathEnd(v);
  return { mrb, del, d1, dIn };
}
function j3after(v, mv, d1, R, aOut) {
  const end = pathEnd(v);
  if (R < J3.Rout - 0.5) v.mk.push({ kind: "rbx", d: d1, d1: d1 + 4, rb: J3.rb, aOut, R: R * M_T });
  v.mk.push({ kind: "ring", d0: mv.mrb.d - 1.5, d1: end, rb: J3.rb });
  v.mk.push({ kind: "slow", d0: mv.dIn, d1: end, v: 8 });
  v.mk.push({ kind: "sig", d0: d1 - 14, d1: end, side: -1 });
  if (mv.del > 3.6) v.mk.push({ kind: "sig", d0: mv.dIn - 10, d1: mv.mrb.d + mv.del * R * M_T * 0.6, side: 1 });
  const n = v.px.length;
  if (n > 2) {
    const a = [v.px[n - 2], v.py[n - 2]], b = [v.px[n - 1], v.py[n - 1]], u = j3unit(a, b);
    mv.mrb.ex = [b[0], b[1], u[0], u[1]];
  }
}
function j103Plan(v, r, sg, d, J, o) {
  const P = v.plan;
  let opts = o.opts.filter((q) => q[0] === "S" || (q[1] && (q[1].id === 58 || q[1].id === 145)));
  if (!opts.length) return false;
  let tw = 0;
  for (const q of opts) tw += q[3];
  let x = r() * tw, ch = opts[0];
  for (const q of opts) { x -= q[3]; if (x <= 0) { ch = q; break; } }
  if (v.gk && typeof ptPickExit === "function") {
    const k = ptPickExit(v, opts.map((q) => q[0] === "S" ? lanePt(sg, d, P.lane, tProbeA(sg, (d > 0 ? 918 : 884) + d * 6)) : q[1].id === 145 ? lanePt(q[1], 1, 0, 125) : lanePt(q[1], q[2], 0, q[2] > 0 ? 990 : 812)));
    if (k >= 0) ch = opts[k];
  }
  if (sg.id === 58) {
    const dv = d > 0 ? 835 : 967; // diverge (start of the off-slip's parallel lane)
    const need = P.lane * 13 + 12; // tiles needed to reach the kerb lane and taper out
    const xT = d > 0 ? Math.max(dv + 6, P.pos + need) : Math.min(dv - 6, P.pos - need);
    const late = d > 0 ? xT > 853 : xT < 949;
    if (J3.dbg) J3.dbg.push([v.id, d, P.pos | 0, ch[0], late]);
    if (ch[0] !== "S" && late) ch = opts.find((q) => q[0] === "S") || ch;
    if (ch[0] === "S") {
      const a0 = d > 0 ? Math.max(P.pos, J3.X0 - 2) : Math.min(P.pos, J3.X1 + 2), a1 = d > 0 ? J3.X1 + 2 : J3.X0 - 2;
      let p = lanePt(sg, d, P.lane, a0);
      pathLine(v, p[0], p[1]);
      const d0 = pathEnd(v);
      p = lanePt(sg, d, P.lane, a1);
      pathLine(v, p[0], p[1]);
      v.mk.push({ kind: "fo", d0: d0 - 1, d1: pathEnd(v) + 1, fo: -1, j103: 1 });
      P.pos = a1;
      return true;
    }
    // off-slip: move to the kerb lane in good time, taper out onto the slip, give way, round, out to the rural road south
    const sl = d > 0 ? J3.slips.ebOff : J3.slips.wbOff;
    const xS = xT - d * 10; // taper start
    if (P.lane > 0) {
      if (P.lane > 1) {
        const m = P.pos + d * Math.max(2, Math.abs(xS - P.pos) * 0.45);
        laneChange(v, sg, d, P.lane, 1, P.pos, m);
        P.pos = m;
        P.lane = 1;
      }
      laneChange(v, sg, d, P.lane, 0, P.pos, xS);
      P.lane = 0;
    }
    P.pos = xS;
    let p = lanePt(sg, d, 0, xS);
    pathLine(v, p[0], p[1]);
    const dS = pathEnd(v);
    // slip parameter at x = xT (the parallel lane)
    let t0 = 0;
    for (let i = 0; i < sl.S.length; i++) if ((sl.S[i][0] - xT) * d <= 0) t0 = i / (sl.S.length - 1);
    const Q = j3bz(sl.b, t0);
    { const y0 = p[1] / M_T, n = 24;
      for (let k = 1; k <= n; k++) { const t = k / n, e = t * t * (3 - 2 * t); pathPush(v, (xS + (Q[0] - xS) * t) * M_T, (y0 + (Q[1] - y0) * e) * M_T); } }
    v.mk.push({ kind: "sig", d0: dS - 30, d1: pathEnd(v), side: -1 });
    const tA = j3tAt(sl, J3.RO + 3.2);
    j3follow(v, sl.S, t0, tA);
    const A = j3bz(sl.b, tA), A2 = j3bz(sl.b, Math.max(0, tA - 0.02));
    v.mk.push({ kind: "slow", d0: pathEnd(v) - 60, d1: pathEnd(v), v: 13 });
    // inner lane for long ways round (EB off 210 -> 90 = 240 deg), outer otherwise
    const aOutDeg = 90 - 19.5, aOut = (aOutDeg * Math.PI) / 180;
    const del0 = mod2pi(aOut - ((sl.mouth * Math.PI) / 180 + 0.34));
    const R = del0 > 3.0 ? J3.Rin : J3.Rout;
    const en = j3enter(v, A, j3unit(A2, A), sl.mouth, R);
    const mv = j3ringMove(v, en, aOut, R, "j103:" + (d > 0 ? "ebOff" : "wbOff"));
    const d1 = mv.d1;
    // exit south onto the rural road (southbound lane x 901.5)
    const s145 = world.segs[145], q = lanePt(s145, 1, 0, 115);
    j3cubic(v, j3ringPt(aOut, R), j3tan(aOut), [q[0] / M_T, q[1] / M_T], [0, 1]);
    j3after(v, mv, d1, R, aOut);
    P.seg = 145; P.dir = 1; P.lane = 0; P.pos = 115;
    return true;
  }
  // from the rural road (northbound): give way at the south mouth, round, up the on-slip, merge onto the motorway
  if (sg.id === 145 && d < 0) {
    const tgt = ch[1] && ch[1].id === 58 ? ch[2] : r() < 0.5 ? 1 : -1;
    const sl = tgt > 0 ? J3.slips.ebOn : J3.slips.wbOn;
    let p = lanePt(sg, d, P.lane, 115);
    pathLine(v, p[0], p[1]);
    const A = [p[0] / M_T, p[1] / M_T];
    const aOut = (sl.mouth * Math.PI) / 180 - 0.34;
    const aJ0 = (90 * Math.PI) / 180 + 0.34;
    const R = mod2pi(aOut - aJ0) > 3.0 ? J3.Rin : J3.Rout;
    const en = j3enter(v, A, [0, -1], 90, R);
    const mv = j3ringMove(v, en, aOut, R, "j103:rural");
    const d1 = mv.d1;
    const tB = j3tAt(sl, J3.RO + 3.2), B = j3bz(sl.b, tB), B2 = j3bz(sl.b, Math.min(1, tB + 0.02));
    j3cubic(v, j3ringPt(aOut, R), j3tan(aOut), B, j3unit(B, B2));
    j3after(v, mv, d1, R, aOut);
    j3follow(v, sl.S, tB, 1);
    // merge: slip end -> motorway kerb lane over 16 tiles, giving way to lane-0 traffic
    const m58 = world.segs[58], E0 = sl.b[3][0], q0 = lanePt(m58, tgt, 0, E0 + tgt * 16);
    const y0 = sl.b[3][1], y1 = q0[1] / M_T, n = 32;
    const dM = pathEnd(v);
    for (let k = 1; k <= n; k++) { const t = k / n, e = t * t * (3 - 2 * t); pathPush(v, (E0 + tgt * 16 * t) * M_T, (y0 + (y1 - y0) * e) * M_T); }
    v.mk.push({ kind: "jm", d: dM + 6 * M_T, dEnd: pathEnd(v), dir: tgt, ax: (E0 + tgt * 9) * M_T, ly: y1 * M_T });
    v.mk.push({ kind: "sig", d0: dM - 20, d1: pathEnd(v), side: 1 });
    P.seg = 58; P.dir = tgt; P.lane = 0; P.pos = E0 + tgt * 16;
    return true;
  }
  return false;
}
// entry mouth must be clear of anything on the ring or leaving it (lorries + trailers sweep the mouth)
function j103MouthBusy(v, m) {
  const a = m.ang - 0.52, M = j3ringPt(a, J3.RO - 1), mx = M[0] * M_T, my = M[1] * M_T, R2 = (5.5 * M_T) ** 2;
  for (const o of traffic.vs) {
    if (o === v || o.ring !== J3.rb) continue;
    for (const p of o.trl ? [o, o.trl] : [o]) if ((p.x - mx) ** 2 + (p.y - my) ** 2 < R2) return true;
  }
  return false;
}
// on-slip merge: hold at the end of the slip while lane-0 traffic (or the player) is alongside / closing
function j103Merge(v, m, front, v0) {
  const gap = m.d - front;
  if (gap > 45 || gap < -2 || m.go) return null;
  const relax = v.stopT > 10;
  const back = relax ? 18 : 40, ahead = relax ? 6 : 12;
  let blk = false;
  const chk = (x, y, vel) => {
    if (Math.abs(y - m.ly) > 1.0 * M_T) return;
    const s = (x - m.ax) * m.dir;
    if (s > -back - Math.max(0, vel) * 1.2 && s < ahead) blk = true;
  };
  for (const o of traffic.vs) {
    if (o === v || o.parked || o.layer) continue;
    if (o.mk.some((q) => q.kind === "jm" && !q.go && q !== m)) continue; // queued behind us on the slip
    chk(o.x, o.y, o.v);
  }
  if (!(truck.foLay === 0 && j3inZone(truck.x / M_T, truck.y / M_T))) chk(truck.x, truck.y, truck.v);
  if (!blk) { if (gap < 3) m.go = true; return null; }
  return idmAcc(v, v0, Math.max(0.1, gap), 0);
}

// ---------------- layers: player, police ----------------
function j3track(o, x, y) {
  const tx = Math.floor(x / M_T), ty = Math.floor(y / M_T);
  if (!inb(tx, ty)) return 0;
  const i = idx(tx, ty);
  if (world.foZ[i] === J3.ZID) return o.j3From === "mw" ? 1 : 0;
  o.j3From = world.roadH[i] === 58 ? "mw" : "lo";
  return 0;
}
function j103PlayerLayer(s) {
  if (!J3.on) return false;
  const tx = Math.floor(s.x / M_T), ty = Math.floor(s.y / M_T);
  if (!inb(tx, ty)) return false;
  const L = j3track(s, s.x, s.y);
  if (world.foZ[idx(tx, ty)] === J3.ZID) { s.foLay = L; return true; }
  return false;
}
// police / anything kinematic: true when a and b are on different levels inside the deck zone
function j103Apart(a, o, x, y) {
  if (!J3.on || !j3inZone(a.x / M_T, a.y / M_T) || !j3inZone(x / M_T, y / M_T)) return false;
  const lay = (q) => (q === truck || q === truck.trl ? truck.foLay | 0 : q.pol || q.polT || q.j3L !== undefined ? q.j3L | 0 : q.layer | 0);
  return lay(a) !== lay(o);
}
function j103PolUpdate() {
  if (!J3.on || typeof POL === "undefined") return;
  for (const c of [POL.chase, ...(POL.aux || [])]) if (c && c.v) c.v.j3L = j3track(c.v, c.v.x, c.v.y);
}

// ---------------- art ----------------
const J3C = { TAR: "#4a4c50", KERB: "#e9e7df", LINE: "#f4f2ea" };
function j3path(g, S) { g.beginPath(); g.moveTo(S[0][0], S[0][1]); for (let i = 1; i < S.length; i++) g.lineTo(S[i][0], S[i][1]); }
function j3paintSlip(g, sl, base, col, extra) {
  const S = sl.S, n = S.length - 1;
  g.strokeStyle = col; g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    g.lineWidth = 2 * j3hw(sl, (i + 0.5) / n, base) + extra;
    g.beginPath(); g.moveTo(S[i][0], S[i][1]); g.lineTo(S[i + 1][0], S[i + 1][1]); g.stroke();
  }
}
// lower level (tiles units, g already transformed so 1 unit = 1 tile)
function j3drawLower(g) {
  const { cx, cy, RO, RI } = J3, TAR = J3C.TAR;
  const sl = Object.values(J3.slips);
  // services spur + rural road (kerb, tarmac)
  g.fillStyle = J3C.KERB; g.fillRect(901.8, 118.1, 5.5, 2.5); g.fillRect(899.82, cy + RO - 2, 2.36, 136 - cy - RO + 2);
  for (const s of sl) j3paintSlip(g, s, 2.1, J3C.KERB, 0.35);
  g.fillStyle = TAR; g.fillRect(901.9, 118.3, 5.4, 2.1); g.fillRect(900, cy + RO - 2, 2, 136 - cy - RO + 2);
  // rural flare
  g.beginPath(); g.moveTo(899.2, cy + RO + 2.2); g.quadraticCurveTo(900, cy + RO + 0.4, 898.5, cy + RO - 0.6); g.lineTo(903.5, cy + RO - 0.6); g.quadraticCurveTo(902, cy + RO + 0.4, 902.8, cy + RO + 2.2); g.closePath(); g.fill();
  for (const s of sl) j3paintSlip(g, s, 2.1, TAR, 0);
  g.beginPath(); g.arc(cx, cy, RO + 0.12, 0, 7); g.fillStyle = J3C.KERB; g.fill();
  // re-tarmac the mouths over the kerb ring so joins are continuous
  for (const s of sl) j3paintSlip(g, s, 2.1, TAR, 0);
  g.fillStyle = TAR; g.beginPath(); g.arc(cx, cy, RO, 0, 7); g.fill();
  g.fillRect(900, cy + RO - 1.5, 2, 3);
  // kerb arcs between the mouths
  const mouths = [210, 330, 30, 150, 90], gap = 12;
  g.strokeStyle = J3C.KERB; g.lineWidth = 0.14;
  for (let th = 0; th < 360; th += 1) {
    if (mouths.some((m) => Math.abs(((th - m + 540) % 360) - 180) < gap)) continue;
    g.beginPath(); g.arc(cx, cy, RO - 0.07, (th * Math.PI) / 180, ((th + 1.05) * Math.PI) / 180); g.stroke();
  }
  // edge lines along the slips (stop at the ring)
  g.strokeStyle = J3C.LINE; g.lineWidth = 0.1;
  for (const s of sl) for (const side of [1, -1]) {
    const S = s.S, n = S.length - 1; let st = false; g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(n, i + 1)], u = j3unit(a, b), w = j3hw(s, i / n, 2.1) - 0.25;
      const x = S[i][0] - u[1] * w * side, y = S[i][1] + u[0] * w * side;
      if (Math.hypot(x - cx, y - cy) < RO + 0.4) { if (st) break; continue; }
      st ? g.lineTo(x, y) : g.moveTo(x, y); st = true;
    }
    g.stroke();
  }
  // lane divider on the ring and the island
  g.setLineDash([0.9, 0.7]); g.beginPath(); g.arc(cx, cy, (RO + RI) / 2, 0, 7); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#5f8f45"; g.beginPath(); g.arc(cx, cy, RI, 0, 7); g.fill(); g.strokeStyle = "#d9d6cc"; g.lineWidth = 0.35; g.stroke();
  g.fillStyle = "#6fa052"; for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 2 + ((i * 37) % 4); g.beginPath(); g.arc(cx + d * Math.cos(a), cy + d * Math.sin(a), 0.9, 0, 7); g.fill(); }
  // rural centre line, give-way double dashed lines across each entry (UK: give way to traffic from the right)
  g.strokeStyle = J3C.LINE; g.lineWidth = 0.1; g.setLineDash([0.8, 0.8]); g.beginPath(); g.moveTo(901, 136); g.lineTo(901, cy + RO + 1.5); g.stroke(); g.setLineDash([]);
  g.lineWidth = 0.13; g.setLineDash([0.4, 0.3]);
  for (const [th, h0, h1] of [[210, -10, 10], [30, -10, 10], [90, 0, 9]])
    for (const R of [RO + 0.15, RO + 0.5]) { g.beginPath(); g.arc(cx, cy, R, ((th + h0) * Math.PI) / 180, ((th + h1) * Math.PI) / 180); g.stroke(); }
  g.setLineDash([]);
  // GIVE WAY triangles on the off-slips and the rural road approach
  g.fillStyle = J3C.LINE;
  for (const s of [J3.slips.ebOff, J3.slips.wbOff]) {
    const t = j3tAt(s, RO + 4.5), p = j3bz(s.b, t), q = j3bz(s.b, t + 0.01), u = j3unit(p, q);
    j3tri(g, p, u);
  }
  j3tri(g, [900.5, cy + RO + 3.5], [0, -1]);
}
function j3tri(g, p, u) {
  g.save(); g.translate(p[0], p[1]); g.rotate(Math.atan2(u[1], u[0]));
  g.beginPath(); g.moveTo(0.7, 0); g.lineTo(-0.9, -0.55); g.lineTo(-0.9, 0.55); g.closePath();
  g.lineWidth = 0.09; g.strokeStyle = J3C.LINE; g.stroke(); g.restore();
}
// motorway deck (tiles units): slab, lanes, central reservation, parapets, abutments
function j3drawDeck(g, shadow) {
  const { X0, X1 } = J3, y0 = 96.6, y1 = 103.4;
  if (shadow) { g.fillStyle = "rgba(10,12,20,0.36)"; g.fillRect(X0 + 0.4, 97.6, X1 - X0, 7.4); }
  g.fillStyle = "#3d3f43"; g.fillRect(X0, y0, X1 - X0, y1 - y0);
  g.fillStyle = "#55575a"; g.fillRect(X0, 99.7, X1 - X0, 0.6);
  g.fillStyle = "#e8c440"; g.fillRect(X0, 99.55, X1 - X0, 0.08); g.fillRect(X0, 100.37, X1 - X0, 0.08);
  g.fillStyle = "#f2f2ee"; g.fillRect(X0, 96.85, X1 - X0, 0.08); g.fillRect(X0, 103.07, X1 - X0, 0.08);
  for (const y of [97.95, 98.95, 101.0, 102.0]) for (let x = X0; x < X1; x += 2.2) g.fillRect(x, y, 1.1, 0.07);
  g.fillStyle = "#b9b8b2"; g.fillRect(X0, 96.2, X1 - X0, 0.45); g.fillRect(X0, 103.35, X1 - X0, 0.45);
  g.fillStyle = "#8d8c87"; g.fillRect(X0, 99.85, X1 - X0, 0.3);
  g.fillStyle = "#77766f"; for (const x of [X0, X1 - 0.6]) g.fillRect(x, 96.0, 0.6, 8.0);
}
// chunk pass: lower level + deck baked into each chunk that overlaps
function j3chunk(c, cx, cy) {
  if (!J3.on) return;
  const x0 = (cx * CHUNK) / TILE, y0 = (cy * CHUNK) / TILE, n = CHUNK / TILE;
  if (x0 > 992 || x0 + n < 810 || y0 > 140 || y0 + n < 84) return;
  const g = c.getContext("2d");
  g.save(); g.setTransform(TILE, 0, 0, TILE, -x0 * TILE, -y0 * TILE);
  j3drawLower(g); j3drawDeck(g, true);
  g.restore();
}
// live pass (in drawTraffic between the lower and upper traffic): deck over the lower vehicles, their faint outlines on top
function j3deckCanvas() {
  if (J3.dc) return J3.dc;
  const W = (J3.X1 - J3.X0 + 1) * TILE, H = 9 * TILE, c = mkCanvas(W, H), g = c.getContext("2d");
  g.setTransform(TILE, 0, 0, TILE, -(J3.X0 - 0.5) * TILE, -95.5 * TILE);
  j3drawDeck(g, false);
  return (J3.dc = c);
}
function j3box(x, y, h, L, W) {
  const f = fwd(h), q = rgt(h);
  return [[L / 2, W / 2], [L / 2, -W / 2], [-L / 2, -W / 2], [-L / 2, W / 2]].map(([a, b]) => [(x + f[0] * a + q[0] * b) * PPM, (y + f[1] * a + q[1] * b) * PPM]);
}
function j3poly(B) { ctx.beginPath(); ctx.moveTo(B[0][0], B[0][1]); for (let i = 1; i < B.length; i++) ctx.lineTo(B[i][0], B[i][1]); ctx.closePath(); }
function j3underDeck(x, y) { const X = x / M_T, Y = y / M_T; return X > J3.X0 - 1 && X < J3.X1 + 1 && Y > J3.DY0 - 1.5 && Y < J3.DY1 + 1.5; }
function j103DrawDeck(vx0, vy0, vx1, vy1) {
  if (!J3.on) return;
  if (J3.X1 * TILE < vx0 || J3.X0 * TILE > vx1 || 104 * TILE < vy0 || 96 * TILE > vy1) return;
  ctx.drawImage(j3deckCanvas(), (J3.X0 - 0.5) * TILE, 95.5 * TILE);
  ctx.save(); ctx.setLineDash([0.3 * TILE, 0.25 * TILE]); ctx.lineWidth = 0.1 * TILE; ctx.strokeStyle = "rgba(255,255,255,0.35)";
  for (const v of traffic.vs) {
    if (v.layer || !j3underDeck(v.x, v.y)) continue;
    j3poly(j3box(v.x, v.y, v.h, v.L, v.W)); ctx.stroke();
    if (v.trl) { j3poly(j3box(v.trl.x, v.trl.y, v.trl.h, 13.6, 2.55)); ctx.stroke(); }
  }
  if (typeof POL !== "undefined")
    for (const c of [POL.chase, ...(POL.aux || [])]) if (c && c.v && !c.v.j3L && j3underDeck(c.v.x, c.v.y)) { j3poly(j3box(c.v.x, c.v.y, c.v.h, 4.6, 1.9)); ctx.stroke(); }
  ctx.restore();
}
// after the player's rig is drawn: if it is under the deck, repaint the deck over it and show a yellow dashed outline
function j103DrawPlayerUnder() {
  if (!J3.on || truck.foLay || !j3inZone(truck.x / M_T, truck.y / M_T)) return;
  const tf = fwd(truck.h), cm = (CAB.front + CAB.rear) / 2;
  const cab = j3box(truck.x - tf[0] * cm, truck.y - tf[1] * cm, truck.h, CAB.rear - CAB.front, CAB.w);
  let trl = null;
  if (truck.trl) {
    const th = truck.th != null ? truck.th : truck.trl.th, f2 = fwd(th), tm = (TRL.front + TRL.rear) / 2, kp = kingpin(truck);
    trl = j3box(kp[0] - f2[0] * tm, kp[1] - f2[1] * tm, th, TRL.rear - TRL.front, TRL.w);
  }
  const all = trl ? [cab, trl] : [cab];
  if (!all.some((B) => B.some((p) => j3underDeck(p[0] / PPM, p[1] / PPM)))) return;
  ctx.save();
  ctx.beginPath(); ctx.rect((J3.X0) * TILE, J3.DY0 * TILE, (J3.X1 - J3.X0) * TILE, (J3.DY1 - J3.DY0) * TILE); ctx.clip();
  ctx.drawImage(j3deckCanvas(), (J3.X0 - 0.5) * TILE, 95.5 * TILE);
  for (const B of all) { j3poly(B); ctx.fillStyle = "rgba(255,210,60,0.16)"; ctx.fill(); }
  ctx.setLineDash([0.35 * TILE, 0.25 * TILE]); ctx.lineWidth = 0.16 * TILE; ctx.strokeStyle = "#ffd23c";
  for (const B of all) { j3poly(B); ctx.stroke(); }
  ctx.restore();
}
// street lamps round the ring and along the slips (daynight.js slBuild)
function j103Lamps() {
  if (!J3.on) return [];
  const o = [];
  for (let th = 0; th < 360; th += 40) {
    const a = (th * Math.PI) / 180, p = j3ringPt(a, J3.RO + 0.9);
    if (p[1] > 95 && p[1] < 105) continue;
    if ([210, 330, 30, 150, 90].some((m) => Math.abs(((th - m + 540) % 360) - 180) < 16)) continue;
    o.push([p[0], p[1], -Math.cos(a), -Math.sin(a)]);
  }
  for (const k in J3.slips) {
    const s = J3.slips[k];
    for (const t of [0.25, 0.5, 0.75]) {
      const p = j3bz(s.b, t), q = j3bz(s.b, t + 0.01), u = j3unit(p, q), w = j3hw(s, t, 2.1) + 0.8;
      let n = [-u[1], u[0]];
      if ((p[1] - 100) * n[1] < 0) n = [-n[0], -n[1]];
      o.push([p[0] + n[0] * w, p[1] + n[1] * w, -n[0], -n[1]]);
    }
  }
  return o;
}
// bake the junction into the ground chunks
{
  const _rc = renderChunk;
  renderChunk = function (cx, cy) {
    const c = _rc(cx, cy);
    try { j3chunk(c, cx, cy); } catch (e) {}
    return c;
  };
}
// police / emergency cars driven without route markers: level from where they entered the deck zone
function j103Kinematic() {
  if (!J3.on) return;
  for (const v of traffic.vs) if (v.pol || v.polT || !v.mk || !v.mk.length) { v.j3L = j3track(v, v.x, v.y); v.layer = v.j3L; }
}

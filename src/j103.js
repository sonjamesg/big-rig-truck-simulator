/**
 * @file j103.js — BLUEPRINT for a grade-separated motorway junction (first site: J103, James 24 Oct): the motorway carries
 * straight on over a give-way roundabout on a bridge deck; up to four slip roads and a rural road join the 2-lane ring.
 * No traffic lights. UK clockwise ring, left-hand driving. Lower layer = ring / slips (layer 0), deck = motorway (layer 1).
 * Built at load (j103Build from main.js) on top of the baked map; AI paths (j103Plan from traffic.js planPiece),
 * sat nav two levels (satnav.js navAStar virtual under-deck nodes), player / police layers, chunk art, live deck pass.
 */
// ===== BLUEPRINT =====
// A grade-separated "motorway over roundabout" junction is fully described by these parameters; every coordinate below is
// derived from them (nothing J103-specific in the code). Place another one with J3_SITES.push({...}) before load, see
// docs at the bottom of this file. Supported: straight E-W ("h") motorway segment, rural arm leaving south (+1) or north (-1).
const J3_SITES = [
  { name: "J103", mw: 58, rural: 145, cx: 901, heading: "h", ruralSide: 1, arms: ["ebOff", "ebOn", "wbOff", "wbOn"],
    services: { x0: 906, x1: 926, y0: 102, y1: 116, shift: 11, spur: true } },
];
const J3_BP = { RO: 11, RI: 7, Rout: 10, Rin: 8, deckHalf: 15, slipReach: 66, slipMid: 39, slipKnee: 17, slipOut: 9, ZID: 250 };
const J3 = { on: false, J: null, rb: null };
// derive the geometry for a site (tiles). mwA/mwW = motorway segment lateral start / width
function j3setup(site) {
  const B = J3_BP, mw = world.segs[site.mw], ru = world.segs[site.rural];
  if (!mw || mw.dir !== "h" || site.heading !== "h") throw new Error("j103 blueprint: only E-W motorways supported");
  const cx = site.cx, top = mw.a, bot = mw.a + mw.w, cy = mw.a + mw.w / 2, rs = site.ruralSide || 1;
  Object.assign(J3, B, { site, mw: site.mw, ruralId: site.rural, cx, cy, top, bot, rs,
    X0: cx - B.deckHalf, X1: cx + B.deckHalf, DY0: top - 0.8, DY1: bot + 0.8,
    zone: [cx - B.deckHalf - 2, cx + B.deckHalf + 2, top - 2.5, bot + 2.5],
    rx: ru.a + ru.w / 2, // rural road centre line
    navBox: [cx - 41, cx + 44, top - 13, bot + 23], far: [cx - 29, cx + 29],
    art: [cx - 91, cx + 91, top - 13, bot + 37] });
  const E = B.RO - 1.6, P = (th, R) => [cx + R * Math.cos((th * Math.PI) / 180), cy + R * Math.sin((th * Math.PI) / 180)];
  const yN = top - 0.85, yS = bot + 0.85; // parallel diverge / merge lanes sit flush against the motorway edge (overlap -> no gap)
  const R0 = cx - B.slipReach, R1 = cx + B.slipReach, M0 = cx - B.slipMid, M1 = cx + B.slipMid, K0 = cx - B.slipKnee, K1 = cx + B.slipKnee;
  const all = {
    ebOff: { b: [[R0, yN], [M0, yN], [K0, top - 6], P(210, E)], ring: 1, mouth: 210, d: 1 },
    ebOn: { b: [P(330, E), [K1, top - 6], [M1, yN], [R1, yN]], ring: 0, mouth: 330, d: 1 },
    wbOff: { b: [[R1, yS], [M1, yS], [K1, bot + 6], P(30, E)], ring: 1, mouth: 30, d: -1 },
    wbOn: { b: [P(150, E), [K0, bot + 6], [M0, yS], [R0, yS]], ring: 0, mouth: 150, d: -1 },
  };
  J3.slips = {};
  for (const k of site.arms || Object.keys(all)) J3.slips[k] = all[k];
  const rm = rs > 0 ? 90 : 270;
  J3.rural = { b: [[J3.rx, cy + rs * 36], [J3.rx, cy + rs * 25], [J3.rx, cy + rs * 17], P(rm, E)], ring: 1, mouth: rm, wide: 2.0 };
  J3.ruralEnd = cy + rs * (B.RO + 2); // the rural segment now starts here
  J3.mouths = Object.values(J3.slips).map((q) => q.mouth).concat([rm]);
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
function j3arms() { return Object.values(J3.slips).concat([J3.rural]); }
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
  if (Math.abs(x - J3.rx) < 1 && (y - J3.cy) * J3.rs >= 0 && Math.abs(y - J3.cy) <= 36) return r >= J3.RI;
  if (J3.spur && x >= J3.spur[0] && x <= J3.spur[2] && y >= J3.spur[1] && y <= J3.spur[3]) return true;
  for (const sl of j3arms()) {
    const t = j3taper(sl);
    if (t) {
      const lo = Math.min(t.x0, t.x1, t.xm), hi = Math.max(t.x0, t.x1, t.xm);
      if (x >= lo && x <= hi && (y - t.edge) * (t.outer - t.edge) >= 0) {
        const past = (x - t.x0) * (t.x1 - t.x0) > 0, k = past ? 1 - Math.abs(x - t.x0) / Math.abs(t.x1 - t.x0) : 1;
        if (Math.abs(y - t.edge) <= Math.abs(t.outer - t.edge) * k) return true;
      }
    }
    const S = sl.S;
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey || 1;
      const u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l2));
      const d = Math.hypot(x - a[0] - ex * u, y - a[1] - ey * u);
      if (d <= j3hw(sl, (i + u) / (S.length - 1), sl.wide || 2.1)) return true;
    }
  }
  return false;
}

// ---------------- build (once, after the baked map is loaded) ----------------
function j103Build() {
  if (J3.on || !world.segs) return;
  const site = J3_SITES[0];
  if (!site || !world.segs[site.mw] || !world.segs[site.rural]) return;
  j3setup(site);
  const J = (world.junctions || []).find((j) => j.hs === site.mw && j.vs === site.rural);
  if (!J) return;
  J3.J = J;
  J.gs = true;
  J.lights = false;
  for (const k in J.appr) J.appr[k].lights = false;
  world.overhead = world.overhead.filter((o) => !(o.kind === "mast" && o.J === J)); // signal gantries gone
  for (const q of j3arms()) q.S = j3samp(q.b, 80);
  // pseudo roundabout for the give-way logic in traffic.js (not in world.rbs: no arms, no generator paint)
  J3.rb = { cx: J3.cx, cy: J3.cy, rin: J3.RI, rout: J3.RO, arms: [], id: 900 + J.id, j103: true };
  // 1) Old Desert Road Fuel (NORTHGAS + HGV DIESEL) moves 11 tiles south, off the ring, onto its own spur
  const sv = site.services, DX0 = sv ? sv.x0 : 0, DX1 = sv ? sv.x1 : 0, DY0 = sv ? sv.y0 : 0, DY1 = sv ? sv.y1 : 0, SH = sv ? sv.shift : 0;
  const f = sv && (world.fuel || []).find((o) => o.x / M_T > DX0 && o.x / M_T < DX1 && o.y / M_T > DY0 && o.y / M_T < DY1);
  if (f) {
    const keep = [];
    for (let y = DY1; y >= DY0 + 1; y--)
      for (let x = DX0 + 1; x < DX1 - 1; x++) {
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
    if (sv.spur) J3.spur = [J3.rx + 1, f.y / M_T - 2.7, f.x0 !== undefined ? f.x0 / M_T + 0.2 : DX0 + 1.2, f.y / M_T - 0.6];
    J3.fuel = f;
  }
  // 2) lower-level tiles: ring, slips, rural mouth, services spur. Fully covered tiles become road (-2, no rb mask)
  const N = MW * MH;
  const lo = (J3.lo = new Uint8Array(N));
  const s145 = world.segs[J3.ruralId], A = J3.art, onRu = (tx, ty) => tx >= s145.a && tx < s145.a + s145.w && (ty + 0.5 - J3.ruralEnd) * J3.rs > 0;
  for (let ty = A[2]; ty <= A[3]; ty++)
    for (let tx = A[0]; tx <= A[1]; tx++) {
      const i = idx(tx, ty);
      if (world.roadH[i] === J3.mw) continue;
      let n = 0;
      for (const [ox, oy] of [[0.5, 0.5], [0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]) if (j3onLower(tx + ox, ty + oy)) n++;
      const r = Math.hypot(tx + 0.5 - J3.cx, ty + 0.5 - J3.cy);
      if (j3onLower(tx + 0.5, ty + 0.5) && !onRu(tx, ty)) {
        lo[i] = 1;
        G[i] = T.ROAD;
        world.roadH[i] = world.roadV[i] = -2;
        if (world.rbMask) world.rbMask[i] = 0;
      } else if (onRu(tx, ty)) lo[i] = 1; // the rural road itself
      else if (r < J3.RI - 0.3) {
        G[i] = T.ISLAND;
        world.roadH[i] = world.roadV[i] = -1;
      } else if (n > 0 && (world.roadV[i] === J3.ruralId || world.roadH[i] === J3.ruralId || G[i] === T.ROAD)) {
        G[i] = T.SAND;
        world.roadH[i] = world.roadV[i] = -1;
      } else if (world.roadV[i] === J3.ruralId && !onRu(tx, ty)) {
        G[i] = T.SAND;
        world.roadH[i] = world.roadV[i] = -1;
      }
      if (n > 0 && lo[i] !== 1 && G[i] === T.CONC) G[i] = T.SAND;
    }
  if (J3.rs > 0) s145.b0 = Math.ceil(J3.ruralEnd); else s145.b1 = Math.floor(J3.ruralEnd) - 1; // rural road now starts at the ring mouth
  // 3) two layers under the deck: foZ zone + sat nav virtual lower nodes on motorway tiles the ring passes under
  if (!world.foZ) world.foZ = new Uint8Array(N);
  J3.vr = [];
  J3.vmap = new Map();
  for (let ty = Math.floor(J3.zone[2]); ty <= Math.ceil(J3.zone[3]); ty++)
    for (let tx = J3.zone[0]; tx <= J3.zone[1]; tx++) {
      const i = idx(tx, ty);
      if (!world.foZ[i]) world.foZ[i] = J3.ZID;
      if (world.roadH[i] === J3.mw) {
        const r = Math.hypot(tx + 0.5 - J3.cx, ty + 0.5 - J3.cy);
        if (r >= J3.RI - 0.2 && r <= J3.RO + 0.2) {
          J3.vmap.set(i, N + J3.vr.length);
          J3.vr.push(i);
        }
      }
    }
  if (world.chunkObjs && typeof worldChunkIndex === "function") worldChunkIndex(world.objects);
  if (typeof chunkCache !== "undefined") chunkCache.clear();
  if (typeof chunkLo !== "undefined") chunkLo.clear(); // zoomed-out copies too (phones): no stale pre-junction ground
  J3.on = true;
  world.j103 = J3;
}

// ---------------- sat nav: virtual under-deck nodes ----------------
// returns the node to step to from node i (real or virtual) in direction d, or -1. Called by navAStar for nodes in the J103 box.
function j3NavBox(t) {
  const x = t % MW, y = (t / MW) | 0;
  const B = J3.navBox;
  return x >= B[0] && x <= B[1] && y >= B[2] && y <= B[3];
}
function j3NavStep(i, d) {
  const N = MW * MH, V = i >= N;
  const ri = V ? J3.vr[i - N] : i, j = ri + d, vert = Math.abs(d) === MW;
  if (j < 0 || j >= N) return -1;
  const mw = (t) => world.roadH[t] === J3.mw, lo = (t) => J3.lo[t] === 1;
  const xj = j % MW, far = xj < J3.far[0] || xj > J3.far[1];
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
  let opts = o.opts.filter((q) => q[0] === "S" || (q[1] && (q[1].id === J3.mw || q[1].id === J3.ruralId)));
  if (!opts.length) return false;
  let tw = 0;
  for (const q of opts) tw += q[3];
  let x = r() * tw, ch = opts[0];
  for (const q of opts) { x -= q[3]; if (x <= 0) { ch = q; break; } }
  if (v.gk && typeof ptPickExit === "function") {
    const k = ptPickExit(v, opts.map((q) => q[0] === "S" ? lanePt(sg, d, P.lane, tProbeA(sg, (d > 0 ? J3.X1 + 2 : J3.X0 - 2) + d * 6)) : q[1].id === J3.ruralId ? lanePt(q[1], J3.rs, 0, J3.cy + J3.rs * 25) : lanePt(q[1], q[2], 0, J3.cx + q[2] * 89)));
    if (k >= 0) ch = opts[k];
  }
  if (sg.id === J3.mw) {
    const dv = d > 0 ? J3.cx - J3.slipReach : J3.cx + J3.slipReach; // diverge (start of the off-slip's parallel lane)
    const need = P.lane * 13 + 12; // tiles needed to reach the kerb lane and taper out
    const xT = d > 0 ? Math.max(dv + 6, P.pos + need) : Math.min(dv - 6, P.pos - need);
    const sl0 = d > 0 ? J3.slips.ebOff : J3.slips.wbOff;
    const late = !sl0 || (d > 0 ? xT > J3.cx - 48 : xT < J3.cx + 48);
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
    // exit onto the rural road
    const s145 = world.segs[J3.ruralId], ePos = J3.cy + J3.rs * 15, q = lanePt(s145, J3.rs, 0, ePos);
    j3cubic(v, j3ringPt(aOut, R), j3tan(aOut), [q[0] / M_T, q[1] / M_T], [0, J3.rs]);
    j3after(v, mv, d1, R, aOut);
    P.seg = J3.ruralId; P.dir = J3.rs; P.lane = 0; P.pos = ePos;
    return true;
  }
  // from the rural road (northbound): give way at the south mouth, round, up the on-slip, merge onto the motorway
  if (sg.id === J3.ruralId && d === -J3.rs) {
    let tgt = ch[1] && ch[1].id === J3.mw ? ch[2] : r() < 0.5 ? 1 : -1;
    if (!(tgt > 0 ? J3.slips.ebOn : J3.slips.wbOn)) tgt = -tgt;
    const sl = tgt > 0 ? J3.slips.ebOn : J3.slips.wbOn;
    if (!sl) return false;
    let p = lanePt(sg, d, P.lane, J3.cy + J3.rs * 15);
    pathLine(v, p[0], p[1]);
    const A = [p[0] / M_T, p[1] / M_T];
    const aOut = (sl.mouth * Math.PI) / 180 - 0.34;
    const aJ0 = (J3.rural.mouth * Math.PI) / 180 + 0.34;
    const R = mod2pi(aOut - aJ0) > 3.0 ? J3.Rin : J3.Rout;
    // straight up to the mouth, then the tangential entry (keeps lorry trailers on the flared tarmac)
    { const pm = [A[0], J3.cy + J3.rs * (J3.RO + 1.2)]; pathLine(v, pm[0] * M_T, pm[1] * M_T); A[1] = pm[1]; }
    const en = j3enter(v, A, [0, -J3.rs], J3.rural.mouth, R);
    const mv = j3ringMove(v, en, aOut, R, "j103:rural");
    const d1 = mv.d1;
    const tB = j3tAt(sl, J3.RO + 3.2), B = j3bz(sl.b, tB), B2 = j3bz(sl.b, Math.min(1, tB + 0.02));
    j3cubic(v, j3ringPt(aOut, R), j3tan(aOut), B, j3unit(B, B2));
    j3after(v, mv, d1, R, aOut);
    j3follow(v, sl.S, tB, 1);
    // merge: slip end -> motorway kerb lane over 16 tiles, giving way to lane-0 traffic
    const m58 = world.segs[J3.mw], E0 = sl.b[3][0], q0 = lanePt(m58, tgt, 0, E0 + tgt * 16);
    const y0 = sl.b[3][1], y1 = q0[1] / M_T, n = 32;
    const dM = pathEnd(v);
    for (let k = 1; k <= n; k++) { const t = k / n, e = t * t * (3 - 2 * t); pathPush(v, (E0 + tgt * 16 * t) * M_T, (y0 + (y1 - y0) * e) * M_T); }
    v.mk.push({ kind: "jm", d: dM + 6 * M_T, dEnd: pathEnd(v), dir: tgt, ax: (E0 + tgt * 9) * M_T, ly: y1 * M_T });
    v.mk.push({ kind: "sig", d0: dM - 20, d1: pathEnd(v), side: 1 });
    P.seg = J3.mw; P.dir = tgt; P.lane = 0; P.pos = E0 + tgt * 16;
    return true;
  }
  return false;
}
// entry mouth must be clear of anything on the ring or leaving it (lorries + trailers sweep the mouth)
function j103MouthBusy(v, m) {
  const a = m.ang - 0.52, M = j3ringPt(a, J3.RO - 1), mx = M[0] * M_T, my = M[1] * M_T, R2 = (5.5 * M_T) ** 2;
  for (const o of traffic.vs) {
    if (o === v || o.ring !== J3.rb) continue;
    if (v.stopT > 20 && o.v < 0.3 && o.stopT > 20) continue; // long mutual wait: a parked-up ring vehicle no longer blocks
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
  o.j3From = world.roadH[i] === J3.mw ? "mw" : "lo";
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
  g.strokeStyle = col;
  for (let i = 0; i < n; i++) {
    // butt caps at the motorway end (the slip meets the motorway edge square, no rounded nose), round elsewhere
    g.lineCap = (sl.ring ? i === 0 : i === n - 1) ? "butt" : "round";
    g.lineWidth = 2 * j3hw(sl, (i + 0.5) / n, base) + extra;
    g.beginPath(); g.moveTo(S[i][0], S[i][1]); g.lineTo(S[i + 1][0], S[i + 1][1]); g.stroke();
  }
}
// diverge / merge tapers: a wedge of tarmac from the slip's parallel lane into the motorway edge, so the two are one surface
function j3taper(sl) {
  if (sl === J3.rural) return null;
  const mEnd = sl.ring ? sl.b[0] : sl.b[3], dirOut = sl.ring ? -sl.d : sl.d; // pointing away from the junction
  const edge = mEnd[1] < J3.cy ? J3.top + 0.25 : J3.bot - 0.25, outer = mEnd[1] < J3.cy ? mEnd[1] - 1.05 : mEnd[1] + 1.05;
  const x0 = mEnd[0], x1 = mEnd[0] + dirOut * 16, xm = J3.cx - (J3.cx - x0) * 0.62; // xm: where the slip has left the edge
  return { x0, x1, xm, edge, outer, y: mEnd[1] };
}
// lower level (tiles units, g already transformed so 1 unit = 1 tile)
function j3drawLower(g) {
  const { cx, cy, RO, RI } = J3, TAR = J3C.TAR;
  const sl = j3arms();
  const sp = J3.spur;
  // kerbs, then tarmac
  g.fillStyle = J3C.KERB;
  if (sp) g.fillRect(sp[0] - 0.2, sp[1] - 0.2, sp[2] - sp[0] + 0.4, sp[3] - sp[1] + 0.4);
  for (const s of sl) j3paintSlip(g, s, s.wide || 2.1, J3C.KERB, 0.35);
  g.fillStyle = TAR;
  if (sp) g.fillRect(sp[0] - 0.6, sp[1], sp[2] - sp[0] + 0.6, sp[3] - sp[1]);
  for (const s of sl) j3paintSlip(g, s, s.wide || 2.1, TAR, 0);
  // tapers: slip lane + wedge down to the motorway edge
  for (const s of sl) {
    const t = j3taper(s); if (!t) continue;
    g.fillStyle = TAR; g.beginPath(); g.moveTo(t.x1, t.edge); g.lineTo(t.x0, t.outer); g.lineTo(t.xm, t.outer); g.lineTo(t.xm, t.edge); g.closePath(); g.fill();
    g.strokeStyle = J3C.LINE; g.lineWidth = 0.1; g.beginPath(); g.moveTo(t.x1, t.edge + (t.outer - t.edge) * 0.08); g.lineTo(t.x0, t.outer + (t.edge - t.outer) * 0.12); g.lineTo(t.xm, t.outer + (t.edge - t.outer) * 0.12); g.stroke();
    // dashed lane line between the motorway kerb lane and the slip lane
    g.setLineDash([0.6, 0.6]); g.beginPath(); g.moveTo(t.x0, t.edge); g.lineTo(t.xm, t.edge); g.stroke(); g.setLineDash([]);
  }
  g.beginPath(); g.arc(cx, cy, RO + 0.12, 0, 7); g.fillStyle = J3C.KERB; g.fill();
  for (const s of sl) j3paintSlip(g, s, s.wide || 2.1, TAR, 0); // re-tarmac the mouths over the kerb ring (continuous joins)
  g.fillStyle = TAR; g.beginPath(); g.arc(cx, cy, RO, 0, 7); g.fill();
  // kerb arcs between the mouths
  const gap = 12;
  g.strokeStyle = J3C.KERB; g.lineWidth = 0.14;
  for (let th = 0; th < 360; th += 1) {
    if (J3.mouths.some((m) => Math.abs(((th - m + 540) % 360) - 180) < gap)) continue;
    g.beginPath(); g.arc(cx, cy, RO - 0.07, (th * Math.PI) / 180, ((th + 1.05) * Math.PI) / 180); g.stroke();
  }
  // edge lines along the slips (stop at the ring)
  g.strokeStyle = J3C.LINE; g.lineWidth = 0.1;
  for (const s of sl) for (const side of [1, -1]) {
    const S = s.S, n = S.length - 1; let st = false; g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(n, i + 1)], u = j3unit(a, b), w = j3hw(s, i / n, s.wide || 2.1) - 0.25;
      const x = S[i][0] - u[1] * w * side, y = S[i][1] + u[0] * w * side;
      if (Math.hypot(x - cx, y - cy) < RO + 0.4) { if (st) break; continue; }
      st ? g.lineTo(x, y) : g.moveTo(x, y); st = true;
    }
    g.stroke();
  }
  g.setLineDash([0.9, 0.7]); g.beginPath(); g.arc(cx, cy, (RO + RI) / 2, 0, 7); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#5f8f45"; g.beginPath(); g.arc(cx, cy, RI, 0, 7); g.fill(); g.strokeStyle = "#d9d6cc"; g.lineWidth = 0.35; g.stroke();
  g.fillStyle = "#6fa052"; for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 2 + ((i * 37) % 4); g.beginPath(); g.arc(cx + d * Math.cos(a), cy + d * Math.sin(a), 0.9, 0, 7); g.fill(); }
  // rural centre line, give-way double dashed lines across each entry (UK: give way to traffic from the right)
  const rs = J3.rs, rEnd = cy + rs * 36;
  g.strokeStyle = J3C.LINE; g.lineWidth = 0.1; g.setLineDash([0.8, 0.8]); g.beginPath(); g.moveTo(J3.rx, rEnd); g.lineTo(J3.rx, cy + rs * (RO + 3)); g.stroke(); g.setLineDash([]);
  g.lineWidth = 0.13; g.setLineDash([0.4, 0.3]);
  const entries = sl.filter((q) => q.ring).map((q) => (q === J3.rural ? [q.mouth, rs > 0 ? 0 : -9, rs > 0 ? 9 : 0] : [q.mouth, -10, 10]));
  for (const [th, h0, h1] of entries)
    for (const R of [RO + 0.15, RO + 0.5]) { g.beginPath(); g.arc(cx, cy, R, ((th + h0) * Math.PI) / 180, ((th + h1) * Math.PI) / 180); g.stroke(); }
  g.setLineDash([]);
  for (const s of sl) if (s.ring && s !== J3.rural) {
    const t = j3tAt(s, RO + 4.5), p = j3bz(s.b, t), q = j3bz(s.b, t + 0.01);
    j3tri(g, p, j3unit(p, q));
  }
  j3tri(g, [J3.rx - 0.5 * rs, cy + rs * (RO + 3.5)], [0, -rs]);
}
function j3tri(g, p, u) {
  g.save(); g.translate(p[0], p[1]); g.rotate(Math.atan2(u[1], u[0]));
  g.beginPath(); g.moveTo(0.7, 0); g.lineTo(-0.9, -0.55); g.lineTo(-0.9, 0.55); g.closePath();
  g.lineWidth = 0.09; g.strokeStyle = J3C.LINE; g.stroke(); g.restore();
}
// motorway deck (tiles units): slab, lanes, central reservation, parapets, abutments - from the motorway segment's own width
function j3drawDeck(g, shadow) {
  const { X0, X1, top, bot, cy } = J3, W = X1 - X0, nl = Math.floor((bot - top) / 2);
  if (shadow) { g.fillStyle = "rgba(10,12,20,0.36)"; g.fillRect(X0 + 0.4, top + 0.6, W, bot - top + 1.4); }
  g.fillStyle = "#3d3f43"; g.fillRect(X0, top - 0.4, W, bot - top + 0.8);
  g.fillStyle = "#55575a"; g.fillRect(X0, cy - 0.3, W, 0.6);
  g.fillStyle = "#e8c440"; g.fillRect(X0, cy - 0.45, W, 0.08); g.fillRect(X0, cy + 0.37, W, 0.08);
  g.fillStyle = "#f2f2ee"; g.fillRect(X0, top - 0.15, W, 0.08); g.fillRect(X0, bot + 0.07, W, 0.08);
  for (let k = 1; k < nl; k++) for (const y of [top + k, bot - k]) for (let x = X0; x < X1; x += 2.2) g.fillRect(x, y - 0.035, 1.1, 0.07);
  g.fillStyle = "#b9b8b2"; g.fillRect(X0, top - 0.8, W, 0.45); g.fillRect(X0, bot + 0.35, W, 0.45);
  g.fillStyle = "#8d8c87"; g.fillRect(X0, cy - 0.15, W, 0.3);
  g.fillStyle = "#77766f"; for (const x of [X0, X1 - 0.6]) g.fillRect(x, top - 1, 0.6, bot - top + 2);
}
// chunk pass: lower level + deck baked into each chunk that overlaps
function j3chunk(c, cx, cy) {
  if (!J3.on) return;
  const x0 = (cx * CHUNK) / TILE, y0 = (cy * CHUNK) / TILE, n = CHUNK / TILE;
  const A = J3.art;
  if (x0 > A[1] + 2 || x0 + n < A[0] - 2 || y0 > A[3] + 2 || y0 + n < A[2] - 2) return;
  const g = c.getContext("2d");
  g.save(); g.setTransform(TILE, 0, 0, TILE, -x0 * TILE, -y0 * TILE);
  j3drawLower(g); j3drawDeck(g, true);
  g.restore();
}
// live pass (in drawTraffic between the lower and upper traffic): deck over the lower vehicles, their faint outlines on top
function j3deckCanvas() {
  if (J3.dc) return J3.dc;
  const W = (J3.X1 - J3.X0 + 1) * TILE, H = (J3.bot - J3.top + 3) * TILE, c = mkCanvas(W, H), g = c.getContext("2d");
  g.setTransform(TILE, 0, 0, TILE, -(J3.X0 - 0.5) * TILE, -(J3.top - 1.5) * TILE);
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
  if (J3.X1 * TILE < vx0 || J3.X0 * TILE > vx1 || (J3.bot + 1) * TILE < vy0 || (J3.top - 1) * TILE > vy1) return;
  ctx.drawImage(j3deckCanvas(), (J3.X0 - 0.5) * TILE, (J3.top - 1.5) * TILE);
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
  ctx.drawImage(j3deckCanvas(), (J3.X0 - 0.5) * TILE, (J3.top - 1.5) * TILE);
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
    if (p[1] > J3.top - 2 && p[1] < J3.bot + 2) continue;
    if (J3.mouths.some((m) => Math.abs(((th - m + 540) % 360) - 180) < 16)) continue;
    o.push([p[0], p[1], -Math.cos(a), -Math.sin(a)]);
  }
  for (const s of Object.values(J3.slips)) {
    for (const t of [0.25, 0.5, 0.75]) {
      const p = j3bz(s.b, t), q = j3bz(s.b, t + 0.01), u = j3unit(p, q), w = j3hw(s, t, 2.1) + 0.8;
      let n = [-u[1], u[0]];
      if ((p[1] - J3.cy) * n[1] < 0) n = [-n[0], -n[1]];
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

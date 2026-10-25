/**
 * @file j103.js — BLUEPRINT for a grade-separated motorway junction (first site: J103, James 24 Oct): the motorway carries
 * straight on over a give-way roundabout on a bridge deck; up to four slip roads and a rural road join the 2-lane ring.
 * No traffic lights. UK clockwise ring, left-hand driving. Lower layer = ring / slips (layer 0), deck = motorway (layer 1).
 * Built at load (j103Build from main.js) on top of the baked map; AI paths (j103Plan from traffic.js planPiece),
 * sat nav two levels (satnav.js navAStar virtual under-deck nodes), player / police layers, chunk art, live deck pass.
 */
// ===== BLUEPRINT =====
// A grade-separated "main road over roundabout" junction is fully described by these parameters; every coordinate below is
// derived from them (nothing site-specific in the code). Every entry in J3_SITES is built (multi-site). The geometry is worked
// out in a LOCAL frame where the main road runs E-W and the arm leaves south (ruralSide +1) or north (-1); heading "v" sites
// (N-S main road) are the same junction rotated 90 deg anticlockwise about the centre (a rotation keeps the UK clockwise ring
// and left-hand lanes). Local "eb" = travelling local +x (for heading "v": northbound); local "wb" = local -x (southbound).
const J3_SITES = [
  // J103 (James 24 Oct): motorway seg 58 E-W, rural seg 145 at an at-grade junction, Old Desert Road Fuel moved off the ring
  { name: "J103", mw: [58], rural: 145, cx: 901, heading: "h", ruralSide: 1, arms: ["ebOff", "ebOn", "wbOff", "wbOn"],
    services: { x0: 906, x1: 926, y0: 102, y1: 116, shift: 11, spur: true } },
  // East (James 25 Oct): the water-edge roundabout (world.rbs[0]) at (1945,720): N-S highway segs 59 (north) + 60 (south)
  // become one main road over the bridge deck; the west highway (seg 69, 6 wide) is the arm; the sea is filled where needed.
  { name: "East", mw: [59, 60], rural: 69, rbOld: 0, cx: 1945, cy: 720, heading: "v", ruralSide: -1, ruralW: 6,
    arms: ["ebOff", "ebOn", "wbOff", "wbOn"], landFill: true },
];
const J3_BP = { RO: 11, RI: 7, Rout: 10, Rin: 8, deckHalf: 15, slipReach: 66, slipMid: 39, slipKnee: 17, slipOut: 9, ZID: 250 };
let J3 = { on: false, J: null, rb: null }; // the CURRENT site context (every public entry point selects one)
const J3S = []; // all built sites
// ---- local <-> world frame (tiles). rot: heading "v" = local rotated 90 deg anticlockwise about (cx, cy) ----
const j3W = (p) => (J3.rot ? [J3.cx + (p[1] - J3.cy), J3.cy - (p[0] - J3.cx)] : p);
const j3L = (p) => (J3.rot ? [J3.cx - (p[1] - J3.cy), J3.cy + (p[0] - J3.cx)] : p);
const j3vW = (u) => (J3.rot ? [u[1], -u[0]] : u);
const j3vL = (u) => (J3.rot ? [-u[1], u[0]] : u);
const j3aW = (a) => (J3.rot ? a - Math.PI / 2 : a); // local angle -> world angle
function j3push(v, x, y) { const p = j3W([x, y]); pathPush(v, p[0] * M_T, p[1] * M_T); }
function j3lineL(v, x, y) { const p = j3W([x, y]); pathLine(v, p[0] * M_T, p[1] * M_T); }
// segment axis helpers. ax "m" = main road (local x along), "r" = arm (local y along)
function j3dW(sg, ax, dL) { const e = j3vW(ax === "m" ? [dL, 0] : [0, dL]); return sg.dir === "h" ? e[0] : e[1]; }
function j3dL(sg, ax, dW) { const e = j3vL(sg.dir === "h" ? [dW, 0] : [0, dW]); return ax === "m" ? e[0] : e[1]; }
function j3aWof(sg, ax, aL) { const p = j3W(ax === "m" ? [aL, J3.cy] : [J3.rx, aL]); return sg.dir === "h" ? p[0] : p[1]; }
function j3aLof(sg, ax, aW) { const c = j3W([J3.cx, J3.cy]), p = j3L(sg.dir === "h" ? [aW, c[1]] : [c[0], aW]); return ax === "m" ? p[0] : p[1]; }
function j3lane(sg, ax, dL, lane, aL) { const p = lanePt(sg, j3dW(sg, ax, dL), lane, j3aWof(sg, ax, aL)); return j3L([p[0] / M_T, p[1] / M_T]); }
function j3mwAt(aL) { // main-road segment that covers local position aL
  for (const id of J3.mws) { const s = world.segs[id], a = j3aWof(s, "m", aL); if (a >= s.b0 - 0.5 && a <= s.b1 + 1.5) return s; }
  return world.segs[J3.mws[0]];
}
const j3isMw = (i) => J3.mwSet.has(J3.mainV ? world.roadV[i] : world.roadH[i]);
// world bbox (tiles) of a local box [x0,x1,y0,y1]
function j3boxW(B) {
  const P = [[B[0], B[2]], [B[1], B[2]], [B[0], B[3]], [B[1], B[3]]].map(j3W);
  return [Math.min(...P.map((p) => p[0])), Math.max(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[1]))];
}
// derive the geometry for a site (local tiles)
function j3setup(site) {
  const B = J3_BP, mws = [].concat(site.mw), mw = world.segs[mws[0]], ru = world.segs[site.rural];
  const want = site.heading === "v" ? "v" : "h";
  if (!mw || mws.some((id) => !world.segs[id] || world.segs[id].dir !== want)) throw new Error("j103 blueprint: main road must match heading");
  const rot = want === "v" ? 1 : 0;
  // local centre: h -> (site.cx, motorway centre line); v -> (motorway centre line, site.cy)
  const cx = rot ? mw.a + mw.w / 2 : site.cx, cy = rot ? site.cy : mw.a + mw.w / 2;
  J3 = { on: false, J: null, rb: null, ...B, ZID: site.ZID || B.ZID, site, rot, mainV: rot, mws, mwSet: new Set(mws), mw: mws[0], ruralId: site.rural, cx, cy };
  // main road edges in local y (a rotation maps world x -> local y without flipping)
  const top = rot ? cy + (mw.a - cx) : mw.a, bot = top + mw.w, rs = site.ruralSide || 1;
  const rx = rot ? cx - (ru.a + ru.w / 2 - cy) : ru.a + ru.w / 2; // arm centre line (local x)
  const rW = site.ruralW || 2, far = 36 + Math.max(0, rW - 2);
  Object.assign(J3, { top, bot, rs, rx, rW, X0: cx - B.deckHalf, X1: cx + B.deckHalf, DY0: top - 0.8, DY1: bot + 0.8,
    zone: [cx - B.deckHalf - 2, cx + B.deckHalf + 2, top - 2.5, bot + 2.5],
    navBox: rs > 0 ? [cx - 41, cx + 44, top - 13, bot + 23] : [cx - 44, cx + 41, top - 23, bot + 13], far: [cx - 29, cx + 29],
    art: rs > 0 ? [cx - 91, cx + 91, top - 13, bot + 37] : [cx - 91, cx + 91, top - 37, bot + 13], armLen: far });
  const E = B.RO - 1.6, P = (th, R) => [cx + R * Math.cos((th * Math.PI) / 180), cy + R * Math.sin((th * Math.PI) / 180)];
  const yN = top - 0.85, yS = bot + 0.85; // parallel diverge / merge lanes sit flush against the main road edge (overlap -> no gap)
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
  // the arm: straight in on its own centre line, flared at the mouth; a wide (dual carriageway) arm keeps its full width
  J3.rural = { b: [[rx, cy + rs * far], [rx, cy + rs * 25], [rx, cy + rs * 17], P(rm, E)], ring: 1, mouth: rm, wide: rW > 2 ? rW - 0.1 : 2.0 };
  J3.ruralEnd = cy + rs * (B.RO + 2); // the arm segment now starts here
  J3.mouths = Object.values(J3.slips).map((q) => q.mouth).concat([rm]);
  J3.artW = j3boxW(J3.art); J3.zoneW = j3boxW(J3.zone); J3.navW = j3boxW(J3.navBox);
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
const j3inZone = (x, y) => x >= J3.zone[0] && x <= J3.zone[1] && y >= J3.zone[2] && y <= J3.zone[3]; // local tiles
const j3inZoneW = (x, y) => { const p = j3L([x, y]); return j3inZone(p[0], p[1]); }; // world tiles
// select the site whose zone holds the world point (tiles); returns it (and makes it current) or null
function j3siteAtW(x, y) { for (const c of J3S) { J3 = c; if (j3inZoneW(x, y)) return c; } return null; }
// tarmac half-width of a slip at parameter t (widened flared mouth at the ring end, ~2.1 m lane -> +2.2 tiles)
function j3hw(sl, t, base) {
  const d = sl.ring ? t : 1 - t, f = Math.max(0, (d - 0.72) / 0.28);
  return (base + 2.2 * f * f) / 2;
}
// is the point (LOCAL tiles) on lower-level tarmac (ring, slips, arm mouth, services spur)?
function j3onLower(x, y) {
  const r = Math.hypot(x - J3.cx, y - J3.cy);
  if (r <= J3.RO && r >= J3.RI) return true;
  if (Math.abs(x - J3.rx) < Math.max(1, J3.rW / 2) && (y - J3.cy) * J3.rs >= 0 && Math.abs(y - J3.cy) <= J3.armLen) return r >= J3.RI;
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
// tests / tools: j3onLower for a given site context
function j3onLowerAt(c, x, y) { J3 = c; return j3onLower(x, y); }
// world-tile version
const j3onLowerW = (x, y) => { const p = j3L([x, y]); return j3onLower(p[0], p[1]); };

// ---------------- build (once, after the baked map is loaded) ----------------
function j103Build() {
  if (J3S.length || !world.segs) return;
  for (const site of J3_SITES) {
    try { j3buildSite(site); } catch (e) { console.warn("j103 site " + site.name + ": " + e.message); }
  }
  let vb = 0;
  for (const c of J3S) { c.vbase = vb; vb += c.vr.length; }
  for (const c of J3S) { J3 = c; for (const [k, n] of c.vmap) c.vmap.set(k, n + c.vbase); }
  if (world.chunkObjs && typeof worldChunkIndex === "function") worldChunkIndex(world.objects);
  if (typeof chunkCache !== "undefined") chunkCache.clear();
  if (typeof chunkLo !== "undefined") chunkLo.clear(); // zoomed-out copies too (phones): no stale pre-junction ground
  world.j3s = J3S;
  world.j103 = J3S[0] || null;
  J3 = J3S[0] || J3;
}
function j3buildSite(site) {
  if (!world.segs[[].concat(site.mw)[0]] || !world.segs[site.rural]) return;
  j3setup(site);
  site.ZID = site.ZID || J3_BP.ZID + J3S.length;
  J3.ZID = site.ZID;
  const N = MW * MH, ru = world.segs[J3.ruralId];
  let J = null;
  if (site.rbOld != null) {
    // a former roundabout: retire it (no paint, no lamps, no masks, no approach marks); the main road runs through
    const rb = world.rbs[site.rbOld];
    if (!rb) return;
    rb.dead = true;
    J3.rbOld = site.rbOld;
    const AW = J3.artW;
    for (let ty = Math.floor(AW[2]); ty <= Math.ceil(AW[3]); ty++)
      for (let tx = Math.floor(AW[0]); tx <= Math.ceil(AW[1]); tx++) {
        if (!inb(tx, ty)) continue;
        const i = idx(tx, ty);
        if (world.rbMask && world.rbMask[i] === rb.id + 1) {
          world.rbMask[i] = 0; G[i] = T.SAND; world.roadH[i] = world.roadV[i] = -1;
        }
      }
    const segIds = new Set(J3.mws.concat([J3.ruralId]));
    for (const o of world.objects) {
      if (o._dead) continue;
      if (o.kind === "rb" && Math.hypot(o.x / TILE - rb.cx, o.y / TILE - rb.cy) < rb.rout + 4) o._dead = true;
      if (o.kind === "appr" && o.sg && segIds.has(o.sg.id) && Math.abs(o.lineA - (o.sg.dir === "h" ? rb.cx : rb.cy)) < rb.rout + 4) o._dead = true;
    }
    world.objects = world.objects.filter((o) => !o._dead);
    if (world.marks) world.marks = world.marks.filter((m) => !(m.kind === "appr" && m.sg && segIds.has(m.sg.id) && Math.abs(m.lineA - (m.sg.dir === "h" ? rb.cx : rb.cy)) < rb.rout + 4));
    if (rb.appr) rb.appr = {};
    // the main road joins up across the old ring (one continuous carriageway under the deck)
    const sa = world.segs[J3.mws[0]], sb = world.segs[J3.mws[1]];
    if (sb) {
      const v = sa.dir === "v", g0 = Math.min(sa.b1, sb.b1) + 1, g1 = Math.max(sa.b0, sb.b0) - 1;
      for (let p = g0; p <= g1; p++)
        for (let l = sa.a; l < sa.a + sa.w; l++) {
          const i = v ? idx(l, p) : idx(p, l);
          G[i] = T.ROAD;
          if (v) { world.roadV[i] = sa.id; world.roadH[i] = -1; } else { world.roadH[i] = sa.id; world.roadV[i] = -1; }
          if (world.rbMask) world.rbMask[i] = 0;
        }
    }
    J3.rb = { cx: J3.cx, cy: J3.cy, rin: J3.RI, rout: J3.RO, arms: [], id: 950 + site.rbOld, j103: true, ctx: J3 };
  } else {
    J = (world.junctions || []).find((j) => J3.mwSet.has(j.hs) && j.vs === site.rural);
    if (!J) return;
    J3.J = J;
    J.gs = true;
    J.lights = false;
    for (const k in J.appr) J.appr[k].lights = false;
    world.overhead = world.overhead.filter((o) => !(o.kind === "mast" && o.J === J)); // signal gantries gone
    // pseudo roundabout for the give-way logic in traffic.js (not in world.rbs: no arms, no generator paint)
    J3.rb = { cx: J3.cx, cy: J3.cy, rin: J3.RI, rout: J3.RO, arms: [], id: 900 + J.id, j103: true, ctx: J3 };
  }
  for (const q of j3arms()) q.S = j3samp(q.b, 80);
  // 1) optional services forecourt moved off the ring (J103: Old Desert Road Fuel, 11 tiles south onto its own spur)
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
  // 2) sea fill: wherever the junction (ring, slips, tapers, deck + 4 tiles of verge) would sit in water, make land, and
  //    smooth the new shoreline (per row: running max over +-6 rows, +3 tiles) so it reads as a reclaimed embankment
  if (site.landFill) j3landFill();
  // 3) lower-level tiles: ring, slips, arm mouth, services spur. Fully covered tiles become road (-2, no rb mask)
  const lo = (J3.lo = new Uint8Array(N));
  const AW = J3.artW;
  // the arm segment itself (world): lateral inside its width, beyond the new mouth end
  const endW = j3W([J3.rx, J3.ruralEnd]), endA = ru.dir === "h" ? endW[0] : endW[1], cA = ru.dir === "h" ? J3.cx : J3.cy;
  const armSide = endA < (ru.dir === "h" ? j3W([J3.cx, J3.cy])[0] : j3W([J3.cx, J3.cy])[1]) ? -1 : 1; // which way the arm runs away
  const onRu = (tx, ty) => {
    const lat = ru.dir === "h" ? ty : tx, al = (ru.dir === "h" ? tx : ty) + 0.5;
    return lat >= ru.a && lat < ru.a + ru.w && (al - endA) * armSide > 0;
  };
  for (let ty = Math.floor(AW[2]); ty <= Math.ceil(AW[3]); ty++)
    for (let tx = Math.floor(AW[0]); tx <= Math.ceil(AW[1]); tx++) {
      if (!inb(tx, ty)) continue;
      const i = idx(tx, ty);
      if (j3isMw(i)) continue;
      let n = 0;
      for (const [ox, oy] of [[0.5, 0.5], [0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]) if (j3onLowerW(tx + ox, ty + oy)) n++;
      const r = Math.hypot(tx + 0.5 - j3W([J3.cx, J3.cy])[0], ty + 0.5 - j3W([J3.cx, J3.cy])[1]);
      if (j3onLowerW(tx + 0.5, ty + 0.5) && !onRu(tx, ty)) {
        lo[i] = 1;
        G[i] = T.ROAD;
        world.roadH[i] = world.roadV[i] = -2;
        if (world.rbMask) world.rbMask[i] = 0;
      } else if (onRu(tx, ty)) lo[i] = 1; // the arm road itself
      else if (r < J3.RI - 0.3) {
        G[i] = T.ISLAND;
        world.roadH[i] = world.roadV[i] = -1;
      } else if (n > 0 && (world.roadV[i] === J3.ruralId || world.roadH[i] === J3.ruralId || G[i] === T.ROAD)) {
        G[i] = T.SAND;
        world.roadH[i] = world.roadV[i] = -1;
      } else if ((world.roadV[i] === J3.ruralId || world.roadH[i] === J3.ruralId) && !onRu(tx, ty)) {
        G[i] = T.SAND;
        world.roadH[i] = world.roadV[i] = -1;
      }
      if (n > 0 && lo[i] !== 1 && G[i] === T.CONC) G[i] = T.SAND;
      if (lo[i] === 1 && site.rbOld != null) for (const o of world.objects) if (!o._dead && (o.kind === "scrub" || o.kind === "rock" || o.kind === "cactus" || o.kind === "tree" || o.kind === "hedge") && Math.floor(o.x / TILE) === tx && Math.floor(o.y / TILE) === ty) o._dead = true;
    }
  if (site.rbOld != null) world.objects = world.objects.filter((o) => !o._dead);
  if (armSide > 0) ru.b0 = Math.ceil(endA); else ru.b1 = Math.floor(endA) - 1; // the arm now starts at the ring mouth
  // 4) two layers under the deck: foZ zone + sat nav virtual lower nodes on main-road tiles the ring passes under
  if (!world.foZ) world.foZ = new Uint8Array(N);
  J3.vr = [];
  J3.vmap = new Map();
  const ZW = J3.zoneW, C = j3W([J3.cx, J3.cy]);
  for (let ty = Math.floor(ZW[2]); ty <= Math.ceil(ZW[3]); ty++)
    for (let tx = Math.floor(ZW[0]); tx <= Math.ceil(ZW[1]); tx++) {
      if (!inb(tx, ty)) continue;
      const i = idx(tx, ty);
      if (!world.foZ[i]) world.foZ[i] = J3.ZID;
      if (j3isMw(i)) {
        const r = Math.hypot(tx + 0.5 - C[0], ty + 0.5 - C[1]);
        if (r >= J3.RI - 0.2 && r <= J3.RO + 0.2) {
          J3.vmap.set(i, N + J3.vr.length);
          J3.vr.push(i);
        }
      }
    }
  // sat nav "far" band along the main road (world tile coordinate along the main axis)
  const f0 = j3W([J3.far[0], J3.cy]), f1 = j3W([J3.far[1], J3.cy]), k = J3.mainV ? 1 : 0;
  J3.farW = [Math.min(f0[k], f1[k]), Math.max(f0[k], f1[k])];
  J3.on = true;
  J3S.push(J3);
}
// sea -> land around a site (world tiles); keeps a smooth shoreline. Records the filled tiles in J3.fill (tests / shots)
function j3landFill() {
  const AW = J3.artW, pad = 5, need = new Map(); // row -> [minX, maxX] of tiles that must be land
  const isLand = (p) => {
    if (j3onLower(p[0], p[1])) return true;
    // deck / main road band and the arm, plus verge
    if (p[0] >= J3.cx - J3_BP.slipReach - 20 && p[0] <= J3.cx + J3_BP.slipReach + 20 && p[1] >= J3.top - 1 && p[1] <= J3.bot + 1) return true;
    return false;
  };
  for (let ty = Math.floor(AW[2]) - pad; ty <= Math.ceil(AW[3]) + pad; ty++)
    for (let tx = Math.floor(AW[0]) - pad; tx <= Math.ceil(AW[1]) + pad; tx++) {
      if (!inb(tx, ty) || G[idx(tx, ty)] !== T.WATER) continue;
      let hit = false;
      for (let dy = -pad; dy <= pad && !hit; dy++) for (let dx = -pad; dx <= pad && !hit; dx++) if (isLand(j3L([tx + 0.5 + dx, ty + 0.5 + dy]))) hit = true;
      if (!hit) continue;
      const r = need.get(ty) || [1e9, -1e9];
      r[0] = Math.min(r[0], tx); r[1] = Math.max(r[1], tx);
      need.set(ty, r);
    }
  const rows = [...need.keys()].sort((a, b) => a - b), fill = [];
  for (const ty of rows) {
    // smooth: running max of the needed extent over +-6 rows, then +3 tiles, tapering at the ends
    let hi = -1e9, lo = 1e9;
    for (let d = -6; d <= 6; d++) { const r = need.get(ty + d); if (r) { hi = Math.max(hi, r[1] + 3 - Math.abs(d) * 0.25); lo = Math.min(lo, r[0] - 3 + Math.abs(d) * 0.25); } }
    for (let tx = Math.floor(lo); tx <= Math.ceil(hi); tx++) {
      if (!inb(tx, ty)) continue;
      const i = idx(tx, ty);
      if (G[i] === T.WATER) { G[i] = T.SAND; fill.push(i); }
    }
  }
  J3.fill = fill;
}
// ---------------- sat nav: virtual under-deck nodes ----------------
// virtual node ids: N + site.vbase + k. navAStar asks j3NavBox for real nodes, j3NavStep for the step in direction d.
function j3NavTotal() { let n = 0; for (const c of J3S) n += c.vr.length; return n; }
function j3siteOfNode(i) {
  const N = MW * MH;
  if (i >= N) { const k = i - N; for (const c of J3S) if (k >= c.vbase && k < c.vbase + c.vr.length) return c; return null; }
  const x = i % MW, y = (i / MW) | 0;
  for (const c of J3S) { const B = c.navW; if (x >= B[0] && x <= B[1] && y >= B[2] && y <= B[3]) return c; }
  return null;
}
function j3NavBox(t) { return !!j3siteOfNode(t); }
function j3NavStep(i, d) {
  const c = j3siteOfNode(i);
  if (!c) return i + d;
  J3 = c;
  const N = MW * MH, V = i >= N;
  const ri = V ? J3.vr[i - N - J3.vbase] : i, j = ri + d, cross = J3.mainV ? Math.abs(d) === 1 : Math.abs(d) === MW;
  if (j < 0 || j >= N) return -1;
  const mw = (t) => j3isMw(t), lo = (t) => J3.lo[t] === 1;
  const aj = J3.mainV ? (j / MW) | 0 : j % MW, far = aj < J3.farW[0] || aj > J3.farW[1];
  if (V) {
    if (!cross) return -1;
    if (J3.vmap.has(j)) return J3.vmap.get(j);
    return lo(j) ? j : -1;
  }
  if (lo(ri) && mw(j)) {
    if (cross && J3.vmap.has(j)) return J3.vmap.get(j);
    return far ? j : -1;
  }
  if (mw(ri) && lo(j)) return far ? j : -1;
  return j;
}
const j3NavReal = (i) => { if (i < MW * MH) return i; const c = j3siteOfNode(i); return c ? c.vr[i - MW * MH - c.vbase] : i; };

// ---------------- AI ----------------
// (all geometry in LOCAL tiles; paths pushed through j3push -> world metres)
function j3cubic(v, p0, t0, p1, t1) {
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 0.42;
  const b = [p0, [p0[0] + t0[0] * L, p0[1] + t0[1] * L], [p1[0] - t1[0] * L, p1[1] - t1[1] * L], p1];
  const n = Math.max(6, Math.ceil(L * 3));
  for (let k = 1; k <= n; k++) {
    const q = j3bz(b, k / n);
    j3push(v, q[0], q[1]);
  }
}
const j3tan = (a) => [-Math.sin(a), Math.cos(a)]; // clockwise (screen) ring tangent at angle a
const j3ringPt = (a, R) => [J3.cx + Math.cos(a) * R, J3.cy + Math.sin(a) * R];
const j3unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
// distance (tiles) of a world-metre path point from the ring centre (the centre is the same point in both frames)
const j3rW = (x, y) => { const C = j3W([J3.cx, J3.cy]); return Math.hypot(x / M_T - C[0], y / M_T - C[1]); };
// enter the ring from point A (local tiles, heading tA) at mouth angle mouth (deg); returns {aJ, dGw}
function j3enter(v, A, tA, mouth, R) {
  const aJ = (mouth * Math.PI) / 180 + 0.34;
  const d0 = pathEnd(v);
  const J = j3ringPt(aJ, R);
  j3cubic(v, A, tA, J, j3tan(aJ));
  let dGw = pathEnd(v);
  for (let k = v.px.length - 1; k >= 0 && v.pd[k] >= d0; k--)
    if (j3rW(v.px[k], v.py[k]) > J3.RO + 0.35) { dGw = v.pd[k]; break; }
  return { aJ, dGw };
}
function j3ring(v, a0, a1, R) {
  let del = mod2pi(a1 - a0);
  if (del < 0.3) del += 2 * Math.PI;
  const k = Math.ceil((del * R * M_T) / 2);
  for (let i = 1; i <= k; i++) {
    const p = j3ringPt(a0 + (del * i) / k, R);
    j3push(v, p[0], p[1]);
  }
  return del;
}
function j3follow(v, S, t0, t1) {
  const n = S.length - 1, s = Math.sign(t1 - t0) || 1;
  for (let i = Math.round(t0 * n); s > 0 ? i <= Math.round(t1 * n) : i >= Math.round(t1 * n); i += s) j3push(v, S[i][0], S[i][1]);
}
function j3tAt(sl, rr) {
  const S = sl.S, n = S.length - 1;
  if (sl.ring) { for (let i = 0; i <= n; i++) if (j3r(S[i]) < rr) return i / n; return 1; }
  for (let i = n; i >= 0; i--) if (j3r(S[i]) < rr) return i / n;
  return 0;
}
// the ring part shared by every movement: give way, circulate, leave. aOut = exit angle (local rad); markers carry WORLD angles
function j3ringMove(v, en, aOut, R, key) {
  const mrb = { kind: "rb", d: en.dGw, rb: J3.rb, ang: j3aW(en.aJ + 0.18), key, ln: 0, join: en.dGw + 6 };
  v.mk.push(mrb);
  const dIn = en.dGw - 25;
  const del = j3ring(v, en.aJ, aOut, R);
  const d1 = pathEnd(v);
  return { mrb, del, d1, dIn };
}
function j3after(v, mv, d1, R, aOut) {
  const end = pathEnd(v);
  if (R < J3.Rout - 0.5) v.mk.push({ kind: "rbx", d: d1, d1: d1 + 4, rb: J3.rb, aOut: j3aW(aOut), R: R * M_T });
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
const j3mW = (p) => { const q = j3W(p); return [q[0] * M_T, q[1] * M_T]; }; // local tiles -> world metres
// junction hook (traffic.js planPiece, J.gs): J103-style sites built on an at-grade junction
function j103Plan(v, r, sg, d, J, o) {
  const c = J3S.find((q) => q.J === J);
  if (!c) return false;
  J3 = c;
  const opts = [];
  for (const q of o.opts) {
    if (q[0] === "S") opts.push(["S", null, 0, q[3]]);
    else if (q[1] && q[1].id === J3.ruralId) opts.push(["X", q[1], 0, q[3]]);
    else if (q[1] && J3.mwSet.has(q[1].id)) opts.push(["A", q[1], j3dL(q[1], "m", q[2]), q[3]]);
  }
  return j3Plan(v, r, sg, d, opts);
}
// segment-end hook (traffic.js planPiece, no junction ahead): sites built on a former roundabout
function j103SegEnd(v, r, sg, d) {
  if (!J3S.length) return false;
  const rbId = d > 0 ? sg.rb1 : sg.rb0;
  if (rbId == null) return false;
  const c = J3S.find((q) => q.rbOld === rbId);
  if (!c) return false;
  J3 = c;
  const isMain = J3.mwSet.has(sg.id);
  if (!isMain && sg.id !== J3.ruralId) return false;
  const opts = isMain ? [["S", null, 0, 2], ["X", world.segs[J3.ruralId], 0, 1]] : [["A", null, 1, 1], ["A", null, -1, 1]];
  return j3Plan(v, r, sg, d, opts);
}
function j3Plan(v, r, sg, d, opts) {
  const P = v.plan;
  if (!opts.length) return false;
  const isMain = J3.mwSet.has(sg.id), ax = isMain ? "m" : "r";
  const dl = j3dL(sg, ax, d), pos = j3aLof(sg, ax, P.pos);
  let tw = 0;
  for (const q of opts) tw += q[3];
  let x = r() * tw, ch = opts[0];
  for (const q of opts) { x -= q[3]; if (x <= 0) { ch = q; break; } }
  if (v.gk && typeof ptPickExit === "function") {
    const k = ptPickExit(v, opts.map((q) => q[0] === "S" ? j3mW([dl > 0 ? J3.X1 + 8 : J3.X0 - 8, J3.cy]) : q[0] === "X" ? j3mW([J3.rx, J3.cy + J3.rs * 25]) : j3mW([J3.cx + q[2] * 89, J3.cy])));
    if (k >= 0) ch = opts[k];
  }
  if (isMain) {
    const dv = dl > 0 ? J3.cx - J3.slipReach : J3.cx + J3.slipReach; // diverge (start of the off-slip's parallel lane)
    const need = P.lane * 13 + 12; // tiles needed to reach the kerb lane and taper out
    const xT = dl > 0 ? Math.max(dv + 6, pos + need) : Math.min(dv - 6, pos - need);
    const sl0 = dl > 0 ? J3.slips.ebOff : J3.slips.wbOff;
    const late = !sl0 || (dl > 0 ? xT > J3.cx - 48 : xT < J3.cx + 48);
    if (J3.dbg) J3.dbg.push([v.id, dl, pos | 0, ch[0], late]);
    if (ch[0] !== "S" && late) ch = opts.find((q) => q[0] === "S") || ch;
    if (ch[0] === "S") {
      const a0 = dl > 0 ? Math.max(pos, J3.X0 - 2) : Math.min(pos, J3.X1 + 2), a1 = dl > 0 ? J3.X1 + 2 : J3.X0 - 2;
      let p = j3lane(sg, "m", dl, P.lane, a0);
      j3lineL(v, p[0], p[1]);
      const d0 = pathEnd(v), sT = j3mwAt(a1);
      p = j3lane(sT, "m", dl, P.lane, a1);
      j3lineL(v, p[0], p[1]);
      v.mk.push({ kind: "fo", d0: d0 - 1, d1: pathEnd(v) + 1, fo: -1, j103: 1 });
      P.seg = sT.id; P.dir = j3dW(sT, "m", dl); P.pos = j3aWof(sT, "m", a1);
      return true;
    }
    // off-slip: move to the kerb lane in good time, taper out onto the slip, give way, round, out onto the arm
    const sl = sl0;
    const xS = xT - dl * 10; // taper start
    let cur = pos;
    if (P.lane > 0) {
      if (P.lane > 1) {
        const m = cur + dl * Math.max(2, Math.abs(xS - cur) * 0.45);
        laneChange(v, sg, d, P.lane, 1, j3aWof(sg, "m", cur), j3aWof(sg, "m", m));
        cur = m;
        P.lane = 1;
      }
      laneChange(v, sg, d, P.lane, 0, j3aWof(sg, "m", cur), j3aWof(sg, "m", xS));
      P.lane = 0;
    }
    let p = j3lane(sg, "m", dl, 0, xS);
    j3lineL(v, p[0], p[1]);
    const dS = pathEnd(v);
    let t0 = 0;
    for (let i = 0; i < sl.S.length; i++) if ((sl.S[i][0] - xT) * dl <= 0) t0 = i / (sl.S.length - 1);
    const Q = j3bz(sl.b, t0);
    { const y0 = p[1], n = 24;
      for (let k = 1; k <= n; k++) { const t = k / n, e = t * t * (3 - 2 * t); j3push(v, xS + (Q[0] - xS) * t, y0 + (Q[1] - y0) * e); } }
    v.mk.push({ kind: "sig", d0: dS - 30, d1: pathEnd(v), side: -1 });
    const tA = j3tAt(sl, J3.RO + 3.2);
    j3follow(v, sl.S, t0, tA);
    const A = j3bz(sl.b, tA), A2 = j3bz(sl.b, Math.max(0, tA - 0.02));
    v.mk.push({ kind: "slow", d0: pathEnd(v) - 60, d1: pathEnd(v), v: 13 });
    // inner lane for long ways round, outer otherwise
    const aOutDeg = J3.rural.mouth - 19.5, aOut = (aOutDeg * Math.PI) / 180;
    const del0 = mod2pi(aOut - ((sl.mouth * Math.PI) / 180 + 0.34));
    const R = del0 > 3.0 ? J3.Rin : J3.Rout;
    const en = j3enter(v, A, j3unit(A2, A), sl.mouth, R);
    const mv = j3ringMove(v, en, aOut, R, "j103:" + (dl > 0 ? "ebOff" : "wbOff"));
    const d1 = mv.d1;
    const ru = world.segs[J3.ruralId], ePos = J3.cy + J3.rs * 15, q = j3lane(ru, "r", J3.rs, 0, ePos);
    j3cubic(v, j3ringPt(aOut, R), j3tan(aOut), q, [0, J3.rs]);
    j3after(v, mv, d1, R, aOut);
    P.seg = J3.ruralId; P.dir = j3dW(ru, "r", J3.rs); P.lane = 0; P.pos = j3aWof(ru, "r", ePos);
    return true;
  }
  // from the arm towards the junction: give way at the mouth, round, up the on-slip, merge onto the main road
  if (sg.id === J3.ruralId && dl === -J3.rs) {
    let tgt = ch[0] === "A" ? ch[2] : r() < 0.5 ? 1 : -1;
    if (!(tgt > 0 ? J3.slips.ebOn : J3.slips.wbOn)) tgt = -tgt;
    const sl = tgt > 0 ? J3.slips.ebOn : J3.slips.wbOn;
    if (!sl) return false;
    // wide (dual) arm: drop to the kerb lane first
    const p0 = J3.cy + J3.rs * 24;
    if (P.lane > 0 && (pos - p0) * J3.rs > 4) { laneChange(v, sg, d, P.lane, 0, P.pos, j3aWof(sg, "r", p0)); P.lane = 0; }
    let p = j3lane(sg, "r", dl, P.lane, J3.cy + J3.rs * 15);
    j3lineL(v, p[0], p[1]);
    const A = [p[0], p[1]];
    const aOut = (sl.mouth * Math.PI) / 180 - 0.34;
    const aJ0 = (J3.rural.mouth * Math.PI) / 180 + 0.34;
    const R = mod2pi(aOut - aJ0) > 3.0 ? J3.Rin : J3.Rout;
    { const pm = [A[0], J3.cy + J3.rs * (J3.RO + 1.2)]; j3lineL(v, pm[0], pm[1]); A[1] = pm[1]; }
    const en = j3enter(v, A, [0, -J3.rs], J3.rural.mouth, R);
    const mv = j3ringMove(v, en, aOut, R, "j103:rural");
    const d1 = mv.d1;
    const tB = j3tAt(sl, J3.RO + 3.2), B = j3bz(sl.b, tB), B2 = j3bz(sl.b, Math.min(1, tB + 0.02));
    j3cubic(v, j3ringPt(aOut, R), j3tan(aOut), B, j3unit(B, B2));
    j3after(v, mv, d1, R, aOut);
    j3follow(v, sl.S, tB, 1);
    // merge: slip end -> main road kerb lane over 16 tiles, giving way to lane-0 traffic
    const E0 = sl.b[3][0], sT = j3mwAt(E0 + tgt * 16), q0 = j3lane(sT, "m", tgt, 0, E0 + tgt * 16);
    const y0 = sl.b[3][1], y1 = q0[1], n = 32;
    const dM = pathEnd(v);
    for (let k = 1; k <= n; k++) { const t = k / n, e = t * t * (3 - 2 * t); j3push(v, E0 + tgt * 16 * t, y0 + (y1 - y0) * e); }
    const wa = j3W([E0 + tgt * 9, y1]), vert = sT.dir === "v";
    v.mk.push({ kind: "jm", d: dM + 6 * M_T, dEnd: pathEnd(v), dir: j3dW(sT, "m", tgt), vert, ctx: J3,
      ax: (vert ? wa[1] : wa[0]) * M_T, ly: (vert ? wa[0] : wa[1]) * M_T });
    v.mk.push({ kind: "sig", d0: dM - 20, d1: pathEnd(v), side: 1 });
    P.seg = sT.id; P.dir = j3dW(sT, "m", tgt); P.lane = 0; P.pos = j3aWof(sT, "m", E0 + tgt * 16);
    return true;
  }
  return false;
}
// entry mouth must be clear of anything on the ring or leaving it (lorries + trailers sweep the mouth). m.ang is WORLD
function j103MouthBusy(v, m) {
  const rb = m.rb, a = m.ang - 0.52, mx = (rb.cx + Math.cos(a) * (rb.rout - 1)) * M_T, my = (rb.cy + Math.sin(a) * (rb.rout - 1)) * M_T, R2 = (5.5 * M_T) ** 2;
  for (const o of traffic.vs) {
    if (o === v || o.ring !== rb) continue;
    if (v.stopT > 20 && o.v < 0.3 && o.stopT > 20) continue; // long mutual wait: a parked-up ring vehicle no longer blocks
    for (const p of o.trl ? [o, o.trl] : [o]) if ((p.x - mx) ** 2 + (p.y - my) ** 2 < R2) return true;
  }
  return false;
}
// on-slip merge: hold at the end of the slip while lane-0 traffic (or the player) is alongside / closing
function j103Merge(v, m, front, v0) {
  const gap = m.d - front;
  if (gap > 45 || gap < -2 || m.go) return null;
  if (m.ctx) J3 = m.ctx;
  const relax = v.stopT > 10;
  const back = relax ? 18 : 40, ahead = relax ? 6 : 12;
  let blk = false;
  const chk = (x, y, vel) => {
    const lat = m.vert ? x : y, al = m.vert ? y : x;
    if (Math.abs(lat - m.ly) > 1.0 * M_T) return;
    const s = (al - m.ax) * m.dir;
    if (s > -back - Math.max(0, vel) * 1.2 && s < ahead) blk = true;
  };
  for (const o of traffic.vs) {
    if (o === v || o.parked || o.layer) continue;
    if (o.mk.some((q) => q.kind === "jm" && !q.go && q !== m)) continue; // queued behind us on the slip
    chk(o.x, o.y, o.v);
  }
  if (!(truck.foLay === 0 && j3inZoneW(truck.x / M_T, truck.y / M_T))) chk(truck.x, truck.y, truck.v);
  if (!blk) { if (gap < 3) m.go = true; return null; }
  return idmAcc(v, v0, Math.max(0.1, gap), 0);
}
// spawn guard (traffic.js): never spawn on a deck (the layer comes from the junction plan)
function j103NoSpawn(sg, along) {
  for (const c of J3S) {
    if (!c.mwSet.has(sg.id)) continue;
    J3 = c;
    const a = j3aLof(sg, "m", along);
    if (a > c.X0 - 6 && a < c.X1 + 6) return true;
  }
  return false;
}

// ---------------- layers: player, police ----------------
function j3track(o, x, y) {
  const tx = Math.floor(x / M_T), ty = Math.floor(y / M_T);
  if (!inb(tx, ty)) return 0;
  const i = idx(tx, ty), z = world.foZ[i];
  for (const c of J3S) if (z === c.ZID) return o.j3From === "mw" ? 1 : 0;
  let mw = false;
  for (const c of J3S) { J3 = c; if (j3isMw(i)) { mw = true; break; } }
  o.j3From = mw ? "mw" : "lo";
  return 0;
}
function j103PlayerLayer(s) {
  if (!J3S.length) return false;
  const tx = Math.floor(s.x / M_T), ty = Math.floor(s.y / M_T);
  if (!inb(tx, ty)) return false;
  const L = j3track(s, s.x, s.y), z = world.foZ[idx(tx, ty)];
  if (J3S.some((c) => c.ZID === z)) { s.foLay = L; return true; }
  return false;
}
// police / anything kinematic: true when a and b are on different levels inside the same deck zone
function j103Apart(a, o, x, y) {
  if (!J3S.length) return false;
  const c = j3siteAtW(a.x / M_T, a.y / M_T);
  if (!c || !j3inZoneW(x / M_T, y / M_T)) return false;
  const lay = (q) => (q === truck || q === truck.trl ? truck.foLay | 0 : q.pol || q.polT || q.j3L !== undefined ? q.j3L | 0 : q.layer | 0);
  return lay(a) !== lay(o);
}
function j103PolUpdate() {
  if (!J3S.length || typeof POL === "undefined") return;
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
// is ring angle th (deg, local) within a mouth (gap deg; wide arms get a wider gap)
function j3nearMouth(th, gap) {
  return J3.mouths.some((m) => Math.abs(((th - m + 540) % 360) - 180) < (m === J3.rural.mouth && J3.rW > 2 ? gap + 13 : gap));
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
  g.strokeStyle = J3C.KERB; g.lineWidth = 0.14;
  for (let th = 0; th < 360; th += 1) {
    if (j3nearMouth(th, 12)) continue;
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
  const rs = J3.rs, rEnd = cy + rs * J3.armLen, wideArm = J3.rW > 2;
  if (wideArm) {
    // dual carriageway arm: kerbed central reservation up to a splitter nose short of the ring
    const yA = rEnd, yB = cy + rs * (RO + 3.2);
    g.fillStyle = J3C.KERB; g.fillRect(J3.rx - 0.42, Math.min(yA, yB), 0.84, Math.abs(yB - yA));
    g.fillStyle = "#7a8a5a"; g.fillRect(J3.rx - 0.28, Math.min(yA, yB) + (rs > 0 ? 0.3 : 0), 0.56, Math.abs(yB - yA) - 0.3);
    g.fillStyle = J3C.KERB; g.beginPath(); g.arc(J3.rx, yB, 0.42, 0, 7); g.fill();
  } else {
    g.strokeStyle = J3C.LINE; g.lineWidth = 0.1; g.setLineDash([0.8, 0.8]); g.beginPath(); g.moveTo(J3.rx, rEnd); g.lineTo(J3.rx, cy + rs * (RO + 3)); g.stroke(); g.setLineDash([]);
  }
  g.lineWidth = 0.13; g.setLineDash([0.4, 0.3]);
  const entries = sl.filter((q) => q.ring).map((q) => (q === J3.rural ? [q.mouth, 0, wideArm ? 19 : 9] : [q.mouth, -10, 10]));
  for (const [th, h0, h1] of entries)
    for (const R of [RO + 0.15, RO + 0.5]) { g.beginPath(); g.arc(cx, cy, R, ((th + h0) * Math.PI) / 180, ((th + h1) * Math.PI) / 180); g.stroke(); }
  g.setLineDash([]);
  for (const s of sl) if (s.ring && s !== J3.rural) {
    const t = j3tAt(s, RO + 4.5), p = j3bz(s.b, t), q = j3bz(s.b, t + 0.01);
    j3tri(g, p, j3unit(p, q));
  }
  if (wideArm) for (const o of [1.1, 2.4]) j3tri(g, [J3.rx - o * rs, cy + rs * (RO + 3.5)], [0, -rs]);
  else j3tri(g, [J3.rx - 0.5 * rs, cy + rs * (RO + 3.5)], [0, -rs]);
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
// canvas transform local tiles -> world tiles (pre-multiplied onto a tile-unit transform)
function j3gx(g, k) { if (J3.rot) g.transform(0, -1, 1, 0, (J3.cx - J3.cy) * k, (J3.cx + J3.cy) * k); }
// chunk pass: lower level + deck baked into each chunk that overlaps
function j3chunk(c, cx, cy) {
  const x0 = (cx * CHUNK) / TILE, y0 = (cy * CHUNK) / TILE, n = CHUNK / TILE;
  for (const s of J3S) {
    J3 = s;
    const A = J3.artW;
    if (x0 > A[1] + 2 || x0 + n < A[0] - 2 || y0 > A[3] + 2 || y0 + n < A[2] - 2) continue;
    const g = c.getContext("2d");
    g.save(); g.setTransform(TILE, 0, 0, TILE, -x0 * TILE, -y0 * TILE); j3gx(g, 1);
    j3drawLower(g); j3drawDeck(g, true);
    g.restore();
  }
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
// x, y world metres
function j3underDeck(x, y) { const p = j3L([x / M_T, y / M_T]), X = p[0], Y = p[1]; return X > J3.X0 - 1 && X < J3.X1 + 1 && Y > J3.DY0 - 1.5 && Y < J3.DY1 + 1.5; }
function j3deckDraw() { ctx.save(); j3gx(ctx, TILE); ctx.drawImage(j3deckCanvas(), (J3.X0 - 0.5) * TILE, (J3.top - 1.5) * TILE); ctx.restore(); }
function j103DrawDeck(vx0, vy0, vx1, vy1) {
  for (const s of J3S) {
    J3 = s;
    const B = j3boxW([J3.X0, J3.X1, J3.top - 1, J3.bot + 1]);
    if (B[1] * TILE < vx0 || B[0] * TILE > vx1 || B[3] * TILE < vy0 || B[2] * TILE > vy1) continue;
    j3deckDraw();
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
}
// after the player's rig is drawn: if it is under a deck, repaint the deck over it and show a yellow dashed outline
function j103DrawPlayerUnder() {
  if (truck.foLay || !j3siteAtW(truck.x / M_T, truck.y / M_T)) return;
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
  ctx.save(); j3gx(ctx, TILE);
  ctx.beginPath(); ctx.rect(J3.X0 * TILE, J3.DY0 * TILE, (J3.X1 - J3.X0) * TILE, (J3.DY1 - J3.DY0) * TILE);
  ctx.restore(); ctx.clip(); // the path keeps the local transform it was built with
  j3deckDraw();
  for (const B of all) { j3poly(B); ctx.fillStyle = "rgba(255,210,60,0.16)"; ctx.fill(); }
  ctx.setLineDash([0.35 * TILE, 0.25 * TILE]); ctx.lineWidth = 0.16 * TILE; ctx.strokeStyle = "#ffd23c";
  for (const B of all) { j3poly(B); ctx.stroke(); }
  ctx.restore();
}
// street lamps round the ring and along the slips (daynight.js slBuild); world tiles + facing
function j103Lamps() {
  const o = [];
  for (const s of J3S) {
    J3 = s;
    const put = (p, n) => { const q = j3W(p), m = j3vW(n); o.push([q[0], q[1], m[0], m[1]]); };
    for (let th = 0; th < 360; th += 40) {
      const a = (th * Math.PI) / 180, p = j3ringPt(a, J3.RO + 0.9);
      if (p[1] > J3.top - 2 && p[1] < J3.bot + 2) continue;
      if (j3nearMouth(th, 16)) continue;
      put(p, [-Math.cos(a), -Math.sin(a)]);
    }
    for (const sl of Object.values(J3.slips)) {
      for (const t of [0.25, 0.5, 0.75]) {
        const p = j3bz(sl.b, t), q = j3bz(sl.b, t + 0.01), u = j3unit(p, q), w = j3hw(sl, t, 2.1) + 0.8;
        let n = [-u[1], u[0]];
        if ((p[1] - J3.cy) * n[1] < 0) n = [-n[0], -n[1]];
        put([p[0] + n[0] * w, p[1] + n[1] * w], [-n[0], -n[1]]);
      }
    }
  }
  return o;
}
// bake the junctions into the ground chunks
{
  const _rc = renderChunk;
  renderChunk = function (cx, cy) {
    const c = _rc(cx, cy);
    try { j3chunk(c, cx, cy); } catch (e) {}
    return c;
  };
}
// police / emergency cars driven without route markers: level from where they entered a deck zone
function j103Kinematic() {
  if (!J3S.length) return;
  for (const v of traffic.vs) if (v.pol || v.polT || !v.mk || !v.mk.length) { v.j3L = j3track(v, v.x, v.y); v.layer = v.j3L; }
}
// ===== Placing the blueprint at another site =====
// 1. Pick a straight main road: heading "h" (E-W, world.segs[id].dir === "h") or "v" (N-S). mw = [ids] (one segment, or the
//    two segments either side of a former roundabout), with ~70 tiles of clear ground (or sea: landFill) either side.
// 2. Add an entry to J3_SITES:
//    { name, mw: [ids], rural: <arm seg id>, heading: "h" | "v",
//      cx: <junction x tile> (h)   |  cy: <junction y tile> (v; cx comes from the main road),
//      ruralSide: +1 / -1 = arm on the local south / north (local frame: main road E-W; for "v" local north = world west),
//      ruralW: arm width in tiles (2 rural; 6 dual carriageway), arms: any of "ebOff","ebOn","wbOff","wbOn",
//      junction: an at-grade world.junctions entry (hs = main id, vs = arm id)  OR  rbOld: <world.rbs id> to retire,
//      landFill: true to reclaim sea under / around it, services: optional forecourt shift {x0,x1,y0,y1,shift,spur} }.
// 3. Everything else (deck span, ring, slips, tapers, kerbs, give-way lines, lamps, AI paths, sat nav lower nodes, deck
//    zone (own ZID per site), player / police levels) is derived. Run tests/j103_test.py (J103) and tests/j3east_test.py.
// Limits: the arm is straight and lies on the junction centre line; the main road must be straight through the junction.

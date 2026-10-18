/**
 * @file gfxshade.js — GRAPHICS stage 2: soft drop shadows whose direction and length follow the sun (long and warm-angled
 *   at dawn/dusk, short at noon, faded at night). High quality only; low quality keeps the old baked shadows.
 *   - Buildings / trees / props: while a chunk is baked (renderChunk) bShadow, drawShadowRect and treeShadow record
 *     casters (world-space footprint + height) instead of painting. gfxShadeLayer() fills sun-swept hulls into a cached
 *     half-res world-space layer, cuts the footprints / crowns back out, and composites it after the vehicles (so
 *     building shadows fall across traffic too). The layer is rebuilt only when the view leaves it, the zoom changes,
 *     the sun moves a step or new chunks were baked.
 *   - Vehicles / trailers: blitV / blit calls with a shadow offset get the sun offset, the sun alpha and a pre-blurred
 *     copy of the silhouette (cached per art canvas).
 * Exposes (globals): SUN, GS, gfxSun, gfxShadeLayer, gfxShadowArt, gfxQualityChanged
 * Depends on: gfx.js (GFX, gfxHi, gfxSunDir), daynight.js (gameT, DN), render.js (renderChunk, chunkCache, chunkLo, CHUNK, bShadow via bldg2.js,
 *   drawShadowRect, treeShadow), traffic.js (blitV, VS), main.js (blit, drawRail, ctx, RSF), lorry.js (ART_SCALE)
 * Load order: after gfx.js in build.py. All files share one global scope (see AGENTS.md).
 */
const SUN = { dx: 0.7, dy: 0.7, L: 1, a: 1, k: "" }; // unit shadow direction, length factor, alpha factor
const GS = { ch: new Map(), rec: null, ver: 0, lc: null, key: "", R: null };
function gfxDyn() {
  return gfxHi() && !GFX.off.shade;
}
// per frame: sun from the game clock (shadow angle 160 deg at 6h -> 45 at noon -> -70 at 18h)
function gfxSun() {
  const h = ((gameT % 24) + 24) % 24,
    hc = Math.max(6, Math.min(18, h)),
    s = gfxSunDir(hc),
    e = Math.max(0, Math.sin((Math.PI * (h - 6)) / 12)), // sun elevation proxy 0..1
    day = 1 - DN.dark;
  SUN.dx = -s[0];
  SUN.dy = -s[1];
  // long shadows near the horizon, short at noon; at night a short, faint contact shadow remains
  const Ld = Math.min(3, 1.05 / Math.pow(Math.max(e, 0.25), 0.9));
  SUN.L = Ld * day + 0.45 * (1 - day);
  SUN.a = Math.max(0.3, day * Math.min(1, e * 6));
  SUN.k = Math.round(h * 30) + ":" + Math.round(SUN.a * 20);
}
// ---------------------------------------------------------------- baked casters (recorded during renderChunk)
function gsPts(g, x, y, w, h) {
  const m = g.getTransform(),
    o = GS.rec.o,
    P = (px, py) => [m.a * px + m.c * py + m.e + o[0], m.b * px + m.d * py + m.f + o[1]];
  return [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];
}
{
  const bs = bShadow,
    sr = drawShadowRect,
    ts = treeShadow;
  bShadow = function (g, x, y, w, h, s) {
    if (!GS.rec) return bs.apply(this, arguments);
    GS.rec.l.push({ p: gsPts(g, x, y, w, h), s: s * 1.15 });
  };
  drawShadowRect = function (g, x, y, w, h, s) {
    if (!GS.rec) return sr.apply(this, arguments);
    GS.rec.l.push({ p: gsPts(g, x, y, w, h), s: s * 1.2 });
  };
  treeShadow = function (g, x, y, R, dx, dy, a) {
    if (!GS.rec) return ts.apply(this, arguments);
    const m = g.getTransform(),
      o = GS.rec.o;
    GS.rec.l.push({
      t: 1,
      x: m.a * x + m.c * y + m.e + o[0],
      y: m.b * x + m.d * y + m.f + o[1],
      r: R * Math.hypot(m.a, m.b),
      s: Math.hypot(dx, dy) * Math.hypot(m.a, m.b),
    });
  };
  const rc = renderChunk;
  renderChunk = function (cx, cy) {
    if (!gfxDyn()) return rc.apply(this, arguments);
    const k = cx + "," + cy,
      prev = GS.rec;
    // the chunk canvas starts with an identity transform, so canvas px + chunk origin = world px
    GS.rec = { o: [cx * CHUNK, cy * CHUNK], l: [] };
    try {
      return rc.apply(this, arguments);
    } finally {
      GS.ch.set(k, GS.rec.l);
      GS.ver++;
      GS.rec = prev;
    }
  };
}
function gfxQualityChanged() {
  chunkCache.clear(); // re-bake: baked shadows on low, recorded casters on high
  chunkLo.clear();
  GS.ch.clear();
  GS.key = "";
  GS.R = null;
}
// convex hull (monotone chain) of a few points
function gsHull(P) {
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
    lo = [],
    up = [];
  for (const p of P) {
    while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const GS_MAXL = 280; // longest shadow (world px)
function gsBuild(R, z) {
  const q = 0.5,
    W = Math.ceil((R[2] - R[0]) * z * q),
    H = Math.ceil((R[3] - R[1]) * z * q);
  if (!GS.lc) GS.lc = document.createElement("canvas");
  const c = GS.lc;
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
  const g = c.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const s = z * q;
  g.setTransform(s, 0, 0, s, -R[0] * s, -R[1] * s);
  const L = [],
    x0 = Math.floor((R[0] - GS_MAXL) / CHUNK),
    x1 = Math.floor((R[2] + GS_MAXL) / CHUNK),
    y0 = Math.floor((R[1] - GS_MAXL) / CHUNK),
    y1 = Math.floor((R[3] + GS_MAXL) / CHUNK);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const a = GS.ch.get(cx + "," + cy);
      if (a) for (const o of a) L.push(o);
    }
  const dx = SUN.dx * SUN.L,
    dy = SUN.dy * SUN.L;
  g.fillStyle = "#000";
  g.beginPath();
  for (const o of L) {
    const l = Math.min(GS_MAXL, o.s);
    if (o.t) {
      const r = o.r * 1.05;
      // trees: the crown's shadow slides along the sun, a little longer than the old fixed one
      g.moveTo(o.x + dx * l * 0.9 + r, o.y + dy * l * 0.9);
      g.arc(o.x + dx * l * 0.9, o.y + dy * l * 0.9, r, 0, 6.283);
      continue;
    }
    const ox = dx * l,
      oy = dy * l,
      P = o.p.concat(o.p.map((p) => [p[0] + ox, p[1] + oy])),
      h = gsHull(P);
    g.moveTo(h[0][0], h[0][1]);
    for (let i = 1; i < h.length; i++) g.lineTo(h[i][0], h[i][1]);
    g.closePath();
  }
  g.fill("nonzero");
  // cut the casters themselves back out (roofs and crowns stay unshadowed)
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  for (const o of L) {
    if (o.t) {
      g.moveTo(o.x + o.r * 0.82, o.y);
      g.arc(o.x, o.y, o.r * 0.82, 0, 6.283);
      continue;
    }
    g.moveTo(o.p[0][0], o.p[0][1]);
    for (let i = 1; i < 4; i++) g.lineTo(o.p[i][0], o.p[i][1]);
    g.closePath();
  }
  g.fill();
  g.globalCompositeOperation = "source-over";
}
// composite the building / tree shadow layer (world transform is active; args are the view rect + zoom)
function gfxShadeLayer(vx0, vy0, vx1, vy1, z) {
  if (!gfxDyn()) return;
  const R = GS.R,
    m = (vx1 - vx0) * 0.35,
    k = SUN.k + ":" + GS.ver;
  if (
    !R ||
    vx0 < R[0] ||
    vy0 < R[1] ||
    vx1 > R[2] ||
    vy1 > R[3] ||
    Math.abs(z / R[4] - 1) > 0.08 ||
    (GS.key !== k && performance.now() - (GS.t || 0) > 250)
  ) {
    GS.R = [vx0 - m, vy0 - m, vx1 + m, vy1 + m, z];
    GS.key = k;
    GS.t = performance.now();
    gsBuild(GS.R, z);
  }
  const Q = GS.R;
  ctx.save();
  ctx.globalAlpha = 0.4 * SUN.a;
  ctx.filter = "none";
  ctx.drawImage(GS.lc, Q[0], Q[1], Q[2] - Q[0], Q[3] - Q[1]);
  ctx.restore();
}
// ---------------------------------------------------------------- vehicle shadows: soft, sun-driven
const GS_BLUR = new WeakMap();
// padded, blurred copy of a silhouette canvas; sc = source px per world px
function gfxShadowArt(c, sc) {
  let b = GS_BLUR.get(c);
  if (b) return b;
  const r = Math.max(1, Math.round(1.6 * sc)),
    p = r * 2,
    o = document.createElement("canvas");
  o.width = c.width + p * 2;
  o.height = c.height + p * 2;
  const g = o.getContext("2d");
  g.filter = "blur(" + r + "px)";
  if (g.filter === "blur(" + r + "px)") g.drawImage(c, p, p);
  else {
    // no canvas filter (older Safari): a few offset copies make a cheap soft edge
    g.globalAlpha = 0.2;
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j += 2) g.drawImage(c, p + i * (r / 2), p + j * (r / 2));
  }
  b = { c: o, p };
  GS_BLUR.set(c, b);
  return b;
}
{
  const bv = blitV;
  blitV = function (a, x, y, h, L, W, dx, dy) {
    if (!(dx || dy) || !gfxDyn()) return bv.apply(this, arguments);
    const b = gfxShadowArt(a, VS / PPM),
      d = Math.hypot(dx, dy) * SUN.L;
    ctx.save();
    ctx.globalAlpha *= SUN.a;
    ctx.translate(x * PPM + SUN.dx * d, y * PPM + SUN.dy * d);
    ctx.rotate(h);
    const k = PPM / VS;
    ctx.drawImage(
      b.c,
      (-a.width / 2 - b.p) * k,
      (-a.height / 2 - b.p) * k,
      b.c.width * k,
      b.c.height * k,
    );
    ctx.restore();
  };
  const bl = blit;
  blit = function (art, mx, my, ang, dx = 0, dy = 0) {
    if (!(dx || dy) || !gfxDyn() || !art || !art.c) return bl.apply(this, arguments);
    const b = gfxShadowArt(art.c, ART_SCALE),
      d = Math.hypot(dx, dy) * SUN.L,
      k = 1 / ART_SCALE;
    ctx.save();
    ctx.globalAlpha *= SUN.a;
    ctx.translate(mx * PPM + SUN.dx * d, my * PPM + SUN.dy * d);
    ctx.rotate(ang);
    ctx.drawImage(b.c, -(art.ox + b.p) * k, -(art.oy + b.p) * k, b.c.width * k, b.c.height * k);
    ctx.restore();
  };
  // building / tree layer goes on after every ground vehicle and before rail / overhead / night
  const dr = drawRail;
  drawRail = function (vx0, vy0, vx1, vy1) {
    gfxSun();
    gfxShadeLayer(vx0, vy0, vx1, vy1, cam.z);
    return dr.apply(this, arguments);
  };
}

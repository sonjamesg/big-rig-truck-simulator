/**
 * @file gfxshade.js — GRAPHICS stage 2: soft drop shadows whose direction and length follow the sun (long and warm-angled
 *   at dawn/dusk, short at noon, faded at night). High quality only; low quality keeps the old baked shadows.
 *   - Buildings / trees / props: while a chunk is baked (renderChunk) bShadow, drawShadowRect and treeShadow record
 *     casters (world-space footprint + height) instead of painting. v62: gsChunk() fills sun-swept hulls into a
 *     per-chunk world-space canvas (fixed GS_Q texels per world px), cuts the footprints / crowns back out;
 *     gsComposite() lays the visible ones into a screen scratch and composites it after the vehicles (so building
 *     shadows fall across traffic too). Re-baked only when the sun moves a 1-game-minute step or casters change.
 *   - Vehicles / trailers: blitV / blit calls with a shadow offset get the sun offset, the sun alpha and a pre-blurred
 *     copy of the silhouette (cached per art canvas).
 * Exposes (globals): SUN, GS, gfxSun, gsPaint, gsKey, gsChunk, gsComposite, gfxShadeLayer, gfxShadowArt,
 *   gfxQualityChanged
 * Depends on: gfx.js (GFX, gfxHi, gfxSunDir), daynight.js (gameT, DN), render.js (renderChunk, chunkCache, chunkLo, CHUNK, bShadow via bldg2.js,
 *   drawShadowRect, treeShadow), traffic.js (blitV, VS), main.js (blit, drawRail, ctx, RSF), lorry.js (ART_SCALE)
 * Load order: after gfx.js in build.py. All files share one global scope (see AGENTS.md).
 */
const SUN = { dx: 0.7, dy: 0.7, L: 1, a: 1, k: "" }; // unit shadow direction, length factor, alpha factor
// ch: casters per ground chunk, cv: their record version, sc: per-chunk shadow canvases, sk: screen scratch
const GS = { ch: new Map(), cv: new Map(), sc: new Map(), rec: null, ver: 0, sk: null };
function gfxDyn() {
  return gfxHi() && !GFX.off.shade;
}
// per frame: sun from the game clock (shadow angle 160 deg at 6h -> 45 at noon -> -70 at 18h)
function gfxSun() {
  const h = ((gameT % 24) + 24) % 24,
    // v62: the baked building / tree shadows follow the sun in tiny steps (1 game minute = 0.83 s real time; the
    // tip of a long shadow moves about 1 px per step), so a chunk re-bake never makes a visible jump
    hq = Math.round(h * 60) / 60,
    hc = Math.max(6, Math.min(18, hq)),
    s = gfxSunDir(hc),
    e = Math.max(0, Math.sin((Math.PI * (hq - 6)) / 12)), // sun elevation proxy 0..1
    day = Math.round((1 - DN.dark) * 200) / 200;
  SUN.dx = -s[0];
  SUN.dy = -s[1];
  // long shadows near the horizon, short at noon; at night a short, faint contact shadow remains
  const Ld = Math.min(3, 1.05 / Math.pow(Math.max(e, 0.25), 0.9));
  SUN.L = Ld * day + 0.45 * (1 - day);
  // alpha is applied at composite time (never baked), from the unquantised clock, so it changes smoothly
  const ea = Math.max(0, Math.sin((Math.PI * (h - 6)) / 12));
  SUN.a = Math.max(0.3, (1 - DN.dark) * Math.min(1, ea * 6));
  SUN.k = Math.round(hq * 60) + ":" + Math.round(day * 200); // shape key: direction + length only
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
      GS.cv.set(k, (GS.cv.get(k) || 0) + 1);
      GS.ver++;
      GS.rec = prev;
    }
  };
}
function gfxQualityChanged() {
  chunkCache.clear(); // re-bake: baked shadows on low, recorded casters on high
  chunkLo.clear();
  GS.ch.clear();
  GS.cv.clear();
  GS.sc.clear();
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
const GS_MAXL = 280; // longest shadow (world px); < CHUNK, so a chunk's shadows come from its 3x3 neighbourhood
const GS_Q = 0.5; // shadow texels per world px (fixed: independent of zoom, so zooming never re-bakes)
const GS_MAXC = 56; // cached shadow chunks
// v62: shadows are baked per ground chunk in world space (GS_Q texels per world px, chunk-aligned), so panning only
// moves them rigidly with the ground: no re-rasterising at a new sub-pixel origin and no zoom-dependent layer (the old
// single view-sized layer was rebuilt every 250 ms as chunks baked / the sun stepped, each time at a new fractional
// origin and zoom, which is what made every shadow edge shimmer and pop while driving)
function gsPaint(g, L) {
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
// key of a shadow chunk: sun shape step + record versions of the 3x3 ground chunks whose casters reach it
function gsKey(cx, cy) {
  let k = SUN.k;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) k += "," + (GS.cv.get(cx + i + "," + (cy + j)) || 0);
  return k;
}
function gsChunk(cx, cy, key) {
  const id = cx + "," + cy,
    L = [];
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const a = GS.ch.get(cx + i + "," + (cy + j));
      if (a) for (const o of a) L.push(o);
    }
  let e = GS.sc.get(id);
  if (!L.length) {
    e = { c: null, key };
  } else {
    const n = Math.round(CHUNK * GS_Q),
      c = (e && e.c) || document.createElement("canvas");
    if (c.width !== n) c.width = c.height = n;
    const g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, n, n);
    g.setTransform(GS_Q, 0, 0, GS_Q, -cx * CHUNK * GS_Q, -cy * CHUNK * GS_Q);
    gsPaint(g, L);
    e = { c, key };
  }
  GS.sc.delete(id);
  GS.sc.set(id, e); // Map order = LRU
  if (GS.sc.size > GS_MAXC) GS.sc.delete(GS.sc.keys().next().value);
  return e;
}
// the shadow chunks under the view are drawn opaque into a backing-resolution screen scratch canvas (with the same
// world transform as the ground, overlapping by half a pixel like the ground chunks, so there are no seams), then the
// scratch goes on 1:1 with one alpha: overlaps never double up and no resampling of the layer happens per frame
function gsComposite(vx0, vy0, vx1, vy1, z) {
  const W = Math.round(VW * RSF),
    H = Math.round(VH * RSF);
  if (!GS.sk) GS.sk = document.createElement("canvas");
  const S = GS.sk;
  if (S.width !== W || S.height !== H) {
    S.width = W;
    S.height = H;
  }
  const g = S.getContext("2d"),
    zr = z * RSF;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.setTransform(zr, 0, 0, zr, -vx0 * zr, -vy0 * zr);
  g.imageSmoothingEnabled = true;
  let stale = 1, // re-bakes per frame for a sun step (missing chunks are always baked at once: no pop-in)
    any = 0;
  for (let cy = Math.floor(vy0 / CHUNK); cy <= Math.floor(vy1 / CHUNK); cy++)
    for (let cx = Math.floor(vx0 / CHUNK); cx <= Math.floor(vx1 / CHUNK); cx++) {
      const key = gsKey(cx, cy);
      let e = GS.sc.get(cx + "," + cy);
      if (!e) e = gsChunk(cx, cy, key);
      else if (e.key !== key) {
        // casters changed (a neighbour chunk was baked): re-bake now; only a sun step may wait a few frames
        const sunOnly = e.key.slice(e.key.indexOf(",")) === key.slice(key.indexOf(","));
        if (!sunOnly || stale-- > 0) e = gsChunk(cx, cy, key);
      }
      if (e.c) {
        g.drawImage(e.c, cx * CHUNK, cy * CHUNK, CHUNK + 0.5, CHUNK + 0.5);
        any = 1;
      }
    }
  if (!any) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.4 * SUN.a;
  ctx.drawImage(S, 0, 0);
  ctx.restore();
}
// composite the building / tree shadow layer (world transform is active; args are the view rect + zoom)
function gfxShadeLayer(vx0, vy0, vx1, vy1, z) {
  if (!gfxDyn()) return;
  gsComposite(vx0, vy0, vx1, vy1, z);
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

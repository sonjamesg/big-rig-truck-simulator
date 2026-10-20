/**
 * @file gfx3d.js — GRAPHICS stage 3: fake-3D buildings (GTA2-style parallax). Each building's roof is lifted toward the
 *   viewer: roof points = view centre + (p - centre) * (1 + k) with k = height / G3_HCAM, so taller buildings and those
 *   further from the screen centre lean more. The side walls facing the view centre are filled between the footprint
 *   and the roof (sun-shaded, window pattern), then the roof image (cut from the baked chunk, cached per building) is
 *   drawn on top. Drawn after the ground vehicles + shadow layer (so walls hide traffic behind them) and before
 *   rail / overhead / night; tallest last. At night the lit-window pattern is added on the walls and the roof window
 *   dots of daynight.js are hidden on lifted buildings. High quality only, skipped when zoomed far out.
 * Exposes (globals): G3, G3_HCAM, gfx3dOn, g3H, g3LitShare, G3_WINC, g3WinPaths, gfx3dDraw, gfx3dNight, gfxBOff
 * Depends on: gfx.js (GFX, gfxHi), gfxshade.js (SUN, gfxShadeLayer), render.js (chunkCache, CHUNK), world.js
 *   (world.chunkObjs), daynight.js (DN, drawNight)
 * Load order: after gfxshade.js in build.py. All files share one global scope (see AGENTS.md).
 */
const G3_HCAM = 700; // virtual camera height (world px)
const G3 = {
  roofs: new Map(),
  col: new WeakMap(),
  vis: [],
  walls: [],
  off: new Map(),
  wc: new WeakMap(), // per-building cached window paths (g3WinPaths)
};
function gfx3dOn() {
  return gfxHi() && !GFX.off.b3d && cam.z > 0.45;
}
// building roof image: the baked chunk pixels under the footprint (null while a chunk is not baked yet)
function g3Roof(o) {
  let c = G3.roofs.get(o);
  if (c) {
    G3.roofs.delete(o);
    G3.roofs.set(o, c);
    return c;
  }
  const x0 = Math.floor(o.x),
    y0 = Math.floor(o.y),
    w = Math.ceil(o.x + o.w) - x0,
    h = Math.ceil(o.y + o.h) - y0;
  const ch = [];
  for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor((y0 + h - 1) / CHUNK); cy++)
    for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor((x0 + w - 1) / CHUNK); cx++) {
      // a chunk not baked yet (the building reaches past the view's baked ring): bake it now rather than skip
      // the building, which made it pop in at the screen edge
      const k = chunkCache.get(cx + "," + cy) || getChunk(cx, cy, true);
      if (!k) return null;
      ch.push([k, cx * CHUNK, cy * CHUNK]);
    }
  c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  for (const [k, X, Y] of ch) g.drawImage(k, X - x0, Y - y0);
  // average roof colour -> wall colour
  const t = document.createElement("canvas");
  t.width = t.height = 1;
  const tg = t.getContext("2d");
  tg.drawImage(c, 0, 0, 1, 1);
  const d = tg.getImageData(0, 0, 1, 1).data;
  G3.col.set(o, [d[0], d[1], d[2]]);
  c.x0 = x0;
  c.y0 = y0;
  G3.roofs.set(o, c);
  while (G3.roofs.size > 900) G3.roofs.delete(G3.roofs.keys().next().value);
  return c;
}
// stable per-window hash in [0,1): building world position, wall, column, floor (never the camera)
function g3H(a, b, c, d) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15) ^ Math.imul(c + 1, 0x27d4eb2f), 0x165667b1);
  h = Math.imul(h ^ (h >>> 13) ^ Math.imul(d + 7, 0x9e3779b1), 0x85ebca6b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// share of a building's windows lit at this hour (changes slowly with the clock only; cached per 5 game minutes)
function g3LitShare(l) {
  if (!l || !l.win) return 0.5;
  if (!l.win.length) return 0;
  const hh = gameT < 12 ? gameT + 24 : gameT,
    k = (hh * 12) | 0;
  if (l.gfxT !== k) {
    let lit = 0;
    for (const w of l.win) if (w[2] && hh <= w[3]) lit++;
    l.gfxT = k;
    l.gfxF = lit / l.win.length;
  }
  return l.gfxF;
}
// roof offset for night lights / halos (centre shift)
function gfxBOff(o) {
  return G3.off.get(o) || null;
}
function gfx3dDraw(vx0, vy0, vx1, vy1) {
  G3.vis.length = 0;
  G3.walls.length = 0;
  G3.off.clear();
  if (!gfx3dOn()) return;
  const cx = (vx0 + vx1) / 2,
    cy = (vy0 + vy1) / 2,
    M = 200,
    seen = new Set(),
    B = [];
  for (let y = Math.floor((vy0 - M) / CHUNK); y <= Math.floor((vy1 + M) / CHUNK); y++)
    for (let x = Math.floor((vx0 - M) / CHUNK); x <= Math.floor((vx1 + M) / CHUNK); x++) {
      const a = world.chunkObjs.get(x + "," + y);
      if (!a) continue;
      for (const o of a)
        if (o.kind === "bldg" && o.height > 0 && o.style !== "stadium" && !seen.has(o)) {
          seen.add(o);
          if (o.x + o.w > vx0 - M && o.x < vx1 + M && o.y + o.h > vy0 - M && o.y < vy1 + M)
            B.push(o);
        }
    }
  B.sort((a, b) => a.height - b.height);
  const sx = -SUN.dx,
    sy = -SUN.dy; // toward the sun
  for (const o of B) {
    const r = g3Roof(o);
    if (!r) continue;
    const k = Math.min(0.6, o.height / G3_HCAM),
      R = (px, py) => [cx + (px - cx) * (1 + k), cy + (py - cy) * (1 + k)],
      P = [
        [o.x, o.y],
        [o.x + o.w, o.y],
        [o.x + o.w, o.y + o.h],
        [o.x, o.y + o.h],
      ],
      Q = P.map((p) => R(p[0], p[1])),
      N = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ],
      ox = o.x + o.w / 2,
      oy = o.y + o.h / 2,
      off = [(ox - cx) * k, (oy - cy) * k];
    // roof off screen and footprint off screen -> nothing to draw
    // (both must be off the same side: the old max/min test culled edge buildings whose roof leans past the edge
    // while their footprint and walls were still on screen, so they popped in late)
    if (Math.min(o.x, Q[0][0]) > vx1 || Math.max(o.x + o.w, Q[2][0]) < vx0) continue;
    if (Math.min(o.y, Q[0][1]) > vy1 || Math.max(o.y + o.h, Q[2][1]) < vy0) continue;
    G3.off.set(o, off);
    const c = G3.col.get(o) || [120, 120, 120];
    for (let i = 0; i < 4; i++) {
      const n = N[i];
      if (n[0] * off[0] + n[1] * off[1] >= -0.5) continue; // faces away from the view centre
      const a = P[i],
        b = P[(i + 1) % 4],
        A = Q[i],
        Bq = Q[(i + 1) % 4],
        sh = 0.5 + 0.28 * Math.max(0, n[0] * sx + n[1] * sy) * SUN.a;
      ctx.fillStyle = "rgb(" + c.map((v) => Math.round(v * sh)).join(",") + ")";
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(Bq[0], Bq[1]);
      ctx.lineTo(A[0], A[1]);
      ctx.closePath();
      ctx.fill();
      // windows: affine wall space (u along the edge in px, v up the wall in px of building height)
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dep = Math.hypot(A[0] - a[0], A[1] - a[1]);
      if (dep < 5 || o.height < 14 || L < 20) continue;
      const w = {
        q: [a, b, Bq, A],
        m: [
          (b[0] - a[0]) / L,
          (b[1] - a[1]) / L,
          (A[0] - a[0]) / o.height,
          (A[1] - a[1]) / o.height,
          a[0],
          a[1],
        ],
        L,
        H: o.height,
        o,
      };
      G3.walls.push(w);
      w.i = i;
      g3WallFill(w, false, 1);
    }
    ctx.drawImage(
      r,
      Q[0][0] - (o.x - r.x0) * (1 + k),
      Q[0][1] - (o.y - r.y0) * (1 + k),
      r.width * (1 + k),
      r.height * (1 + k),
    );
    G3.vis.push(o);
  }
}
// windows on a wall, in wall space (u along the edge, v up the wall), one 8 x 6 window per 16 x 12 cell. Which windows
// exist / are lit and how bright depends only on the building's world position (g3H), so they stay put while the camera
// moves; when a floor is squeezed under ~2 screen px the wall gets an even tint instead (no shimmering minified grid).
// The lit windows are grouped into 4 colour / brightness paths per wall, cached until the lit share changes.
const G3_WINC = ["rgb(255,206,120)", "rgb(190,220,255)"];
function g3WinPaths(w, f) {
  const o = w.o,
    cols = Math.floor((w.L - 4) / 16),
    rows = Math.floor((w.H - 8) / 12),
    fk = Math.round(f * 40),
    key = w.i + ":" + Math.round(w.L) + ":" + rows + ":" + fk;
  let C = G3.wc.get(o);
  if (!C) G3.wc.set(o, (C = {}));
  const hit = C[w.i];
  if (hit && hit.key === key) return hit;
  const x0 = (w.L - cols * 16) / 2,
    ox = Math.round(o.x),
    oy = Math.round(o.y),
    day = new Path2D(),
    lit = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]; // [colour][dim|bright]
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const X = x0 + i * 16 + 4,
        Y = 4 + j * 12 + 3;
      day.rect(X, Y, 8, 6);
      if (g3H(ox, oy, w.i * 97 + i, j) >= fk / 40) continue;
      const bq = g3H(oy, ox, w.i * 97 + i, j + 31);
      lit[(bq < 0.8 ? 0 : 2) + (g3H(ox + 7, oy, w.i, i * 131 + j) < 0.5 ? 0 : 1)].rect(X, Y, 8, 6);
    }
  return (C[w.i] = { key, cols, rows, x0, day, lit });
}
function g3WallFill(w, night, a, f) {
  const cols = Math.floor((w.L - 4) / 16),
    rows = Math.floor((w.H - 8) / 12);
  if (cols < 1 || rows < 1) return;
  const fl = Math.hypot(w.m[2], w.m[3]) * 12 * cam.z * RSF; // screen px per floor
  // wall space [0,L] x [0,H] maps exactly onto the wall quad, so no clip is needed
  ctx.save();
  ctx.transform(...w.m);
  if (fl < 2) {
    // too thin for single windows: even tint with the same average
    const x0 = (w.L - cols * 16) / 2;
    ctx.globalAlpha *= a * (night ? 0.55 * f : 0.5) * Math.min(1, fl / 2 + 0.3);
    ctx.fillStyle = night ? "rgb(255,200,120)" : "rgba(18,28,44,0.5)";
    ctx.fillRect(x0, 4, cols * 16, rows * 12);
    ctx.restore();
    return;
  }
  const P = g3WinPaths(w, night ? f : 1),
    ga = ctx.globalAlpha * a * Math.min(1, (fl - 1.5) / 2);
  if (!night) {
    ctx.globalAlpha = ga;
    ctx.fillStyle = "rgba(18,28,44,0.5)";
    ctx.fill(P.day);
  } else
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = ga * (k & 1 ? 1 : 0.75);
      ctx.fillStyle = G3_WINC[k >> 1];
      ctx.fill(P.lit[k]);
    }
  ctx.restore();
}
// after the darkness layer: lit windows on the walls (lit share from the building's own window list)
function gfx3dNight(vx0, vy0, vx1, vy1, z) {
  const K = DN.dark;
  if (K < 0.05 || !G3.walls.length) return;
  ctx.save();
  // drawNight leaves a screen transform; walls are in world px
  ctx.setTransform(RSF * z, 0, 0, RSF * z, -vx0 * z * RSF, -vy0 * z * RSF);
  ctx.globalCompositeOperation = "lighter";
  for (const w of G3.walls) {
    const f = g3LitShare(G3.lt && G3.lt.get(w.o));
    if (f > 0.02) g3WallFill(w, true, 0.8 * K, Math.min(1, 0.2 + f));
  }
  ctx.restore();
}
{
  const sl = gfxShadeLayer;
  gfxShadeLayer = function (vx0, vy0, vx1, vy1, z) {
    const r = sl.apply(this, arguments);
    gfx3dDraw(vx0, vy0, vx1, vy1);
    return r;
  };
  const dn = drawNight;
  drawNight = function (vx0, vy0, vx1, vy1, z) {
    // lifted buildings: no roof window dots this frame (lit windows are on the walls)
    const sw = [];
    if (G3.vis.length && DN.grid) {
      if (!G3.lt) {
        G3.lt = new Map();
        for (const a of DN.grid.values()) for (const l of a) if (l.k === "b") G3.lt.set(l.o, l);
      }
      for (const o of G3.vis) {
        const l = G3.lt.get(o);
        if (!l || !l.win) continue;
        sw.push(l);
        l.hideWin = 1; // the walls carry the lit windows; roof dots would read as light strips on the footprint
      }
    }
    try {
      dn.apply(this, arguments);
    } finally {
      for (const l of sw) l.hideWin = 0;
    }
    gfx3dNight(vx0, vy0, vx1, vy1, z);
  };
}

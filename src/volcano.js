/**
 * @file volcano.js — Mount Cinder (active volcano east of Fenwick). Everything heavy is pre-baked once into cached
 * canvases (basalt cone with lit ridges, branching lava, jagged rocks, crater rim; a night-glow sheet; a map sprite;
 * a smoke puff sprite). Per frame only: crater core pulse, embers, a handful of smoke puffs (fewer on Low graphics).
 * Lava and cone are kept clear of every road/bridge tile and the railway (checked at bake; tests/volcano_test.py).
 */
const VOLCANO = { ready: false };
function volcanoBake() {
  const V = world.volcano;
  if (!V || VOLCANO.ready) return VOLCANO.ready;
  const G = world.ground;
  let seed = 917331;
  const R = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // nearest road / bridge tile or rail point from the crater
  const roadPts = [];
  let dmin = 1e9;
  for (let y = V.y - 140; y < V.y + 140; y++)
    for (let x = V.x - 140; x < V.x + 140; x++) {
      const t = G[y * MW + x];
      if (t === T.ROAD || t === T.BRIDGE) {
        roadPts.push(x, y);
        dmin = Math.min(dmin, Math.hypot(x - V.x, y - V.y));
      }
    }
  if (typeof RAIL !== "undefined" && RAIL.X)
    for (let s = 0; s < RAIL.L; s++) {
      const x = RAIL.X[s] / M_TILE,
        y = RAIL.Y[s] / M_TILE;
      const d = Math.hypot(x - V.x, y - V.y);
      if (d < 140) roadPts.push(x, y);
      dmin = Math.min(dmin, d);
    }
  const CR = Math.min(V.r + 2, dmin - 3); // cone sprite radius (tiles)
  const LMAX = CR * 0.86; // lava never leaves this radius
  const E = Math.ceil(CR + 4),
    S = 8; // sprite px per tile
  const ox = V.x - E,
    oy = V.y - E;
  const mk = (w) => {
    const c = document.createElement("canvas");
    c.width = c.height = w;
    return c;
  };
  // ---- lava tree: 14 streams from the rim, forking up to 3 levels, tapering, breaking into cooling blobs
  const segs = [],
    frags = [];
  function br(x, y, a, w, len, d) {
    let i = 0;
    while (i < len) {
      a += (R() - 0.5) * 0.35;
      const nx = x + Math.cos(a) * 1.2,
        ny = y + Math.sin(a) * 1.2;
      if (Math.hypot(nx - V.x, ny - V.y) > LMAX) break;
      segs.push([x, y, nx, ny, w]);
      x = nx;
      y = ny;
      i++;
      w *= 0.993;
      if (d < 3 && R() < 0.02 + d * 0.008) {
        br(x, y, a + (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.4), w * 0.62, len - i, d + 1);
        w *= 0.85;
      }
      if (w < 0.35) break;
    }
    const n = 2 + ((R() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const s = 1.5 + k * 1.8 + R();
      const fx = x + Math.cos(a) * s + (R() - 0.5) * 2,
        fy = y + Math.sin(a) * s + (R() - 0.5) * 2;
      if (Math.hypot(fx - V.x, fy - V.y) < LMAX + 1) frags.push([fx, fy, Math.max(0.25, w * (0.9 - k * 0.18)), R() * 3]);
    }
  }
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + R() * 0.12;
    br(V.x + Math.cos(a) * V.cr * 0.95, V.y + Math.sin(a) * V.cr * 0.95, a, 1.6 + R() * 0.8, 200, 0);
  }
  function lava(g, s, glow) {
    const X = (x) => (x - ox) * s,
      Y = (y) => (y - oy) * s;
    g.lineCap = g.lineJoin = "round";
    const L = glow
      ? [
          [1.6, "#d02800"],
          [0.6, "#ffa030"],
        ]
      : [
          [1.35, "#120605"],
          [1.0, "#9a1a04"],
          [0.62, "#ff5a0a"],
          [0.28, "#ffd24a"],
        ];
    for (const [m, c] of L) {
      g.strokeStyle = g.fillStyle = c;
      for (const q of segs) {
        g.lineWidth = q[4] * m * s;
        g.beginPath();
        g.moveTo(X(q[0]), Y(q[1]));
        g.lineTo(X(q[2]), Y(q[3]));
        g.stroke();
      }
      for (const f of frags) {
        g.beginPath();
        g.ellipse(X(f[0]), Y(f[1]), f[2] * m * s * 0.7, f[2] * m * s * 0.45, f[3], 0, 7);
        g.fill();
      }
    }
  }
  // ---- cone sprite
  const C = mk(2 * E * S),
    g = C.getContext("2d");
  const cx = (V.x - ox) * S,
    cy = (V.y - oy) * S,
    RR = CR * S;
  g.save();
  g.beginPath();
  g.arc(cx, cy, RR, 0, 7);
  g.clip();
  let gr = g.createRadialGradient(cx, cy, 0, cx, cy, RR);
  gr.addColorStop(0, "#1c1a1e");
  gr.addColorStop(0.8, "#0d0c0f");
  gr.addColorStop(0.95, "rgba(13,12,15,0.6)");
  gr.addColorStop(1, "rgba(13,12,15,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, C.width, C.height);
  const LA = -2.36,
    N = 64; // light from the NW: lit ridge faces / shadowed gullies
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 + R() * 0.04,
      w = (Math.PI * 2) / N,
      rin = V.cr * 1.5 * S,
      rout = RR * (0.8 + R() * 0.15);
    for (const side of [0, 1]) {
      const a0 = a + (side * w) / 2,
        a1 = a0 + w / 2,
        lit = Math.cos((a0 + a1) / 2 - LA) * (side ? -1 : 1);
      g.fillStyle = lit > 0 ? `rgba(120,115,130,${0.08 + 0.2 * lit})` : `rgba(0,0,0,${0.22 - 0.3 * lit})`;
      g.beginPath();
      g.moveTo(cx + Math.cos(a + w / 2) * rin, cy + Math.sin(a + w / 2) * rin);
      g.lineTo(cx + Math.cos(a0) * rout, cy + Math.sin(a0) * rout);
      g.lineTo(cx + Math.cos(a1) * rout, cy + Math.sin(a1) * rout);
      g.fill();
    }
  }
  gr = g.createRadialGradient(cx - RR * 0.3, cy - RR * 0.3, 0, cx, cy, RR);
  gr.addColorStop(0, "rgba(140,140,160,0.12)");
  gr.addColorStop(0.6, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,0.3)");
  g.fillStyle = gr;
  g.fillRect(0, 0, C.width, C.height);
  // jagged black rocks between the streams
  const nearLava = (x, y) => segs.some((q) => Math.abs(q[0] - x) < 2.5 && Math.abs(q[1] - y) < 2.5);
  for (let k = 0; k < 260; k++) {
    const a = R() * 7,
      r = CR * (0.5 + R() * 0.42),
      x = V.x + Math.cos(a) * r,
      y = V.y + Math.sin(a) * r;
    if (nearLava(x, y)) continue;
    const px = (x - ox) * S,
      py = (y - oy) * S,
      sz = (0.6 + R() * 1.6) * S;
    g.fillStyle = "#050406";
    g.beginPath();
    for (let j = 0; j < 6; j++) {
      const b = (j / 6) * 7 + R() * 0.6,
        q = sz * (0.6 + R() * 0.6);
      g.lineTo(px + Math.cos(b) * q, py + Math.sin(b) * q);
    }
    g.fill();
    g.fillStyle = "rgba(150,150,170,0.22)";
    g.beginPath();
    g.moveTo(px - sz * 0.6, py - sz * 0.1);
    g.lineTo(px - sz * 0.1, py - sz * 0.7);
    g.lineTo(px, py - sz * 0.1);
    g.fill();
  }
  lava(g, S, false);
  gr = g.createRadialGradient(cx, cy, 0, cx, cy, V.cr * 1.7 * S);
  gr.addColorStop(0.55, "rgba(0,0,0,0)");
  gr.addColorStop(0.62, "#2e2a2e");
  gr.addColorStop(0.75, "#0c0a0c");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(cx, cy, V.cr * 1.7 * S, 0, 7);
  g.fill();
  g.restore();
  // ---- night glow sheet (half res, slight blur), map sprite, smoke puff
  const NG = mk(E * S),
    ng = NG.getContext("2d");
  ng.filter = "blur(2px)";
  lava(ng, S / 2, true);
  ng.filter = "none";
  {
    const hx = (V.x - ox) * (S / 2),
      hy = (V.y - oy) * (S / 2),
      hr = Math.min(45, E) * (S / 2),
      hg = ng.createRadialGradient(hx, hy, 0, hx, hy, hr);
    hg.addColorStop(0, "rgba(255,90,20,1)");
    hg.addColorStop(1, "rgba(255,40,0,0)");
    ng.globalAlpha = 0.6 / 0.3 > 1 ? 1 : 0.6;
    ng.fillStyle = hg;
    ng.fillRect(0, 0, NG.width, NG.height);
    ng.globalAlpha = 1;
  }
  {
    const tmp = mk(NG.width);
    tmp.getContext("2d").drawImage(NG, 0, 0);
    ng.clearRect(0, 0, NG.width, NG.height);
    ng.globalAlpha = 0.42;
    ng.drawImage(tmp, 0, 0);
    ng.globalAlpha = 1;
  }
  const MS = mk(2 * E * 2);
  MS.getContext("2d").drawImage(C, 0, 0, MS.width, MS.height);
  const P = mk(64),
    pg = P.getContext("2d");
  gr = pg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  pg.fillStyle = gr;
  pg.fillRect(0, 0, 64, 64);
  const tint = (col) => {
    const c = mk(64),
      q = c.getContext("2d");
    q.drawImage(P, 0, 0);
    q.globalCompositeOperation = "source-in";
    q.fillStyle = col;
    q.fillRect(0, 0, 64, 64);
    return c;
  };
  const embers = [];
  for (let k = 0; k < 200; k++) {
    const q = segs[(R() * segs.length) | 0];
    embers.push([q[2] + (R() - 0.5) * q[4] * 1.5, q[3] + (R() - 0.5) * q[4] * 1.5, R() * 7]);
  }
  // clearance check (tiles): nearest road/rail to any lava point and to the cone edge
  let lavaClear = 1e9;
  for (let i = 0; i < roadPts.length; i += 2) {
    const x = roadPts[i],
      y = roadPts[i + 1];
    if (Math.hypot(x - V.x, y - V.y) > LMAX + 40) continue;
    for (let k = 0; k < segs.length; k += 3) lavaClear = Math.min(lavaClear, Math.hypot(segs[k][2] - x, segs[k][3] - y));
  }
  Object.assign(VOLCANO, {
    ready: true, V, CR, LMAX, E, S, ox, oy, C, NG, MS, smokeDay: tint("#6e6e74"), smokeNight: tint("#a0583a"),
    embers, segs: segs.length, frags: frags.length, dmin, lavaClear,
  });
  return true;
}
const volcanoLow = () => typeof GFX !== "undefined" && GFX.lvl === "low";
const volcanoNightK = () => (typeof gameT !== "undefined" && (gameT < 6 || gameT > 19.5) ? 1 : 0);
function volcanoVisible(vx0, vy0, vx1, vy1, pad) {
  const V = world.volcano;
  if (!V) return false;
  const x = V.x * TILE,
    y = V.y * TILE,
    r = (V.r + pad) * TILE;
  return x + r > vx0 && x - r < vx1 && y + r > vy0 && y - r < vy1;
}
function volcanoCore(g, s, t, X, Y) {
  const V = VOLCANO.V,
    f = 0.85 + 0.15 * Math.sin(t * 3);
  const gr = g.createRadialGradient(X, Y, 0, X, Y, V.cr * s);
  gr.addColorStop(0, "#fff6b0");
  gr.addColorStop(0.35, `rgba(255,${(190 * f) | 0},60,1)`);
  gr.addColorStop(0.75, "#ff4500");
  gr.addColorStop(1, "#5a0e02");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(X, Y, V.cr * s, 0, 7);
  g.fill();
}
function volcanoSmoke(g, s, t, X, Y, n, night) {
  const spr = night ? VOLCANO.smokeNight : VOLCANO.smokeDay,
    cr = VOLCANO.V.cr;
  for (let i = 0; i < n; i++) {
    const life = (t * 0.06 + i / n) % 1,
      r = (cr * 0.9 + life * 50) * s;
    const dx = life * 110 * s + Math.sin(i * 1.7 + t * 0.4) * 7 * s,
      dy = -life * 36 * s + Math.cos(i * 2.3) * 9 * s;
    g.globalAlpha = (1 - life) * (night ? 0.4 : 0.5);
    g.drawImage(spr, X + dx - r, Y + dy - r, 2 * r, 2 * r);
  }
  g.globalAlpha = 1;
}
function volcanoDraw(vx0, vy0, vx1, vy1) {
  if (!volcanoVisible(vx0, vy0, vx1, vy1, 70) || !volcanoBake()) return;
  const K = VOLCANO,
    V = K.V,
    t = performance.now() / 1000,
    low = volcanoLow();
  ctx.drawImage(K.C, K.ox * TILE, K.oy * TILE, 2 * K.E * TILE, 2 * K.E * TILE);
  const X = V.x * TILE,
    Y = V.y * TILE;
  volcanoCore(ctx, TILE, t, X, Y);
  const ne = low ? 50 : K.embers.length;
  for (let i = 0; i < ne; i++) {
    const e = K.embers[i],
      b = 0.5 + 0.5 * Math.sin(t * 4 + e[2]);
    if (b < 0.3) continue;
    ctx.fillStyle = `rgba(255,${(200 + 55 * b) | 0},${(120 * b) | 0},${b})`;
    ctx.fillRect(e[0] * TILE - 3, e[1] * TILE - 3, 6, 6);
  }
  volcanoSmoke(ctx, TILE, t, X, Y, low ? 6 : 14, volcanoNightK());
}
function volcanoNight(vx0, vy0, vx1, vy1) {
  if (!volcanoNightK() || !volcanoVisible(vx0, vy0, vx1, vy1, 70) || !volcanoBake()) return;
  const K = VOLCANO,
    V = K.V,
    t = performance.now() / 1000;
  ctx.save(); // plain source-over at alpha 1 (sheet is pre-faded): "lighter"/globalAlpha on this big sheet cost ~0.3-0.6 s/frame on software canvases
  ctx.drawImage(K.NG, K.ox * TILE, K.oy * TILE, 2 * K.E * TILE, 2 * K.E * TILE);
  ctx.globalAlpha = 1;
  const X = V.x * TILE,
    Y = V.y * TILE;
  volcanoCore(ctx, TILE, t, X, Y);
  ctx.restore();
}
// maps: X0/Y0 = screen position of tile (0,0), z = screen px per tile, clip box x0..y1
function volcanoMap(X0, Y0, z, x0, y0, x1, y1) {
  const V = world.volcano;
  if (!V) return;
  const X = X0 + V.x * z,
    Y = Y0 + V.y * z,
    r = (V.r + 6) * z;
  if (X + r < x0 || X - r > x1 || Y + r < y0 || Y - r > y1 || !volcanoBake()) return;
  const K = VOLCANO;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  ctx.drawImage(K.MS, X0 + K.ox * z, Y0 + K.oy * z, 2 * K.E * z, 2 * K.E * z);
  const t = performance.now() / 1000;
  volcanoCore(ctx, z, t, X, Y);
  volcanoSmoke(ctx, z, t, X, Y, 6, 0);
  ctx.restore();
}

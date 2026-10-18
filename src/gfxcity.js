/**
 * @file gfxcity.js — GRAPHICS overhaul (v51, straight top-down, no outlines): city mood after the night concept.
 *   Stage A roads: baked asphalt wear on every road tile (cracks, tar-sealed joints, patches, oil stains, tyre tracks
 *   along the lanes, shallow puddle patches), kept faint so daytime stays clean; at night on high quality the puddles
 *   and the wet road reflect magenta / cyan / amber light (city), amber elsewhere.
 * Exposes (globals): GC, gcHash, gcPuddle, gcRoadWear, gcWetNight
 * Depends on: render.js (renderChunk, CHUNK), world.js (G, T, TILE, idx, inb, world.roadH/roadV), daynight.js (DN,
 *   drawNight, dnGlow, slZone, SL, slOn), gfx.js (gfxHi, GFX)
 * Load order: after gfx3d.js in build.py (wraps renderChunk outermost, drawNight). Shared global scope.
 */
const GC = {
  pal: ["rgba(255,60,200,1)", "rgba(40,220,255,1)", "rgba(255,170,60,1)"],
  zc: new Map(),
};
function gcHash(x, y, k) {
  let h = (x * 374761393 + y * 668265263 + (k || 0) * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const gcIsRoad = (tx, ty) => inb(tx, ty) && G[idx(tx, ty)] === T.ROAD;
// puddle on a road tile (deterministic): null or [x, y, rx, ry] in world px
function gcPuddle(tx, ty) {
  if (gcHash(tx, ty, 7) > 0.1 || !gcIsRoad(tx, ty)) return null;
  const i = idx(tx, ty),
    hz = world.roadH[i] >= 0 && world.roadV[i] < 0,
    r = 5 + gcHash(tx, ty, 8) * 7;
  return [
    tx * TILE + 8 + gcHash(tx, ty, 9) * 16,
    ty * TILE + 8 + gcHash(tx, ty, 10) * 16,
    hz ? r * 1.8 : r,
    hz ? r : r * 1.8,
  ];
}
// baked wear on one road tile (g is the chunk canvas, px/py the tile's top-left in chunk px)
function gcRoadWear(g, tx, ty, px, py) {
  const H = (k) => gcHash(tx, ty, k),
    i = idx(tx, ty),
    hz = world.roadH[i] >= 0 && world.roadV[i] < 0,
    vt = world.roadV[i] >= 0 && world.roadH[i] < 0;
  // tyre tracks: two darker bands per lane, along the road
  if (hz || vt) {
    g.fillStyle = "rgba(10,10,12," + (0.07 + H(1) * 0.05).toFixed(3) + ")";
    for (const o of [7, 12, 20, 25]) {
      const w = 2.2 + H(o) * 1.2;
      if (hz) g.fillRect(px, py + o, TILE, w);
      else g.fillRect(px + o, py, w, TILE);
    }
  }
  // tar-sealed cracks (thin, dark, a little glossy)
  if (H(2) < 0.32) {
    g.strokeStyle = "rgba(12,12,14,0.45)";
    g.lineWidth = 1;
    g.beginPath();
    let x = px + H(3) * TILE,
      y = py + H(4) * TILE;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (H(20 + k) - 0.5) * 12;
      y += (H(30 + k) - 0.5) * 12;
      g.lineTo(x, y);
      if (H(40 + k) < 0.3) {
        g.moveTo(x, y);
        g.lineTo(x + (H(50 + k) - 0.5) * 8, y + (H(60 + k) - 0.5) * 8);
        g.moveTo(x, y);
      }
    }
    g.stroke();
  }
  // asphalt patch repair
  if (H(5) < 0.06) {
    g.fillStyle = "rgba(20,20,24,0.16)";
    g.fillRect(px + H(11) * 12, py + H(12) * 12, 10 + H(13) * 14, 8 + H(14) * 12);
  }
  // oil stain
  if (H(6) < 0.1) {
    const cx = px + 6 + H(15) * 20,
      cy = py + 6 + H(16) * 20,
      r = 3 + H(17) * 5,
      gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, "rgba(8,8,10,0.36)");
    gr.addColorStop(1, "rgba(8,8,10,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, r * 1.3, r, H(18) * 3, 0, 7);
    g.fill();
  }
  // shallow puddle patch: darker, smoother asphalt with a faint sky sheen
  const p = gcPuddle(tx, ty);
  if (p) {
    const cx = p[0] - tx * TILE + px,
      cy = p[1] - ty * TILE + py;
    g.fillStyle = "rgba(18,22,30,0.2)";
    g.beginPath();
    g.ellipse(cx, cy, p[2], p[3], 0, 0, 7);
    g.fill();
    g.fillStyle = "rgba(180,200,220,0.06)";
    g.beginPath();
    g.ellipse(cx - p[2] * 0.2, cy - p[3] * 0.2, p[2] * 0.6, p[3] * 0.5, 0, 0, 7);
    g.fill();
  }
}
{
  const rc = renderChunk;
  renderChunk = function (cx, cy) {
    const c = rc.apply(this, arguments);
    if (GFX.off.wear) return c;
    const g = c.getContext("2d"),
      N = CHUNK / TILE;
    g.save();
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const tx = cx * N + i,
          ty = cy * N + j;
        if (gcIsRoad(tx, ty)) gcRoadWear(g, tx, ty, i * TILE, j * TILE);
      }
    g.restore();
    return c;
  };
}
// zone of a tile, cached per 8x8 tile block (slZone walks the city list)
function gcZone(tx, ty) {
  const k = (tx >> 3) + "," + (ty >> 3);
  let z = GC.zc.get(k);
  if (z === undefined) GC.zc.set(k, (z = slZone(tx, ty)));
  return z;
}
// night, high quality: wet asphalt picks up colour - puddles mirror the street light, lamp pools smear along the road
function gcWetNight(vx0, vy0, vx1, vy1, z) {
  const K = DN.dark;
  if (K < 0.08 || !gfxHi() || GFX.off.wet) return;
  ctx.save();
  ctx.setTransform(RSF, 0, 0, RSF, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  const gz = (col, x, y, rx, ry, a) => {
    if (a < 0.01) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(dnGlow(col), (x - vx0 - rx) * z, (y - vy0 - ry) * z, rx * 2 * z, ry * 2 * z);
  };
  const t0x = Math.floor(vx0 / TILE),
    t1x = Math.ceil(vx1 / TILE),
    t0y = Math.floor(vy0 / TILE),
    t1y = Math.ceil(vy1 / TILE);
  if (z > 0.35)
    for (let ty = t0y; ty <= t1y; ty++)
      for (let tx = t0x; tx <= t1x; tx++) {
        const p = gcPuddle(tx, ty);
        if (!p) continue;
        const zc = gcZone(tx, ty),
          col = zc < 2 ? GC.pal[(gcHash(tx, ty, 3) * 3) | 0] : GC.pal[2],
          a = (zc === 0 ? 0.62 : zc === 1 ? 0.5 : 0.2) * K;
        gz(col, p[0], p[1], p[2] * 2.2, p[3] * 2.2, a);
        gz(
          "rgba(235,245,255,1)",
          p[0] - p[2] * 0.25,
          p[1] - p[3] * 0.25,
          p[2] * 0.5,
          p[3] * 0.4,
          a * 0.4,
        );
      }
  // lamp pools: a coloured smear on the wet road under city lamps
  if (SL.grid) {
    const C = SL.cell;
    for (let cy = Math.floor((vy0 - 200) / C); cy <= Math.floor((vy1 + 200) / C); cy++)
      for (let cx = Math.floor((vx0 - 200) / C); cx <= Math.floor((vx1 + 200) / C); cx++) {
        const a = SL.grid.get(cx + "," + cy);
        if (!a) continue;
        for (const l of a) {
          if (l.hx < vx0 - 160 || l.hx > vx1 + 160 || l.hy < vy0 - 160 || l.hy > vy1 + 160)
            continue;
          const so = slOn(l);
          if (so < 0.05) continue;
          const tx = Math.floor(l.hx / TILE),
            ty = Math.floor(l.hy / TILE),
            zc = gcZone(tx, ty),
            col = zc < 2 ? GC.pal[(gcHash(tx, ty, 5) * 3) | 0] : GC.pal[2];
          gz(col, l.hx, l.hy, 70, 70, (zc === 0 ? 0.26 : zc === 1 ? 0.2 : 0.1) * so * K);
        }
      }
  }
  ctx.restore();
}
{
  const dn = drawNight;
  drawNight = function (vx0, vy0, vx1, vy1, z) {
    dn.apply(this, arguments);
    gcWetNight(vx0, vy0, vx1, vy1, z);
  };
}

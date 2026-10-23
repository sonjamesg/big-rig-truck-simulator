/**
 * @file nightmap.js — night map style (world map + minimap)
 * Exposes (globals): NM, nmK, nmBuild, nightMapLayer, nmIconRing
 * Depends on: world.js, render.js, career.js, daynight.js
 * Load order: #39 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
// ===================== v27 night map style (world map + minimap) =====================
// Precomputed once: NM.base = 1 px/tile night colouring (dark ground, navy water, lighter roads, lit windows, lamp dots),
// NM.lit = transparent lights-only layer (windows/lamps/quays) at 1 px/tile, NM.glow = low-res orange sky-glow over built-up areas,
// NM.lamps = lamp tile positions bucketed for culling (drawn as glow sprites when zoomed in).
const NM = { base: null, lit: null, glow: null, lamps: null, spr: null, B: 64 };
function nmK() {
  return typeof DN === "undefined" ? 0 : Math.min(1, DN.dark * 1.08);
}
function nmBuild() {
  if (NM.base) return;
  const W = MW,
    H = MH,
    D = new Float32Array((W >> 3) * (H >> 3)),
    DW = W >> 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = G[y * W + x];
      const w =
        t === T.BLDG
          ? 1
          : t === T.CONT || t === T.QUAY || t === T.TANK
            ? 0.7
            : t === T.PLAZA || t === T.LOT || t === T.PUMP
              ? 0.3
              : t === T.CONC
                ? 0.12
                : 0;
      if (w) D[(y >> 3) * DW + (x >> 3)] += w / 64;
    }
  // blur density (3 box passes, radius 3 cells) -> smooth city mask
  let A = D,
    Bf = new Float32Array(A.length);
  const DH = H >> 3;
  for (let p = 0; p < 3; p++) {
    for (let y = 0; y < DH; y++) {
      let s = 0;
      for (let x = -3; x < DW + 3; x++) {
        if (x + 3 < DW) s += A[y * DW + x + 3];
        if (x - 4 >= 0) s -= A[y * DW + x - 4];
        if (x >= 0 && x < DW) Bf[y * DW + x] = s / 7;
      }
    }
    for (let x = 0; x < DW; x++) {
      let s = 0;
      for (let y = -3; y < DH + 3; y++) {
        if (y + 3 < DH) s += Bf[(y + 3) * DW + x];
        if (y - 4 >= 0) s -= Bf[(y - 4) * DW + x];
        if (y >= 0 && y < DH) A[y * DW + x] = s / 7;
      }
    }
  }
  const dens = (x, y) => A[(y >> 3) * DW + (x >> 3)];
  const gc = mkCanvas(DW, DH),
    gg = gc.getContext("2d"),
    gi = gg.createImageData(DW, DH);
  for (let i = 0; i < A.length; i++) {
    const v = Math.min(1, A[i] * 2.6);
    gi.data[i * 4] = 255;
    gi.data[i * 4 + 1] = (140 + v * 40) | 0;
    gi.data[i * 4 + 2] = 50;
    gi.data[i * 4 + 3] = Math.min(255, v * v * 150 + v * 40) | 0;
  }
  gg.putImageData(gi, 0, 0);
  NM.glow = gc;
  const bc = mkCanvas(W, H),
    bg = bc.getContext("2d"),
    bi = bg.createImageData(W, H),
    b = bi.data;
  const lc = mkCanvas(W, H),
    lg = lc.getContext("2d"),
    li = lg.createImageData(W, H),
    l = li.data;
  const C = {
    [T.GRASS]: [16, 24, 22],
    [T.PGRASS]: [18, 28, 24],
    [T.ISLAND]: [18, 28, 24],
    [T.TREE]: [9, 16, 14],
    [T.HEDGE]: [11, 18, 15],
    [T.FIELD]: [22, 26, 20],
    [T.SAND]: [40, 36, 30],
    [T.ROCK]: [34, 35, 40],
    [T.GRAVEL]: [30, 29, 30],
    [T.WATER]: [8, 16, 40],
    [T.ROAD]: [62, 64, 74],
    [T.BRIDGE]: [70, 72, 84],
    [T.WALK]: [44, 44, 52],
    [T.PLAZA]: [48, 46, 52],
    [T.LOT]: [42, 42, 50],
    [T.CONC]: [46, 47, 56],
    [T.PARK]: [42, 42, 50],
    [T.QUAY]: [70, 66, 60],
    [T.CONT]: [60, 52, 48],
    [T.TANK]: [50, 50, 58],
    [T.PUMP]: [90, 90, 96],
    [T.BLDG]: [30, 30, 40],
  };
  const LA = new Uint8Array(W * H);
  NM.la = LA;
  const put = (i, r, g2, bb, a) => {
    LA[i] = r === 255 && g2 === 214 ? 2 : G[i] === T.BLDG ? 1 : 3;
    l[i * 4] = r;
    l[i * 4 + 1] = g2;
    l[i * 4 + 2] = bb;
    l[i * 4 + 3] = a;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        t = G[i];
      let c = C[t] || [16, 24, 22];
      const dv = Math.min(1, dens(x, y) * 2.4),
        h = hash2(x * 7 + 3, y * 13 + 5);
      let r = c[0],
        g2 = c[1],
        bb = c[2];
      if (t === T.BLDG) {
        if (h < 0.22 + dv * 0.5) {
          const wm = h < 0.06 ? [255, 240, 200] : h < 0.14 ? [255, 205, 120] : [250, 180, 95];
          put(i, wm[0], wm[1], wm[2], (200 + dv * 55) | 0);
          r = r * 0.3 + wm[0] * 0.7;
          g2 = g2 * 0.3 + wm[1] * 0.7;
          bb = bb * 0.3 + wm[2] * 0.7;
        }
      } else if (t === T.ROAD || t === T.BRIDGE) {
        r += dv * 28;
        g2 += dv * 20;
        bb += dv * 6;
      } else if (t === T.QUAY || t === T.CONT) {
        if (h < 0.35) {
          put(i, 255, 220, 160, 150);
          r += 60;
          g2 += 50;
          bb += 30;
        }
      } else if (t === T.CONC && h < 0.004) {
        put(i, 255, 215, 150, 110);
        r += 40;
        g2 += 34;
        bb += 20;
      } else if (t === T.PUMP) {
        put(i, 255, 250, 235, 230);
        r = 230;
        g2 = 230;
        bb = 220;
      } else if (t !== T.WATER) {
        r += dv * 14;
        g2 += dv * 9;
        bb += dv * 4;
      }
      b[i * 4] = Math.min(255, r);
      b[i * 4 + 1] = Math.min(255, g2);
      b[i * 4 + 2] = Math.min(255, bb);
      b[i * 4 + 3] = 255;
    }
  // runway edge lights (airports)
  for (const ap of world.airports || [])
    for (const rw of ap.rw || []) {
      const x0 = Math.round(rw.x / TILE),
        y0 = Math.round(rw.y / TILE) - 6,
        len = Math.round(rw.len / TILE);
      if (!isFinite(x0) || !isFinite(y0) || !isFinite(len)) continue;
      for (let x = x0; x < x0 + len; x += 3)
        for (const yy of [y0, y0 + 11]) {
          if (!inb(x, yy)) continue;
          const i = yy * W + x;
          put(i, 255, 255, 230, 255);
          b[i * 4] = 240;
          b[i * 4 + 1] = 240;
          b[i * 4 + 2] = 210;
        }
      for (const xx of [x0, x0 + len])
        for (let yy = y0; yy <= y0 + 11; yy++) {
          if (!inb(xx, yy)) continue;
          const i = yy * W + xx;
          const gr = xx === x0;
          put(i, gr ? 90 : 255, gr ? 255 : 80, gr ? 120 : 70, 255);
        }
    }
  // street lamps
  NM.lamps = new Map();
  try {
    if (typeof dnBuild === "function") dnBuild();
    for (const a of DN.grid.values())
      for (const q of a) {
        if (q.k !== "st") continue;
        const tx = q.x / TILE,
          ty = q.y / TILE,
          xi = tx | 0,
          yi = ty | 0;
        if (!inb(xi, yi)) continue;
        const i = yi * W + xi;
        put(i, 255, 214, 140, 255);
        b[i * 4] = 255;
        b[i * 4 + 1] = 205;
        b[i * 4 + 2] = 130;
        const k = ((tx / NM.B) | 0) + "," + ((ty / NM.B) | 0);
        let L = NM.lamps.get(k);
        if (!L) NM.lamps.set(k, (L = []));
        L.push(tx, ty);
      }
  } catch (e) {}
  bg.putImageData(bi, 0, 0);
  lg.putImageData(li, 0, 0);
  NM.base = bc;
  NM.lit = lc;
  NM.spr = dnSprite
    ? dnSprite(32, [
        [0, "rgba(255,236,190,1)"],
        [0.25, "rgba(255,200,120,0.55)"],
        [1, "rgba(255,170,80,0)"],
      ])
    : null;
}
// Night overlay for a map view. X0/Y0 = screen px of tile 0,0, z = px per tile, clip rect in screen px. detail = zoomed-in chunks underneath.
function nightMapLayer(X0, Y0, z, x0, y0, x1, y1, detail) {
  const K = nmK();
  if (K < 0.01) return;
  nmBuild();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  if (!detail) {
    ctx.globalAlpha = K;
    ctx.imageSmoothingEnabled = z < 1;
    ctx.drawImage(NM.base, X0, Y0, MW * z, MH * z);
    // v71: the night base is per-tile, so the airport's concrete reads as a flat grey block; lay the (tinted) airport over it
    if (typeof ovlDraw === "function") ovlDraw(X0, Y0, z, x0, y0, x1, y1, true);
  } else {
    ctx.globalAlpha = K;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgb(92,104,150)";
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.35 * K;
    ctx.fillStyle = "rgb(4,8,22)";
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.9 * K;
    const tx0 = Math.max(0, Math.floor((x0 - X0) / z)),
      ty0 = Math.max(0, Math.floor((y0 - Y0) / z)),
      tx1 = Math.min(MW, Math.ceil((x1 - X0) / z)),
      ty1 = Math.min(MH, Math.ceil((y1 - Y0) / z));
    // lit windows: small warm panes inside each lit building tile (2 per tile, hashed positions), not whole-tile blocks
    const pw = Math.max(1, z * 0.22),
      ph = Math.max(1, z * 0.16),
      LA = NM.la;
    const cols = ["rgb(255,236,190)", "rgb(255,205,120)", "rgb(250,178,92)"];
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = cols[c];
      ctx.beginPath();
      for (let ty = ty0; ty < ty1; ty++) {
        const row = ty * MW;
        for (let tx = tx0; tx < tx1; tx++) {
          if (LA[row + tx] !== 1) continue;
          const h = hash2(tx * 5 + 1, ty * 11 + 7);
          if (((h * 3) | 0) !== c) continue;
          const bx = X0 + tx * z,
            by = Y0 + ty * z;
          ctx.rect(bx + z * (0.12 + 0.5 * hash2(tx, ty) * 0.9), by + z * (0.15 + h * 0.25), pw, ph);
          if (h > 0.4)
            ctx.rect(bx + z * (0.1 + 0.6 * hash2(ty, tx)), by + z * (0.6 + 0.2 * h), pw, ph);
        }
      }
      ctx.fill();
    }
    {
      ctx.fillStyle = "rgb(255,226,170)";
      ctx.beginPath();
      const d = Math.max(1.2, z * 0.2);
      for (let ty = ty0; ty < ty1; ty++) {
        const row = ty * MW;
        for (let tx = tx0; tx < tx1; tx++) {
          if (LA[row + tx] !== 3) continue;
          ctx.rect(X0 + tx * z + z * 0.5 - d / 2, Y0 + ty * z + z * 0.5 - d / 2, d, d);
        }
      }
      ctx.fill();
    }
    if (NM.spr) {
      ctx.globalAlpha = 0.9 * K;
      const r = Math.max(2.5, Math.min(14, z * 1.6));
      const B = NM.B;
      for (
        let by = Math.floor(Math.max(0, (y0 - Y0) / z) / B);
        by <= Math.floor(Math.min(MH - 1, (y1 - Y0) / z) / B);
        by++
      )
        for (
          let bx = Math.floor(Math.max(0, (x0 - X0) / z) / B);
          bx <= Math.floor(Math.min(MW - 1, (x1 - X0) / z) / B);
          bx++
        ) {
          const L = NM.lamps.get(bx + "," + by);
          if (!L) continue;
          for (let j = 0; j < L.length; j += 2) {
            const sx = X0 + L[j] * z,
              sy = Y0 + L[j + 1] * z;
            if (sx < x0 - r || sx > x1 + r || sy < y0 - r || sy > y1 + r) continue;
            ctx.drawImage(NM.spr, sx - r, sy - r, r * 2, r * 2);
          }
        }
    }
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = (detail ? 0.35 : 0.55) * K;
  ctx.drawImage(NM.glow, X0, Y0, MW * z, MH * z);
  ctx.restore();
}
// readability helpers used by the map overlays at night
function nmIconRing(X, Y, r) {
  const K = nmK();
  if (K < 0.05) return;
  ctx.save();
  ctx.globalAlpha = K;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.shadowColor = "rgba(255,240,200,0.9)";
  ctx.shadowBlur = r * 0.9;
  ctx.beginPath();
  ctx.arc(X, Y, r + ctx.lineWidth * 0.9, 0, 7);
  ctx.stroke();
  ctx.restore();
}

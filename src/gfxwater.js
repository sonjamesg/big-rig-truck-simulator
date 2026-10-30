/**
 * @file gfxwater.js — v76 HIGH-QUALITY WATER (James 30 Oct: "Sea of Thieves" water on PC). Drawn per frame on the
 *   visible screen only, over the baked chunk water: drifting sun glints on open sea, shoreward-moving swell lines,
 *   and breathing surf foam on the sand line. Low quality (phones) skips it entirely, so the static baked waves stay.
 * Exposes (globals): gfxWaterFx
 * Depends on: gfx.js (gfxHi), render.js (shoreDist, isLandT), world.js (get, inb, TILE), daynight.js (DN)
 * Load order: after gfxcity.js in build.py.
 */
"use strict";
const GW = { sd: new Map() }; // shore-distance cache (idx -> 1..5), capped
function gwShore(tx, ty) {
  const k = ty * 4096 + tx;
  let d = GW.sd.get(k);
  if (d === undefined) {
    d = shoreDist(tx, ty);
    if (GW.sd.size > 60000) GW.sd.clear();
    GW.sd.set(k, d);
  }
  return d;
}
function gfxWaterFx(vx0, vy0, vx1, vy1, z) {
  if (!gfxHi()) return;
  const tx0 = Math.floor(vx0 / TILE), tx1 = Math.floor(vx1 / TILE), ty0 = Math.floor(vy0 / TILE), ty1 = Math.floor(vy1 / TILE);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 9000) return; // zoomed far out: the baked water reads fine
  const t = performance.now() / 1000,
    dark = typeof DN !== "undefined" ? DN.dark || 0 : 0,
    day = 1 - dark * 0.75;
  const g = ctx;
  g.save();
  g.lineCap = "round";
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      if (inb(tx, ty) && get(tx, ty) !== T.WATER) continue;
      const d = gwShore(tx, ty),
        px = tx * TILE,
        py = ty * TILE,
        h = hash2(tx * 7 + 3, ty * 11 + 5);
      // swell: a bright band travelling toward the shore (phase by distance), only in the shallows
      if (d <= 4) {
        const ph = (t * 0.35 - d * 0.25 + h * 0.1) % 1,
          a = Math.max(0, Math.sin(ph * Math.PI * 2)) * (0.16 - d * 0.03) * day;
        if (a > 0.01) {
          g.fillStyle = "rgba(200,255,250," + a.toFixed(3) + ")";
          g.fillRect(px, py, TILE, TILE);
        }
        if (d === 1) {
          // breathing foam on the waterline
          const L = (dx, dy) => isLandT(get(tx + dx, ty + dy));
          const f = 0.25 + 0.25 * Math.sin(t * 1.6 + h * 6.28),
            w = 4 + 3 * Math.sin(t * 1.6 + h * 6.28);
          g.fillStyle = "rgba(245,255,252," + (f * day + 0.05).toFixed(3) + ")";
          if (L(0, -1)) g.fillRect(px, py, TILE, w);
          if (L(0, 1)) g.fillRect(px, py + TILE - w, TILE, w);
          if (L(-1, 0)) g.fillRect(px, py, w, TILE);
          if (L(1, 0)) g.fillRect(px + TILE - w, py, w, TILE);
        }
      }
      // sun / moon glints drifting across the surface
      if (h > 0.55) {
        const p = (t * (0.15 + h * 0.2) + h * 9) % 1,
          a = Math.sin(p * Math.PI) * (0.55 - dark * 0.35);
        const gx = px + ((h * 977) % 1) * 26 + p * 6,
          gy = py + ((h * 613) % 1) * 26;
        g.strokeStyle = dark > 0.5 ? "rgba(200,215,255," + (a * 0.6).toFixed(3) + ")" : "rgba(255,255,240," + a.toFixed(3) + ")";
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(gx - 3, gy);
        g.quadraticCurveTo(gx, gy - 1.2, gx + 3, gy);
        g.stroke();
      }
    }
  g.restore();
}

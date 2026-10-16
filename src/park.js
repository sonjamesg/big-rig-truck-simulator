"use strict";
// ===================== py: owned trucks you aren't driving, parked in marked bays at your home yard (local only, never sent in MP) =====================
const PY = { n: 6 };
function pyYard() {
  if (typeof ownYards !== "function") return null;
  const mine = ownYards().filter((y) => ownedYard(y));
  if (!mine.length) return null;
  return mine.find((y) => y.id === OWN.home) || mine[0];
}
// bays: left edge of the yard, trucks nose-east, one above the other (x0+0.6..2.6 tiles, from y0+7.4)
function pyBays(yd) {
  const out = [];
  for (let k = 0; k < PY.n; k++) {
    const cy = (yd.y0 + 7.4 + k * 0.95 + 0.475) * M_T;
    out.push({
      k,
      x0: (yd.x0 + 0.55) * M_T,
      x1: (yd.x0 + 2.55) * M_T,
      cy,
      h: Math.PI / 2,
      ax: (yd.x0 + 0.55) * M_T + 1.6,
      ay: cy,
    });
  }
  return out;
}
function pyParked() {
  const yd = pyYard();
  if (!yd || !career.owned) return [];
  const bays = pyBays(yd),
    ids = career.owned.filter((id) => id !== career.cur).slice(0, PY.n);
  return ids.map((id, i) => ({ id, b: bays[i], yd }));
}
const pyArtC = {};
function pyArt(id) {
  const m = modelById(id),
    col = career.colors[id] || m.cols[0],
    A = czArt(m, col, czFitted(id)),
    k = id + "|" + col + "|" + JSON.stringify(czFitted(id));
  if (pyArtC[id] && pyArtC[id].k === k) return pyArtC[id];
  return (pyArtC[id] = { k, a: A, sh: silhouette(A) });
}
function drawParkedTrucks(vx0, vy0, vx1, vy1) {
  const yd = pyYard();
  if (!yd) return;
  const S = PPM,
    bays = pyBays(yd),
    X0 = bays[0].x0 * S;
  if (
    X0 > vx1 + 200 ||
    bays[0].x1 * S < vx0 - 200 ||
    bays[0].cy * S > vy1 + 200 ||
    bays[PY.n - 1].cy * S < vy0 - 200
  )
    return;
  const dark = typeof DN !== "undefined" ? DN.dark : 0;
  ctx.save();
  // marked bays: white side lines, yellow kerb stop, bay numbers
  ctx.fillStyle = "rgba(30,34,40,0.35)";
  ctx.fillRect(X0, (bays[0].cy - 1.9) * S, (bays[0].x1 - bays[0].x0) * S, PY.n * 0.95 * M_T * S);
  ctx.fillStyle = "#e9edf1";
  for (let k = 0; k <= PY.n; k++) {
    const y = (bays[0].cy - 1.9 + k * 0.95 * M_T) * S;
    ctx.fillRect(X0, y - 1.5, (bays[0].x1 - bays[0].x0) * S, 3);
  }
  ctx.fillStyle = "#f5b82e";
  ctx.fillRect(X0, (bays[0].cy - 1.9) * S, 0.25 * S, PY.n * 0.95 * M_T * S);
  ctx.font = "bold " + Math.round(0.9 * S) + "px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(233,237,241,0.75)";
  for (const b of bays) ctx.fillText("P" + (b.k + 1), (b.x1 - 0.9) * S, b.cy * S);
  ctx.restore();
  for (const P of pyParked()) {
    const A = pyArt(P.id);
    drawRig(A.a, A.sh, P.b.ax, P.b.ay, P.b.h, null, 0, 0, 0, 6);
  }
  if (dark > 0.05 && typeof dnLight === "function")
    for (let k = 0; k < PY.n; k += 2)
      dnLight(
        (bays[0].x0 + 4) * S,
        bays[k].cy * S + 0.5 * M_T * S,
        90,
        "rgba(255,240,205,0.95)",
        0.55,
      );
}
// solid: the player's cab / trailer can't drive through parked trucks
function pyHit(px, py) {
  for (const P of pyParked()) {
    const b = P.b;
    if (px > b.ax - 1.4 && px < b.ax + 5.2 && Math.abs(py - b.ay) < 1.3) return true;
  }
  return false;
}
{
  const th0 = trailerHitTest;
  trailerHitTest = function (s) {
    const r = th0(s);
    if (r) return r;
    const yd = pyYard();
    if (!yd || Math.abs(s.x - (yd.x0 + 2) * M_T) > 60 || Math.abs(s.y - (yd.y0 + 10) * M_T) > 60)
      return null;
    const f = fwd(s.h),
      rr2 = rgt(s.h);
    for (const ly of [-5.0, -3.5, -2, -0.5, 1.0])
      for (const lx of [-1.2, 0, 1.2]) {
        if (pyHit(s.x + f[0] * -ly + rr2[0] * lx, s.y + f[1] * -ly + rr2[1] * lx)) return "parked";
      }
    if (s.trl) {
      const k = kingpin(s),
        ft = fwd(s.th),
        rt = rgt(s.th);
      for (let d = 0; d <= 12; d += 1.5)
        for (const lx of [-1.2, 1.2])
          if (pyHit(k[0] - ft[0] * d + rt[0] * lx, k[1] - ft[1] * d + rt[1] * lx)) return "parked";
    }
    return null;
  };
}

/**
 * @file liftbridge.js — KINGSBRIDGE LIFT BRIDGE: the M1 crossing of the Kingsbridge ship channel (bottom docks) becomes a
 *   double-leaf bascule bridge. It opens on a cycle whenever a ship is due (lights, barriers, then the leaves rise), drawn in
 *   pseudo-3D (foreshortening, perspective scale toward the camera, shadows on the water, visible underside, open water and
 *   the ship beneath). Red road signals + half barriers stop AI traffic; the player is blocked by the barriers. A fast rig on
 *   a rising leaf launches off the tip (jump arc, shadow, landing); too slow and it drops into the channel (splash, then a tow
 *   out with the respawn fee). Road layout and tiles are unchanged (draw + behaviour only).
 * Exposes (globals): LB, lbState, lbOcc, lbGapPx, lbGapClip, lbDraw, lbStopAcc, lbBarrierHit, lbTruckStep
 * Depends on: port.js (world.kbPort, portShips, PL, portT, portRectL, portClipBridges, drawPortLow), traffic.js, rail.js
 *   (railStopAcc / railBarrierHit / railBodyPts), physics.js (stepTruck), main.js (drawLorry, cam), breakdown.js
 * Load order: after bikes.js in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v51 Kingsbridge bascule bridge (James 17 Oct) =====================
// geometry in tiles: M1 deck rows Y0..Y1 (6 rows, eastbound lanes on the north half), hinges XA (west leaf, opens +x) and XB
const LB = {
  Y0: 1942,
  Y1: 1948,
  XA: 1743,
  XB: 1761,
  L: 9, // leaf length (tiles); the two leaves meet at XA + L = 1752, the ship channel centre
  TH: 0.6, // leaf thickness (tiles)
  DECK: 2.6, // deck height above the water (tiles)
  AMAX: (78 * Math.PI) / 180,
  HC: 70, // pseudo-3D camera height (tiles)
  T_LIT: 26, // seconds before a ship reaches the span: lights on
  T_BAR: 20, // barriers start down
  T_UP: 13, // leaves start rising (fully open 2 s before the ship arrives)
  RISE: 11,
  st: { t: -1, lit: 0, bar: 0, th: 0, amber: 0 },
  force: null, // debug / screenshots: fixed {th, bar, lit}
  pl: { mode: null, z: 0, vz: 0, vh: 0, t: 0 },
  wr: [], // splash particles
  stats: { opens: 0, minClear: 1e9, jumps: 0, landed: 0, falls: 0 },
};
const lbSm = (x) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
// is any ship hull over / about to be over the span at time t
function lbOcc(t, m) {
  const P = world.kbPort;
  if (!P || !P.ph || typeof portShips !== "function") return false;
  for (const o of portShips(P, t)) {
    if (!o.pose || o.anch) continue;
    const w = PL(P, o.pose.u, o.pose.v),
      along = Math.abs(w[1] - (LB.Y0 + LB.Y1) / 2),
      side = Math.abs(w[0] - (LB.XA + LB.L));
    if (along < SHIP.L / 2 + 3 + (m || 0) && side < SHIP.W / 2 + 4) return true;
  }
  return false;
}
function lbState() {
  const S = LB.st,
    t = typeof portT === "function" ? portT() : timeS;
  if (LB.force) return Object.assign(S, { lit: 1, bar: 1, amber: 0 }, LB.force);
  if (Math.abs(t - S.t) < 0.05) return S;
  S.t = t;
  if (!world.kbPort || !world.kbPort.ph) {
    S.lit = S.bar = S.th = 0;
    return S;
  }
  if (lbOcc(t)) {
    S.lit = 1;
    S.bar = 1;
    S.th = 1;
    S.amber = 0;
    return S;
  }
  let ahead = 99,
    since = 99;
  for (let k = 0.5; k <= LB.T_LIT; k += 0.5)
    if (lbOcc(t + k)) {
      ahead = k;
      break;
    }
  for (let k = 0.5; k <= 16; k += 0.5)
    if (lbOcc(t - k)) {
      since = k;
      break;
    }
  const upD = ahead <= LB.T_UP ? lbSm((LB.T_UP - ahead) / LB.RISE) : 0,
    upU = since <= LB.RISE ? 1 - lbSm(since / LB.RISE) : 0,
    bD = ahead <= LB.T_BAR ? lbSm((LB.T_BAR - ahead) / 4) : 0,
    bU = since <= LB.RISE + 3 ? 1 : since <= LB.RISE + 7 ? 1 - lbSm((since - LB.RISE - 3) / 4) : 0;
  const was = S.th;
  S.th = Math.max(upD, upU);
  S.bar = Math.max(bD, bU);
  S.lit = ahead <= LB.T_LIT || since <= LB.RISE + 6 ? 1 : 0;
  S.amber = S.lit && ahead > LB.T_LIT - 3 && ahead <= LB.T_LIT ? 1 : 0;
  if (was < 0.01 && S.th >= 0.01) LB.stats.opens++;
  return S;
}
const lbAng = () => lbState().th * LB.AMAX;
// gap between the leaf tips (tiles); null when closed
function lbGapPx() {
  const a = lbAng();
  if (a < 0.004) return null;
  const r = LB.L * Math.cos(a);
  return [LB.XA + r, LB.XB - r];
}
// clip out the open span (world coords) so the fixed deck's shadows / edge lines don't cross the water
function lbGapClip(sh) {
  if (lbAng() < 0.004) return;
  // the open span, swept by the deck-shadow offset (sh tiles) so the shadow of the missing deck goes too
  const o = sh || 0,
    x0 = LB.XA * TILE,
    x1 = LB.XB * TILE,
    y0 = (LB.Y0 - 0.6) * TILE,
    y1 = (LB.Y1 + 0.6) * TILE,
    d = o * TILE;
  ctx.beginPath();
  ctx.rect(-1e5, -1e5, 2e5, 2e5);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x0 + d, y1 + d);
  ctx.lineTo(x1 + d, y1 + d);
  ctx.lineTo(x1 + d, y0 + d);
  ctx.lineTo(x1, y0);
  ctx.closePath();
  ctx.clip("evenodd");
}
// ---------- pseudo-3D projection (world tiles + height in tiles -> canvas px): oblique (heights rise up-screen, like
// the game's other tall props) plus a perspective swell toward the camera centre
const LB_OB = 0.5,
  LB_K = 0.014;
function lbProj(x, y, z) {
  const cx = cam.x / TILE,
    cy = cam.y / TILE,
    s = LB_K * z;
  return [(x + (x - cx) * s) * TILE, (y - LB_OB * z + (y - cy) * s) * TILE];
}
// draw the camera-facing faces of a convex solid: faces as 3D quads, culled by projected winding (outward = away from c)
function lbSolid(faces, c, shade) {
  for (const F of faces) {
    const Q = F.Q,
      e1 = [0, 1, 2].map((k) => Q[1][k] - Q[0][k]),
      e2 = [0, 1, 2].map((k) => Q[2][k] - Q[0][k]),
      n = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ],
      m = [0, 1, 2].map((k) => Q.reduce((t, q) => t + q[k], 0) / Q.length - c[k]);
    const pts = (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0 ? Q.slice().reverse() : Q).map((q) =>
      lbProj(q[0], q[1], q[2]),
    );
    let ar = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        q = pts[(i + 1) % pts.length];
      ar += p[0] * q[1] - q[0] * p[1];
    }
    if (ar <= 0) continue;
    lbPoly(pts, F.c);
    if (shade) shade(F, pts);
  }
}
function lbShadowPt(x, y, z) {
  const h = z + LB.DECK;
  return [(x + h * 0.42) * TILE, (y + h * 0.5) * TILE];
}
// leaf corner: a along the leaf from its hinge, t across its thickness (0 = road surface), y across the road
function lbLeafPt(d, a, t, y, ang) {
  const xh = d > 0 ? LB.XA : LB.XB;
  return [
    xh + d * (a * Math.cos(ang) - t * Math.sin(ang)),
    y,
    a * Math.sin(ang) + t * Math.cos(ang),
  ];
}
function lbPoly(pts, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
function lbLeaf(d, ang, dark) {
  const y0 = LB.Y0 - 0.2,
    y1 = LB.Y1 + 0.2,
    L = LB.L,
    th = LB.TH,
    P3 = (a, t, y) => lbLeafPt(d, a, t, y, ang),
    pr = (p) => lbProj(p[0], p[1], p[2]),
    sa = Math.sin(ang);
  const top = [P3(0, 0, y0), P3(L, 0, y0), P3(L, 0, y1), P3(0, 0, y1)],
    bot = [P3(0, -th, y0), P3(L, -th, y0), P3(L, -th, y1), P3(0, -th, y1)],
    c = P3(L / 2, -th / 2, (y0 + y1) / 2);
  const sh = Math.round(64 - 10 * sa),
    faces = [
      { Q: [top[0], top[1], bot[1], bot[0]], c: "#7a8189" },
      { Q: [top[3], top[2], bot[2], bot[3]], c: "#7a8189" },
      { Q: [top[1], top[2], bot[2], bot[1]], c: "#3c4146" },
      { Q: [top[0], top[3], bot[3], bot[0]], c: "#3c4146" },
      { Q: top, c: "rgb(" + sh + "," + (sh + 2) + "," + (sh + 6) + ")", k: "top" },
      { Q: bot, c: "#566069", k: "bot" },
    ];
  lbSolid(faces, c, (F) => {
    ctx.save();
    if (F.k === "top") {
      // lane markings on the deck: edge lines, centre double line, lane dashes
      ctx.strokeStyle = "rgba(236,236,236,0.9)";
      for (const [y, w, dash] of [
        [LB.Y0 + 0.15, 2, 0],
        [LB.Y1 - 0.15, 2, 0],
        [LB.Y0 + 2.92, 2, 0],
        [LB.Y0 + 3.08, 2, 0],
        [LB.Y0 + 1, 1.6, 1],
        [LB.Y0 + 2, 1.6, 1],
        [LB.Y0 + 4, 1.6, 1],
        [LB.Y0 + 5, 1.6, 1],
      ]) {
        ctx.lineWidth = w;
        ctx.beginPath();
        for (let a = dash ? 0.4 : 0; a < L - 0.15; a += dash ? 1.6 : L) {
          const p = pr(P3(a, 0, y)),
            q = pr(P3(Math.min(L - 0.1, a + (dash ? 0.8 : L)), 0, y));
          ctx.moveTo(p[0], p[1]);
          ctx.lineTo(q[0], q[1]);
        }
        ctx.stroke();
      }
    } else if (F.k === "bot") {
      // underside: steel cross girders + two main longitudinal girders
      ctx.strokeStyle = "#2c3136";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let a = 0.6; a < L; a += 0.9) {
        const p = pr(P3(a, -th, y0)),
          q = pr(P3(a, -th, y1));
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
      }
      for (const y of [LB.Y0 + 1.2, LB.Y1 - 1.2]) {
        const p = pr(P3(0, -th, y)),
          q = pr(P3(L, -th, y));
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
    }
    ctx.restore();
  });
  // parapet rails along both edges of the road face
  ctx.strokeStyle = "#c9ced3";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const y of [y0 + 0.05, y1 - 0.05]) {
    const p = pr(P3(0, 0.25, y)),
      q = pr(P3(L, 0.25, y));
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  if (dark)
    for (const y of [y0, y1]) {
      const p = pr(P3(L - 0.1, 0.05, y));
      dnLight(p[0], p[1], 26, "rgba(255,60,40,1)", 0.9);
    }
}
function lbLeafShadow(d, ang) {
  const L = LB.L,
    y0 = LB.Y0 - 0.2,
    y1 = LB.Y1 + 0.2,
    s = (a, y) => {
      const p = lbLeafPt(d, a, 0, y, ang);
      return lbShadowPt(p[0], p[1], p[2]);
    };
  lbPoly([s(0, y0), s(L, y0), s(L, y1), s(0, y1)], "rgba(0,10,20,0.2)");
}
function lbTower(x, y, dark) {
  const w = 1.4,
    h = 6.5,
    x0 = x - w / 2,
    x1 = x + w / 2,
    y0 = y - w / 2,
    y1 = y + w / 2;
  // shadow on the water / deck
  const sp = [
    [x0, y0, 0],
    [x1, y0, 0],
    [x1, y0, h],
    [x1, y1, h],
    [x0, y1, h],
    [x0, y1, 0],
  ].map((q) => (q[2] ? lbShadowPt(q[0], q[1], q[2] - LB.DECK) : [q[0] * TILE, q[1] * TILE]));
  lbPoly(sp, "rgba(0,0,0,0.28)");
  const C = (a, b, z) => [a, b, z],
    faces = [
      { Q: [C(x0, y1, 0), C(x1, y1, 0), C(x1, y1, h), C(x0, y1, h)], c: "#8f7f69" },
      { Q: [C(x0, y0, 0), C(x1, y0, 0), C(x1, y0, h), C(x0, y0, h)], c: "#a08f78" },
      { Q: [C(x1, y0, 0), C(x1, y1, 0), C(x1, y1, h), C(x1, y0, h)], c: "#7f705e" },
      { Q: [C(x0, y0, 0), C(x0, y1, 0), C(x0, y1, h), C(x0, y0, h)], c: "#9a8a74" },
    ];
  lbSolid(faces, [x, y, h / 2], (F, pts) => {
    // two window slits per visible wall
    const m0 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2],
      m1 = [(pts[2][0] + pts[3][0]) / 2, (pts[2][1] + pts[3][1]) / 2];
    ctx.strokeStyle = dark ? "rgba(255,220,140,0.95)" : "#2b2b2b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [a, b] of [
      [0.25, 0.4],
      [0.6, 0.75],
    ]) {
      ctx.moveTo(m0[0] + (m1[0] - m0[0]) * a, m0[1] + (m1[1] - m0[1]) * a);
      ctx.lineTo(m0[0] + (m1[0] - m0[0]) * b, m0[1] + (m1[1] - m0[1]) * b);
    }
    ctx.stroke();
  });
  const r = [
      lbProj(x0 - 0.1, y0 - 0.1, h),
      lbProj(x1 + 0.1, y0 - 0.1, h),
      lbProj(x1 + 0.1, y1 + 0.1, h),
      lbProj(x0 - 0.1, y1 + 0.1, h),
    ],
    apex = lbProj(x, y, h + 1.6);
  for (let i = 0; i < 4; i++) lbPoly([r[i], r[(i + 1) % 4], apex], i % 2 ? "#3f4a55" : "#55616d");
  if (dark) {
    dnLight(apex[0], apex[1], 60, "rgba(255,225,170,1)", 0.7);
    dnLight(x * TILE, y * TILE, 90, "rgba(255,225,170,1)", 0.5);
  }
}
// road signals + half barriers (entry lanes only): west for eastbound (north half), east for westbound (south half)
const LB_BAR = [
  { x: 1739.2, y0: 1942, y1: 1945, piv: 1941.7, dir: 1 },
  { x: 1764.8, y0: 1945, y1: 1948, piv: 1948.3, dir: -1 },
];
const LB_SIG = [
  [1737.6, 1941.5],
  [1737.6, 1945.0],
  [1766.4, 1948.5],
  [1766.4, 1945.0],
];
function lbFurniture(S, dark) {
  const blink = Math.floor(timeS * 2.2) % 2;
  for (const [x, y] of LB_SIG) {
    ctx.save();
    ctx.translate(x * TILE, y * TILE);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-5, -11, 14, 26);
    ctx.fillStyle = "#151515";
    ctx.strokeStyle = "#e0b000";
    ctx.lineWidth = 2;
    ctx.fillRect(-7, -13, 14, 26);
    ctx.strokeRect(-7, -13, 14, 26);
    const on = S.lit && !S.amber,
      cols = [
        [-6, on && blink ? "#ff2a1a" : "#3a1010"],
        [6, on && !blink ? "#ff2a1a" : "#3a1010"],
      ];
    for (const [yy, c] of cols) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, yy, 4.2, 0, 7);
      ctx.fill();
    }
    if (S.amber) {
      ctx.fillStyle = "#ffb000";
      ctx.fillRect(-3, -2, 6, 4);
    }
    ctx.restore();
    if (S.lit)
      dnLight(x * TILE, y * TILE, 34, S.amber ? "rgba(255,176,0,1)" : "rgba(255,40,30,1)", 0.9);
  }
  for (const B of LB_BAR) {
    // arm pivots at the deck edge and swings up (top-down: it foreshortens toward the post)
    const len = (B.y1 - B.y0) * TILE * (0.08 + 0.92 * S.bar),
      px = B.x * TILE,
      py = B.piv * TILE;
    ctx.fillStyle = "#333";
    ctx.fillRect(px - 5, py - 5, 10, 10);
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(2, 0, 5, B.dir * len + 2);
    for (let k = 0; k * 14 < len; k++) {
      ctx.fillStyle = k % 2 ? "#f4f4f4" : "#d62d20";
      const a = k * 14,
        b = Math.min(len, a + 14);
      ctx.fillRect(-2.5, B.dir > 0 ? a : -b, 5, b - a);
    }
    if (S.lit && S.bar > 0.5 && blink) {
      ctx.fillStyle = "#ff3020";
      ctx.beginPath();
      ctx.arc(0, B.dir * len, 3, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
}
// ---------- splash
function lbSplash(x, y) {
  for (let k = 0; k < 46; k++) {
    const a = Math.random() * 6.283,
      s = 2 + Math.random() * 9;
    LB.wr.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      t: 0,
      life: 0.8 + Math.random() * 0.8,
    });
  }
  LB.wr.push({ ring: 1, x, y, t: 0, life: 2.2 });
  if (typeof noiseBurst === "function" && audio.ctx) {
    noiseBurst(0.9, 500, 0.6, 0.9, "lowpass");
    noiseBurst(1.6, 1800, 0.5, 0.35);
  }
}
// ---------- per frame drawing: water in the opening, then (after ships) leaves, towers, signals, barriers
function lbNear(vx0, vy0, vx1, vy1) {
  const m = 30 * TILE;
  return (
    LB.XB * TILE + m > vx0 &&
    LB.XA * TILE - m < vx1 &&
    LB.Y1 * TILE + m > vy0 &&
    LB.Y0 * TILE - m < vy1
  );
}
function lbWater() {
  const a = lbAng();
  if (a < 0.004) return;
  ctx.save();
  ctx.fillStyle = TEX && TEX.water ? ctx.createPattern(TEX.water[0], "repeat") : "#2f6f9c";
  ctx.fillRect(
    LB.XA * TILE,
    (LB.Y0 - 0.25) * TILE,
    (LB.XB - LB.XA) * TILE,
    (LB.Y1 - LB.Y0 + 0.5) * TILE,
  );
  // the pier walls under the hinges + a darker band where the deck shades the water
  ctx.fillStyle = "rgba(10,30,50,0.08)";
  ctx.fillRect(
    LB.XA * TILE,
    (LB.Y0 - 0.25) * TILE,
    (LB.XB - LB.XA) * TILE,
    (LB.Y1 - LB.Y0 + 0.5) * TILE,
  );
  ctx.fillStyle = "#7d858c";
  ctx.fillRect(
    (LB.XA - 0.5) * TILE,
    (LB.Y0 - 0.3) * TILE,
    0.5 * TILE,
    (LB.Y1 - LB.Y0 + 0.6) * TILE,
  );
  ctx.fillRect(LB.XB * TILE, (LB.Y0 - 0.3) * TILE, 0.5 * TILE, (LB.Y1 - LB.Y0 + 0.6) * TILE);
  ctx.restore();
}
// the crossing was generated as a suspension bridge; a bascule replaces its cables, so find that span (its overhead
// cables/towers are skipped) and draw plain parapets + lamp posts on the fixed approach decks instead
function lbSusp() {
  if (LB.S === undefined)
    LB.S =
      (world.susp || []).find(
        (S) =>
          S.dir === "h" &&
          S.a <= LB.Y0 + 0.5 &&
          S.a + S.w >= LB.Y1 - 0.5 &&
          S.r0 < LB.XA &&
          S.r1 > LB.XB,
      ) || null;
  return LB.S;
}
function lbRails(dark) {
  const S = lbSusp();
  if (!S) return;
  ctx.save();
  ctx.strokeStyle = "#e9e4da";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const y of [S.a - 0.1, S.a + S.w + 0.1])
    for (const [a, b] of [
      [S.r0, LB.XA],
      [LB.XB, S.r1],
    ]) {
      ctx.moveTo(a * TILE, y * TILE);
      ctx.lineTo(b * TILE, y * TILE);
    }
  ctx.stroke();
  for (const x of [S.r0 + 3, LB.XA - 2.5, LB.XB + 2.5, S.r1 - 3])
    for (const y of [S.a + 0.25, S.a + S.w - 0.25]) {
      ctx.fillStyle = "#2b2f35";
      ctx.beginPath();
      ctx.arc(x * TILE, y * TILE, 2.6, 0, 7);
      ctx.fill();
      if (dark) dnLight(x * TILE, y * TILE, 70, "rgba(255,225,170,1)", 0.55);
    }
  ctx.restore();
}
function lbDraw(vx0, vy0, vx1, vy1) {
  if (!world.kbPort || !lbNear(vx0, vy0, vx1, vy1)) return;
  const S = lbState(),
    a = S.th * LB.AMAX,
    dark = typeof DN !== "undefined" && DN.dark > 0.05;
  if (a >= 0.004) {
    lbLeafShadow(1, a);
    lbLeafShadow(-1, a);
    lbLeaf(1, a, dark);
    lbLeaf(-1, a, dark);
  } else {
    // closed: just the joints on the baked deck (hinge gaps + the meeting seam)
    ctx.strokeStyle = "rgba(20,20,20,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const x of [LB.XA, LB.XB, LB.XA + LB.L]) {
      ctx.moveTo(x * TILE, (LB.Y0 - 0.2) * TILE);
      ctx.lineTo(x * TILE, (LB.Y1 + 0.2) * TILE);
    }
    ctx.stroke();
  }
  lbRails(dark);
  for (const x of [LB.XA - 0.8, LB.XB + 0.8])
    for (const y of [LB.Y0 - 1.1, LB.Y1 + 1.1]) lbTower(x, y, dark);
  lbFurniture(S, dark);
  // splash particles
  for (const w of LB.wr) {
    const u = w.t / w.life;
    if (w.ring) {
      ctx.strokeStyle = "rgba(235,245,255," + (1 - u) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w.x * PPM, w.y * PPM, (2 + u * 14) * PPM, 0, 7);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(235,245,255," + (1 - u) + ")";
      ctx.beginPath();
      ctx.arc(w.x * PPM, w.y * PPM, 3 + 3 * (1 - u), 0, 7);
      ctx.fill();
    }
  }
}
// ---------- AI: red signals = a stop line before each barrier
function lbStopAcc(v, v0) {
  if (v.h === undefined) return 1e9;
  const S = lbState();
  if (!S.lit && S.bar < 0.05) return 1e9;
  const tx = v.x / M_T,
    ty = v.y / M_T;
  if (ty < LB.Y0 - 0.5 || ty > LB.Y1 + 0.5 || tx < LB.XA - 60 || tx > LB.XB + 60) return 1e9;
  const hx = fwd(v.h)[0];
  if (Math.abs(hx) < 0.7) return 1e9;
  const stopX = hx > 0 ? LB_BAR[0].x - 0.8 : LB_BAR[1].x + 0.8,
    gap = (hx > 0 ? stopX - tx : tx - stopX) * M_T - v.L / 2;
  if (gap < -0.5) return 1e9; // already past the line: clear the span
  return idmAcc(v, v0, Math.max(0.1, gap), 0);
}
// AI caught on the span while it opens (rare: the lights give them 13 s): off they go before the deck lifts
function lbClearSpan() {
  const g = lbGapPx();
  if (!g) return;
  for (let i = traffic.vs.length - 1; i >= 0; i--) {
    const v = traffic.vs[i],
      tx = v.x / M_T,
      ty = v.y / M_T;
    if (ty > LB.Y0 - 0.3 && ty < LB.Y1 + 0.3 && tx > g[0] - 1 && tx < g[1] + 1)
      traffic.vs.splice(i, 1);
  }
}
// ---------- player: barriers block driving INTO the span (never out of it)
function lbBarrierHit(s, prev) {
  const S = lbState();
  if (S.bar < 0.6) return false;
  if (
    Math.abs(s.y / M_T - (LB.Y0 + LB.Y1) / 2) > 6 ||
    Math.abs(s.x / M_T - (LB.XA + LB.XB) / 2) > 40
  )
    return false;
  const A = railBodyPts(s),
    B = railBodyPts(Object.assign({}, s, prev));
  for (const bar of LB_BAR) {
    const xb = bar.x * M_T,
      outside = (q) => (bar.dir > 0 ? q[0] < xb : q[0] > xb);
    const inLane = (q) => q[1] / M_T >= bar.y0 - 0.1 && q[1] / M_T <= bar.y1 + 0.1;
    // a rig already straddling the line (the arm came down behind its cab) is let through
    if (B.some((q) => inLane(q) && !outside(q))) continue;
    for (let i = 0; i < A.length; i++) {
      if (!inLane(A[i])) continue;
      if (outside(B[i]) && !outside(A[i])) return true;
    }
  }
  return false;
}
// ---------- player: riding a rising leaf, launching off its tip, landing or dropping into the channel
const LB_G = 9.81;
function lbSurfZ(tx, a) {
  // road surface height (metres) at tile x; null over open water
  if (tx <= LB.XA || tx >= LB.XB) return 0;
  const r = LB.L * Math.cos(a);
  if (tx <= LB.XA + r) return (tx - LB.XA) * Math.tan(a) * M_T;
  if (tx >= LB.XB - r) return (LB.XB - tx) * Math.tan(a) * M_T;
  return null;
}
function lbOnSpan(s) {
  const ty = s.y / M_T,
    tx = s.x / M_T;
  return ty > LB.Y0 - 0.6 && ty < LB.Y1 + 0.6 && tx > LB.XA - 0.2 && tx < LB.XB + 0.2;
}
function lbTruckStep(s, inp, dt, base) {
  const Q = LB.pl;
  if (Q.mode === "sink") {
    Q.t += dt;
    Q.z = Math.max(-LB.DECK * M_T - 3, Q.z - dt * 6);
    s.v = 0;
    if (Q.t > 2.4) {
      Q.mode = null;
      Q.z = 0;
      const o =
        typeof BREAKDOWN !== "undefined" && BREAKDOWN.options.find((q) => q.id === "respawn");
      if (o) o.run();
      if (typeof toast === "function") toast("\u{1F30A} Into the channel! Towed out of the water");
    }
    return;
  }
  if (Q.mode === "air") {
    Q.t += dt;
    const f = fwd(s.h);
    s.x += f[0] * Q.vh * dt;
    s.y += f[1] * Q.vh * dt;
    Q.z += Q.vz * dt;
    Q.vz -= LB_G * dt;
    const a = lbAng(),
      sz = lbOnSpan(s) ? lbSurfZ(s.x / M_T, a) : 0;
    if (sz == null && Q.z < -LB.DECK * M_T * 0.6) {
      Q.mode = "sink";
      Q.t = 0;
      LB.stats.falls++;
      lbSplash(s.x, s.y);
      return;
    }
    if (sz != null && Q.z <= sz) {
      const imp = Math.max(0, -Q.vz);
      Q.mode = null;
      Q.z = sz;
      s.v = Q.vh;
      s.damage = Math.min(100, (s.damage || 0) + Math.min(25, 3 + imp * 1.2));
      if (typeof cam !== "undefined") cam.shake = Math.max(cam.shake || 0, 4);
      if (typeof thump === "function") thump(Math.min(1, imp / 8));
      LB.stats.landed++;
      if (typeof toast === "function") toast("\u{1F680} Bridge jump! You cleared the gap");
    }
    return;
  }
  base(s, inp, dt);
  const a = lbAng();
  if (a < 0.004 || !lbOnSpan(s)) {
    Q.z = 0;
    Q.mode = null;
    return;
  }
  const tx = s.x / M_T,
    sz = lbSurfZ(tx, a);
  if (sz == null) {
    // drove off the tip: launch (speed along the tilted deck -> horizontal + vertical), or just drop if crawling
    const sp = Math.abs(s.v);
    Q.mode = "air";
    Q.t = 0;
    Q.z = LB.L * Math.sin(a) * M_T;
    Q.vh = s.v * Math.cos(a);
    Q.vz = sp * Math.sin(a);
    LB.stats.jumps++;
    return;
  }
  Q.mode = "leaf";
  Q.z = sz;
  // gravity on the slope: uphill is toward the gap
  const hx = fwd(s.h)[0],
    up = tx < LB.XA + LB.L ? 1 : -1;
  s.v -= LB_G * Math.sin(a) * hx * up * Math.sign(s.mode === "R" ? -1 : 1) * dt * 0.9;
}
// ---------- wiring
{
  const rs = railStopAcc;
  railStopAcc = function (v, v0) {
    return Math.min(rs(v, v0), lbStopAcc(v, v0));
  };
  const rb = railBarrierHit;
  railBarrierHit = function (s, prev) {
    return rb(s, prev) || (s === truck && lbBarrierHit(s, prev));
  };
  const st = stepTruck;
  stepTruck = function (s, inp, dt) {
    if (s !== truck || !world.kbPort) return st(s, inp, dt);
    return lbTruckStep(s, inp, dt, st);
  };
  const cl = portClipBridges;
  portClipBridges = function (P) {
    cl(P);
    if (P !== world.kbPort) return;
    const g = lbGapPx();
    if (!g) return;
    // let ships show through the open span (re-include it in the even-odd clip)
    const r = portRectL(P, LB.XA, LB.Y0, LB.XB - LB.XA, LB.Y1 - LB.Y0);
    ctx.beginPath();
    ctx.rect(-1e5, -1e5, 2e5, 2e5);
    ctx.rect(r[0] * TILE, r[1] * TILE, r[2] * TILE, r[3] * TILE);
    ctx.clip("evenodd");
  };
  const dtf = drawTraffic;
  drawTraffic = function (vx0, vy0, vx1, vy1) {
    const r = dtf.apply(this, arguments);
    try {
      if (world.kbPort && lbNear(vx0, vy0, vx1, vy1)) lbWater();
    } catch (e) {
      if (!LB.err) console.warn("liftbridge water", e);
      LB.err = e;
    }
    return r;
  };
  const dpl = drawPortLow;
  drawPortLow = function (vx0, vy0, vx1, vy1) {
    const r = dpl.apply(this, arguments);
    try {
      lbDraw(vx0, vy0, vx1, vy1);
    } catch (e) {
      if (!LB.err) console.warn("liftbridge", e);
      LB.err = e;
    }
    return r;
  };
  const dl = drawLorry;
  drawLorry = function () {
    const Q = LB.pl;
    if (!Q.mode || Q.z <= 0.05 * M_T) {
      if (Q.mode === "sink") {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Q.t / 1.2);
        dl();
        ctx.restore();
        // it went down between the leaves: they stand in front of it
        const a = lbAng(),
          dark = typeof DN !== "undefined" && DN.dark > 0.05;
        if (a >= 0.004) {
          lbLeaf(1, a, dark);
          lbLeaf(-1, a, dark);
        }
        return;
      }
      return dl();
    }
    // raised: ground shadow, then the rig scaled toward the camera about its own position
    const zt = Q.z / M_T,
      s = 1 + 0.035 * zt,
      X = truck.x * PPM,
      Y = truck.y * PPM,
      p = lbProj(truck.x / M_T, truck.y / M_T, zt),
      gz = lbOnSpan(truck) ? lbSurfZ(truck.x / M_T, lbAng()) : 0,
      sh = lbShadowPt(
        truck.x / M_T,
        truck.y / M_T,
        zt - (gz == null ? -LB.DECK : gz / M_T) - LB.DECK,
      );
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(sh[0], sh[1], 2.2 * TILE, 1.4 * TILE, truck.h, 0, 7);
    ctx.fill();
    ctx.translate(p[0], p[1]);
    ctx.scale(s, s);
    ctx.translate(-X, -Y);
    dl();
    ctx.restore();
  };
  const dsl = drawStreetLamps;
  drawStreetLamps = function () {
    ctx.save();
    lbGapClip();
    dsl.apply(this, arguments);
    ctx.restore();
  };
  // lamps standing on the leaves go dark while the span is up
  const slo = slOn;
  slOn = function (l) {
    if (
      l &&
      l.px > LB.XA * TILE &&
      l.px < LB.XB * TILE &&
      l.py > (LB.Y0 - 1) * TILE &&
      l.py < (LB.Y1 + 1) * TILE &&
      lbAng() >= 0.004
    )
      return 0;
    return slo.apply(this, arguments);
  };
  const dov = drawOverhead;
  drawOverhead = function (o) {
    if (
      (o.kind === "susp" || o.kind === "stower") &&
      o.S &&
      lbSusp() &&
      o.S.a === LB.S.a &&
      o.S.r0 === LB.S.r0
    )
      return;
    return dov.apply(this, arguments);
  };
  const ut = updateTraffic;
  updateTraffic = function (dt) {
    try {
      if (world.kbPort) {
        lbClearSpan();
        for (let i = LB.wr.length - 1; i >= 0; i--) {
          const w = LB.wr[i];
          w.t += dt;
          if (!w.ring) {
            w.x += w.vx * dt;
            w.y += w.vy * dt;
            w.vx *= 0.96;
            w.vy *= 0.96;
          }
          if (w.t > w.life) LB.wr.splice(i, 1);
        }
        // safety audit: a ship over the span must always see it fully open
        if (lbOcc(portT(), -2)) LB.stats.minClear = Math.min(LB.stats.minClear, lbState().th);
      }
    } catch (e) {
      if (!LB.err) console.warn("liftbridge step", e);
      LB.err = e;
    }
    return ut.apply(this, arguments);
  };
}

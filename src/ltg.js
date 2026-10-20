/**
 * @file ltg.js — Kingsbridge LGV Training Ground (v54, replaces the Kingsbridge Field airfield): world gen (flat
 *   tarmac below Airport Way, gate apron off Field Road, training dock / blind-side dock / mini-town buildings,
 *   chunk-baked zone paint), physical traffic cones (knocked over by cab or trailer, slide, reset), the timed cone
 *   loop (START line starts the clock, chequered FINISH stops it after both checkpoints; leaving the tarmac cancels,
 *   Esc / Backspace / hold pad B / the on-screen button cancels, touching any cone fails, best time saved), the
 *   emergency-stop light, the wet skid pan (low grip), map zones + learner plate icon + POI, night floodlights.
 * Exposes (globals): LTG, ltgGen, ltgGate, ltgIn, ltgOnTarmac, ltgGrip, ltgUpdate, ltgDraw, ltgHUD, ltgMapDraw, ltgMapIcon,
 *   ltgPOI, ltgLights, ltgPlate, ltgCancel, ltgCones (+ ltg* helpers)
 * Depends on: world.js (world, G, T, TILE, M_T, MW, idx, inb, set, get, fill, mulberry, hash2), sites.js (OBJX),
 *   traffic.js (playerBoxes, ptBoxDist), ui.js (toast), physics.js (truck), main.js (started, VW, VH, cam, ctx, timeS)
 * Load order: after sites.js in build.py (OBJX). World data: tiles, "bldg" objects and kind "ltg" paint objects
 *   (plain data in src/map/); cones, the loop run and the e-stop light are runtime-only (local, never sent in MP).
 */
"use strict";
const LTG = {
  X0: 1195,
  Y0: 1792,
  W: 190,
  H: 113,
  cones: null,
  grid: null,
  run: null,
  res: null,
  best: +(localStorage.getItem("bigrig.ltgBest") || 0) || 0,
  prev: null,
  hb: 0,
  es: { st: "g", arm: false, redAt: 0, x0: 0, v0: 0, res: null },
  spr: null,
  poi: null,
};
// layout (tiles, local to X0/Y0): north strip below Airport Way, spine road, south zones, loop along the bottom edge
const LTG_SPINE = [47, 53],
  LTG_GATE = [186, 199],
  LTG_PAN = [160, 82, 23],
  LTG_LOOP = { o: [8, 88, 120, 22, 10], i: [13, 93, 110, 12, 5], start: 62, fin: 57 },
  LTG_TOWN = {
    cols: [
      [108, 125],
      [128.5, 145],
      [148.5, 166],
      [169.5, 186],
    ],
    rows: [
      [14, 27.5],
      [31, 46],
    ],
  };
const ltgTX = (u) => LTG.X0 + u,
  ltgTY = (v) => LTG.Y0 + v;
// ---------------------------------------------------------------- world generation (called from world.js)
function ltgGen(objs) {
  const { X0, Y0, W, H } = LTG;
  // flat tarmac over the whole old airfield footprint (same tiles the airfield's concrete covered; Airport Way kept)
  for (let y = Y0; y < Y0 + H; y++)
    for (let x = X0; x < X0 + W; x++) {
      const t = get(x, y);
      if (t !== T.ROAD && t !== T.WATER && t !== T.BRIDGE && t !== T.WALK) set(x, y, T.LOT);
    }
  const R_ = world.reserved;
  for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) R_[idx(x, y)] = 1;
  const bld = (u, v, w, h, style, height, extra) => {
    const x = Math.round(ltgTX(u)),
      y = Math.round(ltgTY(v));
    fill(x, y, w, h, T.BLDG);
    objs.push(
      Object.assign(
        {
          kind: "bldg",
          x: x * TILE,
          y: y * TILE,
          w: w * TILE,
          h: h * TILE,
          style,
          height,
          seed: (hash2(x, y) * 1e9) | 0,
        },
        extra || {},
      ),
    );
  };
  bld(6, 14, 40, 6, "warehouse", 22, { logo: "TRAINING DOCK" });
  bld(50, 14, 10, 4, "warehouse", 16);
  bld(49, 18, 1, 13, "warehouse", 10);
  bld(182, 55, 4, 3, "house", 8);
  // mini town: kerbed blocks (concrete pavement ring) with small shops
  let k = 0;
  for (const [a, b] of LTG_TOWN.cols)
    for (const [c, d] of LTG_TOWN.rows) {
      const x0 = Math.round(ltgTX(a)),
        y0 = Math.round(ltgTY(c)),
        x1 = Math.round(ltgTX(b)),
        y1 = Math.round(ltgTY(d));
      fill(x0, y0, x1 - x0, y1 - y0, T.CONC);
      const n = 3,
        bw = Math.floor((x1 - x0 - 2) / n);
      for (let i = 0; i < n; i++)
        bld(
          x0 + 1 + i * bw - X0,
          y0 + 1 - Y0,
          i === n - 1 ? x1 - x0 - 2 - i * bw : bw - 1,
          y1 - y0 - 2,
          (k + i) % 3 ? "shop" : "house",
          10 + ((k * 7 + i * 5) % 9),
        );
      k++;
    }
  // chunk-baked paint, one object per zone (drawn under buildings, o.z -1)
  const P = (part, u, v, w, h) =>
    objs.push({
      kind: "ltg",
      part,
      x: ltgTX(u) * TILE,
      y: ltgTY(v) * TILE,
      w: w * TILE,
      h: h * TILE,
    });
  P("edge", -1, 10, W + 2, H - 9);
  P("spine", 2, LTG_SPINE[0] - 4, LTG_GATE[1] - 2, LTG_SPINE[1] - LTG_SPINE[0] + 6);
  P("bays", 4, 19, 58, 20);
  P("couple", 64, 16, 41, 24);
  P("town", 106, 13, 82, 34);
  P("slalom", 4, 55, 94, 17);
  P("gates", 98, 54, 34, 18);
  P("estop", 4, 72, 128, 10);
  P(
    "pan",
    LTG_PAN[0] - LTG_PAN[2] - 2,
    LTG_PAN[1] - LTG_PAN[2] - 2,
    LTG_PAN[2] * 2 + 4,
    LTG_PAN[2] * 2 + 4,
  );
  P("loop", 6, 86, 124, 26);
}
// gate apron to Field Road (the pavement tile at x 1393 stays: dropped kerb). Called after the forest pass so the grass
// gap keeps its trees' share of R() (every later tree seed stays the same); trees standing on the apron are cleared.
function ltgGate(objs) {
  const x0 = LTG.X0 + LTG.W,
    x1 = ltgTX(LTG_GATE[1] - 1),
    y0 = ltgTY(LTG_SPINE[0]),
    y1 = ltgTY(LTG_SPINE[1]);
  for (const o of objs)
    if (o.kind === "tree" || o.kind === "bush" || o.kind === "rock") {
      const tx = Math.floor(o.x / TILE),
        ty = Math.floor(o.y / TILE);
      if (tx >= x0 - 1 && tx < x1 + 1 && ty >= y0 - 1 && ty < y1 + 1) o._dead = true;
    }
  for (let i = objs.length - 1; i >= 0; i--) if (objs[i]._dead) objs.splice(i, 1);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const t = get(x, y);
      if (t !== T.ROAD && t !== T.WALK && t !== T.BRIDGE) set(x, y, T.LOT);
      world.reserved[idx(x, y)] = 1;
    }
}
// ---------------------------------------------------------------- chunk paint (OBJX.ltg)
const ltgX = (u) => ltgTX(u) * TILE,
  ltgY = (v) => ltgTY(v) * TILE,
  ltgS = (n) => n * TILE;
function ltgLine(g, pts, c, w, dash) {
  g.strokeStyle = c;
  g.lineWidth = w;
  g.setLineDash(dash || []);
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.stroke();
  g.setLineDash([]);
}
function ltgText(g, s, x, y, px, c, al) {
  g.font = `900 ${px}px system-ui,sans-serif`;
  g.textAlign = al || "center";
  g.textBaseline = "middle";
  g.fillStyle = c;
  g.fillText(s, x, y);
}
function ltgArrow(g, x, y, dir, c) {
  const L = ltgS(3),
    hd = ltgS(0.8);
  ltgLine(
    g,
    [
      [x - (L / 2) * dir, y],
      [x + (L / 2) * dir, y],
    ],
    c,
    6,
  );
  ltgLine(
    g,
    [
      [x + (L / 2 - hd) * dir, y - hd * 0.75],
      [x + (L / 2) * dir, y],
      [x + (L / 2 - hd) * dir, y + hd * 0.75],
    ],
    c,
    6,
  );
}
// learner plate: white rounded square, black rim, red L
function ltgPlate(g, x, y, s) {
  g.fillStyle = "#fff";
  g.strokeStyle = "#111";
  g.lineWidth = Math.max(1.5, s * 0.06);
  g.beginPath();
  g.roundRect
    ? g.roundRect(x - s / 2, y - s / 2, s, s, s * 0.14)
    : g.rect(x - s / 2, y - s / 2, s, s);
  g.fill();
  g.stroke();
  g.fillStyle = "#d61f1f";
  g.fillRect(x - s * 0.24, y - s * 0.32, s * 0.16, s * 0.62);
  g.fillRect(x - s * 0.24, y + s * 0.16, s * 0.48, s * 0.14);
}
function ltgRRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
}
const LTG_PAINT = {
  edge(g) {
    const r = mulberry(54),
      { W, H } = LTG;
    // resurfacing patches, then the perimeter fence (posts + mesh line)
    for (let i = 0; i < 70; i++) {
      g.fillStyle = r() < 0.5 ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.05)";
      g.fillRect(
        ltgX(r() * (W - 12)),
        ltgY(14 + r() * (H - 20)),
        ltgS(3 + r() * 9),
        ltgS(2 + r() * 6),
      );
    }
    const fy = ltgY(H) + 6,
      fx0 = ltgX(0) - 6,
      fx1 = ltgX(W) + 6;
    ltgLine(
      g,
      [
        [fx1, ltgY(LTG_SPINE[0] - 0.4)],
        [fx1, ltgY(14)],
      ],
      "#2c3e2f",
      4,
      [14, 8],
    );
    ltgLine(
      g,
      [
        [fx1, ltgY(LTG_SPINE[1] + 0.4)],
        [fx1, fy],
        [fx0, fy],
        [fx0, ltgY(16)],
      ],
      "#2c3e2f",
      4,
      [14, 8],
    );
  },
  spine(g) {
    const [a, b] = LTG_SPINE,
      x0 = ltgX(3),
      x1 = ltgX(LTG_GATE[1] - 1),
      m = (a + b) / 2;
    g.fillStyle = "#45484c";
    g.fillRect(x0, ltgY(a), x1 - x0, ltgS(b - a));
    ltgLine(
      g,
      [
        [x0 + 30, ltgY(m)],
        [x1, ltgY(m)],
      ],
      "#f2f2f2",
      5,
      [70, 60],
    );
    ltgLine(
      g,
      [
        [x0, ltgY(a + 0.3)],
        [x1, ltgY(a + 0.3)],
      ],
      "#e9e9e9",
      3,
    );
    ltgLine(
      g,
      [
        [x0, ltgY(b - 0.3)],
        [x1, ltgY(b - 0.3)],
      ],
      "#e9e9e9",
      3,
    );
    ltgText(g, "LGV TRAINING", ltgX(172), ltgY(m), 52, "rgba(255,255,255,.75)");
    // gate: raised barrier arm along the kerb, sign board with the learner plate
    const gx = ltgX(193);
    g.fillStyle = "#555";
    g.fillRect(gx - 6, ltgY(a) - 14, 12, 12);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = k % 2 ? "#fff" : "#d63031";
      g.fillRect(gx + 6 + k * 18, ltgY(a) - 11, 18, 6);
    }
    g.fillStyle = "#2d3436";
    g.fillRect(ltgX(194.3), ltgY(a - 3.4), ltgS(3.2), ltgS(1.9));
    ltgPlate(g, ltgX(195.1), ltgY(a - 2.45), ltgS(1.5));
    ltgText(g, "LGV", ltgX(196.6), ltgY(a - 2.45), 20, "#fff");
  },
  bays(g) {
    for (let k = 0; k < 14; k++) {
      const u = 8 + k * 2.6;
      g.fillStyle = "#2e2e2e";
      g.fillRect(ltgX(u), ltgY(20), ltgS(1.4), ltgS(0.3));
      ltgLine(
        g,
        [
          [ltgX(u - 0.6), ltgY(20)],
          [ltgX(u - 0.6), ltgY(26)],
        ],
        "#ffd23f",
        5,
      );
      ltgText(g, String(k + 1), ltgX(u + 0.7), ltgY(25.2), 44, "#ffd23f");
    }
    ltgLine(
      g,
      [
        [ltgX(8 + 14 * 2.6 - 0.6), ltgY(20)],
        [ltgX(8 + 14 * 2.6 - 0.6), ltgY(26)],
      ],
      "#ffd23f",
      5,
    );
    for (let i = 0; i < 9; i++)
      ltgLine(
        g,
        [
          [ltgX(8 + i * 4), ltgY(28.5)],
          [ltgX(10 + i * 4), ltgY(27)],
          [ltgX(12 + i * 4), ltgY(28.5)],
        ],
        "rgba(255,255,255,.55)",
        5,
      );
    ltgText(
      g,
      "REVERSE ONLY  \u00b7  BLIND-SIDE BAYS \u2192",
      ltgX(26),
      ltgY(32),
      58,
      "rgba(255,255,255,.8)",
    );
    // blind-side bays against the side wall of the small dock
    for (let k = 0; k <= 4; k++)
      ltgLine(
        g,
        [
          [ltgX(50), ltgY(20 + k * 2.6)],
          [ltgX(58), ltgY(20 + k * 2.6)],
        ],
        "#ffd23f",
        5,
      );
    for (let k = 0; k < 4; k++)
      ltgText(g, "B" + (k + 1), ltgX(57), ltgY(21.3 + k * 2.6), 34, "#ffd23f");
  },
  couple(g) {
    for (let k = 0; k < 5; k++) {
      const u = 68 + k * 7;
      ltgLine(
        g,
        [
          [ltgX(u - 0.15), ltgY(17)],
          [ltgX(u + 0.8), ltgY(17)],
          [ltgX(u + 0.8), ltgY(21)],
          [ltgX(u - 0.15), ltgY(21)],
          [ltgX(u - 0.15), ltgY(17)],
        ],
        "rgba(255,255,255,.6)",
        3,
        [12, 8],
      );
      g.strokeStyle = "#ffd23f";
      g.lineWidth = 6;
      g.beginPath();
      g.arc(ltgX(u + 0.325), ltgY(20.5), 18, 0, 7);
      g.stroke();
      ltgLine(
        g,
        [
          [ltgX(u + 0.325), ltgY(21.2)],
          [ltgX(u + 0.325), ltgY(31)],
        ],
        "#ffd23f",
        4,
        [26, 18],
      );
      g.fillStyle = "#fff";
      g.fillRect(ltgX(u - 0.6), ltgY(30.6), ltgS(1.85), 7);
      ltgText(g, "STAND " + (k + 1), ltgX(u + 0.3), ltgY(33), 34, "rgba(255,255,255,.8)");
    }
    ltgText(g, "COUPLE / UNCOUPLE", ltgX(83), ltgY(38), 64, "rgba(255,255,255,.85)");
  },
  town(g) {
    const { cols, rows } = LTG_TOWN;
    for (const [a, b] of cols)
      for (const [c, d] of rows) {
        g.strokeStyle = "#f4f4f0";
        g.lineWidth = 6;
        g.strokeRect(
          ltgX(Math.round(a)) + 3,
          ltgY(Math.round(c)) + 3,
          ltgS(Math.round(b) - Math.round(a)) - 6,
          ltgS(Math.round(d) - Math.round(c)) - 6,
        );
      }
    const ym = 29.25;
    ltgLine(
      g,
      [
        [ltgX(108), ltgY(ym)],
        [ltgX(186), ltgY(ym)],
      ],
      "#f2f2f2",
      4,
      [40, 40],
    );
    for (const u of [126.75, 146.75, 167.75])
      ltgLine(
        g,
        [
          [ltgX(u), ltgY(14)],
          [ltgX(u), ltgY(47)],
        ],
        "#f2f2f2",
        4,
        [40, 40],
      );
    // mini roundabout: white dome, dashed circulation ring, give-way lines on the four arms
    const cx = ltgX(146.75),
      cy = ltgY(ym);
    g.fillStyle = "#4a4d51";
    g.fillRect(cx - ltgS(1.6), cy - ltgS(1.6), ltgS(3.2), ltgS(3.2));
    g.fillStyle = "#f4f4f4";
    g.beginPath();
    g.arc(cx, cy, ltgS(0.55), 0, 7);
    g.fill();
    g.strokeStyle = "#f4f4f4";
    g.lineWidth = 4;
    g.setLineDash([16, 12]);
    g.beginPath();
    g.arc(cx, cy, ltgS(1.4), 0, 7);
    g.stroke();
    g.setLineDash([]);
    for (const a of [0, 1.57, 3.14, 4.71]) {
      const r = ltgS(1.75),
        c = Math.cos(a),
        s = Math.sin(a);
      ltgLine(
        g,
        [
          [cx + c * r - s * 46, cy + s * r + c * 46],
          [cx + c * r + s * 46, cy + s * r - c * 46],
        ],
        "#fff",
        5,
        [12, 10],
      );
    }
    for (const [u, v] of [
      [126.75, 26.4],
      [126.75, 32.1],
      [167.75, 26.4],
      [167.75, 32.1],
    ]) {
      ltgLine(
        g,
        [
          [ltgX(u - 1.6), ltgY(v)],
          [ltgX(u + 1.6), ltgY(v)],
        ],
        "#fff",
        5,
        [12, 10],
      );
    }
    ltgText(g, "SLOW", ltgX(116.5), ltgY(ym), 40, "rgba(255,255,255,.8)");
  },
  slalom(g) {
    const x0 = ltgX(6),
      x1 = ltgX(96);
    g.fillStyle = "#505357";
    g.fillRect(x0, ltgY(56), x1 - x0, ltgS(14));
    for (let i = 0; i < 6; i++) {
      const u = 14 + i * 13 + 1.5;
      ltgArrow(g, ltgX(u), ltgY(58), 1, "#fff");
      ltgArrow(g, ltgX(u), ltgY(68), -1, "#ffd23f");
    }
    ltgText(g, "FORWARD", ltgX(7), ltgY(60.2), 30, "#fff", "left");
    ltgText(g, "REVERSE", ltgX(7), ltgY(65.8), 30, "#ffd23f", "left");
    g.fillStyle = "#fff";
    g.fillRect(ltgX(12.3), ltgY(59), 8, ltgS(8));
    g.fillRect(ltgX(92), ltgY(59), 8, ltgS(8));
  },
  gates(g) {
    g.fillStyle = "#505357";
    g.fillRect(ltgX(100), ltgY(56), ltgS(30), ltgS(14));
    ltgLine(
      g,
      [
        [ltgX(100), ltgY(63)],
        [ltgX(130), ltgY(63)],
      ],
      "rgba(255,255,255,.4)",
      4,
      [30, 30],
    );
    for (const [u, lab] of [
      [104, "3.2m"],
      [111, "2.9m"],
      [118, "2.7m"],
    ])
      ltgText(g, lab, ltgX(u), ltgY(59.6), 32, "#fff");
    // low bridge: red/white beam across the lane with the height sign
    const u = 125;
    g.fillStyle = "rgba(0,0,0,.3)";
    g.fillRect(ltgX(u) - 2, ltgY(58.5) + 10, 22, ltgS(9));
    g.fillStyle = "#d63031";
    g.fillRect(ltgX(u) - 8, ltgY(58.5), 16, ltgS(9));
    for (let k = 0; k < 9; k++)
      if (k % 2) {
        g.fillStyle = "#fff";
        g.fillRect(ltgX(u) - 8, ltgY(58.5 + k), 16, ltgS(1));
      }
    g.fillStyle = "#fff";
    g.strokeStyle = "#d63031";
    g.lineWidth = 7;
    g.beginPath();
    g.arc(ltgX(u + 2.3), ltgY(57.4), 30, 0, 7);
    g.fill();
    g.stroke();
    ltgText(g, "13'0\"", ltgX(u + 2.3), ltgY(57.4), 19, "#111");
  },
  estop(g) {
    g.fillStyle = "#505357";
    g.fillRect(ltgX(6), ltgY(74), ltgS(124), ltgS(6));
    ltgLine(
      g,
      [
        [ltgX(6), ltgY(74.2)],
        [ltgX(130), ltgY(74.2)],
      ],
      "#fff",
      4,
    );
    ltgLine(
      g,
      [
        [ltgX(6), ltgY(79.8)],
        [ltgX(130), ltgY(79.8)],
      ],
      "#fff",
      4,
    );
    for (let u = 10; u < 70; u += 4)
      ltgLine(
        g,
        [
          [ltgX(u), ltgY(77)],
          [ltgX(u + 2), ltgY(77)],
        ],
        "#fff",
        5,
      );
    for (const [u0, w, c] of [
      [72, 14, "rgba(39,174,96,.35)"],
      [86, 10, "rgba(241,196,15,.35)"],
      [96, 8, "rgba(214,48,49,.4)"],
    ]) {
      g.fillStyle = c;
      g.fillRect(ltgX(u0), ltgY(74), ltgS(w), ltgS(6));
    }
    for (let u = 72; u <= 104; u += 2.5) {
      ltgLine(
        g,
        [
          [ltgX(u), ltgY(74)],
          [ltgX(u), ltgY(74.8)],
        ],
        "#fff",
        4,
      );
      if ((u - 72) % 10 === 0)
        ltgText(g, (u - 72) * 4 + "m", ltgX(u), ltgY(81), 22, "rgba(255,255,255,.75)");
    }
    g.fillStyle = "#2d3436";
    g.fillRect(ltgX(70.6), ltgY(73), 22, ltgS(8));
    ltgText(g, "E-STOP: BRAKE ON RED", ltgX(30), ltgY(77) - 2, 44, "rgba(255,255,255,.85)");
  },
  pan(g) {
    const [u, v, R] = LTG_PAN,
      cx = ltgX(u),
      cy = ltgY(v),
      r = ltgS(R),
      rn = mulberry(77);
    g.fillStyle = "#3b4651";
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.fill();
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 10, cx, cy, r);
    gr.addColorStop(0, "rgba(180,215,240,.45)");
    gr.addColorStop(0.5, "rgba(120,160,195,.22)");
    gr.addColorStop(1, "rgba(40,60,80,.1)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.fill();
    for (let i = 0; i < 40; i++) {
      const a = rn() * 6.28,
        d = rn() * r * 0.9;
      g.fillStyle = "rgba(210,230,250,.18)";
      g.beginPath();
      g.ellipse(
        cx + Math.cos(a) * d,
        cy + Math.sin(a) * d,
        30 + rn() * 90,
        8 + rn() * 18,
        rn() * 3,
        0,
        7,
      );
      g.fill();
    }
    g.strokeStyle = "rgba(30,30,30,.35)";
    g.lineWidth = 7;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.arc(cx + 40 * k - 80, cy + 30, r * (0.35 + k * 0.1), 3.6 + k * 0.2, 5.4 + k * 0.3);
      g.stroke();
    }
    g.strokeStyle = "#e9e9e9";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.stroke();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 6.283;
      g.fillStyle = "#74b9ff";
      g.beginPath();
      g.arc(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18), 7, 0, 7);
      g.fill();
    }
    ltgText(g, "WET SKID PAN", cx, cy, 80, "rgba(255,255,255,.7)");
  },
  loop(g) {
    const [ox, oy, ow, oh, orr] = LTG_LOOP.o,
      [ix, iy, iw, ih, ir] = LTG_LOOP.i;
    g.fillStyle = "#505357";
    ltgRRect(g, ltgX(ox), ltgY(oy), ltgS(ow), ltgS(oh), ltgS(orr));
    g.fill();
    g.fillStyle = "#4b4e52";
    ltgRRect(g, ltgX(ix), ltgY(iy), ltgS(iw), ltgS(ih), ltgS(ir));
    g.fill();
    g.strokeStyle = "#fff";
    g.lineWidth = 5;
    ltgRRect(g, ltgX(ox + 0.3), ltgY(oy + 0.3), ltgS(ow - 0.6), ltgS(oh - 0.6), ltgS(orr - 0.2));
    g.stroke();
    ltgRRect(g, ltgX(ix - 0.3), ltgY(iy - 0.3), ltgS(iw + 0.6), ltgS(ih + 0.6), ltgS(ir + 0.2));
    g.stroke();
    for (let i = 0; i < 6; i++) {
      const u = 31.5 + i * 16;
      ltgArrow(g, ltgX(u), ltgY(90.5), -1, "rgba(255,255,255,.7)");
      ltgArrow(g, ltgX(u), ltgY(107.5), 1, "rgba(255,255,255,.7)");
    }
    const S0 = LTG_LOOP.start,
      F0 = LTG_LOOP.fin;
    g.fillStyle = "#2ecc71";
    g.fillRect(ltgX(S0), ltgY(iy + ih), ltgS(0.6), ltgS(oy + oh - iy - ih));
    ltgText(g, "START", ltgX(S0 + 0.3), ltgY(iy + ih - 0.7), 34, "#2ecc71");
    const n = Math.round((oy + oh - iy - ih) * 2);
    for (let k = 0; k < n; k++)
      for (let m = 0; m < 2; m++) {
        g.fillStyle = (k + m) % 2 ? "#111" : "#fff";
        g.fillRect(ltgX(F0) + m * ltgS(0.3), ltgY(iy + ih) + k * ltgS(0.5), ltgS(0.3), ltgS(0.5));
      }
    ltgText(g, "FINISH", ltgX(F0 + 0.3), ltgY(iy + ih - 0.7), 34, "#fff");
    ltgText(g, "TIMED CONE LOOP", ltgX(68), ltgY(96.2), 64, "rgba(255,255,255,.85)");
    ltgPlate(g, ltgX(68), ltgY(101.2), ltgS(4.5));
  },
};
OBJX.ltg = (g, o) => {
  const f = LTG_PAINT[o.part];
  if (f) f(g, o);
};
// ---------------------------------------------------------------- place tests
function ltgIn(tx, ty) {
  if (ty < LTG.Y0 || ty >= LTG.Y0 + LTG.H || tx < LTG.X0) return false;
  if (tx < LTG.X0 + LTG.W) return true;
  return tx < ltgTX(LTG_GATE[1] - 1) && ty >= ltgTY(LTG_SPINE[0]) && ty < ltgTY(LTG_SPINE[1]);
}
// on the training ground's own surface: tarmac, the town's kerbed pavements or a building wall the rig leans on
function ltgOnTarmac(mx, my) {
  const tx = Math.floor(mx / M_T),
    ty = Math.floor(my / M_T);
  if (!ltgIn(tx, ty)) return false;
  const t = G[idx(tx, ty)];
  return t === T.LOT || t === T.CONC || t === T.BLDG;
}
// wet skid pan grip (physics.js multiplies braking + steering grip by this)
function ltgGrip(s) {
  const [u, v, R] = LTG_PAN,
    dx = s.x / M_T - ltgTX(u),
    dy = s.y / M_T - ltgTY(v);
  return dx * dx + dy * dy < R * R ? 0.45 : 1;
}
// ---------------------------------------------------------------- cones (runtime, metres)
function ltgRing(x0, y0, w, h, r, step) {
  const P = 2 * (w + h - 4 * r) + 2 * Math.PI * r,
    n = Math.round(P / step),
    out = [];
  const segs = [
    w - 2 * r,
    (Math.PI / 2) * r,
    h - 2 * r,
    (Math.PI / 2) * r,
    w - 2 * r,
    (Math.PI / 2) * r,
    h - 2 * r,
    (Math.PI / 2) * r,
  ];
  for (let k = 0; k < n; k++) {
    let d = (k / n) * P;
    for (let id = 0; id < 8; id++) {
      const L = segs[id];
      if (d > L) {
        d -= L;
        continue;
      }
      const t = d / L;
      if (id === 0) out.push([x0 + r + d, y0]);
      else if (id === 2) out.push([x0 + w, y0 + r + d]);
      else if (id === 4) out.push([x0 + w - r - d, y0 + h]);
      else if (id === 6) out.push([x0, y0 + h - r - d]);
      else {
        const cx = id === 1 || id === 3 ? x0 + w - r : x0 + r,
          cy = id === 1 || id === 7 ? y0 + r : y0 + h - r,
          a = [0, -Math.PI / 2, 0, 0, 0, Math.PI / 2, 0, Math.PI][id] + (t * Math.PI) / 2;
        out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      break;
    }
  }
  return out;
}
function ltgConeInit() {
  const C = [],
    add = (u, v, loop) =>
      C.push({
        hx: ltgTX(u) * M_T,
        hy: ltgTY(v) * M_T,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        a: 0,
        va: 0,
        dn: 0,
        t: 0,
        loop: !!loop,
      }),
    line = (u0, v0, u1, v1, step) => {
      const n = Math.max(1, Math.round(Math.hypot(u1 - u0, v1 - v0) / step));
      for (let i = 0; i <= n; i++) add(u0 + ((u1 - u0) * i) / n, v0 + ((v1 - v0) * i) / n);
    };
  // v54b layout rules: cones only on lane edges / zone sides in even rows, never across an entrance, in a driving
  // line (except the slalom line and the width-gate posts, which ARE the exercise), on roads, markings, bays, the gate
  // apron or the town streets. Loop cones sit exactly on the painted edge lines, evenly spaced.
  line(47, 21, 47, 44, 3); // bays | blind-side dock divider (behind the side wall)
  line(64, 16, 64, 44, 3); // coupling stands: sides only, open to the spine
  line(104, 16, 104, 44, 3);
  for (let u = 14; u <= 86; u += 6) add(u, 63); // slalom line
  line(6, 56, 96, 56, 3);
  line(6, 70, 96, 70, 3);
  for (const [u, wm] of [
    [104, 3.2],
    [111, 2.9],
    [118, 2.7],
  ]) {
    const half = (wm / 2 + 0.3) / M_T;
    add(u, 63 - half);
    add(u, 63 + half);
  }
  line(100, 56, 130, 56, 3);
  line(100, 70, 130, 70, 3);
  line(6, 73.5, 130, 73.5, 4); // e-stop lane edges, just outside the painted lines
  line(6, 80.5, 130, 80.5, 4);
  line(130.6, 74.5, 130.6, 79.5, 1.25); // end of the stop lane
  const [ox, oy, ow, oh, orr] = LTG_LOOP.o,
    [ix, iy, iw, ih, ir] = LTG_LOOP.i;
  for (const [u, v] of ltgRing(ox + 0.3, oy + 0.3, ow - 0.6, oh - 0.6, orr - 0.2, 2.2))
    add(u, v, 1);
  for (const [u, v] of ltgRing(ix - 0.3, iy - 0.3, iw + 0.6, ih + 0.6, ir + 0.2, 2.2)) add(u, v, 1);
  {
    const [u, v, R] = LTG_PAN;
    for (let k = 0; k < 44; k++) {
      const a = (k / 44) * 6.283;
      add(u + Math.cos(a) * (R + 0.7), v + Math.sin(a) * (R + 0.7));
    }
  }
  // perimeter (bottom + sides), gate opening on the spine rows kept clear
  line(1, LTG.H - 0.8, LTG.W - 1, LTG.H - 0.8, 3);
  line(0.8, 17, 0.8, LTG.H - 2, 3);
  line(LTG.W - 0.8, 17, LTG.W - 0.8, LTG_SPINE[0] - 2, 3);
  line(LTG.W - 0.8, LTG_SPINE[1] + 2, LTG.W - 0.8, LTG.H - 2, 3);
  const grid = new Map();
  for (const c of C) {
    c.x = c.hx;
    c.y = c.hy;
    const k = ltgKey(c.hx, c.hy);
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(c);
  }
  LTG.cones = C;
  LTG.grid = grid;
}
const LTG_CELL = 16;
function ltgKey(x, y) {
  return Math.floor(x / LTG_CELL) * 4096 + Math.floor(y / LTG_CELL);
}
function ltgCones() {
  if (!LTG.cones) ltgConeInit();
  return LTG.cones;
}
function ltgConeReset(c) {
  c.x = c.hx;
  c.y = c.hy;
  c.vx = c.vy = c.va = c.a = 0;
  c.dn = 0;
}
// ---------------------------------------------------------------- runtime: cone hits, loop timing, e-stop light
const LTG_SITE_M = () => [
  LTG.X0 * M_T - 60,
  LTG.Y0 * M_T - 60,
  ltgTX(LTG_GATE[1]) * M_T + 60,
  (LTG.Y0 + LTG.H) * M_T + 60,
];
function ltgUpdate(dt) {
  if (!world.ready || typeof truck === "undefined") return;
  const s = truck,
    B = LTG_SITE_M();
  const near = s.x > B[0] && s.x < B[2] && s.y > B[1] && s.y < B[3];
  if (!near && !LTG.dirty && !LTG.run) {
    LTG.prev = null;
    return;
  }
  ltgCones();
  const now = timeS;
  // cones: hits from cab and trailer boxes (only cells around the rig), sliding + spin of knocked cones
  if (near) {
    const boxes = playerBoxes(),
      ci = Math.floor(s.x / LTG_CELL),
      cj = Math.floor(s.y / LTG_CELL),
      sp = Math.abs(s.v),
      f = fwd(s.h),
      dir = Math.sign(s.v) || 1;
    for (let di = -2; di <= 2; di++)
      for (let dj = -2; dj <= 2; dj++) {
        const a = LTG.grid.get((ci + di) * 4096 + cj + dj);
        if (!a) continue;
        for (const c of a)
          for (const b of boxes) {
            const d = ptBoxDist(c.x, c.y, b);
            if (d > 0.35) continue;
            // push out along the line from the box centre, plus the rig's own motion
            let nx = c.x - b.x,
              ny = c.y - b.y;
            const nl = Math.hypot(nx, ny) || 1;
            nx /= nl;
            ny /= nl;
            const kick = Math.max(1.2, sp * 0.9);
            c.vx = f[0] * dir * sp * 0.8 + nx * kick;
            c.vy = f[1] * dir * sp * 0.8 + ny * kick;
            c.x += nx * (0.36 - d);
            c.y += ny * (0.36 - d);
            if (!c.dn) {
              c.dn = 1;
              c.a = Math.atan2(c.vy, c.vx);
              c.va = (Math.random() - 0.5) * 9;
              LTG.dirty = true;
              if (LTG.run) ltgEnd("fail", "Cone hit \u2014 run failed");
            }
            c.t = now;
          }
      }
  }
  if (LTG.dirty) {
    let any = false;
    const k = Math.exp(-3 * dt);
    for (const c of LTG.cones) {
      if (!c.dn) continue;
      any = true;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.a += c.va * dt;
      c.vx *= k;
      c.vy *= k;
      c.va *= k;
      // reset: 12 s after the last touch once the rig is clear, or straight away on a new loop run
      if (now - c.t > 12 && Math.hypot(s.x - c.hx, s.y - c.hy) > 25) ltgConeReset(c);
    }
    if (!any) LTG.dirty = false;
  }
  ltgLoopTick(s, dt);
  ltgEStopTick(s, dt);
  // gamepad: hold B (button 1) for a second cancels a run
  if (LTG.run) {
    let b = false;
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gps) if (gp && gp.buttons[1] && gp.buttons[1].pressed) b = true;
    LTG.hb = b ? LTG.hb + dt : 0;
    if (LTG.hb > 1) ltgCancel("Run cancelled");
  } else LTG.hb = 0;
}
function ltgLocal(s) {
  return [s.x / M_T - LTG.X0, s.y / M_T - LTG.Y0];
}
function ltgLoopTick(s, dt) {
  const [u, v] = ltgLocal(s),
    p = LTG.prev;
  LTG.prev = [u, v];
  const L = LTG_LOOP,
    bot = v > L.i[1] + L.i[3] && v < L.o[1] + L.o[3],
    top = v > L.o[1] && v < L.i[1];
  if (LTG.run) {
    const R = LTG.run;
    R.t += dt;
    if (!ltgOnTarmac(s.x, s.y))
      return ltgCancel("You left the training ground \u2014 run cancelled");
    if (!p) return;
    if (top && p[0] >= 68 && u < 68) R.cp |= 1;
    if (R.cp & 1 && u < L.i[0] && v > L.o[1] && v < L.o[1] + L.o[3]) R.cp |= 2;
    if (R.cp === 3 && bot && p[0] < L.fin && u >= L.fin) ltgEnd("done");
    return;
  }
  if (p && bot && p[0] < L.start && u >= L.start && ltgOnTarmac(s.x, s.y)) ltgStart();
}
function ltgStart() {
  for (const c of LTG.cones) if (c.loop && c.dn) ltgConeReset(c);
  LTG.run = { t: 0, cp: 0 };
  LTG.res = null;
  ltgBtn(true);
  if (typeof toast === "function") toast("\u23F1 Timed cone loop \u2014 go! Don't touch a cone.");
}
function ltgEnd(kind, msg) {
  const R = LTG.run;
  if (!R) return;
  LTG.run = null;
  ltgBtn(false);
  let nb = false;
  if (kind === "done" && (!LTG.best || R.t < LTG.best)) {
    LTG.best = R.t;
    nb = true;
    try {
      localStorage.setItem("bigrig.ltgBest", R.t.toFixed(2));
    } catch (e) {
      console.warn("ltg best", e);
    }
  }
  LTG.res = { kind, t: R.t, nb, at: timeS, msg: msg || "" };
  if (typeof toast === "function")
    toast(kind === "done" ? "\u{1F3C1} Lap " + ltgFmt(R.t) + (nb ? " \u2014 new best!" : "") : msg);
}
function ltgCancel(msg) {
  if (LTG.run) ltgEnd("cancel", msg || "Run cancelled");
}
function ltgFmt(t) {
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return String(m).padStart(2, "0") + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}
// on-screen cancel button (phone + mouse), only while a run is live
function ltgBtn(on) {
  let el = document.getElementById("ltgX");
  if (!on) {
    if (el) el.remove();
    return;
  }
  if (el) return;
  el = document.createElement("button");
  el.id = "ltgX";
  el.innerHTML = "\u2715 CANCEL RUN<small>Esc / Backspace \u00b7 hold \u24b7</small>";
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    ltgCancel("Run cancelled");
  });
  (document.getElementById("frame") || document.body).appendChild(el);
  if (!document.getElementById("ltgXs")) {
    const st = document.createElement("style");
    st.id = "ltgXs";
    st.textContent =
      "#ltgX{position:absolute;right:14px;top:30%;z-index:30;padding:10px 16px;min-height:52px;border-radius:14px;border:2px solid #ff6b6b;font:900 15px system-ui;color:#fff;background:rgba(10,14,22,.85);box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer}#ltgX small{display:block;font-size:10px;opacity:.75;font-weight:700}";
    document.head.appendChild(st);
  }
}
addEventListener(
  "keydown",
  (e) => {
    if (!LTG.run || (e.code !== "Escape" && e.code !== "Backspace")) return;
    if (typeof career !== "undefined" && career.uiOpen) return;
    if (typeof bigmap !== "undefined" && bigmap.open) return;
    if (typeof isTyping === "function" && isTyping(document.activeElement)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    ltgCancel("Run cancelled");
  },
  true,
);
// emergency stop: arm on the run-in heading east, light goes red at a random point, measure the stop
function ltgEStopTick(s, dt) {
  const E = LTG.es,
    [u, v] = ltgLocal(s),
    inLane = v > 73.5 && v < 80.5 && u > 6 && u < 131,
    east = Math.sin(s.h) > 0.7 && s.v > 0;
  if (!inLane) {
    if (E.st !== "g" && !E.arm) E.st = "g";
    E.arm = false;
    if (E.st === "r" && !E.res) E.st = "g";
    return;
  }
  if (E.st === "g" && !E.arm && east && u > 20 && u < 50 && s.v > 5) {
    E.arm = true;
    E.redAt = 56 + Math.random() * 14;
    E.res = null;
  }
  if (E.arm && E.st === "g" && u >= E.redAt) {
    E.st = "r";
    E.x0 = s.x;
    E.v0 = s.v;
  }
  if (E.arm && E.st === "r" && Math.abs(s.v) < 0.3) {
    E.arm = false;
    const d = Math.abs(s.x - E.x0);
    E.res = { d, mph: E.v0 * 2.237, at: timeS };
    if (typeof toast === "function")
      toast(
        "\u{1F6D1} Stopped in " + d.toFixed(0) + " m from " + (E.v0 * 2.237).toFixed(0) + " mph",
      );
  }
  if (!E.arm && E.st === "r" && E.res && timeS - E.res.at > 4) E.st = "g";
}
// ---------------------------------------------------------------- drawing (world px, under vehicles)
function ltgSprites() {
  if (LTG.spr) return LTG.spr;
  const mk = (w, h, f) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    f(c.getContext("2d"));
    return c;
  };
  const up = mk(36, 36, (c) => {
    c.fillStyle = "rgba(0,0,0,.28)";
    c.beginPath();
    c.arc(21, 21, 14, 0, 7);
    c.fill();
    c.fillStyle = "#e8590c";
    c.fillRect(6, 6, 24, 24);
    c.fillStyle = "#ff7a1a";
    c.beginPath();
    c.arc(18, 18, 10, 0, 7);
    c.fill();
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(18, 18, 6.5, 0, 7);
    c.fill();
    c.fillStyle = "#ff8c2a";
    c.beginPath();
    c.arc(18, 18, 3.5, 0, 7);
    c.fill();
  });
  const dn = mk(48, 24, (c) => {
    c.fillStyle = "rgba(0,0,0,.25)";
    c.fillRect(6, 14, 38, 8);
    c.fillStyle = "#e8590c";
    c.fillRect(2, 4, 8, 16);
    c.fillStyle = "#ff7a1a";
    c.beginPath();
    c.moveTo(10, 5);
    c.lineTo(44, 10);
    c.lineTo(44, 14);
    c.lineTo(10, 19);
    c.fill();
    c.fillStyle = "#fff";
    c.fillRect(22, 8, 6, 8);
  });
  return (LTG.spr = { up, dn });
}
function ltgDraw(vx0, vy0, vx1, vy1) {
  if (!world.ready) return;
  const B = LTG_SITE_M();
  if (vx1 < B[0] * PPM || vx0 > B[2] * PPM || vy1 < B[1] * PPM || vy0 > B[3] * PPM) return;
  ltgCones();
  const g = ctx,
    sp = ltgSprites(),
    lo = cam.z < 0.3,
    i0 = Math.floor(vx0 / PPM / LTG_CELL) - 1,
    i1 = Math.floor(vx1 / PPM / LTG_CELL) + 1,
    j0 = Math.floor(vy0 / PPM / LTG_CELL) - 1,
    j1 = Math.floor(vy1 / PPM / LTG_CELL) + 1;
  if (lo) g.fillStyle = "#ff7a1a";
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const a = LTG.grid.get(i * 4096 + j);
      if (!a) continue;
      for (const c of a) {
        const X = c.x * PPM,
          Y = c.y * PPM;
        if (lo) {
          g.fillRect(X - 4, Y - 4, 8, 8);
        } else if (!c.dn) g.drawImage(sp.up, X - 7, Y - 7, 14, 14);
        else {
          g.save();
          g.translate(X, Y);
          g.rotate(c.a);
          g.drawImage(sp.dn, -5, -5, 19, 10);
          g.restore();
        }
      }
    }
  // e-stop light heads (the gantry post is baked)
  const E = LTG.es,
    lx = ltgX(70.6) + 11;
  for (const [vv, on, col, off] of [
    [73.3, E.st === "r", "#ff2a1a", "#3a0d0d"],
    [74.9, E.st === "g", "#2ecc71", "#0d3a1d"],
  ]) {
    g.fillStyle = on ? col : off;
    g.beginPath();
    g.arc(lx, ltgY(vv) + 6, 9, 0, 7);
    g.fill();
    if (on) {
      g.fillStyle = col === "#ff2a1a" ? "rgba(255,42,26,.3)" : "rgba(46,204,113,.3)";
      g.beginPath();
      g.arc(lx, ltgY(vv) + 6, 24, 0, 7);
      g.fill();
    }
  }
}
// ---------------------------------------------------------------- HUD (screen px)
function ltgHUD() {
  if (!started || !world.ready || (typeof bigmap !== "undefined" && bigmap.open)) return;
  const s = truck,
    [u, v] = ltgLocal(s),
    L = LTG_LOOP,
    inLoop = u > L.o[0] - 2 && u < L.o[0] + L.o[2] + 2 && v > L.o[1] - 2 && v < L.o[1] + L.o[3] + 1;
  const R = LTG.res && timeS - LTG.res.at < 6 ? LTG.res : null;
  if (!LTG.run && !R && !inLoop) return;
  const c = ctx,
    w = Math.min(360, VW - 24),
    x = (VW - w) / 2,
    y = 64,
    h = LTG.run ? 92 : 58;
  c.save();
  c.fillStyle = "rgba(10,14,22,.86)";
  ltgRRect(c, x, y, w, h, 12);
  c.fill();
  c.strokeStyle = R && R.kind !== "done" ? "#ff6b6b" : "#ffd23f";
  c.lineWidth = 2;
  c.stroke();
  ltgPlate(c, x + 26, y + 29, 30);
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.fillStyle = "#ffd23f";
  c.font = "900 12px system-ui,sans-serif";
  c.fillText(LTG.run ? "TIMED CONE LOOP \u00b7 RUN" : "TIMED CONE LOOP", x + 50, y + 20);
  const best = LTG.best ? "Best " + ltgFmt(LTG.best) : "No best yet";
  if (LTG.run) {
    c.fillStyle = "#fff";
    c.font = "900 30px system-ui,sans-serif";
    c.fillText(ltgFmt(LTG.run.t), x + 50, y + 52);
    c.font = "700 13px system-ui,sans-serif";
    c.fillStyle = "#9fe6b8";
    c.fillText(best, x + 190, y + 48);
    c.fillStyle = "#cfd8dc";
    c.font = "600 11px system-ui,sans-serif";
    c.fillText("Touch a cone = fail \u00b7 leave the tarmac = cancelled", x + 14, y + 72);
    c.fillText("Cancel: Esc / Backspace \u00b7 hold \u24b7 \u00b7 \u2715 button", x + 14, y + 86);
  } else if (R) {
    c.font = "900 18px system-ui,sans-serif";
    c.fillStyle = R.kind === "done" ? "#fff" : "#ff8a8a";
    c.fillText(
      R.kind === "done" ? "Lap " + ltgFmt(R.t) + (R.nb ? "  NEW BEST!" : "") : R.msg,
      x + 50,
      y + 44,
      w - 60,
    );
  } else {
    c.font = "700 13px system-ui,sans-serif";
    c.fillStyle = "#fff";
    c.fillText("Drive over the green START line to begin", x + 50, y + 38, w - 60);
    c.fillStyle = "#9fe6b8";
    c.fillText(best, x + 50, y + 52);
  }
  c.restore();
}
// ---------------------------------------------------------------- map (big map + minimap, px/py take metres)
function ltgMapDraw(px, py) {
  const sx = (u) => px(ltgTX(u) * M_T),
    sy = (v) => py(ltgTY(v) * M_T),
    c = ctx;
  // only when zoomed out: closer in, the map shows the chunk-baked paint itself
  if (sx(1) - sx(0) > 2.2) return;
  if (sx(LTG.W) < -50 || sx(0) > VW + 50 || sy(LTG.H) < -50 || sy(0) > VH + 50) return;
  c.save();
  c.fillStyle = "#6e7276";
  c.fillRect(
    sx(3),
    sy(LTG_SPINE[0]),
    sx(LTG_GATE[1] - 1) - sx(3),
    sy(LTG_SPINE[1]) - sy(LTG_SPINE[0]),
  );
  c.fillStyle = "#8f9aa3";
  c.fillRect(sx(6), sy(14), sx(46) - sx(6), sy(20) - sy(14));
  c.fillStyle = "#566573";
  c.beginPath();
  c.arc(sx(LTG_PAN[0]), sy(LTG_PAN[1]), sx(LTG_PAN[2]) - sx(0), 0, 7);
  c.fill();
  c.fillStyle = "#505357";
  c.fillRect(sx(6), sy(56), sx(96) - sx(6), sy(70) - sy(56));
  c.fillRect(sx(6), sy(74), sx(130) - sx(6), sy(80) - sy(74));
  const [ox, oy, ow, oh] = LTG_LOOP.o;
  c.strokeStyle = "#e8590c";
  c.lineWidth = Math.max(1.5, (sx(4) - sx(0)) * 0.6);
  ltgRRect(c, sx(ox + 2.5), sy(oy + 2.5), sx(ow - 5) - sx(0), sy(oh - 5) - sy(0), sx(7.5) - sx(0));
  c.stroke();
  c.restore();
}
function ltgPOI() {
  if (LTG.poi) return LTG.poi;
  // fast travel lands on the spine road just inside the gate (satnav.js ftPlaceSpot zones, metres)
  return (LTG.poi = {
    name: "Kingsbridge LGV Training Ground",
    x: (ltgTX(186) + 0.5) * M_T,
    y: ltgTY(50) * M_T,
    zones: [
      [ltgTX(160) * M_T, ltgTY(LTG_SPINE[0]) * M_T, ltgTX(185) * M_T, ltgTY(LTG_SPINE[1]) * M_T],
    ],
    entrance: { x: ltgTX(LTG_GATE[1] - 1) * M_T, y: ltgTY(50) * M_T },
  });
}
// learner plate icon, same size/rim as the round POI icons (fuel.js drawPOIs)
function ltgMapIcon(px, py, rr, R) {
  const p = ltgPOI(),
    X = px(p.x),
    Y = py(p.y),
    c = ctx;
  if (typeof nmIconRing === "function") nmIconRing(X, Y, rr);
  c.save();
  c.fillStyle = "#fff";
  c.strokeStyle = "#000";
  c.lineWidth = R ? Math.max(1.5, rr * 0.18) : 1.5;
  ltgRRect(c, X - rr, Y - rr, rr * 2, rr * 2, rr * 0.3);
  c.fill();
  c.stroke();
  c.fillStyle = "#d61f1f";
  c.font = `900 ${Math.round(rr * 1.45)}px system-ui,sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("L", X, Y + 0.5);
  c.restore();
}
// ---------------------------------------------------------------- night floodlights (daynight.js dnBuild)
function ltgLights(add) {
  for (let v = 20; v < LTG.H; v += 24)
    for (let u = 12; u < LTG.W; u += 26) add(ltgX(u), ltgY(v), 230, "fl");
  add(ltgX(192), ltgY(50), 160, "fl");
}

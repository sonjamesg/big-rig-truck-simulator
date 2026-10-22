/**
 * @file bldg2.js — buildings: seeded footprints, materials, facades, roof furniture (baked into chunk canvases)
 * Exposes (globals): ROOF2, MATS, WINC, bShadow, bMat, bParts, bWindows, bBlock, bFurniture,
 *   bHouse, bWarehouse, bLandmark, roof2
 * Depends on: world.js, render.js, lorry.js, traffic.js
 * Load order: #4 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
// ---------- v20 buildings: seeded footprints, materials, facades, roof furniture (baked into chunk canvases) ----------
const ROOF2 = {
  office: 1,
  glass: 1,
  gravel: 1,
  tower: 1,
  brick: 1,
  flat: 1,
  green: 1,
  shop: 1,
  solar: 1,
  house: 1,
  warehouse: 1,
};
const MATS = {
  brick: [
    ["#9c4a36", "#7d3626"],
    ["#b0603f", "#8a4630"],
    ["#8a5a44", "#6b4232"],
    ["#a8705a", "#83533f"],
    ["#6e3b2e", "#522a20"],
  ],
  concrete: [
    ["#a9aaa5", "#8a8b86"],
    ["#c2bdb2", "#9f9a8f"],
    ["#8f9499", "#73787d"],
    ["#b7b0a2", "#958e80"],
    ["#9d978c", "#7f796f"],
  ],
  glass: [
    ["#4f7fa3", "#2f5878"],
    ["#3e6f7a", "#264c55"],
    ["#5a6f8f", "#3a4c68"],
    ["#2f4a63", "#1c2f42"],
    ["#6a8fa8", "#47697f"],
  ],
  clad: [
    ["#cfd6dc", "#a7b0b8"],
    ["#d9c9a3", "#b3a27c"],
    ["#7d8f7a", "#5f705c"],
    ["#c98f5b", "#a3703f"],
    ["#5d6670", "#454d55"],
    ["#e3e0d8", "#bdb9af"],
  ],
  cyber: [
    ["#2b3140", "#1b202b"],
    ["#33304a", "#211e33"],
    ["#24363d", "#152429"],
    ["#3b3346", "#271f31"],
  ],
};
const WINC = [
  "rgba(170,215,240,0.85)",
  "rgba(120,160,190,0.8)",
  "rgba(220,230,235,0.75)",
  "rgba(90,120,150,0.85)",
];
function bShadow(g, x, y, w, h, s) {
  g.fillStyle = "rgba(8,12,22,0.42)";
  g.beginPath();
  g.moveTo(x + w, y);
  g.lineTo(x + w + s, y + s * 0.8);
  g.lineTo(x + w + s, y + h + s * 0.8);
  g.lineTo(x + s, y + h + s * 0.8);
  g.lineTo(x, y + h);
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fill();
}
function bMat(o, r) {
  const st = o.style;
  let m = o.cyber
    ? (() => {
        const q = r();
        return q < 0.35 ? "glass" : q < 0.55 ? "cyber" : q < 0.8 ? "clad" : "concrete";
      })()
    : st === "glass" || st === "tower"
      ? r() < 0.7
        ? "glass"
        : "clad"
      : st === "brick"
        ? "brick"
        : st === "flat"
          ? r() < 0.5
            ? "brick"
            : "concrete"
          : st === "shop"
            ? r() < 0.5
              ? "brick"
              : "clad"
            : ["concrete", "clad", "brick", "glass"][(r() * 4) | 0];
  const L = MATS[m];
  return { m, c: L[(r() * L.length) | 0] };
}
// footprint as a list of sub-rects (L-shape, courtyard, stepped, plain)
function bParts(x, y, w, h, r, kind) {
  const k = kind !== undefined ? kind : r();
  if (w < 70 || h < 70) return [[x, y, w, h]];
  if (k < 0.22) {
    const cw = w * (0.45 + r() * 0.15),
      ch = h * (0.45 + r() * 0.15);
    const flipx = r() < 0.5,
      flipy = r() < 0.5;
    return [
      [x, flipy ? y + h - ch : y, w, ch],
      [flipx ? x + w - cw : x, y, cw, h],
    ];
  } // L
  if (k < 0.36 && w > 110 && h > 110) {
    const t = Math.min(w, h) * 0.3;
    return [
      [x, y, w, t],
      [x, y + h - t, w, t],
      [x, y + t, t, h - 2 * t],
      [x + w - t, y + t, t, h - 2 * t],
    ];
  } // courtyard
  if (k < 0.52) {
    const a = w > h,
      s = 0.5 + r() * 0.2;
    return a
      ? [
          [x, y, w * s, h],
          [x + w * s, y + h * 0.15, w * (1 - s), h * 0.7],
        ]
      : [
          [x, y, w, h * s],
          [x + w * 0.15, y + h * s, w * 0.7, h * (1 - s)],
        ];
  } // stepped wing
  return [[x, y, w, h]];
}
function bWindows(g, x, y, w, h, r, mat, pat) {
  const wc = WINC[(r() * WINC.length) | 0];
  if (pat === 0) {
    g.fillStyle = wc;
    for (let k = 5; k < w - 6; k += 8) g.fillRect(x + k, y + 3, 5, Math.max(2, h - 6));
  } // vertical strips
  else if (pat === 1) {
    g.fillStyle = wc;
    for (let j = 3; j < h - 4; j += 6) g.fillRect(x + 3, y + j, w - 6, 3);
  } // ribbon rows
  else {
    g.fillStyle = wc;
    for (let j = 3; j < h - 4; j += 7)
      for (let k = 4; k < w - 6; k += 9) g.fillRect(x + k, y + j, 5, 4);
  } // punched grid
  if (mat === "brick") {
    g.fillStyle = "rgba(255,255,255,0.12)";
    for (let j = 3; j < h - 4; j += 7) g.fillRect(x + 3, y + j + 4, w - 6, 1);
  }
}
function bBlock(g, x, y, w, h, o, r, M, pat, ht) {
  const f = Math.min(h * 0.32, Math.max(6, ht * 0.16)); // roof (north) + visible south facade strip
  bShadow(g, x, y, w, h, Math.min(90, ht * 0.7));
  const ry = y,
    rh = h - f;
  const c0 = M.c[0],
    c1 = M.c[1];
  // facade
  const fg = g.createLinearGradient(0, y + rh, 0, y + h);
  fg.addColorStop(0, shade(c1, 0.85));
  fg.addColorStop(1, shade(c1, 0.6));
  g.fillStyle = fg;
  g.fillRect(x, y + rh, w, f);
  bWindows(g, x, y + rh, w, f, r, M.m, pat);
  // roof
  if (M.m === "glass") {
    const gg = g.createLinearGradient(x, ry, x + w, ry + rh);
    gg.addColorStop(0, shade(c0, 1.25));
    gg.addColorStop(0.55, c0);
    gg.addColorStop(1, shade(c0, 0.75));
    g.fillStyle = gg;
  } else g.fillStyle = c0;
  g.fillRect(x, ry, w, rh);
  if (M.m === "brick") {
    g.fillStyle = "rgba(0,0,0,0.08)";
    for (let k = 0; k < rh; k += 4) g.fillRect(x, ry + k, w, 1);
  }
  if (M.m === "clad") {
    g.fillStyle = "rgba(0,0,0,0.1)";
    for (let k = 0; k < w; k += 5) g.fillRect(x + k, ry, 1, rh);
  }
  if (M.m === "concrete") {
    g.strokeStyle = "rgba(0,0,0,0.1)";
    g.lineWidth = 1;
    for (let k = 16; k < w; k += 16) {
      g.beginPath();
      g.moveTo(x + k, ry);
      g.lineTo(x + k, ry + rh);
      g.stroke();
    }
    for (let k = 16; k < rh; k += 16) {
      g.beginPath();
      g.moveTo(x, ry + k);
      g.lineTo(x + w, ry + k);
      g.stroke();
    }
  }
  if (M.m === "glass") {
    g.fillStyle = "rgba(255,255,255,0.1)";
    for (let k = 0; k < w + rh; k += 22) {
      g.beginPath();
      g.moveTo(x + k, ry);
      g.lineTo(x + k - rh * 0.5, ry + rh);
      g.lineTo(x + k - rh * 0.5 + 6, ry + rh);
      g.lineTo(x + k + 6, ry);
      g.fill();
    }
  }
  if (M.m === "cyber") {
    g.fillStyle = "rgba(120,200,255,0.25)";
    for (let k = 6; k < w - 6; k += 6) g.fillRect(x + k, ry + 3, 2, rh - 6);
  }
  // parapet + edge window row (roof edge)
  g.strokeStyle = shade(c0, 0.6);
  g.lineWidth = 3;
  g.strokeRect(x + 1.5, ry + 1.5, w - 3, rh - 3);
  g.lineWidth = 1;
  g.strokeStyle = shade(c0, 1.3);
  g.strokeRect(x + 4.5, ry + 4.5, w - 9, rh - 9);
  // door at street level
  if (w > 40) {
    const dx = x + w * (0.25 + r() * 0.5);
    g.fillStyle = "#2b2620";
    g.fillRect(dx - 5, y + h - Math.min(f, 9), 10, Math.min(f, 9));
    g.fillStyle = "rgba(255,220,150,0.6)";
    g.fillRect(dx - 4, y + h - Math.min(f, 9) + 1, 8, 2);
  }
  return { x, y: ry, w, h: rh };
}
function bFurniture(g, R, o, r, M) {
  const { x, y, w, h } = R;
  if (w < 30 || h < 24) return;
  const k = r();
  // v51: a big (merged-block) roof only gives part of itself to panels or a garden, plant covers the rest (no field-sized roofs)
  const big = w * h > 300 * 220,
    part = (fw, fh) => {
      const qw = Math.max(30, w * fw),
        qh = Math.max(24, h * fh);
      return { x: r() < 0.5 ? x : x + w - qw, y: r() < 0.5 ? y : y + h - qh, w: qw, h: qh };
    };
  if (o.style === "solar" || k < 0.18) {
    const Q = big ? part(0.5, 0.45) : R;
    for (let yy = Q.y + 8; yy < Q.y + Q.h - 18; yy += 14)
      for (let xx = Q.x + 8; xx < Q.x + Q.w - 22; xx += 20) {
        g.fillStyle = "#1f3b73";
        g.fillRect(xx, yy, 18, 11);
        g.strokeStyle = "#8fa8d8";
        g.strokeRect(xx + 0.5, yy + 0.5, 17, 10);
      }
    if (!big) return;
  } else if (o.style === "green" || k < 0.32) {
    const { x: gx, y: gy, w: gw, h: gh } = big ? part(0.4, 0.4) : R;
    g.fillStyle = "#5f8f4a";
    g.fillRect(gx + 7, gy + 7, gw - 14, gh - 14);
    for (let i = 0; i < (gw * gh) / 220; i++) {
      g.fillStyle = ["#7fae67", "#4d7a3b", "#93c178"][(r() * 3) | 0];
      g.beginPath();
      g.arc(gx + 10 + r() * (gw - 20), gy + 10 + r() * (gh - 20), 2 + r() * 4, 0, 7);
      g.fill();
    }
    g.fillStyle = "#c9b48a";
    g.fillRect(gx + gw / 2 - 2, gy + 7, 4, gh - 14);
    if (!big) return;
  }
  const n = 1 + (((w * h) / 2500) | 0);
  for (let i = 0; i < n; i++) {
    const ax = x + 8 + r() * (w - 28),
      ay = y + 8 + r() * (h - 24),
      t = r();
    if (t < 0.45) acUnit(g, ax, ay);
    else if (t < 0.7) {
      g.fillStyle = "#c8e4f4";
      g.fillRect(ax, ay, 14, 9);
      g.strokeStyle = "#7fa7bf";
      g.strokeRect(ax + 0.5, ay + 0.5, 13, 8);
    } // skylight
    else if (t < 0.85) {
      g.fillStyle = "#6b6f75";
      g.beginPath();
      g.arc(ax + 5, ay + 5, 4, 0, 7);
      g.fill();
      g.fillStyle = "#3d4045";
      g.beginPath();
      g.arc(ax + 5, ay + 5, 2, 0, 7);
      g.fill();
    } // vent
    else {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(ax + 3, ay + 3, 16, 12);
      g.fillStyle = shade(M.c[0], 0.85);
      g.fillRect(ax, ay, 16, 12);
      g.fillStyle = "#4a4f57";
      g.fillRect(ax + 4, ay + 8, 8, 4);
    }
  } // stair core
  if (r() < 0.25 && w > 50) {
    const tx = x + w - 18,
      ty = y + 16;
    g.fillStyle = "#7a6a5a";
    g.beginPath();
    g.arc(tx, ty, 8, 0, 7);
    g.fill();
    g.strokeStyle = "#4f4235";
    g.beginPath();
    g.arc(tx, ty, 5, 0, 7);
    g.stroke();
  }
}
function bHouse(g, o, r) {
  const { x, y, w, h } = o;
  const C = [
    "#b5523b",
    "#6b6f78",
    "#8a5a3b",
    "#3f5f7f",
    "#a7453a",
    "#5d4e45",
    "#7c8a5e",
    "#9a6b4f",
  ][(r() * 8) | 0];
  bShadow(g, x, y, w, h, 14);
  const horiz = w >= h,
    inset = Math.min(w, h) * 0.32;
  // hip roof: 4 planes
  const pl = (pts, f) => {
    g.fillStyle = shade(C, f);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.closePath();
    g.fill();
  };
  const a = horiz ? [x + inset, y + h / 2] : [x + w / 2, y + inset],
    b = horiz ? [x + w - inset, y + h / 2] : [x + w / 2, y + h - inset];
  pl([[x, y], [x + w, y], horiz ? b : [x + w, y], a].filter(Boolean), 1.18);
  pl([[x, y + h], [x + w, y + h], b, a], 0.78);
  pl([[x, y], [x, y + h], a], horiz ? 1.0 : 1.05);
  pl([[x + w, y], [x + w, y + h], b], horiz ? 0.9 : 0.85);
  if (!horiz) {
    pl([[x, y], [x + w, y], a], 1.18);
    pl([[x, y + h], [x + w, y + h], b], 0.78);
    pl([[x, y], [x, y + h], b, a], 1.0);
    pl([[x + w, y], [x + w, y + h], b, a], 0.86);
  }
  g.strokeStyle = "rgba(0,0,0,0.12)";
  g.lineWidth = 1;
  for (let k = 4; k < (horiz ? h : w); k += 4) {
    g.beginPath();
    if (horiz) {
      g.moveTo(x, y + k);
      g.lineTo(x + w, y + k);
    } else {
      g.moveTo(x + k, y);
      g.lineTo(x + k, y + h);
    }
    g.stroke();
  }
  g.strokeStyle = shade(C, 0.5);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.stroke();
  g.lineWidth = 1;
  const cx = x + w * (0.2 + r() * 0.6),
    cy = y + h * (0.2 + r() * 0.25);
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(cx + 3, cy + 3, 7, 7);
  g.fillStyle = "#7d4a3a";
  g.fillRect(cx, cy, 7, 7);
  g.fillStyle = "#333";
  g.fillRect(cx + 2, cy + 2, 3, 3); // chimney
  if (r() < 0.35) {
    g.fillStyle = "#1f3b73";
    g.fillRect(x + w * 0.15, y + h * 0.62, w * 0.3, h * 0.18);
  } // solar on rear slope
  g.strokeStyle = shade(C, 0.45);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function bWarehouse(g, o, r) {
  const { x, y, w, h } = o;
  const C = [
    ["#8c97a3", "#6f7a86"],
    ["#a39a8a", "#857c6c"],
    ["#7e8f84", "#62736a"],
    ["#9aa6b5", "#7a8696"],
    ["#b6a07a", "#8f7b57"],
  ][(r() * 5) | 0];
  bShadow(g, x, y, w, h, Math.min(40, o.height * 0.8));
  const f = Math.min(18, h * 0.12);
  g.fillStyle = C[0];
  g.fillRect(x, y, w, h - f);
  g.fillStyle = C[1];
  for (let k = 0; k < w; k += 5) g.fillRect(x + k, y, 2, h - f); // corrugated
  g.fillStyle = "rgba(190,225,245,0.7)";
  for (let k = 14; k < w - 14; k += 44) g.fillRect(x + k, y + 8, 9, h - f - 16); // skylight strips
  g.fillStyle = shade(C[1], 0.7);
  g.fillRect(x, y + h - f, w, f);
  g.fillStyle = "#d9a21b";
  const nd = Math.max(1, (w / 36) | 0); // loading doors
  for (let i = 0; i < nd; i++) {
    const dx = x + 8 + (i * (w - 16)) / nd;
    g.fillStyle = "#4a4f57";
    g.fillRect(dx, y + h - f + 3, (w - 16) / nd - 8, f - 3);
    g.fillStyle = "rgba(255,255,255,0.15)";
    for (let j = y + h - f + 5; j < y + h; j += 3) g.fillRect(dx, j, (w - 16) / nd - 8, 1);
    g.fillStyle = "#d9a21b";
    g.fillRect(dx - 2, y + h - f + 3, 2, f - 3);
  }
  g.strokeStyle = shade(C[0], 0.6);
  g.lineWidth = 2;
  g.strokeRect(x + 1, y + 1, w - 2, h - f - 2);
  g.lineWidth = 1;
  if (o.logo) {
    g.save();
    g.fillStyle = "rgba(255,255,255,0.88)";
    const lw = Math.min(w - 8, signNeed(g, o.logo, 18, "900 ", "Arial Black,Arial,sans-serif") + 16);
    g.fillRect(x + w / 2 - lw / 2, y + (h - f) / 2 - 13, lw, 26);
    g.fillStyle = "#22324a";
    g.font = "900 18px Arial Black,Arial,sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    fitText(g, o.logo, x + w / 2, y + (h - f) / 2 + 1, lw - 12, "roof-logo2", { wrap: false });
    g.restore();
  }
}
function bLandmark(g, o, r) {
  const { x, y, w, h } = o,
    cx = x + w / 2,
    cy = y + h / 2,
    R = Math.min(w, h) / 2 - 2,
    t = (o.seed >>> 5) % 3;
  bShadow(g, x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8, Math.min(110, o.height * 0.8));
  if (t === 0) {
    const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 2, cx, cy, R);
    gr.addColorStop(0, "#9fd2ee");
    gr.addColorStop(1, "#1f4f73");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, R, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    for (let k = R / 4; k < R; k += R / 4) {
      g.beginPath();
      g.arc(cx, cy, k, 0, 7);
      g.stroke();
    }
    for (let a = 0; a < 6.28; a += 0.52) {
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.stroke();
    }
  } // glass drum
  else if (t === 1) {
    const s = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      f = [1.3, 0.95, 0.7, 1.1];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = shade("#4f7fa3", f[i]);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(s[i][0], s[i][1]);
      g.lineTo(s[(i + 1) % 4][0], s[(i + 1) % 4][1]);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = "rgba(255,255,255,0.25)";
    for (let k = 0.2; k < 1; k += 0.2) {
      g.strokeRect(cx - (w / 2) * k, cy - (h / 2) * k, w * k, h * k);
    }
  } // glass pyramid
  else {
    g.fillStyle = "#d8d4c8";
    g.fillRect(x, y, w, h);
    g.fillStyle = "#a49f92";
    g.fillRect(x + 4, y + 4, w - 8, h - 8);
    const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 2, cx, cy, R * 0.75);
    gr.addColorStop(0, "#c9e3d2");
    gr.addColorStop(1, "#4c8a6a");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, R * 0.72, 0, 7);
    g.fill();
    g.fillStyle = "#d4ac0d";
    g.beginPath();
    g.arc(cx, cy, 4, 0, 7);
    g.fill();
  } // copper dome civic
  g.fillStyle = "#e74c3c";
  g.beginPath();
  g.arc(cx, cy, 3, 0, 7);
  g.fill();
}
function roof2(g, o) {
  const r = mulberry(o.seed ^ 0x5bd1e995),
    st = o.style;
  if (st === "house") return bHouse(g, o, r);
  if (st === "warehouse") return bWarehouse(g, o, r);
  if (o.w >= 120 && o.h >= 120 && o.seed % 23 === 0) return bLandmark(g, o, r);
  const M = bMat(o, r),
    pat = (r() * 3) | 0,
    ht = o.height || 30;
  const parts = bParts(o.x, o.y, o.w, o.h, r, st === "shop" ? 0.9 : undefined);
  if (parts.length > 1) {
    g.fillStyle = "rgba(200,195,182,0.9)";
    g.fillRect(o.x, o.y, o.w, o.h);
    g.fillStyle = "rgba(0,0,0,0.06)";
    for (let k = 0; k < o.w; k += 12) g.fillRect(o.x + k, o.y, 1, o.h);
  } // paved courtyard/yard
  let main = null;
  parts.forEach((p, i) => {
    const hh = ht * (i === 0 ? 1 : 0.55 + r() * 0.3);
    const R = bBlock(g, p[0], p[1], p[2], p[3], o, r, M, pat, hh);
    if (!main || R.w * R.h > main.w * main.h) main = R;
  });
  // stepped towers
  if ((st === "tower" || o.cyber || ht > 90) && main.w > 50 && main.h > 50) {
    const tiers = ht > 120 ? 2 : 1;
    let R = main;
    for (let t = 0; t < tiers; t++) {
      const m = Math.min(R.w, R.h) * 0.16;
      const nx = R.x + m,
        ny = R.y + m,
        nw = R.w - 2 * m,
        nh = R.h - 2 * m;
      if (nw < 24 || nh < 24) break;
      bShadow(g, nx, ny, nw, nh, 10);
      const c = shade(M.c[0], 1.12 + t * 0.08);
      g.fillStyle = c;
      g.fillRect(nx, ny, nw, nh);
      g.strokeStyle = shade(M.c[0], 0.6);
      g.strokeRect(nx + 0.5, ny + 0.5, nw - 1, nh - 1);
      R = { x: nx, y: ny, w: nw, h: nh };
    }
    main = R;
    if (main.w > 40 && o.seed % 5 === 0) {
      const cx = main.x + main.w / 2,
        cy = main.y + main.h / 2,
        rr = Math.min(main.w, main.h) * 0.36;
      g.fillStyle = "#3a3f47";
      g.beginPath();
      g.arc(cx, cy, rr, 0, 7);
      g.fill();
      g.strokeStyle = "#f1c40f";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, rr - 3, 0, 7);
      g.stroke();
      g.fillStyle = "#fff";
      g.font = "bold " + Math.round(rr) + "px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("H", cx, cy + 1);
      g.lineWidth = 1;
      return;
    }
  } // rare helipad
  bFurniture(g, main, o, r, M);
  // v51: no neon trim on cyber buildings (James: outlines removed)
  if (st === "shop") {
    const f = Math.min(o.h * 0.3, 10),
      aw = ["#c0392b", "#27ae60", "#2e86c1", "#e67e22", "#8e44ad"][(r() * 5) | 0];
    for (let k = 0; k < o.w; k += 8) {
      g.fillStyle = (k / 8) % 2 ? aw : "#f4f1ea";
      g.fillRect(o.x + k, o.y + o.h - 2, Math.min(8, o.w - k), 7);
    }
  }
} // striped awning over pavement

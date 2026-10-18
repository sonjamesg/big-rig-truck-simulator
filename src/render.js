/**
 * @file render.js — TEXTURES & CHUNK RENDERING (RD_NOCENTRE: road types drawn without a centre line)
 * Exposes (globals): mkCanvas, speckle, TEX, makeTextures, drawRoadTile, shade, LINE_COLS,
 *   contTop, drawYardBlock, drawLorryPark, drawShadowRect, acUnit, roof, drawSign (+32 more)
 * Depends on: world.js, bldg2.js, lorry.js, traffic.js, markings.js, depots.js, sites.js,
 *   career.js, mp.js, rail.js, main.js, rbx.js
 * Load order: #3 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// road types drawn without a white centre line (the road audit reports these as unmarked); v48: none
const RD_NOCENTRE = new Set();
// ===================== TEXTURES & CHUNK RENDERING =====================
function mkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function speckle(ctx, w, h, cols, n, rnd, size = 1) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[(rnd() * cols.length) | 0];
    ctx.fillRect((rnd() * w) | 0, (rnd() * h) | 0, size, size);
  }
}
const TEX = {};
function makeTextures() {
  const V = 4;
  function variants(name, fn) {
    TEX[name] = [];
    for (let v = 0; v < V; v++) {
      const c = mkCanvas(TILE, TILE),
        g = c.getContext("2d");
      fn(g, mulberry(name.length * 97 + v * 13 + 1));
      TEX[name].push(c);
    }
  }
  // v13 natural grass: muted base, fine blade strokes in several greens, a few dry straws (seamless: strokes wrap)
  function blades(g, r, n, cols, len) {
    for (let i = 0; i < n; i++) {
      const x = r() * 32,
        y = r() * 32,
        a = -1.9 + r() * 0.8,
        l = len * (0.5 + r());
      g.strokeStyle = cols[(r() * cols.length) | 0];
      g.beginPath();
      for (const [ox, oy] of [
        [0, 0],
        [32, 0],
        [0, 32],
        [-32, 0],
        [0, -32],
      ]) {
        if (ox && x + Math.cos(a) * l < 32 && x + Math.cos(a) * l > 0 && ox) continue;
        if (oy && y + Math.sin(a) * l < 32 && y + Math.sin(a) * l > 0) continue;
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      }
      g.stroke();
    }
  }
  variants("grass", (g, r) => {
    g.fillStyle = "#5b8a3c";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#55823a", "#61903f", "#507a35", "#5e8c40"], 220, r, 2);
    g.lineWidth = 1;
    blades(
      g,
      r,
      90,
      [
        "rgba(40,70,28,0.55)",
        "rgba(110,150,70,0.45)",
        "rgba(80,120,50,0.5)",
        "rgba(130,160,80,0.35)",
      ],
      3,
    );
    blades(g, r, 6, ["rgba(190,180,110,0.45)"], 3);
    speckle(g, 32, 32, ["rgba(30,55,22,0.5)"], 30, r);
  });
  variants("pgrass", (g, r) => {
    g.fillStyle = "#629a42";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#5d9440", "#68a046", "#5a8f3d"], 200, r, 2);
    g.lineWidth = 1;
    blades(g, r, 80, ["rgba(50,85,32,0.45)", "rgba(120,165,80,0.4)", "rgba(90,135,58,0.45)"], 2.2);
    speckle(g, 32, 32, ["rgba(35,65,25,0.4)"], 24, r);
  });
  variants("asph", (g, r) => {
    g.fillStyle = "#3d4047";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#474a52", "#35383e", "#50535b", "#2f3237"], 170, r);
    if (r() < 0.25) {
      g.strokeStyle = "rgba(20,20,24,0.5)";
      g.beginPath();
      g.moveTo(r() * 32, r() * 32);
      g.lineTo(r() * 32, r() * 32);
      g.stroke();
    }
  });
  variants("walk", (g, r) => {
    g.fillStyle = "#b9b6ae";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#c4c1b9", "#aeaba3"], 80, r);
    g.fillStyle = "#9d9a92";
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 16, 32, 1);
    g.fillRect(0, 0, 1, 32);
    g.fillRect(16, 0, 1, 32);
  });
  variants("conc", (g, r) => {
    g.fillStyle = "#a3a39c";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#adada6", "#97978f", "#8f8f88"], 110, r);
    g.fillStyle = "#86867e";
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    if (r() < 0.3) {
      g.fillStyle = "rgba(60,50,40,0.18)";
      g.beginPath();
      g.ellipse(r() * 32, r() * 32, 6, 4, 0, 0, 7);
      g.fill();
    }
  });
  variants("plaza", (g, r) => {
    g.fillStyle = "#c9bfae";
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8)
      for (let x = 0; x < 32; x += 8) {
        g.fillStyle = ["#cfc5b4", "#c2b8a6", "#d6ccbb"][(r() * 3) | 0];
        g.fillRect(x + ((y / 8) % 2 ? 4 : 0), y, 7, 7);
      }
  });
  variants("gravel", (g, r) => {
    g.fillStyle = "#8f8068";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#a08f74", "#7c6e58", "#b3a283", "#6a5e4b"], 260, r);
  });
  variants("sand", (g, r) => {
    g.fillStyle = "#d8c98f";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#e3d59c", "#cbbb80", "#bfae72"], 120, r);
  });
  variants("quay", (g, r) => {
    g.fillStyle = "#8d9196";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#979ba0", "#83878c", "#7a7e83"], 120, r);
    g.fillStyle = "#777b80";
    g.fillRect(0, 31, 32, 1);
    g.fillRect(31, 0, 1, 32);
  });
  variants("field", (g, r) => {
    g.fillStyle = "#7a6a3f";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#86754a", "#6d5e36"], 120, r);
  });
  variants("island", (g, r) => {
    g.fillStyle = "#629a42";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#5d9440", "#68a046", "#5a8f3d"], 200, r, 2);
    g.lineWidth = 1;
    blades(g, r, 70, ["rgba(50,85,32,0.45)", "rgba(120,165,80,0.4)"], 2.2);
  });
  variants("rock", (g, r) => {
    g.fillStyle = "#8e8b84";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#9a978f", "#827f78", "#a6a39b", "#76736c"], 200, r);
    if (r() < 0.4) {
      g.strokeStyle = "rgba(60,58,54,0.4)";
      g.beginPath();
      g.moveTo(r() * 32, r() * 32);
      g.lineTo(r() * 32, r() * 32);
      g.stroke();
    }
  });
  variants("water", (g, r) => {
    g.fillStyle = "#2f6fb3";
    g.fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, ["#3579bf", "#2a66a6", "#3a82c8"], 90, r, 2);
    g.strokeStyle = "rgba(170,215,255,0.35)";
    for (let i = 0; i < 2; i++) {
      const x = r() * 24,
        y = r() * 30;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 4, y - 2, x + 8, y);
      g.stroke();
    }
  });
}
// ---- road markings per tile
function drawRoadTile(g, tx, ty, px, py) {
  const i = idx(tx, ty),
    h = world.roadH[i],
    v = world.roadV[i];
  g.drawImage(TEX.asph[(hash2(tx, ty) * 4) | 0], px, py);
  const hs = h >= 0 ? world.segs[h] : null,
    vs = v >= 0 ? world.segs[v] : null;
  if ((hs && vs) || (!hs && !vs) || (world.jMask && world.jMask[idx(tx, ty)])) return; // junction / kerb corner: plain asphalt
  const s = hs || vs;
  const horiz = !!hs;
  const off = horiz ? ty - s.a : tx - s.a; // lane index across the road
  const along = horiz ? tx : ty;
  // crosswalk if adjacent along-road tile is a junction
  const n1 = horiz ? [tx - 1, ty] : [tx, ty - 1],
    n2 = horiz ? [tx + 1, ty] : [tx, ty + 1];
  const jn = (p) =>
    inb(p[0], p[1]) && world.roadH[idx(p[0], p[1])] >= 0 && world.roadV[idx(p[0], p[1])] >= 0;
  if ((s.type === "city" || s.type === "town" || s.type === "res") && (jn(n1) || jn(n2))) {
    g.fillStyle = "#e8e8e2";
    for (let k = 3; k < 32; k += 8) {
      if (horiz) g.fillRect(px + 6, py + k, 20, 4);
      else g.fillRect(px + k, py + 6, 4, 20);
    }
    return;
  }
  const line = (pos, col, dashed, w) => {
    g.fillStyle = col; // pos = offset across tile (0..32)
    for (let a = 0; a < 32; a++) {
      const wa = along * 32 + a;
      if (dashed && wa % 48 >= 24) continue;
      if (horiz) g.fillRect(px + a, py + pos, 1, w);
      else g.fillRect(px + pos, py + a, w, 1);
    }
  };
  const half = s.w / 2;
  if (s.type === "lane") {
    if (off === 0) line(1, "rgba(120,110,90,0.5)", false, 3);
    if (off === s.w - 1) line(28, "rgba(120,110,90,0.5)", false, 3);
    if (!RD_NOCENTRE.has("lane") && off === half - 1) line(30, "#e4e4dc", true, 2); // v48: lanes get a centre line too
    return;
  }
  if (s.type === "dual") {
    g.fillStyle = "#8f9188";
    if (off === half - 1) {
      if (horiz) g.fillRect(px, py + 25, 32, 7);
      else g.fillRect(px + 25, py, 7, 32);
      g.fillStyle = "#6a8f45";
      if (horiz) g.fillRect(px, py + 27, 32, 5);
      else g.fillRect(px + 27, py, 5, 32);
    }
    if (off === half) {
      g.fillStyle = "#8f9188";
      if (horiz) g.fillRect(px, py, 32, 7);
      else g.fillRect(px, py, 7, 32);
      g.fillStyle = "#6a8f45";
      if (horiz) g.fillRect(px, py, 32, 5);
      else g.fillRect(px, py, 5, 32);
    }
  }
  if (s.type === "hwy") {
    if (off === half - 1) line(29, "#f2c230", false, 2);
    if (off === half) line(1, "#f2c230", false, 2);
  } else if (s.type !== "dual") {
    if (off === half - 1) line(30, "#ececec", true, 2);
  } // UK-style white centre line
  if (off === 0) line(3, "#ececec", false, 2); // edge lines
  if (off === s.w - 1) line(27, "#ececec", false, 2);
  if (off > 0 && off < s.w && off !== half) line(0, "#ececec", true, 2); // lane dividers at tile boundary
}
// ---- objects
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  const m = (v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

// v40 shipping-line palette (muted) + true-scale container top: ribs, end frames, door gear
const LINE_COLS = [
  "#3f8fbf",
  "#3f8fbf",
  "#d6ae3c",
  "#d6ae3c",
  "#24407a",
  "#3d7449",
  "#3d7449",
  "#c9733a",
  "#8c9095",
  "#8c9095",
  "#dcdedc",
  "#dcdedc",
  "#7a4f35",
  "#5d6f80",
];
function contTop(g, x, y, L, W, col, door) {
  g.fillStyle = col;
  g.fillRect(x, y, L, W);
  g.fillStyle = shade(col, 0.82);
  for (let k = x + 4; k < x + L - 3; k += 3) g.fillRect(k, y + 1, 1, W - 2);
  g.fillStyle = shade(col, 0.58);
  g.fillRect(x, y, 2.5, W);
  g.fillRect(x + L - 2.5, y, 2.5, W);
  g.fillStyle = shade(col, 1.22);
  g.fillRect(x + 2.5, y, L - 5, 1);
  g.fillStyle = shade(col, 0.45);
  g.fillRect(x, y + W - 1, L, 1);
  if (door) {
    g.fillStyle = shade(col, 1.35);
    const dx = door > 0 ? x + L - 2 : x + 1;
    g.fillRect(dx, y + W * 0.3, 1, W * 0.12);
    g.fillRect(dx, y + W * 0.6, 1, W * 0.12);
  }
}
function drawYardBlock(g, o) {
  const r = mulberry(o.seed),
    BAY = 97.6,
    RWd = o.sh / 6,
    nb = Math.floor(o.w / BAY);
  g.fillStyle = "rgba(255,255,255,0.35)";
  for (let b = 0; b <= nb; b++) g.fillRect(o.x + b * BAY, o.y, 1.5, o.sh);
  for (let q = 0; q <= 6; q++) g.fillRect(o.x, o.y + q * RWd - 0.75, nb * BAY, 1.5);
  const cells = [];
  for (let b = 0; b < nb; b++) {
    if (o.reefer && b % 3 === 2) continue;
    for (let q = 0; q < 6; q++) {
      const t = o.empty
        ? 3 + ((r() * 4) | 0)
        : o.reefer
          ? 1 + ((r() * 3) | 0)
          : r() < 0.12
            ? 0
            : 1 + ((r() * 4) | 0);
      if (!t) continue;
      const pal = o.reefer
        ? ["#e6e9ea", "#dde1e3", "#d2d7da"]
        : o.empty
          ? ["#8c9095", "#9a9c98", "#7a4f35", "#5d6f80", "#a9aba6", "#3f8fbf"]
          : LINE_COLS;
      const two = !o.reefer && r() < 0.25;
      cells.push({
        b,
        q,
        t,
        two,
        c1: pal[(r() * pal.length) | 0],
        c2: pal[(r() * pal.length) | 0],
      });
    }
  }
  for (const c of cells) {
    const x = o.x + c.b * BAY + 2,
      y = o.y + c.q * RWd + 1,
      d = 2 + c.t * 2.2;
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(x + d, y + d, BAY - 4, RWd - 2);
  }
  for (const c of cells) {
    const x = o.x + c.b * BAY + 2,
      y = o.y + c.q * RWd + 1,
      f = 0.86 + c.t * 0.06,
      W = RWd - 2.5;
    if (c.two) {
      contTop(g, x, y, BAY / 2 - 3, W, c.c1, 1);
      contTop(g, x + BAY / 2 - 1, y, BAY / 2 - 3, W, c.c2, -1);
    } else {
      contTop(g, x, y, BAY - 4, W, c.c1, 1);
      if (o.reefer) {
        g.fillStyle = "#4a6b7d";
        g.fillRect(x + BAY - 10, y + 2, 5, W - 4);
        g.fillStyle = "#9fb8c4";
        g.fillRect(x + BAY - 9, y + 4, 3, 2);
      }
    }
    if (c.t >= 4) {
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(x, y, BAY - 4, W);
    }
  }
  if (o.reefer)
    for (let b = 2; b < nb; b += 3) {
      const x = o.x + b * BAY;
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(x + 16, o.y + 10, BAY - 10, o.sh);
      g.fillStyle = "#6d7378";
      g.fillRect(x + 8, o.y, BAY - 16, o.sh);
      g.fillStyle = "#4b5055";
      for (let q = 0; q < 6; q++) g.fillRect(x + 12, o.y + q * RWd + 4, BAY - 24, RWd - 8);
      g.fillStyle = "#f2c230";
      g.fillRect(x + 8, o.y, 2, o.sh);
      g.fillRect(x + BAY - 10, o.y, 2, o.sh);
      g.fillStyle = "#1d2124";
      for (let q = 0; q < 6; q++) {
        g.fillRect(x + 4, o.y + q * RWd + RWd / 2 - 1, 6, 2);
        g.fillRect(x + BAY - 10, o.y + q * RWd + RWd / 2 - 1, 6, 2);
      }
    }
  const ly = o.y + o.sh;
  g.fillStyle = "rgba(242,194,48,0.85)";
  for (let k = o.x; k < o.x + nb * BAY; k += 22) g.fillRect(k, ly + 2, 12, 3);
  g.fillRect(o.x, ly + TILE * 2 - 4, nb * BAY, 2);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "bold 15px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let b = 0; b < nb; b++)
    g.fillText(o.id + String(b + 1).padStart(2, "0"), o.x + b * BAY + BAY / 2, ly + TILE * 1.05);
  if (o.reefer || o.empty) {
    g.font = "bold 20px sans-serif";
    g.textAlign = "left";
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.fillText(o.reefer ? "REEFER \u26A1" : "EMPTIES", o.x + nb * BAY + 6, o.y + o.sh / 2);
  }
}
function drawLorryPark(g, o) {
  g.fillStyle = "#55585c";
  g.fillRect(o.x, o.y, o.w, o.h);
  const D = 4.5 * TILE;
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 2;
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.font = "bold 12px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  let n = 1;
  for (const [y0, dir] of [
    [o.y + TILE * 0.5, 1],
    [o.y + o.h - TILE * 0.5 - D, -1],
  ]) {
    for (let x = o.x + TILE; x <= o.x + o.w - TILE * 1.5; x += TILE * 1.1) {
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y0 + D);
      g.stroke();
      if (x + TILE * 1.1 <= o.x + o.w - TILE * 1.5)
        g.fillText(String(n++), x + TILE * 0.55, dir > 0 ? y0 + 12 : y0 + D - 12);
    }
  }
  g.fillStyle = "rgba(242,194,48,0.9)";
  for (let x = o.x + TILE; x < o.x + o.w - TILE; x += 30) g.fillRect(x, o.y + o.h / 2 - 1.5, 16, 3);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "bold 26px sans-serif";
  g.fillText("HGV LORRY PARK", o.x + o.w / 2, o.y + o.h / 2 - 24);
}
function drawShadowRect(g, x, y, w, h, s) {
  g.fillStyle = "rgba(10,15,25,0.33)";
  g.beginPath();
  g.moveTo(x + w, y);
  g.lineTo(x + w + s, y + s);
  g.lineTo(x + w + s, y + h + s);
  g.lineTo(x + s, y + h + s);
  g.lineTo(x, y + h);
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fill();
}
function acUnit(g, x, y, r) {
  g.fillStyle = "#d6d8dc";
  g.fillRect(x, y, 14, 12);
  g.fillStyle = "#9ea2a8";
  g.fillRect(x, y + 11, 14, 1);
  g.fillRect(x + 13, y, 1, 12);
  g.fillStyle = "#55595f";
  g.beginPath();
  g.arc(x + 7, y + 6, 4, 0, 7);
  g.fill();
  g.strokeStyle = "#888";
  g.beginPath();
  g.moveTo(x + 3, y + 6);
  g.lineTo(x + 11, y + 6);
  g.moveTo(x + 7, y + 2);
  g.lineTo(x + 7, y + 10);
  g.stroke();
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(x + 14, y + 2, 3, 12);
}
function roof(g, o) {
  if (ROOF2[o.style]) return roof2(g, o);
  const r = mulberry(o.seed),
    x = o.x,
    y = o.y,
    w = o.w,
    h = o.h,
    st = o.style;
  const pal = {
    office: ["#9aa3ad", "#7f8893"],
    glass: ["#5b88a8", "#3f6a8a"],
    gravel: ["#8f8a80", "#7a756c"],
    tower: ["#b8b4ac", "#8f8b84"],
    brick: ["#a0503c", "#7f3b2b"],
    flat: ["#c5c0b5", "#a39e93"],
    green: ["#6f9a5a", "#557a44"],
    warehouse: ["#8c97a3", "#6f7a86"],
    depot: ["#d77c2b", "#a85b1b"],
    shop: ["#d8d2c4", "#b0a99a"],
    house: ["#b5523b", "#8a3a28"],
  }[st] || ["#999", "#777"];
  if (st === "house") {
    const c = ["#b5523b", "#6b6f78", "#8a5a3b", "#3f5f7f", "#a7453a"][(r() * 5) | 0];
    const horiz = w >= h;
    g.fillStyle = shade(c, 1.15);
    g.fillRect(x, y, w, h);
    g.fillStyle = shade(c, 0.78);
    if (horiz) g.fillRect(x, y + h / 2, w, h / 2);
    else g.fillRect(x + w / 2, y, w / 2, h);
    g.strokeStyle = "rgba(0,0,0,0.18)";
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
    g.fillStyle = shade(c, 0.6);
    if (horiz) g.fillRect(x, y + h / 2 - 1, w, 2);
    else g.fillRect(x + w / 2 - 1, y, 2, h);
    g.fillStyle = "#777";
    g.fillRect(x + w * 0.7, y + h * 0.2, 6, 6);
    g.strokeStyle = shade(c, 0.5);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    return;
  }
  if (st === "barn") {
    g.fillStyle = "#9c2f22";
    g.fillRect(x, y, w, h);
    g.fillStyle = "#7d2419";
    g.fillRect(x, y + h / 2, w, h / 2);
    g.strokeStyle = "rgba(0,0,0,0.25)";
    for (let k = 3; k < w; k += 5) {
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + k, y + h);
      g.stroke();
    }
    g.fillStyle = "#5a1a12";
    g.fillRect(x, y + h / 2 - 1, w, 2);
    return;
  }
  if (st === "church") {
    g.fillStyle = "#8a8f96";
    g.fillRect(x, y, w, h);
    const cw = w * 0.32,
      ch = h * 0.32;
    g.fillStyle = "#6d5d4b";
    g.fillRect(x + w / 2 - cw / 2, y, cw, h);
    g.fillRect(x, y + h * 0.3, w, ch);
    g.fillStyle = "#57493b";
    g.fillRect(x + w / 2 - 1, y, 2, h);
    g.fillRect(x, y + h * 0.3 + ch / 2 - 1, w, 2);
    g.fillStyle = "#4a4f57";
    g.beginPath();
    g.arc(x + w / 2, y + h * 0.12, cw * 0.45, 0, 7);
    g.fill();
    g.fillStyle = "#d4ac0d";
    g.fillRect(x + w / 2 - 1, y + h * 0.12 - 8, 2, 16);
    g.fillRect(x + w / 2 - 6, y + h * 0.12 - 3, 12, 2);
    return;
  }
  if (st === "stadium") {
    const cx = x + w / 2,
      cy = y + h / 2;
    g.fillStyle = "#9aa0a8";
    g.beginPath();
    g.ellipse(cx, cy, w / 2, h / 2, 0, 0, 7);
    g.fill();
    for (let k = 0; k < 5; k++) {
      g.strokeStyle = k % 2 ? "#c0392b" : "#2e5c9a";
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(cx, cy, w / 2 - 8 - k * 7, h / 2 - 8 - k * 7, 0, 0, 7);
      g.stroke();
    }
    g.lineWidth = 1;
    g.fillStyle = "#3f9b3a";
    g.fillRect(cx - w * 0.28, cy - h * 0.2, w * 0.56, h * 0.4);
    g.fillStyle = "#48a843";
    for (let k = 0; k < 8; k += 2)
      g.fillRect(cx - w * 0.28 + k * w * 0.07, cy - h * 0.2, w * 0.07, h * 0.4);
    g.strokeStyle = "#fff";
    g.lineWidth = 2;
    g.strokeRect(cx - w * 0.28, cy - h * 0.2, w * 0.56, h * 0.4);
    g.beginPath();
    g.moveTo(cx, cy - h * 0.2);
    g.lineTo(cx, cy + h * 0.2);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, h * 0.08, 0, 7);
    g.stroke();
    g.lineWidth = 1;
    return;
  }
  if (st === "carpark") {
    g.fillStyle = "#7f8389";
    g.fillRect(x, y, w, h);
    g.strokeStyle = "#e8e8e2";
    g.lineWidth = 2;
    for (let row = 0; row < 2; row++) {
      const yy = y + 12 + row * (h / 2);
      for (let k = x + 12; k < x + w - 12; k += 22) {
        g.beginPath();
        g.moveTo(k, yy);
        g.lineTo(k, yy + 38);
        g.stroke();
        if (r() < 0.6) {
          g.fillStyle = ["#c0392b", "#ecf0f1", "#2c3e50", "#2980b9", "#f1c40f"][(r() * 5) | 0];
          g.fillRect(k + 4, yy + 3, 14, 32);
          g.fillStyle = "rgba(30,40,60,0.8)";
          g.fillRect(k + 5, yy + 9, 12, 6);
        }
      }
    }
    g.fillStyle = "#f2c230";
    g.fillRect(x + w - 40, y + h / 2 - 14, 30, 28);
    g.fillStyle = "#333";
    g.font = "bold 18px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("P", x + w - 25, y + h / 2);
    g.strokeStyle = "#55595f";
    g.lineWidth = 4;
    g.strokeRect(x + 2, y + 2, w - 4, h - 4);
    g.lineWidth = 1;
    return;
  }
  // base slab + parapet
  g.fillStyle = pal[0];
  g.fillRect(x, y, w, h);
  if (st === "gravel") {
    speckle(g, w, h, [], 0, r);
    for (let i = 0; i < (w * h) / 12; i++) {
      g.fillStyle = ["#9a958a", "#837e74", "#a7a296"][(r() * 3) | 0];
      g.fillRect(x + r() * w, y + r() * h, 2, 2);
    }
  }
  if (st === "glass") {
    g.fillStyle = "rgba(255,255,255,0.12)";
    for (let k = 0; k < w + h; k += 18) {
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + k - h * 0.6, y + h);
      g.lineTo(x + k - h * 0.6 + 7, y + h);
      g.lineTo(x + k + 7, y);
      g.fill();
    }
    g.strokeStyle = "rgba(20,40,60,0.4)";
    for (let k = 16; k < w; k += 16) {
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + k, y + h);
      g.stroke();
    }
  }
  if (st === "green") {
    for (let i = 0; i < (w * h) / 30; i++) {
      g.fillStyle = ["#7fae67", "#5d8749", "#8dbb72"][(r() * 3) | 0];
      g.beginPath();
      g.arc(x + 4 + r() * (w - 8), y + 4 + r() * (h - 8), 2 + r() * 3, 0, 7);
      g.fill();
    }
  }
  if (st === "warehouse" || st === "depot") {
    g.fillStyle = pal[1];
    for (let k = 0; k < w; k += 6) g.fillRect(x + k, y, 2, h);
    g.fillStyle = "rgba(190,225,245,0.75)";
    for (let k = 12; k < w - 12; k += 40) g.fillRect(x + k, y + 8, 10, h - 16);
    if (st === "depot") {
      g.fillStyle = "#fff";
      g.font = "bold 22px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("BIG RIG HAULAGE", x + w / 2, y + h / 2);
    }
    if (o.logo) {
      g.save();
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillRect(x + w / 2 - o.logo.length * 8 - 10, y + h / 2 - 16, o.logo.length * 16 + 20, 32);
      g.fillStyle = "#22324a";
      g.font = "900 22px Arial Black,Arial,sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(o.logo, x + w / 2, y + h / 2 + 1);
      g.restore();
    }
  }
  if (st === "solar") {
    for (let yy = y + 10; yy < y + h - 20; yy += 16)
      for (let xx = x + 10; xx < x + w - 24; xx += 22) {
        g.fillStyle = "#1f3b73";
        g.fillRect(xx, yy, 20, 13);
        g.strokeStyle = "#8fa8d8";
        g.strokeRect(xx + 0.5, yy + 0.5, 19, 12);
        g.beginPath();
        g.moveTo(xx + 10, yy);
        g.lineTo(xx + 10, yy + 13);
        g.stroke();
      }
  }
  if (st === "hospital") {
    g.fillStyle = "#e9ecef";
    g.fillRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle = "#d32f2f";
    const c = Math.min(w, h) * 0.12;
    g.fillRect(x + w / 2 - c / 2, y + h / 2 - c * 1.5, c, c * 3);
    g.fillRect(x + w / 2 - c * 1.5, y + h / 2 - c / 2, c * 3, c);
    g.fillStyle = "#d32f2f";
    g.font = "bold 16px sans-serif";
    g.textAlign = "center";
    g.fillText("CITY HOSPITAL", x + w / 2, y + 18);
  }
  if (st === "supermarket") {
    g.fillStyle = "#e4e6e9";
    g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = "rgba(190,225,245,0.85)";
    for (let k = 20; k < w - 20; k += 48) g.fillRect(x + k, y + 12, 26, h - 24);
  }
  if (st === "shop") {
    g.fillStyle = ["#b9a48a", "#9fa6ad", "#c4b59a", "#a39484"][(r() * 4) | 0];
    g.fillRect(x, y, w, h);
  }
  if (st === "brick") {
    g.fillStyle = pal[1];
    for (let k = 0; k < h; k += 5) g.fillRect(x, y + k, w, 1);
  }
  // parapet
  g.strokeStyle = shade(pal[0], 0.65);
  g.lineWidth = 3;
  g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.lineWidth = 1;
  g.strokeStyle = shade(pal[0], 1.25);
  g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  // roof furniture
  if (st !== "warehouse" && st !== "depot" && st !== "green") {
    const n = Math.max(1, ((w * h) / 4000) | 0) + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const ax = x + 8 + r() * (w - 30),
        ay = y + 8 + r() * (h - 28);
      if (r() < 0.6) acUnit(g, ax, ay);
      else {
        g.fillStyle = "#c8e4f4";
        g.fillRect(ax, ay, 16, 10);
        g.fillStyle = "#7fa7bf";
        g.fillRect(ax, ay + 9, 16, 1);
        g.fillRect(ax + 8, ay, 1, 10);
      }
    }
    if (r() < 0.5 && w > 60 && h > 60) {
      const tx = x + w - 24,
        ty = y + 20;
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.beginPath();
      g.arc(tx + 4, ty + 4, 10, 0, 7);
      g.fill();
      g.fillStyle = "#7a6a5a";
      g.beginPath();
      g.arc(tx, ty, 10, 0, 7);
      g.fill();
      g.strokeStyle = "#5a4a3a";
      g.beginPath();
      g.arc(tx, ty, 6, 0, 7);
      g.stroke();
    }
    if (r() < 0.6) {
      g.fillStyle = "#55585e";
      g.fillRect(x + w * 0.3, y + h * 0.6, 10, 10);
      g.fillStyle = "#3d4045";
      g.fillRect(x + w * 0.3 + 2, y + h * 0.6 + 2, 6, 6);
    }
    if (r() < 0.35 && w > 50) {
      const sx = x + 12 + r() * (w - 40),
        sy = y + h - 26;
      g.fillStyle = "#d9dde2";
      g.beginPath();
      g.ellipse(sx, sy, 8, 6, 0.6, 0, 7);
      g.fill();
      g.strokeStyle = "#777";
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + 6, sy - 5);
      g.stroke();
    }
    if (r() < 0.3 && w > 60 && h > 40) {
      const bx = x + w - 34,
        by = y + h - 30;
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(bx + 4, by + 4, 24, 18);
      g.fillStyle = shade(pal[0], 0.85);
      g.fillRect(bx, by, 24, 18);
      g.fillStyle = "#4a4f57";
      g.fillRect(bx + 6, by + 12, 12, 6);
    }
    if (st === "tower" && r() < 0.6) {
      g.strokeStyle = "#ddd";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + 14, y + 14);
      g.lineTo(x + 14, y + 40);
      g.stroke();
      g.fillStyle = "#e74c3c";
      g.beginPath();
      g.arc(x + 14, y + 14, 3, 0, 7);
      g.fill();
      g.lineWidth = 1;
    }
    if (o.sign && st !== "shop") {
    }
    if (st === "supermarket" || st === "shop") {
      /* signs drawn below */
    }
    if (o.cyber && w > 40 && h > 40) {
      // v18 Kingsbridge downtown: stepped setbacks, window bands, rooftop plant
      const nc = ["#ff2bd6", "#00d8ff", "#b14bff", "#39ff88", "#ffd000"][(r() * 5) | 0],
        tiers = o.height > 110 ? 3 : 2;
      for (let t = 1; t <= tiers; t++) {
        const m = t * Math.min(w, h) * 0.12;
        g.fillStyle = "rgba(0,0,0,0.22)";
        g.fillRect(x + m + 5, y + m + 5, w - 2 * m, h - 2 * m);
        g.fillStyle = shade(pal[0], 1 + t * 0.07);
        g.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
        g.strokeStyle = shade(pal[0], 0.6);
        g.strokeRect(x + m + 0.5, y + m + 0.5, w - 2 * m - 1, h - 2 * m - 1);
      }
      g.fillStyle = "rgba(150,205,240,0.8)";
      for (let k = 6; k < w - 6; k += 7) {
        g.fillRect(x + k, y + 4, 4, 3);
        g.fillRect(x + k, y + h - 7, 4, 3);
      }
      for (let k = 6; k < h - 6; k += 7) {
        g.fillRect(x + 4, y + k, 3, 4);
        g.fillRect(x + w - 7, y + k, 3, 4);
      }
      void nc; // v51: neon trim removed (the colour is still drawn from r() so later details stay the same)
      const m = tiers * Math.min(w, h) * 0.12;
      for (let k = 0; k < 3; k++) acUnit(g, x + m + 6 + k * 18, y + m + 6);
    }
    if (st === "tower" && w > 90) {
      g.strokeStyle = "#e8e8e8";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.22, 0, 7);
      g.stroke();
      g.fillStyle = "#e8e8e8";
      g.font = "bold 30px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("H", x + w / 2, y + h / 2 + 1);
      g.lineWidth = 1;
    }
  }
}
function drawSign(g, o) {
  if (!o.sign) return;
  const big = o.style === "supermarket";
  g.save();
  const fs = big ? 34 : 12;
  g.font = `900 ${fs}px Arial Black,Arial,sans-serif`;
  const tw = g.measureText(o.sign).width;
  let sx = o.x + o.w / 2,
    sy = o.y + (big ? o.h / 2 : 10);
  if (o.front === "s") sy = o.y + o.h - 10;
  if (o.front === "w" || o.front === "e") {
    sy = o.y + o.h / 2;
  }
  g.translate(sx, sy);
  if (o.front === "w") {
    g.translate(-o.w / 2 + 10, 0);
    g.rotate(-Math.PI / 2);
  }
  if (o.front === "e") {
    g.translate(o.w / 2 - 10, 0);
    g.rotate(Math.PI / 2);
  }
  if (tw + 8 > (o.front === "w" || o.front === "e" ? o.h : o.w) - 4 && !big) {
    g.restore();
    return;
  }
  g.fillStyle = big ? "#c0392b" : "rgba(20,24,30,0.85)";
  g.fillRect(-tw / 2 - 5, -fs / 2 - 3, tw + 10, fs + 6);
  g.fillStyle = big ? "#fff" : ["#f5d76e", "#fff", "#7fdcff", "#ff8c8c"][o.seed % 4];
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(o.sign, 0, 1);
  g.restore();
}
// v24 UK roundabout: flared fillet entries/exits, kerbed outline, continuous edge lines, splitter islands with keep-left bollards, give-way lines
function drawRB(g, o) {
  const rb = o.rb,
    X = rb.cx * TILE,
    Y = rb.cy * TILE,
    Ro = rb.rout * TILE,
    S = TILE,
    P = (p) => [p[0] * S, p[1] * S];
  const W = (gm, u, v) => P(rbW(gm, rb, u, v)),
    ang = (p) => Math.atan2(p[1] - rb.cy, p[0] - rb.cx);
  const G2 = rb.arms.map((a) => rbArmGeom(rb, a));
  // asphalt outline as subpaths: ring disc, arm mouths, fillets
  const shape = (withArms, op) => {
    g.beginPath();
    g.arc(X, Y, Ro, 0, Math.PI * 2);
    op();
    for (const gm of G2) {
      if (withArms) {
        const a = W(gm, 0, gm.c - gm.hw),
          b = W(gm, gm.uE + 0.6, gm.c - gm.hw),
          c = W(gm, gm.uE + 0.6, gm.c + gm.hw),
          d = W(gm, 0, gm.c + gm.hw);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.lineTo(c[0], c[1]);
        g.lineTo(d[0], d[1]);
        g.closePath();
        op();
      }
      for (const f of gm.fil) {
        const fc = W(gm, f.uf, f.vf),
          te = W(gm, f.uf, f.e),
          tr = W(gm, f.tr[0], f.tr[1]),
          a0 = Math.atan2(te[1] - fc[1], te[0] - fc[0]),
          a1 = Math.atan2(tr[1] - fc[1], tr[0] - fc[0]);
        const in0 = W(gm, 0, f.e);
        g.beginPath();
        g.moveTo(in0[0], in0[1]);
        g.lineTo(te[0], te[1]);
        let da = a1 - a0;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        g.arc(fc[0], fc[1], f.Rf * S, a0, a0 + da, da < 0);
        g.lineTo(X, Y);
        g.closePath();
        op();
      }
    }
  };
  // kerb + verge shadow first, then tarmac over it: only the outer boundary keeps the kerb
  g.save();
  g.lineJoin = "round";
  g.strokeStyle = "rgba(0,0,0,0.18)";
  g.lineWidth = 14;
  shape(false, () => g.stroke());
  g.strokeStyle = "#b9b6ad";
  g.lineWidth = 7;
  shape(false, () => g.stroke());
  g.fillStyle = g.createPattern(TEX.asph[2], "repeat");
  shape(true, () => g.fill());
  g.restore();
  // continuous edge line: ring arcs between arms + fillet arcs (offset 0.18 tiles inside the kerb)
  const off = 0.2;
  g.strokeStyle = "#ececec";
  g.lineWidth = 3;
  g.lineCap = "butt";
  const ends = [];
  for (const gm of G2)
    for (const f of gm.fil) {
      const tr = rbW(gm, rb, f.tr[0], f.tr[1]);
      ends.push({ a: ang(tr), gm, f });
    }
  ends.sort((p, q) => p.a - q.a);
  // ring arcs: from each fillet's ring tangent to the next tangent clockwise, skipping arm mouths (pairs belonging to the same arm across its mouth)
  for (let i = 0; i < ends.length; i++) {
    const A = ends[i],
      B = ends[(i + 1) % ends.length];
    let da = B.a - A.a;
    if (da <= 0) da += Math.PI * 2;
    if (A.gm === B.gm && da < Math.PI) continue;
    g.beginPath();
    g.arc(X, Y, (rb.rout - off) * S, A.a, A.a + da);
    g.stroke();
  }
  for (const gm of G2)
    for (const f of gm.fil) {
      const fc = W(gm, f.uf, f.vf),
        te = W(gm, f.uf, f.e),
        tr = W(gm, f.tr[0], f.tr[1]),
        a0 = Math.atan2(te[1] - fc[1], te[0] - fc[0]),
        a1 = Math.atan2(tr[1] - fc[1], tr[0] - fc[0]);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      g.beginPath();
      g.arc(fc[0], fc[1], (f.Rf + off) * S, a0, a0 + da, da < 0);
      const e2 = W(gm, gm.uE + 0.6, f.e - f.sd * off),
        e1 = W(gm, f.uf, f.e - f.sd * off);
      g.moveTo(e1[0], e1[1]);
      g.lineTo(e2[0], e2[1]);
      g.stroke();
    }
  // inner edge line round the central island + lane divider on the circulatory carriageway
  g.beginPath();
  g.arc(X, Y, (rb.rin + off) * S, 0, Math.PI * 2);
  g.stroke();
  if (typeof rbLaneLines === "function") rbLaneLines(g, rb, G2, X, Y, S);
  else {
    g.lineWidth = 2;
    g.setLineDash([16, 16]);
    g.beginPath();
    g.arc(X, Y, ((rb.rin + rb.rout) / 2) * S, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }
  // central island: kerb, verge, trees
  g.fillStyle = "#8a877f";
  g.beginPath();
  g.arc(X, Y, rb.rin * S, 0, 7);
  g.fill();
  g.fillStyle = g.createPattern(TEX.island[0], "repeat");
  g.beginPath();
  g.arc(X, Y, rb.rin * S - 5, 0, 7);
  g.fill();
  if (typeof rbIsland === "function") rbIsland(g, rb, X, Y, S, o.seed);
  // v51: clean central island (no random trees)
  for (let k = 0; k < rb.arms.length; k++) {
    const arm = rb.arms[k],
      gm = G2[k],
      sp = rbSplitter(rb, arm);
    // give-way: double dashed line across the entry mouth along the ring edge (entry side, v>c), triangle just behind it
    const f = gm.fil.find((q) => q.sd > 0),
      ve = f.e - 0.15,
      aT = ang(rbW(gm, rb, Math.sqrt(Math.max(0, (rb.rout + 0.3) ** 2 - ve * ve)), ve));
    const vb = sp ? sp.baseV[0] : gm.c,
      aS = ang(rbW(gm, rb, Math.sqrt(Math.max(0, rb.rout * rb.rout - vb * vb)), vb));
    let a0 = aS,
      a1 = aT;
    if (((a1 - a0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI < 0) {
      const t = a0;
      a0 = a1;
      a1 = t;
    }
    let da = a1 - a0;
    while (da < 0) da += Math.PI * 2;
    g.strokeStyle = "#ececec";
    // v51: give-way double dashes at every entry, signalised or not
    g.lineWidth = 4;
    g.setLineDash([12, 9]);
    for (const rr of [rb.rout + 0.12, rb.rout + 0.42]) {
      g.beginPath();
      g.arc(X, Y, rr * S, a0 + 0.02, a0 + da - 0.02);
      g.stroke();
    }
    g.setLineDash([]);

    const tri = W(gm, rb.rout + 2.4, (vb + gm.c + gm.hw + 1.2) / 2);
    g.save();
    g.translate(tri[0], tri[1]);
    g.rotate(Math.atan2(gm.o[1], gm.o[0]) + Math.PI / 2);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-11, -26);
    g.lineTo(11, -26);
    g.lineTo(0, 26);
    g.closePath();
    g.stroke();
    g.restore();
    if (!sp) continue;
    // v51: the old triangular island is now paint only: white outline + diagonal hatching (keep off), no grass
    if (sp.full) {
      const fp = sp.full.poly.map(P),
        fpath = () => {
          g.beginPath();
          g.moveTo(fp[0][0], fp[0][1]);
          for (const q of fp) g.lineTo(q[0], q[1]);
          g.closePath();
        };
      g.save();
      fpath();
      g.clip();
      g.strokeStyle = "rgba(236,236,236,0.8)";
      g.lineWidth = 2.5;
      const cx = fp.reduce((t, q) => t + q[0], 0) / fp.length,
        cy = fp.reduce((t, q) => t + q[1], 0) / fp.length,
        oa = Math.atan2(gm.o[1], gm.o[0]) + 0.75,
        ca = Math.cos(oa),
        sa = Math.sin(oa);
      for (let k = -13; k <= 13; k++) {
        const ox = -sa * k * 18,
          oy = ca * k * 18;
        g.beginPath();
        g.moveTo(cx + ox - ca * 400, cy + oy - sa * 400);
        g.lineTo(cx + ox + ca * 400, cy + oy + sa * 400);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = "#ececec";
      g.lineWidth = 3;
      g.lineJoin = "round";
      fpath();
      g.stroke();
    }
    // painted hatched nose ahead of the raised median
    const n0 = W(gm, sp.uN, gm.c),
      n1 = W(gm, gm.uE + RB_BACK + 2.5, gm.c),
      nl = W(gm, sp.uN, gm.c + 0.12),
      nr = W(gm, sp.uN, gm.c - 0.12);
    g.fillStyle = "#ececec";
    g.beginPath();
    g.moveTo(nl[0], nl[1]);
    g.lineTo(n1[0], n1[1]);
    g.lineTo(nr[0], nr[1]);
    g.closePath();
    g.fill();
    // narrow raised kerb median: shadow, concrete top, kerb edge, keep-left bollard at the nose
    const pp = sp.poly.map(P);
    const path = () => {
      g.beginPath();
      g.moveTo(pp[0][0], pp[0][1]);
      for (const q of pp) g.lineTo(q[0], q[1]);
      g.closePath();
    };
    g.save();
    g.translate(2, 2);
    path();
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fill();
    g.restore();
    path();
    g.fillStyle = "#d4d1c8";
    g.fill();
    g.lineJoin = "round";
    g.strokeStyle = "#8e8b84";
    g.lineWidth = 1.6;
    g.stroke();
    const bol = (p) => {
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.beginPath();
      g.arc(p[0] + 2, p[1] + 2, 4.5, 0, 7);
      g.fill();
      g.fillStyle = "#f4f4f4";
      g.beginPath();
      g.arc(p[0], p[1], 4.5, 0, 7);
      g.fill();
      g.fillStyle = "#1d5fbf";
      g.beginPath();
      g.arc(p[0], p[1], 3.2, 0, 7);
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 1.2;
      g.beginPath();
      const dx = -gm.o[0] * 2,
        dy = -gm.o[1] * 2,
        lx = gm.l[0] * 2,
        ly = gm.l[1] * 2;
      g.moveTo(p[0] - dx - lx, p[1] - dy - ly);
      g.lineTo(p[0] + dx + lx, p[1] + dy + ly);
      g.stroke();
    };
    bol(W(gm, sp.uN - 0.3, gm.c));
  }
  g.lineWidth = 1;
}
function drawObject(g, o) {
  if (OBJX[o.kind]) return OBJX[o.kind](g, o);
  switch (o.kind) {
    case "bldg":
      if (ROOF2[o.style]) {
      } else if (o.style !== "stadium") drawShadowRect(g, o.x, o.y, o.w, o.h, o.height * 0.55);
      else {
        g.fillStyle = "rgba(10,15,25,0.3)";
        g.beginPath();
        g.ellipse(o.x + o.w / 2 + 14, o.y + o.h / 2 + 14, o.w / 2, o.h / 2, 0, 0, 7);
        g.fill();
      }
      roof(g, o);
      drawSign(g, o);
      break;
    case "awning": {
      const b = o.b,
        s = b.front,
        c = b.awning;
      const L = s === "n" || s === "s" ? b.w : b.h;
      g.save();
      if (s === "n") {
        g.translate(b.x, b.y - 14);
      } else if (s === "s") {
        g.translate(b.x, b.y + b.h);
      } else if (s === "w") {
        g.translate(b.x - 14, b.y);
      } else {
        g.translate(b.x + b.w, b.y);
      }
      const hor = s === "n" || s === "s";
      for (let k = 0; k < L; k += 8) {
        g.fillStyle = (k / 8) % 2 ? "#f4f4f4" : c;
        if (hor) g.fillRect(k, 0, 8, 14);
        else g.fillRect(0, k, 14, 8);
      }
      g.fillStyle = "rgba(0,0,0,0.25)";
      if (hor) g.fillRect(0, s === "n" ? 14 : 0, L, 2);
      else g.fillRect(s === "w" ? 14 : 0, 0, 2, L);
      g.restore();
      break;
    }
    case "drive": {
      const r = mulberry(o.seed);
      g.fillStyle = "#8f8a80";
      g.fillRect(o.x, o.y, 22, 32);
      if (r() < 0.8) {
        const c = ["#c0392b", "#ecf0f1", "#2c3e50", "#2980b9", "#7f8c8d", "#16a085"][(r() * 6) | 0];
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.fillRect(o.x + 6, o.y + 4, 13, 28);
        g.fillStyle = c;
        g.fillRect(o.x + 4, o.y + 2, 13, 28);
        g.fillStyle = "rgba(30,40,60,0.8)";
        g.fillRect(o.x + 5, o.y + 8, 11, 6);
        g.fillRect(o.x + 5, o.y + 22, 11, 4);
      }
      break;
    }
    case "field": {
      const r = mulberry(o.seed);
      const col = {
        wheat: ["#d9b44a", "#c9a23c"],
        green: ["#6fa83c", "#5d9530"],
        plough: ["#7a5c3a", "#68492b"],
        rape: ["#e6d42a", "#cfbd1f"],
        pasture: ["#7cb24a", "#74a944"],
      }[o.crop];
      g.fillStyle = col[0];
      g.fillRect(o.x, o.y, o.w, o.h);
      if (o.crop === "pasture") {
        for (let k = 0; k < (o.w * o.h) / 900; k++) {
          g.fillStyle = r() < 0.5 ? "#86bd52" : "#6c9e3f";
          g.beginPath();
          g.arc(o.x + r() * o.w, o.y + r() * o.h, 4 + r() * 8, 0, 7);
          g.fill();
        }
        g.fillStyle = "#9aa0a6";
        g.fillRect(o.x + o.w - 30, o.y + 10, 16, 10);
        break;
      }
      g.fillStyle = col[1];
      if (o.vert) {
        for (let k = 0; k < o.w; k += 6) g.fillRect(o.x + k, o.y, 2, o.h);
      } else {
        for (let k = 0; k < o.h; k += 6) g.fillRect(o.x, o.y + k, o.w, 2);
      }
      if (o.crop === "wheat" && r() < 0.5) {
        g.strokeStyle = "rgba(120,90,30,0.35)";
        g.lineWidth = 10;
        g.beginPath();
        g.moveTo(o.x, o.y + o.h * r());
        g.lineTo(o.x + o.w, o.y + o.h * r());
        g.stroke();
        g.lineWidth = 1;
      }
      break;
    }
    case "hedge":
      drawBush(g, { x: o.x, y: o.y, r: 12, seed: o.seed, hedge: 1 });
      break;
    case "bale": {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.beginPath();
      g.arc(o.x + 4, o.y + 4, 9, 0, 7);
      g.fill();
      g.fillStyle = "#d8b55a";
      g.beginPath();
      g.arc(o.x, o.y, 9, 0, 7);
      g.fill();
      g.strokeStyle = "#a8873a";
      g.beginPath();
      g.arc(o.x, o.y, 5, 0, 7);
      g.stroke();
      break;
    }
    case "silo": {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.beginPath();
      g.arc(o.x + 16, o.y + 16, o.r, 0, 7);
      g.fill();
      const gr = g.createRadialGradient(o.x - 8, o.y - 8, 2, o.x, o.y, o.r);
      gr.addColorStop(0, "#f0f0f0");
      gr.addColorStop(1, "#8d9196");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, 7);
      g.fill();
      g.fillStyle = "#666";
      g.beginPath();
      g.arc(o.x, o.y, 4, 0, 7);
      g.fill();
      break;
    }
    case "fountain": {
      const R2 = o.big ? 44 : 22;
      g.fillStyle = "#9aa3ad";
      g.beginPath();
      g.arc(o.x, o.y, R2 + 5, 0, 7);
      g.fill();
      g.fillStyle = "#4a90d9";
      g.beginPath();
      g.arc(o.x, o.y, R2, 0, 7);
      g.fill();
      g.fillStyle = "#c8e6ff";
      g.beginPath();
      g.arc(o.x, o.y, R2 * 0.3, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.6)";
      g.beginPath();
      g.arc(o.x, o.y, R2 * 0.6, 0, 7);
      g.stroke();
      break;
    }
    case "rb":
      drawRB(g, o);
      break;
    case "tree":
      drawTree(g, o);
      break;
    case "lot": {
      // car park: tarmac surface + bay lines matching the parked-car grid in traffic.js initParked (6 m rows, 2.8 m bays)
      g.fillStyle = "#5d6066";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.strokeStyle = "#9a9ca0";
      g.lineWidth = 2;
      g.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
      g.strokeStyle = "#e6e6e0";
      g.lineWidth = Math.max(1.5, PPM * 0.12);
      const vert = o.h > o.w,
        U = vert ? o.w : o.h,
        V = vert ? o.h : o.w,
        A = vert ? o.x : o.y,
        B = vert ? o.y : o.x;
      const seg = (a0, b0, a1, b1) => {
        g.beginPath();
        if (vert) {
          g.moveTo(a0, b0);
          g.lineTo(a1, b1);
        } else {
          g.moveTo(b0, a0);
          g.lineTo(b1, a1);
        }
        g.stroke();
      };
      for (let row = 0; row * 6 + 5.5 <= U / PPM; row++) {
        const r0 = A + row * 6 * PPM + 0.2 * PPM,
          r1 = r0 + 5.2 * PPM;
        seg(row % 2 ? r1 : r0, B + 0.2 * PPM, row % 2 ? r1 : r0, B + V - 0.2 * PPM);
        for (let b = 0.2; b < V / PPM - 0.2; b += 2.8) seg(r0, B + b * PPM, r1, B + b * PPM);
      }
      g.lineWidth = 1;
      break;
    }
    case "kerb": {
      const c = o.c,
        X = c.cx * TILE,
        Y = c.cy * TILE,
        Rr = c.R * TILE;
      g.save();
      g.beginPath();
      g.rect(o.x, o.y, o.w, o.h);
      g.clip();
      // asphalt everywhere outside the kerb circle, paving inside
      g.fillStyle = g.createPattern(TEX.asph[1], "repeat");
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = g.createPattern(TEX.walk[0], "repeat");
      g.beginPath();
      g.arc(X, Y, Rr, 0, 7);
      g.fill();
      g.strokeStyle = "#8a877f";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(X, Y, Rr - 1, 0, 7);
      g.stroke();
      g.lineWidth = 1;
      g.restore();
      break;
    }
    case "pond":
      g.fillStyle = "#d8c98f";
      g.beginPath();
      g.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2 + 4, o.h / 2 + 4, 0, 0, 7);
      g.fill();
      break;
    case "curve":
      drawCurve(g, o.cv);
      break;
    case "taper":
      drawTaper(g, o.tp);
      break;
    case "bush":
      drawBush(g, o);
      break;
    case "appr":
      drawApproach(g, o);
      break;
    case "ldrop":
      drawLaneDrop(g, o);
      break;
    case "fsign":
      drawFuelSign(g, o);
      break;
    case "runway": {
      g.fillStyle = "#3d4045";
      g.fillRect(o.x, o.y, o.w, o.h);
      g.fillStyle = "#ececec";
      for (let k = o.x + 120; k < o.x + o.w - 120; k += 60) g.fillRect(k, o.y + o.h / 2 - 2, 32, 4);
      for (const ex of [o.x + 12, o.x + o.w - 60])
        for (let k = o.y + 10; k < o.y + o.h - 10; k += 14) g.fillRect(ex, k, 48, 7);
      g.font = "bold 40px Arial";
      g.save();
      g.translate(o.x + 90, o.y + o.h / 2);
      g.rotate(Math.PI / 2);
      g.textAlign = "center";
      g.fillText("09", 0, 12);
      g.restore();
      g.save();
      g.translate(o.x + o.w - 90, o.y + o.h / 2);
      g.rotate(-Math.PI / 2);
      g.textAlign = "center";
      g.fillText("27", 0, 12);
      g.restore();
      g.fillStyle = "#f2c230";
      g.fillRect(o.x, o.y, o.w, 2);
      g.fillRect(o.x, o.y + o.h - 2, o.w, 2);
      break;
    }
    case "rock": {
      const r = mulberry(o.seed);
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.beginPath();
      g.ellipse(o.x + o.r * 0.35, o.y + o.r * 0.35, o.r, o.r * 0.75, 0.3, 0, 7);
      g.fill();
      const base = o.desert ? "#a0745a" : "#8a8a84";
      for (let k = 0; k < 3; k++) {
        const ox = (r() - 0.5) * o.r,
          oy = (r() - 0.5) * o.r * 0.6,
          rr = o.r * (0.5 + r() * 0.4);
        const gr = g.createRadialGradient(
          o.x + ox - rr * 0.3,
          o.y + oy - rr * 0.3,
          1,
          o.x + ox,
          o.y + oy,
          rr,
        );
        gr.addColorStop(0, shade(base, 1.25));
        gr.addColorStop(1, shade(base, 0.7));
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(o.x + ox, o.y + oy, rr, rr * 0.8, r() * 3, 0, 7);
        g.fill();
      }
      break;
    }
    case "scrub": {
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.beginPath();
      g.arc(o.x + 3, o.y + 3, o.r, 0, 7);
      g.fill();
      g.fillStyle = "#8a8a4a";
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, 7);
      g.fill();
      g.fillStyle = "#9fa05a";
      g.beginPath();
      g.arc(o.x - 2, o.y - 2, o.r * 0.55, 0, 7);
      g.fill();
      break;
    }
    case "cactus": {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(o.x + 2, o.y - 2, 14, 6);
      g.fillStyle = "#4f7a3a";
      g.beginPath();
      g.arc(o.x, o.y, 5, 0, 7);
      g.fill();
      g.fillRect(o.x - 11, o.y - 2, 22, 4);
      g.fillStyle = "#6d9a4e";
      g.beginPath();
      g.arc(o.x - 1, o.y - 1, 2.5, 0, 7);
      g.fill();
      break;
    }
    case "boxj":
      drawBoxJunction(g, o);
      break;
    case "tbay":
      drawTrailerBay(g, o);
      break;
    case "yard":
      drawYardSign(g, o);
      break;
    case "bay":
      g.fillStyle = "#f2c230";
      for (let k = 0; k < o.w; k += 12) {
        g.fillRect(o.x + k, o.y, 6, o.h);
      }
      break;
    case "paint":
      g.fillStyle = "rgba(240,240,230,0.85)";
      g.font = o.small ? "bold 24px sans-serif" : "bold 40px sans-serif";
      g.textBaseline = "top";
      g.fillText(o.text, o.x, o.y);
      break;
    case "pump":
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(o.x + 10, o.y + 8, 16, 22);
      g.fillStyle = "#e74c3c";
      g.fillRect(o.x + 6, o.y + 4, 16, 22);
      g.fillStyle = "#fff";
      g.fillRect(o.x + 9, o.y + 8, 10, 6);
      break;
    case "pallets": {
      const r = mulberry(o.seed);
      for (let i = 0; i < 3; i++) {
        const x = o.x + r() * 10,
          y = o.y + i * 14;
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(x + 3, y + 3, 22, 12);
        g.fillStyle = "#b8894f";
        g.fillRect(x, y, 22, 12);
        g.fillStyle = "#8a6232";
        g.fillRect(x, y + 5, 22, 2);
      }
      break;
    }
    case "tank": {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.beginPath();
      g.arc(o.x + 14, o.y + 14, o.r, 0, 7);
      g.fill();
      const gr = g.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, 2, o.x, o.y, o.r);
      gr.addColorStop(0, "#f4f4f4");
      gr.addColorStop(1, "#a9adb2");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, 7);
      g.fill();
      g.strokeStyle = "#7d8186";
      g.beginPath();
      g.arc(o.x, o.y, o.r * 0.6, 0, 7);
      g.stroke();
      g.beginPath();
      g.arc(o.x, o.y, o.r - 1, 0, 7);
      g.stroke();
      break;
    }
    case "cont": {
      const r = mulberry(o.seed || 1),
        RWd = o.h / 3,
        L = o.w / 2;
      for (let q = 0; q < 3; q++)
        for (let k = 0; k < 2; k++) {
          const t = 1 + ((r() * 3) | 0);
          g.fillStyle = "rgba(0,0,0,0.3)";
          g.fillRect(o.x + k * L + 1 + t * 2.2, o.y + q * RWd + 1 + t * 2.2, L - 2, RWd - 2);
        }
      for (let q = 0; q < 3; q++)
        for (let k = 0; k < 2; k++)
          contTop(
            g,
            o.x + k * L + 1,
            o.y + q * RWd + 1,
            L - 2,
            RWd - 3,
            LINE_COLS[(r() * LINE_COLS.length) | 0],
            k ? -1 : 1,
          );
      break;
    }
    case "yblk":
      drawYardBlock(g, o);
      break;
    case "lpark":
      drawLorryPark(g, o);
      break;
  }
}
// ---- chunk cache
const chunkCache = new Map();
let chunkOrder = [];
function renderChunk(cx, cy) {
  const c = mkCanvas(CHUNK, CHUNK),
    g = c.getContext("2d");
  const ox = cx * CHUNK,
    oy = cy * CHUNK;
  const N = CHUNK / TILE;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const tx = cx * N + i,
        ty = cy * N + j,
        px = i * TILE,
        py = j * TILE;
      if (!inb(tx, ty)) {
        g.drawImage(TEX.water[0], px, py);
        continue;
      }
      const t = G[idx(tx, ty)],
        v = (hash2(tx, ty) * 4) | 0;
      switch (t) {
        case T.ROAD:
        case T.BRIDGE: {
          const rh = world.roadH[idx(tx, ty)];
          if (rh === -2) {
            const ru = rbUnder(tx, ty);
            g.drawImage(
              t === T.BRIDGE
                ? TEX.water[v]
                : ru === T.SAND
                  ? TEX.sand[v]
                  : ru === T.ROCK
                    ? TEX.rock[v]
                    : TEX.grass[v],
              px,
              py,
            );
          } else if (rh === -3) {
            const u = world.under[idx(tx, ty)];
            g.drawImage(
              u === T.WATER || t === T.BRIDGE
                ? TEX.water[v]
                : u === T.SAND
                  ? TEX.sand[v]
                  : u === T.ROCK
                    ? TEX.rock[v]
                    : u === T.FIELD
                      ? TEX.field[v]
                      : TEX.grass[v],
              px,
              py,
            );
          } else drawRoadTile(g, tx, ty, px, py);
          break;
        }
        case T.ROCK:
          g.drawImage(TEX.rock[v], px, py);
          break;
        case T.WALK:
          g.drawImage(TEX.walk[v], px, py);
          break;
        case T.WATER:
          g.drawImage(TEX.water[v], px, py);
          break;
        case T.PGRASS:
        case T.TREE:
          g.drawImage(
            get(tx, ty) === T.TREE && !isParkNear(tx, ty) ? TEX.grass[v] : TEX.pgrass[v],
            px,
            py,
          );
          break;
        case T.CONC:
        case T.TANK:
        case T.PUMP:
          g.drawImage(TEX.conc[v], px, py);
          break;
        case T.BLDG:
        case T.PLAZA:
          g.drawImage(TEX.plaza[v], px, py);
          break;
        case T.GRAVEL:
          g.drawImage(TEX.gravel[v], px, py);
          break;
        case T.QUAY:
        case T.CONT:
          g.drawImage(TEX.quay[v], px, py);
          break;
        case T.SAND:
          g.drawImage(TEX.sand[v], px, py);
          break;
        case T.LOT:
          g.drawImage(TEX.asph[v], px, py);
          break;
        case T.FIELD:
          g.drawImage(TEX.field[v], px, py);
          break;
        case T.ISLAND:
          g.drawImage(TEX.island[v], px, py);
          break;
        case T.HEDGE:
          g.drawImage(TEX.grass[v], px, py);
          break;
        default:
          g.drawImage(TEX.grass[v], px, py);
      }
      // curbs / shore foam / bridge rails
      if (t === T.WALK) {
        g.fillStyle = "#8a877f";
        if (get(tx, ty + 1) === T.ROAD) g.fillRect(px, py + 30, 32, 2);
        if (get(tx, ty - 1) === T.ROAD) g.fillRect(px, py, 32, 2);
        if (get(tx + 1, ty) === T.ROAD) g.fillRect(px + 30, py, 2, 32);
        if (get(tx - 1, ty) === T.ROAD) g.fillRect(px, py, 2, 32);
      }
      if (t === T.WATER) {
        g.fillStyle = "rgba(220,240,255,0.45)";
        const L = (u) => u !== T.WATER && u !== T.BRIDGE;
        if (L(get(tx, ty - 1))) g.fillRect(px, py, 32, 3);
        if (L(get(tx, ty + 1))) g.fillRect(px, py + 29, 32, 3);
        if (L(get(tx - 1, ty))) g.fillRect(px, py, 3, 32);
        if (L(get(tx + 1, ty))) g.fillRect(px + 29, py, 3, 32);
      }
      if (
        t === T.ROCK ||
        (t === T.ROAD && world.under[idx(tx, ty)] === T.ROCK) ||
        (t === T.TREE && nearHill(tx, ty))
      ) {
        const e = hillElev(tx, ty);
        if (e > 0) {
          const band = Math.floor(e * 7);
          g.fillStyle =
            band % 2
              ? "rgba(255,255,250," + (0.05 + e * 0.22) + ")"
              : "rgba(40,35,30," + (0.12 - e * 0.08) + ")";
          g.fillRect(px, py, 32, 32);
          if (
            Math.floor(hillElev(tx + 1, ty) * 7) !== band ||
            Math.floor(hillElev(tx, ty + 1) * 7) !== band
          ) {
            g.fillStyle = "rgba(70,60,50,0.25)";
            g.fillRect(px, py + 30, 32, 2);
            g.fillRect(px + 30, py, 2, 32);
          }
        }
      }
      if (t === T.BRIDGE && world.roadH[idx(tx, ty)] >= -1) {
        const W = (u) => u === T.WATER;
        g.fillStyle = "#c9ccd1";
        if (W(get(tx, ty - 1))) {
          g.fillRect(px, py, 32, 5);
          g.fillStyle = "#6d7178";
          for (let k = 0; k < 32; k += 8) g.fillRect(px + k, py, 2, 5);
          g.fillStyle = "#c9ccd1";
        }
        if (W(get(tx, ty + 1))) {
          g.fillRect(px, py + 27, 32, 5);
          g.fillStyle = "#6d7178";
          for (let k = 0; k < 32; k += 8) g.fillRect(px + k, py + 27, 2, 5);
          g.fillStyle = "#c9ccd1";
        }
        if (W(get(tx - 1, ty))) {
          g.fillRect(px, py, 5, 32);
          g.fillStyle = "#6d7178";
          for (let k = 0; k < 32; k += 8) g.fillRect(px, py + k, 5, 2);
          g.fillStyle = "#c9ccd1";
        }
        if (W(get(tx + 1, ty))) {
          g.fillRect(px + 27, py, 5, 32);
          g.fillStyle = "#6d7178";
          for (let k = 0; k < 32; k += 8) g.fillRect(px + 27, py + k, 5, 2);
        }
      }
      if (t === T.QUAY && get(tx, ty + 1) === T.WATER) {
        g.fillStyle = "#f2c230";
        for (let k = 0; k < 32; k += 10) g.fillRect(px + k, py + 28, 6, 4);
        g.fillStyle = "#333";
        g.fillRect(px + 14, py + 22, 5, 5);
      }
    }
  grassDetail(g, cx, cy);
  if (typeof railChunk === "function") railChunk(g, ox, oy);
  g.save();
  g.translate(-ox, -oy);
  CUR_CHUNK = [ox, oy, ox + CHUNK, oy + CHUNK];
  const list = world.chunkObjs.get(cx + "," + cy) || [];
  for (const o of list) drawObject(g, o);
  CUR_CHUNK = null;
  g.restore();
  if (typeof railChunk === "function") railChunk(g, ox, oy, true);
  return c;
}
function hillElev(tx, ty) {
  let e = 0;
  for (const h of world.hills) {
    const d = Math.hypot(tx - h.x, ty - h.y);
    if (d < h.r * 1.15) e = Math.max(e, 1 - d / (h.r * 1.1));
  }
  return e;
}
function nearHill(tx, ty) {
  for (const h of world.hills) if (Math.hypot(tx - h.x, ty - h.y) < h.r * 1.1) return true;
  return false;
}
let CUR_CHUNK = null;
function curvePath(g, P, i0, i1, off) {
  g.beginPath();
  for (let i = i0; i <= i1; i++) {
    const a = P[Math.max(0, i - 1)],
      b = P[Math.min(P.length - 1, i + 1)];
    const tx = b[0] - a[0],
      ty = b[1] - a[1],
      l = Math.hypot(tx, ty) || 1;
    const x = P[i][0] - (ty / l) * off,
      y = P[i][1] + (tx / l) * off;
    i === i0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
}
// v13: lane-drop taper — asphalt edge narrows smoothly from the wide road to the narrow one, pavement tapers out, UK merge arrows
function drawTaper(g, tp) {
  const P = tp.pts,
    n = P.length,
    T_ = TILE;
  const nrm = (i) => {
    const a = P[Math.max(0, i - 1)],
      b = P[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0],
      ty = b[1] - a[1],
      l = Math.hypot(tx, ty) || 1;
    return [-ty / l, tx / l];
  };
  const NR = P.map((p, i) => nrm(i)),
    at = (i, off) => [(P[i][0] + NR[i][0] * off) * T_, (P[i][1] + NR[i][1] * off) * T_];
  const band = (f0, f1, sd) => {
    const F0 = (i) => f0(i, sd),
      F1 = (i) => f1(i, sd);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const q = at(i, sd * F0(i));
      i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
    }
    for (let i = n - 1; i >= 0; i--) {
      const q = at(i, sd * F1(i));
      g.lineTo(q[0], q[1]);
    }
    g.closePath();
    g.fill();
  };
  const poly = (f, sd) => {
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const q = at(i, sd * f(i, sd));
      i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
    }
    g.stroke();
  };
  const hw = (i, sd) => tp.hs(tp.s[i], sd);
  g.save();
  g.lineJoin = "round";
  if (tp.urban) {
    const pw = (i, sd) => {
      const u = Math.min(1, tp.s[i] / (tp.L * 0.7));
      return hw(i, sd) + 1.02 * (1 - u * u * (3 - 2 * u));
    };
    g.fillStyle = g.createPattern(TEX.walk[0], "repeat");
    for (const sd of [-1, 1]) band(hw, pw, sd);
    g.strokeStyle = "#8a877f";
    g.lineWidth = 2;
    for (const sd of [-1, 1]) poly((i, sd) => hw(i, sd) + 0.03, sd);
  }
  g.fillStyle = g.createPattern(TEX.asph[1], "repeat");
  const inn = () => tp.wN / 2 - 7 / T_;
  for (const sd of [-1, 1]) band(inn, hw, sd);
  if (tp.wN <= 2 && !tp.urban) {
    g.strokeStyle = "rgba(60,60,55,0.35)";
    g.lineWidth = 2;
    for (const sd of [-1, 1]) poly((i, sd) => hw(i, sd) - 0.02, sd);
  }
  g.strokeStyle = "#ececec";
  g.lineWidth = 2;
  for (const sd of [-1, 1]) poly((i, sd) => hw(i, sd) - 5 / T_, sd);
  // merge arrows in each dropped lane for traffic heading wide -> narrow (UK: drive on the left => negative offset side)
  const d = tp.dW,
    J = P[0],
    nx = -d[1],
    ny = d[0];
  g.strokeStyle = "#ececec";
  g.fillStyle = "#ececec";
  g.lineWidth = 5;
  g.lineCap = "round";
  for (let j = 0; j < tp.drop; j++) {
    const lo = -(tp.wN / 2 + j + 0.5);
    const AK = "arr" + j;
    if (!tp[AK])
      tp[AK] = [18, 9, 1.5].filter((bk) => {
        for (let al = -3; al <= 2.5; al += 0.5) {
          const x = J[0] - d[0] * bk + d[0] * al + nx * lo,
            y = J[1] - d[1] * bk + d[1] * al + ny * lo;
          for (const Jn of world.junctions)
            if (x > Jn.x - 2 && x < Jn.x + Jn.w + 2 && y > Jn.y - 2 && y < Jn.y + Jn.h + 2)
              return false;
          if (bk > 2 && get(Math.floor(x), Math.floor(y)) !== T.ROAD) return false;
        }
        return true;
      });
    for (const back of tp[AK]) {
      const B = (al, lat) => [
        (J[0] - d[0] * back + d[0] * al + nx * lat) * T_,
        (J[1] - d[1] * back + d[1] * al + ny * lat) * T_,
      ];
      const lat = back < 2 ? lo * 0.85 : lo,
        a = B(-2.6, lat),
        b = B(0, lat),
        c = B(2.2, lat + 0.75),
        dx = c[0] - b[0],
        dy = c[1] - b[1],
        l = Math.hypot(dx, dy),
        ux = dx / l,
        uy = dy / l;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.lineTo(c[0] - ux * 8, c[1] - uy * 8);
      g.stroke();
      g.beginPath();
      g.moveTo(c[0] + ux * 4, c[1] + uy * 4);
      g.lineTo(c[0] - ux * 12 - uy * 7, c[1] - uy * 12 + ux * 7);
      g.lineTo(c[0] - ux * 12 + uy * 7, c[1] - uy * 12 - ux * 7);
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}
function drawCurve(g, cv, rng) {
  if (!cv.px) cv.px = cv.pts.map((p) => [p[0] * TILE, p[1] * TILE]);
  const P = cv.px,
    W = cv.w * TILE,
    n = P.length;
  // only the part of the curve inside this chunk (plus margin)
  let i0 = 0,
    i1 = n - 1;
  if (rng) {
    i0 = rng[0];
    i1 = rng[1];
  } else if (CUR_CHUNK) {
    const [x0, y0, x1, y1] = CUR_CHUNK,
      m = W + 60;
    i0 = n;
    i1 = -1;
    for (let i = 0; i < n; i++) {
      const p = P[i];
      if (p[0] > x0 - m && p[0] < x1 + m && p[1] > y0 - m && p[1] < y1 + m) {
        if (i < i0) i0 = i;
        i1 = i;
      }
    }
    if (i1 < 0) return;
    i0 = Math.max(0, i0 - 1);
    i1 = Math.min(n - 1, i1 + 1);
  }
  g.save();
  g.lineCap = "butt";
  g.lineJoin = "round";
  const wet = (i) => {
    const tx = Math.floor(cv.pts[i][0]),
      ty = Math.floor(cv.pts[i][1]);
    return get(tx, ty) === T.BRIDGE;
  };
  if (cv.fo && !rng)
    for (const fo of cv.fo) {
      const a = Math.max(i0, fo.a),
        b = Math.min(i1, fo.b);
      if (a < b) foUnder(g, cv, P, a, b, fo);
    }
  if (cv.bridge && !rng) {
    let a = -1;
    for (let i = i0; i <= i1 + 1; i++) {
      const w = i <= i1 && wet(i);
      if (w && a < 0) a = i;
      if (!w && a >= 0) {
        const b = Math.min(i1, i + 2),
          s = Math.max(i0, a - 2);
        g.save();
        g.translate(18, 18);
        curvePath(g, P, s, b, 0);
        g.strokeStyle = "rgba(5,25,45,0.35)";
        g.lineWidth = W + 18;
        g.stroke();
        g.restore();
        curvePath(g, P, s, b, 0);
        g.strokeStyle = "#a4a8ad";
        g.lineWidth = W + 16;
        g.stroke();
        for (const sd of [-1, 1]) {
          curvePath(g, P, s, b, sd * (W / 2 + 5));
          g.strokeStyle = "#dfe2e6";
          g.lineWidth = 4;
          g.stroke();
          curvePath(g, P, s, b, sd * (W / 2 + 5));
          g.strokeStyle = "#6d7178";
          g.lineWidth = 4;
          g.setLineDash([2, 10]);
          g.stroke();
          g.setLineDash([]);
        }
        a = -1;
      }
    }
  }
  if (cv.type === "dirt") {
    curvePath(g, P, i0, i1, 0);
    g.strokeStyle = "#8a7350";
    g.lineWidth = W + 6;
    g.stroke();
    curvePath(g, P, i0, i1, 0);
    g.strokeStyle = "#a68b60";
    g.lineWidth = W;
    g.stroke();
    for (const sd of [-1, 1]) {
      curvePath(g, P, i0, i1, sd * W * 0.22);
      g.strokeStyle = "rgba(90,70,45,0.45)";
      g.lineWidth = 5;
      g.stroke();
    }
    curvePath(g, P, i0, i1, 0);
    g.strokeStyle = "rgba(150,170,90,0.35)";
    g.lineWidth = 3;
    g.stroke();
    g.restore();
    return;
  }
  if (cv.type === "hwy" || cv.type === "dual") {
    curvePath(g, P, i0, i1, 0);
    g.strokeStyle = "#8a8c86";
    g.lineWidth = W + 5;
    g.stroke();
  }
  curvePath(g, P, i0, i1, 0);
  g.strokeStyle = g.createPattern(TEX.asph[1], "repeat");
  g.lineWidth = W;
  g.stroke();
  const line = (off, col, w, dash) => {
    curvePath(g, P, i0, i1, off);
    g.strokeStyle = col;
    g.lineWidth = w;
    g.setLineDash(dash || []);
    g.stroke();
    g.setLineDash([]);
  };
  const half = cv.w / 2;
  if (cv.type === "lane") {
    for (const sd of [-1, 1]) line(sd * (W / 2 - 3), "rgba(120,110,90,0.5)", 3);
    if (!RD_NOCENTRE.has("lane")) line(0, "#e4e4dc", 2, [24, 24]);
    g.restore();
    return;
  }
  for (const sd of [-1, 1]) line(sd * (W / 2 - 5), "#ececec", 2);
  if (cv.type === "hwy") {
    line(0, "#9a9ca0", 6);
    line(0, "#5c5f64", 2);
    for (const sd of [-1, 1]) line(sd * 5, "#f2c230", 2);
  } else if (cv.type === "dual") {
    line(0, "#8f9188", 14);
    line(0, "#6a8f45", 9);
  } else line(0, "#ececec", 2, [24, 24]);
  for (let k = 1; k < half; k++)
    for (const sd of [-1, 1]) line(sd * k * TILE, "#ececec", 2, [24, 24]);
  if (cv.fo)
    for (const fo of cv.fo) {
      const a = Math.max(i0, fo.a),
        b = Math.min(i1, fo.b);
      if (a < b) foParapet(g, cv, P, a, b);
    }
  g.restore();
}
// v20 flyover deck: drop shadow on the lower road, concrete piers either side of it, deck slab and parapets (chunk pass);
// the live pass (drawFlyovers) repaints the deck over lower-layer traffic so cars visibly pass underneath
function foUnder(g, cv, P, a, b, fo) {
  const W = cv.w * TILE;
  g.save();
  g.save();
  g.translate(16, 22);
  curvePath(g, P, a, b, 0);
  g.strokeStyle = "rgba(10,14,22,0.38)";
  g.lineWidth = W + 14;
  g.stroke();
  g.restore();
  // piers: pairs of columns at intervals, skipped where they'd stand in a lower carriageway
  for (let k = a + 2; k <= b - 2; k += 6) {
    const p = P[k],
      q = P[Math.min(P.length - 1, k + 1)],
      tx = q[0] - p[0],
      ty = q[1] - p[1],
      l = Math.hypot(tx, ty) || 1,
      nx = -ty / l,
      ny = tx / l;
    for (const sd of [-1, 1]) {
      const x = p[0] + nx * sd * (W / 2 + 2),
        y = p[1] + ny * sd * (W / 2 + 2),
        ti = idx(Math.floor(x / TILE), Math.floor(y / TILE));
      if (world.foF && world.foF[ti]) continue;
      g.fillStyle = "rgba(10,14,22,0.35)";
      g.beginPath();
      g.arc(x + 20, y + 28, 9, 0, 7);
      g.fill();
      g.fillStyle = "#9ea2a6";
      g.beginPath();
      g.arc(x + 14, y + 20, 8, 0, 7);
      g.fill();
      g.strokeStyle = "#6c7075";
      g.lineWidth = 2;
      g.stroke();
    }
  }
  curvePath(g, P, a, b, 0);
  g.strokeStyle = "#b7babd";
  g.lineWidth = W + 16;
  g.stroke();
  g.restore();
}
function foParapet(g, cv, P, a, b) {
  const W = cv.w * TILE;
  g.save();
  g.lineCap = "butt";
  for (const sd of [-1, 1]) {
    curvePath(g, P, a, b, sd * (W / 2 + 5));
    g.strokeStyle = "#e4e6e8";
    g.lineWidth = 6;
    g.stroke();
    curvePath(g, P, a, b, sd * (W / 2 + 5));
    g.strokeStyle = "#5f6368";
    g.lineWidth = 2;
    g.setLineDash([3, 9]);
    g.stroke();
    g.setLineDash([]);
    curvePath(g, P, a, b, sd * (W / 2 + 8.5));
    g.strokeStyle = "rgba(30,32,36,0.55)";
    g.lineWidth = 1.5;
    g.stroke();
  }
  // expansion joints at the deck ends
  for (const k of [a, b]) {
    const p = P[k],
      q = P[Math.min(P.length - 1, k + 1)],
      o = P[Math.max(0, k - 1)],
      tx = q[0] - o[0],
      ty = q[1] - o[1],
      l = Math.hypot(tx, ty) || 1,
      nx = (-ty / l) * (W / 2 + 8),
      ny = (tx / l) * (W / 2 + 8);
    g.strokeStyle = "rgba(40,40,44,0.7)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(p[0] - nx, p[1] - ny);
    g.lineTo(p[0] + nx, p[1] + ny);
    g.stroke();
  }
  g.restore();
}
function drawFlyovers(vx0, vy0, vx1, vy1, alpha) {
  if (!world.flyovers || !world.flyovers.length) return;
  for (const fo of world.flyovers) {
    const cv = world.curves[fo.cv];
    if (!cv.px) cv.px = cv.pts.map((p) => [p[0] * TILE, p[1] * TILE]);
    const P = cv.px;
    if (!fo.bb) {
      let x0 = 1e9,
        y0 = 1e9,
        x1 = -1e9,
        y1 = -1e9;
      for (let k = fo.a; k <= fo.b; k++) {
        x0 = Math.min(x0, P[k][0]);
        y0 = Math.min(y0, P[k][1]);
        x1 = Math.max(x1, P[k][0]);
        y1 = Math.max(y1, P[k][1]);
      }
      fo.bb = [x0 - 100, y0 - 100, x1 + 100, y1 + 100];
    }
    const B = fo.bb;
    if (B[2] < vx0 || B[0] > vx1 || B[3] < vy0 || B[1] > vy1) continue;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    drawCurve(ctx, cv, [fo.a, fo.b]);
    ctx.restore();
  }
}

function isParkNear(tx, ty) {
  return (
    get(tx + 1, ty) === T.PGRASS ||
    get(tx - 1, ty) === T.PGRASS ||
    get(tx, ty + 1) === T.PGRASS ||
    get(tx, ty - 1) === T.PGRASS
  );
}
function getChunk(cx, cy, allowRender) {
  const k = cx + "," + cy;
  let c = chunkCache.get(k);
  if (c) {
    chunkCache.delete(k);
    chunkCache.set(k, c);
    return c;
  }
  if (!allowRender) return null; // LRU: a hit moves to the back
  c = renderChunk(cx, cy);
  chunkCache.set(k, c);
  while (chunkCache.size > 90) chunkCache.delete(chunkCache.keys().next().value);
  return c;
}
// zoomed-out LOD: 128px copies of chunks with their own big LRU, so a wide fly-cam view never evicts what is on screen (was: FIFO 90 < visible → flicker)
const chunkLo = new Map(),
  CHUNK_LO = 128;
function getChunkLo(cx, cy, allowRender) {
  const k = cx + "," + cy;
  let c = chunkLo.get(k);
  if (c) {
    chunkLo.delete(k);
    chunkLo.set(k, c);
    return c;
  }
  const f = chunkCache.get(k) || (allowRender ? getChunk(cx, cy, true) : null);
  if (!f) return null;
  c = mkCanvas(CHUNK_LO, CHUNK_LO);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(f, 0, 0, CHUNK_LO, CHUNK_LO);
  chunkLo.set(k, c);
  while (chunkLo.size > 700) chunkLo.delete(chunkLo.keys().next().value);
  return c;
}
// ---- minimap
let MINIMAP = null;
function makeMinimap() {
  const c = mkCanvas(MW, MH),
    g = c.getContext("2d"),
    im = g.createImageData(MW, MH);
  const col = {
    [T.GRASS]: [86, 135, 58],
    [T.ROAD]: [38, 38, 40],
    [T.WALK]: [196, 196, 196],
    [T.WATER]: [110, 138, 172],
    [T.BRIDGE]: [60, 60, 64],
    [T.PGRASS]: [104, 160, 70],
    [T.CONC]: [170, 170, 170],
    [T.BLDG]: [240, 240, 240],
    [T.GRAVEL]: [150, 135, 110],
    [T.TREE]: [44, 92, 40],
    [T.QUAY]: [160, 160, 160],
    [T.CONT]: [205, 205, 205],
    [T.SAND]: [226, 196, 108],
    [T.PLAZA]: [200, 200, 200],
    [T.LOT]: [120, 120, 124],
    [T.TANK]: [230, 230, 230],
    [T.PUMP]: [230, 230, 230],
    [T.FIELD]: [148, 166, 82],
    [T.ISLAND]: [104, 160, 70],
    [T.HEDGE]: [60, 100, 45],
    [T.ROCK]: [158, 156, 152],
  };
  const DES = [184, 152, 112];
  // v9: tile colours sampled from the same textures the world is drawn with, so the zoomed-out map reads like the world
  const avg = (n) => {
    const t = TEX[n] && TEX[n][0];
    if (!t) return null;
    const d = t.getContext("2d").getImageData(0, 0, t.width, t.height).data;
    let r = 0,
      g2 = 0,
      b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g2 += d[i + 1];
      b += d[i + 2];
    }
    const m = d.length / 4;
    return [(r / m) | 0, (g2 / m) | 0, (b / m) | 0];
  };
  for (const [k, n] of [
    [T.GRASS, "grass"],
    [T.WALK, "walk"],
    [T.WATER, "water"],
    [T.PGRASS, "pgrass"],
    [T.CONC, "conc"],
    [T.PLAZA, "plaza"],
    [T.GRAVEL, "gravel"],
    [T.QUAY, "quay"],
    [T.SAND, "sand"],
    [T.LOT, "asph"],
    [T.FIELD, "field"],
    [T.ISLAND, "island"],
    [T.ROCK, "rock"],
    [T.HEDGE, "grass"],
    [T.ROAD, "asph"],
    [T.TANK, "conc"],
    [T.PUMP, "conc"],
  ]) {
    const c3 = avg(n);
    if (c3) col[k] = c3;
  }
  col[T.BRIDGE] = [col[T.ROAD][0] + 8, col[T.ROAD][1] + 8, col[T.ROAD][2] + 8];
  col[T.BLDG] = [178, 172, 164];
  col[T.CONT] = [170, 120, 90];
  const GR = col[T.GRASS];
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      const t = G[i];
      let c3 = col[t] || [0, 0, 0];
      if (t === T.SAND && world.des[i]) c3 = DES;
      if (t === T.GRASS) {
        const f = world.fd[i] / 255;
        if (f > 0.6) c3 = [(GR[0] * 0.7) | 0, (GR[1] * 0.78) | 0, (GR[2] * 0.7) | 0];
        else if (f < 0.38) c3 = [(GR[0] * 1.12) | 0, (GR[1] * 1.06) | 0, (GR[2] * 1.05) | 0];
      }
      if (t === T.ROCK && 0) {
        const e = hillElev(x, y);
        const b = Math.floor(e * 7) % 2 ? 14 : 0;
        c3 = [150 + b + e * 40, 148 + b + e * 40, 144 + b + e * 40];
      }
      im.data[i * 4] = c3[0];
      im.data[i * 4 + 1] = c3[1];
      im.data[i * 4 + 2] = c3[2];
      im.data[i * 4 + 3] = 255;
    }
  g.putImageData(im, 0, 0);
  MINIMAP = c;
}

// ===================== v13 natural grass & trees =====================
const GRASSY = new Set([T.GRASS, T.PGRASS, T.TREE, T.HEDGE, T.ISLAND]);
function rbUnder(tx, ty) {
  const rb = rbAtTile(tx, ty);
  if (!rb) return T.GRASS;
  if (Math.hypot(tx + 0.5 - rb.cx, ty + 0.5 - rb.cy) < rb.rin + 1.5) return T.GRASS;
  return rbGround(rb, tx, ty);
}
function isGrassy(tx, ty) {
  if (!inb(tx, ty)) return false;
  const t = G[idx(tx, ty)];
  if (GRASSY.has(t)) return true;
  if (t === T.ROAD) {
    const rh = world.roadH[idx(tx, ty)];
    return (
      (rh === -2 && GRASSY.has(rbUnder(tx, ty))) ||
      (rh === -3 && world.under[idx(tx, ty)] === T.GRASS)
    );
  }
  return false;
}
let GD_TMP = null,
  GD_TINT = null;
function desertNear(tx, ty) {
  let k = 0;
  for (const h of world.hills)
    if (h.desert) {
      const d = Math.hypot(tx - h.x, ty - h.y) / h.r;
      if (d < 2.6) k = Math.max(k, (2.6 - d) / 1.6);
    }
  return Math.min(1, k);
}
function grassDetail(g, cx, cy) {
  const N = CHUNK / TILE,
    tx0 = cx * N,
    ty0 = cy * N;
  let any = false;
  const mask = new Uint8Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      if (isGrassy(tx0 + i, ty0 + j)) {
        mask[j * N + i] = 1;
        any = true;
      }
  if (!any) return;
  if (!GD_TMP) {
    GD_TMP = mkCanvas(CHUNK, CHUNK);
    GD_TINT = mkCanvas(N + 2, N + 2);
  }
  // 1) large-scale colour variation: one pixel per tile, bilinear-upscaled -> smooth patches
  const tg = GD_TINT.getContext("2d"),
    id = tg.createImageData(N + 2, N + 2),
    D = id.data;
  for (let j = -1; j <= N; j++)
    for (let i = -1; i <= N; i++) {
      const x = tx0 + i,
        y = ty0 + j,
        k = ((j + 1) * (N + 2) + i + 1) * 4;
      const n1 = vnoise(x, y, 22),
        n2 = vnoise(x + 311, y + 97, 9),
        yl = vnoise(x + 701, y + 433, 38),
        dry = vnoise(x + 57, y + 1201, 14);
      const fd = inb(x, y) ? world.fd[idx(x, y)] / 255 : 0,
        de = desertNear(x, y),
        t = inb(x, y) ? G[idx(x, y)] : 0;
      let r = 0,
        gg = 0,
        b = 0,
        w = 0;
      const add = (R, Gc, B, a) => {
        if (a <= 0) return;
        r += R * a;
        gg += Gc * a;
        b += B * a;
        w += a;
      };
      const L = (n1 - 0.5) * 1.2 + (n2 - 0.5) * 0.5; // lighter / darker
      if (L > 0) add(150, 185, 95, L * 0.8);
      else add(28, 52, 22, -L * 0.85);
      add(170, 160, 80, Math.max(0, yl - 0.55) * 1.1 + de * 0.45); // yellower swathes, desert fringe
      add(150, 130, 85, Math.max(0, dry - 0.78) * 2.2 * (t === T.PGRASS ? 0.4 : 1)); // dry / worn patches
      add(48, 62, 26, Math.max(0, fd - 0.5) * 0.7 + (t === T.TREE ? 0.18 : 0)); // forest floor / under trees
      const A = Math.min(0.6, w);
      D[k] = w ? r / w : 0;
      D[k + 1] = w ? gg / w : 0;
      D[k + 2] = w ? b / w : 0;
      D[k + 3] = A * 255;
    }
  tg.putImageData(id, 0, 0);
  const q = GD_TMP.getContext("2d");
  q.clearRect(0, 0, CHUNK, CHUNK);
  q.imageSmoothingEnabled = true;
  q.imageSmoothingQuality = "high";
  q.drawImage(GD_TINT, 0.5, 0.5, N + 1, N + 1, -TILE / 2, -TILE / 2, CHUNK + TILE, CHUNK + TILE);
  const rr = mulberry(cx * 7919 + cy * 104729 + 5);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (!mask[j * N + i]) continue;
      const x = tx0 + i,
        y = ty0 + j,
        px = i * TILE,
        py = j * TILE,
        t = G[idx(x, y)],
        h = hash2(x * 3 + 1, y * 5 + 2);
      // 2) mowed stripes: parks along x, verges parallel to the road
      if (t === T.PGRASS || t === T.ISLAND) {
        q.fillStyle = "rgba(255,255,230,0.045)";
        if (((x * 2) & 2) === 0) q.fillRect(px, py, 16, 32);
        else q.fillRect(px + 16, py, 16, 32);
        q.fillStyle = "rgba(20,40,10,0.035)";
        q.fillRect(px + ((x * 2) & 2 ? 0 : 16), py, 16, 32);
      } else if (t === T.GRASS) {
        const rv =
            get(x, y - 1) === T.ROAD ||
            get(x, y + 1) === T.ROAD ||
            get(x, y - 2) === T.ROAD ||
            get(x, y + 2) === T.ROAD,
          rh =
            get(x - 1, y) === T.ROAD ||
            get(x + 1, y) === T.ROAD ||
            get(x - 2, y) === T.ROAD ||
            get(x + 2, y) === T.ROAD;
        if (rv !== rh) {
          q.fillStyle = "rgba(255,255,220,0.06)";
          if (rv) {
            q.fillRect(px, py + (y & 1 ? 0 : 16), 32, 16);
          } else q.fillRect(px + (x & 1 ? 0 : 16), py, 16, 32);
        }
      }
      // 3) worn earth patches, tall-grass clumps, wild flowers
      if (t === T.GRASS && h < 0.012) {
        q.fillStyle = "rgba(120,98,62,0.35)";
        q.beginPath();
        q.ellipse(px + 16, py + 16, 8 + h * 600, 5 + h * 300, h * 400, 0, 7);
        q.fill();
      }
      if (t !== T.PGRASS && h > 0.93) {
        const n = 4 + (((h * 1000) | 0) % 5),
          X = px + 4 + rr() * 24,
          Y = py + 4 + rr() * 24;
        q.lineWidth = 1.2;
        for (let k = 0; k < n * 3; k++) {
          const a = rr() * 6.28,
            l = 2 + rr() * 4;
          q.strokeStyle = k % 3 ? "rgba(48,80,30,0.7)" : "rgba(150,170,90,0.6)";
          q.beginPath();
          q.moveTo(X + Math.cos(a) * 1.5, Y + Math.sin(a) * 1.5);
          q.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l);
          q.stroke();
        }
        q.lineWidth = 1;
      }
      if (h > 0.86 && h < 0.9) {
        const fc =
          t === T.PGRASS
            ? ["#f6e7f0", "#f4e04d", "#ffffff"]
            : ["#f4e04d", "#ffffff", "#c9a0e8", "#ff9a3c"];
        q.fillStyle = fc[(rr() * fc.length) | 0];
        for (let k = 0; k < 5; k++) q.fillRect(px + rr() * 30, py + rr() * 30, 1.5, 1.5);
      }
      // 4) soft edge where grass meets pavement / dirt / road: darker longer grass + blades overhanging
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        if (isGrassy(x + dx, y + dy)) continue;
        const nt = get(x + dx, y + dy);
        if (nt === T.WATER || nt === T.BLDG) continue;
        const gr = q.createLinearGradient(
          px + 16 + dx * 16,
          py + 16 + dy * 16,
          px + 16 + dx * 10,
          py + 16 + dy * 10,
        );
        gr.addColorStop(0, "rgba(30,55,20,0.35)");
        gr.addColorStop(1, "rgba(30,55,20,0)");
        q.fillStyle = gr;
        q.fillRect(dx > 0 ? px + 26 : px, dy > 0 ? py + 26 : py, dx ? 6 : 32, dy ? 6 : 32);
      }
    }
  // copy only onto grassy tiles (decoration may overhang 2px for soft edges)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      if (mask[j * N + i])
        g.drawImage(GD_TMP, i * TILE, j * TILE, TILE, TILE, i * TILE, j * TILE, TILE, TILE);
  // blades poking over the edge onto paths/dirt
  g.strokeStyle = "rgba(60,95,40,0.75)";
  g.lineWidth = 1;
  g.beginPath();
  const r2 = mulberry(cx * 31 + cy * 17 + 9);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (!mask[j * N + i]) continue;
      const x = tx0 + i,
        y = ty0 + j,
        px = i * TILE,
        py = j * TILE;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        if (isGrassy(x + dx, y + dy)) continue;
        const nt = get(x + dx, y + dy);
        if (nt !== T.WALK && nt !== T.GRAVEL && nt !== T.SAND && nt !== T.FIELD && nt !== T.PLAZA)
          continue;
        for (let k = 0; k < 6; k++) {
          const u = r2() * 32,
            l = 1 + r2() * 2.5;
          let x0, y0;
          if (dx) {
            x0 = px + (dx > 0 ? 32 : 0);
            y0 = py + u;
            g.moveTo(x0, y0);
            g.lineTo(x0 + dx * l, y0 + (r2() - 0.5) * 2);
          } else {
            x0 = px + u;
            y0 = py + (dy > 0 ? 32 : 0);
            g.moveTo(x0, y0);
            g.lineTo(x0 + (r2() - 0.5) * 2, y0 + dy * l);
          }
        }
      }
    }
  g.stroke();
}
function hexRGB(h) {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function mixC(c, f) {
  return (
    "rgb(" +
    c
      .map((v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))))
      .join(",") +
    ")"
  );
}
function treeShadow(g, x, y, R, dx, dy, a) {
  const gr = g.createRadialGradient(x + dx, y + dy, R * 0.2, x + dx, y + dy, R * 1.15);
  gr.addColorStop(0, "rgba(8,18,8," + a + ")");
  gr.addColorStop(0.7, "rgba(8,18,8," + a * 0.6 + ")");
  gr.addColorStop(1, "rgba(8,18,8,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x + dx, y + dy, R * 1.15, 0, 7);
  g.fill();
}
// light comes from the upper-left (matches building shadows falling down-right)
function lumpy(g, r, x, y, R, col, n, lj) {
  g.fillStyle = col;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 6.283 + r() * 0.4,
      d = R * (0.45 + r() * 0.2),
      rr = R * (0.42 + r() * lj);
    g.moveTo(x + Math.cos(a) * d + rr, y + Math.sin(a) * d);
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, 7);
  }
  g.moveTo(x + R * 0.6, y);
  g.arc(x, y, R * 0.6, 0, 7);
  g.fill();
}
function drawTree(g, o) {
  const r = mulberry(o.seed),
    sp = o.sp || 0,
    R = o.r * (0.9 + r() * 0.25),
    x = o.x,
    y = o.y,
    rot = r() * 6.283;
  if (sp === 1) {
    // conifer: layered star whorls, sunlit upper-left
    treeShadow(g, x, y, R * 0.95, R * 0.5, R * 0.5, 0.42);
    const pal = [
      ["#1a3a16", "#26511f", "#356a2a", "#4f8a3a"],
      ["#1e3c1c", "#2b5626", "#3b7033", "#5a9246"],
      ["#24401a", "#335a22", "#46742e", "#68984a"],
    ][(r() * 3) | 0];
    const Rc = R * 1.15;
    for (let l = 0; l < 4; l++) {
      const rr = Rc * (1 - l * 0.22),
        pts = 8 + ((r() * 4) | 0),
        off = -l * R * 0.09;
      const gr = g.createLinearGradient(x - rr, y - rr, x + rr, y + rr);
      gr.addColorStop(0, mixC(hexRGB(pal[l]), 1.2));
      gr.addColorStop(0.5, mixC(hexRGB(pal[l]), 1));
      gr.addColorStop(1, mixC(hexRGB(pal[l]), 0.6));
      g.fillStyle = gr;
      g.beginPath();
      for (let k = 0; k < pts * 2; k++) {
        const a = rot + l * 0.35 + (k / (pts * 2)) * 6.283,
          q = k % 2 ? rr * (0.55 + r() * 0.1) : rr * (0.9 + r() * 0.15);
        const X = x + off + Math.cos(a) * q,
          Y = y + off + Math.sin(a) * q;
        k ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
      g.closePath();
      g.fill();
    }
    g.fillStyle = "rgba(220,255,200,0.18)";
    g.beginPath();
    g.arc(x - R * 0.3, y - R * 0.3, R * 0.18, 0, 7);
    g.fill();
    return;
  }
  if (sp === 3) {
    // columnar poplar / cypress: tall thin crown, long shadow
    g.save();
    g.translate(x, y);
    g.rotate(0.785);
    const gs = g.createLinearGradient(0, 0, 0, R * 3);
    gs.addColorStop(0, "rgba(8,18,8,0.35)");
    gs.addColorStop(1, "rgba(8,18,8,0)");
    g.fillStyle = gs;
    g.beginPath();
    g.ellipse(0, R * 1.5, R * 0.45, R * 1.6, 0, 0, 7);
    g.fill();
    g.restore();
    const base = hexRGB(["#3e6e2c", "#4a7a34", "#356428"][(r() * 3) | 0]);
    lumpy(g, r, x, y, R * 0.62, mixC(base, 0.7), 7, 0.18);
    lumpy(g, r, x - R * 0.1, y - R * 0.1, R * 0.5, mixC(base, 1), 6, 0.15);
    lumpy(g, r, x - R * 0.22, y - R * 0.22, R * 0.28, mixC(base, 1.3), 4, 0.12);
    return;
  }
  // broadleaf (sp 0 oak/ash, sp 2 birch/light) with occasional autumn tints
  const autumn = sp === 0 && r() < 0.12,
    bush = o.bush;
  const base = hexRGB(
    autumn
      ? ["#b5652a", "#c98a2e", "#a8452a", "#c2a03a"][(r() * 4) | 0]
      : sp === 2
        ? ["#7aa64a", "#86b052", "#6f9c44"][(r() * 3) | 0]
        : ["#2f6528", "#3a7330", "#2e5e2c", "#447a2e", "#3b6a26", "#4f7a30"][(r() * 6) | 0],
  );
  treeShadow(g, x, y, R, R * 0.5, R * 0.5, 0.36);
  lumpy(g, r, x, y, R * 0.95, mixC(base, 0.55), 9, 0.22); // dark underside / silhouette
  lumpy(g, r, x - R * 0.08, y - R * 0.08, R * 0.82, mixC(base, 0.8), 8, 0.2); // mid
  for (let i = 0; i < 6; i++) {
    const a = rot + r() * 6.28,
      d = R * (0.15 + r() * 0.45),
      cxl = x + Math.cos(a) * d - R * 0.12,
      cyl = y + Math.sin(a) * d - R * 0.12,
      rr = R * (0.22 + r() * 0.18);
    const gr = g.createRadialGradient(cxl - rr * 0.4, cyl - rr * 0.4, 0.5, cxl, cyl, rr);
    gr.addColorStop(0, mixC(base, 1.3));
    gr.addColorStop(1, mixC(base, 0.85));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cxl, cyl, rr, 0, 7);
    g.fill();
  }
  g.fillStyle = "rgba(10,25,8,0.18)";
  for (let i = 0; i < 4; i++) {
    const a = rot + r() * 6.28,
      d = R * (0.3 + r() * 0.4);
    g.beginPath();
    g.arc(
      x + Math.cos(a) * d + R * 0.1,
      y + Math.sin(a) * d + R * 0.1,
      R * 0.08 + r() * R * 0.06,
      0,
      7,
    );
    g.fill();
  }
  g.fillStyle = "rgba(255,255,215,0.16)";
  g.beginPath();
  g.arc(x - R * 0.35, y - R * 0.38, R * 0.26, 0, 7);
  g.fill();
  if (sp === 2 && r() < 0.5) {
    g.fillStyle = "#e8e4da";
    g.fillRect(x - 1, y - 1, 2, 3);
  }
}
function drawBush(g, o) {
  const r = mulberry(o.seed),
    R = o.r,
    x = o.x,
    y = o.y;
  const base = hexRGB(
    o.hedge
      ? ["#2f5a24", "#355f27"][(r() * 2) | 0]
      : ["#4d7d33", "#5a8a3a", "#3f6f2e", "#557a2c"][(r() * 4) | 0],
  );
  treeShadow(g, x, y, R, R * 0.45, R * 0.45, 0.32);
  lumpy(g, r, x, y, R, mixC(base, 0.62), o.hedge ? 10 : 7, 0.2);
  lumpy(g, r, x - R * 0.12, y - R * 0.12, R * 0.75, mixC(base, 0.9), 6, 0.18);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = mixC(base, 1.15 + r() * 0.2);
    g.beginPath();
    g.arc(
      x - R * 0.25 + (r() - 0.5) * R * 0.6,
      y - R * 0.25 + (r() - 0.5) * R * 0.6,
      R * (0.15 + r() * 0.12),
      0,
      7,
    );
    g.fill();
  }
  if (!o.hedge && r() < 0.3) {
    g.fillStyle = ["#f4e04d", "#fff", "#e86fa0"][(r() * 3) | 0];
    for (let k = 0; k < 5; k++)
      g.fillRect(x + (r() - 0.5) * R * 1.4, y + (r() - 0.5) * R * 1.4, 1.6, 1.6);
  }
}

/**
 * @file lorry.js — LORRY ART (drawn once, rotated freely)
 * Exposes (globals): ART_SCALE, CAB, TRL, rr, artGrime, artRivets, artCabDetail, makeCabArt, makeTrailerArt, silhouette
 *   (v61c: stronger body gradients, edge highlights, panel seams, rivets, glass, light housings, baked road grime)
 * Depends on: world.js, render.js
 * Load order: #5 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== LORRY ART (drawn once, rotated freely) =====================
const ART_SCALE = 3; // art pixels per world px
const CAB = { front: -5.0, rear: 1.2, w: 2.5, wheelbase: 3.8 }; // metres, local y (+ = backwards) from rear axle
const TRL = { front: -1.2, rear: 12.4, w: 2.55, axle: 10.5 }; // from kingpin
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
// v61c vehicle detailing helpers (static, baked once into the art canvas)
// grime: road film darkening toward the given edges + mud specks near the wheels, painted only where the art is opaque
function artGrime(g, W, H, seed, rear, wheels) {
  const R = mulberry(seed);
  g.save();
  g.globalCompositeOperation = "source-atop";
  let gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, "rgba(70,55,38,0.22)");
  gr.addColorStop(0.12, "rgba(70,55,38,0)");
  gr.addColorStop(0.88, "rgba(70,55,38,0)");
  gr.addColorStop(1, "rgba(70,55,38,0.22)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  gr = g.createLinearGradient(0, H * (1 - rear), 0, H);
  gr.addColorStop(0, "rgba(60,48,34,0)");
  gr.addColorStop(1, "rgba(60,48,34,0.3)");
  g.fillStyle = gr;
  g.fillRect(0, H * (1 - rear), W, H * rear);
  for (const wy of wheels)
    for (let i = 0; i < 26; i++) {
      const sd = R() < 0.5 ? 0 : 1,
        x = sd ? W - R() * W * 0.16 : R() * W * 0.16,
        y = wy + (R() - 0.3) * H * 0.06,
        r = 0.6 + R() * 1.8;
      g.fillStyle = R() < 0.5 ? "rgba(84,64,40,0.45)" : "rgba(58,44,30,0.4)";
      g.beginPath();
      g.arc(x, y, r, 0, 7);
      g.fill();
    }
  g.restore();
}
function artRivets(g, x0, y0, x1, y1, step, r) {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n,
      y = y0 + ((y1 - y0) * i) / n;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.arc(x + 0.6, y + 0.6, r, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.beginPath();
    g.arc(x, y, r * 0.8, 0, 7);
    g.fill();
  }
}
// cab detailing shared by makeCabArt and career.js modelArt: headlight housings + amber indicators at the front corners,
// roof panel seams, rivets along the cab back, an edge highlight inside the rim, then baked road grime
function artCabDetail(g, W, H, X, Y, S, cab0, cab1, color) {
  for (const s2 of [-1, 1]) {
    const hx = X(s2 * 0.88) - 0.2 * S;
    g.fillStyle = "#15171a";
    rr(g, hx, Y(cab0 - 0.02), 0.4 * S, 0.16 * S, 0.05 * S);
    g.fill();
    const gl = g.createLinearGradient(hx, 0, hx + 0.4 * S, 0);
    gl.addColorStop(0, "#f4f6f2");
    gl.addColorStop(1, "#b9c3c9");
    g.fillStyle = gl;
    rr(g, hx + 0.03 * S, Y(cab0), 0.34 * S, 0.11 * S, 0.04 * S);
    g.fill();
    g.fillStyle = "#f0a020";
    g.fillRect(X(s2 * 1.16) - 0.05 * S, Y(cab0 + 0.02), 0.1 * S, 0.12 * S);
  }
  g.strokeStyle = shade(color, 0.55);
  g.lineWidth = 1.2;
  for (const f of [0.6, 0.85]) {
    const m = cab0 + (cab1 - cab0) * f;
    g.beginPath();
    g.moveTo(X(-1.18), Y(m));
    g.lineTo(X(1.18), Y(m));
    g.stroke();
  }
  artRivets(g, X(-1.05), Y(cab1 - 0.13), X(1.05), Y(cab1 - 0.13), 0.3 * S, 1.1);
  g.strokeStyle = "rgba(255,255,255,0.28)";
  g.lineWidth = 1.2;
  rr(g, X(-1.18), Y(cab0 + 0.07), 2.36 * S, (cab1 - cab0 - 0.14) * S, 0.3 * S);
  g.stroke();
  artGrime(g, W, H, 7, 0.45, [Y(0)]);
}
function makeCabArt(color) {
  const S = PPM * ART_SCALE,
    W = Math.ceil((CAB.w + 0.6) * S),
    H = Math.ceil((CAB.rear - CAB.front) * S);
  const c = mkCanvas(W, H),
    g = c.getContext("2d");
  const X = (m) => W / 2 + m * S,
    Y = (m) => (m - CAB.front) * S;
  // chassis rails + fifth wheel
  g.fillStyle = "#26282c";
  g.fillRect(X(-0.55), Y(-2.8), 0.35 * S, 4.0 * S);
  g.fillRect(X(0.2), Y(-2.8), 0.35 * S, 4.0 * S);
  g.fillStyle = "#2f3236";
  g.fillRect(X(-0.9), Y(-0.9), 1.8 * S, 2.0 * S);
  g.fillStyle = "#55595f";
  g.beginPath();
  g.arc(X(0), Y(0.3), 0.75 * S, 0, 7);
  g.fill();
  g.fillStyle = "#1d1f22";
  g.beginPath();
  g.moveTo(X(-0.12), Y(0.3));
  g.lineTo(X(-0.25), Y(1.2));
  g.lineTo(X(0.25), Y(1.2));
  g.lineTo(X(0.12), Y(0.3));
  g.fill();
  // rear wheels (twin) & mud flaps
  g.fillStyle = "#141414";
  for (const s of [-1, 1]) {
    g.fillRect(X(s > 0 ? 0.75 : -1.25), Y(-0.55), 0.5 * S, 1.1 * S);
  }
  g.fillStyle = "#3a3a3a";
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 0.7 : -1.2), Y(0.75), 0.5 * S, 0.15 * S);
  // fuel tanks / side skirts
  g.fillStyle = "#b9bec5";
  g.fillRect(X(-1.2), Y(-2.5), 0.4 * S, 1.5 * S);
  g.fillRect(X(0.8), Y(-2.5), 0.4 * S, 1.5 * S);
  g.fillStyle = "#8d9299";
  g.fillRect(X(-1.2), Y(-2.5), 0.4 * S, 0.1 * S);
  g.fillRect(X(0.8), Y(-2.5), 0.4 * S, 0.1 * S);
  // exhaust stacks
  for (const s of [-1, 1]) {
    g.fillStyle = "#d9dde2";
    g.beginPath();
    g.arc(X(s * 0.95), Y(-2.45), 0.17 * S, 0, 7);
    g.fill();
    g.fillStyle = "#333";
    g.beginPath();
    g.arc(X(s * 0.95), Y(-2.45), 0.08 * S, 0, 7);
    g.fill();
  }
  // cab body
  const grd = g.createLinearGradient(X(-1.25), 0, X(1.25), 0);
  grd.addColorStop(0, shade(color, 0.62));
  grd.addColorStop(0.18, shade(color, 0.95));
  grd.addColorStop(0.42, shade(color, 1.22));
  grd.addColorStop(0.82, shade(color, 0.92));
  grd.addColorStop(1, shade(color, 0.6));
  g.fillStyle = grd;
  rr(g, X(-1.25), Y(-5.0), 2.5 * S, 2.45 * S, 0.35 * S);
  g.fill();
  // windscreen (visible sliver at front) + bumper
  const gw = g.createLinearGradient(X(-1.15), 0, X(1.15), 0);
  gw.addColorStop(0, "#132030");
  gw.addColorStop(0.35, "#2b4560");
  gw.addColorStop(1, "#101a26");
  g.fillStyle = gw;
  rr(g, X(-1.15), Y(-4.95), 2.3 * S, 0.32 * S, 0.12 * S);
  g.fill();
  g.fillStyle = "rgba(190,225,250,0.55)";
  g.fillRect(X(-0.9), Y(-4.9), 0.6 * S, 0.07 * S);
  g.fillStyle = "rgba(190,225,250,0.25)";
  g.fillRect(X(-0.15), Y(-4.88), 0.25 * S, 0.05 * S);
  // roof air deflector (curved fairing)
  const g2 = g.createLinearGradient(0, Y(-4.6), 0, Y(-3.4));
  g2.addColorStop(0, shade(color, 1.3));
  g2.addColorStop(1, shade(color, 0.95));
  g.fillStyle = g2;
  g.beginPath();
  g.moveTo(X(-1.05), Y(-3.2));
  g.quadraticCurveTo(X(-1.1), Y(-4.6), X(0), Y(-4.65));
  g.quadraticCurveTo(X(1.1), Y(-4.6), X(1.05), Y(-3.2));
  g.closePath();
  g.fill();
  // roof panel lines, hatch, light bar
  g.strokeStyle = shade(color, 0.6);
  g.lineWidth = 2;
  g.strokeRect(X(-0.45), Y(-3.1), 0.9 * S, 0.45 * S);
  g.fillStyle = "#f5b02e";
  for (const s of [-0.7, -0.35, 0, 0.35, 0.7]) {
    g.beginPath();
    g.arc(X(s), Y(-4.72), 0.07 * S, 0, 7);
    g.fill();
  }
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(X(-0.9), Y(-4.4), 0.25 * S, 1.6 * S);
  // mirrors
  g.fillStyle = "#1d1f22";
  for (const s of [-1, 1]) {
    g.fillRect(X(s > 0 ? 1.25 : -1.55), Y(-4.75), 0.3 * S, 0.42 * S);
    g.fillStyle = "#8a9097";
    g.fillRect(X(s > 0 ? 1.27 : -1.53), Y(-4.72), 0.26 * S, 0.18 * S);
    g.fillStyle = "#1d1f22";
  }
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 2;
  rr(g, X(-1.25), Y(-5.0), 2.5 * S, 2.45 * S, 0.35 * S);
  g.stroke();
  artCabDetail(g, W, H, X, Y, S, -5.0, -2.55, color);
  return { c, W, H, ox: W / 2, oy: Y(0) }; // origin = rear axle
}
function makeTrailerArt() {
  const S = PPM * ART_SCALE,
    W = Math.ceil((TRL.w + 0.3) * S),
    H = Math.ceil((TRL.rear - TRL.front) * S);
  const c = mkCanvas(W, H),
    g = c.getContext("2d");
  const X = (m) => W / 2 + m * S,
    Y = (m) => (m - TRL.front) * S;
  // wheels (tri-axle) peeking out
  g.fillStyle = "#141414";
  for (const a of [9.2, 10.5, 11.8])
    for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 1.12 : -1.38), Y(a - 0.5), 0.26 * S, 1.0 * S);
  // body
  const grd = g.createLinearGradient(X(-1.27), 0, X(1.27), 0);
  grd.addColorStop(0, "#aeb4be");
  grd.addColorStop(0.1, "#e4e8ee");
  grd.addColorStop(0.35, "#f7f9fb");
  grd.addColorStop(0.9, "#e2e6ec");
  grd.addColorStop(1, "#a3a9b3");
  g.fillStyle = grd;
  rr(g, X(-1.27), Y(-1.2), 2.55 * S, 13.6 * S, 0.12 * S);
  g.fill();
  // roof ribs
  g.strokeStyle = "rgba(120,130,145,0.55)";
  g.lineWidth = 2;
  for (let m = -0.6; m < 12.3; m += 0.62) {
    g.beginPath();
    g.moveTo(X(-1.2), Y(m));
    g.lineTo(X(1.2), Y(m));
    g.stroke();
  }
  // curtain side rails (blue)
  g.fillStyle = "#2a5bd7";
  g.fillRect(X(-1.27), Y(-1.1), 0.14 * S, 13.4 * S);
  g.fillRect(X(1.13), Y(-1.1), 0.14 * S, 13.4 * S);
  // roof logo
  g.save();
  g.translate(X(0), Y(5.6));
  g.rotate(-Math.PI / 2);
  g.fillStyle = "#d6312b";
  g.font = `900 ${Math.round(1.25 * S)}px Arial Black, Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("BIG RIG", 0, 0);
  g.fillStyle = "#22324a";
  g.font = `bold ${Math.round(0.5 * S)}px Arial, sans-serif`;
  g.fillText("HAULAGE  CO.", 0, 0.95 * S);
  g.restore();
  // front bulkhead + rear doors/lights
  g.fillStyle = "#9aa1ab";
  g.fillRect(X(-1.27), Y(-1.2), 2.55 * S, 0.22 * S);
  g.fillStyle = "#6d737c";
  g.fillRect(X(-1.27), Y(12.15), 2.55 * S, 0.25 * S);
  // rivets along both side rails
  for (const sx of [-1.2, 1.2]) artRivets(g, X(sx), Y(-0.9), X(sx), Y(12.0), 0.62 * S, 1);
  // tail light clusters: dark housing, red stop/tail, amber indicator, white reverse
  for (const s2 of [-1, 1]) {
    const x0 = s2 < 0 ? X(-1.22) : X(0.62);
    g.fillStyle = "#1a1b1e";
    g.fillRect(x0, Y(12.18), 0.6 * S, 0.2 * S);
    const order = s2 < 0 ? ["#f0a020", "#e0312b", "#f2f2ee"] : ["#f2f2ee", "#e0312b", "#f0a020"];
    order.forEach((col, k) => {
      g.fillStyle = col;
      g.fillRect(x0 + 0.03 * S + k * 0.19 * S, Y(12.21), 0.16 * S, 0.14 * S);
    });
  }
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 2;
  rr(g, X(-1.27), Y(-1.2), 2.55 * S, 13.6 * S, 0.12 * S);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 1;
  rr(g, X(-1.22), Y(-1.14), 2.45 * S, 13.48 * S, 0.1 * S);
  g.stroke();
  artGrime(g, W, H, 11, 0.3, [Y(9.2), Y(10.5), Y(11.8)]);
  return { c, W, H, ox: W / 2, oy: Y(0) }; // origin = kingpin
}
function silhouette(art) {
  const c = mkCanvas(art.W, art.H),
    g = c.getContext("2d");
  g.drawImage(art.c, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "rgba(8,12,20,0.38)";
  g.fillRect(0, 0, art.W, art.H);
  return Object.assign({}, art, { c });
}

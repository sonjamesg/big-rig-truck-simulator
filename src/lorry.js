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
  grd.addColorStop(0, shade(color, 0.75));
  grd.addColorStop(0.5, shade(color, 1.12));
  grd.addColorStop(1, shade(color, 0.75));
  g.fillStyle = grd;
  rr(g, X(-1.25), Y(-5.0), 2.5 * S, 2.45 * S, 0.35 * S);
  g.fill();
  // windscreen (visible sliver at front) + bumper
  g.fillStyle = "#1b2a38";
  rr(g, X(-1.15), Y(-4.95), 2.3 * S, 0.32 * S, 0.12 * S);
  g.fill();
  g.fillStyle = "rgba(160,200,230,0.5)";
  g.fillRect(X(-0.9), Y(-4.9), 0.6 * S, 0.08 * S);
  g.fillStyle = "#2b2d30";
  g.fillRect(X(-1.2), Y(-5.0), 2.4 * S, 0.08 * S);
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
  grd.addColorStop(0, "#c9ced6");
  grd.addColorStop(0.12, "#eef1f5");
  grd.addColorStop(0.88, "#eef1f5");
  grd.addColorStop(1, "#b9bec6");
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
  g.fillStyle = "#e0312b";
  g.fillRect(X(-1.2), Y(12.2), 0.35 * S, 0.15 * S);
  g.fillRect(X(0.85), Y(12.2), 0.35 * S, 0.15 * S);
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 2;
  rr(g, X(-1.27), Y(-1.2), 2.55 * S, 13.6 * S, 0.12 * S);
  g.stroke();
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

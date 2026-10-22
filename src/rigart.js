/**
 * @file rigart.js — realistic art for the starter truck ("rigger", Rigger Classic 360):
 * rigTopArt (top-down cab art used in game) and rigSide (side profile used in the garage / customiser).
 * Both keep the original cab geometry (front -5.0 m, cab back -2.55/-2.4 m, std roof 3.2 m, axles -3.8 / 0)
 * so every customisation part drawn by tune*.js still lines up. Stock parts that a fitted mod replaces
 * (exhaust stacks, fuel tank, mud flaps, roof marker lamps) are hidden via the `hide` flags.
 */
// which stock parts are replaced by fitted mods (fit = slot -> part id)
function rigHide(fit, L) {
  fit = fit || {};
  L = L || {};
  const p = (s) => (typeof czPart === "function" ? czPart(fit[s]) : null);
  return { exh: !!(L.exs || p("exh")), tnk: !!p("tnk"), mud: !!L.mud, lamps: !!L.rbar };
}
function rigHideKey(h) {
  return h ? (h.exh ? "e" : "") + (h.tnk ? "t" : "") + (h.mud ? "m" : "") + (h.lamps ? "l" : "") : "";
}
// ---------------- top-down ----------------
function rigTopArt(color, hide) {
  hide = hide || {};
  const S = PPM * ART_SCALE,
    W = Math.ceil((CAB.w + 0.6) * S),
    H = Math.ceil((CAB.rear - CAB.front) * S);
  const c = mkCanvas(W, H),
    g = c.getContext("2d");
  const X = (m) => W / 2 + m * S,
    Y = (m) => (m - CAB.front) * S;
  const cab0 = -5.0,
    cab1 = -2.55;
  // --- chassis: rails, crossmembers
  g.fillStyle = "#1f2124";
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 0.22 : -0.56), Y(-2.9), 0.34 * S, 4.05 * S);
  g.fillStyle = "#2b2e32";
  for (const yy of [-2.1, -1.2, 0.9]) g.fillRect(X(-0.56), Y(yy), 1.12 * S, 0.12 * S);
  // (air/electric lines are drawn live by the game, not baked here)
  // catwalk (chequer plate) behind the cab
  const cw = g.createLinearGradient(X(-0.6), 0, X(0.6), 0);
  cw.addColorStop(0, "#6b7178");
  cw.addColorStop(0.4, "#b8bec5");
  cw.addColorStop(1, "#5e646b");
  g.fillStyle = cw;
  g.fillRect(X(-0.6), Y(-2.5), 1.2 * S, 0.55 * S);
  g.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 3; j++)
      g.fillRect(X(-0.55 + i * 0.14 + (j % 2) * 0.07), Y(-2.45 + j * 0.17), 0.06 * S, 0.03 * S);
  // fifth wheel: plate, jaws slot, grease sheen
  const fw = g.createRadialGradient(X(-0.25), Y(0.05), 2, X(0), Y(0.3), 0.8 * S);
  fw.addColorStop(0, "#7b8087");
  fw.addColorStop(1, "#3d4146");
  g.fillStyle = fw;
  g.beginPath();
  g.arc(X(0), Y(0.3), 0.78 * S, 0, 7);
  g.fill();
  g.fillStyle = "rgba(20,20,20,0.6)";
  g.beginPath();
  g.arc(X(0), Y(0.3), 0.78 * S, 0.2, Math.PI - 0.2);
  g.lineTo(X(-0.15), Y(0.3));
  g.fill();
  g.fillStyle = "#151617";
  g.beginPath();
  g.moveTo(X(-0.1), Y(0.3));
  g.lineTo(X(-0.28), Y(1.15));
  g.lineTo(X(0.28), Y(1.15));
  g.lineTo(X(0.1), Y(0.3));
  g.fill();
  g.fillStyle = "#c8a400";
  g.fillRect(X(0.5), Y(0.15), 0.12 * S, 0.3 * S); // release handle
  // --- twin drive wheels with tread
  for (const s of [-1, 1]) {
    const x0 = X(s > 0 ? 0.74 : -1.26);
    for (const k of [0, 1]) {
      const xx = x0 + k * 0.26 * S;
      const tg = g.createLinearGradient(xx, 0, xx + 0.24 * S, 0);
      tg.addColorStop(0, "#0c0c0d");
      tg.addColorStop(0.5, "#2a2b2d");
      tg.addColorStop(1, "#0c0c0d");
      g.fillStyle = tg;
      rr(g, xx, Y(-0.53), 0.24 * S, 1.06 * S, 0.08 * S);
      g.fill();
      g.fillStyle = "rgba(0,0,0,0.6)";
      for (let t = -0.45; t < 0.5; t += 0.13) g.fillRect(xx + 0.02 * S, Y(t), 0.2 * S, 0.03 * S);
    }
    // quarter fender over the front half of the tyres
    g.fillStyle = "#18191b";
    rr(g, X(s > 0 ? 0.7 : -1.3), Y(-0.62), 0.6 * S, 0.5 * S, 0.12 * S);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(X(s > 0 ? 0.74 : -1.26), Y(-0.6), 0.52 * S, 0.05 * S);
    if (!hide.mud) {
      g.fillStyle = "#222";
      g.fillRect(X(s > 0 ? 0.72 : -1.28), Y(0.72), 0.56 * S, 0.1 * S);
      g.fillStyle = "#d0d4d8";
      g.fillRect(X(s > 0 ? 0.76 : -1.24), Y(0.73), 0.48 * S, 0.03 * S);
    }
  }
  // --- tanks: diesel (right, aluminium) + AdBlue/battery box (left)
  if (!hide.tnk) {
    const tg = g.createLinearGradient(X(0.78), 0, X(1.22), 0);
    tg.addColorStop(0, "#80878f");
    tg.addColorStop(0.45, "#eef1f4");
    tg.addColorStop(1, "#8b939b");
    g.fillStyle = tg;
    rr(g, X(0.78), Y(-2.4), 0.44 * S, 1.45 * S, 0.2 * S);
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.45)";
    for (const yy of [-2.05, -1.35]) g.fillRect(X(0.78), Y(yy), 0.44 * S, 0.05 * S);
    g.fillStyle = "#1b1c1e";
    g.beginPath();
    g.arc(X(1.0), Y(-2.25), 0.07 * S, 0, 7);
    g.fill();
    g.fillStyle = "#2c2f33";
    rr(g, X(-1.2), Y(-2.4), 0.42 * S, 0.8 * S, 0.06 * S);
    g.fill();
    g.fillStyle = "#3a6fd8";
    g.beginPath();
    g.arc(X(-0.99), Y(-2.2), 0.07 * S, 0, 7);
    g.fill();
    g.fillStyle = "#24272b";
    rr(g, X(-1.2), Y(-1.55), 0.42 * S, 0.55 * S, 0.04 * S);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.15)";
    g.fillRect(X(-1.18), Y(-1.53), 0.38 * S, 0.04 * S);
  }
  // --- stock exhaust: single vertical stack behind the cab (right side) with heat shield
  if (!hide.exh) {
    const cx = X(0.98),
      cy = Y(-2.42),
      r = 0.15 * S;
    const eg = g.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 1, cx, cy, r);
    eg.addColorStop(0, "#ffffff");
    eg.addColorStop(1, "#7f878f");
    g.fillStyle = eg;
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.fill();
    g.fillStyle = "#121212";
    g.beginPath();
    g.arc(cx, cy, r * 0.5, 0, 7);
    g.fill();
  }
  // --- cab
  const cabPath = () => {
    g.beginPath();
    g.moveTo(X(-1.1), Y(cab0));
    g.lineTo(X(1.1), Y(cab0));
    g.quadraticCurveTo(X(1.25), Y(cab0), X(1.25), Y(cab0 + 0.18));
    g.lineTo(X(1.25), Y(cab1 - 0.12));
    g.quadraticCurveTo(X(1.25), Y(cab1), X(1.12), Y(cab1));
    g.lineTo(X(-1.12), Y(cab1));
    g.quadraticCurveTo(X(-1.25), Y(cab1), X(-1.25), Y(cab1 - 0.12));
    g.lineTo(X(-1.25), Y(cab0 + 0.18));
    g.quadraticCurveTo(X(-1.25), Y(cab0), X(-1.1), Y(cab0));
    g.closePath();
  };
  // side wind deflectors (cab extenders) at the back corners
  g.fillStyle = shade(color, 0.55);
  for (const s of [-1, 1]) rr(g, X(s > 0 ? 1.17 : -1.3), Y(cab1 - 0.45), 0.13 * S, 0.55 * S, 0.05 * S);
  const grd = g.createLinearGradient(X(-1.25), 0, X(1.25), 0);
  grd.addColorStop(0, shade(color, 0.6));
  grd.addColorStop(0.12, shade(color, 0.92));
  grd.addColorStop(0.4, shade(color, 1.2));
  grd.addColorStop(0.85, shade(color, 0.9));
  grd.addColorStop(1, shade(color, 0.58));
  g.fillStyle = grd;
  cabPath();
  g.fill();
  g.save();
  cabPath();
  g.clip();
  // roof: raised centre panel with rounded shoulders, lengthwise shading (front slopes down to the windscreen)
  const lg = g.createLinearGradient(0, Y(cab0), 0, Y(cab1));
  lg.addColorStop(0, "rgba(0,0,0,0.28)");
  lg.addColorStop(0.18, "rgba(255,255,255,0.10)");
  lg.addColorStop(0.75, "rgba(0,0,0,0)");
  lg.addColorStop(1, "rgba(0,0,0,0.22)");
  g.fillStyle = lg;
  g.fillRect(X(-1.3), Y(cab0), 2.6 * S, (cab1 - cab0) * S);
  g.restore();
  // raised roof panel
  const rp = g.createLinearGradient(X(-0.95), 0, X(0.95), 0);
  rp.addColorStop(0, shade(color, 0.8));
  rp.addColorStop(0.35, shade(color, 1.32));
  rp.addColorStop(1, shade(color, 0.86));
  g.fillStyle = rp;
  rr(g, X(-0.95), Y(cab0 + 0.55), 1.9 * S, 1.6 * S, 0.3 * S);
  g.fill();
  g.strokeStyle = shade(color, 0.55);
  g.lineWidth = 1.2;
  g.stroke();
  // windscreen visible at the front edge (raked glass) + wipers
  const gw = g.createLinearGradient(X(-1.1), 0, X(1.1), 0);
  gw.addColorStop(0, "#0e1822");
  gw.addColorStop(0.3, "#35587a");
  gw.addColorStop(0.55, "#16263a");
  gw.addColorStop(1, "#0d151f");
  g.fillStyle = gw;
  rr(g, X(-1.12), Y(cab0 + 0.04), 2.24 * S, 0.34 * S, 0.1 * S);
  g.fill();
  g.fillStyle = "rgba(200,230,255,0.55)";
  g.fillRect(X(-0.85), Y(cab0 + 0.09), 0.5 * S, 0.05 * S);
  g.strokeStyle = "#111";
  g.lineWidth = 0.035 * S;
  for (const s of [-0.55, 0.35]) {
    g.beginPath();
    g.moveTo(X(s), Y(cab0 + 0.36));
    g.lineTo(X(s + 0.45), Y(cab0 + 0.1));
    g.stroke();
  }
  // roof hatch (smoked glass in a frame) + antenna + roof-mounted air horns
  g.fillStyle = "#2a2e33";
  rr(g, X(-0.32), Y(-3.55), 0.64 * S, 0.5 * S, 0.06 * S);
  g.fill();
  const hg = g.createLinearGradient(X(-0.28), Y(-3.5), X(0.28), Y(-3.1));
  hg.addColorStop(0, "#5f7a91");
  hg.addColorStop(1, "#1a2633");
  g.fillStyle = hg;
  rr(g, X(-0.27), Y(-3.5), 0.54 * S, 0.4 * S, 0.04 * S);
  g.fill();
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(X(-0.75), Y(-2.85), 0.05 * S, 0, 7);
  g.fill();
  for (const s of [0.55, 0.78]) {
    const ag = g.createLinearGradient(X(s - 0.07), 0, X(s + 0.07), 0);
    ag.addColorStop(0, "#8d959e");
    ag.addColorStop(0.5, "#ffffff");
    ag.addColorStop(1, "#8d959e");
    g.fillStyle = ag;
    rr(g, X(s - 0.06), Y(-3.1), 0.12 * S, 0.42 * S, 0.05 * S);
    g.fill();
  }
  // roof marker lamps along the front edge of the roof (replaced by a fitted light bar)
  if (!hide.lamps) {
    for (const s of [-0.6, -0.3, 0, 0.3, 0.6]) {
      g.fillStyle = "#2a2a2a";
      rr(g, X(s) - 0.07 * S, Y(cab0 + 0.44), 0.14 * S, 0.09 * S, 0.03 * S);
      g.fill();
      g.fillStyle = "#f5a623";
      rr(g, X(s) - 0.055 * S, Y(cab0 + 0.452), 0.11 * S, 0.06 * S, 0.02 * S);
      g.fill();
    }
  }
  // grab handles / door tops along the sides
  g.fillStyle = "rgba(0,0,0,0.28)";
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 1.12 : -1.2), Y(cab0 + 0.6), 0.08 * S, 1.0 * S);
  // headlamps + indicators on the front edge, bumper corner steps
  for (const s2 of [-1, 1]) {
    const hx = X(s2 * 0.8) - 0.24 * S;
    g.fillStyle = "#15171a";
    rr(g, hx, Y(cab0 - 0.05), 0.48 * S, 0.12 * S, 0.04 * S);
    g.fill();
    const hl = g.createLinearGradient(hx, 0, hx + 0.48 * S, 0);
    hl.addColorStop(0, "#f4f6f2");
    hl.addColorStop(1, "#aeb8bf");
    g.fillStyle = hl;
    rr(g, hx + 0.03 * S, Y(cab0 - 0.035), 0.42 * S, 0.07 * S, 0.03 * S);
    g.fill();
    g.fillStyle = "#f0a020";
    g.fillRect(X(s2 * 1.17) - 0.06 * S, Y(cab0 + 0.01), 0.12 * S, 0.1 * S);
  }
  g.fillStyle = "#2d3034";
  rr(g, X(-1.15), Y(cab0 - 0.12), 2.3 * S, 0.1 * S, 0.04 * S);
  g.fill();
  // mirrors: arm from the A-pillar, main + wide-angle glass, plus the kerb mirror on the nearside front
  for (const s of [-1, 1]) {
    g.strokeStyle = "#1d1f22";
    g.lineWidth = 0.06 * S;
    g.beginPath();
    g.moveTo(X(s * 1.2), Y(cab0 + 0.3));
    g.lineTo(X(s * 1.42), Y(cab0 + 0.05));
    g.stroke();
    g.fillStyle = "#18191b";
    rr(g, X(s > 0 ? 1.34 : -1.56), Y(cab0 - 0.12), 0.22 * S, 0.5 * S, 0.06 * S);
    g.fill();
    g.fillStyle = "#9aa3ab";
    g.fillRect(X(s > 0 ? 1.37 : -1.53), Y(cab0 - 0.09), 0.16 * S, 0.24 * S);
    g.fillStyle = "#7d868e";
    g.fillRect(X(s > 0 ? 1.37 : -1.53), Y(cab0 + 0.18), 0.16 * S, 0.14 * S);
  }
  g.fillStyle = "#18191b";
  rr(g, X(-0.95), Y(cab0 - 0.32), 0.34 * S, 0.16 * S, 0.05 * S);
  g.fill();
  g.strokeStyle = "#18191b";
  g.lineWidth = 0.04 * S;
  g.beginPath();
  g.moveTo(X(-0.9), Y(cab0 + 0.05));
  g.lineTo(X(-0.82), Y(cab0 - 0.2));
  g.stroke();
  // rear of cab: rivets + highlight edge + outline
  artRivets(g, X(-1.05), Y(cab1 - 0.12), X(1.05), Y(cab1 - 0.12), 0.3 * S, 1.0);
  g.strokeStyle = "rgba(255,255,255,0.3)";
  g.lineWidth = 1.2;
  rr(g, X(-1.19), Y(cab0 + 0.07), 2.38 * S, (cab1 - cab0 - 0.14) * S, 0.3 * S);
  g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.lineWidth = 2;
  cabPath();
  g.stroke();
  artGrime(g, W, H, 7, 0.35, [Y(0)]);
  return { c, W, H, ox: W / 2, oy: Y(0) };
}
// ---------------- side profile (garage / customiser turntable) ----------------
function rigSide(g, cx, cy, sc, m, col, fit) {
  const L = czLook(m.id, fit),
    hide = rigHide(fit, L);
  col = L.col || col;
  const X = (v) => cx + v * sc,
    Y = (v) => cy - v * sc,
    body = shade(col, 1),
    dark = shade(col, 0.68),
    lite = shade(col, 1.28);
  const roofH = 3.2,
    cf = -5.0,
    cb = -2.4;
  // ground shadow
  g.fillStyle = "rgba(0,0,0,0.38)";
  g.beginPath();
  g.ellipse(X(-1.9), Y(-0.03), 4.5 * sc, 0.22 * sc, 0, 0, 7);
  g.fill();
  // chassis rail + crossmember ends, fifth wheel, catwalk
  g.fillStyle = "#1e2023";
  g.fillRect(X(-4.6), Y(1.32), 5.85 * sc, 0.34 * sc);
  g.fillStyle = "#34383d";
  g.fillRect(X(-4.6), Y(1.32), 5.85 * sc, 0.05 * sc);
  const fw = g.createLinearGradient(0, Y(1.62), 0, Y(1.42));
  fw.addColorStop(0, "#80868d");
  fw.addColorStop(1, "#3c4045");
  g.fillStyle = fw;
  g.fillRect(X(-0.8), Y(1.62), 1.6 * sc, 0.16 * sc);
  g.fillStyle = "#2a2d31";
  g.fillRect(X(-0.6), Y(1.47), 1.2 * sc, 0.12 * sc);
  g.fillStyle = "#a8aeb5";
  g.fillRect(X(-2.38), Y(1.72), 0.6 * sc, 0.06 * sc);
  // air lines draped from the cab back
  g.lineWidth = 0.05 * sc;
  [
    ["#c0392b", 2.6],
    ["#2e6fd0", 2.45],
  ].forEach(([c, h]) => {
    g.strokeStyle = c;
    g.beginPath();
    g.moveTo(X(-2.38), Y(h));
    g.bezierCurveTo(X(-2.0), Y(h - 0.9), X(-1.5), Y(h - 0.2), X(-0.9), Y(1.8));
    g.stroke();
  });
  // battery box / air tank under the chassis
  g.fillStyle = "#26292d";
  rr(g, X(-0.7), Y(1.3), 0.5 * sc, 0.45 * sc, 0.04 * sc);
  g.fill();
  const at = g.createLinearGradient(0, Y(1.3), 0, Y(1.0));
  at.addColorStop(0, "#8e959c");
  at.addColorStop(0.5, "#d4d8dc");
  at.addColorStop(1, "#6c737a");
  g.fillStyle = at;
  rr(g, X(-2.2), Y(1.3), 0.28 * sc, 0.28 * sc, 0.12 * sc);
  g.fill();
  // stock fuel tank (aluminium, D-section) with straps + filler cap
  if (!hide.tnk) {
    const tg = g.createLinearGradient(0, Y(1.32), 0, Y(0.62));
    tg.addColorStop(0, "#f4f6f8");
    tg.addColorStop(0.35, "#c3c9cf");
    tg.addColorStop(0.8, "#8a9198");
    tg.addColorStop(1, "#5e646a");
    g.fillStyle = tg;
    rr(g, X(-1.85), Y(1.32), 1.15 * sc, 0.7 * sc, 0.14 * sc);
    g.fill();
    g.fillStyle = "#2a2d30";
    for (const x of [-1.6, -0.98]) g.fillRect(X(x), Y(1.33), 0.06 * sc, 0.72 * sc);
    g.fillStyle = "#1b1c1e";
    rr(g, X(-1.35), Y(1.42), 0.18 * sc, 0.1 * sc, 0.03 * sc);
    g.fill();
  }
  // stock exhaust: vertical stack + heat shield behind the cab (hidden when an exhaust mod is fitted)
  if (!hide.exh) {
    const eg = g.createLinearGradient(X(-2.32), 0, X(-2.12), 0);
    eg.addColorStop(0, "#7d858e");
    eg.addColorStop(0.45, "#ffffff");
    eg.addColorStop(1, "#7d858e");
    g.fillStyle = eg;
    g.fillRect(X(-2.32), Y(roofH + 0.35), 0.2 * sc, (roofH + 0.35 - 1.6) * sc);
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let k = 0; k < 7; k++) g.fillRect(X(-2.32), Y(2.2 + k * 0.1), 0.2 * sc, 0.03 * sc);
    g.fillStyle = "#2a2a2a";
    g.beginPath();
    g.ellipse(X(-2.22), Y(roofH + 0.35), 0.1 * sc, 0.03 * sc, 0, 0, 7);
    g.fill();
  }
  // rear quarter fender over the drive wheel + mud flap
  g.fillStyle = "#151618";
  g.beginPath();
  g.arc(X(0), Y(0.5), 0.66 * sc, Math.PI * 1.05, Math.PI * 1.95);
  g.arc(X(0), Y(0.5), 0.58 * sc, Math.PI * 1.95, Math.PI * 1.05, true);
  g.fill();
  if (!hide.mud) {
    g.fillStyle = "#1c1d1f";
    g.fillRect(X(0.62), Y(1.05), 0.07 * sc, 0.88 * sc);
    g.fillStyle = "#cfd3d7";
    g.fillRect(X(0.62), Y(0.3), 0.07 * sc, 0.1 * sc);
  }
  // ---- cab body (cab-over, slight windscreen rake, front wheel arch)
  const ar = 0.7,
    ay = 0.82,
    adx = Math.sqrt(ar * ar - (ay - 0.5) * (ay - 0.5)),
    aa = Math.atan2(ay - 0.5, adx);
  const cabPath = () => {
    g.beginPath();
    g.moveTo(X(cb), Y(ay));
    g.lineTo(X(-3.8 + adx), Y(ay));
    g.arc(X(-3.8), Y(0.5), ar * sc, -aa, -Math.PI + aa, true);
    g.lineTo(X(cf + 0.05), Y(ay));
    g.lineTo(X(cf - 0.03), Y(1.1));
    g.lineTo(X(cf - 0.06), Y(2.2));
    g.lineTo(X(cf + 0.14), Y(2.98));
    g.quadraticCurveTo(X(cf + 0.24), Y(roofH), X(cf + 0.55), Y(roofH));
    g.lineTo(X(cb - 0.22), Y(roofH));
    g.quadraticCurveTo(X(cb), Y(roofH), X(cb), Y(roofH - 0.22));
    g.closePath();
  };
  const gr = g.createLinearGradient(0, Y(roofH), 0, Y(ay));
  gr.addColorStop(0, lite);
  gr.addColorStop(0.12, body);
  gr.addColorStop(0.55, body);
  gr.addColorStop(1, dark);
  g.fillStyle = gr;
  cabPath();
  g.fill();
  g.save();
  cabPath();
  g.clip();
  // body-side crease highlight + lower dark trim band (sill/step panel)
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.fillRect(X(cf), Y(2.18), (cb - cf) * sc, 0.05 * sc);
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(X(cf), Y(2.13), (cb - cf) * sc, 0.04 * sc);
  g.fillStyle = "#2b2e32";
  g.fillRect(X(cf - 0.2), Y(1.18), (cb - cf + 0.3) * sc, 0.4 * sc);
  // paint finish sheen
  if (L.fin === "chrome" || L.fin === "metal" || L.fin === "pearl") {
    const sg = g.createLinearGradient(X(cf), 0, X(cb), 0);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, L.fin === "pearl" ? "rgba(140,255,240,0.3)" : "rgba(255,255,255,0.45)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sg;
    g.fillRect(X(cf), Y(roofH), 3 * sc, roofH * sc);
  }
  // stripes
  if (L.strp === "flame") {
    const fg = g.createLinearGradient(X(cf), 0, X(cb), 0);
    fg.addColorStop(0, "#ffe066");
    fg.addColorStop(0.5, "#ff7b00");
    fg.addColorStop(1, "rgba(200,30,0,0)");
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(X(cf), Y(1.6));
    for (let k = 0; k <= 8; k++) g.lineTo(X(cf + k * 0.33), Y(1.6 + (k % 2 ? 0.9 : 0.4) * (1 - k / 9)));
    g.lineTo(X(cb), Y(1.6));
    g.fill();
  } else if (L.strp === "twin" || L.strp === "chev") {
    g.fillStyle = L.strp === "twin" ? "#fff" : "#f5b82e";
    g.fillRect(X(cf), Y(1.85), (cb - cf) * sc, 0.12 * sc);
    g.fillRect(X(cf), Y(2.05), (cb - cf) * sc, 0.06 * sc);
  } else if (L.strp === "check") {
    for (let i = 0; i < 15; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? "#111" : "#fff";
        g.fillRect(X(cf + i * 0.185), Y(1.95 - j * 0.18), 0.185 * sc, 0.18 * sc);
      }
  }
  g.restore();
  // panel gaps: door, sleeper locker, front grille panel
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = Math.max(1, 0.025 * sc);
  g.beginPath();
  g.moveTo(X(-4.55), Y(2.98));
  g.lineTo(X(-3.15), Y(2.98));
  g.lineTo(X(-3.15), Y(1.2));
  g.lineTo(X(-4.42), Y(1.2));
  g.quadraticCurveTo(X(-4.62), Y(1.4), X(-4.66), Y(2.2));
  g.closePath();
  g.stroke();
  g.strokeRect(X(-3.05), Y(1.95), 0.55 * sc, 0.6 * sc); // sleeper storage locker
  g.beginPath();
  g.moveTo(X(-4.82), Y(1.2));
  g.lineTo(X(-4.86), Y(2.15));
  g.stroke();
  // door handle + key
  g.fillStyle = "#cfd3d8";
  rr(g, X(-3.55), Y(2.12), 0.28 * sc, 0.06 * sc, 0.03 * sc);
  g.fill();
  // side window (door) + small sleeper window, tinted with sky reflection
  const wp = () => {
    g.beginPath();
    g.moveTo(X(-4.62), Y(2.28));
    g.lineTo(X(-4.5), Y(2.88));
    g.lineTo(X(-3.25), Y(2.88));
    g.lineTo(X(-3.25), Y(2.28));
    g.closePath();
  };
  const wg = g.createLinearGradient(0, Y(2.88), 0, Y(2.28));
  wg.addColorStop(0, "#4b6c8a");
  wg.addColorStop(0.5, "#1d2e40");
  wg.addColorStop(1, "#0f1822");
  g.fillStyle = wg;
  wp();
  g.fill();
  g.save();
  wp();
  g.clip();
  g.fillStyle = "rgba(220,240,255,0.25)";
  g.beginPath();
  g.moveTo(X(-4.4), Y(2.88));
  g.lineTo(X(-4.1), Y(2.88));
  g.lineTo(X(-4.45), Y(2.28));
  g.lineTo(X(-4.75), Y(2.28));
  g.fill();
  g.restore();
  g.strokeStyle = "#111";
  g.lineWidth = Math.max(1, 0.03 * sc);
  wp();
  g.stroke();
  g.fillStyle = "#16212d";
  rr(g, X(-2.95), Y(2.88), 0.35 * sc, 0.28 * sc, 0.05 * sc);
  g.fill();
  // windscreen edge (raked glass seen side-on) + A-pillar
  g.fillStyle = "#132233";
  g.beginPath();
  g.moveTo(X(cf - 0.06), Y(2.24));
  g.lineTo(X(cf + 0.14), Y(2.96));
  g.lineTo(X(cf + 0.24), Y(2.96));
  g.lineTo(X(cf + 0.04), Y(2.24));
  g.closePath();
  g.fill();
  // grille edge (front face) with chrome slats, badge strip
  g.fillStyle = "#1a1c1f";
  g.fillRect(X(cf - 0.06), Y(2.15), 0.1 * sc, 0.95 * sc);
  g.fillStyle = "#c9ced4";
  for (let k = 0; k < 5; k++) g.fillRect(X(cf - 0.07), Y(2.08 - k * 0.18), 0.05 * sc, 0.05 * sc);
  // bumper (dark plastic) with headlamp + fog lamp + corner indicator, front underrun
  g.fillStyle = "#26292d";
  rr(g, X(cf - 0.1), Y(1.2), 0.75 * sc, 0.5 * sc, 0.06 * sc);
  g.fill();
  g.fillStyle = "#3a3e43";
  g.fillRect(X(cf - 0.1), Y(1.2), 0.75 * sc, 0.05 * sc);
  g.fillStyle = "#fff5c8";
  g.fillRect(X(cf - 0.11), Y(1.13), 0.09 * sc, 0.18 * sc); // headlamp
  g.fillStyle = "#f0a020";
  g.fillRect(X(cf - 0.04), Y(1.13), 0.16 * sc, 0.12 * sc); // corner indicator
  g.fillStyle = "#e8ecef";
  g.fillRect(X(cf - 0.1), Y(0.86), 0.06 * sc, 0.08 * sc); // fog lamp
  // entry steps (two treads) behind the front wheel, under the door
  g.fillStyle = "#121314";
  rr(g, X(-3.12), Y(1.18), 0.62 * sc, 0.62 * sc, 0.05 * sc);
  g.fill();
  g.fillStyle = "#9da3aa";
  for (const h of [1.12, 0.78]) g.fillRect(X(-3.08), Y(h), 0.54 * sc, 0.05 * sc);
  // grab handle beside the door
  g.fillStyle = "#cfd3d8";
  g.fillRect(X(-3.07), Y(2.9), 0.04 * sc, 0.8 * sc);
  // side marker lamps along the chassis
  g.fillStyle = "#f5a623";
  for (const x of [-2.0, -0.4]) g.fillRect(X(x), Y(1.62), 0.08 * sc, 0.05 * sc);
  // roof marker lamps (replaced by a roof light bar mod), sun-roof hatch bump, antenna
  if (!hide.lamps) {
    g.fillStyle = "#f5a623";
    for (const x of [-4.45, -4.25]) g.fillRect(X(x), Y(roofH + 0.06), 0.12 * sc, 0.06 * sc);
  }
  g.fillStyle = shade(col, 1.15);
  rr(g, X(-3.55), Y(roofH + 0.06), 0.55 * sc, 0.08 * sc, 0.03 * sc);
  g.fill();
  g.strokeStyle = "#111";
  g.lineWidth = Math.max(1, 0.02 * sc);
  g.beginPath();
  g.moveTo(X(-2.75), Y(roofH));
  g.lineTo(X(-2.6), Y(roofH + 0.45));
  g.stroke();
  // mirrors: arm off the A-pillar, main + wide-angle heads
  g.strokeStyle = "#1d1f22";
  g.lineWidth = Math.max(1.5, 0.05 * sc);
  g.beginPath();
  g.moveTo(X(cf + 0.15), Y(2.95));
  g.lineTo(X(cf - 0.28), Y(3.05));
  g.moveTo(X(cf + 0.05), Y(2.35));
  g.lineTo(X(cf - 0.28), Y(2.3));
  g.stroke();
  g.fillStyle = "#18191b";
  rr(g, X(cf - 0.4), Y(3.1), 0.16 * sc, 0.55 * sc, 0.05 * sc);
  g.fill();
  rr(g, X(cf - 0.4), Y(2.48), 0.16 * sc, 0.3 * sc, 0.05 * sc);
  g.fill();
  // body outline
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = Math.max(1, 0.02 * sc);
  cabPath();
  g.stroke();
  // wheels: tyre with sidewall shading, steel/alloy rim, stud nuts, hub
  const bk = czPart(fit.brk),
    ty = czPart(fit.tyre);
  for (const ax of [-3.8, 0]) {
    const wx = X(ax),
      wy = Y(0.5),
      r = 0.5 * sc;
    const tg = g.createRadialGradient(wx, wy, r * 0.6, wx, wy, r);
    tg.addColorStop(0, "#2e3033");
    tg.addColorStop(0.7, "#17181a");
    tg.addColorStop(1, "#0a0a0b");
    g.fillStyle = tg;
    g.beginPath();
    g.arc(wx, wy, r, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(wx, wy, r * 0.9, Math.PI * 1.1, Math.PI * 1.6);
    g.stroke();
    if (ty) {
      g.strokeStyle = ty.id === "tyre2" ? "#7dff9a" : "#eee";
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(wx, wy, r * 0.82, -2.6, -0.6);
      g.stroke();
    }
    const rim = L.rc || (ax === 0 ? "#b8bec5" : "#d5d9dd");
    const rg = g.createRadialGradient(wx - r * 0.15, wy - r * 0.15, 1, wx, wy, r * 0.64);
    rg.addColorStop(0, "#ffffff");
    rg.addColorStop(0.5, rim);
    rg.addColorStop(1, shade(rim.length === 7 ? rim : "#9aa1a8", 0.6));
    g.fillStyle = rg;
    g.beginPath();
    g.arc(wx, wy, r * 0.62, 0, 7);
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.arc(wx, wy, r * 0.5, 0, 7);
    g.fill();
    g.fillStyle = rg;
    g.beginPath();
    g.arc(wx, wy, r * 0.44, 0, 7);
    g.fill();
    if (bk) {
      g.fillStyle = bk.cl;
      g.fillRect(wx + r * 0.15, wy - r * 0.45, r * 0.25, r * 0.5);
    }
    // hand holes (steel) or spokes (rim mods)
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 1.2;
    if (L.rim === "star" || L.rim === "spoke" || L.rim === "split") {
      const n = L.rim === "star" ? 5 : L.rim === "spoke" ? 10 : 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        g.beginPath();
        g.moveTo(wx, wy);
        g.lineTo(wx + Math.cos(a) * r * 0.55, wy + Math.sin(a) * r * 0.55);
        g.stroke();
      }
    } else
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        g.beginPath();
        g.ellipse(wx + Math.cos(a) * r * 0.36, wy + Math.sin(a) * r * 0.36, r * 0.07, r * 0.05, a, 0, 7);
        g.fill();
      }
    // hub: drive axle has the deep hub reduction, steer axle a flat cap; 10 stud nuts
    const hr = ax === 0 ? 0.24 : 0.2;
    const hg = g.createRadialGradient(wx - 2, wy - 2, 1, wx, wy, r * hr);
    hg.addColorStop(0, "#f2f4f6");
    hg.addColorStop(1, "#5c636a");
    g.fillStyle = hg;
    g.beginPath();
    g.arc(wx, wy, r * hr, 0, 7);
    g.fill();
    g.fillStyle = "#e6e9ec";
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      g.beginPath();
      g.arc(wx + Math.cos(a) * r * (hr + 0.07), wy + Math.sin(a) * r * (hr + 0.07), Math.max(1, r * 0.03), 0, 7);
      g.fill();
    }
    g.fillStyle = "#2a2d30";
    g.beginPath();
    g.arc(wx, wy, r * 0.07, 0, 7);
    g.fill();
  }
  // engine mod intake (as before)
  const en = czPart(fit.eng);
  if (en && en.lv >= 2) {
    g.fillStyle = "#9aa2ab";
    g.fillRect(X(-2.75), Y(roofH - 0.1), 0.2 * sc, (roofH - 1.4) * sc);
  }
}

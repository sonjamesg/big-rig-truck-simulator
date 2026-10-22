/**
 * @file rigart.js — art for the starter truck ("rigger"): rigTopArt (top-down, in game) and rigSide
 * (side profile, garage / customiser). Modern European high-roof cab-over: near-vertical front, curved
 * roof with sloped spoiler, black B-pillar deflector, deep full-width bumper with lamps, real wheel arches,
 * black tank box between the axles. Geometry keeps the old cab footprint (front -5.0, back -2.4/-2.55,
 * axles -3.8 / 0) so customisation parts line up. Stock parts that a fitted mod replaces are hidden
 * (exhaust, tank face, mud flaps, roof marker lamps, roof spoiler); the tank / skirt / mud flap / exhaust
 * mods are drawn here for this truck so they sit inside the body instead of as boxes.
 */
// Truck as parts with real dimensions (metres; x along length, front = -, origin = drive axle; y up from road;
// z across, + = right). Both current views read from this; a future 360 turntable (front / rear / rotated views)
// can project the same boxes/cylinders instead of a hand-drawn profile. Paint + mods come from rigLook().
const RIG = {
  cab: { x0: -5.0, x1: -2.4, z: 1.25, floor: 1.0, roof: 3.0, topRear: -2.55 },
  spoiler: { x0: -4.7, top: 3.72, topAero: 3.95 },
  bpillar: { x: -2.4, w: 0.2 },
  bumper: { bottom: 0.45, top: 1.4, depth: 0.95, lamps: 1.1 },
  arch: { pad: 0.17 },
  wheels: { r: 0.52, w: 0.3, axles: [{ x: -3.8, twin: false }, { x: 0, twin: true }], track: 1.0 },
  chassis: { x0: -2.6, x1: 1.25, y0: 1.25, h: 0.32, rail: 0.56 },
  fifth: { x: 0, r: 0.78, y: 1.42 },
  tankBox: { x0: -2.38, x1: -0.66, y0: 0.52, y1: 1.3, z: 1.24, w: 0.46 },
  exhaust: { x: -2.37, z: 0.98, top: 3.25 },
  mirrors: { x: -5.15, y: 2.2, h: 0.75, z: 1.45 },
  // mod slots this truck draws itself (others come from tune*.js overlays)
  slots: ["tnk", "skt", "mud", "exh", "exs", "spl", "rbar"],
};
// shared paint / mod model for any view: body colour, finish, stripes, rims, which stock parts are swapped out
function rigLook(m, col, fit) {
  const L = czLook(m.id, fit || {});
  return { L, col: L.col || col, hide: rigHide(fit, L) };
}
function rigHide(fit, L) {
  fit = fit || {};
  L = L || {};
  const p = (s) => (typeof czPart === "function" ? czPart(fit[s]) : null),
    tk = p("tnk");
  return { exh: !!(L.exs || p("exh")), tnk: tk ? tk.lv : 0, mud: !!L.mud, lamps: !!L.rbar, spl: !!L.spl };
}
function rigHideKey(h) {
  return h ? (h.exh ? "e" : "") + (h.tnk || "") + (h.mud ? "m" : "") + (h.lamps ? "l" : "") + (h.spl ? "s" : "") : "";
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
  const cab0 = RIG.cab.x0,
    cab1 = RIG.cab.topRear;
  // chassis rails + fifth wheel
  g.fillStyle = "#1c1d20";
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 0.22 : -0.56), Y(-2.9), 0.34 * S, 4.05 * S);
  g.fillStyle = "#26282c";
  g.fillRect(X(-0.56), Y(-2.5), 1.12 * S, 0.5 * S);
  g.fillStyle = "#4a4e54";
  g.beginPath();
  g.arc(X(0), Y(0.3), 0.78 * S, 0, 7);
  g.fill();
  g.fillStyle = "#5c6067";
  g.beginPath();
  g.arc(X(-0.05), Y(0.25), 0.62 * S, 0, 7);
  g.fill();
  g.fillStyle = "#18191b";
  g.beginPath();
  g.moveTo(X(-0.1), Y(0.3));
  g.lineTo(X(-0.26), Y(1.15));
  g.lineTo(X(0.26), Y(1.15));
  g.lineTo(X(0.1), Y(0.3));
  g.fill();
  // twin drive tyres (dark grey) under arched fenders
  for (const s of [-1, 1]) {
    for (const k of [0, 1]) {
      const xx = X(s > 0 ? 0.74 : -1.26) + k * 0.26 * S;
      g.fillStyle = "#2c2f33";
      rr(g, xx, Y(-0.54), 0.24 * S, 1.08 * S, 0.1 * S);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.07)";
      g.fillRect(xx + 0.04 * S, Y(-0.5), 0.05 * S, 1.0 * S);
    }
    g.fillStyle = "#141517";
    rr(g, X(s > 0 ? 0.7 : -1.3), Y(-0.66), 0.6 * S, 0.72 * S, 0.2 * S);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(X(s > 0 ? 0.74 : -1.26), Y(-0.62), 0.52 * S, 0.04 * S);
    if (!hide.mud) {
      g.fillStyle = "#18191b";
      g.fillRect(X(s > 0 ? 0.72 : -1.28), Y(0.66), 0.56 * S, 0.12 * S);
    }
  }
  // tank boxes between the axles (black), aluminium tank face when the tank mod is fitted
  for (const s of [-1, 1]) {
    const x0 = X(s > 0 ? 0.78 : -1.24);
    g.fillStyle = "#17181a";
    rr(g, x0, Y(-2.45), 0.46 * S, 1.65 * S, 0.06 * S);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.fillRect(x0, Y(-2.45), 0.46 * S, 0.04 * S);
    if (hide.tnk && (s > 0 || hide.tnk >= 3)) {
      const len = 0.6 + hide.tnk * 0.22;
      const tg = g.createLinearGradient(x0, 0, x0 + 0.42 * S, 0);
      tg.addColorStop(0, "#8f979f");
      tg.addColorStop(0.5, "#dfe4e8");
      tg.addColorStop(1, "#8f979f");
      g.fillStyle = tg;
      rr(g, x0 + 0.03 * S, Y(-2.38), 0.4 * S, len * S, 0.15 * S);
      g.fill();
      g.fillStyle = "#1b1c1e";
      g.beginPath();
      g.arc(x0 + 0.23 * S, Y(-2.25), 0.06 * S, 0, 7);
      g.fill();
    }
  }
  // stock exhaust: one flat-topped stack behind the cab (hidden when an exhaust mod is fitted)
  if (!hide.exh) {
    g.fillStyle = "#8d949b";
    g.beginPath();
    g.arc(X(0.98), Y(-2.42), 0.14 * S, 0, 7);
    g.fill();
    g.fillStyle = "#1a1a1a";
    g.beginPath();
    g.arc(X(0.98), Y(-2.42), 0.07 * S, 0, 7);
    g.fill();
  }
  // cab body
  const cabPath = () => {
    g.beginPath();
    g.moveTo(X(-1.08), Y(cab0));
    g.lineTo(X(1.08), Y(cab0));
    g.quadraticCurveTo(X(1.25), Y(cab0), X(1.25), Y(cab0 + 0.2));
    g.lineTo(X(1.25), Y(cab1));
    g.lineTo(X(-1.25), Y(cab1));
    g.lineTo(X(-1.25), Y(cab0 + 0.2));
    g.quadraticCurveTo(X(-1.25), Y(cab0), X(-1.08), Y(cab0));
    g.closePath();
  };
  g.fillStyle = shade(color, 0.95);
  cabPath();
  g.fill();
  // flat side shading: darker shoulders, lighter crown
  g.save();
  cabPath();
  g.clip();
  g.fillStyle = shade(color, 0.72);
  g.fillRect(X(-1.25), Y(cab0), 0.16 * S, (cab1 - cab0) * S);
  g.fillRect(X(1.09), Y(cab0), 0.16 * S, (cab1 - cab0) * S);
  g.fillStyle = shade(color, 0.85);
  g.fillRect(X(-1.25), Y(cab0), 2.5 * S, 0.5 * S); // front slope down to the windscreen
  g.restore();
  // roof spoiler: tapered panel, widest at the back
  if (!hide.spl) {
    g.fillStyle = shade(color, 1.18);
    g.beginPath();
    g.moveTo(X(-0.7), Y(-4.2));
    g.lineTo(X(0.7), Y(-4.2));
    g.quadraticCurveTo(X(1.05), Y(-3.2), X(1.08), Y(cab1 - 0.08));
    g.lineTo(X(-1.08), Y(cab1 - 0.08));
    g.quadraticCurveTo(X(-1.05), Y(-3.2), X(-0.7), Y(-4.2));
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(X(-0.55), Y(-4.1), 0.18 * S, 1.3 * S);
    g.fillStyle = "#151618";
    g.fillRect(X(-1.08), Y(cab1 - 0.14), 2.16 * S, 0.08 * S);
  } else {
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(X(-0.55), Y(-4.3), 0.18 * S, 1.5 * S);
  }
  // black B-pillar deflectors at the rear corners
  g.fillStyle = "#121314";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(X(s * 1.25), Y(cab1 - 0.35));
    g.lineTo(X(s * 1.34), Y(cab1 - 0.05));
    g.lineTo(X(s * 1.3), Y(cab1 + 0.05));
    g.lineTo(X(s * 1.18), Y(cab1 + 0.05));
    g.lineTo(X(s * 1.18), Y(cab1 - 0.35));
    g.closePath();
    g.fill();
  }
  // windscreen sliver + bumper lip
  g.fillStyle = "#16212c";
  rr(g, X(-1.1), Y(cab0 + 0.04), 2.2 * S, 0.22 * S, 0.08 * S);
  g.fill();
  g.fillStyle = "rgba(200,230,255,0.4)";
  g.fillRect(X(-0.85), Y(cab0 + 0.08), 0.5 * S, 0.04 * S);
  g.fillStyle = "#1a1b1d";
  rr(g, X(-1.2), Y(cab0 - 0.1), 2.4 * S, 0.12 * S, 0.05 * S);
  g.fill();
  for (const s2 of [-1, 1]) {
    g.fillStyle = "#e9ecee";
    g.fillRect(X(s2 * 0.82) - 0.2 * S, Y(cab0 - 0.08), 0.4 * S, 0.06 * S);
    g.fillStyle = "#f0a020";
    g.fillRect(X(s2 * 1.13) - 0.06 * S, Y(cab0 - 0.08), 0.12 * S, 0.06 * S);
  }
  // roof marker lamps (replaced by a light bar mod)
  if (!hide.lamps) {
    g.fillStyle = "#f5a623";
    for (const s of [-0.5, -0.25, 0, 0.25, 0.5]) g.fillRect(X(s) - 0.05 * S, Y(cab0 + 0.36), 0.1 * S, 0.06 * S);
  }
  // mirrors on short arms
  for (const s of [-1, 1]) {
    g.strokeStyle = "#151618";
    g.lineWidth = 0.06 * S;
    g.beginPath();
    g.moveTo(X(s * 1.2), Y(cab0 + 0.25));
    g.lineTo(X(s * 1.42), Y(cab0 + 0.05));
    g.stroke();
    g.fillStyle = "#151618";
    rr(g, X(s > 0 ? 1.34 : -1.54), Y(cab0 - 0.1), 0.2 * S, 0.45 * S, 0.06 * S);
    g.fill();
  }
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 1.5;
  cabPath();
  g.stroke();
  artGrime(g, W, H, 7, 0.25, [Y(0)]);
  return { c, W, H, ox: W / 2, oy: Y(0) };
}
// ---------------- side profile ----------------
function rigSide(g, cx, cy, sc, m, col, fit) {
  const lk = rigLook(m, col, fit),
    L = lk.L,
    hide = lk.hide;
  col = lk.col;
  const X = (v) => cx + v * sc,
    Y = (v) => cy - v * sc,
    body = shade(col, 1),
    dark = shade(col, 0.72),
    lite = shade(col, 1.15);
  const cf = RIG.cab.x0,
    cb = RIG.cab.x1,
    WR = RIG.wheels.r, // real 315/80 R22.5 ~ 1.07 m dia
    WY = RIG.wheels.r,
    roof = RIG.cab.roof,
    floor = RIG.cab.floor,
    fx = (y) => cf + (y - 0.45) * 0.03; // near-vertical front, tiny lean back
  const tk = czPart(fit.tnk),
    ex = czPart(fit.exh),
    es = L.exs || (ex ? "chrome" : null),
    bk = czPart(fit.brk),
    ty = czPart(fit.tyre);
  const fill = (c, f) => {
    g.fillStyle = c;
    g.beginPath();
    f();
    g.fill();
  };
  // ground shadow
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath();
  g.ellipse(X(-1.9), Y(-0.02), 4.4 * sc, 0.18 * sc, 0, 0, 7);
  g.fill();
  // chassis rail + fifth wheel
  g.fillStyle = "#151618";
  g.fillRect(X(-2.6), Y(1.25), 3.85 * sc, 0.32 * sc);
  g.fillStyle = "#3b3f44";
  g.fillRect(X(-0.75), Y(1.42), 1.5 * sc, 0.17 * sc);
  g.fillStyle = "#26282c";
  g.fillRect(X(-0.55), Y(1.25), 1.1 * sc, 0.17 * sc);
  // exhaust behind the cab (stock flat stack, or the fitted mod)
  if (!hide.exh) {
    g.fillStyle = "#7f868d";
    g.fillRect(X(-2.36), Y(roof + 0.25), 0.16 * sc, (roof + 0.25 - 1.3) * sc);
    g.fillStyle = "#a9afb5";
    g.fillRect(X(-2.33), Y(roof + 0.25), 0.04 * sc, (roof + 0.25 - 1.3) * sc);
  } else if (es && es !== "side") {
    const w = (0.17 + (ex ? ex.lv * 0.03 : 0)) * sc,
      h = es === "tall" ? 4.3 : 3.9,
      x0 = X(-2.37);
    const gr = g.createLinearGradient(x0, 0, x0 + w, 0);
    const cs = es === "black" ? ["#1a1a1a", "#4a4a4a"] : ["#8a929a", "#f2f4f6"];
    gr.addColorStop(0, cs[0]);
    gr.addColorStop(0.4, cs[1]);
    gr.addColorStop(1, cs[0]);
    g.fillStyle = gr;
    g.fillRect(x0, Y(h), w, (h - 1.3) * sc);
    // mitre-cut top + heat shield band
    g.fillStyle = cs[0];
    g.beginPath();
    g.moveTo(x0, Y(h));
    g.lineTo(x0 + w, Y(h + 0.12));
    g.lineTo(x0 + w, Y(h));
    g.fill();
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(x0, Y(2.4), w, 0.5 * sc);
    if (es === "flame") {
      fill("#ff7b00", () => {
        g.moveTo(x0, Y(h));
        g.quadraticCurveTo(x0 + w * 0.3, Y(h + 0.7), x0 + w * 1.8, Y(h + 0.9));
        g.quadraticCurveTo(x0 + w * 0.8, Y(h + 0.35), x0 + w, Y(h + 0.12));
      });
    }
  }
  // tank box / side skirt between the axles
  const tb0 = RIG.tankBox.x0,
    tb1 = RIG.tankBox.x1,
    skt = L.skt;
  fill(skt ? shade(col, 0.88) : "#1a1b1d", () => rr(g, X(tb0), Y(1.3), (tb1 - tb0) * sc, 0.78 * sc, 0.06 * sc));
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(X(tb0), Y(1.3), (tb1 - tb0) * sc, 0.04 * sc);
  if (skt > 1) {
    g.fillStyle = "#e6eaee";
    g.fillRect(X(tb0), Y(0.6), (tb1 - tb0) * sc, 0.06 * sc);
  }
  if (tk) {
    // aluminium tank face set into the box, longer per level
    const len = Math.min(tb1 - tb0 - 0.15, 0.7 + tk.lv * 0.22);
    const gr = g.createLinearGradient(0, Y(1.22), 0, Y(0.62));
    gr.addColorStop(0, "#eef1f4");
    gr.addColorStop(0.6, "#b5bcc3");
    gr.addColorStop(1, "#80878e");
    fill(gr, () => rr(g, X(tb0 + 0.08), Y(1.22), len * sc, 0.6 * sc, 0.12 * sc));
    g.fillStyle = "#1a1b1d";
    for (const f of [0.3, 0.7]) g.fillRect(X(tb0 + 0.08 + len * f), Y(1.22), 0.05 * sc, 0.6 * sc);
    fill("#222", () => g.arc(X(tb0 + 0.22), Y(1.12), 0.05 * sc, 0, 7));
  } else {
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.lineWidth = 1;
    g.strokeRect(X(tb0 + 0.9), Y(1.2), 0.7 * sc, 0.55 * sc);
  }
  if (es === "side") {
    const gr = g.createLinearGradient(0, Y(0.66), 0, Y(0.5));
    gr.addColorStop(0, "#fff");
    gr.addColorStop(1, "#7d858e");
    fill(gr, () => rr(g, X(tb0), Y(0.66), (tb1 - tb0) * sc, 0.16 * sc, 0.08 * sc));
  }
  // rear fender shaped over the drive tyre + mud flap
  fill("#141517", () => {
    g.arc(X(0), Y(WY), (WR + 0.14) * sc, Math.PI, Math.PI * 2);
    g.lineTo(X(WR + 0.14), Y(WY - 0.05));
    g.arc(X(0), Y(WY), (WR + 0.06) * sc, Math.PI * 2, Math.PI, true);
  });
  fill("#141517", () => rr(g, X(0.6), Y(WY + 0.35), 0.07 * sc, (WY + 0.25) * sc, 0.02 * sc));
  if (L.mud > 1) {
    g.fillStyle = "#e6eaee";
    g.fillRect(X(0.6), Y(0.2), 0.07 * sc, 0.1 * sc);
  }
  // ---- cab
  const AR = WR + RIG.arch.pad,
    ad = Math.sqrt(AR * AR - (floor - WY) * (floor - WY)),
    aa = Math.atan2(floor - WY, ad),
    bumpBot = RIG.bumper.bottom;
  const cabPath = () => {
    g.beginPath();
    g.moveTo(X(cb), Y(floor));
    g.lineTo(X(-3.8 + ad), Y(floor));
    g.arc(X(-3.8), Y(WY), AR * sc, -aa, -Math.PI + aa, true);
    // arch runs down to the bumper, then the bumper's lower edge forward
    g.lineTo(X(-3.8 - AR), Y(bumpBot));
    g.lineTo(X(fx(bumpBot) + 0.08), Y(bumpBot));
    g.quadraticCurveTo(X(fx(bumpBot)), Y(bumpBot), X(fx(bumpBot + 0.08)), Y(bumpBot + 0.1));
    g.lineTo(X(fx(roof - 0.25)), Y(roof - 0.25));
    g.quadraticCurveTo(X(fx(roof) + 0.02), Y(roof), X(fx(roof) + 0.35), Y(roof + 0.02));
    g.lineTo(X(cb), Y(roof + 0.02));
    g.closePath();
  };
  // arch liner (dark) visible inside the front arch
  fill("#0e0f10", () => {
    g.arc(X(-3.8), Y(WY), AR * sc, Math.PI, Math.PI * 2);
    g.lineTo(X(-3.8 + AR), Y(bumpBot));
    g.lineTo(X(-3.8 - AR), Y(bumpBot));
  });
  const gr = g.createLinearGradient(0, Y(roof), 0, Y(bumpBot));
  gr.addColorStop(0, lite);
  gr.addColorStop(0.15, body);
  gr.addColorStop(0.85, body);
  gr.addColorStop(1, dark);
  g.fillStyle = gr;
  cabPath();
  g.fill();
  g.save();
  cabPath();
  g.clip();
  // bumper: black lower section, lamp line, amber side marker; arch lip
  g.fillStyle = "#151618";
  g.fillRect(X(cf - 0.2), Y(0.78), 0.95 * sc, 0.4 * sc);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(X(cf - 0.2), Y(1.25), (cb - cf + 0.3) * sc, 0.03 * sc);
  // paint finish / stripes
  if (L.fin === "chrome" || L.fin === "metal" || L.fin === "pearl") {
    const sg = g.createLinearGradient(X(cf), 0, X(cb), 0);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, L.fin === "pearl" ? "rgba(140,255,240,0.3)" : "rgba(255,255,255,0.4)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sg;
    g.fillRect(X(cf), Y(roof), 3 * sc, roof * sc);
  }
  if (L.strp === "flame") {
    const fg = g.createLinearGradient(X(cf), 0, X(cb), 0);
    fg.addColorStop(0, "#ffe066");
    fg.addColorStop(0.5, "#ff7b00");
    fg.addColorStop(1, "rgba(200,30,0,0)");
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(X(cf), Y(1.35));
    for (let k = 0; k <= 8; k++) g.lineTo(X(cf + k * 0.33), Y(1.35 + (k % 2 ? 0.7 : 0.3) * (1 - k / 9)));
    g.lineTo(X(cb), Y(1.35));
    g.fill();
  } else if (L.strp === "twin" || L.strp === "chev") {
    g.fillStyle = L.strp === "twin" ? "#fff" : "#f5b82e";
    g.fillRect(X(cf), Y(1.75), (cb - cf) * sc, 0.1 * sc);
    g.fillRect(X(cf), Y(1.92), (cb - cf) * sc, 0.05 * sc);
  } else if (L.strp === "check") {
    for (let i = 0; i < 15; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? "#111" : "#fff";
        g.fillRect(X(cf + i * 0.185), Y(1.85 - j * 0.16), 0.185 * sc, 0.16 * sc);
      }
  }
  // step cut into the cab bottom under the door, behind the arch
  g.fillStyle = "#0e0f10";
  g.fillRect(X(-3.1), Y(1.32), 0.48 * sc, 0.5 * sc);
  g.fillStyle = "#3a3d41";
  g.fillRect(X(-3.08), Y(1.05), 0.44 * sc, 0.05 * sc);
  g.restore();
  // lower step below the cab line
  g.fillStyle = "#1a1b1d";
  g.fillRect(X(-3.08), Y(0.72), 0.44 * sc, 0.06 * sc);
  g.fillRect(X(-2.9), Y(1.0), 0.05 * sc, 0.28 * sc);
  // bumper lamps: headlamp, indicator, amber side marker
  fill("#d9dee2", () => rr(g, X(fx(1.0) - 0.04), Y(1.12), 0.42 * sc, 0.16 * sc, 0.05 * sc));
  fill("#fffbe6", () => rr(g, X(fx(1.0) - 0.02), Y(1.1), 0.2 * sc, 0.12 * sc, 0.04 * sc));
  g.fillStyle = "#f0a020";
  g.fillRect(X(fx(1.0) + 0.2), Y(1.1), 0.14 * sc, 0.12 * sc);
  g.fillRect(X(-4.55), Y(0.7), 0.12 * sc, 0.06 * sc);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(X(fx(1.35)), Y(1.42), 0.8 * sc, 0.03 * sc); // bumper top crease
  // door, window, handle, sleeper panel
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = Math.max(1, 0.022 * sc);
  g.beginPath();
  g.moveTo(X(-4.72), Y(2.92));
  g.lineTo(X(-3.15), Y(2.92));
  g.lineTo(X(-3.15), Y(1.35));
  g.lineTo(X(-4.4), Y(1.35));
  g.quadraticCurveTo(X(-4.62), Y(1.5), X(-4.72), Y(1.9));
  g.closePath();
  g.stroke();
  const wp = () => {
    g.beginPath();
    g.moveTo(X(-4.78), Y(2.02));
    g.lineTo(X(-4.72), Y(2.82));
    g.lineTo(X(-3.4), Y(2.82));
    g.quadraticCurveTo(X(-3.25), Y(2.82), X(-3.28), Y(2.6));
    g.lineTo(X(-3.55), Y(2.02));
    g.closePath();
  };
  const wg = g.createLinearGradient(0, Y(2.82), 0, Y(2.02));
  wg.addColorStop(0, "#3d556b");
  wg.addColorStop(1, "#141d27");
  g.fillStyle = wg;
  wp();
  g.fill();
  g.fillStyle = "#0e0f10";
  wp();
  g.lineWidth = Math.max(1.5, 0.04 * sc);
  g.strokeStyle = "#0e0f10";
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.beginPath();
  g.moveTo(X(-4.5), Y(2.82));
  g.lineTo(X(-4.25), Y(2.82));
  g.lineTo(X(-4.55), Y(2.02));
  g.lineTo(X(-4.75), Y(2.02));
  g.fill();
  fill("#141517", () => rr(g, X(-3.62), Y(1.9), 0.22 * sc, 0.07 * sc, 0.03 * sc));
  g.strokeStyle = "rgba(0,0,0,0.3)";
  g.lineWidth = Math.max(1, 0.02 * sc);
  g.strokeRect(X(-3.0), Y(2.3), 0.35 * sc, 0.55 * sc);
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(X(-4.7), Y(1.97), 2.2 * sc, 0.03 * sc); // waist crease highlight
  // windscreen edge on the front face
  fill("#121c26", () => {
    g.moveTo(X(fx(2.0)), Y(2.0));
    g.lineTo(X(fx(2.9)), Y(2.9));
    g.lineTo(X(fx(2.9) + 0.08), Y(2.9));
    g.lineTo(X(fx(2.0) + 0.08), Y(2.0));
  });
  // curved high roof + sloped spoiler (replaced by the spoiler mod)
  const spl = L.spl || 0,
    sTop = spl > 1 ? RIG.spoiler.topAero : RIG.spoiler.top;
  {
    const sg = g.createLinearGradient(0, Y(sTop), 0, Y(roof));
    sg.addColorStop(0, lite);
    sg.addColorStop(1, body);
    fill(sg, () => {
      g.moveTo(X(fx(roof) + 0.3), Y(roof));
      g.quadraticCurveTo(X(-4.0), Y(roof + 0.55 + (sTop - 3.72)), X(-3.0), Y(sTop - 0.04));
      g.lineTo(X(cb - 0.05), Y(sTop));
      g.lineTo(X(cb), Y(roof));
    });
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.beginPath();
    g.moveTo(X(-4.4), Y(roof + 0.2));
    g.quadraticCurveTo(X(-3.9), Y(roof + 0.5), X(-3.0), Y(3.63));
    g.lineTo(X(-3.0), Y(3.6));
    g.quadraticCurveTo(X(-3.9), Y(roof + 0.45), X(-4.4), Y(roof + 0.16));
    g.fill();
    if (spl) {
      // aero kit: sharper top edge trim + side extension panel
      g.fillStyle = "#151618";
      g.fillRect(X(-3.3), Y(sTop + 0.02), (cb - 0.05 + 3.3) * sc, 0.06 * sc);
      g.fillStyle = shade(col, 0.9);
      g.fillRect(X(-3.0), Y(sTop - 0.05), 0.5 * sc, (sTop - roof - 0.1) * sc);
    }
  }
  // black B-pillar / side deflector at the cab rear
  fill("#121314", () => {
    g.moveTo(X(cb - 0.2), Y(sTop));
    g.lineTo(X(cb + 0.02), Y(sTop));
    g.lineTo(X(cb + 0.06), Y(1.05));
    g.lineTo(X(cb - 0.14), Y(1.05));
  });
  // roof marker lamps
  if (!hide.lamps) {
    g.fillStyle = "#f5a623";
    g.fillRect(X(-4.55), Y(roof + 0.13), 0.12 * sc, 0.05 * sc);
  }
  // antenna + mirrors
  g.strokeStyle = "#111";
  g.lineWidth = Math.max(1, 0.02 * sc);
  g.beginPath();
  g.moveTo(X(-4.55), Y(roof + 0.1));
  g.lineTo(X(-4.6), Y(roof + 0.5));
  g.stroke();
  g.lineWidth = Math.max(1.5, 0.05 * sc);
  g.beginPath();
  g.moveTo(X(fx(2.7)), Y(2.7));
  g.lineTo(X(cf - 0.12), Y(2.75));
  g.stroke();
  fill("#141517", () => rr(g, X(cf - 0.22), Y(2.95), 0.15 * sc, 0.75 * sc, 0.05 * sc));
  // outline
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = Math.max(1, 0.02 * sc);
  cabPath();
  g.stroke();
  // wheels: dark grey tyres, light grey steel rims, dark hubs with nuts
  for (const ax of RIG.wheels.axles.map((a) => a.x)) {
    const wx = X(ax),
      wy = Y(WY),
      r = WR * sc;
    fill("#33363a", () => g.arc(wx, wy, r, 0, 7));
    g.strokeStyle = "#3f4347";
    g.lineWidth = Math.max(1, 0.05 * sc);
    g.beginPath();
    g.arc(wx, wy, r * 0.8, 0, 7);
    g.stroke();
    if (ty) {
      g.strokeStyle = ty.id === "tyre2" ? "#7dff9a" : "#eee";
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(wx, wy, r * 0.84, -2.6, -0.6);
      g.stroke();
    }
    const rim = L.rc || "#c9cdd1";
    fill(rim, () => g.arc(wx, wy, r * 0.6, 0, 7));
    fill("rgba(0,0,0,0.22)", () => g.arc(wx, wy, r * 0.5, 0, 7));
    fill(rim, () => g.arc(wx, wy, r * 0.46, 0, 7));
    if (bk) {
      g.fillStyle = bk.cl;
      g.fillRect(wx + r * 0.15, wy - r * 0.45, r * 0.25, r * 0.5);
    }
    if (L.rim === "star" || L.rim === "spoke" || L.rim === "split") {
      const n = L.rim === "star" ? 5 : L.rim === "spoke" ? 10 : 2;
      g.strokeStyle = "rgba(0,0,0,0.5)";
      g.lineWidth = 1.5;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        g.beginPath();
        g.moveTo(wx, wy);
        g.lineTo(wx + Math.cos(a) * r * 0.55, wy + Math.sin(a) * r * 0.55);
        g.stroke();
      }
    } else {
      g.fillStyle = "rgba(0,0,0,0.45)";
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        g.beginPath();
        g.arc(wx + Math.cos(a) * r * 0.37, wy + Math.sin(a) * r * 0.37, r * 0.055, 0, 7);
        g.fill();
      }
    }
    fill(ax === 0 ? "#3a3d41" : "#55595e", () => g.arc(wx, wy, r * (ax === 0 ? 0.26 : 0.22), 0, 7));
    g.fillStyle = "#c4c8cc";
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      g.beginPath();
      g.arc(wx + Math.cos(a) * r * 0.17, wy + Math.sin(a) * r * 0.17, Math.max(1, r * 0.028), 0, 7);
      g.fill();
    }
    fill("#1e2023", () => g.arc(wx, wy, r * 0.08, 0, 7));
  }
  const en = czPart(fit.eng);
  if (en && en.lv >= 2) {
    g.fillStyle = "#9aa2ab";
    g.fillRect(X(-2.7), Y(roof + 0.1), 0.18 * sc, (roof - 1.3) * sc);
  }
}

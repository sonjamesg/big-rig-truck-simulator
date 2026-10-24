/**
 * @file police.js — POLICE AI: patrols from police stations, line-of-sight detection, chase (+ v49 2-star pursuers POL.aux: polAuxSpawn/polAuxUpdate/polAuxDrop), fines + arrest
 * Exposes (globals): POL_FINES, POL, EMV, POL_T, polArt, emArt, emDrawBar, emBlit, SIRK, emSiren, emLaneAhead, emRejoin, emOnBlue,
 *   emSirenVol, emRoadPt, emFollow, emToTraffic (+53 more)
 * Depends on: world.js, render.js, lorry.js, physics.js, audio.js, traffic.js, signals.js,
 *   depots.js, services.js, career.js, ui.js, ambient.js, satnav.js, gamepad.js, breakdown.js,
 *   beams.js, port.js, daynight.js, main.js, roadlaw.js, wanted.js, ambulance.js, fire.js
 * Load order: #45 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v28 POLICE AI: patrols from police stations, line-of-sight detection, chase, fines + arrest =====================
// Patrol cars are ordinary traffic vehicles (v.role='police') so they keep UK lane discipline + signals; a chasing car leaves the traffic
// sim and is driven kinematically behind the player. Local per client (MP fine). Uses SVC (services.js) and OFF (roadlaw.js).
const POL_FINES = { speeding: 100, redlight: 100, pedestrian: 500 };
const POL = {
  cars: [],
  chase: null,
  spawnT: 6 + Math.random() * 14,
  want: 2,
  stopT: 0,
  pend: [],
  arrest: false,
  lostT: 0,
  inJ: null,
  prev: null,
  seen: new Set(),
  fade: 0,
  log: [],
};
// ---------- shared emergency-vehicle art / audio / helpers (also used by ambulance.js)
const EMV = { arts: {} };
// v29 detailed police vehicles (top-down, procedural): saloon / 4x4 SUV / Sprinter-style van, white with crisp blue+yellow battenburg,
// glass, mirrors, roof POLICE lettering and a red/blue light bar
const POL_T = ["pol_car", "pol_suv", "pol_van"];
// v-pol2: redrawn UK police cars (supersampled 3x then downsized): shaded white body, full Battenburg flanks
// (blue / fluorescent yellow), rear red-yellow chevrons, tinted glass with pillars, slim all-blue LED light bar, roof ID
function polArt(type) {
  if (EMV.arts[type]) return EMV.arts[type];
  const D = {
    pol_car: [4.8, 1.86, 1.15, 1.9, 0.9],
    pol_suv: [4.9, 2.0, 1.0, 2.4, 0.75],
    pol_van: [5.9, 2.06, 0.95, 3.9, 0.15],
  }[type];
  const [L, W, bon, roofL, rear] = D,
    out = vCanvas(L, W),
    K = 3,
    c = mkCanvas(out.width * K, out.height * K),
    g = c.getContext("2d"),
    S = VS * K,
    cx = c.width / 2,
    X = (m) => cx + m * S,
    Y = (m) => 0.15 * S + m * S,
    van = type === "pol_van",
    suv = type === "pol_suv",
    BL = "#1b46b8",
    YE = "#e4ff1a";
  const body = (inset, r) => {
    g.beginPath();
    const x0 = X(-W / 2 + inset), x1 = X(W / 2 - inset), y0 = Y(inset), y1 = Y(L - inset), n = (van ? 0.3 : 0.55) * S;
    g.moveTo(x0 + n * 0.6, y0);
    g.lineTo(x1 - n * 0.6, y0);
    g.quadraticCurveTo(x1, y0, x1, y0 + n);
    g.lineTo(x1, y1 - r);
    g.quadraticCurveTo(x1, y1, x1 - r, y1);
    g.lineTo(x0 + r, y1);
    g.quadraticCurveTo(x0, y1, x0, y1 - r);
    g.lineTo(x0, y0 + n);
    g.quadraticCurveTo(x0, y0, x0 + n * 0.6, y0);
    g.closePath();
  };
  // tyres peeking out
  g.fillStyle = "#0d0d0d";
  for (const fy of [0.7, L - 1.25])
    for (const sd of [-1, 1]) (rr(g, X(sd > 0 ? W / 2 - 0.2 : -W / 2 - 0.02), Y(fy), 0.22 * S, 0.66 * S, 0.06 * S), g.fill());
  // body: white with cylindrical side shading
  const bg = g.createLinearGradient(X(-W / 2), 0, X(W / 2), 0);
  bg.addColorStop(0, "#9da2a8");
  bg.addColorStop(0.12, "#e4e6e8");
  bg.addColorStop(0.42, "#ffffff");
  bg.addColorStop(0.6, "#f7f8f8");
  bg.addColorStop(0.88, "#dcdfe2");
  bg.addColorStop(1, "#8e9399");
  g.fillStyle = bg;
  body(0, 0.3 * S);
  g.fill();
  g.strokeStyle = "rgba(20,24,30,0.7)";
  g.lineWidth = 1.2 * K;
  g.stroke();
  // Battenburg flanks: two rows of large blue / fluorescent-yellow blocks, clipped to the body
  g.save();
  body(0, 0.3 * S);
  g.clip();
  const cs = 0.5,
    bw = 0.16,
    y0 = 0.45,
    n = Math.ceil((L - y0 - 0.2) / cs);
  for (let k = 0; k < n; k++)
    for (const sd of [-1, 1])
      for (let row = 0; row < 2; row++) {
        g.fillStyle = (k + row) % 2 ? BL : YE;
        const xx = sd < 0 ? X(-W / 2 + row * bw) : X(W / 2 - bw - row * bw);
        g.fillRect(xx, Y(y0 + k * cs), bw * S + 1, cs * S + 1);
      }
  // shading over the checks so they wrap round the body
  const sg = g.createLinearGradient(X(-W / 2), 0, X(W / 2), 0);
  sg.addColorStop(0, "rgba(0,0,0,0.35)");
  sg.addColorStop(0.18, "rgba(0,0,0,0)");
  sg.addColorStop(0.82, "rgba(0,0,0,0)");
  sg.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = sg;
  g.fillRect(X(-W / 2), Y(0), W * S, L * S);
  // front: yellow nose band, rear: red / yellow chevrons on the boot or rear doors
  g.fillStyle = YE;
  g.fillRect(X(-W / 2), Y(0), W * S, 0.16 * S);
  const ry = L - (van ? 0.5 : 0.42);
  g.save();
  g.beginPath();
  g.rect(X(-W / 2), Y(ry), W * S, (L - ry) * S);
  g.clip();
  for (let k = -8; k < 8; k++) {
    g.fillStyle = k % 2 ? "#e0201f" : YE;
    g.beginPath();
    const x = X(k * 0.28);
    g.moveTo(x, Y(ry));
    g.lineTo(x + 0.28 * S, Y(ry));
    g.lineTo(x + 0.28 * S + (k < 0 ? -1 : 1) * 0.4 * S, Y(L));
    g.lineTo(x + (k < 0 ? -1 : 1) * 0.4 * S, Y(L));
    g.fill();
  }
  g.restore();
  g.restore();
  // bonnet crease highlights
  if (!van) {
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 1 * K;
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.moveTo(X(sd * 0.42), Y(0.25));
      g.quadraticCurveTo(X(sd * 0.36), Y(bon * 0.6), X(sd * 0.5), Y(bon));
      g.stroke();
    }
    g.strokeStyle = "rgba(0,0,0,0.12)";
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.moveTo(X(sd * 0.47), Y(0.25));
      g.quadraticCurveTo(X(sd * 0.41), Y(bon * 0.6), X(sd * 0.55), Y(bon));
      g.stroke();
    }
  }
  // bumpers, headlamps, tail lamps, grille
  g.fillStyle = "#24282e";
  rr(g, X(-W / 2 + 0.12), Y(0.0), (W - 0.24) * S, 0.1 * S, 0.04 * S);
  g.fill();
  rr(g, X(-W / 2 + 0.12), Y(L - 0.1), (W - 0.24) * S, 0.1 * S, 0.04 * S);
  g.fill();
  for (const sd of [-1, 1]) {
    const hg = g.createLinearGradient(0, Y(0.04), 0, Y(0.22));
    hg.addColorStop(0, "#ffffff");
    hg.addColorStop(1, "#a9c4dc");
    g.fillStyle = hg;
    g.beginPath();
    const hx = X(sd * (W / 2 - 0.42));
    g.ellipse(hx, Y(0.13), 0.26 * S, 0.08 * S, sd * 0.12, 0, 7);
    g.fill();
    g.fillStyle = "#c2161c";
    rr(g, X(sd > 0 ? W / 2 - 0.5 : -W / 2 + 0.16), Y(L - 0.17), 0.34 * S, 0.1 * S, 0.03 * S);
    g.fill();
    g.fillStyle = "#ff9a1f"; // indicators
    g.fillRect(X(sd > 0 ? W / 2 - 0.18 : -W / 2 + 0.1), Y(0.08), 0.08 * S, 0.12 * S);
  }
  // glass: windscreen, side windows with pillars, rear screen
  const ws = bon,
    r0 = ws + (van ? 0.45 : 0.55),
    r1 = r0 + roofL;
  const gl = (y0, y1) => {
    const gg = g.createLinearGradient(0, Y(y0), 0, Y(y1));
    gg.addColorStop(0, "#3c5670");
    gg.addColorStop(0.5, "#15202c");
    gg.addColorStop(1, "#0b1118");
    return gg;
  };
  g.fillStyle = gl(ws, r0);
  g.beginPath();
  g.moveTo(X(-W / 2 + 0.17), Y(r0));
  g.quadraticCurveTo(X(-W / 2 + 0.2), Y(ws + 0.05), X(-W / 2 + 0.34), Y(ws));
  g.quadraticCurveTo(X(0), Y(ws - 0.08), X(W / 2 - 0.34), Y(ws));
  g.quadraticCurveTo(X(W / 2 - 0.2), Y(ws + 0.05), X(W / 2 - 0.17), Y(r0));
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(200,225,245,0.28)"; // reflection streak
  g.beginPath();
  g.moveTo(X(-W / 2 + 0.45), Y(ws + 0.06));
  g.lineTo(X(-0.05), Y(ws + 0.03));
  g.lineTo(X(-0.35), Y(r0 - 0.05));
  g.lineTo(X(-W / 2 + 0.3), Y(r0 - 0.05));
  g.fill();
  for (const sd of [-1, 1]) {
    g.fillStyle = "#121a24";
    const sx = sd < 0 ? X(-W / 2 + 0.08) : X(W / 2 - 0.22);
    g.fillRect(sx, Y(r0), 0.14 * S, (van ? 1.0 : roofL) * S);
    g.fillStyle = "#f1f2f3"; // B pillar
    if (!van) g.fillRect(sx, Y(r0 + roofL * 0.47), 0.14 * S, 0.12 * S);
  }
  if (rear > 0.3) {
    g.fillStyle = gl(r1 + rear * 0.6, r1);
    g.beginPath();
    g.moveTo(X(-W / 2 + 0.2), Y(r1));
    g.lineTo(X(W / 2 - 0.2), Y(r1));
    g.quadraticCurveTo(X(W / 2 - 0.3), Y(r1 + rear * 0.55), X(W / 2 - 0.38), Y(r1 + rear * 0.58));
    g.lineTo(X(-W / 2 + 0.38), Y(r1 + rear * 0.58));
    g.quadraticCurveTo(X(-W / 2 + 0.3), Y(r1 + rear * 0.55), X(-W / 2 + 0.2), Y(r1));
    g.fill();
  }
  // roof panel, slight dome shading
  const rg = g.createLinearGradient(X(-W / 2 + 0.22), 0, X(W / 2 - 0.22), 0);
  rg.addColorStop(0, "#d9dcdf");
  rg.addColorStop(0.5, "#ffffff");
  rg.addColorStop(1, "#d3d6da");
  g.fillStyle = rg;
  rr(g, X(-W / 2 + 0.22), Y(r0), (W - 0.44) * S, roofL * S, 0.12 * S);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.22)";
  g.lineWidth = 0.8 * K;
  g.stroke();
  if (suv) {
    g.fillStyle = "#2a2e34"; // roof rails
    for (const sd of [-1, 1]) g.fillRect(X(sd * (W / 2 - 0.36) - 0.04), Y(r0 + 0.15), 0.08 * S, (roofL - 0.3) * S);
  }
  if (van) {
    g.strokeStyle = "rgba(0,0,0,0.16)";
    g.lineWidth = 0.8 * K;
    for (let k = 1; k < 5; k++) {
      g.beginPath();
      g.moveTo(X(-W / 2 + 0.34), Y(r0 + 0.4 + (k * (roofL - 0.4)) / 5));
      g.lineTo(X(W / 2 - 0.34), Y(r0 + 0.4 + (k * (roofL - 0.4)) / 5));
      g.stroke();
    }
    g.fillStyle = "#c9ccd0";
    rr(g, X(-0.3), Y(r0 + roofL * 0.55), 0.6 * S, 0.5 * S, 0.06 * S);
    g.fill(); // roof vent
    g.strokeStyle = "rgba(0,0,0,0.35)"; // rear door split
    g.beginPath();
    g.moveTo(X(0), Y(L - 0.5));
    g.lineTo(X(0), Y(L - 0.1));
    g.stroke();
  }
  // roof ID (read from the air) + POLICE on the bonnet (reads right way up from the front)
  g.save();
  g.translate(X(0), Y(r0 + roofL * (van ? 0.3 : 0.68)));
  g.rotate(Math.PI);
  g.fillStyle = "#111";
  g.font = "900 " + Math.round(0.42 * S) + "px Arial Black,Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText({ pol_car: "Q21", pol_suv: "X04", pol_van: "V17" }[type], 0, 0);
  g.restore();
  g.save();
  g.translate(X(0), Y(bon * 0.55));
  g.fillStyle = BL;
  g.font = "900 " + Math.round(0.26 * S) + "px Arial Black,Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("POLICE", 0, 0);
  g.restore();
  // mirrors (body colour, black backs)
  for (const sd of [-1, 1]) {
    g.fillStyle = "#1c1f24";
    g.beginPath();
    g.ellipse(X(sd * (W / 2 + 0.06)), Y(ws + 0.22), 0.14 * S, 0.08 * S, sd * 0.3, 0, 7);
    g.fill();
  }
  // slim LED light bar: black housing, blue lenses both ends, clear centre
  const by = r0 + 0.12;
  g.fillStyle = "#121314";
  rr(g, X(-W / 2 + 0.28), Y(by), (W - 0.56) * S, 0.28 * S, 0.1 * S);
  g.fill();
  const lw = (W - 0.7) / 2;
  for (const sd of [-1, 1]) {
    const lx = sd < 0 ? X(-W / 2 + 0.34) : X(0.06),
      lg = g.createLinearGradient(0, Y(by), 0, Y(by + 0.28));
    lg.addColorStop(0, "#3d6cff");
    lg.addColorStop(1, "#122d8a");
    g.fillStyle = lg;
    rr(g, lx, Y(by + 0.04), (lw - 0.06) * S, 0.2 * S, 0.06 * S);
    g.fill();
  }
  g.fillStyle = "#e8eef5";
  g.fillRect(X(-0.06), Y(by + 0.05), 0.12 * S, 0.18 * S);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(X(-W / 2 + 0.36), Y(by + 0.05), (W - 0.72) * S, 0.04 * S);
  // downsample (smooth edges) into the normal 16 px/m sprite
  const o = out.getContext("2d");
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = "high";
  o.drawImage(c, 0, 0, out.width, out.height);
  const a = {
    body: { c: out, sh: shadowOf(out) },
    L,
    W,
    kind: van ? "van" : "estate",
    bar: L / 2 - by - 0.15,
  };
  return (EMV.arts[type] = a);
}
function emArt(type) {
  if (EMV.arts[type]) return EMV.arts[type];
  if (type === "police") return polArt("pol_car");
  if (POL_T.includes(type)) return polArt(type);
  const kind = type === "police" ? "estate" : "van",
    t = VTYPES[kind],
    base = type === "police" ? makeCarArt("estate", "#f4f4f4") : makeVanArt("#f7f7f2", ""),
    c = mkCanvas(base.width, base.height),
    g = c.getContext("2d");
  g.drawImage(base, 0, 0);
  const cx = c.width / 2,
    y0 = 0.15 * VS,
    X = (m) => cx + m * VS,
    Y = (m) => y0 + m * VS,
    W = t.W,
    L = t.L,
    A = type === "police" ? ["#1d4fbf", "#f2e600"] : ["#2e9e3e", "#f2e600"];
  // battenburg checks along both flanks
  const n = Math.round(L / 0.55);
  for (let k = 1; k < n - 1; k++)
    for (const s of [-1, 1]) {
      g.fillStyle = A[(k + (s > 0 ? 1 : 0)) % 2];
      g.fillRect(
        s < 0 ? X(-W / 2 + 0.05) : X(W / 2 - 0.33),
        Y((k * L) / n),
        0.28 * VS,
        (L / n) * VS + 0.5,
      );
    }
  if (type === "ambulance") {
    g.fillStyle = "#2e9e3e";
    g.fillRect(X(-W / 2 + 0.4), Y(L * 0.62), (W - 0.8) * VS, 0.22 * VS);
    g.save();
    g.translate(X(0), Y(L * 0.75));
    g.rotate(Math.PI);
    g.fillStyle = "#2e9e3e";
    g.font = "bold " + Math.round(0.42 * VS) + "px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("AMBULANCE", 0, 0);
    g.restore();
  } else {
    g.fillStyle = "#1d4fbf";
    g.font = "bold " + Math.round(0.45 * VS) + "px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.save();
    g.translate(X(0), Y(L * 0.72));
    g.rotate(Math.PI);
    g.fillText("POLICE", 0, 0);
    g.restore();
  }
  // light bar (unlit)
  const by = type === "police" ? L * 0.42 : 0.95;
  g.fillStyle = "#222";
  g.fillRect(X(-W / 2 + 0.3), Y(by), (W - 0.6) * VS, 0.3 * VS);
  g.fillStyle = "#3a58a8";
  g.fillRect(X(-W / 2 + 0.35), Y(by) + 2, (W / 2 - 0.4) * VS, 0.3 * VS - 4);
  g.fillRect(X(0.05), Y(by) + 2, (W / 2 - 0.4) * VS, 0.3 * VS - 4);
  const a = { body: { c, sh: shadowOf(c) }, L, W, kind, bar: L / 2 - by - 0.15 };
  return (EMV.arts[type] = a);
}
function emDrawBar(v, on, type) {
  if (type === "police" && v.polT) type = v.polT;
  const a = emArt(type),
    f = fwd(v.h),
    r = rgt(v.h),
    off = a.bar,
    cx = v.x + f[0] * off,
    cy = v.y + f[1] * off;
  if (!on) return;
  const ph = (timeS * 4) % 1 < 0.5;
  for (const s of [-1, 1]) {
    const lit = s < 0 === ph;
    if (!lit) continue;
    const x = cx + r[0] * s * a.W * 0.25,
      y = cy + r[1] * s * a.W * 0.25,
      red = a.rb && s < 0;
    if (type === "fire") {
      const c = s < 0 ? "255,45,45" : "255,255,255";
      ctx.fillStyle = `rgba(${c},0.95)`;
      ctx.beginPath();
      ctx.arc(x * PPM, y * PPM, 3.2, 0, 7);
      ctx.fill();
      const dk = typeof DN !== "undefined" ? DN.dark : 0;
      ctx.fillStyle = `rgba(${c},${0.12 + 0.13 * dk})`;
      ctx.beginPath();
      ctx.arc(x * PPM, y * PPM, 7 + 9 * dk, 0, 7);
      ctx.fill();
      if (typeof dnLight === "function")
        dnLight(x * PPM, y * PPM, 90, s < 0 ? "rgba(255,40,40,1)" : "rgba(255,255,255,1)", 0.9);
      continue;
    }
    if (red) {
      ctx.fillStyle = "rgba(255,60,60,0.95)";
      ctx.beginPath();
      ctx.arc(x * PPM, y * PPM, 4.5, 0, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,40,40,0.25)";
      ctx.beginPath();
      ctx.arc(x * PPM, y * PPM, 16, 0, 7);
      ctx.fill();
      if (typeof dnLight === "function") dnLight(x * PPM, y * PPM, 90, "rgba(255,40,40,1)", 0.9);
      continue;
    }
    ctx.fillStyle = "rgba(120,170,255,0.95)";
    ctx.beginPath();
    ctx.arc(x * PPM, y * PPM, 4.5, 0, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(80,140,255,0.25)";
    ctx.beginPath();
    ctx.arc(x * PPM, y * PPM, 16, 0, 7);
    ctx.fill();
    if (typeof dnLight === "function") dnLight(x * PPM, y * PPM, 90, "rgba(60,120,255,1)", 0.9);
  }
}
function emBlit(v, type) {
  if (type === "police" && v.polT) type = v.polT;
  const a = emArt(type);
  blitV(a.body.sh, v.x, v.y, v.h, a.L, a.W, 4, 4);
  blitV(a.body.c, v.x, v.y, v.h, a.L, a.W, 0, 0);
}
// v31 sirens: all synthesised live with WebAudio (no sample files, no licences needed, ~0 bytes of build size). Kinds:
//  'police'  UK two-tone hi-lo, fast (responding)      'yelp'  rapid sawtooth yelp, rate rises with chase time
//  'ambulance' UK two-tone, slower and lower            'fire'  deep slow air-horn-style wail (sawtooth + sub octave)
//  s.whoop() = short police 'whoop'/phaser burst used when they want you to pull over
const SIRK = {
  police: { c: 1020, dep: 430, lt: "triangle", lr: 0.3, ot: "sawtooth", lp: 2600 },
  yelp: {
    c: 1020,
    dep: 430,
    lt: "triangle",
    lr: 3.4,
    ot: "sawtooth",
    lp: 2800,
  } /* UK wail / yelp */,
  ambulance: { c: 820, dep: 300, lt: "triangle", lr: 0.26, ot: "triangle", lp: 1900 },
  ambyelp: { c: 820, dep: 300, lt: "triangle", lr: 2.6, ot: "triangle", lp: 2000 },
  fire: { c: 640, dep: 240, lt: "triangle", lr: 0.22, ot: "sawtooth", lp: 1300, sub: 1 },
  fireyelp: { c: 640, dep: 240, lt: "triangle", lr: 2.2, ot: "sawtooth", lp: 1400, sub: 1 },
};
function emSiren(kind) {
  try {
    const c = audio.ctx;
    if (!c || !audio.master) return null;
    const K = SIRK[kind] || SIRK.police;
    const o = c.createOscillator(),
      l = c.createOscillator(),
      lg = c.createGain(),
      g = c.createGain(),
      f = c.createBiquadFilter();
    let o2 = null;
    o.type = K.ot;
    o.frequency.value = K.c;
    l.type = K.lt;
    l.frequency.value = K.lr;
    lg.gain.value = K.dep;
    l.connect(lg);
    lg.connect(o.frequency);
    f.type = "lowpass";
    f.frequency.value = K.lp;
    o.connect(f);
    if (K.sub) {
      o2 = c.createOscillator();
      o2.type = "square";
      const g2 = c.createGain();
      g2.gain.value = 0.35;
      o2.frequency.value = K.c / 2;
      const lg2 = c.createGain();
      lg2.gain.value = K.dep / 2;
      l.connect(lg2);
      lg2.connect(o2.frequency);
      o2.connect(g2);
      g2.connect(f);
    }
    f.connect(g);
    g.gain.value = 0;
    let pn = null;
    try {
      pn = c.createStereoPanner();
      g.connect(pn);
      pn.connect(audio.master);
    } catch (e) {
      g.connect(audio.master);
    }
    o.start();
    l.start();
    if (o2) o2.start();
    let last = 0;
    return {
      g,
      kind,
      stop() {
        try {
          g.gain.setTargetAtTime(0, c.currentTime, 0.05);
          setTimeout(() => {
            try {
              o.stop();
              l.stop();
              if (o2) o2.stop();
              g.disconnect();
            } catch (e) {}
          }, 400);
        } catch (e) {}
      },
      set(v) {
        try {
          const q = typeof v === "object" ? v : { v, p: 0 };
          last = q.v;
          g.gain.setTargetAtTime(q.v, c.currentTime, 0.08);
          if (pn) pn.pan.setTargetAtTime(q.p, c.currentTime, 0.08);
          if (q.d && Math.abs(q.d - (this.dp || 1)) > 0.003) {
            this.dp = q.d;
            const N = SIRK[this.kind] || K;
            o.frequency.setTargetAtTime(N.c * q.d, c.currentTime, 0.12);
            lg.gain.setTargetAtTime(N.dep * q.d, c.currentTime, 0.12);
          }
        } catch (e) {}
      },
      mode(k) {
        const N = SIRK[k];
        if (!N || this.kind === k) return;
        this.kind = k;
        const t = c.currentTime,
          dp = this.dp || 1;
        l.type = N.lt;
        l.frequency.setTargetAtTime(N.lr, t, 0.05);
        lg.gain.setTargetAtTime(N.dep * dp, t, 0.05);
        o.frequency.setTargetAtTime(N.c * dp, t, 0.05);
      },
      rate(r) {
        try {
          l.frequency.setTargetAtTime(r, c.currentTime, 0.3);
        } catch (e) {}
      },
      whoop() {
        try {
          if (last < 0.002) return;
          const t = c.currentTime,
            w = c.createOscillator(),
            wg = c.createGain();
          w.type = "sawtooth";
          w.frequency.setValueAtTime(300, t);
          w.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
          w.frequency.exponentialRampToValueAtTime(500, t + 0.6);
          wg.gain.setValueAtTime(0, t);
          wg.gain.linearRampToValueAtTime(last * 1.6, t + 0.04);
          wg.gain.linearRampToValueAtTime(0, t + 0.62);
          w.connect(wg);
          wg.connect(pn || audio.master);
          w.start(t);
          w.stop(t + 0.65);
        } catch (e) {}
      },
    };
  } catch (e) {
    return null;
  }
}
// v31: quieter, falls off to silence about one screen from the player, stereo pan by side
function emSirenVol(x, y, o) {
  const vr = viewRectM(),
    R = Math.max(40, Math.max(vr[2] - vr[0], vr[3] - vr[1]) / 2),
    d = Math.hypot(x - truck.x, y - truck.y),
    f = Math.max(0, 1 - d / (R * 1.6)),
    near = 1 / (1 + d / 25);
  let dop = 1;
  if (o) {
    const now = timeS;
    if (o._sd != null && now > o._st) {
      const vr2 = (d - o._sd) / (now - o._st);
      o._vr = (o._vr || 0) * 0.8 + vr2 * 0.2;
      dop = Math.max(0.85, Math.min(1.15, 343 / (343 + o._vr * 2)));
    }
    o._sd = d;
    o._st = now;
  }
  return {
    v: (0.03 + 0.07 * near) * f * f * (3 - 2 * f),
    p: Math.max(-1, Math.min(1, (x - truck.x) / R)) * 0.8,
    d: dop,
  };
}
// road point just outside a services site's driveway
function emRoadPt(s) {
  return { x: s.entrance.x, y: s.entrance.y - M_T * 0.8 };
}
// move a kinematic vehicle along a polyline (metres); returns true when done
function emFollow(v, dt, sp) {
  const P = v.path;
  if (!P || !P.length) return true;
  const q = P[0],
    dx = q[0] - v.x,
    dy = q[1] - v.y,
    d = Math.hypot(dx, dy);
  if (d < 0.4) {
    P.shift();
    return !P.length;
  }
  const st = Math.min(d, (sp || 5) * dt);
  v.x += (dx / d) * st;
  v.y += (dy / d) * st;
  if (d > 0.6) {
    const th = Math.atan2(dx, -dy);
    v.h += wrapA((v.rev ? th + Math.PI : th) - v.h) * Math.min(1, dt * 5);
  }
  return false;
}
// put a kinematic vehicle back into traffic as a normal AI car (keeps its role/art); null if no room
function emToTraffic(x, y, role) {
  const s = navSnap(x / M_T, y / M_T, 10);
  if (!s) return null;
  const OFS = [[0, 0]];
  for (let d = 1; d <= 6; d++) OFS.push([d, 0], [-d, 0], [0, d], [0, -d]);
  for (const [ox, oy] of OFS) {
    const v = spawnVehicle((s[0] + ox + 0.5) * M_T, (s[1] + oy + 0.5) * M_T, true, {
      kind: role === "police" ? "estate" : "van",
    });
    if (v) {
      v.role = role;
      v.art = emArt(role).body;
      v.art = { body: emArt(role).body };
      return v;
    }
  }
  return null;
}
// v50: the kerb-lane point to rejoin traffic from where a kinematic vehicle is parked, facing the way it points:
// same segment, nearest legal spot at or just ahead (clear of junction boxes); {sg, dir, along, x, y, h} or null
function emLaneAhead(x, y, h) {
  const s = navSnap(x / M_T, y / M_T, 3);
  if (!s) return null;
  const i = idx(s[0], s[1]),
    f = fwd(h || 0);
  for (const sid of [world.roadH[i], world.roadV[i]]) {
    if (sid < 0) continue;
    const sg = world.segs[sid],
      fa = sg.dir === "h" ? f[0] : f[1];
    if (Math.abs(fa) < 0.3 && sid !== Math.max(world.roadH[i], world.roadV[i])) continue;
    const dir = fa >= 0 ? 1 : -1,
      a0 = (sg.dir === "h" ? x : y) / M_T;
    for (let k = 0; k <= 12; k++) {
      const along = Math.floor(a0 + dir * k) + 0.5;
      if (along < sg.b0 + 2 || along > sg.b1 - 1) break;
      if (
        sg.js.some((J) => {
          const [a, b] = jRange(sg, J);
          return along > a - 3 && along < b + 3;
        })
      )
        continue;
      const p = lanePt(sg, dir, 0, along),
        dv = dirVec(sg, dir);
      return { sg, dir, along, x: p[0], y: p[1], h: Math.atan2(dv[0], -dv[1]) };
    }
  }
  return null;
}
// v50: drive a parked kinematic vehicle k (x,y,h) onto that lane point, then hand it to the traffic sim there
// (no teleporting to another road); returns the traffic vehicle once it has rejoined, else null (call every frame)
function emRejoin(k, role, dt, kind) {
  if (!k.rj) {
    k.rj = emLaneAhead(k.x, k.y, k.h);
    if (!k.rj) return null;
    k.path = [[k.rj.x, k.rj.y]];
  }
  if (!emFollow(k, dt, 3.5)) return null;
  k.h += wrapA(k.rj.h - k.h) * Math.min(1, dt * 4);
  const R = k.rj,
    v = spawnVehicle(R.x, R.y, true, {
      kind: kind || (role === "police" ? "estate" : "van"),
      seg: R.sg.id,
      dir: R.dir,
      along: R.along,
      clear: 3,
    });
  if (!v) return null;
  v.role = role;
  v.art = { body: emArt(role).body };
  return v;
}
const onView = (x, y) => typeof onScreen === "function" && onScreen(x, y, -2);
// ---------- patrols
function polStations() {
  return typeof SVC !== "undefined" ? SVC.byType.police : [];
}
function polMake(v, st) {
  v.role = "police";
  v.polT = v.polT || POL_T[(Math.random() * 3) | 0];
  v.art = { body: emArt(v.polT).body };
  v.pol = { st, end: timeS + 90 + Math.random() * 480, home: false };
  POL.cars.push(v);
  return v;
}
// GTA2-style: patrols appear on roads just out of view (1-1.5 screens), biased ahead of the truck
function polViewR() {
  const v = viewRectM();
  return Math.max(v[2] - v[0], v[3] - v[1]) / 2;
}
// v44: police never appear on or near the player: well off-screen, a minimum distance away, and out of line of sight
const POL_MIN_D = 170; // m
function polLOS(x, y) {
  // true when nothing solid (buildings, trees, hedges) lies between the truck and (x, y) [metres]
  const d = Math.hypot(x - truck.x, y - truck.y),
    n = Math.ceil(d / 3);
  for (let k = 1; k < n; k++) {
    const t = k / n,
      tx = Math.floor((truck.x + (x - truck.x) * t) / M_T),
      ty = Math.floor((truck.y + (y - truck.y) * t) / M_T);
    if (isSolidTile(tx, ty)) return false;
  }
  return true;
}
function polSpawnOK(x, y) {
  const d = Math.hypot(x - truck.x, y - truck.y);
  if (d < POL_MIN_D || onScreen(x, y, 40)) return false;
  return d > 380 || !polLOS(x, y);
}
function polSpawn() {
  const P = truck,
    R = polViewR(),
    f = fwd(P.h),
    mv = Math.abs(P.v) > 3;
  for (let t = 0; t < 90; t++) {
    let a = Math.random() * 6.283;
    if (mv && Math.random() < 0.7) a = Math.atan2(f[1], f[0]) + (Math.random() - 0.5) * 1.8;
    const d = Math.max(POL_MIN_D, R * 1.25) * (1 + Math.random() * 1.2) + 15,
      x = P.x + Math.cos(a) * d,
      y = P.y + Math.sin(a) * d;
    const tx = Math.floor(x / M_T),
      ty = Math.floor(y / M_T);
    if (!inb(tx, ty)) continue;
    const i = idx(tx, ty);
    if ((world.roadH[i] < 0 && world.roadV[i] < 0) || !polSpawnOK(x, y)) continue;
    if (POL.cars.length >= (WANT.lvl >= 2 ? 10 : 6)) return null;
    const v = spawnVehicle(x, y, true, { kind: "estate" });
    if (v && !polSpawnOK(v.x, v.y)) {
      const k = traffic.vs.indexOf(v);
      if (k >= 0) traffic.vs.splice(k, 1);
      continue;
    }
    if (v) {
      let st = null,
        bd = 1e18;
      for (const s of polStations()) {
        const q = (s.x - x) ** 2 + (s.y - y) ** 2;
        if (q < bd) {
          bd = q;
          st = s;
        }
      }
      POL.spawns = (POL.spawns || 0) + 1;
      return polMake(v, st);
    }
  }
  return null;
}
function polUpdatePatrols(dt) {
  POL.cars = POL.cars.filter((v) => traffic.vs.includes(v) || v === (POL.chase && POL.chase.v));
  const R = polViewR();
  for (const v of POL.cars.slice()) {
    if (v === (POL.chase && POL.chase.v)) continue;
    if (
      (v.pol && v.pol.leave && !onScreen(v.x, v.y, 15)) ||
      (Math.hypot(v.x - truck.x, v.y - truck.y) > Math.max(R * 2.6 + 60, 480) &&
        !onScreen(v.x, v.y, 20))
    ) {
      const i = traffic.vs.indexOf(v);
      if (i >= 0) {
        releaseJ(v);
        traffic.vs.splice(i, 1);
      }
      POL.cars.splice(POL.cars.indexOf(v), 1);
    }
  }
  POL.spawnT -= dt * (Math.abs(truck.v) > 2 ? 1 : 0.3);
  if (POL.spawnT <= 0) {
    POL.spawnT =
      Math.random() < 0.25 ? 6 + Math.random() * 10 : 15 + Math.random() * Math.random() * 70;
    POL.want = 1 + ((Math.random() * 3) | 0);
    const n = POL.cars.filter(
      (v) => Math.hypot(v.x - truck.x, v.y - truck.y) < R * 2.6 + 60,
    ).length;
    if (n < POL.want) polSpawn();
  }
  for (const v of POL.cars) {
    const p = v.pol;
    if (!p || v === (POL.chase && POL.chase.v)) continue;
    if (!p.home && timeS > p.end && p.st && typeof aiGoal === "function") {
      p.home = true;
      const e = emRoadPt(p.st);
      aiGoal(v, { entrance: e, name: p.st.name });
      v.pinT = 0;
    }
    if (p.home && p.st) {
      const e = emRoadPt(p.st);
      if (Math.hypot(v.x - e.x, v.y - e.y) < 14) {
        const i = traffic.vs.indexOf(v);
        if (i >= 0) {
          releaseJ(v);
          traffic.vs.splice(i, 1);
        }
        const s = p.st;
        POL.parkIn = POL.parkIn || [];
        POL.parkIn.push({
          x: v.x,
          y: v.y,
          h: v.h,
          path: [
            [e.x, s.entrance.y + 2],
            [s.entrance.x, s.rect.y0 + M_T * 1.5],
          ],
          t: 0,
        });
      }
    }
  }
  if (POL.parkIn) POL.parkIn = POL.parkIn.filter((k) => !emFollow(k, dt, 4));
}
// ---------- detection
// v68: police see the rig only with a clear line of sight (buildings, walls, trees, hedges block it) within POL_SEE_R;
// right on your tail (< POL_TAIL_R) they always see you. Parked inside a blue hide spot while wanted = never seen.
const POL_SEE_R = 150,
  POL_TAIL_R = 22;
function polRay(x0, y0, x1, y1) {
  // true when nothing solid lies between (x0,y0) and (x1,y1) [metres]; ends excluded (4 m) so the cars themselves don't block
  const d = Math.hypot(x1 - x0, y1 - y0),
    n = Math.ceil(d / 2);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (t * d < 4 || (1 - t) * d < 4) continue;
    const x = x0 + (x1 - x0) * t,
      y = y0 + (y1 - y0) * t;
    if (isSolidTile(Math.floor(x / M_T), Math.floor(y / M_T))) return false;
  }
  return true;
}
function polSeesPt(x, y, px, py) {
  const d = Math.hypot(px - x, py - y);
  if (d < POL_TAIL_R) return true;
  if (d > POL_SEE_R * (typeof nmK === "function" ? 1 - 0.3 * nmK() : 1)) return false;
  return polRay(x, y, px, py);
}
function polSeesRig(x, y) {
  const P = truck;
  if (Math.hypot(P.x - x, P.y - y) < POL_TAIL_R) return true;
  if (Math.abs(P.v) < 0.5 && hideAt(P.x, P.y)) return false; // parked in a blue hide spot
  if (polSeesPt(x, y, P.x, P.y)) return true;
  const f = fwd(P.h);
  if (polSeesPt(x, y, P.x + f[0] * 3, P.y + f[1] * 3)) return true;
  return !!(P.trl && polSeesPt(x, y, P.trl.x, P.trl.y));
}
// v70 (James 22 Oct): spotting needs the police car on the player's screen and the rig inside its forward view cone
// (POL_CONE each side of its heading: front, front-left, front-right); a rig right behind it (< POL_CLOSE, e.g. queued at
// the same lights) is still seen. A chase in progress keeps the old rule (polSeesRig: LOS + tail range) so tailing works.
const POL_CONE = (65 * Math.PI) / 180,
  POL_CLOSE = 15;
function polInCone(v, px, py) {
  const f = fwd(v.h || 0),
    dx = px - v.x,
    dy = py - v.y,
    d = Math.hypot(dx, dy) || 1;
  return (dx * f[0] + dy * f[1]) / d >= Math.cos(POL_CONE);
}
function polSpots(v) {
  const P = truck,
    d = Math.hypot(P.x - v.x, P.y - v.y);
  if (d < POL_CLOSE) return !(Math.abs(P.v) < 0.5 && hideAt(P.x, P.y));
  if (!onScreen(v.x, v.y, 0)) return false;
  const f = fwd(P.h),
    pts = [[P.x, P.y], [P.x + f[0] * 3, P.y + f[1] * 3]];
  if (P.trl) pts.push([P.trl.x, P.trl.y]);
  if (!pts.some(([x, y]) => polInCone(v, x, y))) return false;
  return polSeesRig(v.x, v.y);
}
function polSees(v) {
  if ((POL.chase && v === POL.chase.v) || POL.aux.some((a) => a.v === v)) return polSeesRig(v.x, v.y);
  return polSpots(v);
}
function polCanSee() {
  return POL.cars.filter((v) => v.pol && polSees(v));
}
function polOffence(type, v, reason) {
  const c = POL.chase;
  if (c && c.offs.some((o) => o.type === type)) return;
  if (!c) {
    polStartChase(v);
  }
  const ch = POL.chase;
  if (!ch) return;
  const amt = (typeof OFF !== "undefined" && OFF.FINES && OFF.FINES[type]) || POL_FINES[type];
  ch.offs.push({ type, amount: amt, reason });
  if (type === "pedestrian") ch.arrest = true;
  POL.log.push({ type, t: timeS });
  if (typeof toast === "function") toast("\u{1F6A8} Police: " + reason);
}
function polStartChase(v) {
  if (!v) return;
  const i = traffic.vs.indexOf(v);
  if (i >= 0) {
    releaseJ(v);
    traffic.vs.splice(i, 1);
  }
  POL.chase = {
    v,
    offs: [],
    arrest: false,
    t: 0,
    siren: emSiren("police"),
    sp: Math.abs(v.v || 8),
  };
  POL.stopT = 0;
  POL.lostT = 0;
}
function polEndChase(back) {
  const c = POL.chase;
  if (!c) return;
  if (c.siren) c.siren.stop();
  POL.chase = null;
  POL.stopT = 0;
  if (back) {
    const nv = emToTraffic(c.v.x, c.v.y, "police");
    if (nv) {
      nv.polT = c.v.polT;
      polMake(nv, c.v.pol && c.v.pol.st);
      nv.pol.end = timeS + 60 + Math.random() * 300;
    }
  }
}
function polDetect(dt) {
  if (POL.chase && POL.chase.paying) return;
  const P = truck,
    mph = Math.abs(P.v) * (typeof MPH !== "undefined" ? MPH : 2.237),
    lim = (typeof SPL !== "undefined" && SPL.cur) || 30;
  // speeding past a police car
  if (mph > lim * 1.1 + 2)
    for (const v of polCanSee()) {
      if (Math.hypot(v.x - P.x, v.y - P.y) < 40) {
        polOffence("speeding", v, Math.round(mph) + " mph in a " + lim + " zone");
        break;
      }
    }
  // red light: player enters a signal-controlled junction box on a red
  const tx = P.x / M_T,
    ty = P.y / M_T;
  let J = null;
  for (const j of world.junctions || [])
    if (j.lights && tx >= j.x && tx < j.x + j.w && ty >= j.y && ty < j.y + j.h) {
      J = j;
      break;
    }
  if (J && J !== POL.inJ && POL.prev && typeof sigState === "function") {
    const sg = slSegAt(POL.prev[0], POL.prev[1]);
    if (sg && sg.js && sg.js.includes(J)) {
      const dd = sg.dir === "h" ? Math.sign(P.x - POL.prev[0]) : Math.sign(P.y - POL.prev[1]);
      if (dd) {
        const key = sg.id + ":" + dd,
          red = ["S", "L", "R"].every((m) => sigState(J, key, m) === "r");
        if (red && Math.abs(P.v) > 2) {
          POL.redRuns = (POL.redRuns || 0) + 1;
          const w = polCanSee()[0];
          if (w) polOffence("redlight", w, "ran a red light");
        }
      }
    }
  }
  POL.inJ = J;
  if (!J) POL.prev = [P.x, P.y];
}
function polPedHit(p) {
  const w = polCanSee()[0];
  if (w || (POL.chase && polSees(POL.chase.v)))
    polOffence("pedestrian", w || POL.chase.v, "hit a pedestrian");
  else if (!POL.chase) {
    WANT.lvl = 1;
    WANT.t = 60;
    WANT.sp = 1;
  }
}
// ---------- v29 wanted level: unseen ped hit -> 1 star, 60 s; searchers roam near (not on) the player; spotted -> chase -> fine/arrest
const WANT = { lvl: 0, t: 0, sp: 0, chased: false };
function wantSearchGoal(v) {
  // v68: search round the last place they saw you (not your live position), widening the longer you stay hidden
  const lx = WANT.lx ?? truck.x,
    ly = WANT.ly ?? truck.y,
    age = timeS - (WANT.seenT ?? timeS),
    a = Math.random() * 6.283,
    d = 20 + Math.random() * Math.min(260, 60 + age * 4);
  if (typeof aiGoal === "function")
    aiGoal(v, {
      entrance: { x: lx + Math.cos(a) * d, y: ly + Math.sin(a) * d },
      name: "search",
    });
  v.pol.sg = timeS + 12 + Math.random() * 10;
}
function wantUpdate(dt) {
  if (!WANT.lvl) return;
  if (POL.chase) {
    WANT.chased = true;
    WANT.t = 60;
    return;
  }
  if (WANT.chased) {
    wantClear();
    return;
  } // chase over (fined/arrested or lost): wanted level ends
  const hid = hideAt(truck.x, truck.y) && Math.abs(truck.v) < 0.5;
  WANT.hid = hid;
  const w = !hid && polCanSee()[0];
  if (w) {
    polOffence("pedestrian", w, "hit a pedestrian");
    return;
  }
  WANT.t -= dt * (hid ? 6 : 1);
  if (WANT.t <= 0) {
    wantClear();
    return;
  }
  WANT.sp -= dt;
  const n = POL.cars.filter((v) => v.pol && v.pol.search).length;
  if (WANT.sp <= 0) {
    WANT.sp = 5 + Math.random() * 7;
    if (n < 4) {
      const v = polSpawn();
      if (v) {
        v.pol.search = true;
        v.pinT = timeS + 1e6;
        wantSearchGoal(v);
      }
    }
  }
  for (const v of POL.cars)
    if (v.pol && v.pol.search && timeS > v.pol.sg && traffic.vs.includes(v)) wantSearchGoal(v);
}
function wantClear() {
  WANT.lvl = 0;
  WANT.chased = false;
  WANT.t = 0;
  for (const v of POL.cars)
    if (v.pol && v.pol.search) {
      v.pol.search = false;
      v.pinT = 0;
      v.pol.end = timeS;
      v.pol.home = false;
      v.pol.leave = true;
    }
}
function drawWantedHUD() {
  if (typeof wantStarsHUD === "function") {
    wantStarsHUD();
    return;
  }
  if (!WANT.lvl) return;
  const x = VW - 34,
    y = VH * 0.13 + 70,
    fl = POL.chase || WANT.t > 10 || (timeS * 4) % 1 < 0.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 7 : 17,
      a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = fl ? "#ffd21e" : "rgba(255,210,30,0.35)";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.font = "bold 13px system-ui,sans-serif";
  ctx.textAlign = "center";
  const tx = POL.chase ? "CHASE" : "WANTED " + Math.ceil(WANT.t) + "s";
  ctx.strokeText(tx, 0, 32);
  ctx.fillText(tx, 0, 32);
  ctx.restore();
}
function polMapDots(px, py) {
  const ph = (timeS * 4) % 1 < 0.5,
    L = POL.cars
      .filter((v) => v.pol && (v.pol.search || WANT.lvl) && traffic.vs.includes(v))
      .map((v) => v);
  if (POL.chase) L.push(POL.chase.v);
  for (const a of POL.aux) L.push(a.v);
  for (const v of L) {
    const X = px(v.x),
      Y = py(v.y);
    const R = typeof bigmap !== "undefined" && bigmap.open ? 8 : 5;
    ctx.fillStyle = ph ? "rgba(255,32,48,0.35)" : "rgba(42,91,255,0.35)";
    ctx.beginPath();
    ctx.arc(X, Y, R * 2, 0, 7);
    ctx.fill();
    ctx.fillStyle = ph ? "#ff2030" : "#2a5bff";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X, Y, R, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
}
// ---------- chase
// v31 chase: re-paths over the road network to the player's current position every ~0.5 s and follows the same roads (junction boxes may be cut);
// steers around traffic; can be lost (stuck behind traffic, crash/spin, or out of sight for a while) -> 1-star 60 s search
function polChasePath(c, tx, ty) {
  const v = c.v,
    s = navSnap(v.x / M_T, v.y / M_T, 6),
    e = navSnap(tx / M_T, ty / M_T, 8);
  c.path = null;
  if (!s || !e) return;
  const p = navAStar(s[0], s[1], e[0], e[1]);
  if (!p || p.length < 2) return;
  c.path = p.map((i) => [((i % MW) + 0.5) * M_T, (Math.floor(i / MW) + 0.5) * M_T]);
  c.pk = 0;
}
function polChaseAim(c) {
  const v = c.v,
    P = c.path;
  if (!P) return null;
  let k = c.pk || 0,
    bd = 1e18;
  for (let q = k; q < Math.min(P.length, k + 12); q++) {
    const d = (P[q][0] - v.x) ** 2 + (P[q][1] - v.y) ** 2;
    if (d < bd) {
      bd = d;
      k = q;
    }
  }
  c.pk = k;
  const q = P[Math.min(P.length - 1, k + 5)],
    r = P[Math.min(P.length - 1, k + 6)];
  if (!q) return null;
  const dx = r[0] - q[0],
    dy = r[1] - q[1],
    l = Math.hypot(dx, dy) || 1;
  const o = polLaneOff(c, q[0], q[1], -dy / l, dx / l);
  return [q[0] - (dy / l) * o, q[1] + (dx / l) * o];
} // v-pol3: per-car lane offset (was a fixed 1.4 m keep-left line shared by every chaser)
// ---------- v-pol3: each chaser drives its own line: slot offset across the road, weaves every few s, pulls out to overtake
const POL_SLOTS = [1.6, -2.4, 5.0, -5.4, 0, 3.4, -3.8];
function polLaneTick(c, dt) {
  if (c.slot == null) {
    const used = new Set([POL.chase, ...POL.aux].filter((q) => q && q !== c && q.slot != null).map((q) => q.slot));
    c.slot = 0;
    while (used.has(c.slot) && c.slot < POL_SLOTS.length - 1) c.slot++;
    c.lat = POL_SLOTS[c.slot];
    c.stag = c.slot * 3.2;
    c.wvT = 1 + Math.random() * 2;
  }
  c.wvT -= dt;
  if (c.wvT <= 0) {
    c.wvT = 2 + Math.random() * 3.5;
    c.lat = POL_SLOTS[c.slot] + (Math.random() - 0.5) * 3.2; // weave
  }
  c.lat = Math.max(-5.6, Math.min(5.6, c.lat));
  c.latS = (c.latS ?? c.lat) + Math.max(-2.2 * dt, Math.min(2.2 * dt, c.lat - (c.latS ?? c.lat)));
}
// largest offset (towards the wanted one) that is still on a road tile and not solid; n = unit right-ish normal
function polLaneOff(c, x, y, nx, ny) {
  const want = c.latS ?? 1.4,
    sg = Math.sign(want) || 1;
  for (let d = Math.abs(want); d > 0.3; d -= 0.7) {
    const px = x - nx * sg * d * -1,
      py = y - ny * sg * d * -1,
      tx = Math.floor(px / M_T),
      ty = Math.floor(py / M_T);
    if (inb(tx, ty) && isRoadT(idx(tx, ty)) && !solidAtM(px, py)) return sg * d;
  }
  return 0;
}
// v-pol2: chase cars are solid against buildings / scenery (they used to slide straight through blocks)
function polBodyHit(v, x, y, h, sgn) {
  const f = fwd(h),
    r = rgt(h),
    L = (v.L || 4.6) / 2,
    W = (v.W || 1.9) / 2 - 0.1;
  for (const a of sgn > 0 ? [L, L * 0.4] : [-L, -L * 0.4])
    for (const b of [-W, 0, W]) if (solidAtM(x + f[0] * a + r[0] * b, y + f[1] * a + r[1] * b)) return true;
  return false;
}
function polMove(c, ds) {
  const v = c.v,
    f = fwd(v.h),
    nx = v.x + f[0] * ds,
    ny = v.y + f[1] * ds;
  c.wall = false;
  // already overlapping (spawned / pushed into scenery): let it drive out rather than trap it
  const inside = polBodyHit(v, v.x, v.y, v.h, 1) && polBodyHit(v, v.x, v.y, v.h, -1);
  if (inside || !polBodyHit(v, nx, ny, v.h, ds >= 0 ? 1 : -1)) {
    v.x = nx;
    v.y = ny;
    return true;
  }
  // slide along the wall on one axis if possible
  if (!polBodyHit(v, nx, v.y, v.h, ds >= 0 ? 1 : -1)) v.x = nx;
  else if (!polBodyHit(v, v.x, ny, v.h, ds >= 0 ? 1 : -1)) v.y = ny;
  else {
    c.wall = true;
    POL.wallHits = (POL.wallHits || 0) + 1;
  }
  c.sp *= 0.4;
  return false;
}
function polStartReverse(c) {
  const v = c.v,
    f = fwd(v.h),
    r = rgt(v.h);
  // which front corner is blocked? reverse so the nose swings away from it
  let lb = 0,
    rb = 0;
  for (let a = 1; a <= 6; a++) {
    if (solidAtM(v.x + f[0] * a * 1.2 - r[0] * 2, v.y + f[1] * a * 1.2 - r[1] * 2)) lb++;
    if (solidAtM(v.x + f[0] * a * 1.2 + r[0] * 2, v.y + f[1] * a * 1.2 + r[1] * 2)) rb++;
  }
  for (const o of traffic.vs) {
    if (o === v) continue;
    const ox = o.x - v.x,
      oy = o.y - v.y;
    if (ox * ox + oy * oy > 100) continue;
    if (ox * f[0] + oy * f[1] < 0) continue;
    if (ox * r[0] + oy * r[1] > 0) rb++;
    else lb++;
  }
  c.revSd = lb > rb ? 1 : rb > lb ? -1 : (c.revSd || 1) * -1; // +1: nose turns right
  c.rev = 1.5;
  c.noGo = 0;
  c.revN = (c.revN || 0) + 1;
  POL.reverses = (POL.reverses || 0) + 1;
  if (c.revN <= 4) c.stuckT = 0;
}
function polReverse(c, dt) {
  const v = c.v;
  c.rev -= dt;
  c.sp += Math.max(-8 * dt, Math.min(8 * dt, -4.5 - c.sp));
  // reversing with the wheels turned: nose swings toward revSd, the tail goes the other way
  v.steer = -0.45 * c.revSd;
  v.h += c.revSd * Math.min(1, Math.abs(c.sp) / 3) * 0.9 * dt;
  if (!polMove(c, c.sp * dt)) c.rev = Math.min(c.rev, 0.1); // backed into something too
  v.v = c.sp;
  if (c.rev <= 0) {
    c.rev = 0;
    c.sp = 0;
    v.steer = 0;
    c.rp = 0; // re-path straight away
  }
}
// traffic + the other chase cars (so chasers see and weave round each other too)
function polNear(v) {
  const L = traffic.vs.slice();
  for (const q of [POL.chase, ...POL.aux]) if (q && q.v !== v) L.push(q.v);
  return L;
}
// drives one chase car (the main POL.chase or a 2-star pursuer); returns "spin" while spinning out, "spun" when a spin ends far away
function polDriveChase(c, dt) {
  const v = c.v,
    P = truck;
  c.t += dt;
  polLaneTick(c, dt);
  // v-pol3: aim behind the REAL rear of the rig (trailer kingpin + 12.4 m, cab rear axle + 1.2 m) — the old point was
  // the kingpin itself, i.e. inside the trailer; each chaser gets its own stagger + lateral line across the road
  const back =
      (WANT.lvl >= 2 && c.t > 3 ? 2 : P.trl ? 9 : 7) + (c.stag || 0),
    f = fwd(P.trl ? P.th : P.h),
    kp = kingpin(P), // the coupled trailer's own x/y are stale while towing: the kingpin is the truth
    rx = P.trl ? kp[0] - f[0] * TRL.rear : P.x - f[0] * CAB.rear,
    ry = P.trl ? kp[1] - f[1] * TRL.rear : P.y - f[1] * CAB.rear,
    lo = polLaneOff(c, rx - f[0] * back, ry - f[1] * back, -f[1], f[0]),
    tx = c.goal ? c.goal[0] : rx - f[0] * back - f[1] * lo,
    ty = c.goal ? c.goal[1] : ry - f[1] * back + f[0] * lo,
    dP = Math.hypot(P.x - v.x, P.y - v.y);
  if (c.spin > 0) {
    c.spin -= dt;
    v.h += dt * 5 * c.spinD;
    c.sp *= Math.max(0, 1 - dt * 3);
    const fv = fwd(v.h);
    v.x += fv[0] * c.sp * dt;
    v.y += fv[1] * c.sp * dt;
    v.v = c.sp;
    polSep(c);
    if (c.siren) c.siren.set(emSirenVol(v.x, v.y, v));
    return c.spin <= 0 && dP > 45 ? "spun" : "spin";
  }
  c.rp = (c.rp || 0) - dt;
  let aim = null;
  const direct = Math.hypot(tx - v.x, ty - v.y) < 28 && polRay(v.x, v.y, tx, ty);
  if (!direct) {
    if (c.rp <= 0) {
      c.rp = 0.5;
      polChasePath(c, tx, ty);
    }
    aim = polChaseAim(c);
  }
  // v31: close in, follow the player's own tyre track (breadcrumbs) so the car stays on the road instead of cutting across verges
  c.trT = (c.trT || 0) - dt;
  if (c.trT <= 0) {
    c.trT = 0.25;
    (c.trail = c.trail || []).push([P.x, P.y]);
    if (c.trail.length > 80) c.trail.shift();
  }
  if (direct && c.trail && c.trail.length > 2) {
    let k = -1,
      bd = 1e18;
    for (let q = 0; q < c.trail.length; q++) {
      const d2 = (c.trail[q][0] - v.x) ** 2 + (c.trail[q][1] - v.y) ** 2;
      if (d2 < bd) {
        bd = d2;
        k = q;
      }
    }
    for (let q = k; q < c.trail.length; q++) {
      const t = c.trail[q];
      if (Math.hypot(t[0] - v.x, t[1] - v.y) > 6) {
        const t2 = c.trail[Math.min(c.trail.length - 1, q + 1)],
          tq = c.trail[Math.max(0, q - 1)],
          ex = t2[0] - tq[0],
          ey = t2[1] - tq[1],
          el = Math.hypot(ex, ey);
        if (el > 0.5) {
          const o = polLaneOff(c, t[0], t[1], -ey / el, ex / el);
          aim = [t[0] - (ey / el) * o, t[1] + (ex / el) * o];
        } else aim = t;
        break;
      }
    }
  }
  // v-pol2: no road path and no clear line -> never aim straight through buildings; follow the rig's own track instead
  if (!aim && !polRay(v.x, v.y, tx, ty) && c.trail && c.trail.length) {
    for (let q = c.trail.length - 1; q >= 0; q--)
      if (polRay(v.x, v.y, c.trail[q][0], c.trail[q][1])) {
        aim = c.trail[q];
        break;
      }
  }
  if (!aim) aim = [tx, ty];
  let dx = aim[0] - v.x,
    dy = aim[1] - v.y;
  const d = Math.hypot(tx - v.x, ty - v.y);
  // steer around traffic directly ahead
  const fv0 = fwd(v.h);
  let blk = null,
    bdist = 1e9;
  for (const o of polNear(v)) {
    if (o === v) continue;
    const ox = o.x - v.x,
      oy = o.y - v.y,
      al = ox * fv0[0] + oy * fv0[1];
    if (al < 0 || al > 22) continue;
    const lat = ox * fv0[1] - oy * fv0[0];
    if (Math.abs(lat) < 2.8 && al < bdist) {
      bdist = al;
      blk = { o, lat, al };
    }
  }
  if (blk && blk.al > 5 && timeS - (c.otT || 0) > 1.5) {
    c.otT = timeS;
    c.lat = (c.latS ?? 0) + (blk.lat > 0 ? -3.6 : 3.6); // overtake (incl. the oncoming lane)
    c.wvT = 2.5;
  }
  c.fol = null;
  if (blk) {
    const r = rgt(v.h),
      sd = blk.lat > 0 ? -1 : 1;
    // fellow chaser at about our speed: just follow it (gap held via c.fol) — no hard swerve; faster: pull out past it
    const kk = blk.o.pol ? (c.sp - Math.abs(blk.o.v || 0) < 3 ? 0 : 0.4) : 1;
    dx += (r[0] * sd * 3.5 * (16 - blk.al) * kk) / 4;
    dy += (r[1] * sd * 3.5 * (16 - blk.al) * kk) / 4;
    const isPol = !!blk.o.pol,
      cl = c.sp - Math.abs(blk.o.v || 0);
    // following a fellow chaser: hold a gap instead of ramming it (they still weave out round it)
    if (isPol) c.fol = Math.abs(blk.o.v || 0) + Math.max(0, blk.al - 6) * 1.3;
    if (blk.al < 3.2) {
      if (cl > (isPol ? 9 : 6)) {
        c.spin = 1.6;
        c.spinD = Math.random() < 0.5 ? -1 : 1;
        POL.crashes = (POL.crashes || 0) + 1;
        if (isPol) POL.polCrash = (POL.polCrash || 0) + 1;
        else POL.trafCrash = (POL.trafCrash || 0) + 1;
        return "spin";
      }
      c.sp = Math.min(c.sp, Math.abs(blk.o.v || 0));
    }
  }
  const want =
      d > 25
        ? Math.max(Math.abs(P.v) + (c.aux ? 4 : 6), 15)
        : d > 6
          ? Math.abs(P.v) + d * 0.25
          : Math.abs(P.v) * 0.6,
    turn = Math.abs(wrapA(Math.atan2(dx, -dy) - v.h)),
    cap = turn > 0.6 ? 9 : turn > 0.3 ? 16 : 40;
  c.sp += Math.max(-10 * dt, Math.min(5 * dt, Math.min(cap, want, c.fol ?? 1e9) - c.sp));
  c.fol = null;
  if (dP < 7) c.sp = Math.min(c.sp, WANT.lvl >= 2 ? Math.abs(P.v) + 3 : 1);
  if (c.rev > 0) {
    polReverse(c, dt);
  } else {
    if (Math.hypot(dx, dy) > 1.2) {
      const th = Math.atan2(dx, -dy);
      const tr = 2.8 * dt * Math.min(1, (Math.abs(c.sp) + 0.4) / 5); // v-pol2: no turning on the spot
      v.h += Math.max(-tr, Math.min(tr, wrapA(th - v.h)));
    }
    polMove(c, c.sp * dt);
    v.v = c.sp;
    // stuck: nose in a wall / scenery, or barely moving while it wants to go -> reverse out with steering
    const prog = Math.hypot(v.x - (c.lx ?? v.x), v.y - (c.ly ?? v.y));
    c.lx = v.x;
    c.ly = v.y;
    if (c.wall || (want > 4 && prog < 0.6 * dt && dP > 9)) c.noGo = (c.noGo || 0) + dt;
    else c.noGo = Math.max(0, (c.noGo || 0) - dt * 2);
    if (c.noGo > (c.wall ? 0.35 : 1.2)) polStartReverse(c);
  }
  polSep(c);
  if (c.siren) {
    c.siren.set(emSirenVol(v.x, v.y, v));
    if (c.t > 4) {
      c.siren.mode("yelp");
      c.siren.rate(Math.min(7, 3.2 + (c.t - 4) * 0.08));
    }
    if (dP < 30 && timeS - (c.wh || 0) > 3.5) {
      c.wh = timeS;
      c.siren.whoop();
    }
  }
  c.dP = dP;
}
function polUpdateChase(dt) {
  const c = POL.chase;
  if (!c) return;
  const st = polDriveChase(c, dt),
    v = c.v,
    P = truck,
    dP = Math.hypot(P.x - v.x, P.y - v.y);
  if (st === "spun") {
    // v-pol3: the lead car crashed out; if other chasers are still on you, the nearest takes over the chase
    if (POL.aux.length) {
      polEndChase(true);
      let bi = 0;
      for (let i = 1; i < POL.aux.length; i++)
        if (Math.hypot(POL.aux[i].v.x - P.x, POL.aux[i].v.y - P.y) < Math.hypot(POL.aux[bi].v.x - P.x, POL.aux[bi].v.y - P.y)) bi = i;
      const n = POL.aux.splice(bi, 1)[0];
      n.aux = 0;
      n.goal = null;
      POL.chase = n;
      POL.lostT = 0;
      POL.handover = (POL.handover || 0) + 1;
    } else polLose("crashed");
    return;
  }
  if (st) return;
  // losing them
  if (c.sp < 2 && dP > 40 && Math.abs(P.v) > 2) {
    c.stuckT = (c.stuckT || 0) + dt;
    if (c.stuckT > 6) {
      polLose("stuck");
      return;
    }
  } else c.stuckT = 0;
  if (!polSeesRig(v.x, v.y)) {
    POL.lostT += dt;
    if (POL.lostT > 10) {
      polLose("sight");
      return;
    }
  } else POL.lostT = 0;
  if (Math.abs(P.v) < 0.3 && dP < 32 && !c.paying) {
    POL.stopT += dt;
    if (POL.stopT > 5) polFinePopup();
  } else if (!c.paying) POL.stopT = 0;
}
// ---------- v49: 2-star pursuers: extra chase cars driven like the main chase car, kept topped up (3-5) by want2Update
POL.aux = [];
function polAuxSpawn() {
  const v = polSpawn();
  if (!v) return null;
  const i = traffic.vs.indexOf(v);
  if (i >= 0) {
    releaseJ(v);
    traffic.vs.splice(i, 1);
  }
  const c = {
    v,
    offs: [],
    arrest: false,
    t: 0,
    siren: emSiren("police"),
    sp: 14,
    aux: 1,
    goal: null,
  };
  POL.aux.push(c);
  POL.auxSpawns = (POL.auxSpawns || 0) + 1;
  return c;
}
function polAuxDrop(c, back) {
  const k = POL.aux.indexOf(c);
  if (k < 0) return;
  POL.aux.splice(k, 1);
  if (c.siren) c.siren.stop();
  if (!back) return;
  const nv = emToTraffic(c.v.x, c.v.y, "police");
  if (nv) {
    nv.polT = c.v.polT;
    polMake(nv, null);
    if (!WANT.lvl) {
      nv.pol.end = timeS;
      nv.pol.leave = true;
      return;
    }
    nv.pol.search = true;
    nv.pinT = timeS + 1e6;
    wantSearchGoal(nv);
  }
}
function polAuxUpdate(dt) {
  if (!POL.aux.length) return;
  const R = polViewR(),
    P = truck;
  for (const c of POL.aux.slice()) {
    const st = polDriveChase(c, dt),
      v = c.v,
      dP = Math.hypot(P.x - v.x, P.y - v.y);
    polSep(c);
    if (st === "spun") {
      polAuxDrop(c, false);
      continue;
    }
    if (st) continue;
    // close and no main chase car: this one takes over (stops / fines / busts work as usual)
    if (!POL.chase && dP < 60 && !c.goal) {
      POL.aux.splice(POL.aux.indexOf(c), 1);
      c.aux = 0;
      POL.chase = c;
      POL.stopT = 0;
      POL.lostT = 0;
      continue;
    }
    if (c.sp < 2 && dP > 40 && Math.abs(P.v) > 2) {
      if ((c.stuckT = (c.stuckT || 0) + dt) > 6) polAuxDrop(c, true);
      continue;
    }
    c.stuckT = 0;
    if (dP > Math.max(R * 2.6 + 60, 480) && !onScreen(v.x, v.y, 20)) {
      polAuxDrop(c, false);
      continue;
    }
    // searching the last sighting: arrived and nobody in sight -> back to a normal search car
    if (c.goal && Math.hypot(c.goal[0] - v.x, c.goal[1] - v.y) < 20) polAuxDrop(c, true);
  }
}
function polLose(why) {
  const c = POL.chase;
  if (!c) return;
  POL.lostWhy = why;
  POL.lost = (POL.lost || 0) + 1;
  toast("\u{1F694} You lost the police \u2014 lie low");
  polEndChase(true);
  const nv = POL.cars[POL.cars.length - 1];
  if (nv && nv.pol) {
    nv.pol.search = true;
    nv.pinT = timeS + 1e6;
    wantSearchGoal(nv);
  }
  WANT.lvl = 1;
  WANT.t = 60;
  WANT.chased = false;
  WANT.sp = 3;
}
function polFinePopup() {
  const c = POL.chase;
  if (!c || c.paying) return;
  c.paying = true;
  P_input_clear();
  const tot0 = c.offs.reduce((a, o) => a + o.amount, 0),
    tot = Math.min(tot0, Math.max(0, Math.floor(truck.money || 0)));
  const rows = c.offs
    .map(
      (o) =>
        `<div style="display:flex;justify-content:space-between;gap:18px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.12)"><span>${esc(o.reason)}${o.type === "pedestrian" ? ' <b style="color:#ff6b6b">\u2022 ARREST</b>' : ""}</span><b>${money(o.amount)}</b></div>`,
    )
    .join("");
  const b = openModal(
    "police",
    `<h2 style="margin:0 0 6px">\u{1F694} Police \u2014 Fixed Penalty</h2><p style="opacity:.8;margin:0 0 10px">You were pulled over. Offences:</p>${rows}
    <div style="display:flex;justify-content:space-between;margin:10px 0 14px;font-size:1.15em"><span>Total</span><b>${money(tot0)}</b></div>${tot < tot0 ? `<p style="color:#ffd27a;margin:0 0 10px">You only have ${money(tot)} — the officer takes what you have (no debt).</p>` : ""}${c.arrest ? '<p style="color:#ff8a8a;margin:0 0 10px">Hitting a pedestrian is a serious offence: you will be <b>arrested</b> and taken to the nearest police station. ' + (typeof career !== "undefined" && career.active ? "Your current job will be <b>cancelled</b> (no pay)." : "") + "</p>" : ""}
    <button class="btn go" id="polPay" style="width:100%;font-size:1.1em;padding:12px">PAY ${money(tot)}${c.arrest ? " & GO WITH OFFICER" : ""} <kbd>${typeof pad !== "undefined" && pad.active ? "\u24B6" : "Enter"}</kbd></button>`,
    "polfine",
  );
  if (!document.getElementById("polCss")) {
    const st = document.createElement("style");
    st.id = "polCss";
    st.textContent =
      "body #ui .mback .modal.polfine{width:min(420px,92vw)!important;height:auto!important;max-height:88dvh!important;border-radius:16px!important;border:1px solid rgba(255,255,255,.12)!important;padding:16px 18px!important;margin:auto!important;overflow:auto;box-sizing:border-box;font-size:15px} body #ui .mback .modal.polfine h2{font-size:20px} @media (orientation:landscape) and (max-height:500px){ body #ui .mback .modal.polfine{max-height:92dvh!important;padding:10px 14px!important;font-size:13px} body #ui .mback .modal.polfine h2{font-size:17px} }";
    document.head.appendChild(st);
  }
  b.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
  const btn = b.querySelector("#polPay");
  btn.addEventListener("click", () => polPay());
}
function P_input_clear() {
  if (typeof input !== "undefined") for (const k in input) input[k] = false;
}
function polPay() {
  const c = POL.chase;
  if (!c) return;
  let left = Math.max(0, Math.floor(truck.money || 0));
  for (const o of c.offs) {
    const amt = Math.min(o.amount, left);
    left -= amt;
    if (typeof OFF !== "undefined")
      OFF.add({ type: o.type, amount: amt, reason: o.reason, police: true });
    else truck.money -= amt;
    if (typeof pmCountFine === "function") pmCountFine(amt);
  }
  closeUI();
  const arrest = c.arrest;
  if (arrest) {
    polArrest();
    polEndChase(false);
  } else {
    toast("\u2714 Fine paid \u2014 drive safely");
    polEndChase(true);
  }
}
function polArrest() {
  let st = null,
    bd = 1e18;
  for (const s of polStations()) {
    const q = (s.x - truck.x) ** 2 + (s.y - truck.y) ** 2;
    if (q < bd) {
      bd = q;
      st = s;
    }
  }
  const ov = document.createElement("div");
  ov.id = "polArrest";
  ov.style.cssText =
    "position:fixed;inset:0;z-index:90;background:#000;opacity:0;transition:opacity .9s;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:700 18px system-ui;text-align:center;pointer-events:none";
  ov.innerHTML = `<div style="font-size:44px;color:#ff4d4d;letter-spacing:3px">ARRESTED</div><div style="margin-top:10px;opacity:.85">Taken to ${esc(st ? st.name : "the police station")}</div><div style="margin-top:6px;opacity:.6;font-weight:500">${career && career.active ? "Your delivery job has been cancelled. " : ""}Your truck will be in the station car park.</div>`;
  document.body.appendChild(ov);
  POL.arrested = (POL.arrested || 0) + 1;
  requestAnimationFrame(() => (ov.style.opacity = "1"));
  setTimeout(() => {
    if (st) polPark(st);
  }, 1100);
  setTimeout(() => {
    ov.style.opacity = "0";
    setTimeout(() => ov.remove(), 1000);
  }, 3400);
}
function polEndMission() {
  const a = typeof career !== "undefined" && career.active;
  const jt = a && a.trailer;
  if (a && typeof abandonJob === "function") abandonJob(true);
  if (jt) {
    if (truck.trl === jt) {
      jt.coupled = false;
      truck.trl = null;
    }
    if (jt.bay && jt.bay.trailer === jt) jt.bay.trailer = null;
    const i = world.trailers.indexOf(jt);
    if (i >= 0) world.trailers.splice(i, 1);
  }
  if (typeof clearRoute === "function") clearRoute();
  if (typeof saveGame === "function") saveGame();
}
function polPark(st) {
  polEndMission();
  const pk = st.parts.park,
    x = (pk.x + pk.w / 2) * M_T,
    y = (pk.y + 2.2) * M_T;
  truck.h = 0;
  truck.th = 0;
  truck.x = x;
  truck.y = y;
  truck.v = 0;
  if (truck.vx !== undefined) {
    truck.vx = 0;
    truck.vy = 0;
  }
  if (truck.trl) {
    const tr = truck.trl;
    tr.th = 0;
    const k = kingpin(truck);
    tr.x = k[0];
    tr.y = k[1];
    tr.v = 0;
  }
  if (typeof cam !== "undefined") {
    cam.x = truck.x * PPM;
    cam.y = truck.y * PPM;
  }
  if (
    typeof NAV !== "undefined" &&
    NAV.route &&
    NAV.route.target &&
    typeof setRoute === "function"
  ) {
    const t = NAV.route.target;
    try {
      setRoute(t.ref || { x: t.x, y: t.y, name: t.name });
    } catch (e) {}
  }
}
addEventListener("keydown", (e) => {
  if (
    typeof career !== "undefined" &&
    career.uiOpen === "police" &&
    (e.key === "Enter" || e.key === " ")
  ) {
    e.preventDefault();
    const b = document.getElementById("polPay");
    if (b) b.click();
  }
});
// ---------- parked cars in station bays (static decoration, cheap)
function polDrawParked(vx0, vy0, vx1, vy1) {
  for (const s of polStations()) {
    if (
      s.rect.x1 * PPM < vx0 ||
      s.rect.x0 * PPM > vx1 ||
      s.rect.y1 * PPM < vy0 ||
      s.rect.y0 * PPM > vy1
    )
      continue;
    s.bays.forEach((b, i) => {
      if ((i * 7 + s.tx) % 3) return;
      emBlit({ x: b.x, y: b.y, h: b.h, polT: POL_T[(i + s.tx) % 3 === 2 ? 1 : 0] }, "police");
    });
  }
}

// ---------- v29 blue-light yield: traffic ahead (both directions) slows, pulls to its kerb and stops; the emergency vehicle takes the centre
const EMY = { src: [], n: 0 };
function emSources() {
  const out = [];
  const c = POL.chase;
  if (c && !c.paying) out.push(c.v);
  for (const a of POL.aux || []) if (a.v) out.push(a.v); // v50: every pursuer on blue lights
  // every AI vehicle on blue lights (emYield sets v.emResp from emOnBlue each frame: police, ambulance, fire engine)
  for (const v of traffic.vs) if (v.emResp && !out.includes(v)) out.push(v);
  if (typeof AMBU !== "undefined")
    for (const j of AMBU.jobs) if ((j.st === "pull" || j.st === "drive") && j.k) out.push(j.k);
  if (typeof FIRE !== "undefined")
    for (const e of FIRE.eng) if ((e.stt === "out" || e.stt === "arrive") && e.k) out.push(e.k);
  return out;
}
// v50: a traffic-sim emergency vehicle currently on blue lights (responding), as opposed to patrolling / returning
function emOnBlue(v) {
  if (v.amb) return v.amb.st === "go";
  if (v.fireE) return v.fireE.stt === "go";
  return (
    v.role === "police" &&
    !!v.pol &&
    !!v.pol.search &&
    typeof WANT !== "undefined" &&
    WANT.lvl > 0 &&
    !v.pol.home
  );
}
function emInJ(v) {
  const tx = v.x / M_T,
    ty = v.y / M_T;
  for (const J of world.junctions || [])
    if (tx > J.x - 1 && tx < J.x + J.w + 1 && ty > J.y - 1 && ty < J.y + J.h + 1) return true;
  return false;
}
function emYield(v, acc, dt) {
  if (v.role === "police" || v.role === "ambulance" || v.role === "fire") {
    v.emResp = emOnBlue(v);
    if (v.emResp) {
      // v50: weave to the clearest offset (traffic.js probes v.emWant); only ghost through when genuinely stuck
      emShift(v, v.emWant ?? 1.3, dt, 2.4);
      if (v.stopT > 2.5 && !emInJ(v)) v.ghostT = Math.max(v.ghostT || 0, 1.2);
    } else if (v.emO) emShift(v, 0, dt);
    return acc;
  }
  let y = false;
  for (const E of EMY.src) {
    const f = fwd(E.h),
      dx = v.x - E.x,
      dy = v.y - E.y,
      al = dx * f[0] + dy * f[1],
      lat = Math.abs(dx * f[1] - dy * f[0]),
      par = Math.abs(Math.cos((v.h || 0) - (E.h || 0)));
    if (par > 0.7 && al > -4 && al < 110 && lat < 14) {
      y = true;
      break;
    }
  }
  if (y && (emInJ(v) || v.ring != null || v.jHeld)) y = false; // never stop inside a junction box (no deadlocks): clear it first
  if (y) {
    v.emY = timeS;
    EMY.n++;
    emShift(v, -1.4, dt);
    return Math.min(acc, -Math.max(1.5, v.v * 1.2));
  }
  if (beamYield(v, dt)) return acc;
  if (v.emO) emShift(v, 0, dt);
  return acc;
}
// lateral shift relative to heading (+ = right / centre line, - = left / kerb), eased; tracked separately from crash offsets
function emShift(v, to, dt, rate) {
  const cur = v.emO || 0,
    nw = cur + (to - cur) * Math.min(1, dt * (rate || 1.6)),
    d = nw - cur,
    r = rgt(v.h || 0);
  v.offX += r[0] * d;
  v.offY += r[1] * d;
  v.emO = Math.abs(nw) < 0.02 && to === 0 ? 0 : nw;
  if (v.emO === 0) {
    v.offX -= r[0] * nw;
    v.offY -= r[1] * nw;
  }
}
setTimeout(() => {
  const ub = updateBreakdown;
  updateBreakdown = function (dt) {
    EMY.src = emSources();
    return ub.apply(this, arguments);
  };
}, 0);
// ---------- per-frame + drawing
function emSirenLazy() {
  if (typeof audio === "undefined" || !audio.ctx || audio.ctx.state !== "running") return;
  const c = POL.chase;
  if (c && !c.siren) c.siren = emSiren("police");
  if (typeof AMBU !== "undefined")
    for (const j of AMBU.jobs)
      if (!j.siren && (j.st === "go" || j.st === "drive")) j.siren = emSiren("ambulance");
  if (typeof FIRE !== "undefined")
    for (const e of FIRE.eng)
      if (!e.siren && (e.stt === "go" || e.stt === "out" || e.stt === "arrive") && (e.v || e.k))
        e.siren = emSiren("fire");
}
function updatePolice(dt) {
  emSirenLazy();
  if (
    !world.ready ||
    (typeof started !== "undefined" && !started) ||
    (typeof uiBlocking === "function" && uiBlocking())
  )
    return;
  polUpdatePatrols(dt);
  polUpdateChase(dt);
  if (POL.chase && POL.chase.v) polSep(POL.chase);
  polAuxUpdate(dt);
  polDetect(dt);
  wantUpdate(dt);
}
function drawPolice(vx0, vy0, vx1, vy1) {
  try {
    drawHideSpots(vx0, vy0, vx1, vy1);
  } catch (e) {}
  polDrawParked(vx0, vy0, vx1, vy1);
  for (const v of POL.cars) if (v.pol && traffic.vs.includes(v)) emDrawBar(v, false, "police");
  if (POL.parkIn) for (const k of POL.parkIn) emBlit(k, "police");
  const c = POL.chase;
  if (c) {
    emBlit(c.v, "police");
    emDrawBar(c.v, true, "police");
  }
  for (const a of POL.aux) {
    emBlit(a.v, "police");
    emDrawBar(a.v, true, "police");
  }
  polSearchlights(vx0, vy0, vx1, vy1);
}
// v70: at night searching police sweep a roof searchlight across their view cone (cosmetic: the whole cone with a clear line
// of sight counts as seen, see polSpots). Pushed into the night light layer as a soft wedge (daynight.js kind "sl").
function polSearchlights(vx0, vy0, vx1, vy1) {
  if (typeof DN === "undefined" || DN.dark < 0.05) return;
  for (const v of POL.cars) {
    if (!(v.pol && v.pol.search && traffic.vs.includes(v))) continue;
    const X = v.x * PPM,
      Y = v.y * PPM;
    if (X < vx0 - 600 || X > vx1 + 600 || Y < vy0 - 600 || Y > vy1 + 600) continue;
    const f = fwd(v.h || 0),
      a0 = Math.atan2(f[1], f[0]),
      a = a0 + Math.sin(timeS * 0.9 + (v.id || 0) * 1.7) * POL_CONE * 0.8;
    (DN.dyn || (DN.dyn = [])).push({ k: "sl", x: X, y: Y, r: 55 * PPM, a, w: 0.16, hi: typeof gfxHi === "function" ? gfxHi() : true });
  }
}
function drawPoliceHUD() {
  const c = POL.chase;
  if (!c || c.paying) return;
  const w = Math.min(VW - 30, 360),
    x = VW / 2 - w / 2,
    y = VH * 0.13,
    ph = (timeS * 3) % 1 < 0.5;
  ctx.save();
  ctx.fillStyle = ph ? "rgba(200,20,30,0.88)" : "rgba(25,60,200,0.88)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, 52, 12) : ctx.rect(x, y, w, 52);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "900 19px system-ui,sans-serif";
  ctx.fillText("\u{1F6A8} POLICE \u2014 PULL OVER", VW / 2, y + 23);
  ctx.font = "12px system-ui,sans-serif";
  ctx.fillText(
    POL.stopT > 0
      ? "Stay stopped\u2026 " + Math.max(0, 5 - POL.stopT).toFixed(1) + " s"
      : "Stop the truck and wait for the officer",
    VW / 2,
    y + 42,
  );
  ctx.restore();
}
setTimeout(() => {
  const ub = updateBreakdown;
  updateBreakdown = function (dt) {
    ub.apply(this, arguments);
    try {
      updatePolice(dt);
    } catch (e) {
      console.warn("[police]", e);
    }
  };
  const dt0 = drawTraffic;
  drawTraffic = function (vx0, vy0, vx1, vy1) {
    const r = dt0.apply(this, arguments);
    try {
      polSepAll();
      drawPolice(vx0, vy0, vx1, vy1);
      if (typeof drawAmbulance === "function") drawAmbulance(vx0, vy0, vx1, vy1);
    } catch (e) {
      console.warn("[police draw]", e);
    }
    return r;
  };
  const dh = drawHUD;
  drawHUD = function () {
    dh.apply(this, arguments);
    if (!(typeof bigmap !== "undefined" && bigmap.open)) {
      drawPoliceHUD();
      drawWantedHUD();
    }
  };
  if (typeof svcMapIcons === "function") {
    const sm = svcMapIcons;
    svcMapIcons = function (icon, px, py) {
      sm.apply(this, arguments);
      try {
        hideMapDots(px, py, icon);
        polMapDots(px, py);
      } catch (e) {}
    };
  }
  if (typeof BigRig !== "undefined") {
    BigRig.police = () => ({
      cars: POL.cars.length,
      chase: !!POL.chase,
      offences: POL.chase ? POL.chase.offs.map((o) => o.type) : [],
    });
  }
}, 0);

// ---------- v31 hide spots: blue dashed bays in car parks / alleys / under bridges; parked inside one while wanted -> cooldown ~6x faster, unseen
const HIDE = { list: null };
function hideBad(x, y) {
  const S = typeof SVC !== "undefined" && SVC.byType ? Object.values(SVC.byType).flat() : [];
  for (const s of S) {
    const r = s.rect;
    if (r && x > r.x0 - 12 && x < r.x1 + 12 && y > r.y0 - 12 && y < r.y1 + 12) return true;
  }
  for (const g of world.garages || []) if (Math.hypot(g.x - x, g.y - y) < 45) return true;
  for (const f of world.fuel || []) if (Math.hypot(f.x - x, f.y - y) < 40) return true;
  for (const d of world.depots || [])
    if (d.entrance && Math.hypot(d.entrance.x - x, d.entrance.y - y) < 30) return true;
  return false;
}
// v68: hide spots are places a rig can actually reach but can't be seen from any road within HIDE_LOS_R
// (behind buildings, in back yards / lanes, forest tracks); checked with the same ray test the police use (polRay).
const HIDE_LOS_R = 72; // m
function hideSeenFromRoad(cx, cy) {
  const r = Math.ceil(HIDE_LOS_R / M_T),
    tx = Math.floor(cx / M_T),
    ty = Math.floor(cy / M_T);
  for (let dy = -r; dy <= r; dy += 2)
    for (let dx = -r; dx <= r; dx += 2) {
      const x = tx + dx,
        y = ty + dy;
      if (!inb(x, y) || !isRoadT(idx(x, y))) continue;
      const mx = (x + 0.5) * M_T,
        my = (y + 0.5) * M_T;
      if (Math.hypot(mx - cx, my - cy) > HIDE_LOS_R) continue;
      if (polRay(mx, my, cx, cy)) return true;
    }
  return false;
}
function hideBuild() {
  const L = [],
    C = 96,
    N = MW * MH;
  // drivable-from-road distance (tiles) over open ground, capped at 40: the spot must be reachable
  const D = new Uint8Array(N).fill(255),
    q = new Int32Array(N);
  let qh = 0,
    qt = 0;
  for (let i = 0; i < N; i++)
    if (isRoadT(i)) {
      D[i] = 0;
      q[qt++] = i;
    }
  const open = (i) => !SOLID[G[i]] && G[i] !== T.WATER && !(DOCK_FENCE && DOCK_FENCE[i]);
  while (qh < qt) {
    const i = q[qh++],
      d = D[i];
    if (d >= 40) continue;
    const x = i % MW;
    for (const j of [x > 0 ? i - 1 : -1, x < MW - 1 ? i + 1 : -1, i - MW, i + MW])
      if (j >= 0 && j < N && D[j] === 255 && open(j)) {
        D[j] = d + 1;
        q[qt++] = j;
      }
  }
  const R = mulberry(4242);
  for (let cy = 0; cy < MH; cy += C)
    for (let cx = 0; cx < MW; cx += C) {
      let f = null;
      const o = (R() * 3) | 0;
      for (let t = 0, y = cy + 2 + o; y < cy + C - 4 && !f; y += 3)
        for (let x = cx + 2 + o; x < cx + C - 6 && !f; x += 3) {
          if (D[idx(x + 2, y + 1)] < 4 || D[idx(x + 2, y + 1)] > 15 || ++t > 900) continue;
        let g = true;
        for (let b = 0; b < 2 && g; b++)
          for (let a = 0; a < 4 && g; a++) {
            if (!inb(x + a, y + b)) g = false;
            else {
              const i = idx(x + a, y + b);
              if (D[i] < 4 || D[i] > 40 || !open(i)) g = false;
            }
          }
        if (!g) continue;
        const mx = (x + 2) * M_T,
          my = (y + 1) * M_T;
        if (hideBad(mx, my)) continue;
        if (D[idx(x + 2, y + 1)] > 15) continue; // within ~60 m of a road: concealed, not just remote
        const A = typeof apA === "function" && apA(); // not on the airfield
        if (A && x + 4 >= A.x0 - 8 && x <= A.x1 + 8 && y + 2 >= A.y0 - 8 && y <= A.y1 + 8) continue;
        if (solidAtM(mx, my) || solidAtM(mx - 7, my) || solidAtM(mx + 7, my)) continue;
        if (hideSeenFromRoad(mx, my)) continue;
        f = [x, y];
        }
      if (f) {
        const k = get(f[0], f[1]);
        L.push({
          x: f[0] * M_T,
          y: f[1] * M_T,
          w: 4 * M_T,
          h: 2 * M_T,
          kind: k === T.TREE || k === T.GRASS || k === T.PGRASS ? "hidden track" : "back yard",
        });
      }
    }
  // under bridges: road tiles beneath an overpass (hidden by the deck)
  if (world.bridges)
    for (const b of world.bridges.slice(0, 40)) {
      if (b.under) L.push({ x: b.under.x, y: b.under.y, w: 4 * M_T, h: 2 * M_T, kind: "bridge" });
    }
  HIDE.list = L;
  return L;
}
function hideAt(x, y) {
  const L = HIDE.list || hideBuild();
  for (const h of L) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  return null;
}
function drawHideSpots(vx0, vy0, vx1, vy1) {
  if (!(WANT.lvl >= 1)) return; // v68b: only while wanted (1+ stars)
  const L = HIDE.list || hideBuild();
  const W1 = true,
    pu = 0.75 + 0.25 * Math.sin(timeS * 3);
  ctx.save();
  for (const h of L) {
    const X = h.x * PPM,
      Y = h.y * PPM,
      W = h.w * PPM,
      H = h.h * PPM;
    if (X > vx1 || X + W < vx0 || Y > vy1 || Y + H < vy0) continue;
    if (W1) {
      ctx.shadowColor = "rgba(60,150,255,0.9)";
      ctx.shadowBlur = 18 * pu;
    } // v38: subtle glow while wanted
    ctx.fillStyle = W1 ? "rgba(40,120,255," + (0.3 * pu + 0.08) + ")" : "rgba(40,120,255,0.18)";
    ctx.fillRect(X, Y, W, H);
    ctx.shadowBlur = 0;
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(110,180,255,1)";
    ctx.strokeRect(X + 1.5, Y + 1.5, W - 3, H - 3);
    ctx.setLineDash([]);
    const fs = Math.round(PPM * 1.6);
    ctx.font = "bold " + fs + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(10,30,70,0.85)";
    ctx.strokeText("HIDE", X + W / 2, Y + H / 2);
    ctx.fillStyle = "#cfe4ff";
    ctx.fillText("HIDE", X + W / 2, Y + H / 2);
    if (W1 && typeof dnLight === "function")
      dnLight(X + W / 2, Y + H / 2, Math.max(W, H) * 0.8, "rgba(70,150,255,1)", 0.5);
  }
  ctx.restore();
}
function hideMapDots(px, py, icon) {
  // v68: always on the world map + minimap (only in discovered areas), brighter while wanted
  if (!(WANT.lvl >= 1)) return; // v68b: only while wanted (1+ stars)
  const L = HIDE.list || hideBuild();
  ctx.save();
  for (const h of L) {
    const cx = h.x + h.w / 2,
      cy = h.y + h.h / 2;
    if (typeof fogSeen === "function" && !fogSeen(cx, cy)) continue;
    const X = px(cx),
      Y = py(cy);
    if (X < -10 || Y < -10 || X > VW + 10 || Y > VH + 10) continue;
    if (icon) icon(X, Y, "#1e6cff", "H");
  }
  ctx.restore();
}
// v38: hide boxes as sat-nav targets (full map tap/click/controller pick) while wanted
function hidePOIs() {
  if (!(WANT.lvl >= 1)) return [];
  return (HIDE.list || hideBuild()).map(
    (h, i) =>
      h.poi ||
      (h.poi = { name: "Hide box " + (i + 1), x: h.x + h.w / 2, y: h.y + h.h / 2, hide: h }),
  );
}

// v31: full beam behind a car in the outer (fast) lane of a multi-lane road -> it indicates left and moves over one lane when clear (UK keep-left)
function bySeg(v) {
  const tx = Math.floor(v.x / M_T),
    ty = Math.floor(v.y / M_T);
  if (!inb(tx, ty)) return null;
  const i = idx(tx, ty),
    h = world.roadH[i],
    vv = world.roadV[i];
  const H = Math.abs(Math.sin(v.h || 0)) > 0.8;
  const id = H ? h : vv;
  if (id == null || id < 0) return null;
  const sg = world.segs[id];
  if (!sg || nLanes(sg) < 2 || (sg.dir === "h") !== H) return null;
  const lt = (H ? v.y : v.x) / M_T;
  return { sg, cen: Math.abs(lt - (sg.a + sg.w / 2)) < 1.05 };
}
function beamYield(v, dt) {
  const P = truck;
  if (v.byT) {
    v.byT += dt;
    const f = fwd(v.h),
      al = (P.x - v.x) * f[0] + (P.y - v.y) * f[1];
    v.sigBY = v.emO > -3.6 ? -1 : 0;
    emShift(v, -4, dt);
    if ((al > 30 && v.byT > 3) || v.byT > 20 || !bySeg(v)) {
      v.byT = 0;
      v.sigBY = 0;
      BYD.done++;
      return false;
    }
    return true;
  }
  if (!(typeof HB !== "undefined" && HB.on) || Math.abs(P.v) < 8 || Math.abs(v.v || 0) < 6 || v.emO)
    return false;
  const f = fwd(v.h),
    dx = P.x - v.x,
    dy = P.y - v.y,
    al = dx * f[0] + dy * f[1],
    lat = dx * f[1] - dy * f[0];
  if (al > -5 || al < -40 || Math.abs(lat) > 2.5 || Math.cos((P.h || 0) - (v.h || 0)) < 0.9)
    return false;
  const s = bySeg(v);
  if (!s || !s.cen) return false;
  const r = rgt(v.h);
  for (const o of traffic.vs) {
    if (o === v) continue;
    const ox = o.x - v.x,
      oy = o.y - v.y,
      oa = ox * f[0] + oy * f[1],
      ol = ox * r[0] + oy * r[1];
    if (Math.abs(oa) < 14 && ol < -2.2 && ol > -6.5) return false;
  } // left lane must be clear
  v.byT = 0.01;
  BYD.n++;
  return true;
}
const BYD = { n: 0, done: 0 };
setTimeout(() => {
  const dt0 = drawTraffic;
  drawTraffic = function () {
    for (const v of traffic.vs) if (v.sigBY) v.sig = v.sigBY;
    return dt0.apply(this, arguments);
  };
}, 0);

// v38: police never pass through vehicles: capsule separation against traffic, parked/attached trailers and the player's rig.
// Blocked -> slow to the blocker's speed / queue; the only way past is a real gap (the steer-around above).
function polObst() {
  const L = [];
  for (const o of traffic.vs) L.push([o, o.x, o.y, o.h || 0, o.L || 4.6, o.W || 2]);
  for (const t of world.trailers || []) {
    if (t === truck.trl || t.coupled) continue;
    const b = trailerBox(t);
    L.push([t, b.x, b.y, b.h || 0, b.L, b.W + 0.05]);
  }
  if (traffic.parkedIdx && POL.chase) {
    const v = POL.chase.v,
      cx = Math.floor(v.x / 64),
      cy = Math.floor(v.y / 64);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const a = traffic.parkedIdx.get(cx + i + "," + (cy + j));
        if (a) for (const o of a) L.push([o, o.x, o.y, o.h || 0, o.L || 4.4, o.W || 1.9]);
      }
  } // parked cars are solid too
  for (const c of [POL.chase, ...POL.aux])
    if (c) {
      const a = c.v.polT ? emArt(c.v.polT) : c.v;
      L.push([c.v, c.v.x, c.v.y, c.v.h || 0, a.L || 4.6, a.W || 1.9]);
    }
  // v-pol3: rig bodies at their real centres (truck.x = rear axle, trailer x = kingpin) — police used to slide under them
  const tf = fwd(truck.h),
    cm = (CAB.front + CAB.rear) / 2;
  L.push([truck, truck.x + tf[0] * -cm, truck.y + tf[1] * -cm, truck.h, CAB.rear - CAB.front, CAB.w + 0.1]);
  if (truck.trl) {
    const t = truck.trl,
      th = truck.th != null ? truck.th : t.th,
      f2 = fwd(th),
      tm = (TRL.front + TRL.rear) / 2;
    const kp = kingpin(truck);
    L.push([t, kp[0] - f2[0] * tm, kp[1] - f2[1] * tm, th, TRL.rear - TRL.front, TRL.w + 0.1]);
  }
  return L;
}
function polCaps(x, y, h, len) {
  const f = fwd(h),
    a = len / 2;
  return [x - f[0] * a, y - f[1] * a, x + f[0] * a, y + f[1] * a];
}
function polSegD(a, b) {
  let best = [1e9];
  for (let i = 0; i <= 4; i++) {
    const px = a[0] + ((a[2] - a[0]) * i) / 4,
      py = a[1] + ((a[3] - a[1]) * i) / 4,
      ex = b[2] - b[0],
      ey = b[3] - b[1],
      l2 = ex * ex + ey * ey || 1,
      u = Math.max(0, Math.min(1, ((px - b[0]) * ex + (py - b[1]) * ey) / l2)),
      qx = b[0] + ex * u,
      qy = b[1] + ey * u,
      d = Math.hypot(px - qx, py - qy);
    if (d < best[0]) best = [d, px - qx, py - qy];
  }
  for (let i = 0; i <= 4; i++) {
    const px = b[0] + ((b[2] - b[0]) * i) / 4,
      py = b[1] + ((b[3] - b[1]) * i) / 4,
      ex = a[2] - a[0],
      ey = a[3] - a[1],
      l2 = ex * ex + ey * ey || 1,
      u = Math.max(0, Math.min(1, ((px - a[0]) * ex + (py - a[1]) * ey) / l2)),
      qx = a[0] + ex * u,
      qy = a[1] + ey * u,
      d = Math.hypot(px - qx, py - qy);
    if (d < best[0]) best = [d, qx - px, qy - py];
  }
  return best;
}
function polMTV(ax, ay, ah, aL, aW, bx, by, bh, bL, bW) {
  let best = 1e9,
    bv = null;
  const dx = ax - bx,
    dy = ay - by;
  for (const ax2 of [fwd(ah), rgt(ah), fwd(bh), rgt(bh)]) {
    const pr = (h, L, W) => {
      const f = fwd(h),
        r = rgt(h);
      return (Math.abs(f[0] * ax2[0] + f[1] * ax2[1]) * L) / 2 + (Math.abs(r[0] * ax2[0] + r[1] * ax2[1]) * W) / 2;
    };
    const d = dx * ax2[0] + dy * ax2[1],
      o = pr(ah, aL, aW) + pr(bh, bL, bW) - Math.abs(d);
    if (o <= 0) return null;
    if (o < best) {
      best = o;
      const s = d >= 0 ? 1 : -1;
      bv = [ax2[0] * o * s, ax2[1] * o * s];
    }
  }
  return bv;
}
// v-pol3: last pass right before drawing (after the rig has moved this frame) so nothing is ever drawn overlapping
function polSepAll() {
  for (let k = 0; k < 2; k++) for (const c of [POL.chase, ...POL.aux]) if (c && c.v) polSep1(c, true);
}
function polSep(c) {
  polSep1(c);
  if (c.blocked) polSep1(c, true); // second pass: pushes out of one body can push into another
}
function polSep1(c, again) {
  const v = c.v;
  const pa = v.polT ? emArt(v.polT) : v,
    mL = pa.L || v.L || 4.6,
    mW = pa.W || v.W || 1.9;
  let hit = 0;
  if (typeof j103PolUpdate === "function") j103PolUpdate();
  for (const [o, x, y, h, len, w] of polObst()) {
    if (o === v || Math.abs(x - v.x) > 18 || Math.abs(y - v.y) > 18) continue;
    if (typeof j103Apart === "function" && j103Apart(v, o, x, y)) continue; // J103: deck vs ring
    // v-pol3: exact rectangle vs rectangle (SAT) with a 0.15 m skin; push out along the minimum axis
    const mtv = polMTV(v.x, v.y, v.h, mL + 0.3, mW + 0.3, x, y, h, len, w);
    if (mtv) {
      const shared = o.pol && [POL.chase, ...POL.aux].some((q) => q && q.v === o) ? 0.5 : 1; // chaser pairs: split the push
      v.x += mtv[0] * shared;
      v.y += mtv[1] * shared;
      if (shared < 1) {
        o.x -= mtv[0] * 0.5;
        o.y -= mtv[1] * 0.5;
      }
      hit++;
      // v-pol3: a real hit with civilian traffic or another chaser at speed -> this car spins out (may crash out of the chase)
      if (!again && o !== truck && o !== truck.trl && !(c.spin > 0)) {
        const of = fwd(h),
          ovs = o.v || 0,
          vf = fwd(v.h),
          ml = Math.hypot(mtv[0], mtv[1]) || 1,
          // closing speed along the contact normal (side-by-side rubbing at the same speed is not a crash)
          rel = -((vf[0] * c.sp - of[0] * ovs) * mtv[0] + (vf[1] * c.sp - of[1] * ovs) * mtv[1]) / ml;
        if (rel > (o.pol ? 9 : 6)) {
          c.spin = 1.3;
          c.spinD = Math.random() < 0.5 ? -1 : 1;
          c.sp *= 0.55;
          POL.crashes = (POL.crashes || 0) + 1;
          if (o.pol || o.role === "police") POL.polCrash = (POL.polCrash || 0) + 1;
          else POL.trafCrash = (POL.trafCrash || 0) + 1;
          if (!o.parked && o.v != null && !o.pol) o.v *= 0.3;
        }
      }
      const f = fwd(v.h),
        ov = o === truck || o === truck.trl ? truck.v : o.v || 0,
        along = (x - v.x) * f[0] + (y - v.y) * f[1];
      // only a hit from behind (pushed back along our heading) bleeds speed; side-by-side rubbing doesn't (stops a 0.9x cascade)
      const back = -(mtv[0] * f[0] + mtv[1] * f[1]) / (Math.hypot(mtv[0], mtv[1]) || 1);
      if (along > 0 && back > 0.6) c.sp = Math.min(c.sp, Math.max(0, Math.abs(ov) * (o.pol ? 1 : 0.9)));
    }
  }
  c.blocked = hit > 0;
  POL.blockN = (POL.blockN || 0) + hit;
}

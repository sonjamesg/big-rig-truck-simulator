/**
 * @file milrig.js — dealer truck "Bastion M6 6x6" (v51): big green military-style 6x6 heavy tractor, £35,000. Very
 *   high power, sturdy (less crash damage), slightly lower top speed, thirsty; couples every trailer like the other
 *   cabs and takes every paint colour / customiser part. Own top-down art (three axles, chunky off-road tyres, flat
 *   armoured cab, roof hatch, jerry cans, spare wheel, brush guard) instead of the chrome detail pass.
 * Exposes (globals): MIL_RIG, milRigArt
 * Depends on: career.js (TRUCK_MODELS, modelArt, modelArtCache), lorry.js (CAB, rr, PPM, ART_SCALE), render.js (shade,
 *   mkCanvas), tune.js (czApply, czStats, czFx, czPct)
 * Load order: near the end of build.py, after tune4.js (wraps modelArt outermost, so the chrome pass is skipped for this model). Shared global scope.
 */
const MIL_RIG = {
  id: "bastion",
  name: "Bastion M6 6x6",
  price: 35000,
  hp: 880,
  power: 1.95,
  vmax: 23.6,
  tank: 720,
  econ: 1.45,
  dur: 0.55, // crash damage multiplier: sturdy
  style: { roof: "std", nose: 0.9, mil: 1 },
  cols: ["#4b5d33", "#6b7448", "#3a4429", "#8a7d55", "#2f3a2a", "#c2b280", "#1f2a33"],
  blurb: "Military-grade 6x6 heavy tractor: huge pulling power, built like a bunker.",
};
TRUCK_MODELS.push(MIL_RIG);
function milRigArt(col) {
  const nose = MIL_RIG.style.nose,
    front = CAB.front - nose,
    S = PPM * ART_SCALE,
    W = Math.ceil((CAB.w + 1.1) * S),
    H = Math.ceil((CAB.rear + 0.2 - front) * S),
    c = mkCanvas(W, H),
    g = c.getContext("2d"),
    X = (v) => W / 2 + v * S,
    Y = (v) => (v - front) * S,
    body = shade(col, 1),
    dk = shade(col, 0.62),
    lt = shade(col, 1.28);
  // chassis rails + fifth wheel
  g.fillStyle = "#23251f";
  g.fillRect(X(-0.6), Y(-3.2), 0.38 * S, 4.3 * S);
  g.fillRect(X(0.22), Y(-3.2), 0.38 * S, 4.3 * S);
  g.fillStyle = "#2c2f29";
  g.fillRect(X(-0.95), Y(-1.1), 1.9 * S, 2.3 * S);
  g.fillStyle = "#4e5248";
  g.beginPath();
  g.arc(X(0), Y(0.05), 0.72 * S, 0, 7);
  g.fill();
  g.fillStyle = "#1a1b18";
  g.fillRect(X(-0.12), Y(0.05), 0.24 * S, 0.8 * S);
  // six chunky off-road tyres (front axle + rear tandem), tread blocks
  const tyre = (cx, cy) => {
    g.fillStyle = "#151614";
    rr(g, X(cx) - 0.3 * S, Y(cy) - 0.6 * S, 0.6 * S, 1.2 * S, 0.16 * S);
    g.fill();
    g.fillStyle = "#2b2d29";
    for (let k = -4; k <= 4; k++) g.fillRect(X(cx) - 0.3 * S, Y(cy) + k * 0.13 * S - 1, 0.6 * S, 2);
    g.fillStyle = "#3c4035";
    g.fillRect(X(cx) - 0.08 * S, Y(cy) - 0.25 * S, 0.16 * S, 0.5 * S);
  };
  for (const s of [-1, 1]) for (const ay of [-CAB.wheelbase, -0.55, 0.75]) tyre(s * 1.22, ay);
  // rear mudguards / deck plates over the tandem
  for (const s of [-1, 1]) {
    g.fillStyle = dk;
    g.fillRect(X(s > 0 ? 0.92 : -1.52), Y(-1.3), 0.6 * S, 0.22 * S);
  }
  // fuel tanks + jerry cans along the frame
  g.fillStyle = dk;
  rr(g, X(-1.0), Y(-2.45), 0.42 * S, 1.0 * S, 0.12 * S);
  g.fill();
  rr(g, X(0.58), Y(-2.45), 0.42 * S, 1.0 * S, 0.12 * S);
  g.fill();
  g.fillStyle = shade(col, 0.85);
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 0.62 : -0.96), Y(-2.35), 0.34 * S, 0.34 * S);
  // bonnet (short nose) + brush guard
  const gh = g.createLinearGradient(X(-1.05), 0, X(1.05), 0);
  gh.addColorStop(0, dk);
  gh.addColorStop(0.5, lt);
  gh.addColorStop(1, dk);
  g.fillStyle = gh;
  rr(g, X(-1.05), Y(front + 0.15), 2.1 * S, (nose + 0.35) * S, 0.18 * S);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,.35)";
  g.lineWidth = 2;
  for (let k = 1; k < 5; k++) {
    g.beginPath();
    g.moveTo(X(-0.7), Y(front + 0.15 + k * 0.17 * nose));
    g.lineTo(X(0.7), Y(front + 0.15 + k * 0.17 * nose));
    g.stroke();
  }
  g.fillStyle = "#2a2c27";
  g.fillRect(X(-1.15), Y(front - 0.02), 2.3 * S, 0.16 * S);
  for (const x of [-1.0, -0.35, 0.3, 0.95]) g.fillRect(X(x), Y(front - 0.02), 0.06 * S, 0.4 * S);
  // headlamps in cages
  g.fillStyle = "#f3f0d6";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(X(s * 0.78), Y(front + 0.32), 0.13 * S, 0, 7);
    g.fill();
  }
  // flat armoured cab
  const c0 = -5.0,
    c1 = -2.55,
    gb = g.createLinearGradient(X(-1.25), 0, X(1.25), 0);
  gb.addColorStop(0, dk);
  gb.addColorStop(0.18, body);
  gb.addColorStop(0.82, body);
  gb.addColorStop(1, dk);
  g.fillStyle = gb;
  rr(g, X(-1.25), Y(c0), 2.5 * S, (c1 - c0) * S, 0.14 * S);
  g.fill();
  g.strokeStyle = shade(col, 0.5);
  g.lineWidth = 2;
  g.stroke();
  // windscreen: two flat panes
  g.fillStyle = "#1d2a33";
  g.fillRect(X(-1.05), Y(c0 + 0.12), 0.98 * S, 0.42 * S);
  g.fillRect(X(0.07), Y(c0 + 0.12), 0.98 * S, 0.42 * S);
  g.fillStyle = "rgba(170,210,230,.25)";
  g.fillRect(X(-1.0), Y(c0 + 0.15), 0.4 * S, 0.12 * S);
  // roof: hatch, rivets, light bar, antenna base
  g.fillStyle = lt;
  rr(g, X(-1.05), Y(c0 + 0.7), 2.1 * S, 1.55 * S, 0.1 * S);
  g.fill();
  g.fillStyle = dk;
  g.beginPath();
  g.arc(X(0.35), Y(c0 + 1.45), 0.36 * S, 0, 7);
  g.fill();
  g.fillStyle = shade(col, 0.45);
  g.beginPath();
  g.arc(X(0.35), Y(c0 + 1.45), 0.24 * S, 0, 7);
  g.fill();
  g.fillStyle = "rgba(0,0,0,.4)";
  for (const [rx, ry] of [
    [-0.95, 0.8],
    [0.95, 0.8],
    [-0.95, 2.1],
    [0.95, 2.1],
  ]) {
    g.beginPath();
    g.arc(X(rx), Y(c0 + ry), 0.05 * S, 0, 7);
    g.fill();
  }
  g.fillStyle = "#e8a23a";
  g.fillRect(X(-0.55), Y(c0 + 0.62), 0.3 * S, 0.12 * S);
  g.fillRect(X(0.25), Y(c0 + 0.62), 0.3 * S, 0.12 * S);
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(X(-0.7), Y(c0 + 1.9), 0.08 * S, 0, 7);
  g.fill();
  // spare wheel on the back of the cab + mirrors
  g.fillStyle = "#151614";
  g.beginPath();
  g.arc(X(-0.45), Y(c1 + 0.25), 0.42 * S, 0, 7);
  g.fill();
  g.fillStyle = "#3c4035";
  g.beginPath();
  g.arc(X(-0.45), Y(c1 + 0.25), 0.16 * S, 0, 7);
  g.fill();
  g.fillStyle = "#1b1c19";
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 1.25 : -1.5), Y(c0 + 0.35), 0.25 * S, 0.35 * S);
  // white star roundel (stencil)
  g.fillStyle = "rgba(235,235,220,.55)";
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5,
      r = (k % 2 ? 0.09 : 0.22) * S;
    g.lineTo(X(-0.45) + Math.cos(a) * r, Y(c0 + 1.45) + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  return { c, W, H, ox: W / 2, oy: Y(0) };
}
{
  const ma = modelArt;
  modelArt = function (m, col) {
    if (m.id !== MIL_RIG.id) return ma.apply(this, arguments);
    const key = "mil|" + col;
    return modelArtCache[key] || (modelArtCache[key] = milRigArt(col));
  };
  // sturdy: crash damage multiplier on top of fitted parts (live truck + customiser stats)
  const ap = czApply;
  czApply = function () {
    ap.apply(this, arguments);
    const m = modelById(career.cur);
    if (m.dur) truck.dmgM = (truck.dmgM || 1) * m.dur;
  };
  const cs = czStats;
  czStats = function (m) {
    const r = cs.apply(this, arguments);
    if (m && m.dur)
      for (const row of r)
        if (row[0] === "Crash damage") {
          const d = czFx(arguments[1]).dur * m.dur;
          row[1] = czPct(d) + " (armoured)";
          row[2] = (1 - d) / 0.6;
        }
    return r;
  };
}

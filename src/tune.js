/**
 * @file tune.js — TRUCK CUSTOMISER core (cz): CZ_PARTS catalogue, tune shop bays at repair garages + owned yards, fitting/effects
 * Exposes (globals): CZ_TABS, CZ_SLOTS, CZ_PARTS, czPart, CZ, czSetup, czFitted, czLook, czFx,
 *   czStats, czApply, czArtCache, czArt, czFinish (+24 more)
 * Depends on: world.js, render.js, lorry.js, physics.js, traffic.js, depots.js, career.js, ui.js,
 *   gamepad.js, owndepot.js, tune2.js, tune3.js, daynight.js, main.js
 * Load order: #31 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== cz: TRUCK CUSTOMISER (tune shop bays at every repair garage + owned yard garages) =====================
// Parts are per truck model, bought once, fitted per slot. All prices / level gates / effects live in CZ_PARTS below (easy to edit).
// fx keys (multipliers unless noted): pw power, vm top speed (+m/s), acc low-speed pull, br brakes, ebr engine brake, grip, hand handling,
//   jk anti-jackknife (0..1 extra damping), econ fuel use, tank (+litres), dur damage taken, shift gear-change time, beam headlight reach
const CZ_TABS = [
  { id: "engine", n: "Engine", ic: "\u2699\uFE0F", slots: ["eng"] },
  { id: "brakes", n: "Brakes", ic: "\u{1F6D1}", slots: ["brk", "ebrk"] },
  { id: "tyres", n: "Tyres & wheels", ic: "\u{1F6DE}", slots: ["tyre", "rim"] },
  { id: "paint", n: "Paint", ic: "\u{1F3A8}", slots: ["col", "fin", "strp"] },
];
const CZ_SLOTS = {
  eng: "Engine tune",
  brk: "Brakes",
  ebrk: "Engine brake",
  tyre: "Tyres",
  rim: "Wheel rims",
  col: "Colour",
  fin: "Finish",
  strp: "Stripes",
};
const CZ_PARTS = [
  // engine: hp stages, turbo, ECU remap
  {
    id: "eng1",
    slot: "eng",
    n: "Stage 1 tune",
    lv: 1,
    p: 800,
    req: 1,
    fx: { pw: 1.08 },
    d: "Freer intake + injector tweak",
  },
  {
    id: "eng2",
    slot: "eng",
    n: "Turbo upgrade",
    lv: 2,
    p: 2500,
    req: 3,
    fx: { pw: 1.16, acc: 1.05 },
    d: "Bigger hybrid turbo, more low-end shove",
  },
  {
    id: "eng3",
    slot: "eng",
    n: "ECU remap",
    lv: 3,
    p: 4500,
    req: 5,
    fx: { pw: 1.25, vm: 1.4, econ: 0.97 },
    d: "Remapped fuelling, limiter raised to 59 mph",
  },
  {
    id: "eng4",
    slot: "eng",
    n: "Stage 4 twin-turbo",
    lv: 4,
    p: 8500,
    req: 8,
    fx: { pw: 1.35, vm: 2.2, acc: 1.08, econ: 1.04 },
    d: "Sequential twin turbos + intercooler",
  },
  {
    id: "eng5",
    slot: "eng",
    n: "Stage 5 race block",
    lv: 5,
    p: 15000,
    req: 12,
    fx: { pw: 1.48, vm: 3.0, acc: 1.12, econ: 1.1, dur: 1.05 },
    d: "Forged internals, 63 mph, thirsty",
  },
  // brakes + engine brake
  {
    id: "brk1",
    slot: "brk",
    n: "Sport pads",
    lv: 1,
    p: 600,
    req: 1,
    fx: { br: 1.1 },
    d: "Higher-friction pads",
    cl: "#c0392b",
  },
  {
    id: "brk2",
    slot: "brk",
    n: "Drilled discs",
    lv: 2,
    p: 1800,
    req: 2,
    fx: { br: 1.22 },
    d: "Cross-drilled vented discs",
    cl: "#e67e22",
  },
  {
    id: "brk3",
    slot: "brk",
    n: "Big-bore calipers",
    lv: 3,
    p: 4000,
    req: 5,
    fx: { br: 1.36 },
    d: "Six-pot calipers, fade-free",
    cl: "#f1c40f",
  },
  {
    id: "brk4",
    slot: "brk",
    n: "Carbon-ceramic",
    lv: 4,
    p: 9000,
    req: 9,
    fx: { br: 1.52 },
    d: "Race discs: huge, consistent bite",
    cl: "#2ecc71",
  },
  {
    id: "ebrk1",
    slot: "ebrk",
    n: "Exhaust brake",
    lv: 1,
    p: 900,
    req: 1,
    fx: { ebr: 1.4 },
    d: "Butterfly valve holds speed downhill",
  },
  {
    id: "ebrk2",
    slot: "ebrk",
    n: "Jake brake",
    lv: 2,
    p: 2600,
    req: 4,
    fx: { ebr: 1.9 },
    d: "Compression release: strong lift-off braking",
  },
  {
    id: "ebrk3",
    slot: "ebrk",
    n: "Hydraulic retarder",
    lv: 3,
    p: 6000,
    req: 7,
    fx: { ebr: 2.5, dur: 0.97 },
    d: "Driveline retarder, saves the pads",
  },
  // tyres (grip / eco) + rims (cosmetic)
  {
    id: "tyre1",
    slot: "tyre",
    n: "Road grip",
    lv: 1,
    p: 700,
    req: 1,
    fx: { grip: 1.08, hand: 1.05 },
    d: "Fresh premium rubber",
  },
  {
    id: "tyre2",
    slot: "tyre",
    n: "Eco low-roll",
    lv: 2,
    p: 1500,
    req: 2,
    fx: { grip: 0.98, econ: 0.92 },
    d: "Low rolling resistance, saves fuel",
  },
  {
    id: "tyre3",
    slot: "tyre",
    n: "Sport compound",
    lv: 3,
    p: 2200,
    req: 3,
    fx: { grip: 1.16, hand: 1.1, econ: 1.02 },
    d: "Soft compound, sharp turn-in",
  },
  {
    id: "tyre4",
    slot: "tyre",
    n: "All-weather pro",
    lv: 4,
    p: 5000,
    req: 6,
    fx: { grip: 1.26, hand: 1.12 },
    d: "Siped tread: grips in the wet",
  },
  {
    id: "rim1",
    slot: "rim",
    n: "Alloy 10-spoke",
    p: 500,
    req: 1,
    look: { rim: "spoke", rc: "#c9ced4" },
  },
  {
    id: "rim2",
    slot: "rim",
    n: "Black split-rim",
    p: 900,
    req: 1,
    look: { rim: "split", rc: "#2b2f34" },
  },
  {
    id: "rim3",
    slot: "rim",
    n: "Chrome star",
    p: 1200,
    req: 2,
    look: { rim: "star", rc: "#f4f8fb" },
  },
  {
    id: "rim4",
    slot: "rim",
    n: "Polished dish",
    p: 1800,
    req: 3,
    look: { rim: "dish", rc: "#e8eef3" },
  },
  {
    id: "rim5",
    slot: "rim",
    n: "Gold dish",
    p: 2500,
    req: 4,
    look: { rim: "dish", rc: "#e2b33c" },
  },
  // paint
  ...[
    ["Signal red", "#d63b2f"],
    ["Ocean blue", "#2471a3"],
    ["Arctic white", "#f2f3f4"],
    ["Racing green", "#1e8449"],
    ["Taxi yellow", "#f1c40f"],
    ["Midnight black", "#15171a"],
    ["Sunset orange", "#e8701a"],
    ["Royal purple", "#6c3483"],
    ["Deep teal", "#138d75"],
    ["Gunmetal", "#566573"],
    ["Bronze", "#9c6b30"],
    ["Hot pink", "#e84393"],
  ].map(([n, c], i) => ({ id: "col" + i, slot: "col", n, p: 500, req: 1, look: { col: c } })),
  { id: "fin1", slot: "fin", n: "Metallic", p: 1500, req: 1, look: { fin: "metal" } },
  { id: "fin2", slot: "fin", n: "Matte", p: 1200, req: 2, look: { fin: "matte" } },
  { id: "fin3", slot: "fin", n: "Pearl", p: 3000, req: 5, look: { fin: "pearl" } },
  { id: "fin4", slot: "fin", n: "Chrome wrap", p: 7500, req: 10, look: { fin: "chrome" } },
  { id: "strp1", slot: "strp", n: "Twin roof stripes", p: 600, req: 1, look: { strp: "twin" } },
  { id: "strp2", slot: "strp", n: "Chevrons", p: 900, req: 1, look: { strp: "chev" } },
  { id: "strp3", slot: "strp", n: "Checker band", p: 1100, req: 2, look: { strp: "check" } },
  { id: "strp4", slot: "strp", n: "Side flames", p: 1400, req: 3, look: { strp: "flame" } },
];
const czPart = (id) => CZ_PARTS.find((p) => p.id === id);
const CZ = {
  tab: "engine",
  sel: null,
  ang: -0.6,
  view: "top",
  spin: 0.25,
  drag: null,
  bay: null,
  raf: 0,
  lights: 0,
};
// ---- per-truck setup
function czSetup(mid) {
  career.tune = career.tune || {};
  return career.tune[mid] || (career.tune[mid] = { own: {}, fit: {} });
}
function czFitted(mid, ov) {
  const s = czSetup(mid),
    f = Object.assign({}, s.fit);
  if (ov) f[ov.slot] = ov.id;
  return f;
}
// Mod mount points per truck model (metres, same frame as the art: x across (+ right), y along (front -), side h up).
// Every customiser overlay positions itself from these so add-ons sit on each body (tests/mod_fit_test.py checks it).
function czMount(m) {
  const st = (m && m.style) || {},
    rig = m && m.id === "rigger" && typeof RIG !== "undefined";
  const half = CAB.w / 2,
    cabRear = rig ? RIG.cab.topRear : st.roof === "high" ? -2.25 : -2.55, // top view cab back edge
    sideRear = rig ? RIG.cab.x1 : -2.4, // side view cab back
    roof = rig ? RIG.cab.roof : st.roof === "high" ? 3.9 : st.roof === "aero" ? 3.6 : 3.2;
  return {
    half, // body half width: nothing but mirrors / glow may pass it
    cab0: -5.0,
    front: -5.0 - (st.nose || 0),
    cabRear,
    sideRear,
    roof,
    roofTop: rig ? RIG.spoiler.top : roof, // highest fixed body point
    stackZ: rig ? RIG.exhaust.z : 0.98, // vertical stacks: centre across
    stackY: cabRear + 0.32, // ... and along (just behind the cab)
    stackX: sideRear + 0.05, // side view x of the stack
    tankZ: half - 0.2, // fuel tank centre across
    rail: [sideRear, -0.62], // between cab back and drive wheels: skirts / tanks / side pipes
  };
}
function czLook(mid, fit) {
  const L = {};
  for (const k in fit) {
    const p = czPart(fit[k]);
    if (p && p.look) Object.assign(L, p.look);
  }
  return L;
}
function czFx(fit) {
  const F = {
    pw: 1,
    vm: 0,
    acc: 1,
    br: 1,
    ebr: 1,
    grip: 1,
    hand: 1,
    jk: 0,
    econ: 1,
    tank: 0,
    dur: 1,
    bp: 1,
    shift: 1,
    beam: 1,
    snd: 0,
  };
  for (const k in fit) {
    const p = czPart(fit[k]);
    if (!p || !p.fx) continue;
    for (const q in p.fx) {
      if (q === "vm" || q === "tank" || q === "jk" || q === "snd") F[q] += p.fx[q];
      else F[q] *= p.fx[q];
    }
  }
  return F;
}
// ---- stats (display 0..1 bars + text)
function czStats(m, fit) {
  const F = czFx(fit),
    hp = Math.round(m.hp * F.pw),
    v = (m.vmax + F.vm) * 2.23694,
    acc = m.power * F.pw * F.acc * (1 + (1 - F.shift) * 0.15),
    L = 36 * m.econ * F.econ;
  return [
    ["Power", hp + " hp", hp / 1100],
    ["Torque", Math.round(2400 * ENG_BASE * m.power * F.pw) + " Nm", (m.power * F.pw) / 2.6],
    ["Top speed", Math.round(v) + " mph", (v - 44) / 28],
    ["Acceleration", (acc * 10).toFixed(1), acc / 2.6],
    ["Braking", Math.round(F.br * 100) + "%", (F.br - 0.6) / 1.1],
    ["Handling", Math.round(F.grip * F.hand * 100) + "%", (F.grip * F.hand + F.jk - 0.6) / 1.1],
    ["Economy", L.toFixed(0) + " L/100", (60 - L) / 40],
    ["Crash damage", czPct(F.dur), (1 - F.dur) / 0.6],
    ["Bullet damage", czPct(F.bp), (1 - F.bp) / 0.6],
  ];
}
// ---- apply to the live truck (called by applyModel)
function czApply() {
  const m = modelById(career.cur),
    F = czFx(czFitted(m.id));
  truck.power = m.power * F.pw;
  truck.vmax = m.vmax + F.vm;
  truck.accM = F.acc;
  truck.brk = F.br;
  truck.ebr = F.ebr;
  truck.grip = F.grip;
  truck.hand = F.hand;
  truck.jkM = F.jk;
  truck.econ = m.econ * F.econ;
  truck.tank = m.tank + F.tank;
  truck.dmgM = F.dur;
  truck.bulM = F.bp; // v49: gunfire damage multiplier (bulletproof panels), used by bmShoot
  truck.shiftM = F.shift;
  truck.beamM = F.beam;
  if (truck.fuel > truck.tank) truck.fuel = truck.tank;
  CABART = czArt(m, career.colors[m.id] || m.cols[0], czFitted(m.id));
  CABSH = silhouette(CABART);
}
// ---- art: model art + fitted parts, drawn top-down in cab-local metres
const czArtCache = {};
function czArt(m, col, fit) {
  const L = czLook(m.id, fit);
  col = L.col || col;
  const key = m.id + "|" + col + "|" + JSON.stringify(fit);
  if (czArtCache[key]) return czArtCache[key];
  const base = modelArt(m, col, rigHide(fit, L)),
    S = PPM * ART_SCALE,
    pf = Math.round(1.2 * S),
    ps = Math.round(0.5 * S),
    W = base.W + 2 * ps,
    H = base.H + pf + Math.round(0.4 * S),
    c = mkCanvas(W, H),
    g = c.getContext("2d");
  const ox = base.ox + ps,
    oy = base.oy + pf,
    X = (v) => ox + v * S,
    Y = (v) => oy + v * S,
    nose = (m.style && m.style.nose) || 0,
    front = CAB.front - nose;
  g.drawImage(base.c, ps, pf);
  czFinish(g, L.fin, X, Y, S, front);
  czStripes(g, L.strp, X, Y, S, front, m);
  czDrawParts(g, L, fit, X, Y, S, front, m);
  if (Object.keys(czArtCache).length > 60) for (const k in czArtCache) delete czArtCache[k];
  return (czArtCache[key] = { c, W, H, ox, oy });
}
function czFinish(g, fin, X, Y, S, front) {
  if (!fin) return;
  g.save();
  g.globalCompositeOperation = "source-atop";
  const x0 = X(-1.3),
    y0 = Y(front - 0.1),
    w = 2.6 * S,
    h = (-2.2 - front + 0.1) * S;
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  if (fin === "metal") {
    const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
    gr.addColorStop(0, "rgba(255,255,255,0.28)");
    gr.addColorStop(0.45, "rgba(255,255,255,0)");
    gr.addColorStop(0.55, "rgba(255,255,255,0.22)");
    gr.addColorStop(1, "rgba(0,0,0,0.15)");
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = "rgba(255,255,255," + (0.2 + rlh(i) * 0.4) + ")";
      g.fillRect(x0 + rlh(i * 3 + 1) * w, y0 + rlh(i * 7 + 2) * h, 1.5, 1.5);
    }
  } else if (fin === "matte") {
    g.fillStyle = "rgba(70,70,70,0.28)";
    g.globalCompositeOperation = "saturation";
    g.fillRect(x0, y0, w, h);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(x0, y0, w, h);
  } else if (fin === "pearl") {
    const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
    gr.addColorStop(0, "rgba(255,120,220,0.22)");
    gr.addColorStop(0.5, "rgba(120,255,240,0.22)");
    gr.addColorStop(1, "rgba(255,240,140,0.22)");
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
  } else if (fin === "chrome") {
    const gr = g.createLinearGradient(x0, 0, x0 + w, 0);
    for (const [o, c] of [
      [0, "#6f7780"],
      [0.2, "#f6f9fb"],
      [0.35, "#9aa2ab"],
      [0.55, "#ffffff"],
      [0.75, "#7d858e"],
      [1, "#d9dee3"],
    ])
      gr.addColorStop(o, c);
    g.globalAlpha = 0.78;
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
  }
  g.restore();
}
function rlh(n) {
  n = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function czStripes(g, st, X, Y, S, front, m) {
  if (!st) return;
  const c0 = -5.0,
    c1 = m.style && m.style.roof === "high" ? -2.3 : -2.6;
  g.save();
  if (st === "twin") {
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(X(-0.42), Y(front), 0.22 * S, (c1 - front) * S);
    g.fillRect(X(0.2), Y(front), 0.22 * S, (c1 - front) * S);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(X(-0.2), Y(front), 0.04 * S, (c1 - front) * S);
    g.fillRect(X(0.42), Y(front), 0.04 * S, (c1 - front) * S);
  } else if (st === "chev") {
    g.strokeStyle = "#f5b82e";
    g.lineWidth = 0.18 * S;
    for (let k = 0; k < 3; k++) {
      const y = c0 + 0.5 + k * 0.55;
      g.beginPath();
      g.moveTo(X(-1.15), Y(y + 0.45));
      g.lineTo(X(0), Y(y));
      g.lineTo(X(1.15), Y(y + 0.45));
      g.stroke();
    }
  } else if (st === "check") {
    const y = c1 - 0.55;
    for (let i = 0; i < 10; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? "#111" : "#fff";
        g.fillRect(X(-1.25 + i * 0.25), Y(y + j * 0.2), 0.25 * S, 0.2 * S);
      }
  } else if (st === "flame") {
    for (const s of [-1, 1]) {
      const gr = g.createLinearGradient(0, Y(c0), 0, Y(c1));
      gr.addColorStop(0, "#ffe066");
      gr.addColorStop(0.5, "#ff7b00");
      gr.addColorStop(1, "rgba(200,30,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(X(s * 1.25), Y(c0 + 0.2));
      for (let k = 0; k <= 6; k++) {
        const y = c0 + 0.2 + (k * (c1 - c0 - 0.2)) / 6;
        g.lineTo(X(s * (1.25 - (k % 2 ? 0.55 : 0.25) * (1 - k / 7))), Y(y));
      }
      g.lineTo(X(s * 1.25), Y(c1));
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}
function czDrawParts(g, L, fit, X, Y, S, front, m) {
  // rims on the rear (drive) wheels, visible outboard of the chassis
  if (L.rim) {
    for (const s of [-1, 1]) {
      const cx = X(s * 1.0),
        cy = Y(0);
      g.fillStyle = L.rc;
      if (L.rim === "dish") {
        const gr = g.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 0.26 * S);
        gr.addColorStop(0, "#fff");
        gr.addColorStop(1, L.rc);
        g.fillStyle = gr;
      }
      g.beginPath();
      g.ellipse(cx, cy, 0.2 * S, 0.42 * S, 0, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.55)";
      g.lineWidth = 2;
      if (L.rim === "spoke" || L.rim === "star") {
        const n = L.rim === "star" ? 5 : 10;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a) * 0.18 * S, cy + Math.sin(a) * 0.38 * S);
          g.stroke();
        }
      } else if (L.rim === "split") {
        g.beginPath();
        g.moveTo(cx, cy - 0.4 * S);
        g.lineTo(cx, cy + 0.4 * S);
        g.stroke();
      }
      g.fillStyle = "#111";
      g.beginPath();
      g.arc(cx, cy, 0.06 * S, 0, 7);
      g.fill();
    }
  }
  // brake calipers peeking behind the drive wheels
  const bk = czPart(fit.brk);
  if (bk) {
    g.fillStyle = bk.cl;
    for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 0.72 : -0.84), Y(-0.28), 0.12 * S, 0.56 * S);
  }
  // tyre sidewall lettering for grip tyres
  const ty = czPart(fit.tyre);
  if (ty) {
    g.fillStyle = ty.id === "tyre2" ? "#7dff9a" : "#f5f5f5";
    for (const s of [-1, 1])
      for (let k = 0; k < ty.lv + 1; k++)
        g.fillRect(X(s * 1.22) - 1, Y(-0.45 + k * 0.22), 2, 0.12 * S);
  }
  // engine: bonnet / roof vents (one per stage), turbo intake, ECU badge
  const en = czPart(fit.eng);
  if (en) {
    g.fillStyle = "rgba(0,0,0,0.55)";
    for (let k = 0; k < Math.min(5, en.lv); k++)
      g.fillRect(X(-0.55), Y(-4.55 + k * 0.16), 1.1 * S, 0.07 * S);
    if (en.lv >= 2) {
      for (const s of en.lv >= 4 ? [-1, 1] : [1]) {
        g.fillStyle = "#9aa2ab";
        rr(g, X(s * 1.12) - 0.12 * S, Y(-3.2), 0.24 * S, 0.7 * S, 0.1 * S);
        g.fill();
        g.fillStyle = "#222";
        g.beginPath();
        g.arc(X(s * 1.12), Y(-3.1), 0.07 * S, 0, 7);
        g.fill();
      }
    }
    if (en.lv >= 3) {
      g.fillStyle = "#e74c3c";
      rr(g, X(0.55), Y(-2.95), 0.5 * S, 0.24 * S, 0.06 * S);
      g.fill();
      g.fillStyle = "#fff";
      g.font = "bold " + Math.round(0.18 * S) + "px Arial";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(en.lv >= 5 ? "R5" : "ECU", X(0.8), Y(-2.83));
    }
  }
}
// ---- side view for the turntable (procedural profile in the game's palette)
function czSide(g, cx, cy, sc, m, col, fit) {
  if (m.id === "rigger") return rigSide(g, cx, cy, sc, m, col, fit);
  const L = czLook(m.id, fit);
  col = L.col || col;
  const st = m.style || {},
    nose = st.nose || 0,
    body = shade(col, 1),
    dark = shade(col, 0.7),
    lite = shade(col, 1.25);
  const X = (v) => cx + v * sc,
    Y = (v) => cy - v * sc; // side: x along length (front = -), y up
  const roofH = st.roof === "high" ? 3.9 : st.roof === "aero" ? 3.6 : 3.2,
    cf = -5.0 - nose,
    cb = -2.4;
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath();
  g.ellipse(X(-1.8), Y(-0.05), 4.6 * sc, 0.25 * sc, 0, 0, 7);
  g.fill();
  g.fillStyle = "#2a2d31";
  g.fillRect(X(cf + 0.2), Y(1.15), (1.3 - cf) * sc, 0.35 * sc); // chassis
  if (nose) {
    const gr = g.createLinearGradient(0, Y(2.45), 0, Y(1.0));
    gr.addColorStop(0, lite);
    gr.addColorStop(0.5, body);
    gr.addColorStop(1, dark);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(X(-5.0), Y(1.0));
    g.lineTo(X(-5.0), Y(2.45));
    g.quadraticCurveTo(X(cf + nose * 0.4), Y(2.4), X(cf + 0.25), Y(2.15));
    g.quadraticCurveTo(X(cf), Y(2.05), X(cf), Y(1.7));
    g.lineTo(X(cf), Y(1.0));
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(X(-5.0), Y(2.35));
    g.quadraticCurveTo(X(cf + nose * 0.4), Y(2.3), X(cf + 0.3), Y(2.08));
    g.stroke();
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let k = 0; k < 4; k++) g.fillRect(X(cf + 0.5 + k * 0.22), Y(1.95), 0.1 * sc, 0.5 * sc);
    const cg = g.createLinearGradient(X(cf - 0.1), 0, X(cf + 0.2), 0);
    cg.addColorStop(0, "#8e969f");
    cg.addColorStop(0.5, "#ffffff");
    cg.addColorStop(1, "#9aa2ab");
    g.fillStyle = cg;
    g.fillRect(X(cf - 0.08), Y(2.0), 0.22 * sc, 1.0 * sc);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(X(cf + 0.25), Y(2.15));
    g.lineTo(X(cf + 0.35), Y(2.45));
    g.lineTo(X(cf + 0.45), Y(2.15));
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.4)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(X(-3.8), Y(0.5), 0.7 * sc, Math.PI, 0);
    g.stroke();
  }
  const gr = g.createLinearGradient(0, Y(roofH), 0, Y(1.0));
  gr.addColorStop(0, lite);
  gr.addColorStop(0.6, body);
  gr.addColorStop(1, dark);
  g.fillStyle = gr;
  const rc = st.roof === "high" ? 0.9 : st.roof === "aero" ? 0.6 : 0.2;
  g.beginPath();
  g.moveTo(X(-5.0), Y(1.0));
  g.lineTo(X(-5.0), Y(roofH - rc));
  g.quadraticCurveTo(X(-5.0), Y(roofH), X(-5.0 + rc * 1.1 + 0.1), Y(roofH));
  g.lineTo(X(cb - 0.2), Y(roofH));
  g.quadraticCurveTo(X(cb), Y(roofH), X(cb), Y(roofH - 0.2));
  g.lineTo(X(cb), Y(1.0));
  g.closePath();
  g.fill();
  if (st.roof === "high") {
    g.fillStyle = "rgba(20,40,60,0.7)";
    rr(g, X(-3.25), Y(3.35), 0.55 * sc, 0.32 * sc, 0.08 * sc);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.3)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(X(-4.2), Y(roofH - 0.05));
    g.lineTo(X(cb), Y(roofH - 0.05));
    g.moveTo(X(-3.6), Y(3.0));
    g.lineTo(X(cb), Y(3.0));
    g.stroke();
  }
  g.fillStyle = "#2a2d31";
  for (let k = 0; k < 2; k++) g.fillRect(X(-3.75), Y(1.35 - k * 0.3), 0.5 * sc, 0.07 * sc);
  g.fillStyle = "#cfd3d8";
  g.fillRect(X(-5.05), Y(2.7), 0.08 * sc, 0.9 * sc);
  g.fillRect(X(-5.25), Y(3.0), 0.22 * sc, 0.45 * sc);
  if (L.fin === "chrome" || L.fin === "metal" || L.fin === "pearl") {
    g.save();
    g.clip();
    const sg = g.createLinearGradient(X(-5), 0, X(cb), 0);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, L.fin === "pearl" ? "rgba(140,255,240,0.3)" : "rgba(255,255,255,0.45)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sg;
    g.fillRect(X(-5), Y(roofH), 3 * sc, roofH * sc);
    g.restore();
  }
  g.fillStyle = "#1b2a38";
  g.beginPath();
  g.moveTo(X(-4.95), Y(2.3));
  g.lineTo(X(-4.95), Y(roofH - 0.45));
  g.lineTo(X(-3.7), Y(roofH - 0.45));
  g.lineTo(X(-3.7), Y(2.3));
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(160,220,255,0.35)";
  g.fillRect(X(-4.8), Y(roofH - 0.55), 0.35 * sc, (roofH - 2.9) * sc);
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 1.5;
  g.strokeRect(X(-3.6), Y(2.95), 0.9 * sc, 1.8 * sc);
  g.fillStyle = "#d9dde2";
  g.fillRect(X(-3.0), Y(2.0), 0.25 * sc, 0.06 * sc);
  if (L.strp === "flame") {
    const fg = g.createLinearGradient(X(-5), 0, X(cb), 0);
    fg.addColorStop(0, "#ffe066");
    fg.addColorStop(0.5, "#ff7b00");
    fg.addColorStop(1, "rgba(200,30,0,0)");
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(X(-5), Y(1.3));
    for (let k = 0; k <= 8; k++)
      g.lineTo(X(-5 + k * 0.33), Y(1.3 + (k % 2 ? 0.9 : 0.4) * (1 - k / 9)));
    g.lineTo(X(cb), Y(1.3));
    g.fill();
  } else if (L.strp === "twin" || L.strp === "chev") {
    g.fillStyle = L.strp === "twin" ? "#fff" : "#f5b82e";
    g.fillRect(X(-5), Y(1.7), (cb + 5) * sc, 0.14 * sc);
    g.fillRect(X(-5), Y(1.95), (cb + 5) * sc, 0.08 * sc);
  } else if (L.strp === "check") {
    for (let i = 0; i < 14; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? "#111" : "#fff";
        g.fillRect(X(-5 + i * 0.185), Y(1.6 + j * 0.18), 0.185 * sc, 0.18 * sc);
      }
  }
  if (st.stacks && !rigHide(fit, L).exh) {
    g.fillStyle = "#c9ced4";
    g.fillRect(X(cb + 0.05), Y(roofH + 0.6), 0.22 * sc, (roofH - 0.4) * sc);
  }
  // wheels (front axle at -3.8, drive at 0)
  const bk = czPart(fit.brk),
    ty = czPart(fit.tyre);
  for (const ax of [-3.8, 0]) {
    const wx = X(ax),
      wy = Y(0.5),
      r = 0.5 * sc;
    g.fillStyle = "#141414";
    g.beginPath();
    g.arc(wx, wy, r, 0, 7);
    g.fill();
    if (ty) {
      g.strokeStyle = ty.id === "tyre2" ? "#7dff9a" : "#eee";
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(wx, wy, r * 0.82, -2.6, -0.6);
      g.stroke();
    }
    g.fillStyle = L.rc || "#9aa1a8";
    g.beginPath();
    g.arc(wx, wy, r * 0.58, 0, 7);
    g.fill();
    if (bk) {
      g.fillStyle = bk.cl;
      g.fillRect(wx + r * 0.15, wy - r * 0.45, r * 0.25, r * 0.5);
    }
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 1.2;
    const n = L.rim === "star" ? 5 : L.rim === "spoke" ? 10 : L.rim === "split" ? 2 : 8;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx + Math.cos(a) * r * 0.55, wy + Math.sin(a) * r * 0.55);
      g.stroke();
    }
    g.fillStyle = "#222";
    g.beginPath();
    g.arc(wx, wy, r * 0.14, 0, 7);
    g.fill();
  }
  const en = czPart(fit.eng);
  if (en && en.lv >= 2) {
    g.fillStyle = "#9aa2ab";
    g.fillRect(X(-2.75), Y(roofH - 0.1), 0.2 * sc, (roofH - 1.4) * sc);
  }
  g.fillStyle = "#fff5c8";
  g.fillRect(X(cf - 0.05), Y(1.7), 0.12 * sc, 0.3 * sc); // headlamp
}
// ---- card illustrations (one per part, drawn on a 2:1 canvas)
function czIcon(g, p, W, H) {
  g.clearRect(0, 0, W, H);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2a3446");
  bg.addColorStop(1, "#141a26");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const cx = W / 2,
    cy = H / 2,
    s = Math.min(W, H) / 100,
    lv = p.lv || 1;
  const glow = (c) => {
    const r = g.createRadialGradient(cx, cy, 2, cx, cy, W * 0.45);
    r.addColorStop(0, c);
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, W, H);
  };
  if (!p.id.endsWith("_0") && p.slot !== "col")
    glow(
      [
        "",
        "rgba(80,160,255,.25)",
        "rgba(80,255,180,.25)",
        "rgba(255,200,80,.28)",
        "rgba(255,120,80,.3)",
        "rgba(255,60,160,.32)",
      ][Math.min(5, lv)],
    );
  const sl = p.slot;
  if (p.id.endsWith("_0")) {
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.lineWidth = 3 * s;
    g.setLineDash([6 * s, 5 * s]);
    g.strokeRect(cx - 30 * s, cy - 24 * s, 60 * s, 48 * s);
    g.setLineDash([]);
    g.fillStyle = "rgba(255,255,255,.6)";
    g.font = "bold " + Math.round(13 * s) + "px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("STOCK", cx, cy);
    return;
  }
  if (sl === "eng") {
    g.fillStyle = "#5d6670";
    rr(g, cx - 34 * s, cy - 16 * s, 52 * s, 34 * s, 5 * s);
    g.fill();
    g.fillStyle = "#7c8590";
    for (let k = 0; k < 4; k++) {
      rr(g, cx - 30 * s + k * 12 * s, cy - 26 * s, 9 * s, 12 * s, 2 * s);
      g.fill();
    }
    g.fillStyle = "#3b424a";
    g.fillRect(cx - 34 * s, cy + 12 * s, 52 * s, 6 * s);
    if (lv >= 2) {
      for (const k of lv >= 4 ? [0, 1] : [0]) {
        const tx = cx + 24 * s,
          ty = cy - 6 * s + k * 20 * s;
        g.fillStyle = "#c9a24a";
        g.beginPath();
        g.arc(tx, ty, 9 * s, 0, 7);
        g.fill();
        g.strokeStyle = "#5a4518";
        g.lineWidth = 2 * s;
        g.beginPath();
        for (let a = 0; a < 12; a += 0.4)
          g.lineTo(tx + Math.cos(a) * a * 0.7 * s, ty + Math.sin(a) * a * 0.7 * s);
        g.stroke();
      }
    }
    if (lv >= 3) {
      g.fillStyle = "#1e824c";
      rr(g, cx - 24 * s, cy - 6 * s, 20 * s, 14 * s, 2 * s);
      g.fill();
      g.fillStyle = "#f1c40f";
      for (let k = 0; k < 4; k++) {
        g.fillRect(cx - 26 * s, cy - 4 * s + k * 3.4 * s, 2 * s, 1.6 * s);
        g.fillRect(cx - 4 * s, cy - 4 * s + k * 3.4 * s, 2 * s, 1.6 * s);
      }
    }
    if (lv >= 5) {
      g.strokeStyle = "#ff4d4d";
      g.lineWidth = 3 * s;
      g.beginPath();
      g.moveTo(cx - 40 * s, cy + 26 * s);
      g.lineTo(cx + 40 * s, cy + 26 * s);
      g.stroke();
    }
    for (let k = 0; k < lv; k++) {
      g.fillStyle = "#f5b82e";
      g.beginPath();
      g.moveTo(cx - 38 * s + k * 9 * s, cy + 34 * s);
      g.lineTo(cx - 33 * s + k * 9 * s, cy + 28 * s);
      g.lineTo(cx - 28 * s + k * 9 * s, cy + 34 * s);
      g.fill();
    }
    return;
  }
  if (sl === "brk") {
    const r = 30 * s;
    const dg = g.createRadialGradient(cx - 6 * s, cy - 6 * s, 2, cx, cy, r);
    dg.addColorStop(0, "#e5e8eb");
    dg.addColorStop(1, "#7f878f");
    g.fillStyle = dg;
    g.beginPath();
    g.arc(cx - 6 * s, cy, r, 0, 7);
    g.fill();
    g.fillStyle = "#4b525a";
    g.beginPath();
    g.arc(cx - 6 * s, cy, r * 0.35, 0, 7);
    g.fill();
    if (lv >= 2) {
      g.fillStyle = "#3a4047";
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2,
          rr2 = r * (0.55 + 0.25 * (k % 2));
        g.beginPath();
        g.arc(cx - 6 * s + Math.cos(a) * rr2, cy + Math.sin(a) * rr2, 1.6 * s, 0, 7);
        g.fill();
      }
    }
    if (lv >= 4) {
      g.fillStyle = "rgba(30,30,30,0.6)";
      g.beginPath();
      g.arc(cx - 6 * s, cy, r, 0, 7);
      g.arc(cx - 6 * s, cy, r * 0.4, 0, 7, true);
      g.fill("evenodd");
    }
    g.fillStyle = p.cl;
    rr(g, cx + 12 * s, cy - (14 + lv * 3) * s, 16 * s, (28 + lv * 6) * s, 5 * s);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.fillRect(cx + 15 * s, cy - (10 + lv * 3) * s, 3 * s, (20 + lv * 6) * s);
    return;
  }
  if (sl === "ebrk") {
    g.fillStyle = "#6b737c";
    rr(g, cx - 36 * s, cy - 10 * s, 50 * s, 20 * s, 4 * s);
    g.fill();
    g.fillStyle = "#9aa2ab";
    for (let k = 0; k < lv + 1; k++)
      g.fillRect(cx - 32 * s + k * 12 * s, cy - 18 * s, 6 * s, 8 * s);
    g.strokeStyle = "#f5b82e";
    g.lineWidth = 3 * s;
    for (let k = 0; k < lv; k++) {
      g.beginPath();
      g.arc(cx + 24 * s, cy, (8 + k * 7) * s, -0.9, 0.9);
      g.stroke();
    }
    return;
  }
  if (sl === "tyre") {
    const r = 32 * s;
    g.fillStyle = "#141414";
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.fill();
    g.fillStyle = "#8e959c";
    g.beginPath();
    g.arc(cx, cy, r * 0.52, 0, 7);
    g.fill();
    g.fillStyle = "#2b2f34";
    g.beginPath();
    g.arc(cx, cy, r * 0.18, 0, 7);
    g.fill();
    g.strokeStyle = p.id === "tyre2" ? "#7dff9a" : "#3a3a3a";
    g.lineWidth = (p.id === "tyre3" ? 5 : 3) * s;
    const n = p.id === "tyre4" ? 20 : p.id === "tyre3" ? 10 : 14;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
      g.lineTo(
        cx + Math.cos(a + (p.id === "tyre4" ? 0.2 : 0)) * r * 0.98,
        cy + Math.sin(a + (p.id === "tyre4" ? 0.2 : 0)) * r * 0.98,
      );
      g.stroke();
    }
    if (p.id === "tyre2") {
      g.fillStyle = "#7dff9a";
      g.font = "bold " + Math.round(11 * s) + "px Arial";
      g.textAlign = "center";
      g.fillText("ECO", cx + 38 * s, cy - 26 * s);
    }
    return;
  }
  if (sl === "rim") {
    const L = p.look,
      r = 32 * s;
    g.fillStyle = "#141414";
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.fill();
    const rg = g.createRadialGradient(cx - 8 * s, cy - 8 * s, 2, cx, cy, r * 0.72);
    rg.addColorStop(0, "#ffffff");
    rg.addColorStop(1, L.rc);
    g.fillStyle = L.rim === "split" ? L.rc : rg;
    g.beginPath();
    g.arc(cx, cy, r * 0.7, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = (L.rim === "star" ? 6 : 2.5) * s;
    const n = L.rim === "star" ? 5 : L.rim === "spoke" ? 10 : L.rim === "split" ? 2 : 0;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66);
      g.stroke();
    }
    if (L.rim === "dish") {
      g.fillStyle = "rgba(0,0,0,0.35)";
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, 2.4 * s, 0, 7);
        g.fill();
      }
    }
    g.fillStyle = "#222";
    g.beginPath();
    g.arc(cx, cy, r * 0.14, 0, 7);
    g.fill();
    return;
  }
  if (sl === "col" || sl === "fin" || sl === "strp") {
    const col = sl === "col" ? p.look.col : "#c0392b";
    const gr = g.createLinearGradient(0, cy - 26 * s, 0, cy + 26 * s);
    gr.addColorStop(0, shade(col, 1.3));
    gr.addColorStop(0.5, col);
    gr.addColorStop(1, shade(col, 0.65));
    g.fillStyle = gr;
    rr(g, cx - 38 * s, cy - 26 * s, 76 * s, 52 * s, 12 * s);
    g.fill();
    const f = p.look.fin;
    if (f === "metal") {
      for (let i = 0; i < 120; i++) {
        g.fillStyle = "rgba(255,255,255," + (0.3 + rlh(i) * 0.5) + ")";
        g.fillRect(
          cx - 36 * s + rlh(i * 5) * 72 * s,
          cy - 24 * s + rlh(i * 9) * 48 * s,
          1.5 * s,
          1.5 * s,
        );
      }
    }
    if (f === "matte") {
      g.fillStyle = "rgba(90,90,90,0.45)";
      rr(g, cx - 38 * s, cy - 26 * s, 76 * s, 52 * s, 12 * s);
      g.fill();
    }
    if (f === "pearl") {
      const pg = g.createLinearGradient(cx - 38 * s, 0, cx + 38 * s, 0);
      pg.addColorStop(0, "rgba(255,120,220,.45)");
      pg.addColorStop(0.5, "rgba(120,255,240,.45)");
      pg.addColorStop(1, "rgba(255,240,140,.45)");
      g.fillStyle = pg;
      rr(g, cx - 38 * s, cy - 26 * s, 76 * s, 52 * s, 12 * s);
      g.fill();
    }
    if (f === "chrome") {
      const cg = g.createLinearGradient(cx - 38 * s, 0, cx + 38 * s, 0);
      for (const [o, c] of [
        [0, "#6f7780"],
        [0.25, "#ffffff"],
        [0.45, "#8c949c"],
        [0.65, "#ffffff"],
        [1, "#77808a"],
      ])
        cg.addColorStop(o, c);
      g.fillStyle = cg;
      rr(g, cx - 38 * s, cy - 26 * s, 76 * s, 52 * s, 12 * s);
      g.fill();
    }
    if (sl !== "fin") {
      g.fillStyle = "rgba(255,255,255,0.35)";
      rr(g, cx - 30 * s, cy - 22 * s, 30 * s, 8 * s, 4 * s);
      g.fill();
    }
    const st = p.look.strp;
    g.save();
    rr(g, cx - 38 * s, cy - 26 * s, 76 * s, 52 * s, 12 * s);
    g.clip();
    if (st === "twin") {
      g.fillStyle = "#fff";
      g.fillRect(cx - 12 * s, cy - 26 * s, 8 * s, 52 * s);
      g.fillRect(cx + 4 * s, cy - 26 * s, 8 * s, 52 * s);
    }
    if (st === "chev") {
      g.strokeStyle = "#f5b82e";
      g.lineWidth = 6 * s;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(cx - 34 * s, cy + (10 - k * 14) * s + 14 * s);
        g.lineTo(cx, cy + (10 - k * 14) * s);
        g.lineTo(cx + 34 * s, cy + (10 - k * 14) * s + 14 * s);
        g.stroke();
      }
    }
    if (st === "check") {
      for (let i = 0; i < 10; i++)
        for (let j = 0; j < 3; j++) {
          g.fillStyle = (i + j) % 2 ? "#111" : "#fff";
          g.fillRect(cx - 38 * s + i * 7.6 * s, cy - 6 * s + j * 6 * s, 7.6 * s, 6 * s);
        }
    }
    if (st === "flame") {
      const fg = g.createLinearGradient(cx - 38 * s, 0, cx + 38 * s, 0);
      fg.addColorStop(0, "#ffe066");
      fg.addColorStop(0.6, "#ff7b00");
      fg.addColorStop(1, "rgba(200,30,0,0)");
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(cx - 38 * s, cy + 26 * s);
      for (let k = 0; k <= 8; k++)
        g.lineTo(cx - 38 * s + k * 9.5 * s, cy + 26 * s - (k % 2 ? 34 : 14) * (1 - k / 10) * s);
      g.lineTo(cx + 38 * s, cy + 26 * s);
      g.fill();
    }
    g.restore();
    return;
  }
  if (typeof czIcon2 === "function") czIcon2(g, p, W, H, cx, cy, s, lv);
}
// ---- the customiser UI
const CZ_CSS = `#ui .mback .modal.tz{width:min(1060px,100%)!important;height:min(640px,100%)!important;max-height:100%!important;padding:0!important;display:flex;flex-direction:column;overflow:hidden;background:#0c111a;border-radius:16px;border:1px solid rgba(245,184,46,.22);box-shadow:0 24px 60px rgba(0,0,0,.55)}
.tz .czh{display:flex;align-items:center;gap:6px;padding:6px 8px;flex:none;background:linear-gradient(90deg,rgba(245,184,46,.14),transparent 55%);border-bottom:1px solid rgba(255,255,255,.07)}
.tz .czh .cztl{flex:1 1 0;min-width:0}.tz .czh h2{margin:0;font-size:15px;letter-spacing:.08em;font-weight:900;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tz .czh h2 small,.tz .czh .cztl small{display:block;font-size:11px;letter-spacing:0;opacity:.7;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.tz .czb{width:40px;height:40px;flex:none;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;font-size:20px;cursor:pointer}
.tz .wallet{flex:none;display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:99px;background:rgba(0,0,0,.45);border:1px solid rgba(125,255,154,.35);font-size:12px;font-weight:800;color:#7dff9a;white-space:nowrap;max-width:42%;overflow:hidden;text-overflow:ellipsis}
.tz .wallet b{font-weight:900}
.tz .czm{flex:1;min-height:0;display:flex;flex-direction:column}
.tz .czt{flex:none;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.tz .czp{position:relative;flex:none;height:clamp(168px,28vh,300px);background:
 radial-gradient(ellipse at 50% 78%,rgba(245,184,46,.12) 0%,transparent 55%),
 radial-gradient(ellipse at 50% 70%,#3a4a66 0%,#18202f 55%,#0a0e16 100%);
 touch-action:none;cursor:grab;border-bottom:1px solid rgba(255,255,255,.06)}
.tz .czp canvas{width:100%;height:100%;display:block}
.tz .czp .vt{position:absolute;right:8px;top:8px;font-size:10px;font-weight:800;letter-spacing:.06em;padding:3px 8px;border-radius:99px;background:rgba(0,0,0,.5);border:1px solid rgba(245,184,46,.4);color:#f5d48a;pointer-events:none}
.tz .czp .vh{position:absolute;left:8px;bottom:6px;font-size:10px;opacity:.55;pointer-events:none}
.tz .czs{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;padding:6px 10px 4px;background:#101722}
.tz .czs .r{font-size:10px;min-width:0}.tz .czs .l{display:flex;justify-content:space-between;gap:4px;align-items:baseline}
.tz .czs .l span{opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tz .czs .l b{font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
.tz .czs .b{position:relative;height:5px;border-radius:3px;background:#1c2432;overflow:hidden;margin-top:2px}
.tz .czs .b i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#2f81f7,#7ee0ff)}
.tz .czs .b em{position:absolute;top:0;bottom:0}.tz .czs .up{color:#7dff9a}.tz .czs .dn{color:#ff7b72}
.tz .czk{flex:1;min-height:0;display:flex;flex-direction:column}
.tz .cztabs{position:relative;flex:none;display:flex;gap:5px;overflow-x:auto;padding:7px 28px 7px 10px;scrollbar-width:thin;scrollbar-color:rgba(245,184,46,.55) transparent;touch-action:pan-x;-webkit-overflow-scrolling:touch;
 mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 28px),transparent);-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 28px),transparent)}
.tz .cztabs::-webkit-scrollbar{height:3px}.tz .cztabs::-webkit-scrollbar-thumb{background:rgba(245,184,46,.55);border-radius:3px}
.tz .cztabs::after{content:'\u203A';position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:18px;font-weight:900;color:#f5b82e;opacity:.85;pointer-events:none;text-shadow:0 0 8px rgba(0,0,0,.8)}
.tz .cztabs .chip{flex:none;padding:7px 12px;border-radius:99px;font-weight:800;font-size:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);cursor:pointer;white-space:nowrap}
.tz .cztabs .chip.on{background:#f5b82e;color:#111;border-color:#f5b82e}
.tz .czg{flex:1;min-height:0;overflow-y:auto;padding:2px 8px 8px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.tz .czsl{font-size:10px;font-weight:900;letter-spacing:.12em;opacity:.55;margin:6px 2px 4px}
.tz .czcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
.tz .card{position:relative;border-radius:10px;background:#151c29;border:1.5px solid rgba(255,255,255,.08);overflow:hidden;cursor:pointer;text-align:left;padding:0;color:#fff}
.tz .card canvas{width:100%;aspect-ratio:5/2;display:block;background:#0d121b}
.tz .card .ci{padding:4px 7px 6px}.tz .card .cn{font-weight:800;font-size:12px;line-height:1.15}
.tz .card .cl{font-size:9.5px;opacity:.6}.tz .card .cp{font-weight:900;font-size:12px;color:#7dff9a;margin-top:1px}
.tz .card .cf{font-size:9.5px;color:#9fd8ff;margin-top:0}
.tz .card.sel{border-color:#f5b82e;box-shadow:0 0 0 1px rgba(245,184,46,.4)}
.tz .card.own .cp{color:#cfe8d2}.tz .card.fit{border-color:rgba(46,204,113,.55)}
.tz .card .ok{position:absolute;right:5px;top:5px;width:20px;height:20px;border-radius:50%;background:#2ecc71;color:#06210f;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center}
.tz .card.lock{opacity:.5}.tz .card .lk{color:#ffb38a}
.tz .czf{flex:none;display:flex;gap:8px;align-items:center;padding:6px 8px calc(6px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.07);background:#0c111a}
.tz .czf .btn{flex:1;min-height:42px!important;height:42px;font-size:14px!important;font-weight:900;border-radius:11px!important;padding:0 10px!important;margin:0!important;line-height:1}
.tz .czf .msg{font-size:10px;opacity:.7;line-height:1.2}
#ui:has(.modal.tz) .toast{top:auto;bottom:72px}
@media (max-width:760px) and (orientation:portrait){
 #ui .mback .modal.tz{width:100%!important;height:100%!important;max-height:100%!important;border-radius:0;border:0}
 .modal.tz .czcards{grid-template-columns:1fr;gap:5px}
 .modal.tz .czcards .card{display:flex!important;flex-direction:row!important;align-items:center;min-height:52px!important;height:auto!important;padding:4px 8px!important;gap:8px!important}
 .modal.tz .czcards .card canvas{width:88px!important;height:44px!important;aspect-ratio:auto;flex:none;margin:0;border-radius:7px}
 .modal.tz .czcards .card .ci{padding:0;min-width:0;flex:1}
 .tz .card .cn{font-size:12px}.tz .card .ok{width:18px;height:18px;font-size:11px;right:4px;top:4px}
 .tz .czp{height:clamp(150px,26vh,240px)}
 .tz .czs{grid-template-columns:1fr 1fr;gap:2px 10px;padding:5px 8px 3px}
}
@media (min-width:761px),(orientation:landscape){
 .tz .czh{flex:none;z-index:2}.tz .czf{flex:none;z-index:2;box-shadow:0 -8px 18px rgba(0,0,0,.35)}
 .tz .czm{flex:1;min-height:0;flex-direction:row}
 .tz .czt{width:42%;flex:none;height:auto;align-self:stretch;display:flex;flex-direction:column;min-height:0;border-right:1px solid rgba(255,255,255,.07)}
 .tz .czp{flex:1 1 auto;height:auto;min-height:160px}
 .tz .czs{flex:none}
 .tz .czk{width:58%;flex:none;min-height:0;display:flex;flex-direction:column}
 .tz .cztabs{flex:none}.tz .czg{flex:1;min-height:0;overflow-y:auto}
 .tz .czcards{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
 .tz .czh h2{font-size:16px}.tz .wallet{font-size:13px;padding:6px 12px}
 .tz .czf .btn{min-height:46px!important;height:46px;font-size:15px!important}
 .tz .card:hover{border-color:rgba(245,184,46,.45);background:#1a2333}
}

@media (orientation:landscape) and (max-height:460px){
 .tz .czs{gap:1px 8px;padding:3px 8px}.tz .czs .b{height:4px}
 .tz .czh{padding:3px 6px}.tz .czb{width:36px;height:36px}.tz .czf .btn{min-height:38px;font-size:13px}
 .tz .czh h2{font-size:13px}.tz .wallet{font-size:11px;padding:3px 8px}
 #ui .mback .modal.tz{width:100%!important;height:100%!important;max-height:100%!important;border-radius:0;border:0}
 .tz .czcards{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))!important;gap:5px}
 .modal.tz .czcards .card{display:flex!important;flex-direction:row!important;align-items:center;min-height:48px;padding:3px 6px!important;gap:6px}
 .modal.tz .czcards .card canvas{width:72px!important;height:36px!important;aspect-ratio:auto;flex:none;border-radius:6px}
 .modal.tz .czcards .card .ci{padding:0;min-width:0;flex:1}
 .tz .czp .vh{display:none}
}`;
function czCss() {
  if (document.getElementById("czcss")) return;
  const s = document.createElement("style");
  s.id = "czcss";
  s.textContent = CZ_CSS;
  document.head.appendChild(s);
}
function czOpen() {
  if (!started || career.uiOpen) return;
  czCss();
  const m = modelById(career.cur);
  CZ.sel = null;
  CZ.view = "side";
  CZ.tab = CZ.tab || "engine";
  const b = openModal(
    "tune",
    `<div class="czh"><button class="czb x" id="czBack" aria-label="Back">\u2039</button><div class="cztl"><h2>TUNE SHOP</h2><small>${esc(m.name)}${CZ.bay ? " \u2022 " + esc(CZ.bay.name) : ""}</small></div><div class="wallet" title="Bank"><span aria-hidden="true">\u{1F437}</span> <b id="czBank"></b></div><button class="czb x" id="czClose" aria-label="Close">\u2715</button></div>
   <div class="czm"><div class="czt"><div class="czp"><canvas></canvas><span class="vt"></span><span class="vh">drag / right stick / Z X to rotate \u2022 tap or V: top / 360\u00B0</span></div><div class="czs"></div></div>
   <div class="czk"><div class="cztabs"></div><div class="czg"></div></div></div>
   <div class="czf"><div style="flex:0 1 38%;min-width:0"><div id="czSelN" style="font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div><div class="msg" id="czMsg"></div></div><button class="btn sel" id="czAct"></button></div>`,
    "tz",
  );
  b.querySelector("#czBack").addEventListener("click", () => {
    if (CZ.sel) {
      CZ.sel = null;
      czRender();
    } else closeUI();
  });
  b.querySelector("#czAct").addEventListener("click", czAction);
  // close (X) = same as DONE: fitted parts are already saved, so just leave the shop
  b.querySelector("#czClose").addEventListener("click", czClose);
  const pv = b.querySelector(".czp");
  pv.addEventListener("pointerdown", (e) => {
    CZ.drag = { x: e.clientX, a: CZ.ang, t: performance.now(), mv: 0 };
    pv.setPointerCapture(e.pointerId);
  });
  pv.addEventListener("pointermove", (e) => {
    if (!CZ.drag) return;
    const dx = e.clientX - CZ.drag.x;
    CZ.drag.mv = Math.max(CZ.drag.mv, Math.abs(dx));
    CZ.ang = CZ.drag.a + dx * 0.012;
    CZ.spin = 0;
  });
  pv.addEventListener("pointerup", () => {
    if (CZ.drag && CZ.drag.mv < 6 && performance.now() - CZ.drag.t < 400)
      CZ.view = CZ.view === "top" ? "side" : "top";
    CZ.drag = null;
  });
  czRender();
  setTimeout(() => {
    const c = b.querySelector(".czg .card");
    if (c && typeof pad !== "undefined" && padList().some((p) => p && p.connected)) {
      document.querySelectorAll(".padfocus").forEach((e) => e.classList.remove("padfocus"));
      pad.focus = c;
      c.classList.add("padfocus");
    }
  }, 80);
  cancelAnimationFrame(CZ.raf);
  const loop = () => {
    if (career.uiOpen !== "tune" || !b.isConnected) return;
    czPreview(b);
    CZ.raf = requestAnimationFrame(loop);
  };
  loop();
  if (typeof padNav === "function") setTimeout(() => padNav(null), 60);
}
function czTabParts(t) {
  const out = [];
  for (const sl of CZ_TABS.find((x) => x.id === t).slots) {
    out.push({
      slot: sl,
      parts: [
        { id: sl + "_0", slot: sl, n: "Stock", p: 0, req: 1, stock: 1 },
        ...CZ_PARTS.filter((p) => p.slot === sl),
      ],
    });
  }
  return out;
}
function czOwned(mid, p) {
  return p.stock || !!czSetup(mid).own[p.id];
}
function czIsFit(mid, p) {
  const f = czSetup(mid).fit[p.slot];
  return p.stock ? !f : f === p.id;
}
// damage multiplier as a signed % ("\u221220%", "+5%", "standard")
function czPct(m) {
  const v = Math.round((m - 1) * 100);
  return v ? (v < 0 ? "\u2212" : "+") + Math.abs(v) + "%" : "standard";
}
function czFxText(p) {
  if (!p.fx) return p.look ? "cosmetic" : "";
  const t = [],
    f = p.fx,
    pc = (v, n) => t.push((v > 1 ? "+" : "") + Math.round((v - 1) * 100) + "% " + n);
  if (f.pw) pc(f.pw, "power");
  if (f.vm) t.push("+" + Math.round(f.vm * 2.23694) + " mph");
  if (f.br) pc(f.br, "brakes");
  if (f.ebr) pc(f.ebr, "engine brake");
  if (f.grip) pc(f.grip, "grip");
  if (f.hand && !f.grip) pc(f.hand, "handling");
  if (f.econ)
    t.push((f.econ < 1 ? "-" : "+") + Math.abs(Math.round((f.econ - 1) * 100)) + "% fuel use");
  if (f.tank) t.push("+" + f.tank + " L tank");
  if (f.dur) t.push(czPct(f.dur) + " crash damage");
  if (f.bp) t.push(czPct(f.bp) + " bullet damage");
  if (f.jk) t.push("anti-jackknife");
  if (f.shift) pc(1 / f.shift, "shift speed");
  if (f.beam) pc(f.beam, "beam reach");
  if (f.snd) t.push("deeper sound");
  return t.slice(0, 2).join(" \u2022 ");
}
function czRender() {
  const b = uiRoot.querySelector(".mback");
  if (!b || career.uiOpen !== "tune") return;
  const pf = typeof pad !== "undefined" && pad.focus,
    fk = pf
      ? pf.dataset.p
        ? '[data-p="' + pf.dataset.p + '"]'
        : pf.dataset.t
          ? '.cztabs [data-t="' + pf.dataset.t + '"]'
          : pf.id
            ? "#" + pf.id
            : null
      : null;
  czRender0(b);
  if (fk) {
    const el = b.querySelector(fk);
    if (el) {
      pad.focus = el;
      el.classList.add("padfocus");
    }
  }
}
function czRender0(b) {
  const m = modelById(career.cur),
    lvl = levelOf(career.xp);
  b.querySelector("#czBank").textContent = money(truck.money);
  b.querySelector(".cztabs").innerHTML = CZ_TABS.map(
    (t) =>
      `<button class="chip ${t.id === CZ.tab ? "on" : ""}" data-t="${t.id}">${t.ic} ${esc(t.n)}</button>`,
  ).join("");
  b.querySelectorAll(".cztabs .chip").forEach((el) =>
    el.addEventListener("click", () => {
      CZ.tab = el.dataset.t;
      CZ.sel = null;
      czRender();
      b.querySelector(".czg").scrollTop = 0;
    }),
  );
  const on = b.querySelector(".cztabs .chip.on");
  if (on) on.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
  const groups = czTabParts(CZ.tab);
  b.querySelector(".czg").innerHTML = groups
    .map(
      (G) =>
        `<div class="czsl">${esc(CZ_SLOTS[G.slot] || G.slot)}</div><div class="czcards">${G.parts
          .map((p) => {
            const own = czOwned(m.id, p),
              fit = czIsFit(m.id, p),
              lock = !own && lvl < (p.req || 1);
            return `<button class="card ${CZ.sel && CZ.sel.id === p.id ? "sel" : ""} ${own ? "own" : ""} ${fit ? "fit" : ""} ${lock ? "lock" : ""}" data-p="${p.id}"><canvas width="200" height="100"></canvas>${fit ? '<span class="ok">\u2713</span>' : ""}<div class="ci"><div class="cn">${esc(p.n)}</div><div class="cl">${p.lv ? "Lv " + p.lv : p.stock ? "Factory" : "Style"}${lock ? ` \u2022 <span class="lk">\u{1F512} Lv ${p.req}</span>` : ""}</div><div class="cp">${p.stock ? "Free" : own ? (fit ? "FITTED" : "OWNED") : money(p.p)}</div><div class="cf">${esc(czFxText(p))}</div></div></button>`;
          })
          .join("")}</div>`,
    )
    .join("");
  b.querySelectorAll(".czg .card").forEach((el) => {
    const p = el.dataset.p.endsWith("_0")
      ? { id: el.dataset.p, slot: el.dataset.p.slice(0, -2), n: "Stock", p: 0, req: 1, stock: 1 }
      : czPart(el.dataset.p);
    czIcon(el.querySelector("canvas").getContext("2d"), p, 240, 120);
    el.addEventListener("click", () => {
      CZ.sel = CZ.sel && CZ.sel.id === p.id ? null : p;
      czRender();
    });
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (lock) return;
      CZ.sel = p;
      czRender();
      const bt = b.querySelector("#czAct");
      if (bt && !bt.disabled) czAction();
    });
  });
  czFooter(b, m, lvl);
  czStatsHTML(b, m);
}
function czFooter(b, m, lvl) {
  const p = CZ.sel,
    bt = b.querySelector("#czAct"),
    n = b.querySelector("#czSelN"),
    msg = b.querySelector("#czMsg");
  bt.disabled = false;
  if (!p) {
    n.textContent = m.name;
    msg.textContent = "Tap a part to preview it";
    bt.textContent = "DONE";
    bt.className = "btn sel";
    return;
  }
  n.textContent = p.n;
  const own = czOwned(m.id, p),
    fit = czIsFit(m.id, p);
  if (fit) {
    bt.textContent = "\u2713 FITTED";
    bt.disabled = true;
    msg.textContent = "Already on this truck";
    bt.className = "btn";
  } else if (own) {
    bt.textContent = "EQUIP";
    msg.textContent = p.stock ? "Back to factory spec" : "You own this part";
    bt.className = "btn g sel";
  } else if (lvl < (p.req || 1)) {
    bt.textContent = "\u{1F512} LEVEL " + p.req;
    bt.disabled = true;
    msg.textContent = "Reach driver level " + p.req + " to unlock (you are " + lvl + ")";
    bt.className = "btn";
  } else if (truck.money < p.p) {
    bt.textContent = "NEED " + money(p.p - truck.money) + " MORE";
    bt.disabled = true;
    msg.textContent = "Price " + money(p.p);
    bt.className = "btn";
  } else {
    bt.textContent = "BUY & FIT \u2022 " + money(p.p);
    msg.textContent = "Bought once, kept for this truck";
    bt.className = "btn g sel";
  }
}
function czStatsHTML(b, m) {
  const cur = czStats(m, czFitted(m.id)),
    nx = CZ.sel
      ? czStats(m, czFitted(m.id, CZ.sel.stock ? { slot: CZ.sel.slot, id: undefined } : CZ.sel))
      : cur;
  b.querySelector(".czs").innerHTML = cur
    .map((s, i) => {
      const a = Math.max(0.03, Math.min(1, s[2])),
        c = Math.max(0.03, Math.min(1, nx[i][2])),
        d = c - a,
        cls = Math.abs(d) < 0.002 ? "" : d > 0 ? "up" : "dn";
      return `<div class="r"><div class="l"><span>${s[0]}</span><b class="${cls}">${cls ? nx[i][1] : s[1]}</b></div><div class="b"><i style="width:${Math.min(a, c) * 100}%"></i>${cls ? `<em style="left:${Math.min(a, c) * 100}%;width:${Math.abs(d) * 100}%;background:${d > 0 ? "#2ecc71" : "#e74c3c"}"></em>` : ""}</div></div>`;
    })
    .join("");
}
function czClose() {
  CZ.sel = null;
  if (career.uiOpen === "tune") closeUI();
}
function czAction() {
  const m = modelById(career.cur),
    p = CZ.sel;
  if (!p) {
    closeUI();
    return;
  }
  const S = czSetup(m.id),
    lvl = levelOf(career.xp);
  if (!czOwned(m.id, p)) {
    if (lvl < (p.req || 1) || truck.money < p.p) return;
    truck.money -= p.p;
    S.own[p.id] = 1;
    toast("\u{1F527} Bought " + p.n + " \u2022 " + money(p.p));
    if (typeof BigRig !== "undefined")
      BigRig.emit("partBought", { part: p.id, model: m.id, price: p.p });
  }
  if (p.stock) delete S.fit[p.slot];
  else S.fit[p.slot] = p.id;
  if (p.look && p.look.col) career.colors[m.id] = p.look.col;
  czApply();
  if (typeof saveGame === "function") saveGame();
  if (typeof mpCosmetic === "function") mpCosmetic();
  CZ.sel = null;
  czRender();
}
function czPreview(b) {
  const cv = b.querySelector(".czp canvas");
  if (!cv) return;
  const r = cv.getBoundingClientRect(),
    dpr = Math.min(2, devicePixelRatio || 1),
    W = Math.round(r.width * dpr),
    H = Math.round(r.height * dpr);
  if (!W || !H) return;
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const g = cv.getContext("2d"),
    m = modelById(career.cur),
    fit = czFitted(m.id, CZ.sel && !CZ.sel.stock ? CZ.sel : null);
  if (CZ.sel && CZ.sel.stock) delete fit[CZ.sel.slot];
  g.clearRect(0, 0, W, H);
  if (!CZ.drag) CZ.ang += CZ.spin * 0.016;
  const lights = CZ.tab === "lights";
  b.querySelector(".vt").textContent = CZ.view === "top" ? "TOP VIEW" : "360\u00B0 VIEW";
  // turntable
  const cx = W / 2,
    cy = H * 0.5,
    R = Math.min(W * 0.5, H * 0.52),
    sq = CZ.view === "top" ? 1 : 0.27;
  g.save();
  g.translate(cx, CZ.view === "top" ? cy : H * 0.8);
  g.scale(1, sq);
  const tg = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  tg.addColorStop(0, "rgba(90,110,140,.55)");
  tg.addColorStop(0.7, "rgba(42,50,67,.35)");
  tg.addColorStop(1, "rgba(21,27,38,0)");
  g.fillStyle = tg;
  g.beginPath();
  g.arc(0, 0, R, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(245,184,46,0.22)";
  g.lineWidth = 1.5;
  g.setLineDash([6, 8]);
  g.beginPath();
  g.arc(0, 0, R * 0.97, 0, 7);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = "rgba(255,255,255,0.035)";
  g.lineWidth = 2;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + CZ.ang;
    g.beginPath();
    g.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
    g.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95);
    g.stroke();
  }
  g.restore();
  if (CZ.view === "top") {
    const A = czArt(m, career.colors[m.id] || m.cols[0], fit),
      sc = (R * 1.95) / Math.max(A.H, A.W);
    g.save();
    g.translate(cx, cy);
    g.rotate(CZ.ang);
    g.globalAlpha = 0.4;
    g.filter = "blur(6px)";
    g.drawImage(A.c, (-A.W * sc) / 2 + 8, (-A.H * sc) / 2 + 10, A.W * sc, A.H * sc);
    g.filter = "none";
    g.globalAlpha = 1;
    g.drawImage(A.c, (-A.W * sc) / 2, (-A.H * sc) / 2, A.W * sc, A.H * sc);
    if (lights && typeof czLightsPreview === "function") czLightsPreview(g, A, sc, fit, m);
    g.restore();
  } else {
    if (typeof ttDraw === "function") {
      const k = Math.min(W / 10.5, H / 6.2);
      ttDraw(g, cx, H * 0.8, k, CZ.ang, 0.27, m, career.colors[m.id] || m.cols[0], fit);
    } else {
    const sc = Math.min(W / 12, H / 6.0),
      flip = Math.cos(CZ.ang) < 0;
    g.save();
    g.translate(cx, H * 0.8);
    if (flip) g.scale(-1, 1);
    czSide(g, 1.8 * sc, 0, sc, m, career.colors[m.id] || m.cols[0], fit);
    if (lights && typeof czLightsSide === "function") czLightsSide(g, 1.8 * sc, 0, sc, m, fit);
    g.restore();
    }
  }
}
function czPad(g, hit, now, dt) {
  const rx = g.axes[2] || 0;
  if (Math.abs(rx) > 0.2) {
    CZ.ang += rx * dt * 2.5;
    CZ.spin = 0;
  }
  if (hit(1)) {
    czClose();
    return true;
  }
  if (hit(3)) {
    CZ.view = CZ.view === "top" ? "side" : "top";
  }
  if (hit(4) || hit(5)) {
    const i = CZ_TABS.findIndex((t) => t.id === CZ.tab),
      n = CZ_TABS.length;
    CZ.tab = CZ_TABS[(i + (hit(5) ? 1 : -1) + n) % n].id;
    CZ.sel = null;
    czRender();
    setTimeout(() => {
      const c = uiRoot.querySelector(".tz .czg .card");
      if (c) {
        document.querySelectorAll(".padfocus").forEach((e) => e.classList.remove("padfocus"));
        pad.focus = c;
        c.classList.add("padfocus");
      }
    }, 40);
    return true;
  }
  return false;
}
addEventListener(
  "keydown",
  (e) => {
    if (career.uiOpen !== "tune") return;
    const k = e.code;
    if (k === "KeyQ" || k === "KeyE") {
      const i = CZ_TABS.findIndex((t) => t.id === CZ.tab),
        n = CZ_TABS.length;
      CZ.tab = CZ_TABS[(i + (k === "KeyE" ? 1 : -1) + n) % n].id;
      CZ.sel = null;
      czRender();
      e.preventDefault();
    } else if (k === "KeyZ" || k === "KeyX") {
      CZ.ang += k === "KeyX" ? 0.25 : -0.25;
      CZ.spin = 0;
    } else if (k === "KeyV") {
      CZ.view = CZ.view === "top" ? "side" : "top";
    } else if (k === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation(); // else the global Esc handler sees no UI open and opens the pause/job board
      czClose();
    }
  },
  true,
);
// ---- tune shop bays: a drive-in pad at every truck repair garage + owned-yard garages
function czBays() {
  if (CZ.bays) return CZ.bays;
  const out = [];
  for (const g of world.garages || []) {
    const b = g.bay;
    if (!b) continue;
    out.push({ name: g.name, x: b.x - 23.5, y: b.y + 1.5, w: 4.6, L: 12 });
  }
  for (const yd of world.forSale || [])
    out.push({
      name: "Yard garage",
      yd,
      x: (yd.x0 + 12.2) * M_T,
      y: (yd.y0 + 6.4) * M_T,
      w: 5,
      L: 11,
    });
  return (CZ.bays = out);
}
function czBayHere() {
  if (!world.ready || !started) return null;
  const s = truck,
    f = fwd(s.h),
    cx = s.x + f[0] * 2.2,
    cy = s.y + f[1] * 2.2;
  for (const b of czBays()) {
    if (b.yd && !(typeof ownedYard === "function" && ownedYard(b.yd))) continue;
    if (Math.abs(cx - b.x) < b.w * 0.9 && Math.abs(cy - b.y) < b.L / 2) return b;
  }
  return null;
}
function czTick() {
  if (!started || (typeof bigmap !== "undefined" && bigmap.open)) {
    const e = document.getElementById("czGo");
    if (e) e.remove();
    return;
  }
  // v70 (James 22 Oct): like the estate agent - in the bay the CUSTOMISE button shows (greyed "stop first" while moving);
  // it opens only under 3 mph (czEnter), never by itself
  const here = !career.uiOpen ? czBayHere() : null;
  CZ.bay = here || (career.uiOpen === "tune" ? CZ.bay : null);
  let el = document.getElementById("czGo");
  if (here && !el) {
    el = document.createElement("button");
    el.id = "czGo";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      czEnter();
    });
    (document.getElementById("frame") || document.body).appendChild(el);
    const st = document.createElement("style");
    st.id = "czGoCss";
    if (!document.getElementById("czGoCss")) {
    st.textContent =
      "#czGo{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);z-index:30;padding:14px 22px;min-height:56px;border-radius:16px;border:0;font:900 18px system-ui;color:#111;background:linear-gradient(180deg,#ffd45e,#f5a91e);box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer;pointer-events:auto}#czGo small{display:block;font-size:10px;opacity:.7}#czGo.mv{filter:saturate(.55) brightness(.85)}";
    document.head.appendChild(st);
    }
  }
  if (here && el) {
    const slow = Math.abs(truck.v) < EA_STOP,
      pa = typeof pad !== "undefined" && pad.active,
      key = (pa ? "\u24b6" : document.body.classList.contains("touch") ? "Tap" : "E / Enter") + (slow ? "" : " \u2022 stop first"),
      html = "\u{1F527} CUSTOMISE <small>" + key + "</small>";
    if (el.innerHTML !== html) el.innerHTML = html;
    el.classList.toggle("mv", !slow);
  }
  if (!here && el) el.remove();
}
function czEnter() {
  if (career.uiOpen || !CZ.bay) return false;
  if (Math.abs(truck.v) >= EA_STOP) {
    flash("Stop to enter the tune shop");
    return true;
  }
  czOpen();
  return true;
}
addEventListener(
  "keydown",
  (e) => {
    if (career.uiOpen || !(e.code === "Enter" || e.code === "NumpadEnter" || e.code === "KeyE")) return;
    if (document.getElementById("czGo")) {
      const t = e.target;
      if (t && t.closest && t.closest("input,textarea,select")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      czEnter();
    }
  },
  true,
);
function czDrawBays(vx0, vy0, vx1, vy1) {
  if (!world.ready) return;
  const S = PPM,
    dark = typeof DN !== "undefined" ? DN.dark : 0;
  for (const b of czBays()) {
    if (b.yd && !(typeof ownedYard === "function" && ownedYard(b.yd))) continue;
    const x = b.x * S,
      y = b.y * S,
      w = b.w * S,
      L = b.L * S;
    if (x < vx0 - 200 || x > vx1 + 200 || y < vy0 - 200 || y > vy1 + 200) continue;
    const here = CZ.bay === b;
    ctx.save();
    ctx.fillStyle = "rgba(245,184,46,0.12)";
    ctx.fillRect(x - w / 2, y - L / 2, w, L);
    ctx.strokeStyle = here ? "#2ecc71" : "#f5b82e";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(x - w / 2, y - L / 2, w, L);
    ctx.setLineDash([]);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? "#111" : "#f5b82e";
      ctx.fillRect(x - w / 2 + (k * w) / 6, y + L / 2 - 0.5 * S, w / 6, 0.5 * S);
    }
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "900 " + Math.round(1.3 * S) + "px Arial Black,Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = here ? "#2ecc71" : "#f5b82e";
    ctx.fillText("TUNE SHOP", 0, 0);
    ctx.restore();
    if (dark > 0.05 && typeof dnLight === "function")
      dnLight(x, y, 110, "rgba(255,214,120,0.9)", 0.6);
  }
}
// map: wrench marker on every tune bay (owned yards only)
function czMapMarks(BX, BY, z, IR) {
  if (!world.ready) return;
  const r = Math.max(6, Math.min(11, IR || 7));
  for (const b of czBays()) {
    if (b.yd && !(typeof ownedYard === "function" && ownedYard(b.yd))) continue;
    if (!b.yd && z < 0.9) continue;
    const x = BX(b.x / M_T),
      y = BY(b.y / M_T);
    ctx.save();
    ctx.fillStyle = b.yd ? "#2ecc71" : "#f5b82e";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.font = "900 " + Math.round(r * 1.2) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u{1F527}", x, y + 1);
    ctx.restore();
    if (b.yd && z > 1.2 && typeof mapLabel === "function")
      mapLabel("Tune shop", x + r + 4, y, "#9dffbf", true);
  }
}

/**
 * @file career.js — CAREER: missions to malls, XP / tiers, truck dealership, save game
 * Exposes (globals): TIERS, CARGOS, TRUCK_MODELS, career, SAVE_KEY_OLD, saveKey, SETTINGS,
 *   levelNeed, levelOf, tierOf, tierInfo, addXP, modelArtCache, modelArt (+38 more)
 * Depends on: world.js, render.js, lorry.js, physics.js, traffic.js, depots.js, sites.js, ui.js,
 *   satnav.js, gamepad.js, beams.js, fx.js, port.js, porttrucks.js, owndepot.js, tune.js,
 *   daynight.js, weather.js, main.js, accounts.js
 * Load order: #15 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v7 CAREER: missions to malls, XP / tiers, truck dealership, save game =====================
// Data-driven: add a tier or a cargo by adding a row below.
const TIERS = [
  {
    tier: 1,
    xp: 0,
    name: "Rookie Haulier",
    payMult: 1.0,
    maxKm: 7,
    color: "#3fb950",
    perks: ["Curtain-siders & box vans", "Local retail deliveries"],
  },
  {
    tier: 2,
    xp: 2700,
    name: "Regional Driver",
    payMult: 1.3,
    maxKm: 14,
    color: "#2f81f7",
    perks: ["Fridge & container trailers", "Cross-region routes, heavier loads", "+30% pay rate"],
  },
  {
    tier: 3,
    xp: 9000,
    name: "Specialist",
    payMult: 1.65,
    maxKm: 24,
    color: "#a371f7",
    perks: ["Tankers & flatbeds", "Fuel, machinery & high-value goods", "+65% pay rate"],
  },
  {
    tier: 4,
    xp: 22000,
    name: "Elite Haulier",
    payMult: 2.1,
    maxKm: 99,
    color: "#f0883e",
    perks: ["Hazardous (ADR) loads", "Any distance", "+110% pay rate"],
  },
];
const CARGOS = [
  {
    id: "groc",
    name: "Groceries",
    icon: "\u{1F6D2}",
    trl: "curtain",
    kg: [9000, 15000],
    mult: 1.0,
    tier: 1,
    col: "#2e7d32",
  },
  {
    id: "cloth",
    name: "Clothing & shoes",
    icon: "\u{1F45F}",
    trl: "box",
    kg: [5000, 8000],
    mult: 1.05,
    tier: 1,
    col: "#6a1b9a",
  },
  {
    id: "elec",
    name: "Consumer electronics",
    icon: "\u{1F4FA}",
    trl: "curtain",
    kg: [6000, 10000],
    mult: 1.2,
    tier: 1,
    col: "#1565c0",
  },
  {
    id: "furn",
    name: "Flat-pack furniture",
    icon: "\u{1F6CB}",
    trl: "curtain",
    kg: [8000, 13000],
    mult: 1.05,
    tier: 1,
    col: "#8d6e63",
  },
  {
    id: "drink",
    name: "Pallets of drinks",
    icon: "\u{1F964}",
    trl: "curtain",
    kg: [14000, 19000],
    mult: 1.0,
    tier: 1,
    col: "#c62828",
  },
  {
    id: "toys",
    name: "Toys & games",
    icon: "\u{1F9F8}",
    trl: "box",
    kg: [4000, 7000],
    mult: 1.1,
    tier: 1,
    col: "#ef6c00",
  },
  {
    id: "froz",
    name: "Frozen food",
    icon: "\u{1F9CA}",
    trl: "fridge",
    kg: [12000, 18000],
    mult: 1.3,
    tier: 2,
    col: "#0288d1",
  },
  {
    id: "fresh",
    name: "Fresh produce",
    icon: "\u{1F966}",
    trl: "fridge",
    kg: [9000, 15000],
    mult: 1.25,
    tier: 2,
    col: "#43a047",
  },
  {
    id: "pharm",
    name: "Pharmacy supplies",
    icon: "\u{1F48A}",
    trl: "fridge",
    kg: [4000, 7000],
    mult: 1.45,
    tier: 2,
    col: "#00897b",
  },
  {
    id: "dockc",
    name: "Port container (40ft)",
    icon: "\u{1F6A2}",
    trl: "cont",
    kg: [16000, 26000],
    mult: 1.35,
    tier: 2,
    col: "#0e6655",
    dock: true,
  },
  {
    id: "cont",
    name: "Imported goods (40ft)",
    icon: "\u{1F4E6}",
    trl: "cont",
    kg: [14000, 22000],
    mult: 1.3,
    tier: 2,
    col: "#d84315",
  },
  {
    id: "fuel",
    name: "Forecourt diesel",
    icon: "\u26FD",
    trl: "tank",
    kg: [20000, 26000],
    mult: 1.7,
    tier: 3,
    col: "#455a64",
  },
  {
    id: "steel",
    name: "Shop-fit steelwork",
    icon: "\u{1F3D7}",
    trl: "flat",
    kg: [18000, 26000],
    mult: 1.6,
    tier: 3,
    col: "#5d4037",
  },
  {
    id: "lux",
    name: "Luxury goods",
    icon: "\u{1F48E}",
    trl: "box",
    kg: [3000, 6000],
    mult: 1.95,
    tier: 3,
    col: "#ad1457",
  },
  {
    id: "bake",
    name: "Bakery & bread",
    icon: "\u{1F35E}",
    trl: "box",
    kg: [4000, 8000],
    mult: 1.05,
    tier: 1,
    col: "#d4a056",
  },
  {
    id: "diy",
    name: "DIY & garden centre",
    icon: "\u{1FAB4}",
    trl: "curtain",
    kg: [9000, 16000],
    mult: 1.0,
    tier: 1,
    col: "#558b2f",
  },
  {
    id: "parc",
    name: "Parcels & post",
    icon: "\u{1F4EE}",
    trl: "box",
    kg: [3000, 7000],
    mult: 1.15,
    tier: 1,
    col: "#b71c1c",
  },
  {
    id: "ret",
    name: "Store returns & cages",
    icon: "\u{1F501}",
    trl: "curtain",
    kg: [3000, 6000],
    mult: 0.95,
    tier: 1,
    col: "#607d8b",
    ret: true,
  },
  {
    id: "dairy",
    name: "Milk & dairy",
    icon: "\u{1F95B}",
    trl: "fridge",
    kg: [12000, 18000],
    mult: 1.25,
    tier: 2,
    col: "#90caf9",
  },
  {
    id: "paper",
    name: "Paper & print",
    icon: "\u{1F4F0}",
    trl: "curtain",
    kg: [14000, 20000],
    mult: 1.1,
    tier: 2,
    col: "#795548",
  },
  {
    id: "wood",
    name: "Timber & sheet board",
    icon: "\u{1FAB5}",
    trl: "flat",
    kg: [16000, 24000],
    mult: 1.45,
    tier: 3,
    col: "#8d6e63",
  },
  {
    id: "mach",
    name: "Plant machinery",
    icon: "\u{1F69C}",
    trl: "flat",
    kg: [15000, 25000],
    mult: 1.75,
    tier: 3,
    col: "#f9a825",
  },
  {
    id: "gas",
    name: "LPG cylinders (ADR)",
    icon: "\u{1F525}",
    trl: "tank",
    kg: [16000, 22000],
    mult: 2.05,
    tier: 4,
    col: "#e65100",
  },
  {
    id: "chem",
    name: "Pool chemicals (ADR)",
    icon: "\u2623",
    trl: "tank",
    kg: [18000, 24000],
    mult: 2.2,
    tier: 4,
    col: "#f9a825",
  },
];
const TRUCK_MODELS = [
  {
    id: "rigger",
    name: "Rigger Classic 360",
    price: 0,
    hp: 360,
    power: 1.0,
    vmax: 25.0,
    tank: 400,
    econ: 1.0,
    style: { roof: "std" },
    cols: ["#d63b2f", "#2471a3", "#f4f4f4", "#1e8449", "#f1c40f"],
    blurb: "The trusty cab you started with.",
  },
  {
    id: "atlas",
    name: "Atlas CX 440",
    price: 24000,
    hp: 440,
    power: 1.18,
    vmax: 25.0,
    tank: 520,
    econ: 0.92,
    style: { roof: "high", skirts: 1, visor: 1 },
    cols: ["#1c2833", "#ecf0f1", "#2e86c1", "#7d3c98", "#c0392b"],
    blurb: "High-roof sleeper, aero skirts, frugal.",
  },
  {
    id: "northline",
    name: "Northline 520 Long-Nose",
    price: 48000,
    hp: 520,
    power: 1.35,
    vmax: 25.0,
    tank: 650,
    econ: 1.08,
    style: { roof: "std", nose: 1.6, stacks: 1 },
    cols: ["#7b241c", "#f39c12", "#145a32", "#17202a", "#d0d3d4"],
    blurb: "Classic bonneted hauler with chrome stacks.",
  },
  {
    id: "volta",
    name: "Volta E-Hybrid",
    price: 72000,
    hp: 450,
    power: 1.28,
    vmax: 25.0,
    tank: 380,
    econ: 0.62,
    style: { roof: "aero", stripe: "#33e0ff", skirts: 1 },
    cols: ["#f4f6f7", "#17a589", "#1b2631", "#a569bd"],
    blurb: "Hybrid drive: cheapest per mile.",
  },
  {
    id: "kestrel",
    name: "Kestrel Sport 600",
    price: 92000,
    hp: 600,
    power: 1.5,
    vmax: 26.4,
    tank: 600,
    econ: 0.95,
    style: { roof: "aero", stripe: "#ffcc00", skirts: 1, visor: 1, stacks: 1 },
    cols: ["#c0392b", "#111111", "#2471a3", "#f1c40f"],
    blurb: "Fast, sharp and surprisingly thrifty.",
  },
  {
    id: "titan",
    name: "Titan V8 750",
    price: 135000,
    hp: 750,
    power: 1.75,
    vmax: 27.8,
    tank: 800,
    econ: 1.3,
    style: { roof: "high", nose: 2.0, stacks: 1, lightbar: 1, visor: 1 },
    cols: ["#0b0b0b", "#b03a2e", "#f1c40f", "#2874a6", "#ffffff"],
    blurb: "The king of the road. 100 km/h limiter.",
  },
];
const career = {
  depotLatch: true,
  xp: 0,
  tier: 1,
  owned: ["rigger"],
  cur: "rigger",
  colors: {},
  jobs: [],
  active: null,
  done: 0,
  earned: 0,
  unload: null,
  ui: null,
  lastSave: 0,
  boardSeq: 1,
  uiOpen: null,
};
const SAVE_KEY_OLD = "bigrig.save.v7";
const saveKey = () => "bigrig.save." + (world.v2poi ? "v2" : "main");
const SETTINGS = { vol: 0.7 };
// ---------- levels & tiers
const levelNeed = (n) => Math.round(120 * Math.pow(n - 1, 1.55)); // cumulative XP to reach level n
function levelOf(xp) {
  let n = 1;
  while (xp >= levelNeed(n + 1)) n++;
  return n;
}
function tierOf(xp) {
  let t = 1;
  for (const T_ of TIERS) if (xp >= T_.xp) t = T_.tier;
  return t;
}
const tierInfo = (t) => TIERS.find((x) => x.tier === t) || TIERS[TIERS.length - 1];
function addXP(n) {
  const before = career.tier;
  career.xp += n;
  career.xpFx = { t: timeS, n };
  career.tier = Math.max(before, tierOf(career.xp));
  BigRig.emit("xp", { xp: career.xp, add: n });
  if (career.tier > before) {
    for (let t = before + 1; t <= career.tier; t++) {
      BigRig.emit("tierUnlocked", { tier: t });
    }
    celebrateTier(career.tier);
    refreshBoard(true);
  }
}
// ---------- truck models
const modelArtCache = {};
function modelArt(m, col) {
  const key = m.id + col;
  if (modelArtCache[key]) return modelArtCache[key];
  if (m.id === "rigger") return (modelArtCache[key] = makeCabArt(col));
  const st = m.style,
    nose = st.nose || 0,
    front = CAB.front - nose,
    S = PPM * ART_SCALE,
    W = Math.ceil((CAB.w + 0.9) * S),
    H = Math.ceil((CAB.rear - front) * S);
  const c = mkCanvas(W, H),
    g = c.getContext("2d");
  const X = (v) => W / 2 + v * S,
    Y = (v) => (v - front) * S;
  g.fillStyle = "#26282c";
  g.fillRect(X(-0.55), Y(-2.8), 0.35 * S, 4.0 * S);
  g.fillRect(X(0.2), Y(-2.8), 0.35 * S, 4.0 * S);
  g.fillStyle = "#2f3236";
  g.fillRect(X(-0.9), Y(-0.9), 1.8 * S, 2.0 * S);
  g.fillStyle = "#55595f";
  g.beginPath();
  g.arc(X(0), Y(0.3), 0.75 * S, 0, 7);
  g.fill();
  g.fillStyle = "#141414";
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 0.75 : -1.25), Y(-0.55), 0.5 * S, 1.1 * S);
  const body = shade(col, 1),
    dark = shade(col, 0.7),
    lite = shade(col, 1.25);
  if (st.skirts) {
    g.fillStyle = dark;
    g.fillRect(X(-1.25), Y(-2.5), 0.2 * S, 1.7 * S);
    g.fillRect(X(1.05), Y(-2.5), 0.2 * S, 1.7 * S);
  } else {
    g.fillStyle = "#b9bec5";
    g.fillRect(X(-1.2), Y(-2.5), 0.4 * S, 1.5 * S);
    g.fillRect(X(0.8), Y(-2.5), 0.4 * S, 1.5 * S);
  }
  const cab0 = -5.0,
    cab1 = st.roof === "high" ? -2.25 : -2.55;
  if (nose) {
    const gh = g.createLinearGradient(X(-1), 0, X(1), 0);
    gh.addColorStop(0, dark);
    gh.addColorStop(0.5, lite);
    gh.addColorStop(1, dark);
    g.fillStyle = gh;
    rr(g, X(-1.0), Y(cab0 - nose), 2.0 * S, (nose + 0.4) * S, 0.45 * S);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(X(-0.08), Y(cab0 - nose + 0.2), 0.16 * S, nose * S);
    g.fillStyle = "#cfd3d8";
    g.fillRect(X(-1.0), Y(cab0 - nose), 2.0 * S, 0.14 * S);
    for (const s of [-1, 1]) {
      g.fillStyle = "#1d1f22";
      rr(g, X(s > 0 ? 0.95 : -1.3), Y(cab0 - nose + 0.25), 0.35 * S, 0.9 * S, 0.15 * S);
      g.fill();
    }
  }
  const gr = g.createLinearGradient(X(-1.25), 0, X(1.25), 0);
  gr.addColorStop(0, dark);
  gr.addColorStop(0.5, lite);
  gr.addColorStop(1, dark);
  g.fillStyle = gr;
  if (st.roof === "aero") {
    g.beginPath();
    g.moveTo(X(-1.25), Y(cab1));
    g.lineTo(X(-1.25), Y(cab0 + 0.7));
    g.quadraticCurveTo(X(-1.2), Y(cab0), X(0), Y(cab0 - 0.08));
    g.quadraticCurveTo(X(1.2), Y(cab0), X(1.25), Y(cab0 + 0.7));
    g.lineTo(X(1.25), Y(cab1));
    g.closePath();
    g.fill();
  } else {
    rr(g, X(-1.25), Y(cab0), 2.5 * S, (cab1 - cab0) * S, 0.35 * S);
    g.fill();
  }
  g.fillStyle = "#1b2a38";
  rr(g, X(-1.1), Y(cab0 + 0.03), 2.2 * S, 0.3 * S, 0.12 * S);
  g.fill();
  if (st.roof === "high") {
    const g2 = g.createLinearGradient(0, Y(cab0 + 0.4), 0, Y(cab1));
    g2.addColorStop(0, lite);
    g2.addColorStop(1, body);
    g.fillStyle = g2;
    rr(g, X(-1.1), Y(cab0 + 0.4), 2.2 * S, (cab1 - cab0 - 0.55) * S, 0.3 * S);
    g.fill();
    g.strokeStyle = dark;
    g.lineWidth = 2;
    g.strokeRect(X(-0.5), Y(cab1 - 1.0), 1.0 * S, 0.5 * S);
  } else if (st.roof === "aero") {
    g.fillStyle = "rgba(20,40,60,0.75)";
    rr(g, X(-0.75), Y(cab0 + 0.55), 1.5 * S, 1.0 * S, 0.4 * S);
    g.fill();
    g.fillStyle = "rgba(160,220,255,0.35)";
    g.fillRect(X(-0.6), Y(cab0 + 0.65), 0.3 * S, 0.7 * S);
  } else {
    const g2 = g.createLinearGradient(0, Y(cab0 + 0.3), 0, Y(cab0 + 1.5));
    g2.addColorStop(0, lite);
    g2.addColorStop(1, body);
    g.fillStyle = g2;
    g.beginPath();
    g.moveTo(X(-1.05), Y(cab1 - 0.6));
    g.quadraticCurveTo(X(-1.1), Y(cab0 + 0.35), X(0), Y(cab0 + 0.3));
    g.quadraticCurveTo(X(1.1), Y(cab0 + 0.35), X(1.05), Y(cab1 - 0.6));
    g.closePath();
    g.fill();
  }
  if (st.stripe) {
    g.fillStyle = st.stripe;
    g.fillRect(X(-1.25), Y(cab0 + 0.6), 0.12 * S, (cab1 - cab0 - 0.8) * S);
    g.fillRect(X(1.13), Y(cab0 + 0.6), 0.12 * S, (cab1 - cab0 - 0.8) * S);
    g.fillRect(X(-1.1), Y(cab1 - 0.25), 2.2 * S, 0.08 * S);
  }
  if (st.visor) {
    g.fillStyle = "rgba(10,10,10,0.75)";
    g.fillRect(X(-1.15), Y(cab0 + 0.33), 2.3 * S, 0.12 * S);
  }
  if (st.lightbar || st.roof === "high") {
    g.fillStyle = "#f5b02e";
    for (let s = -0.9; s <= 0.91; s += 0.3) {
      g.beginPath();
      g.arc(X(s), Y(cab0 + 0.25), 0.07 * S, 0, 7);
      g.fill();
    }
  }
  if (st.stacks) {
    for (const s of [-1, 1]) {
      const sg = g.createRadialGradient(
        X(s * 1.0) - 3,
        Y(cab1 + 0.15) - 3,
        1,
        X(s * 1.0),
        Y(cab1 + 0.15),
        0.24 * S,
      );
      sg.addColorStop(0, "#ffffff");
      sg.addColorStop(1, "#8e959c");
      g.fillStyle = sg;
      g.beginPath();
      g.arc(X(s * 1.0), Y(cab1 + 0.15), 0.24 * S, 0, 7);
      g.fill();
      g.fillStyle = "#222";
      g.beginPath();
      g.arc(X(s * 1.0), Y(cab1 + 0.15), 0.1 * S, 0, 7);
      g.fill();
    }
  } else
    for (const s of [-1, 1]) {
      g.fillStyle = "#d9dde2";
      g.beginPath();
      g.arc(X(s * 0.95), Y(cab1 + 0.1), 0.15 * S, 0, 7);
      g.fill();
    }
  g.fillStyle = "#1d1f22";
  for (const s of [-1, 1]) g.fillRect(X(s > 0 ? 1.25 : -1.55), Y(cab0 + 0.25), 0.3 * S, 0.42 * S);
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 2;
  rr(g, X(-1.25), Y(cab0), 2.5 * S, (cab1 - cab0) * S, 0.35 * S);
  g.stroke();
  return (modelArtCache[key] = { c, W, H, ox: W / 2, oy: Y(0) });
}
const modelById = (id) => TRUCK_MODELS.find((m) => m.id === id) || TRUCK_MODELS[0];
function applyModel(id, col) {
  const m = modelById(id);
  col = col || career.colors[id] || m.cols[0];
  career.cur = m.id;
  career.colors[m.id] = col;
  CABART = modelArt(m, col);
  CABSH = silhouette(CABART);
  truck.power = m.power;
  truck.vmax = m.vmax;
  truck.econ = m.econ;
  truck.tank = m.tank;
  truck.model = m.id;
  if (truck.fuel > truck.tank) truck.fuel = truck.tank;
  if (typeof czApply === "function") czApply();
}
// ---------- save / load
function jobSer(j) {
  return {
    band: j.band,
    repeat: j.repeat,
    id: j.id,
    cargo: j.cargo.name,
    tier: j.tier,
    from: jobRef(j.from),
    to: jobRef(j.to),
    km: j.km,
    kg: j.kg,
    weight: j.weight,
    trailerType: j.trailerType,
    pay: j.pay,
    xp: j.xp,
    mins: j.mins,
    approx: j.approx,
  };
}
function jobDe(o) {
  const c = CARGOS.find((c) => c.name === o.cargo),
    from = typeof o.from === "number" ? world.depots[o.from] : jobObj(o.from),
    to = typeof o.to === "number" ? world.malls[o.to] : jobObj(o.to);
  if (!c || !from || !to) return null;
  return Object.assign({}, o, { cargo: c, from, to });
}
function saveGame() {
  try {
    if (!world.ready) return false;
    const tr = truck.trl,
      a = career.active;
    const d = {
      v: 8,
      name: localStorage.getItem("bigrig.name") || "",
      money: truck.money,
      fuel: truck.fuel,
      damage: truck.damage,
      xp: career.xp,
      tier: career.tier,
      owned: career.owned,
      cur: career.cur,
      colors: career.colors,
      tune: career.tune || {},
      done: career.done,
      earned: career.earned,
      boardSeq: career.boardSeq,
      pos: { x: truck.x, y: truck.y, h: truck.h },
      gameT,
      gameDay,
      wx: { st: WX.st, t: WX.timer, wet: WX.wet },
      settings: SETTINGS,
      hb: !!(typeof HB !== "undefined" && HB.on),
      own: typeof ownSave === "function" ? ownSave() : null,
      hist: career.hist || [],
      jobs: career.jobs.filter((j) => !j.taken).map(jobSer),
      active: a
        ? {
            job: jobSer(a.job),
            phase: a.phase === "unloading" ? "deliver" : a.phase,
            bay: a.job.to.bays.indexOf(a.bay),
            trl:
              a.phase === "recouple"
                ? {
                    x: a.trailer.x,
                    y: a.trailer.y,
                    th: a.trailer.th,
                    type: a.trailer.type,
                    col: a.trailer.col,
                    logo: a.trailer.logo,
                    cargo: a.trailer.cargo,
                    cargoKg: a.trailer.cargoKg,
                    weight: a.trailer.weight,
                  }
                : null,
            el: timeS - a.t0,
          }
        : null,
      trailer: tr
        ? {
            type: tr.type,
            col: tr.col,
            logo: tr.logo,
            cargo: tr.cargo,
            cargoKg: tr.cargoKg,
            weight: tr.weight,
            typeName: tr.typeName,
            job: tr.job || null,
          }
        : null,
      t: Date.now(),
    };
    localStorage.setItem(saveKey(), JSON.stringify(d));
    career.lastSave = timeS;
    return true;
  } catch (e) {
    console.warn("save failed", e);
    return false;
  }
}
function hasSave() {
  try {
    return JSON.parse(
      localStorage.getItem(saveKey()) ||
        (world.v2poi ? "null" : localStorage.getItem(SAVE_KEY_OLD)) ||
        "null",
    );
  } catch (e) {
    return null;
  }
}
function posOK(x, y) {
  if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x > MW * M_T || y > MH * M_T) return false;
  for (const [dx, dy] of [
    [0, 0],
    [3, 0],
    [-3, 0],
    [0, 3],
    [0, -3],
  ])
    if (solidAtM(x + dx, y + dy)) return false;
  return true;
}
function loadGame() {
  const d = hasSave();
  if (!d) return false;
  truck.money = d.money ?? truck.money;
  if (typeof ownLoad === "function") ownLoad(d.own);
  truck.fuel = d.fuel ?? truck.fuel;
  truck.damage = d.damage || 0;
  career.xp = d.xp || 0;
  career.tier = Math.max(tierOf(career.xp), Math.min(TIERS.length, d.tier || 1));
  /* v41: tiers already earned under the old (lower) XP thresholds are kept */ career.owned =
    d.owned || ["rigger"];
  if (!career.owned.includes("rigger")) career.owned.unshift("rigger");
  if (typeof d.gameT === "number") gameT = d.gameT;
  if (typeof d.gameDay === "number") gameDay = d.gameDay;
  if (d.wx) {
    WX.st = d.wx.st || "clear";
    WX.timer = d.wx.t || 200;
    WX.wet = WX.rain = d.wx.st === "rain" ? 1 : 0;
    WX.fog = d.wx.st === "fog" ? 1 : 0;
  }
  career.colors = d.colors || {};
  career.tune = d.tune || {};
  career.done = d.done || 0;
  career.earned = d.earned || 0;
  career.boardSeq = Math.max(career.boardSeq, d.boardSeq || 1);
  applyModel(d.cur || "rigger");
  if (d.settings) Object.assign(SETTINGS, d.settings);
  if (typeof HB !== "undefined") {
    HB.on = !!d.hb;
    HB.k = HB.on ? 1 : 0;
  }
  if (d.name && !localStorage.getItem("bigrig.name")) localStorage.setItem("bigrig.name", d.name);
  if (d.trailer === null && truck.trl) {
    const t = truck.trl;
    t.coupled = false;
    truck.trl = null;
    const i = world.trailers.indexOf(t);
    if (i >= 0) world.trailers.splice(i, 1);
  } else if (d.trailer && d.trailer.type !== "player" && truck.trl) {
    const o = truck.trl,
      i = world.trailers.indexOf(o);
    const tr = makeTrailer(
      d.trailer.type,
      mulberry(5),
      Object.assign({}, d.trailer, { coupled: true }),
    );
    tr.art = trailerArt(tr.type, tr.col, tr.logo);
    truck.trl = tr;
    if (i >= 0) world.trailers[i] = tr;
  }
  if (d.pos) {
    if (posOK(d.pos.x, d.pos.y)) {
      truck.x = d.pos.x;
      truck.y = d.pos.y;
      truck.h = truck.th = d.pos.h || 0;
    } else {
      let best = null,
        bd = 1e18;
      for (const dp of world.depots) {
        const q = Math.hypot(dp.entrance.x - d.pos.x, dp.entrance.y - d.pos.y);
        if (q < bd && dp.bays.length) {
          bd = q;
          best = dp;
        }
      }
      const p = best && ftSpot(best);
      if (p) {
        truck.x = p.x;
        truck.y = p.y;
        truck.h = truck.th = p.h;
        career.posFallback = best.name;
      }
    }
  }
  if (truck.trl) {
    const f = fwd(truck.h);
    const k = kingpin(truck);
    truck.trl.th = truck.h;
    if (k) {
      truck.trl.x = k[0];
      truck.trl.y = k[1];
    }
  }
  cam.x = truck.x * PPM;
  cam.y = truck.y * PPM;
  career.hist = Array.isArray(d.hist) ? d.hist : [];
  if (Array.isArray(d.jobs)) career.jobs = d.jobs.map(jobDe).filter(Boolean);
  if (d.active) {
    const j = jobDe(d.active.job);
    if (j) {
      try {
        if (d.active.phase === "pickup") {
          career.jobs.unshift(j);
          acceptJob(j);
        } else {
          const bay = j.to.bays[d.active.bay] || j.to.bays[0];
          bay.assigned = true;
          j.taken = true;
          let tr = null;
          if (d.active.phase === "recouple" && d.active.trl) {
            const o = d.active.trl;
            tr = makeTrailer(
              o.type,
              mulberry(7),
              Object.assign({}, o, { coupled: false, target: true, job: j.id }),
            );
            world.trailers.push(tr);
            setRoute({ x: tr.x, y: tr.y, name: "Your cargo trailer" });
          } else if (truck.trl) {
            tr = truck.trl;
            tr.job = j.id;
            setRoute(j.to);
          }
          if (tr)
            career.active = {
              job: j,
              trailer: tr,
              pickBay: {},
              bay,
              phase: tr.coupled ? "deliver" : "recouple",
              t0: timeS - (d.active.el || 0),
              tc: timeS,
              dmg0: truck.damage,
            };
        }
      } catch (e) {
        console.warn("job restore", e);
      }
    }
  }
  return true;
}
function resetGame() {
  if (typeof ACC !== "undefined" && ACC.tok) {
    if (typeof toast === "function")
      toast("Signed in \u2022 your progress is safe in your account");
    return;
  }
  try {
    career.noSave = 1;
    localStorage.removeItem(saveKey());
    if (!world.v2poi) localStorage.removeItem(SAVE_KEY_OLD);
  } catch (e) {}
  location.reload();
}
// ---------- jobs
const R7 = mulberry((Date.now() % 1e9) | 0);
function pickupsFor(c) {
  if (c.ret) return (world.malls || []).filter((m) => m.bays && m.bays.length);
  if (c.dock) {
    const p = world.depots.filter((d) => d.code === "APT" && d.bays.length);
    if (p.length) return p;
  }
  const ds = world.depots.filter((d) => d.bays.length);
  const pref =
    c.trl === "cont"
      ? ds.filter((d) => /Docks|Harbour|Freight/.test(d.name))
      : c.trl === "tank"
        ? ds.filter((d) => /Quarry|Mine|Logistics|Harbour/.test(d.name))
        : c.trl === "fridge"
          ? ds.filter((d) => /Agri|Farm|Distribution|Air/.test(d.name))
          : ds;
  return pref.length ? pref : ds;
}
function dropsFor(c, from) {
  const D = world.depots.filter((d) => d !== from && d.bays.length && d.code !== "APT");
  if (c.dock || c.ret) return D;
  const M = (world.malls || []).filter((m) => m !== from && m.bays && m.bays.length);
  return c.trl === "flat" || c.trl === "tank"
    ? M.concat(D.filter((d) => !/Port|Harbour|Docks/.test(d.name)))
    : M.concat(D.filter((d, i) => i % 3 === 0));
}
// v32 job mix: early career = short local runs around the start depot; later a spread of local / regional / long haul (pays clearly more)
const JOB_LOCAL_KM = 3.2;
function jobHome() {
  const d = world.depots.find((d) => d.code === "HQ") || world.depots[0];
  return d.entrance;
}
function jobEarly() {
  return (career.done || 0) < 6 && levelOf(career.xp || 0) <= 3;
}
function jobPay(km, c, T_, kg, band) {
  const base = (240 + 175 * km) * c.mult * T_.payMult * (0.85 + kg / 60000);
  return Math.round((base * (band === "long" ? 1.35 + Math.min(0.4, km / 60) : 1)) / 10) * 10;
}
function makeJob(tierWanted, band) {
  const tier = Math.max(1, Math.min(TIERS.length, tierWanted));
  const cs = CARGOS.filter((c) => c.tier === tier && (band !== "local" || !c.dock));
  const c = cs[(R7() * cs.length) | 0];
  const T_ = tierInfo(tier);
  const H = jobHome();
  band = band || "med";
  for (let tries = 0; tries < 60; tries++) {
    let pk = pickupsFor(c);
    if (band === "local")
      pk = pk.filter(
        (d) => Math.hypot(d.entrance.x - H.x, d.entrance.y - H.y) < JOB_LOCAL_KM * 1000,
      );
    const from = pk[(R7() * pk.length) | 0];
    if (!from) return null;
    let dl = dropsFor(c, from);
    if (band === "local")
      dl = dl.filter(
        (d) => Math.hypot(d.entrance.x - H.x, d.entrance.y - H.y) < JOB_LOCAL_KM * 1000,
      );
    const to = dl[(R7() * dl.length) | 0];
    if (!to) continue;
    const km =
      (Math.hypot(to.entrance.x - from.entrance.x, to.entrance.y - from.entrance.y) * 1.3) / 1000;
    if (band === "local") {
      if (km < 0.6 || km > 4.5) continue;
    } else if (band === "long") {
      if (km < 7) continue;
    } else {
      if (
        km < 1.0 ||
        km > T_.maxKm ||
        (tier === 1 && km >= 7) ||
        (tier > 1 && km < (tier - 1) * 1.6)
      )
        continue;
    }
    const kg = Math.round((c.kg[0] + R7() * (c.kg[1] - c.kg[0])) / 100) * 100,
      TT = TRAILER_TYPES[c.trl];
    const pay = jobPay(km, c, T_, kg, band),
      xp = Math.round((55 + 38 * km) * c.mult * (0.8 + tier * 0.35) * (band === "long" ? 1.2 : 1));
    return {
      id: "J" + career.boardSeq++,
      cargo: c,
      tier,
      from,
      to,
      km,
      kg,
      weight: kg + TT.tare,
      trailerType: TT.name,
      pay,
      xp,
      mins: Math.round((km / 42) * 60 + 3),
      approx: true,
      fresh: true,
      band,
    };
  }
  return null;
}
// repeatable routes: every completed job is remembered and comes back on the board (Repeat tag, +/-8% pay)
function jobRef(o) {
  let i = world.depots.indexOf(o);
  if (i >= 0) return "d" + i;
  i = (world.malls || []).indexOf(o);
  return i >= 0 ? "m" + i : null;
}
function jobObj(r) {
  if (typeof r === "number") return null;
  if (!r) return null;
  const L = r[0] === "d" ? world.depots : world.malls;
  return (L && L[+r.slice(1)]) || null;
}
function makeRepeat() {
  const H = (career.hist || []).filter((h) => {
    const c = CARGOS.find((c) => c.id === h.c);
    return (
      c &&
      c.tier <= career.tier &&
      !career.jobs.some((j) => j.cargo.id === h.c && jobRef(j.from) === h.f && jobRef(j.to) === h.t)
    );
  });
  if (!H.length) return null;
  const h = H[(R7() * H.length) | 0],
    c = CARGOS.find((c) => c.id === h.c),
    from = jobObj(h.f),
    to = jobObj(h.t);
  if (!from || !to) return null;
  const T_ = tierInfo(c.tier);
  const km =
      (Math.hypot(to.entrance.x - from.entrance.x, to.entrance.y - from.entrance.y) * 1.3) / 1000,
    kg = Math.round((c.kg[0] + R7() * (c.kg[1] - c.kg[0])) / 100) * 100,
    TT = TRAILER_TYPES[c.trl];
  const pay = Math.round((jobPay(km, c, T_, kg, h.b) * (0.92 + R7() * 0.16)) / 10) * 10,
    xp = Math.round((55 + 38 * km) * c.mult * (0.8 + c.tier * 0.35) * (h.b === "long" ? 1.2 : 1));
  return {
    id: "J" + career.boardSeq++,
    cargo: c,
    tier: c.tier,
    from,
    to,
    km,
    kg,
    weight: kg + TT.tare,
    trailerType: TT.name,
    pay,
    xp,
    mins: Math.round((km / 42) * 60 + 3),
    approx: true,
    fresh: true,
    band: h.b || "med",
    repeat: h.n || 1,
  };
}
function fillBoard() {
  const want = 10 + 3 * (career.tier - 1);
  career.jobs = career.jobs.filter((j) => !j.taken);
  if (typeof portBoardJobs === "function" && !career.jobs.some((j) => j.portBoard)) {
    const ear = jobEarly();
    let n = 0;
    for (const j of portBoardJobs()) {
      if (
        n >= 2 ||
        (ear &&
          (j.km > 4.5 ||
            Math.hypot(j.from.entrance.x - jobHome().x, j.from.entrance.y - jobHome().y) >
              JOB_LOCAL_KM * 1000))
      )
        continue;
      if (!ear && j.km >= 7) {
        j.band = "long";
        j.pay = Math.round((j.pay * 1.35) / 10) * 10;
      }
      career.jobs.push(j);
      n++;
    }
  }
  const top = Math.min(TIERS.length, career.tier + 1);
  const early = jobEarly(),
    cnt = (b) => career.jobs.filter((j) => j.band === b).length;
  let guard = 0;
  if (!early && (career.hist || []).length)
    for (
      let k = 0;
      k < 2 && career.jobs.filter((j) => j.repeat).length < 2 && career.jobs.length < want;
      k++
    ) {
      const j = makeRepeat();
      if (j) career.jobs.push(j);
    }
  while (career.jobs.length < want && guard++ < 40) {
    const nLocked = career.jobs.filter((j) => j.tier > career.tier).length;
    let t;
    if (career.tier < TIERS.length && nLocked < 2 && !early) t = top;
    else t = 1 + ((R7() * career.tier) | 0);
    const band = early ? "local" : cnt("local") < 2 ? "local" : cnt("long") < 3 ? "long" : "med";
    const j = makeJob(t, band) || (band !== "med" ? makeJob(t, "med") : null);
    if (j) career.jobs.push(j);
  }
  // v41: every unlocked tier >=2 always shows several of its own jobs (longer, better paid), plus a couple of next-tier teasers
  if (!early)
    for (let t = 2; t <= Math.min(TIERS.length, career.tier + 1); t++) {
      const need = t <= career.tier ? 4 : 2;
      let g2 = 0;
      while (career.jobs.filter((j) => j.tier === t).length < need && g2++ < 30) {
        const j = makeJob(t, R7() < 0.55 ? "long" : "med") || makeJob(t, "med");
        if (j) career.jobs.push(j);
      }
    }
  if (early && (career.hist || []).length) {
    const j = makeRepeat();
    if (
      j &&
      Math.hypot(j.from.entrance.x - jobHome().x, j.from.entrance.y - jobHome().y) <
        JOB_LOCAL_KM * 1000
    ) {
      career.jobs.push(j);
    }
  }
}
function refreshBoard(keep) {
  if (!keep) career.jobs = [];
  fillBoard();
  if (career.uiOpen === "board") renderBoard();
}
function jobRoute(j) {
  if (j.path !== undefined) return j.path;
  const a = navSnap(j.from.entrance.x / M_T, j.from.entrance.y / M_T, 70),
    b = navSnap(j.to.entrance.x / M_T, j.to.entrance.y / M_T, 70);
  const p = a && b ? navAStar(a[0], a[1], b[0], b[1]) : null;
  j.path = p;
  if (p) {
    let L = 0;
    for (let k = 1; k < p.length; k++) {
      const i0 = p[k - 1],
        i1 = p[k];
      L += Math.hypot((i1 % MW) - (i0 % MW), ((i1 / MW) | 0) - ((i0 / MW) | 0)) * M_T;
    }
    const km = L / 1000,
      c = j.cargo,
      T_ = tierInfo(j.tier);
    j.km = km;
    j.pay = Math.round(((240 + 175 * km) * c.mult * T_.payMult * (0.85 + j.kg / 60000)) / 10) * 10;
    j.xp = Math.round((55 + 38 * km) * c.mult * (0.8 + j.tier * 0.35));
    j.mins = Math.round((km / 42) * 60 + 3);
    j.approx = false;
  }
  return p;
}
function acceptJob(j) {
  if (j.tier > career.tier) return false;
  if (career.active) abandonJob(true);
  const dp = j.from,
    BAYS = j.pickBays || dp.bays;
  let bay = BAYS.find((b) => !b.trailer && !b.target);
  if (!bay) {
    bay = BAYS[(R7() * BAYS.length) | 0];
    const old = bay.trailer;
    if (old) {
      const i = world.trailers.indexOf(old);
      if (i >= 0) world.trailers.splice(i, 1);
      bay.trailer = null;
    }
  }
  const c = j.cargo,
    tr = makeTrailer(c.trl, R7, {
      cargo: c.name,
      cargoKg: j.kg,
      weight: j.weight,
      reqLevel: j.tier,
      target: true,
      job: j.id,
    });
  tr.local = true; // MP: job trailers are per-player, never shared
  tr.x = bay.kx;
  tr.y = bay.ky;
  tr.th = bay.th;
  tr.bay = bay;
  tr.depot = dp;
  bay.trailer = tr;
  bay.target = true;
  world.trailers.push(tr);
  const free = j.to.bays.filter((b) => !b.assigned && !b.parked && !b.trailer);
  const mb = (free.length ? free : j.to.bays)[(R7() * (free.length || j.to.bays.length)) | 0];
  mb.assigned = true;
  career.active = {
    job: j,
    trailer: tr,
    pickBay: bay,
    bay: mb,
    phase: "pickup",
    t0: timeS,
    dmg0: truck.damage,
  };
  j.taken = true;
  setRoute(dp);
  BigRig.emit("jobAccepted", { job: j });
  flash("Job accepted: " + c.name + " \u2192 " + j.to.name + " \u2022 sat nav set to " + dp.name);
  saveGame();
  return true;
}
function abandonJob(silent) {
  const a = career.active;
  if (!a) return;
  a.bay.assigned = false;
  if (a.pickBay) a.pickBay.target = false;
  a.trailer.target = false;
  a.trailer.job = null;
  career.active = null;
  clearRoute();
  if (!silent) flash("Job abandoned");
}
BigRig.on("couple", (e) => {
  const a = career.active;
  if (!a || e.trailer !== a.trailer) return;
  a.pickBay.target = false;
  a.trailer.target = false;
  a.phase = "deliver";
  a.dmg0 = truck.damage;
  if (!a.tc) a.tc = timeS;
  setRoute(jobBayTarget(a));
  flash("Cargo coupled \u2714 Deliver to " + a.job.to.name + " \u2022 bay " + a.bay.id);
});
BigRig.on("uncouple", (e) => {
  const a = career.active;
  if (!a || e.trailer !== a.trailer || a.phase !== "deliver") return;
  a.phase = "recouple";
  a.trailer.target = true;
  setRoute({ x: a.trailer.x, y: a.trailer.y, name: "Your cargo trailer" });
});
BigRig.on("couple", (e) => {
  const a = career.active;
  if (a && a.phase === "recouple" && e.trailer === a.trailer) {
    a.trailer.target = false;
    a.phase = "deliver";
    setRoute(jobBayTarget(a));
  }
});
function jobBayTarget(a) {
  const b = a.bay,
    e = a.job.to.entrance;
  return b && b.cx != null
    ? {
        x: b.cx,
        y: b.cy,
        name: a.job.to.name + " \u2022 bay " + b.id,
        ref: { entrance: e, name: a.job.to.name },
      }
    : a.job.to;
}
// ---------- bay alignment
function bayAlign(b) {
  const s = truck;
  if (!s.trl) return null;
  const k = kingpin(s),
    ft = fwd(s.th);
  const box = {
    x: k[0] - ft[0] * TRL_KP_TO_CENTRE,
    y: k[1] - ft[1] * TRL_KP_TO_CENTRE,
    h: s.th,
    L: TRL_LEN,
    W: TRL_W,
  };
  const cs = obbCorners(box),
    m = 0.06;
  let inside = true,
    worst = 0;
  for (const p of cs) {
    const ox = Math.max(b.x0 + m - p[0], p[0] - (b.x1 - m), 0),
      oy = Math.max(b.y0 - p[1], p[1] - (b.y1 + 0.05), 0);
    if (ox > 0 || oy > 0) {
      inside = false;
      worst = Math.max(worst, ox, oy);
    }
  }
  const ang = wrapA(s.th - b.th),
    rear = [k[0] - ft[0] * 12.4, k[1] - ft[1] * 12.4],
    gap = b.dock - rear[1],
    lat = box.x - b.cx;
  const angOk = Math.abs(ang) < 0.09,
    gapOk = gap < 1.8 && gap > -0.3,
    stopped = Math.abs(s.v) < 0.15;
  return {
    inside,
    ang,
    gap,
    lat,
    angOk,
    gapOk,
    stopped,
    ok: inside && angOk && gapOk,
    ready: inside && angOk && gapOk && stopped,
    box,
    dist: Math.hypot(box.x - b.cx, box.y - b.cy),
    worst,
  };
}
function tryUnload() {
  const a = career.active;
  if (!a || a.phase !== "deliver") {
    flash("No delivery to unload");
    return false;
  }
  const al = bayAlign(a.bay);
  if (!al || al.dist > 60) {
    flash("Reverse into bay " + a.bay.id + " at " + a.job.to.name);
    return false;
  }
  if (!al.ok) {
    flash("Not within the bay lines \u2014 straighten up and reverse to the dock");
    return false;
  }
  if (!al.stopped) {
    flash("Stop the truck to unload");
    return false;
  }
  a.phase = "unloading";
  a.ut = 0;
  a.udur = 6;
  a.bay.doorT = 1;
  clunk(0.4);
  BigRig.emit("unloadStart", { job: a.job });
  return true;
}
function finishJob() {
  const a = career.active,
    j = a.job;
  const dmg = Math.max(0, truck.damage - a.dmg0),
    took = (timeS - (a.tc || a.t0)) / 60;
  const base = j.pay,
    lines = [
      [
        "Delivery fee (" +
          j.km.toFixed(1) +
          " km \u00d7 " +
          j.cargo.name +
          " \u00d7 tier " +
          j.tier +
          ")",
        base,
      ],
    ];
  if (dmg < 0.5) lines.push(["No-damage bonus (+12%)", Math.round(base * 0.12)]);
  else
    lines.push([
      "Damage penalty (" + dmg.toFixed(0) + "%)",
      -Math.round(base * Math.min(0.6, dmg * 0.03)),
    ]);
  if (took <= j.mins * 1.15) lines.push(["On-time bonus (+10%)", Math.round(base * 0.1)]);
  const total = lines.reduce((s, l) => s + l[1], 0),
    xp = j.xp + (dmg < 0.5 ? Math.round(j.xp * 0.15) : 0);
  truck.money += total;
  career.done++;
  {
    const H = (career.hist = career.hist || []),
      f = jobRef(j.from),
      tt = jobRef(j.to),
      o = H.find((h) => h.c === j.cargo.id && h.f === f && h.t === tt);
    if (o) o.n = (o.n || 1) + 1;
    else if (f && tt) {
      H.push({ c: j.cargo.id, f, t: tt, b: j.band || "med", n: 1 });
      if (H.length > 40) H.shift();
    }
  }
  career.earned += total;
  a.bay.assigned = false;
  a.bay.doorT = 0;
  const tr = a.trailer;
  tr.cargo = "Empty";
  tr.cargoKg = 0;
  tr.weight = tr.tareKg;
  tr.job = null;
  career.active = null;
  career.jobs = career.jobs.filter((x) => x !== j);
  fillBoard();
  clearRoute();
  BigRig.emit("jobComplete", { job: j, total, xp, lines });
  const res = { job: j, total, xp, lines, tierBefore: career.tier };
  if (typeof bigmap !== "undefined" && bigmap.open) closeMap();
  showResult(res, a.bay);
  addXP(xp);
  saveGame();
}
function updateCareer(dt) {
  const a = career.active;
  for (const m of world.malls)
    for (const b of m.bays) {
      const t = b.doorT ? 1 : 0;
      b.door += (t - b.door) * Math.min(1, dt * 1.6);
    }
  if (a && a.phase === "unloading") {
    if (Math.abs(truck.v) > 0.2 || !truck.trl) {
      a.phase = "deliver";
      a.bay.doorT = 0;
      flash("Unloading interrupted \u2014 the truck moved");
    } else {
      a.ut += dt;
      if (a.ut >= a.udur) finishJob();
    }
  }
  // inside the destination site: the sat nav has done its job
  if (a && NAV.route) {
    const site = a.phase === "deliver" ? a.job.to : a.phase === "pickup" ? a.job.from : null;
    if (site) {
      const x0 = (site.tx !== undefined ? site.tx : site.x) * M_T,
        y0 = (site.ty !== undefined ? site.ty : site.y) * M_T;
      if (
        truck.x > x0 &&
        truck.x < x0 + site.w * M_T &&
        truck.y > y0 - 6 &&
        truck.y < y0 + site.h * M_T &&
        !a.arrFlash
      ) {
        a.arrFlash = a.phase;
        flash(
          a.phase === "deliver"
            ? "Arrived \u2014 reverse into bay " + a.bay.id
            : "Arrived \u2014 couple the marked trailer",
        );
      }
    }
  }
  // dealership trigger
  const s = truck,
    f = fwd(s.h),
    cx = s.x + f[0] * 1.9,
    cy = s.y + f[1] * 1.9;
  let inPad = null;
  for (const d of world.dealers || []) {
    const p = d.pad;
    if (cx > p.x0 && cx < p.x1 && cy > p.y0 && cy < p.y1) inPad = d;
  }
  if (inPad && Math.abs(s.v) < 0.2 && !career.padLatch && !career.uiOpen) {
    career.padLatch = true;
    openDealer(inPad);
  }
  if (!inPad) career.padLatch = false;
  // depot: stopping inside a yard with no job opens the board once
  let inDepot = null;
  for (const d of world.depots) {
    const x0 = d.x * M_T,
      y0 = d.y * M_T;
    if (s.x > x0 && s.x < x0 + d.w * M_T && s.y > y0 && s.y < y0 + d.h * M_T) inDepot = d;
  }
  if (
    inDepot &&
    !(typeof FX !== "undefined" && FX.boom) &&
    !career.active &&
    Math.abs(s.v) < 0.1 &&
    !career.depotLatch &&
    !career.uiOpen &&
    started &&
    timeS > 3
  ) {
    career.depotT = (career.depotT || 0) + dt;
    if (career.depotT > 1.2) {
      career.depotLatch = true;
      openBoard();
    }
  } else career.depotT = 0;
  if (!inDepot) career.depotLatch = false;
  if (timeS - career.lastSave > 10 && started && !career.noSave) saveGame();
}
// ---------- world-space drawing (bay highlight, ghost, dock doors)
function drawCareerWorld(vx0, vy0, vx1, vy1) {
  const a = career.active;
  for (const m of world.malls || []) {
    if (
      m.x * PPM < vx0 - 600 ||
      m.x * PPM > vx1 + 600 ||
      m.y * PPM < vy0 - 600 ||
      m.y * PPM > vy1 + 600
    )
      continue;
    for (const b of m.bays) {
      const X0 = b.x0 * PPM,
        X1 = b.x1 * PPM,
        Y = b.dock * PPM;
      ctx.fillStyle = "#14161a";
      ctx.fillRect(X0 + 3, Y, X1 - X0 - 6, 10);
      const h = 10 * (1 - b.door);
      ctx.fillStyle = "#9aa3ad";
      ctx.fillRect(X0 + 3, Y, X1 - X0 - 6, h);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (let k = 2; k < h; k += 3) ctx.fillRect(X0 + 3, Y + k, X1 - X0 - 6, 1);
      ctx.fillStyle = b.door > 0.5 ? "#3ddc84" : "#e74c3c";
      ctx.beginPath();
      ctx.arc(X1 - 6, Y + 16, 3, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.fillRect(X0 + 3, Y - 2, X1 - X0 - 6, 3);
    }
  }
  if (a && (a.phase === "deliver" || a.phase === "unloading")) {
    const b = a.bay,
      al = bayAlign(b);
    const ok = al && al.ok,
      p = 0.55 + 0.4 * Math.sin(timeS * 5);
    ctx.save();
    ctx.strokeStyle = ok ? "rgba(60,230,110,0.95)" : `rgba(255,214,0,${p})`;
    ctx.lineWidth = 5;
    ctx.strokeRect(
      b.x0 * PPM - 3,
      b.y0 * PPM - 3,
      (b.x1 - b.x0) * PPM + 6,
      (b.y1 - b.y0) * PPM + 6,
    );
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.strokeRect(
      (b.cx - TRL_W / 2) * PPM,
      (b.dock - 0.3 - TRL_LEN) * PPM,
      TRL_W * PPM,
      TRL_LEN * PPM,
    );
    ctx.setLineDash([]);
    if (al && al.dist < 40) {
      const bx = al.box;
      ctx.translate(bx.x * PPM, bx.y * PPM);
      ctx.rotate(bx.h);
      ctx.strokeStyle = ok ? "rgba(60,230,110,1)" : "rgba(255,70,60,0.95)";
      ctx.lineWidth = 3;
      ctx.strokeRect((-TRL_W / 2) * PPM, (-TRL_LEN / 2) * PPM, TRL_W * PPM, TRL_LEN * PPM);
    }
    ctx.restore();
    if (al && al.dist > 40) {
      ctx.fillStyle = "rgba(255,214,0,0.95)";
      ctx.font = "bold 26px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("\u25BC BAY " + b.id, b.cx * PPM, b.y0 * PPM - 14);
    }
  }
  if (a && a.phase !== "deliver" && a.phase !== "unloading" && a.trailer && !a.trailer.coupled) {
    const t = a.trailer,
      bo = Math.sin(timeS * 4) * 6,
      p = 0.5 + 0.4 * Math.sin(timeS * 5);
    const th = t.th || 0,
      tcx = t.x - Math.sin(th) * TRL_KP_TO_CENTRE,
      tcy = t.y + Math.cos(th) * TRL_KP_TO_CENTRE;
    ctx.save();
    ctx.translate(tcx * PPM, tcy * PPM);
    ctx.rotate(th);
    ctx.strokeStyle = `rgba(255,214,0,${p})`;
    ctx.lineWidth = 5;
    ctx.strokeRect(
      (-TRL_W / 2) * PPM - 6,
      (-TRL_LEN / 2) * PPM - 6,
      TRL_W * PPM + 12,
      TRL_LEN * PPM + 12,
    );
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "bold 22px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("\u25BC YOUR LOAD", tcx * PPM + 2, tcy * PPM - (TRL_LEN * PPM) / 2 - 14 + bo + 2);
    ctx.fillStyle = "rgba(255,214,0,0.98)";
    ctx.fillText("\u25BC YOUR LOAD", tcx * PPM, tcy * PPM - (TRL_LEN * PPM) / 2 - 14 + bo);
  }
  drawForecourtCars(vx0, vy0, vx1, vy1);
}
// ---------- v9 mission tracker (HUD): numbered steps, current step highlighted, distance remaining
function clip(t, n) {
  return t.length > n ? t.slice(0, n - 1) + "\u2026" : t;
}
function missionRemain(a) {
  const tgt =
    a.phase === "pickup" || a.phase === "recouple"
      ? a.trailer
      : a.bay
        ? { x: a.bay.cx, y: a.bay.dock - 8 }
        : a.job.to.entrance;
  if (NAV.route && NAV.route.cum) return Math.max(0, NAV.route.len - NAV.route.cum[NAV.route.idx]);
  return Math.hypot(truck.x - tgt.x, truck.y - tgt.y);
}
function drawTracker(a, x, y) {
  const j = a.job,
    w = 236,
    h = 128;
  career.trkH = h;
  const step = a.phase === "pickup" || a.phase === "recouple" ? 1 : 2;
  ctx.fillStyle = "rgba(8,12,20,0.8)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = "rgba(245,184,46,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.font = '18px "Noto Color Emoji",system-ui';
  ctx.fillText(j.cargo.icon, x + 8, y + 22);
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold 10px system-ui,sans-serif";
  ctx.fillText("MISSION", x + 34, y + 12);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px system-ui,sans-serif";
  ctx.fillText(clip(j.cargo.name, 22), x + 34, y + 25);
  ctx.textAlign = "right";
  ctx.fillStyle = "#7dff9a";
  ctx.font = "bold 12px system-ui,sans-serif";
  ctx.fillText(money(j.pay), x + w - 8, y + 14);
  ctx.fillStyle = "#ffd866";
  ctx.font = "bold 10px system-ui,sans-serif";
  ctx.fillText("+" + j.xp + " XP", x + w - 8, y + 26);
  const rows = [
    [
      1,
      "Drive to " + j.from.name,
      a.phase === "recouple" ? "Re-couple your trailer (T)" : "Couple the marked trailer (T)",
    ],
    [
      2,
      "Deliver to " + j.to.name,
      a.phase === "unloading"
        ? "Unloading\u2026 keep still"
        : "Reverse into bay " + a.bay.id + ", then Unload (U)",
    ],
  ];
  rows.forEach(([n, t1, t2], i) => {
    const yy = y + 36 + i * 34,
      cur = n === step,
      done = n < step;
    ctx.fillStyle = done ? "#3ddc84" : cur ? "#f5b82e" : "#3a414c";
    ctx.beginPath();
    ctx.arc(x + 18, yy + 11, 9, 0, 7);
    ctx.fill();
    ctx.fillStyle = done || cur ? "#0b1016" : "#aab";
    ctx.font = "bold 11px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(done ? "\u2714" : String(n), x + 18, yy + 15);
    ctx.textAlign = "left";
    ctx.fillStyle = cur ? "#fff" : done ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.6)";
    ctx.font = (cur ? "bold " : "") + "11.5px system-ui,sans-serif";
    ctx.fillText(clip(t1, 31), x + 34, yy + 9);
    ctx.fillStyle = cur ? "#ffd23f" : "rgba(255,255,255,0.4)";
    ctx.font = "10.5px system-ui,sans-serif";
    ctx.fillText(clip(t2, 36), x + 34, yy + 22);
  });
  const d = missionRemain(a);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x + 8, y + h - 22, w - 16, 1);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    "\u{1F4CD} " +
      (d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d) + " m") +
      " to " +
      (step === 1 ? "pickup" : "bay " + a.bay.id),
    x + 10,
    y + h - 8,
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "10px system-ui,sans-serif";
  ctx.fillText("Step " + step + "/2", x + w - 10, y + h - 8);
}
function padHudPos() {
  const hb = document.getElementById("hudbtns");
  if (!hb) return;
  const top = (career.active ? 140 + (career.trkH || 0) + 8 : 206) + "px";
  if (hb.style.top !== top) hb.style.top = top;
  const ab = document.getElementById("bAbandon");
  if (ab) {
    const on = !!career.active;
    if ((ab.style.display !== "none") !== on) ab.style.display = on ? "" : "none";
  }
}
// ---------- HUD (canvas)
function drawCareerHUD() {
  career.unloadBtn = null;
  const lv = levelOf(career.xp),
    a0 = levelNeed(lv),
    a1 = levelNeed(lv + 1),
    T_ = tierInfo(career.tier),
    x = 14,
    y = 94,
    w = 190;
  ctx.save();
  ctx.fillStyle = "rgba(8,12,20,0.72)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 40, 8);
  ctx.fill();
  ctx.fillStyle = T_.color;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 7, 40, 16, 8);
  ctx.fill();
  ctx.fillStyle = "#08110a";
  ctx.font = "bold 10px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TIER " + career.tier, x + 28, y + 18.5);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.font = "bold 12px system-ui,sans-serif";
  ctx.fillText("Lv " + lv, x + 54, y + 19);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "11px system-ui,sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(career.xp - a0 + " / " + (a1 - a0) + " XP", x + w - 8, y + 19);
  const fr = Math.max(0, Math.min(1, (career.xp - a0) / (a1 - a0)));
  ctx.fillStyle = "#222a36";
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 27, w - 16, 7, 4);
  ctx.fill();
  const gg = ctx.createLinearGradient(x + 8, 0, x + w - 8, 0);
  gg.addColorStop(0, "#f5b82e");
  gg.addColorStop(1, "#ffdf7a");
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 27, Math.max(7, (w - 16) * fr), 7, 4);
  ctx.fill();
  if (career.xpFx && timeS - career.xpFx.t < 2.2) {
    const k = (timeS - career.xpFx.t) / 2.2;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = "#ffdf7a";
    ctx.font = "bold 16px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("+" + career.xpFx.n + " XP", x + w + 8, y + 26 - k * 20);
    ctx.globalAlpha = 1;
  }
  const a = career.active;
  if (a) drawTracker(a, x, y + 46);
  else career.trkH = 0;
  padHudPos();
  ctx.restore();
  if (a && (a.phase === "deliver" || a.phase === "unloading")) {
    const al = bayAlign(a.bay);
    if (al && al.dist < 70) drawAlignPanel(a, al);
  }
}
function drawAlignPanel(a, al) {
  const unl = a.phase === "unloading",
    ready = al.ready && !unl;
  career.unloadBtn = null;
  if (unl) {
    const p = Math.min(1, a.ut / a.udur),
      W = 220,
      x = VW / 2 - W / 2,
      y = VH * 0.3;
    ctx.save();
    ctx.fillStyle = "rgba(8,12,20,0.78)";
    ctx.beginPath();
    ctx.roundRect(x, y, W, 40, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("UNLOADING\u2026", VW / 2, y + 17);
    ctx.fillStyle = "#222a36";
    ctx.fillRect(x + 14, y + 25, W - 28, 7);
    ctx.fillStyle = "#2f81f7";
    ctx.fillRect(x + 14, y + 25, (W - 28) * p, 7);
    ctx.restore();
    return;
  }
  if (!ready) return;
  const padOn = typeof pad !== "undefined" && pad.active,
    W = 240,
    H = 64,
    x = VW / 2 - W / 2,
    y = VH * 0.28,
    pulse = 0.5 + 0.5 * Math.sin(timeS * 5);
  ctx.save();
  ctx.shadowColor = "rgba(46,160,67,0.8)";
  ctx.shadowBlur = 14 + pulse * 12;
  ctx.fillStyle = "#2ea043";
  ctx.beginPath();
  ctx.roundRect(x, y, W, H, 16);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "900 24px system-ui,sans-serif";
  ctx.fillText("\u{1F4E6} UNLOAD", VW / 2, y + 33);
  ctx.font = "bold 12px system-ui,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const touch = document.body.classList.contains("touch");
  ctx.fillText(
    touch ? "tap here" : padOn ? "press \u24CE (Y)" : "press U \u2022 or click",
    VW / 2,
    y + 52,
  );
  ctx.restore();
  career.unloadBtn = [x, y, W, H];
}
// world: the target bay outline goes green when lined up, amber otherwise (minimal feedback, no numbers)
function drawJobBay() {
  const a = career.active;
  if (!a || !(a.phase === "deliver" || a.phase === "unloading") || !a.bay) return;
  const b = a.bay;
  if (b.x0 == null) return;
  const al = bayAlign(b);
  if (!al || al.dist > 70) return;
  const S = PPM,
    col = a.phase === "unloading" || al.ready ? "#2ee66b" : al.ok ? "#7be36a" : "#f5b82e",
    p = 0.6 + 0.4 * Math.sin(timeS * 4);
  ctx.save();
  ctx.globalAlpha = 0.35 * p;
  ctx.fillStyle = col;
  ctx.fillRect(b.x0 * S, b.y0 * S, (b.x1 - b.x0) * S, (b.y1 - b.y0) * S);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.setLineDash(al.ok ? [] : [10, 7]);
  ctx.strokeRect(b.x0 * S, b.y0 * S, (b.x1 - b.x0) * S, (b.y1 - b.y0) * S);
  ctx.restore();
}
setTimeout(() => {
  if (typeof drawPortTrucksLow === "function") {
    const d = drawPortTrucksLow;
    drawPortTrucksLow = function () {
      const r = d.apply(this, arguments);
      try {
        drawJobBay();
      } catch (e) {}
      return r;
    };
  }
}, 0);

addEventListener("visibilitychange", () => {
  if (document.hidden && started && !career.noSave) saveGame();
});
addEventListener("beforeunload", () => {
  if (started && !career.noSave) saveGame();
});

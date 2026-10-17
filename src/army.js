/**
 * @file army.js — ARMY LOGISTICS (tier 3): military trailer art (helicopter with folded rotors, jeeps on a flatbed, wide
 *   tank low-loader, green military oil tanker, green ARMY containers, missile trailer with a huge warhead) and the Army
 *   Logistics board: export runs from the Army Logistics Depot (ALD) on Sandvale Military Base to the docks, harbour and
 *   airport. Jobs are normal career jobs (acceptJob / delivery / results / save) with cargos flagged `army`.
 * Exposes (globals): AL, AL_TRL, AL_CARGOS, alTrailerCanvas, alSVG, alJobs, alOpenBoard (+ al* helpers)
 * Depends on: milbase.js (mbTrailerCanvas, MB_TRL, mbRR), depots.js (TRAILER_TYPES, trailerArt), traffic.js (vCanvas, VS),
 *   render.js (shade), career.js (CARGOS, TIERS, tierInfo, jobPay, acceptJob), ui.js (openModal, trlSVG, startMission, esc)
 * Load order: after bm.js in build.py (wraps mbTrailerCanvas, trlSVG, openBoard). Map data is unchanged: generation still
 *   parks only the original military trailer kinds; the new kinds appear on Army Logistics jobs.
 */
// ---------------------------------------------------------------- trailer types
const AL_TRL = { heli: 1, jeeps: 1, oilmil: 1, missile: 1 };
Object.assign(TRAILER_TYPES, {
  heli: {
    name: "Helicopter flatbed",
    tare: 9000,
    level: 3,
    cargos: [["Merlin helicopter (rotors folded)", 14000]],
    cols: ["#45493c"],
  },
  jeeps: {
    name: "Vehicle flatbed",
    tare: 7500,
    level: 3,
    cargos: [["3 x armoured patrol jeeps", 21000]],
    cols: ["#45493c"],
  },
  oilmil: {
    name: "Military fuel tanker",
    tare: 7800,
    level: 3,
    cargos: [["Military diesel (F-54)", 26000]],
    cols: ["#4f5d36"],
  },
  missile: {
    name: "Missile trailer",
    tare: 11000,
    level: 3,
    cargos: [["Missile + warhead", 30000]],
    cols: ["#3a3d33"],
  },
});
for (const k in AL_TRL) MB_TRL[k] = 1;
// ---------------------------------------------------------------- top-down art (13.6 m trailers, front = top of canvas)
const AL_ART = {};
function alTrailerCanvas(kind) {
  if (AL_ART[kind]) return AL_ART[kind];
  const L = 13.6,
    hw = 1.275,
    WC = kind === "lowtank" ? 3.9 : 2.55,
    c = vCanvas(L, WC),
    g = c.getContext("2d"),
    cx = c.width / 2,
    X = (m) => cx + m * VS,
    Y = (m) => 0.15 * VS + m * VS;
  const box = (x0, y0, x1, y1, f, r) => {
    g.fillStyle = f;
    g.beginPath();
    mbRR(g, X(x0), Y(y0), (x1 - x0) * VS, (y1 - y0) * VS, (r || 0.1) * VS);
    g.fill();
  };
  const line = (x0, y0, x1, y1, col, w) => {
    g.strokeStyle = col;
    g.lineWidth = w * VS;
    g.beginPath();
    g.moveTo(X(x0), Y(y0));
    g.lineTo(X(x1), Y(y1));
    g.stroke();
  };
  const text = (s, x, y, size, col) => {
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(-Math.PI / 2);
    g.fillStyle = col;
    g.font = "bold " + size * VS + "px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(s, 0, 0);
    g.restore();
  };
  // wheels (three axles) under every trailer
  g.fillStyle = "#1b1b1b";
  for (const a of [10.2, 11.5, 12.8]) {
    g.fillRect(X(-hw - 0.05), Y(a - 0.45), 0.35 * VS, 0.9 * VS);
    g.fillRect(X(hw - 0.3), Y(a - 0.45), 0.35 * VS, 0.9 * VS);
  }
  const deck = () => {
    box(-hw, 0, hw, L, "#45493c");
    g.strokeStyle = "rgba(0,0,0,0.3)";
    g.lineWidth = 1;
    for (let y = 0.6; y < L; y += 0.6) line(-hw, y, hw, y, "rgba(0,0,0,0.18)", 0.03);
    g.strokeStyle = "#ffd23f";
    g.lineWidth = 2;
    g.strokeRect(X(-hw + 0.08), Y(0.08), (2 * hw - 0.16) * VS, (L - 0.16) * VS);
  };
  if (kind === "heli") {
    deck();
    // fuselage, cockpit glass, engine housing
    g.fillStyle = "#5d6b45";
    g.beginPath();
    g.ellipse(X(0), Y(4.3), 1.15 * VS, 3.6 * VS, 0, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.beginPath();
    g.ellipse(X(-0.35), Y(4.3), 0.4 * VS, 3.0 * VS, 0, 0, 7);
    g.fill();
    g.fillStyle = "#1e2a34";
    g.beginPath();
    g.ellipse(X(0), Y(1.4), 0.85 * VS, 0.75 * VS, 0, 0, 7);
    g.fill();
    box(-0.55, 3.2, 0.55, 6.2, "#4b5737", 0.25);
    // tail boom, tailplane, fin
    box(-0.3, 7.4, 0.3, 12.9, "#56633f", 0.2);
    box(-1.15, 12.0, 1.15, 12.5, "#4b5737", 0.15);
    box(-0.08, 12.4, 0.5, 13.3, "#3f4a2e", 0.1);
    // five main blades folded back along the boom, tied down on the tail cradle
    for (const o of [-0.62, -0.32, 0, 0.32, 0.62]) line(o * 0.25, 4.4, o, 12.7, "#24271f", 0.2);
    g.fillStyle = "#24271f";
    g.beginPath();
    g.arc(X(0), Y(4.4), 0.32 * VS, 0, 7);
    g.fill();
    box(-1.0, 11.0, 1.0, 11.3, "#8a8f7a", 0.05); // blade cradle
    for (const y of [2.6, 6.8]) line(-hw, y, hw, y, "rgba(255,210,63,0.7)", 0.06); // straps
  } else if (kind === "jeeps") {
    deck();
    for (const y0 of [0.35, 4.85, 9.35]) {
      box(-1.0, y0, 1.0, y0 + 4.1, "#2a2d24", 0.35); // shadowed outline
      box(-0.95, y0 + 0.05, 0.95, y0 + 4.05, "#5b6a3c", 0.35);
      box(-0.85, y0 + 0.15, 0.85, y0 + 1.2, "#4e5c33", 0.2); // bonnet
      box(-0.82, y0 + 1.2, 0.82, y0 + 1.6, "#1e2a34", 0.08); // windscreen
      box(-0.85, y0 + 1.7, 0.85, y0 + 3.7, "#66764a", 0.2); // roof
      g.fillStyle = "#3a4428";
      g.beginPath();
      g.arc(X(0), Y(y0 + 2.6), 0.32 * VS, 0, 7); // roof hatch
      g.fill();
      g.fillStyle = "#1b1b1b";
      g.beginPath();
      g.arc(X(0), Y(y0 + 3.95), 0.36 * VS, 0, 7); // spare wheel
      g.fill();
      for (const y of [y0 + 0.3, y0 + 3.8]) line(-hw, y, hw, y, "rgba(255,210,63,0.75)", 0.05);
    }
  } else if (kind === "lowtank") {
    // wide main battle tank overhanging a low-loader (trailer deck is the normal 2.55 m)
    box(-hw, 0, hw, L, "#4a4c44");
    g.strokeStyle = "#ffd23f";
    g.lineWidth = 2;
    g.strokeRect(X(-hw + 0.1), Y(0.1), (2 * hw - 0.2) * VS, (L - 0.2) * VS);
    for (const s of [-1, 1]) {
      box(s > 0 ? 1.25 : -1.8, 1.0, s > 0 ? 1.8 : -1.25, 11.6, "#26261f", 0.15);
      for (let y = 1.2; y < 11.5; y += 0.35)
        line(s * 1.27, y, s * 1.78, y, "rgba(120,120,100,0.45)", 0.05);
    }
    box(-1.5, 0.8, 1.5, 11.8, "#5f6a40", 0.3); // hull
    box(-1.3, 9.0, 1.3, 11.5, "#535d37", 0.2); // engine deck
    for (let y = 9.3; y < 11.3; y += 0.3) line(-1.1, y, 1.1, y, "rgba(0,0,0,0.3)", 0.05);
    g.fillStyle = "#2a2d1e";
    g.beginPath();
    g.ellipse(X(0), Y(6.0), 1.45 * VS, 1.75 * VS, 0, 0, 7);
    g.fill();
    g.fillStyle = "#4e5734";
    g.beginPath();
    g.ellipse(X(0), Y(6.0), 1.35 * VS, 1.65 * VS, 0, 0, 7); // turret
    g.fill();
    box(-0.14, 0.0, 0.14, 4.5, "#3c4428", 0.08); // barrel (turret forward, over the gooseneck)
    box(-0.22, 0.0, 0.22, 0.7, "#343b23", 0.08); // muzzle
    for (const [x, y] of [
      [-0.55, 6.5],
      [0.6, 6.8],
    ]) {
      g.fillStyle = "#3a4128";
      g.beginPath();
      g.arc(X(x), Y(y), 0.33 * VS, 0, 7);
      g.fill();
    }
  } else if (kind === "oilmil") {
    g.fillStyle = "#2a2c25";
    g.fillRect(X(-0.5), Y(0.2), VS, (L - 0.3) * VS);
    const gr = g.createLinearGradient(X(-hw), 0, X(hw), 0);
    gr.addColorStop(0, "#36401f");
    gr.addColorStop(0.35, "#5f6e42");
    gr.addColorStop(0.65, "#5a693e");
    gr.addColorStop(1, "#323b1d");
    box(-hw + 0.1, 0.3, hw - 0.1, L - 0.2, gr, 1.1);
    box(-0.3, 0.8, 0.3, L - 0.8, "#3b4529", 0.15); // walkway
    for (let y = 1.4; y < L - 1; y += 2.6) {
      g.fillStyle = "#2c331f";
      g.beginPath();
      g.arc(X(0), Y(y), 0.42 * VS, 0, 7);
      g.fill();
      g.fillStyle = "#6f7c55";
      g.beginPath();
      g.arc(X(0), Y(y), 0.28 * VS, 0, 7);
      g.fill();
    }
    text("OIL", 0.75, L / 2, 1.0, "#e8e2c8");
    text("OIL", -0.75, L / 2, 1.0, "#e8e2c8");
    box(-0.35, L - 0.55, 0.35, L - 0.2, "#ff8a1e", 0.04); // ADR plate
  } else if (kind === "army") {
    // skeletal chassis + two 20 ft green ARMY containers
    g.fillStyle = "#2a2c30";
    g.fillRect(X(-0.5), Y(0), VS, L * VS);
    for (const y0 of [0.3, 6.95]) {
      const gr = g.createLinearGradient(X(-hw), 0, X(hw), 0);
      gr.addColorStop(0, "#3c4729");
      gr.addColorStop(0.4, "#566640");
      gr.addColorStop(1, "#3c4729");
      box(-hw, y0, hw, y0 + 6.1, gr, 0.05);
      for (let y = y0 + 0.3; y < y0 + 6; y += 0.28) line(-hw, y, hw, y, "rgba(0,0,0,0.22)", 0.025);
      g.strokeStyle = "#2c3520";
      g.lineWidth = 2;
      g.strokeRect(X(-hw), Y(y0), 2 * hw * VS, 6.1 * VS);
      g.fillStyle = "#c9c6b0";
      for (const [x, y] of [
        [-hw + 0.15, y0 + 0.15],
        [hw - 0.15, y0 + 0.15],
        [-hw + 0.15, y0 + 5.95],
        [hw - 0.15, y0 + 5.95],
      ])
        g.fillRect(X(x) - 3, Y(y) - 3, 6, 6);
      text("ARMY", 0, y0 + 3.05, 1.15, "#e8e2c8");
    }
  } else if (kind === "missile") {
    // cradle frame: two rails, cross members, three saddles
    box(-hw, 0, hw, L, "rgba(0,0,0,0)");
    for (const s of [-1, 1]) box(s * 0.85 - 0.18, 0, s * 0.85 + 0.18, L, "#3a3d33", 0.05);
    for (let y = 0.5; y < L; y += 1.3) box(-hw + 0.1, y, hw - 0.1, y + 0.18, "#3a3d33", 0.03);
    // missile body (white-grey) with tail fins
    const gr = g.createLinearGradient(X(-0.6), 0, X(0.6), 0);
    gr.addColorStop(0, "#9da196");
    gr.addColorStop(0.45, "#eef0e8");
    gr.addColorStop(1, "#8f9388");
    box(-0.58, 3.4, 0.58, 13.0, gr, 0.2);
    g.fillStyle = "#5d6b45";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(X(s * 0.58), Y(10.6));
      g.lineTo(X(s * 1.25), Y(12.6));
      g.lineTo(X(s * 1.25), Y(13.2));
      g.lineTo(X(s * 0.58), Y(13.0));
      g.closePath();
      g.fill();
    }
    box(-0.6, 13.0, 0.6, 13.35, "#2b2b2b", 0.1); // nozzle
    for (const y of [4.8, 8.2, 11.4]) box(-1.05, y, 1.05, y + 0.35, "#7d8370", 0.05); // saddles
    // the huge warhead: wider than the body, olive with a yellow band and a red tip
    g.fillStyle = "#4b5737";
    g.beginPath();
    g.moveTo(X(-0.6), Y(3.6));
    g.bezierCurveTo(X(-1.25), Y(3.0), X(-1.2), Y(1.0), X(-0.2), Y(0.1));
    g.lineTo(X(0.2), Y(0.1));
    g.bezierCurveTo(X(1.2), Y(1.0), X(1.25), Y(3.0), X(0.6), Y(3.6));
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.beginPath();
    g.ellipse(X(-0.4), Y(2.1), 0.25 * VS, 1.2 * VS, 0, 0, 7);
    g.fill();
    box(-1.12, 2.15, 1.12, 2.55, "#ffd23f", 0.05);
    g.fillStyle = "#1c1c1c";
    for (let x = -1.0; x < 1.0; x += 0.4) g.fillRect(X(x), Y(2.15), 0.18 * VS, 0.4 * VS);
    g.fillStyle = "#c62828";
    g.beginPath();
    g.arc(X(0), Y(0.45), 0.28 * VS, 0, 7);
    g.fill();
    text("DANGER", 0, 7.0, 0.55, "#c62828");
  } else return null;
  AL_ART[kind] = c;
  return c;
}
{
  const mtc = mbTrailerCanvas;
  mbTrailerCanvas = function (kind) {
    return alTrailerCanvas(kind) || mtc.apply(this, arguments);
  };
}
// ---------------------------------------------------------------- board card side views
function alSVG(type) {
  const deck = `<rect x="14" y="21" width="58" height="4" fill="#45493c"/>`,
    body = {
      heli: `${deck}<path d="M18 20 Q18 10 30 10 L48 11 L66 15 L70 12 L71 19 L48 20 Z" fill="#5d6b45"/><rect x="20" y="12" width="7" height="5" fill="#1e2a34"/><line x1="34" y1="9" x2="68" y2="12" stroke="#24271f" stroke-width="1.6"/>`,
      jeeps: `${deck}${[16, 34, 52].map((x) => `<path d="M${x} 20 L${x} 15 L${x + 4} 15 L${x + 6} 11 L${x + 15} 11 L${x + 16} 20 Z" fill="#5b6a3c"/><rect x="${x + 6}" y="12" width="4" height="3" fill="#1e2a34"/>`).join("")}`,
      lowtank: `${deck}<rect x="16" y="15" width="54" height="6" rx="3" fill="#26261f"/><rect x="18" y="11" width="50" height="5" fill="#5f6a40"/><rect x="34" y="6" width="20" height="6" rx="2" fill="#4e5734"/><rect x="6" y="8" width="30" height="2" fill="#3c4428"/>`,
      oilmil: `<rect x="14" y="7" width="58" height="18" rx="9" fill="#55643c"/><text x="43" y="19" font-size="8" text-anchor="middle" fill="#e8e2c8" font-weight="900">OIL</text>`,
      army: `<rect x="14" y="6" width="28" height="19" fill="#4f5d36"/><rect x="44" y="6" width="28" height="19" fill="#4f5d36"/><text x="28" y="19" font-size="7" text-anchor="middle" fill="#e8e2c8" font-weight="900">ARMY</text><text x="58" y="19" font-size="7" text-anchor="middle" fill="#e8e2c8" font-weight="900">ARMY</text>`,
      missile: `${deck}<rect x="26" y="13" width="44" height="7" rx="3" fill="#e6e8e0"/><path d="M26 11 Q16 11 13 16.5 Q16 22 26 22 Z" fill="#4b5737"/><rect x="20" y="11.5" width="3" height="10" fill="#ffd23f"/><path d="M64 13 L72 8 L72 13 Z M64 20 L72 25 L72 20 Z" fill="#5d6b45"/>`,
    }[type];
  if (!body) return null;
  return `<svg viewBox="0 0 80 34"><rect x="0" y="9" width="12" height="17" rx="2" fill="#4f5d36"/><rect x="2" y="11" width="6" height="6" fill="#9ec9e8"/>${body}<rect x="12" y="25" width="62" height="2" fill="#222"/>${[6, 52, 60, 68].map((x) => `<circle cx="${x}" cy="28" r="3.3" fill="#111"/>`).join("")}</svg>`;
}
{
  const ts = trlSVG;
  trlSVG = function (type, col) {
    return alSVG(type) || ts.apply(this, arguments);
  };
}
// ---------------------------------------------------------------- Army Logistics jobs (tier 3, ALD -> export terminals)
// cargos join CARGOS (so save/load and results work) but carry `army`, which keeps them off the normal job board
const AL_CARGOS = [
  {
    id: "al_heli",
    name: "Merlin helicopter (rotors folded)",
    icon: "\u{1F681}",
    trl: "heli",
    kg: [13000, 15500],
    mult: 2.3,
    col: "#55613e",
    to: ["AAC", "APT"],
  },
  {
    id: "al_jeep",
    name: "Armoured patrol jeeps (x3)",
    icon: "\u{1F699}",
    trl: "jeeps",
    kg: [20000, 23000],
    mult: 2.0,
    col: "#5b6a3c",
    to: ["APT", "KHT", "AAC"],
  },
  {
    id: "al_tank",
    name: "Main battle tank",
    icon: "\u{1F6E1}",
    trl: "lowtank",
    kg: [62000, 64000],
    mult: 2.5,
    col: "#4e5734",
    to: ["APT", "KHT"],
  },
  {
    id: "al_oil",
    name: "Military diesel F-54 (ADR)",
    icon: "\u26FD",
    trl: "oilmil",
    kg: [24000, 28000],
    mult: 2.1,
    col: "#4f5d36",
    to: ["APT", "KHT", "AAC"],
  },
  {
    id: "al_cont",
    name: "ARMY containers (stores)",
    icon: "\u{1F4E6}",
    trl: "army",
    kg: [18000, 26000],
    mult: 1.9,
    col: "#566640",
    to: ["APT", "KHT"],
  },
  {
    id: "al_msl",
    name: "Missile + warhead (escorted)",
    icon: "\u{1F680}",
    trl: "missile",
    kg: [28000, 34000],
    mult: 2.9,
    col: "#6b6f5c",
    to: ["APT", "KHT", "AAC"],
  },
];
for (const c of AL_CARGOS) CARGOS.push(Object.assign(c, { tier: 3, army: 1 }));
const AL = { jobs: [], t: -1e9, REFRESH: 600, seq: 0 };
function alDepot() {
  return world.depots.find((d) => d.code === "ALD") || null;
}
function alAtDepot() {
  const D = alDepot();
  if (!D) return false;
  const near = (x, y, r) => Math.hypot(truck.x - x, truck.y - y) < r;
  return near(D.entrance.x, D.entrance.y, 90) || D.bays.some((b) => near(b.kx, b.ky, 45));
}
function alMakeJob(c) {
  const D = alDepot(),
    tos = c.to.map((k) => world.depots.find((d) => d.code === k)).filter((d) => d && d.bays.length);
  if (!D || !tos.length) return null;
  const to = tos[(Math.random() * tos.length) | 0],
    km = (Math.hypot(to.entrance.x - D.entrance.x, to.entrance.y - D.entrance.y) * 1.3) / 1000,
    kg = Math.round((c.kg[0] + Math.random() * (c.kg[1] - c.kg[0])) / 100) * 100,
    TT = TRAILER_TYPES[c.trl],
    band = km >= 7 ? "long" : "med";
  return {
    id: "AL" + ++AL.seq,
    cargo: c,
    tier: 3,
    from: D,
    to,
    km,
    kg,
    weight: kg + TT.tare,
    trailerType: TT.name,
    pay: jobPay(km, c, tierInfo(3), kg, band),
    xp: Math.round((55 + 38 * km) * c.mult * (0.8 + 3 * 0.35) * (band === "long" ? 1.2 : 1)),
    mins: Math.round((km / 38) * 60 + 4),
    approx: true,
    fresh: true,
    band,
    army: 1,
  };
}
// one offer per cargo; refreshed every AL.REFRESH s, and a taken job is replaced by a new one
function alJobs() {
  if (timeS - AL.t > AL.REFRESH || !AL.jobs.length) {
    AL.t = timeS;
    AL.jobs = AL_CARGOS.map(alMakeJob).filter(Boolean);
  }
  AL.jobs = AL.jobs.map((j) => (j.taken ? alMakeJob(j.cargo) || j : j));
  return AL.jobs;
}
// ---------------------------------------------------------------- the board (same design as ui.js openBoard / renderBoard)
const alBoard = { sel: null };
function alOpenBoard(force) {
  if (!started || (!force && !alAtDepot())) return false;
  const js = alJobs(),
    D = alDepot(),
    lockAll = career.tier < 3,
    T3 = tierInfo(3);
  if (!alBoard.sel || !js.includes(alBoard.sel)) alBoard.sel = js[0] || null;
  const b = openModal(
    "armyboard",
    `<div class="mh"><div style="font-size:28px">\u{1FA96}</div><div><h2>ARMY LOGISTICS</h2><div class="sub">${esc(D ? D.name : "Army Logistics Depot")}, Sandvale Military Base \u2022 export runs to the docks, harbour &amp; airport \u2022 heavy military loads</div></div><div class="sp"></div>
    <div style="text-align:right;font-size:12px"><span class="tb" style="background:${T3.color}">TIER 3</span> <b>${esc(T3.name)}</b> required<br><span style="opacity:.7">You: Tier ${career.tier}</span></div><button class="x">\u2715</button></div>
    <div class="bar"><span class="chip" id="alBack">\u{1F4CB} Job board</span><div style="flex:1"></div><span class="lbl">${js.length} export orders \u2022 new orders every ${Math.round(AL.REFRESH / 60)} min</span></div>
    <div class="body"><div class="grid"></div></div><div class="detail"></div>
    <div class="foot"><span>\u{1F4B0} ${money(truck.money)}</span>${career.active ? `<span style="color:#ffd866">Active: ${esc(career.active.job.cargo.name)} \u2192 ${esc(career.active.job.to.name)}</span>` : ""}<span class="sp"></span>${lockAll ? '<span style="color:#ffb4b4">\u{1F512} Reach Tier 3 (Specialist) to drive for the army</span>' : ""}</div>`,
  );
  b.querySelector("#alBack").addEventListener("click", () => {
    closeUI();
    AL.skip = 1;
    openBoard();
    AL.skip = 0;
  });
  alRender();
  return true;
}
function alRender() {
  const b = uiRoot && uiRoot.querySelector(".mback");
  if (!b || career.uiOpen !== "armyboard") return;
  const g = b.querySelector(".grid"),
    js = AL.jobs;
  for (const j of js) j.away = Math.hypot(j.from.entrance.x - truck.x, j.from.entrance.y - truck.y);
  g.innerHTML = js
    .map((j, i) => {
      const lock = j.tier > career.tier,
        c = j.cargo;
      return `<div class="card ${lock ? "lock" : ""} ${j === alBoard.sel ? "sel" : ""}" data-j="${j.id}" style="animation-delay:${i * 30}ms">
      <div class="ctop"><div class="ill" style="background:linear-gradient(145deg,${c.col},${shade(c.col, 0.45)})"><span class="em">${c.icon}</span>${trlSVG(c.trl, c.col)}</div>
      <div class="cinfo"><div class="cn" title="${esc(c.name)}">${esc(c.name)}</div><span style="display:inline-block;font-size:9.5px;font-weight:900;letter-spacing:.5px;background:#4f5d36;color:#fff;border-radius:4px;padding:1px 5px;margin:2px 4px 0 0">ARMY \u2022 EXPORT</span>${j.band === "long" ? '<span style="display:inline-block;font-size:9.5px;font-weight:900;background:#7c3aed;color:#fff;border-radius:4px;padding:1px 5px">LONG HAUL</span>' : ""}<div class="ct">${esc(TRAILER_TYPES[c.trl].name)} \u2022 ${(j.weight / 1000).toFixed(1)} t</div></div></div>
      <div class="prow"><span class="m">${money(j.pay)}</span><span class="xp">+${j.xp} XP</span><span class="aw" style="font-size:11px;opacity:.8">\u{1F4CD} ${(j.away / 1000).toFixed(1)} km away</span><span class="tb" style="background:${tierInfo(3).color}">TIER 3</span></div>
      <div class="rt"><span>FROM</span><b title="${esc(j.from.name)}">${esc(j.from.name)}</b><span>TO</span><b title="${esc(j.to.name)}">${esc(j.to.name)}</b></div>
      <div class="meta"><span>\u{1F4CD} ~${j.km.toFixed(1)} km</span><span>\u23F1 ${j.mins} min</span><span>\u{1F5FA} ${esc(j.to.region)}</span></div>
      ${lock ? '<div class="lockov">\u{1F512} Tier 3 required</div>' : ""}</div>`;
    })
    .join("");
  g.querySelectorAll(".card").forEach((el) =>
    el.addEventListener("click", () => {
      const j = AL.jobs.find((x) => x.id === el.dataset.j);
      if (!j) return;
      if (alBoard.sel === j && el.dataset.armed && j.tier <= career.tier) {
        startMission(j);
        return;
      }
      alBoard.sel = j;
      g.querySelectorAll(".card").forEach((e2) => {
        e2.classList.toggle("sel", e2 === el);
        delete e2.dataset.armed;
      });
      setTimeout(() => {
        el.dataset.armed = 1;
      }, 0);
      alSide();
    }),
  );
  alSide();
}
function alSide() {
  const b = uiRoot.querySelector(".mback"),
    sd = b && b.querySelector(".detail"),
    j = alBoard.sel;
  if (!sd) return;
  if (!j) {
    sd.innerHTML = '<div style="opacity:.6">Select an order to see the details</div>';
    return;
  }
  const lock = j.tier > career.tier,
    c = j.cargo;
  sd.innerHTML = `<div class="dic">${c.icon}</div><div class="dt"><div class="dn">${esc(c.name)} <span style="font-size:12px;opacity:.6;font-weight:700">\u2022 ${esc(TRAILER_TYPES[c.trl].name)} \u2022 ${(j.weight / 1000).toFixed(1)} t</span></div>
    <div class="ds"><b>1</b> Collect at <b>${esc(j.from.name)}</b> <i>\u2192</i> <b>2</b> Deliver for export to <b>${esc(j.to.name)}</b></div>
    <div class="dm">\u{1F4CD} ~${j.km.toFixed(1)} km \u2022 \u23F1 ${j.mins} min \u2022 <b style="color:#7dff9a">${money(j.pay)}</b> \u2022 <b style="color:#ffd866">+${j.xp} XP</b>${career.active ? ' \u2022 <span class="warn">replaces your current mission</span>' : ""}</div></div>
    <button class="btn start" id="accept" ${lock ? "disabled" : ""}>${lock ? "\u{1F512} TIER 3 REQUIRED" : "\u25B6 START MISSION"}${lock ? "" : "<kbd>" + (pad.active ? GLYPH.A : "Enter") + "</kbd>"}</button>`;
  sd.querySelector("#accept").addEventListener("click", () => startMission(j));
}
addEventListener(
  "keydown",
  (e) => {
    if (
      career.uiOpen === "armyboard" &&
      (e.code === "Enter" || e.code === "NumpadEnter") &&
      alBoard.sel
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (alBoard.sel.tier <= career.tier) startMission(alBoard.sel);
    }
  },
  true,
);
// the normal board opens the army board at the depot and gets an "Army Logistics" chip everywhere else
{
  const ob = openBoard;
  openBoard = function () {
    if (!AL.skip && alOpenBoard(false)) return;
    ob.apply(this, arguments);
    const bar = career.uiOpen === "board" && uiRoot && uiRoot.querySelector(".mback .bar");
    if (!bar) return;
    const ch = document.createElement("span");
    ch.className = "chip";
    ch.id = "alChip";
    ch.style.cssText = "background:#4f5d36;color:#fff";
    ch.textContent = "\u{1FA96} Army Logistics" + (career.tier < 3 ? " \u{1F512}" : "");
    ch.addEventListener("click", () => alOpenBoard(true));
    bar.insertBefore(ch, bar.firstChild);
  };
}

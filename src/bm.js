/**
 * @file bm.js — BLACK MARKET: shady yards (world gen, art, fence collision, map icons, fast travel), the Black Market Jobs board
 *   (illegal missions only, registry BM_MISSIONS for more theft jobs later) and the first mission, Tank Heist.
 * Exposes (globals): BM, BM_MISSIONS, bmGenYards, bmSolidM, bmMapIcons, bmPOIs, bmAtYard, bmOpenBoard, bmBlockFT, bmUpdate,
 *   BM_THEFT, BM_OFFER_S, bmTheftOffers, bmBoardList, bmBoardBox, bmInBoardBox,
 *   bmDrawLow, bmDrawHigh, bmHUD (+ bm* helpers)
 * Depends on: depots.js (findSpot/access passed in, makeTrailer, BigRig events), milbase.js (MB, world.milbase, mbSoldier),
 *   police.js / wanted.js (WANT, POL), career.js (addXP, career), ui.js (openModal, closeUI, esc, money), satnav.js (setRoute)
 * Load order: after heli.js in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 * World data: world.bmYards (plain data, saved in src/map/). Missions are local to this client (never sent in MP: solo-safe).
 */
"use strict";
const BM = { act: null, sol: [], tr: [], alarm: 0, snd: null, err: null, hint: 0, res: null };
const BM_YW = 22,
  BM_YH = 16; // yard size (tiles)
// ---------------------------------------------------------------- world generation (called from the depots stage)
function bmGenYards(findSpot, access, clearObjs, objs, R) {
  world.bmYards = [];
  const plan = [
    ["Dockside Salvage", 520, 250], // Port Albion docks
    ["Eastgate Breakers", 1790, 600], // Sandvale east industry
    ["Harbour Wharf Spares", 1600, 1790], // Kingsbridge harbour
    ["Coppermine Scrap Co", 1700, 700], // Coppermine works edge
    ["Dustwater Auto Parts", 1040, 560], // Dustwater edge
  ];
  const T_ = TILE;
  for (const [name, tx, ty] of plan) {
    const s = findSpot(tx, ty, BM_YW, BM_YH, 8, (x, y) =>
      objs.some(
        (o) =>
          (o.kind === "lpark" || o.kind === "yblk" || o.kind === "lot") &&
          o.x / TILE < x + BM_YW + 2 &&
          (o.x + (o.w || 0)) / TILE > x - 2 &&
          o.y / TILE < y + BM_YH + 2 &&
          (o.y + (o.h || 0)) / TILE > y - 2,
      ),
    );
    if (!s) {
      console.warn("no Black Market spot", name);
      continue;
    }
    const [x, y, gap] = s;
    access(x, y, BM_YW, gap);
    clearObjs(x, y, BM_YW, BM_YH);
    fill(x, y, BM_YW, BM_YH, T.GRAVEL);
    for (let j = y; j < y + BM_YH; j++)
      for (let i = x; i < x + BM_YW; i++) world.reserved[idx(i, j)] = 1;
    // workshop shed (solid) bottom-left, drop bay bottom-right, gate gap top centre
    const bx = x + 1.5,
      by = y + 8,
      bw = 9,
      bh = 6.5;
    fill(Math.floor(bx), by, Math.ceil(bw), Math.ceil(bh), T.BLDG);
    const Y = {
      name,
      x0: x,
      y0: y,
      w: BM_YW,
      h: BM_YH,
      entrance: { x: (x + BM_YW / 2) * M_T, y: (y - gap) * M_T },
      gate: [x + BM_YW / 2 - 4, x + BM_YW / 2 + 4],
      shed: [bx, by, bx + bw, by + bh],
      bay: [x + 15, y + 5.5, x + 18.5, y + 15.2], // reverse-in drop bay (tiles), trailer nose north
      seed: (R() * 1e9) | 0,
    };
    world.bmYards.push(Y);
    objs.push({
      kind: "bm",
      t: "yard",
      yd: Y,
      x: (x - 1) * T_,
      y: (y - 3) * T_,
      w: (BM_YW + 2) * T_,
      h: (BM_YH + 4) * T_,
      height: 30,
      seed: Y.seed,
    });
  }
}
// ---------------------------------------------------------------- collision (fence + shed are solid; gate gap open)
function bmSolidM(mx, my) {
  const L = world.bmYards;
  if (!L) return false;
  const x = mx / M_T,
    y = my / M_T,
    e = 0.2;
  for (const Y of L) {
    if (x < Y.x0 - 1 || x > Y.x0 + Y.w + 1 || y < Y.y0 - 1 || y > Y.y0 + Y.h + 1) continue;
    const x1 = Y.x0 + Y.w,
      y1 = Y.y0 + Y.h;
    if ((Math.abs(x - Y.x0) < e || Math.abs(x - x1) < e) && y > Y.y0 - e && y < y1 + e) return true;
    if (Math.abs(y - y1) < e && x > Y.x0 && x < x1) return true;
    if (Math.abs(y - Y.y0) < e && x > Y.x0 && x < x1 && (x < Y.gate[0] || x > Y.gate[1]))
      return true;
  }
  return false;
}
function bmYardAt(mx, my, pad) {
  const p = pad || 0;
  for (const Y of world.bmYards || [])
    if (
      mx > (Y.x0 - p) * M_T &&
      mx < (Y.x0 + Y.w + p) * M_T &&
      my > (Y.y0 - p) * M_T &&
      my < (Y.y0 + Y.h + p) * M_T
    )
      return Y;
  return null;
}
function bmAtYard() {
  return !!(world.bmYards && bmYardAt(truck.x, truck.y, 0.5));
}
// ---------------------------------------------------------------- map: icon + POIs (sat nav / fast travel)
// Black Market yards on the minimap and M map: same badge as the depot/fuel icons (drawPOIs), drawn last
// so they sit on top, never smaller than a minimap POI; label when zoomed in (lbl)
function bmMapIcons(px, py, R, lbl) {
  const r = Math.max(5.5, R || 5.5);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const Y of world.bmYards || []) {
    const X = px(Y.entrance.x),
      Z = py(Y.entrance.y);
    if (typeof nmIconRing === "function") nmIconRing(X, Z, r);
    ctx.fillStyle = "#1b1022";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = R ? Math.max(1.5, r * 0.18) : 1.5;
    ctx.beginPath();
    ctx.arc(X, Z, r, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(r * 1.25)}px system-ui,sans-serif`;
    ctx.fillText("\u2620", X, Z + 0.5);
    if (lbl) mapLabel(Y.name, X + r + 4, Z, "#d6b8e0");
  }
  ctx.restore();
}
function bmPOIs(test) {
  for (const Y of world.bmYards || []) test(Y, Y.entrance.x, Y.entrance.y, "Black Market yard");
}
function bmBlockFT() {
  const a = BM.act;
  return a && a.step >= 1 ? "No fast travel with stolen goods \u2014 drive it there" : null;
}
// ---------------------------------------------------------------- yard art (chunk-baked)
OBJX.bm = function (g, o) {
  const Y = o.yd,
    T_ = TILE,
    r = mulberry(Y.seed || 7),
    X0 = Y.x0 * T_,
    Y0 = Y.y0 * T_,
    W = Y.w * T_,
    H = Y.h * T_;
  // oily gravel, puddles, junk
  g.fillStyle = "#5d5a52";
  g.fillRect(X0, Y0, W, H);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = ["rgba(20,18,15,0.25)", "rgba(90,80,60,0.25)", "rgba(30,40,50,0.3)"][i % 3];
    g.beginPath();
    g.ellipse(X0 + r() * W, Y0 + r() * H, 6 + r() * 40, 4 + r() * 18, r() * 3, 0, 7);
    g.fill();
  }
  // scrap piles + tyre stacks + dead cars along the west/north fence
  for (let i = 0; i < 7; i++) {
    const x = X0 + (1 + r() * 5) * T_ + (i > 3 ? 4 * T_ : 0),
      y = Y0 + (1 + r() * 4) * T_;
    g.fillStyle = ["#6b4a35", "#4b4e52", "#7c3b2a", "#3b3b3b"][i % 4];
    g.save();
    g.translate(x, y);
    g.rotate(r() * 3);
    g.fillRect(-28, -14, 56, 28);
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(-20, -8, 40, 16);
    g.restore();
  }
  for (let i = 0; i < 5; i++) {
    const x = X0 + (12.5 + i * 1.1) * T_,
      y = Y0 + 1.6 * T_;
    g.fillStyle = "#151515";
    g.beginPath();
    g.arc(x, y, 14, 0, 7);
    g.fill();
    g.fillStyle = "#2a2a2a";
    g.beginPath();
    g.arc(x, y, 6, 0, 7);
    g.fill();
  }
  // drop bay
  const [b0, b1, b2, b3] = Y.bay;
  g.fillStyle = "rgba(200,30,40,0.18)";
  g.fillRect(b0 * T_, b1 * T_, (b2 - b0) * T_, (b3 - b1) * T_);
  g.strokeStyle = "#d8283a";
  g.lineWidth = 4;
  g.setLineDash([16, 10]);
  g.strokeRect(b0 * T_, b1 * T_, (b2 - b0) * T_, (b3 - b1) * T_);
  g.setLineDash([]);
  g.save();
  g.translate(((b0 + b2) / 2) * T_, ((b1 + b3) / 2) * T_);
  g.rotate(-Math.PI / 2);
  g.fillStyle = "rgba(240,220,220,0.75)";
  g.font = "bold 26px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("DROP \u2022 NO QUESTIONS", 0, 0);
  g.restore();
  // JOB BOARD box: same marking style as the drop bay, amber
  {
    const [j0, j1, j2, j3] = bmBoardBox(Y);
    g.fillStyle = "rgba(240,170,30,0.18)";
    g.fillRect(j0 * T_, j1 * T_, (j2 - j0) * T_, (j3 - j1) * T_);
    g.strokeStyle = "#f0aa1e";
    g.lineWidth = 4;
    g.setLineDash([16, 10]);
    g.strokeRect(j0 * T_, j1 * T_, (j2 - j0) * T_, (j3 - j1) * T_);
    g.setLineDash([]);
    g.save();
    g.translate(((j0 + j2) / 2) * T_, ((j1 + j3) / 2) * T_);
    g.rotate(-Math.PI / 2);
    g.fillStyle = "rgba(250,235,200,0.8)";
    g.font = "bold 26px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("\u{1F4CB} JOB BOARD", 0, 0);
    g.restore();
  }
  // shed: rusty corrugated roof
  const [s0, s1, s2, s3] = Y.shed;
  drawShadowRect(g, s0 * T_, s1 * T_, (s2 - s0) * T_, (s3 - s1) * T_, 22);
  const gr = g.createLinearGradient(s0 * T_, 0, s2 * T_, 0);
  gr.addColorStop(0, "#5a3a2a");
  gr.addColorStop(0.5, "#7a5238");
  gr.addColorStop(1, "#4a3022");
  g.fillStyle = gr;
  g.fillRect(s0 * T_, s1 * T_, (s2 - s0) * T_, (s3 - s1) * T_);
  g.strokeStyle = "rgba(0,0,0,0.3)";
  g.lineWidth = 2;
  for (let x = s0 * T_ + 8; x < s2 * T_; x += 10) {
    g.beginPath();
    g.moveTo(x, s1 * T_);
    g.lineTo(x, s3 * T_);
    g.stroke();
  }
  for (let i = 0; i < 6; i++) {
    g.fillStyle = "rgba(140,60,20," + (0.2 + r() * 0.3) + ")";
    g.beginPath();
    g.arc(s0 * T_ + r() * (s2 - s0) * T_, s1 * T_ + r() * (s3 - s1) * T_, 8 + r() * 24, 0, 7);
    g.fill();
  }
  g.fillStyle = "#222";
  g.fillRect(s0 * T_ + 2.5 * T_, s1 * T_ - 4, 3.5 * T_, 7); // roller door
  // graffiti tag
  g.save();
  g.font = "italic bold 30px sans-serif";
  g.fillStyle = "rgba(200,60,220,0.55)";
  g.translate(s0 * T_ + 40, s3 * T_ - 30);
  g.rotate(-0.08);
  g.fillText("NO COPS", 0, 0);
  g.restore();
  // chain-link fence with barbed top (gap at the gate) + broken gate leaf
  const fence = (ax, ay, bx, by) => {
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(ax + 4, ay + 6);
    g.lineTo(bx + 4, by + 6);
    g.stroke();
    g.strokeStyle = "#8a8f90";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke();
    const L = Math.hypot(bx - ax, by - ay),
      ux = (bx - ax) / L,
      uy = (by - ay) / L;
    g.fillStyle = "#4a4e50";
    for (let d = 0; d <= L; d += 2 * T_) g.fillRect(ax + ux * d - 3, ay + uy * d - 3, 6, 6);
    g.strokeStyle = "#b8bcbe";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let d = 0; d < L; d += 7) g.arc(ax + ux * d, ay + uy * d, 3.2, 0, 6.3);
    g.stroke();
  };
  const x1 = X0 + W,
    y1 = Y0 + H;
  fence(X0, Y0, Y.gate[0] * T_, Y0);
  fence(Y.gate[1] * T_, Y0, x1, Y0);
  fence(X0, Y0, X0, y1);
  fence(x1, Y0, x1, y1);
  fence(X0, y1, x1, y1);
  g.strokeStyle = "#7a7f80";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(Y.gate[1] * T_, Y0);
  g.lineTo(Y.gate[1] * T_ - 30, Y0 + 70); // gate leaf swung open
  g.stroke();
  // dodgy sign by the gate
  const sx = (Y.gate[0] - 6.5) * T_,
    sy = Y0 - 1.9 * T_;
  drawShadowRect(g, sx, sy, 6 * T_, 1.6 * T_, 8);
  g.fillStyle = "#121014";
  g.fillRect(sx, sy, 6 * T_, 1.6 * T_);
  g.strokeStyle = "#d8283a";
  g.lineWidth = 3;
  g.strokeRect(sx + 3, sy + 3, 6 * T_ - 6, 1.6 * T_ - 6);
  g.fillStyle = "#ffd23f";
  g.font = "bold 17px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(Y.name.toUpperCase(), sx + 3 * T_, sy + 0.55 * T_);
  g.fillStyle = "#e8e0e0";
  g.font = "bold 11px sans-serif";
  g.fillText("CASH ONLY \u2022 NO QUESTIONS \u2022 \u2620", sx + 3 * T_, sy + 1.1 * T_);
};
// ---------------------------------------------------------------- mission registry (add more theft jobs here)
// each entry: { id, name, pay, xp, risk, blurb, steps(a) -> [labels], start(a) -> bool, update(a, dt), onCouple(a, tr), onUncouple(a, tr) }
const BM_MISSIONS = [];
function bmTankTarget() {
  const D = (world.depots || []).find((d) => d.mil);
  if (!D) return null;
  let tr = world.trailers.find((t) => t.type === "lowtank" && !t.coupled && t.depot === D && t.bay);
  if (!tr) {
    const b = D.bays.find((q) => !q.trailer);
    if (!b) return null;
    tr = makeTrailer("lowtank", Math.random);
    Object.assign(tr, { x: b.kx, y: b.ky, th: b.th, bay: b, depot: D });
    b.trailer = tr;
    world.trailers.push(tr);
  }
  return tr;
}
BM_MISSIONS.push({
  id: "tank",
  name: "Tank Heist",
  pay: 5000,
  xp: 450,
  risk: 3,
  icon: "\u{1FA96}",
  cargo: "Tank low-loader \u2022 Main battle tank",
  from: "Sandvale Military Base",
  blurb:
    "A buyer wants a main battle tank, no paperwork. Get into Sandvale Military Base, hook the tank low-loader in the Army Logistics Depot and get it out. Expect soldiers, an alarm and 2 stars.",
  steps: (a) => [
    "Get into Sandvale Military Base \u2022 couple the TANK low-loader (Army Logistics Depot)",
    "Escape the base \u2014 soldiers are firing!",
    "Lose the police (2\u2605)",
    "Deliver it to the " + a.yard.name + " drop bay",
  ],
  start(a) {
    const tr = bmTankTarget();
    if (!tr) return false;
    a.tr = tr;
    tr.target = true;
    setRoute({ x: tr.x, y: tr.y, name: "Tank low-loader (Army Logistics Depot)" });
    return true;
  },
  onCouple(a, tr) {
    if (tr !== a.tr) return;
    tr.target = false;
    if (a.step === 0) {
      a.step = 1;
      bmAlarm(true);
      flash("\u{1F6A8} ALARM! Soldiers are shooting \u2014 get out through the gate!");
      setRoute({ x: (MB.av + 2) * M_T, y: 356 * M_T, name: "Base gate" });
    }
    a.lost = false;
  },
  onUncouple(a, tr) {
    if (tr !== a.tr || a.step < 1) return;
    a.lost = true;
    tr.target = true;
    flash("You dropped the tank \u2014 re-couple it!");
  },
  update(a, dt) {
    const s = truck,
      inBase =
        s.x > (MB.x0 - 1) * M_T &&
        s.x < (MB.x1 + 1) * M_T &&
        s.y > (MB.y0 - 1) * M_T &&
        s.y < (MB.y1 + 1) * M_T;
    if (a.step === 1 && !inBase && s.trl === a.tr) {
      a.step = 2;
      bmWanted2();
      flash("\u2605\u2605 The police are after the tank \u2014 lose them!");
      clearRoute();
    }
    if (a.step === 2 && wantStars() === 0 && !POL.chase) {
      a.step = 3;
      flash("Police lost \u2714 Deliver the tank to " + a.yard.name);
      setRoute(a.yard);
    }
    if (a.step >= 2 && s.trl === a.tr && bmInBay(a)) {
      if (wantStars() > 0 || POL.chase) {
        if (timeS - (a.blk || -9) > 4) {
          a.blk = timeS;
          flash("\u26D4 Not while you\u2019re wanted \u2014 lose the police first!");
        }
      } else if (Math.abs(s.v) < 0.6) bmComplete(a);
    }
  },
});
function bmInBay(a) {
  const tr = a.tr,
    f = fwd(tr.th),
    cx = tr.x - f[0] * TRL_KP_TO_CENTRE,
    cy = tr.y - f[1] * TRL_KP_TO_CENTRE,
    b = a.yard.bay;
  return (
    cx > (b[0] - 1) * M_T && cx < (b[2] + 1) * M_T && cy > (b[1] - 1) * M_T && cy < (b[3] + 1) * M_T
  );
}
function bmWanted2() {
  WANT.lvl = 2;
  WANT.t = 90;
  WANT.chased = false;
  WANT.sp = 1;
  WANT.heat = Math.max(WANT.heat || 0, 230);
  WANT.ht = timeS;
  WANT.star = timeS;
}
// JOB BOARD ground box (tiles): between the shed and the drop bay; stop in it to open the Black Market board
function bmBoardBox(Y) {
  return [Y.x0 + 11, Y.y0 + 7.5, Y.x0 + 14.5, Y.y0 + 15.2];
}
function bmInBoardBox(Y) {
  const b = bmBoardBox(Y);
  return (
    truck.x > b[0] * M_T && truck.x < b[2] * M_T && truck.y > b[1] * M_T && truck.y < b[3] * M_T
  );
}
// ---- depot theft: steal a parked trailer from a normal depot. Hook-up = instant 2 stars; lose them, deliver to the yard.
// Offers are per yard and refresh every BM_OFFER_S seconds (and after a theft is accepted/finished).
const BM_OFFER_S = 300;
const BM_THEFT = {
  risk: 1,
  icon: "\u{1F69A}",
  col: "#6a4a8a",
  steps(a) {
    return [
      "Hook the marked trailer at " + a.m.from,
      "Lose the police (2\u2605)",
      "Deliver it to the " + a.yard.name + " drop bay",
    ];
  },
  start(a) {
    const tr = this.tr;
    if (!tr || tr.coupled || world.trailers.indexOf(tr) < 0) return false;
    a.tr = tr;
    tr.target = true;
    setRoute({ x: tr.x, y: tr.y, name: "Marked trailer (" + this.from + ")" });
    return true;
  },
  onCouple(a, tr) {
    if (tr !== a.tr) return;
    tr.target = false;
    a.lost = false;
    if (a.step === 0) {
      a.step = 1;
      bmWanted2();
      clearRoute();
      flash("\u2605\u2605 Stolen! The police are on to you \u2014 lose them!");
    }
  },
  onUncouple(a, tr) {
    if (tr !== a.tr || a.step < 1) return;
    a.lost = true;
    tr.target = true;
    flash("You dropped the trailer \u2014 re-couple it!");
  },
  update(a) {
    if (a.step === 1 && wantStars() === 0 && !POL.chase) {
      a.step = 2;
      flash("Police lost \u2714 Deliver it to " + a.yard.name);
      setRoute(a.yard);
    }
    if (a.step >= 1 && truck.trl === a.tr && bmInBay(a)) {
      if (wantStars() > 0 || POL.chase) {
        if (timeS - (a.blk || -9) > 4) {
          a.blk = timeS;
          flash("\u26D4 Not while you\u2019re wanted \u2014 lose the police first!");
        }
      } else if (Math.abs(truck.v) < 0.6) bmComplete(a);
    }
  },
};
function bmTheftOffers(Y) {
  BM.offers = BM.offers || {};
  const o = BM.offers[Y.name],
    busy = BM.act && BM.act.tr;
  if (o && timeS - o.t < BM_OFFER_S && o.list.every((m) => !m.tr.coupled || m.tr === busy))
    return o.list;
  const cand = [];
  for (const D of world.depots || []) {
    if (D.mil) continue;
    const km = Math.hypot(D.entrance.x - Y.entrance.x, D.entrance.y - Y.entrance.y) / 1000;
    if (km < 1.2) continue;
    const trs = world.trailers.filter(
      (t) => t.depot === D && t.bay && !t.coupled && !t.target && TRAILER_TYPES[t.type],
    );
    if (trs.length) cand.push({ D, km, tr: trs[(Math.random() * trs.length) | 0] });
  }
  cand.sort((p, q) => p.km - q.km);
  const pick = [];
  if (cand.length) {
    // one near, one mid, one far (varying distance and pay)
    for (const f of [0.15, 0.5, 0.9]) {
      const c = cand[Math.min(cand.length - 1, (f * cand.length) | 0)];
      if (!pick.includes(c)) pick.push(c);
    }
  }
  BM.seq = BM.seq || 0;
  const list = pick.map((c) => {
    const pay = Math.round(Math.min(2000, Math.max(800, 650 + c.km * 140)) / 10) * 10;
    return Object.assign(Object.create(BM_THEFT), {
      id: "th" + ++BM.seq,
      name: "Depot Theft",
      pay,
      xp: Math.round(60 + pay * 0.09),
      tr: c.tr,
      from: c.D.name,
      cargo: TRAILER_TYPES[c.tr.type].name + (c.tr.cargo ? " \u2022 " + c.tr.cargo : ""),
      blurb:
        "Easy money: the " +
        TRAILER_TYPES[c.tr.type].name.toLowerCase() +
        " in " +
        c.D.name +
        " (" +
        c.km.toFixed(1) +
        " km) has no one watching it. Hooking up brings 2 stars \u2014 lose them before you deliver.",
    });
  });
  BM.offers[Y.name] = { t: timeS, list };
  return list;
}
function bmBoardList(Y) {
  const th = bmTheftOffers(Y),
    a = BM.act;
  if (a && a.m.tr && !BM_MISSIONS.includes(a.m) && !th.includes(a.m)) th.unshift(a.m);
  return BM_MISSIONS.concat(th);
}
// ---------------------------------------------------------------- board (dark, shady styling; illegal jobs only)
// same design as the normal job board (ui.js openBoard / renderBoard markup); only the title differs
function bmOpenBoard() {
  const Y = bmYardAt(truck.x, truck.y, 0.5);
  if (!Y) return false;
  const a = BM.act;
  const cards = bmBoardList(Y)
    .map((m, i) => {
      const on = a && a.m === m;
      return `<div class="card" data-go="${on ? "" : m.id}" style="animation-delay:${i * 30}ms">
      <div class="ctop"><div class="ill" style="background:linear-gradient(145deg,${m.col || "#5b6a3c"},${shade(m.col || "#5b6a3c", 0.45)})"><span class="em">${m.icon}</span></div>
      <div class="cinfo"><div class="cn" title="${esc(m.name)}">${esc(m.name)}</div><div class="ct">${esc(m.cargo)}</div></div></div>
      <div class="prow"><span class="m">${money(m.pay)}</span><span class="xp">+${m.xp} XP</span><span class="aw" style="font-size:11px;opacity:.8">Risk ${"\u2605".repeat(m.risk)}</span></div>
      <div class="rt"><span>FROM</span><b title="${esc(m.from)}">${esc(m.from)}</b><span>TO</span><b title="${esc(Y.name)}">${esc(Y.name)}</b></div>
      <div class="meta" style="white-space:normal"><span style="white-space:normal;overflow:visible">${esc(m.blurb)}</span></div>
      ${on ? `<div class="meta"><span style="color:#ffd866">Active: ${esc(m.steps(a)[a.step])}</span></div>` : ""}</div>`;
    })
    .join("");
  const b = openModal(
    "bmboard",
    `<div class="mh"><div style="font-size:28px">\u{1F4CB}</div><div><h2>BLACK MARKET JOBS</h2><div class="sub">${esc(Y.name)} \u2022 these jobs never appear on the normal job board</div></div><div class="sp"></div><button class="x">\u2715</button></div>
    <div class="body"><div class="grid">${cards}</div></div><div class="detail"></div>
    <div class="foot"><span>\u{1F4B0} ${money(truck.money)}</span>${a ? `<span style="color:#ffd866">Active: ${esc(a.m.name)}</span><button class="chip" id="bmAbandon">Abandon job</button>` : ""}<span class="sp"></span></div>`,
  );
  BM.boardOpen = 1;
  b.querySelectorAll("[data-go]").forEach((el) =>
    el.addEventListener("click", () => el.dataset.go && bmAccept(el.dataset.go, Y)),
  );
  const ab = b.querySelector("#bmAbandon");
  if (ab)
    ab.addEventListener("click", () => {
      bmEnd(false, "Job abandoned");
      closeUI();
    });
  return true;
}
function bmAccept(id, Y) {
  const m = bmBoardList(Y).find((q) => q.id === id);
  if (!m) return;
  if (career.active) {
    flash("Finish or abandon your delivery job first");
    return;
  }
  if (truck.trl) {
    flash("Drop your trailer first \u2014 you\u2019ll need the fifth wheel free");
    return;
  }
  const a = { m, yard: Y, step: 0, t0: timeS, lost: false };
  if (!m.start(a)) {
    flash("No job available right now");
    return;
  }
  BM.act = a;
  closeUI();
  flash("\u2620 " + m.name + ": " + m.steps(a)[0]);
}
function bmEnd(ok, why) {
  const a = BM.act;
  if (!a) return;
  if (a.tr) a.tr.target = false;
  if (!BM_MISSIONS.includes(a.m)) BM.offers = {};
  BM.act = null;
  bmAlarm(false);
  clearRoute();
  if (why) flash(why);
  if (!ok && why && why !== "Job abandoned") bmResult(false, a, why);
}
function bmComplete(a) {
  const tr = a.tr;
  if (!BM_MISSIONS.includes(a.m)) BM.offers = {};
  truck.trl = null;
  truck.th = truck.h;
  const i = world.trailers.indexOf(tr);
  if (i >= 0) world.trailers.splice(i, 1);
  truck.money += a.m.pay;
  addXP(a.m.xp);
  BM.done = (BM.done || 0) + 1;
  BM.act = null;
  bmAlarm(false);
  clearRoute();
  if (typeof saveGame === "function") saveGame();
  bmResult(true, a);
}
function bmResult(ok, a, why) {
  BM.res = { ok, t: timeS };
  const b = openModal(
    "result",
    `<div style="padding:22px 26px;text-align:center"><div style="font-size:44px">${ok ? "\u{1F4B0}" : "\u{1F6A8}"}</div><h2>${ok ? "PAYOUT" : "JOB FAILED"}</h2>
    <div class="sub">${esc(a.m.name)} \u2022 ${esc(a.yard.name)}</div>
    ${ok ? `<div style="font-size:40px;font-weight:900;color:#7dff8a;margin:14px 0 4px">${money(a.m.pay)}</div><div style="color:#ffd23f;font-weight:800">+${a.m.xp} XP \u2022 cash in hand, no receipt</div>` : `<div style="font-size:18px;color:#ff8a8a;margin:14px 0">${esc(why || "")}</div>`}
    <button class="btn go" id="keep" style="margin-top:18px;width:100%">OK <kbd>${typeof pad !== "undefined" && pad.active ? "\u24B6" : "Enter"}</kbd></button></div>`,
  );
  const k = b.querySelector("#keep");
  if (k) k.addEventListener("click", closeUI);
}
// ---------------------------------------------------------------- base alarm, soldiers, gunfire
const BM_SOL_POS = [
  [1262, 246],
  [1280, 246],
  [1294, 262],
  [1330.5, 250],
  [1330.5, 280],
  [1258, 296.5],
  [1300, 296.5],
  [1244, 224],
  [1254, 300],
  [1243, 318],
  [1257, 326],
  [1244, 334],
  [1257.5, 340],
  [1236, 345],
  [1264, 345],
];
function bmAlarm(on) {
  BM.alarm = on ? 1 : 0;
  BM.sol = [];
  BM.tr = [];
  if (on)
    for (const [x, y] of BM_SOL_POS)
      BM.sol.push({ x: x * M_T, y: y * M_T, cd: 0.6 + Math.random() * 1.5, a: 0, f: 0 });
}
function bmNearBase(pad) {
  const s = truck,
    p = pad * M_T;
  return (
    s.x > MB.x0 * M_T - p && s.x < MB.x1 * M_T + p && s.y > MB.y0 * M_T - p && s.y < MB.y1 * M_T + p
  );
}
function bmShotSound(d) {
  if (typeof audio === "undefined" || !audio.ctx || !audio.master) return;
  noiseBurst(0.09, 1400 + Math.random() * 600, 0.9, 0.55 / (1 + (d / 45) ** 2));
}
function bmAlarmSound() {
  if (typeof audio === "undefined" || !audio.ctx || !audio.master) return;
  const ac = audio.ctx;
  if (!BM.snd) {
    const o = ac.createOscillator(),
      g = ac.createGain();
    o.type = "sawtooth";
    o.frequency.value = 600;
    g.gain.value = 0;
    o.connect(g);
    g.connect(audio.master);
    o.start();
    BM.snd = { o, g };
  }
  const t = ac.currentTime,
    d = Math.hypot(truck.x - 1256 * M_T, truck.y - 260 * M_T),
    v = BM.alarm ? 0.09 / (1 + (d / 400) ** 2) : 0;
  BM.snd.g.gain.setTargetAtTime(v, t, 0.1);
  BM.snd.o.frequency.setTargetAtTime(560 + 260 * (0.5 + 0.5 * Math.sin(timeS * 3.2)), t, 0.03);
}
function bmUpdate(dt) {
  if (!world.ready) return;
  try {
    const a = BM.act;
    // yard hint
    const Y = world.bmYards && bmYardAt(truck.x, truck.y, 0.5);
    if (Y && BM.hint !== Y) {
      BM.hint = Y;
      const k =
        typeof pad !== "undefined" && pad.active
          ? "Menu \u2630"
          : document.body.classList.contains("touch")
            ? "JOBS"
            : "J";
      flash("\u2620 " + Y.name + " \u2014 press " + k + " for Black Market Jobs");
    } else if (!Y) BM.hint = 0;
    // JOB BOARD box: prompt on entry, auto-open when stopped in it (JOBS button / J / Menu also work in the yard)
    const inJ = Y && bmInBoardBox(Y);
    if (inJ && !BM.jbIn) {
      BM.jbIn = 1;
      flash("\u{1F4CB} JOB BOARD \u2014 stop here to see Black Market Jobs");
    } else if (!inJ) {
      BM.jbIn = 0;
      BM.jbLatch = 0;
      BM.jbT = 0;
    }
    if (inJ && Math.abs(truck.v) < 0.5 && !career.uiOpen && !BM.jbLatch) {
      BM.jbT = (BM.jbT || 0) + dt;
      if (BM.jbT > 0.8) {
        BM.jbLatch = 1;
        bmOpenBoard();
      }
    } else BM.jbT = 0;
    if (a) {
      // fail: wrecked or busted
      if ((typeof BREAKDOWN !== "undefined" && BREAKDOWN.active) || truck.damage >= 100) {
        bmEnd(false, "Your truck was wrecked \u2014 the job is off");
        return;
      }
      if (POL.chase && POL.chase.paying && a.step >= 1) {
        if (truck.trl === a.tr) {
          truck.trl = null;
          truck.th = truck.h;
          const i = world.trailers.indexOf(a.tr);
          if (i >= 0) world.trailers.splice(i, 1);
        }
        bmEnd(false, "BUSTED \u2014 the police seized the tank");
        return;
      }
      a.m.update(a, dt);
    }
    // soldiers fire while the alarm is up and the player is in or near the base
    if (BM.alarm) {
      if (!a && !bmNearBase(60)) bmAlarm(false);
      const near = bmNearBase(25);
      for (const S of BM.sol) {
        const dx = truck.x - S.x,
          dy = truck.y - S.y,
          d = Math.hypot(dx, dy);
        S.a = Math.atan2(dy, dx);
        S.f = Math.max(0, S.f - dt);
        if (!near || d > 120) continue;
        S.cd -= dt;
        if (S.cd > 0) continue;
        S.cd = 0.55 + Math.random() * 1.1;
        S.f = 0.08;
        const hit = Math.random() < 0.55 * (1 - d / 140),
          j = hit ? 0.8 : 4 + Math.random() * 6,
          ja = Math.random() * 6.283;
        BM.tr.push({
          x0: S.x,
          y0: S.y,
          x1: truck.x + Math.cos(ja) * j,
          y1: truck.y + Math.sin(ja) * j,
          t: 0.22,
        });
        bmShotSound(d);
        if (hit) {
          truck.damage = Math.min(100, (truck.damage || 0) + 0.9);
          cam.shake = Math.max(cam.shake || 0, 1.5);
          BM.hits = (BM.hits || 0) + 1;
        }
      }
    }
    for (let i = BM.tr.length - 1; i >= 0; i--) if ((BM.tr[i].t -= dt) <= 0) BM.tr.splice(i, 1);
    bmAlarmSound();
  } catch (e) {
    if (!BM.err) console.warn("Black Market", e);
    BM.err = e;
  }
}
BigRig.on("couple", (e) => {
  const a = BM.act;
  if (a && a.m.onCouple) a.m.onCouple(a, e.trailer);
});
BigRig.on("uncouple", (e) => {
  const a = BM.act;
  if (a && a.m.onUncouple) a.m.onUncouple(a, e.trailer);
});
function bmDrawLow(vx0, vy0, vx1, vy1) {
  if (!BM.alarm) return;
  for (const S of BM.sol) {
    const X = S.x * PPM,
      Y = S.y * PPM;
    if (X < vx0 - 60 || X > vx1 + 60 || Y < vy0 - 60 || Y > vy1 + 60) continue;
    mbSoldier(ctx, X, Y, S.a + Math.PI / 2, 0, "#4d5636");
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(S.a);
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(2, -1, 11, 2.2);
    if (S.f > 0) {
      ctx.fillStyle = "rgba(255,220,120,0.95)";
      ctx.beginPath();
      ctx.arc(15, 0, 4.5, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
}
function bmDrawHigh() {
  if (!BM.tr.length) return;
  ctx.save();
  ctx.lineCap = "round";
  for (const t of BM.tr) {
    const al = Math.min(1, t.t * 6);
    ctx.strokeStyle = "rgba(255,225,130," + al + ")";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(t.x0 * PPM, t.y0 * PPM);
    ctx.lineTo(t.x1 * PPM, t.y1 * PPM);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,190,60," + al + ")";
    ctx.beginPath();
    ctx.arc(t.x0 * PPM, t.y0 * PPM, 7, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}
// mission HUD (left, under the job panel): steps with the current one highlighted
function bmHUD() {
  const a = BM.act,
    hb = document.getElementById("hudbtns");
  if (!a || bigmap.open) {
    if (hb && hb.style.top) hb.style.top = "";
    return;
  }
  // compact panel tucked under the money (fuel) and XP panels, top-left
  const L = a.m.steps(a),
    x = 14,
    y = 140,
    w = 240,
    h = 24 + L.length * 15 + (a.lost ? 15 : 0);
  ctx.save();
  ctx.fillStyle = "rgba(14,6,10,0.82)";
  ctx.strokeStyle = BM.alarm && timeS % 0.6 < 0.3 ? "#ff3b4e" : "#6b1420";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const fit = (t) => {
    if (ctx.measureText(t).width <= w - 18) return t;
    while (t.length > 4 && ctx.measureText(t + "\u2026").width > w - 18) t = t.slice(0, -1);
    return t + "\u2026";
  };
  ctx.fillStyle = "#ff5a6a";
  ctx.font = "bold 11px system-ui,sans-serif";
  ctx.fillText(
    fit("\u2620 " + a.m.name.toUpperCase() + " \u2022 " + money(a.m.pay)),
    x + 9,
    y + 12,
  );
  ctx.font = "11px system-ui,sans-serif";
  L.forEach((s, i) => {
    const done = i < a.step,
      cur = i === a.step;
    ctx.fillStyle = done ? "#7dff8a" : cur ? "#ffd23f" : "rgba(230,220,220,0.5)";
    ctx.fillText(fit((done ? "\u2714 " : cur ? "\u25B6 " : "\u2022 ") + s), x + 9, y + 28 + i * 15);
  });
  if (a.lost) {
    ctx.fillStyle = "#ff8a8a";
    ctx.fillText(fit("\u26A0 Re-couple the marked trailer"), x + 9, y + 28 + L.length * 15);
  }
  ctx.restore();
  // keep the desktop JOBS pill below the panel (canvas px -> CSS px)
  if (hb) {
    const c = document.getElementById("game"),
      k = c && c.clientHeight ? c.clientHeight / VH : 1;
    hb.style.top = Math.round((y + h + 8) * k) + "px";
  }
}

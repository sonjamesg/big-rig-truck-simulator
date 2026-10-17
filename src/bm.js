/**
 * @file bm.js — BLACK MARKET: shady yards (world gen, art, fence collision, map icons, fast travel), the Black Market Jobs board
 *   (illegal missions only, registry BM_MISSIONS for more theft jobs later) Tank Heist + Depot Thefts (soldiers, 2-star escape, numbered reverse-in drop bays, payout breakdown).
 * Exposes (globals): BM, BM_MISSIONS, bmGenYards, bmSolidM, bmMapIcons, bmPOIs, bmAtYard, bmOpenBoard, bmBlockFT, bmUpdate, bmWanted2, bmLoseUpdate, bmBays, bmOnDrop, bmPayout, bmJeepStart, bmExtrasUpdate,
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
  const Z = BM.zone;
  if (Z) {
    // 2-star search area: leave it and stay out of sight to lose the police
    const cx = px(Z.x),
      cy = py(Z.y),
      rr = Math.abs(px(Z.x + Z.r) - cx);
    ctx.fillStyle = "rgba(255,40,60,0.12)";
    ctx.strokeStyle = "rgba(255,60,80," + (0.6 + 0.3 * Math.sin(timeS * 5)) + ")";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
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
  // drop zone: red dashed outline + two numbered reverse-in bays (depot style) at its south end
  const [b0, b1, b2, b3] = Y.bay;
  g.fillStyle = "rgba(200,30,40,0.14)";
  g.fillRect(b0 * T_, b1 * T_, (b2 - b0) * T_, (b3 - b1) * T_);
  g.strokeStyle = "#d8283a";
  g.lineWidth = 4;
  g.setLineDash([16, 10]);
  g.strokeRect(b0 * T_, b1 * T_, (b2 - b0) * T_, (b3 - b1) * T_);
  g.setLineDash([]);
  const BB = bmBays(Y),
    S_ = PPM;
  g.strokeStyle = "rgba(240,240,240,0.85)";
  g.lineWidth = 3;
  for (const q of BB) {
    g.beginPath();
    g.moveTo(q.x0 * S_, q.y0 * S_);
    g.lineTo(q.x0 * S_, q.y1 * S_);
    g.lineTo(q.x1 * S_, q.y1 * S_);
    g.lineTo(q.x1 * S_, q.y0 * S_);
    g.stroke();
    g.fillStyle = "#ececec";
    g.font = "bold 22px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(q.id), q.cx * S_, q.y0 * S_ + 14);
  }
  g.fillStyle = "rgba(240,220,220,0.8)";
  g.font = "bold 22px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const tx = ((b0 + b2) / 2) * T_,
    ty = ((b1 + BB[0].y0 / M_T) / 2) * T_;
  g.fillText("DROP", tx, ty - 10);
  g.font = "bold 12px sans-serif";
  g.fillText("NO QUESTIONS", tx, ty + 12);
  g.font = "bold 10px sans-serif";
  g.fillText("REVERSE IN \u2193", tx, ty + 28);
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
  // v47: every replay picks a different tank: a random parked one, often moved to a random free bay
  const C = world.trailers.filter(
    (t) => t.type === "lowtank" && !t.coupled && t.depot === D && t.bay,
  );
  let tr = C.length ? C[(Math.random() * C.length) | 0] : null;
  const free = D.bays.filter((q) => !q.trailer);
  if (tr && free.length && Math.random() < 0.7 && !onScreen(tr.x, tr.y, 20)) {
    const b = free[(Math.random() * free.length) | 0];
    tr.bay.trailer = null;
    Object.assign(tr, { x: b.kx, y: b.ky, th: b.th, bay: b });
    b.trailer = tr;
  }
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
  par: 420,
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
      // short stealth window: the alarm goes off a few seconds after coupling (sooner if you're spotted)
      if (!BM.alarm) {
        a.alarmAt = timeS + BM_STEALTH_S;
        a.jeepAt = Math.min(a.jeepAt || 1e9, timeS + BM_JEEP_DELAY);
        flash(
          "\u{1F92B} Coupled. Quietly now \u2014 the alarm will go any second, head for the gate!",
        );
      }
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
  loseStep: 2,
  delStep: 3,
  update(a, dt) {
    const s = truck,
      inBase =
        s.x > (MB.x0 - 1) * M_T &&
        s.x < (MB.x1 + 1) * M_T &&
        s.y > (MB.y0 - 1) * M_T &&
        s.y < (MB.y1 + 1) * M_T;
    if (a.step === 1 && !inBase && s.trl === a.tr) {
      a.step = 2;
      bmWanted2(a);
      flash("\u2605\u2605 The police are after the tank \u2014 lose them!");
      clearRoute();
    }
  },
});
// ---- shared heist flow: 2-star search zone (lose step), numbered yard bays + uncouple-to-deliver (deliver step)
const BM_ZONE_R = 320, // m: search circle radius around the last place police saw you
  BM_LOSE_S = 12; // s out of sight (and outside the circle) to shake them off
function bmWanted2(a) {
  WANT.lvl = 2;
  WANT.t = 90;
  WANT.chased = false;
  WANT.sp = 0;
  WANT.sp2 = 0;
  WANT.heat = Math.max(WANT.heat || 0, 230);
  WANT.ht = timeS;
  WANT.star = timeS;
  BM.zone = { x: truck.x, y: truck.y, r: BM_ZONE_R, seen: timeS };
  if (a) a.wantT = timeS;
  // immediate response: pursuers from off-screen road points straight at the player (v49: real chase cars, not searchers)
  WANT.seenT = timeS;
  WANT.pursueUntil = timeS + 40; // pursuers keep coming for the first 40 s whatever they can see
  WANT.lx = truck.x;
  WANT.ly = truck.y;
  for (let k = 0; k < 3; k++) polAuxSpawn() || bmCopSpawn(truck.x, truck.y);
  BM.copT = timeS + 3;
}
// one police car from a random off-screen road point, sent to search around (x, y) [metres]
function bmCopSpawn(x, y) {
  const v = typeof polSpawn === "function" && polSpawn();
  if (!v) return null;
  v.pol.search = true;
  v.pinT = timeS + 1e6;
  aiGoal(v, { entrance: { x, y }, name: "search" });
  v.pol.sg = timeS + 5;
  return v;
}
// lose step: stay at 2 stars until really escaped: no pursuit, unseen for BM_LOSE_S, outside the search circle
function bmLoseUpdate(a) {
  const Z = BM.zone || (BM.zone = { x: truck.x, y: truck.y, r: BM_ZONE_R, seen: timeS });
  const seen =
    POL.chase || polCanSee().length > 0 || POL.aux.some((c) => !c.goal && onView(c.v.x, c.v.y));
  if (seen) {
    Z.x = truck.x;
    Z.y = truck.y;
    Z.seen = timeS;
  }
  const out = Math.hypot(truck.x - Z.x, truck.y - Z.y) > Z.r,
    unseen = timeS - Z.seen;
  Z.out = out;
  Z.unseen = unseen;
  // keep the area busy: top up to 4 searchers converging on the last sighting
  if (timeS > (BM.copT || 0)) {
    BM.copT = timeS + 4;
    const n = POL.cars.filter((v) => Math.hypot(v.x - truck.x, v.y - truck.y) < 480).length;
    if (n + POL.aux.length < 4) bmCopSpawn(Z.x, Z.y);
  }
  if (!(POL.chase && POL.chase.paying)) {
    WANT.lvl = 2;
    WANT.heat = Math.max(WANT.heat || 0, WANT2_HEAT + 20);
    WANT.t = Math.max(WANT.t || 0, 60);
  }
  if (!POL.chase && out && unseen > BM_LOSE_S) {
    BM.zone = null;
    WANT.heat = 0;
    WANT.chased = false;
    WANT.lvl = 2;
    wantClear();
    WANT.lvl = 0;
    if (typeof polEndChase === "function" && POL.chase) polEndChase(true);
    a.step = a.m.delStep;
    a.lostAt = timeS;
    flash("Police lost \u2714 Reverse it into a bay at " + a.yard.name + " and uncouple");
    setRoute(a.yard);
  }
}
// two numbered reverse-in bays inside the yard's drop zone (metres), depot-style (nose north, dock at the south end)
function bmBays(Y) {
  if (Y._bays) return Y._bays;
  const [b0, , b2, b3] = Y.bay,
    bw = (b2 - b0 - 0.5) / 2,
    y1 = b3 - 0.2,
    y0 = y1 - 4.4;
  Y._bays = [0, 1].map((k) => {
    const cxT = b0 + 0.25 + bw * (k + 0.5),
      b = {
        id: k + 1,
        label: "BM-" + (k + 1),
        cx: cxT * M_T,
        cy: ((y0 + y1) / 2) * M_T,
        th: 0,
        w: bw * M_T,
        L: (y1 - y0) * M_T,
        x0: (cxT - bw / 2) * M_T,
        x1: (cxT + bw / 2) * M_T,
        y0: y0 * M_T,
        y1: y1 * M_T,
        dock: y1 * M_T,
        yard: Y,
      };
    b.kx = b.cx;
    b.ky = b.cy - TRL_KP_TO_CENTRE + 0.2;
    return b;
  });
  return Y._bays;
}
// a dropped trailer is "in" a bay when its body sits inside the lines (small margin) and it points along the bay
function bmTrInBay(tr, Y) {
  for (const b of bmBays(Y)) {
    const f = fwd(tr.th),
      box = {
        x: tr.x - f[0] * TRL_KP_TO_CENTRE,
        y: tr.y - f[1] * TRL_KP_TO_CENTRE,
        h: tr.th,
        L: TRL_LEN,
        W: TRL_W,
      };
    const m = 0.35;
    if (Math.abs(wrapA(tr.th - b.th)) > 0.14) continue;
    if (
      obbCorners(box).every(
        (p) => p[0] > b.x0 - m && p[0] < b.x1 + m && p[1] > b.y0 - 1.2 && p[1] < b.y1 + m,
      )
    )
      return b;
  }
  return null;
}
// while coupled and close: which bay is lined up (for the green outline / arrow)
function bmBayState(a) {
  if (!a || a.step !== a.m.delStep || truck.trl !== a.tr) return null;
  let best = null;
  for (const b of bmBays(a.yard)) {
    const al = bayAlign(b);
    if (!al || al.dist > 70) continue;
    if (!best || al.dist < best.al.dist) best = { b, al };
  }
  return best;
}
// delivery happens ONLY here: uncoupling the stolen trailer inside a yard bay on the deliver step
function bmOnDrop(a, tr) {
  if (tr !== a.tr || a.step < 1) return false;
  const b = bmTrInBay(tr, a.yard);
  if (!b) return false;
  if (a.step === a.m.loseStep || wantStars() > 0 || POL.chase) {
    flash("\u26D4 Not while you\u2019re wanted \u2014 lose the police first!");
    a.blk = timeS;
    a.lost = true;
    tr.target = true;
    return true; // stays dropped in the bay; re-couple and drive off, or wait it out elsewhere
  }
  if (a.step !== a.m.delStep) return false;
  bmComplete(a, b);
  return true;
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
      bmWanted2(a);
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
  loseStep: 1,
  delStep: 2,
  update() {},
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
      par: Math.round(150 + c.km * 50),
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
  const a = { m, yard: Y, step: 0, t0: timeS, lost: false, dmg0: truck.damage || 0, kills: 0 };
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
// payout: base pay - cargo damage (damage taken during the job, up to 50%) + time bonus + no-kill bonus
function bmPayout(a) {
  const base = a.m.pay,
    dmg = Math.max(0, (truck.damage || 0) - (a.dmg0 || 0)),
    ded = -Math.round((base * Math.min(0.5, (dmg / 100) * 0.8)) / 10) * 10,
    secs = timeS - (a.cT || a.t0),
    par = a.m.par || 300,
    tb = secs < par ? Math.round((base * 0.12 * (1 - secs / par) + base * 0.03) / 10) * 10 : 0,
    nk = a.kills ? 0 : Math.round((base * 0.08) / 10) * 10;
  return { base, dmg, ded, secs, tb, nk, total: Math.max(0, base + ded + tb + nk) };
}
function bmComplete(a, bay) {
  if (BM.act !== a || a.paid) return; // one payout per job, ever
  a.paid = 1;
  const tr = a.tr;
  if (!BM_MISSIONS.includes(a.m)) BM.offers = {};
  if (truck.trl === tr) {
    truck.trl = null;
    truck.th = truck.h;
  }
  if (tr.bay && tr.bay.trailer === tr) tr.bay.trailer = null;
  const i = world.trailers.indexOf(tr);
  if (i >= 0) world.trailers.splice(i, 1);
  const P = bmPayout(a);
  truck.money += P.total;
  addXP(a.m.xp);
  BM.done = (BM.done || 0) + 1;
  BM.last = P;
  BM.act = null;
  BM.zone = null;
  bmAlarm(false);
  clearRoute();
  if (typeof saveGame === "function") saveGame();
  bmResult(true, a, null, P, bay);
}
function bmResult(ok, a, why, P, bay) {
  BM.res = { ok, t: timeS };
  const row = (l, v, c) =>
    `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span>${l}</span><b style="color:${c || "#fff"}">${v}</b></div>`;
  const mm = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  const brk = P
    ? `<div style="text-align:left;margin:12px auto 0;max-width:340px;font-size:14px">${row("Base pay", money(P.base))}${row("Cargo damage (" + Math.round(P.dmg) + "% hit)", P.ded ? "\u2212" + money(-P.ded) : money(0), P.ded ? "#ff8a8a" : "#9aa")}${row("Time bonus (" + mm(P.secs) + ")", P.tb ? "+" + money(P.tb) : money(0), P.tb ? "#7dff8a" : "#9aa")}${row("No-kill bonus", P.nk ? "+" + money(P.nk) : "\u2014", P.nk ? "#7dff8a" : "#9aa")}<div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:17px"><span style="font-weight:900">TOTAL</span><b style="color:#7dff8a;font-size:20px">${money(P.total)}</b></div></div>`
    : "";
  const b = openModal(
    "result",
    `<div style="padding:22px 26px;text-align:center"><div style="font-size:44px">${ok ? "\u{1F4B0}" : "\u{1F6A8}"}</div><h2>${ok ? "PAYOUT" : "JOB FAILED"}</h2>
    <div class="sub">${esc(a.m.name)} \u2022 ${esc(a.yard.name)}${bay ? " \u2022 bay " + bay.id : ""}</div>
    ${ok ? `<div style="font-size:40px;font-weight:900;color:#7dff8a;margin:14px 0 4px">${money(P ? P.total : a.m.pay)}</div><div style="color:#ffd23f;font-weight:800">+${a.m.xp} XP \u2022 cash in hand, no receipt</div>${brk}` : `<div style="font-size:18px;color:#ff8a8a;margin:14px 0">${esc(why || "")}</div>`}
    <button class="btn go" id="keep" style="margin-top:18px;width:100%">OK <kbd>${typeof pad !== "undefined" && pad.active ? "\u24B6" : "Enter"}</kbd></button></div>`,
  );
  const k = b.querySelector("#keep");
  if (k) k.addEventListener("click", closeUI);
}
// ---------------------------------------------------------------- base alarm, soldiers, gunfire
const BM_SOL_POS = [
  [1262, 246],
  [1280, 246],
  [1331, 262],
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
  // v49: second wave (alarm now turns out ~24): yard edges, the south-street verge, accommodation fronts
  [1300, 243.5],
  [1322, 243.5],
  [1336, 270],
  [1336, 289],
  [1270, 301],
  [1286, 301],
  [1312, 301],
  [1328, 301],
  [1246, 306],
  [1253.5, 316],
  [1246, 290],
  [1254, 262],
  [1338, 300.5],
];
// doors the soldiers pour out of when the alarm sounds (guard huts, depot office, accommodation blocks, armoury, NAAFI)
const BM_DOORS = [
  [1242, 337.6],
  [1257.5, 337.6],
  [1268, 241.8],
  [1282, 241.8],
  [1277, 303.4],
  [1319, 303.4],
  [1361, 303.4],
  [1277, 327.6],
  [1319, 327.6],
  [1349, 246.8],
  [1353, 259.4],
];
// riflemen (single aimed shots) and machine gunners (short bursts); every replay shuffles the posts
function bmAlarm(on) {
  BM.alarm = on ? 1 : 0;
  BM.sol = [];
  BM.tr = [];
  BM.fx = [];
  if (!on) return;
  BM.alarmT = timeS;
  const pts = BM_SOL_POS.slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, BM_SOL_N);
  pts.forEach(([x, y], i) => {
    const cx = (x + (Math.random() - 0.5) * 2.5) * M_T,
      cy = (y + (Math.random() - 0.5) * 2.5) * M_T;
    let d0 = BM_DOORS[0],
      dd = 1e9;
    for (const q of BM_DOORS) {
      const d = Math.hypot(q[0] * M_T - cx, q[1] * M_T - cy);
      if (d < dd) {
        dd = d;
        d0 = q;
      }
    }
    // v49: everyone turns out of a door (never pops up in place) and runs to the post before firing
    BM.sol.push({
      x: d0[0] * M_T + (Math.random() - 0.5) * 3,
      y: d0[1] * M_T + (Math.random() - 0.5) * 1.5,
      cx,
      cy,
      mg: i % 3 === 1,
      st: "wait",
      wait: 0.2 + i * 0.2 + Math.random() * 0.5,
      a: 0,
      ph: Math.random() * 6,
      cd: 0.8 + Math.random() * 1.2,
      burst: 0,
      f: 0,
      move: 0,
    });
  });
}
function bmGunSound(mg, d) {
  if (typeof audio === "undefined" || !audio.ctx || !audio.master) return;
  const v = 1 / (1 + (d / 50) ** 2);
  if (mg) {
    noiseBurst(0.07, 700 + Math.random() * 200, 1.2, 0.5 * v);
    noiseBurst(0.04, 3200, 0.9, 0.18 * v, "highpass");
  } else {
    noiseBurst(0.14, 1700 + Math.random() * 400, 0.7, 0.55 * v);
    noiseBurst(0.05, 5200, 1, 0.3 * v, "highpass");
  }
}
function bmNearBase(pad) {
  const s = truck,
    p = pad * M_T;
  return (
    s.x > MB.x0 * M_T - p && s.x < MB.x1 * M_T + p && s.y > MB.y0 * M_T - p && s.y < MB.y1 * M_T + p
  );
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
const BM_RANGE = { rifle: 52, mg: 66 }, // m (was 120)
  BM_DMG = { rifle: 1.0, mg: 0.7 }, // damage % per hit (v49: trimmed from 1.2/0.8 as the alarm now turns out twice the soldiers)
  BM_SOL_N = 24; // soldiers turned out by the alarm (was 12)
function bmFx(k, x, y, o) {
  if (!BM.fx) BM.fx = [];
  if (BM.fx.length > 140) BM.fx.shift();
  BM.fx.push(Object.assign({ k, x, y, t: 0, life: 0.5 }, o || {}));
}
// the stolen trailer/truck as hit boxes (metres)
function bmTargets() {
  const out = [{ x: truck.x, y: truck.y, h: truck.h, L: 6.4, W: 2.5, cab: 1 }];
  const tr = truck.trl;
  if (tr) {
    const f = fwd(tr.th);
    out.push({
      x: tr.x - f[0] * TRL_KP_TO_CENTRE,
      y: tr.y - f[1] * TRL_KP_TO_CENTRE,
      h: tr.th,
      L: TRL_LEN,
      W: TRL_W,
      tr,
    });
  }
  return out;
}
function bmHitBox(px, py) {
  for (const b of bmTargets()) {
    const f = fwd(b.h),
      dx = px - b.x,
      dy = py - b.y,
      al = dx * f[0] + dy * f[1],
      la = dx * -f[1] + dy * f[0];
    if (Math.abs(al) < b.L / 2 && Math.abs(la) < b.W / 2) return { b, al, la };
  }
  return null;
}
function bmSoldierUpdate(S, dt, near) {
  S.f = Math.max(0, S.f - dt);
  if (S.st === "wait") {
    if ((S.wait -= dt) <= 0) S.st = "run";
    return;
  }
  const dx = truck.x - S.x,
    dy = truck.y - S.y,
    d = Math.hypot(dx, dy),
    R = S.mg ? BM_RANGE.mg : BM_RANGE.rifle;
  // dive away from a truck bearing down on you
  if (d < 11 && S.st !== "run" && Math.abs(truck.v) > 3) {
    const q = Math.atan2(dy, dx) + (Math.random() < 0.5 ? 1.6 : -1.6);
    S.cx = S.x + Math.cos(q) * 9;
    S.cy = S.y + Math.sin(q) * 9;
    S.st = "run";
  }
  if (S.st === "run") {
    const ex = S.cx - S.x,
      ey = S.cy - S.y,
      e = Math.hypot(ex, ey),
      sp = 5.4 * dt;
    S.ph += dt * 13;
    S.a = Math.atan2(ey, ex);
    if (e <= sp) {
      S.x = S.cx;
      S.y = S.cy;
      S.st = S.mg || Math.random() < 0.7 ? "kneel" : "stand";
      S.cd = 0.6 + Math.random() * 0.9;
    } else {
      S.x += (ex / e) * sp;
      S.y += (ey / e) * sp;
    }
    return;
  }
  // aim: turn toward the truck at a human rate
  const want = Math.atan2(dy, dx),
    da = wrapA(want - S.a);
  S.a += Math.max(-3 * dt, Math.min(3 * dt, da));
  if (!near || d > R) return;
  S.cd -= dt;
  if (S.cd > 0 || Math.abs(da) > 0.25) return;
  if (S.mg) {
    if (S.burst <= 0) S.burst = 5 + ((Math.random() * 5) | 0);
    S.burst--;
    S.cd = S.burst > 0 ? 0.085 : 2.2 + Math.random() * 1.4;
  } else S.cd = 0.9 + Math.random() * 1.0;
  bmShoot(S, d, R);
}
function bmShoot(S, d, R) {
  S.f = 0.07;
  const mx = S.x + Math.cos(S.a) * 1.4,
    my = S.y + Math.sin(S.a) * 1.4;
  // spread grows with range and the truck's speed; ~1 in 4 rounds falls short
  const g = (Math.random() + Math.random() + Math.random() - 1.5) * 1.15,
    spr = (S.mg ? 0.085 : 0.055) + Math.abs(truck.v) * 0.0035 + (d / R) * 0.03,
    ang = Math.atan2(truck.y - S.y, truck.x - S.x) + g * spr,
    short = Math.random() < 0.26,
    dist = d * (short ? 0.45 + Math.random() * 0.4 : 0.92 + Math.random() * 0.22),
    ix = S.x + Math.cos(ang) * dist,
    iy = S.y + Math.sin(ang) * dist;
  const h = !short && bmHitBox(ix, iy);
  BM.tr.push({ x0: mx, y0: my, x1: ix, y1: iy, t: S.mg && Math.random() < 0.5 ? 0 : 0.16 });
  bmFx("flash", mx, my, { a: S.a, life: 0.06, mg: S.mg });
  bmFx("case", S.x, S.y, {
    vx: Math.cos(S.a + 1.6) * (2 + Math.random()),
    vy: Math.sin(S.a + 1.6) * (2 + Math.random()),
    life: 0.5,
  });
  bmGunSound(S.mg, d);
  if (h) {
    // phone touch steering is coarser: rounds land a little softer there
    const tk = document.body.classList.contains("touch") ? 0.8 : 1;
    // v49: bulletproof panels (customiser) scale every round: soldiers, jeep MG, police
    const dm = (S.mg ? BM_DMG.mg : BM_DMG.rifle) * (S.jeep ? 0.6 : 1) * tk * (truck.bulM || 1);
    truck.damage = Math.min(100, (truck.damage || 0) + dm);
    BM.dmgGun = (BM.dmgGun || 0) + dm;
    cam.shake = Math.max(cam.shake || 0, 1.2);
    BM.hits = (BM.hits || 0) + 1;
    for (let k = 0; k < 4; k++)
      bmFx("spark", ix, iy, {
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14,
        life: 0.18 + Math.random() * 0.12,
      });
    if (h.b.tr) {
      const H = (h.b.tr.holes = h.b.tr.holes || []);
      if (H.length < 48) H.push([h.al, h.la]);
    }
    if (typeof noiseBurst === "function" && audio.ctx) noiseBurst(0.05, 3800, 3, 0.25, "bandpass");
  } else {
    BM.miss = (BM.miss || 0) + 1;
    bmFx("dust", ix, iy, { life: 0.7 + Math.random() * 0.4, r: 0.6 + Math.random() * 0.8 });
  }
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
      if (BM.act === a && a.step === a.m.loseStep) bmLoseUpdate(a);
    }
    // soldiers: run from the doors to cover, kneel, aim, fire (riflemen single shots, MG bursts) while you're near
    if (BM.alarm) {
      if (!a && !bmNearBase(60)) bmAlarm(false);
      const near = bmNearBase(25);
      for (const S of BM.sol) bmSoldierUpdate(S, dt, near);
    }
    bmExtrasUpdate(a, dt);
    for (let i = BM.tr.length - 1; i >= 0; i--) if ((BM.tr[i].t -= dt) <= 0) BM.tr.splice(i, 1);
    for (let i = (BM.fx || []).length - 1; i >= 0; i--) {
      const q = BM.fx[i];
      q.t += dt;
      q.x += (q.vx || 0) * dt;
      q.y += (q.vy || 0) * dt;
      if (q.t > q.life) BM.fx.splice(i, 1);
    }
    bmAlarmSound();
  } catch (e) {
    if (!BM.err) console.warn("Black Market", e);
    BM.err = e;
  }
}
BigRig.on("couple", (e) => {
  const a = BM.act;
  if (a && e.trailer === a.tr && !a.cT) a.cT = timeS;
  if (a && a.m.onCouple) a.m.onCouple(a, e.trailer);
});
BigRig.on("uncouple", (e) => {
  const a = BM.act;
  if (!a) return;
  if (bmOnDrop(a, e.trailer)) return;
  if (a.m.onUncouple) a.m.onUncouple(a, e.trailer);
});
// top-down soldier: shadow, legs (running), body + pack, helmet, weapon (rifle or MG with ammo box)
function bmSoldierSprite(S) {
  const X = S.x * PPM,
    Y = S.y * PPM,
    g = ctx;
  g.save();
  g.translate(X, Y);
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(2, 2, 6, 4.5, 0, 0, 7);
  g.fill();
  g.rotate(S.a);
  const run = S.st === "run",
    kn = S.st === "kneel",
    sw = run ? Math.sin(S.ph) * 3.2 : 0;
  g.fillStyle = "#2b2f22";
  if (run) {
    g.fillRect(-1 + sw, -3.2, 4, 2);
    g.fillRect(-1 - sw, 1.2, 4, 2);
  } else if (kn) {
    g.fillRect(1.5, -3.4, 5, 2.2); // forward knee
    g.fillRect(-5, 1.1, 4.5, 2.2); // folded leg behind
  }
  // body (narrower when kneeling: hunched)
  g.fillStyle = S.mg ? "#4a5530" : "#55603a";
  g.beginPath();
  g.ellipse(0, 0, kn ? 3.2 : 3.6, 4.6, 0, 0, 7);
  g.fill();
  g.fillStyle = "#3a4226";
  g.fillRect(-4.6, -2.6, 2.4, 5.2); // pack
  // weapon
  g.fillStyle = "#151515";
  if (S.mg) {
    g.fillRect(1, -1.1, 13, 2.2);
    g.fillRect(4, 1, 3.5, 3); // ammo box
    g.strokeStyle = "#151515";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(11, 0);
    g.lineTo(13, -3);
    g.moveTo(11, 0);
    g.lineTo(13, 3);
    g.stroke();
  } else g.fillRect(1, 1.2, 10, 1.6);
  // arms toward the weapon
  g.fillStyle = "#4b5532";
  g.fillRect(0.5, -3.2, 4, 1.8);
  g.fillRect(0.5, 1.6, 5, 1.8);
  // helmet
  g.fillStyle = "#4f5f2c";
  g.beginPath();
  g.arc(0.3, 0, 2.6, 0, 7);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 0.7;
  g.stroke();
  g.restore();
}
function bmDrawLow(vx0, vy0, vx1, vy1) {
  const A = BM.act;
  bmStingerDraw();
  bmSmokeDraw();
  bmJeepDraw();
  if (A && A.step === A.m.delStep) {
    // bays: amber when close, green when lined up (like depot bays); pulsing arrow over the free bays near the yard
    const st = bmBayState(A),
      S_ = PPM,
      p = 0.6 + 0.4 * Math.sin(timeS * 4);
    if (st) {
      const b = st.b,
        col = st.al.ready || st.al.ok ? "#2ee66b" : "#f5b82e";
      ctx.save();
      ctx.globalAlpha = 0.35 * p;
      ctx.fillStyle = col;
      ctx.fillRect(b.x0 * S_, b.y0 * S_, (b.x1 - b.x0) * S_, (b.y1 - b.y0) * S_);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.setLineDash(st.al.ok ? [] : [10, 7]);
      ctx.strokeRect(b.x0 * S_, b.y0 * S_, (b.x1 - b.x0) * S_, (b.y1 - b.y0) * S_);
      ctx.restore();
      A.bayOk = st.al.ok ? st.b : null;
    } else A.bayOk = null;
    const Y = A.yard;
    if (Math.hypot(truck.x - Y.entrance.x, truck.y - Y.entrance.y) < 160)
      for (const b of bmBays(Y)) {
        const X = b.cx * S_,
          Yp = (b.y0 - 3 - Math.sin(timeS * 5) * 1.2) * S_;
        ctx.fillStyle = "rgba(46,230,107,0.9)";
        ctx.beginPath();
        ctx.moveTo(X - 10, Yp - 14);
        ctx.lineTo(X + 10, Yp - 14);
        ctx.lineTo(X + 10, Yp);
        ctx.lineTo(X + 18, Yp);
        ctx.lineTo(X, Yp + 18);
        ctx.lineTo(X - 18, Yp);
        ctx.lineTo(X - 10, Yp);
        ctx.closePath();
        ctx.fill();
      }
  }
  // dust kicked up by misses + brass casings on the ground
  for (const q of BM.fx || []) {
    const X = q.x * PPM,
      Y = q.y * PPM;
    if (q.k === "dust") {
      const u = q.t / q.life;
      ctx.fillStyle = "rgba(170,150,115," + 0.55 * (1 - u) + ")";
      ctx.beginPath();
      ctx.arc(X, Y, (q.r + u * 1.6) * PPM, 0, 7);
      ctx.fill();
    } else if (q.k === "case") {
      ctx.fillStyle = "#d8b24a";
      ctx.fillRect(X - 1, Y - 0.6, 2, 1.2);
    }
  }
  if (!BM.alarm) return;
  for (const S of BM.sol) {
    if (S.st === "wait") continue;
    const X = S.x * PPM,
      Y = S.y * PPM;
    if (X < vx0 - 60 || X > vx1 + 60 || Y < vy0 - 60 || Y > vy1 + 60) continue;
    bmSoldierSprite(S);
  }
}
function bmDrawHigh() {
  const a = BM.act;
  // bullet holes on the stolen trailer
  const tr = a && a.tr;
  if (tr && tr.holes && tr.holes.length) {
    const f = fwd(tr.th),
      cx = tr.x - f[0] * TRL_KP_TO_CENTRE,
      cy = tr.y - f[1] * TRL_KP_TO_CENTRE;
    ctx.save();
    ctx.translate(cx * PPM, cy * PPM);
    ctx.rotate(tr.th);
    for (const [al, la] of tr.holes) {
      ctx.fillStyle = "rgba(20,20,20,0.85)";
      ctx.beginPath();
      ctx.arc(la * PPM, -al * PPM, 1.6, 0, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(200,200,200,0.5)";
      ctx.beginPath();
      ctx.arc(la * PPM + 0.6, -al * PPM - 0.6, 0.8, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.lineCap = "round";
  for (const t of BM.tr) {
    if (t.t <= 0) continue;
    const al = Math.min(1, t.t * 7);
    ctx.strokeStyle = "rgba(255,225,130," + al + ")";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    // tracer streak: the leading 40% of the line
    ctx.moveTo(t.x0 * PPM + (t.x1 - t.x0) * PPM * 0.6, t.y0 * PPM + (t.y1 - t.y0) * PPM * 0.6);
    ctx.lineTo(t.x1 * PPM, t.y1 * PPM);
    ctx.stroke();
  }
  for (const q of BM.fx || []) {
    const X = q.x * PPM,
      Y = q.y * PPM,
      u = q.t / q.life;
    if (q.k === "flash") {
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(q.a);
      ctx.fillStyle = "rgba(255,230,140," + (1 - u) + ")";
      ctx.beginPath();
      const L = q.mg ? 9 : 7;
      ctx.moveTo(0, -2.5);
      ctx.lineTo(L, 0);
      ctx.lineTo(0, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,220," + (1 - u) + ")";
      ctx.beginPath();
      ctx.arc(1, 0, 2.6, 0, 7);
      ctx.fill();
      ctx.restore();
    } else if (q.k === "spark") {
      ctx.fillStyle = "rgba(255," + (200 - u * 120) + ",60," + (1 - u) + ")";
      ctx.fillRect(X - 1, Y - 1, 2.2, 2.2);
    }
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
  const L = a.m.steps(a).slice(),
    Z = BM.zone;
  if (a.step === a.m.loseStep && Z)
    L.splice(
      a.step + 1,
      0,
      POL.chase
        ? "   \u{1F6A8} In pursuit \u2014 break line of sight"
        : !Z.out
          ? "   \u25CB Leave the red search circle on the map"
          : "   \u23F1 Stay hidden " + Math.max(0, BM_LOSE_S - Z.unseen).toFixed(0) + " s",
    );
  // live cargo value: drops as the rig gets shot up / crashed
  if (a.step >= 1) {
    const P = bmPayout(a);
    L.push(
      "   \u{1F4B0} Cargo value " +
        money(a.m.pay + P.ded) +
        (P.ded ? " (" + money(P.ded) + " damage)" : ""),
    );
  }
  const x = 14,
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
    if (s.startsWith("   ")) {
      ctx.fillStyle = "#7fd8ff";
      ctx.fillText(fit(s.trim()), x + 19, y + 28 + i * 15);
      return;
    }
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

// heist hooks: police chases during a heist are for the stolen goods (not a "pedestrian"); count pedestrian kills (no-kill bonus)
setTimeout(() => {
  const po = polOffence;
  polOffence = function (type, v, reason) {
    const a = BM.act;
    if (a && a.step >= 1 && type === "pedestrian" && reason === "hit a pedestrian")
      return po.call(this, type, v, "stolen " + (a.m.id === "tank" ? "tank" : "trailer"));
    return po.apply(this, arguments);
  };
  const ph = polPedHit;
  polPedHit = function () {
    if (BM.act) BM.act.kills = (BM.act.kills || 0) + 1;
    return ph.apply(this, arguments);
  };
}, 0);

// ===================== v47 heist extras: stealth window, army jeep pursuit, smoke, stingers, busted, save safety, chase music
const BM_STEALTH_S = 5, // s after coupling before the alarm sounds (unless you're spotted first)
  BM_BUST_FINE = 2500, // £ fine for being caught with stolen army/depot cargo
  BM_JEEP_S = 80, // s the army jeep keeps after you (v49: was 38)
  BM_JEEP_DELAY = 12; // v49: s after coupling (or the alarm, whichever is first) before the jeep sets off
// stealth: searchlights (night) and the guard huts notice you; coupling starts a short countdown to the alarm
function bmStealthUpdate(a, dt) {
  if (a.m.id !== "tank" || BM.alarm) return;
  const s = truck;
  if (!bmNearBase(0)) {
    a.sus = Math.max(0, (a.sus || 0) - dt);
    return;
  }
  let seen = false;
  const night = typeof DN !== "undefined" && DN.dark > 0.5;
  if (night && typeof mbSearch === "function")
    for (const p of mbSearch(timeS))
      if (Math.hypot(s.x - (p.x / TILE) * M_T, s.y - (p.y / TILE) * M_T) < 22) seen = true;
  // the guard huts by the gate notice anything moving fast near them
  if (Math.hypot(s.x - 1250 * M_T, s.y - 334.5 * M_T) < 60 && Math.abs(s.v) > 6) seen = true;
  a.sus = Math.max(0, (a.sus || 0) + (seen ? dt : -dt * 0.5));
  if (seen && !a.susMsg) {
    a.susMsg = true;
    flash("\u{1F441} Careful \u2014 you're being watched. Slow down, keep out of the lights");
  }
  if (!seen) a.susMsg = false;
  const trip = a.sus > 2.5 || (a.alarmAt && timeS >= a.alarmAt);
  if (trip) {
    bmAlarm(true);
    a.jeepAt = Math.min(a.jeepAt || 1e9, timeS + BM_JEEP_DELAY);
    flash(
      a.sus > 2.5
        ? "\u{1F6A8} SPOTTED! Alarm \u2014 the gate is in lockdown, ram the barrier!"
        : "\u{1F6A8} ALARM! Soldiers are coming out \u2014 smash through the gate barrier!",
    );
  }
}
// the army jeep: follows your trail out of the gate with a gunner on the back
function bmJeepStart() {
  // v49: sets off from the motor pool along your tyre track (recorded since coupling), ~60 m behind you if the track is long enough
  const C = BM.crumbs && BM.crumbs.length > 1 ? BM.crumbs : [[truck.x, truck.y]];
  let k = 0;
  for (let q = C.length - 1; q >= 0; q--)
    if (Math.hypot(C[q][0] - truck.x, C[q][1] - truck.y) > 60) {
      k = q;
      break;
    }
  BM.crumbs = C;
  const far = Math.hypot(C[k][0] - truck.x, C[k][1] - truck.y) > 60,
    x = far ? C[k][0] : 1243 * M_T,
    y = far ? C[k][1] : 262 * M_T;
  BM.jeep = {
    x,
    y,
    h: Math.atan2(
      C[Math.min(k + 1, C.length - 1)][0] - x,
      -(C[Math.min(k + 1, C.length - 1)][1] - y),
    ),
    v: far ? 12 : 0,
    k,
    t: timeS,
    S: { x: 0, y: 0, a: 0, mg: true, jeep: 1, f: 0, burst: 0, cd: 1.5 },
  };
  BM.jeepT = timeS;
  flash("\u{1F699} Army jeep on your tail \u2014 keep moving!");
}
function bmJeepUpdate(dt) {
  const J = BM.jeep,
    C = BM.crumbs;
  if (!J) return;
  const L = C[C.length - 1];
  if (Math.hypot(truck.x - L[0], truck.y - L[1]) > 2) C.push([truck.x, truck.y]);
  const dT = Math.hypot(truck.x - J.x, truck.y - J.y),
    over = timeS - J.t > BM_JEEP_S || dT > 300;
  // drive along the breadcrumb trail, holding ~24 m off the trailer (v49)
  while (J.k < C.length - 1 && Math.hypot(C[J.k][0] - J.x, C[J.k][1] - J.y) < 3) J.k++;
  const P = C[Math.min(J.k, C.length - 1)],
    want = Math.atan2(P[0] - J.x, -(P[1] - J.y)),
    vt = over ? 0 : dT > 36 ? 28 : dT > 24 ? Math.abs(truck.v) + 3 : Math.abs(truck.v) * 0.85;
  J.h += Math.max(-2.2 * dt, Math.min(2.2 * dt, wrapA(want - J.h)));
  J.v += Math.max(-9 * dt, Math.min(6 * dt, vt - J.v));
  const f = fwd(J.h);
  J.x += f[0] * J.v * dt;
  J.y += f[1] * J.v * dt;
  if (over && J.v < 0.5) {
    if (!J.gone) flash("The jeep has given up \u2014 now lose the police");
    BM.jeep = null;
    return;
  }
  const S = J.S;
  S.x = J.x - f[0] * 1.2;
  S.y = J.y - f[1] * 1.2;
  S.st = "stand";
  S.f = Math.max(0, S.f - dt);
  const want2 = Math.atan2(truck.y - S.y, truck.x - S.x),
    da = wrapA(want2 - S.a);
  S.a += Math.max(-3 * dt, Math.min(3 * dt, da));
  if (over || dT > BM_RANGE.mg) return;
  S.cd -= dt;
  if (S.cd > 0 || Math.abs(da) > 0.3) return;
  if (S.burst <= 0) S.burst = 4 + ((Math.random() * 4) | 0);
  S.burst--;
  S.cd = S.burst > 0 ? 0.11 : 2.6 + Math.random() * 1.6;
  bmShoot(S, dT, BM_RANGE.mg * 1.3); // bouncing jeep: wider spread
}
function bmJeepDraw() {
  const J = BM.jeep;
  if (!J) return;
  const g = ctx,
    T_ = TILE / M_T;
  g.save();
  g.translate(J.x * T_, J.y * T_);
  g.rotate(J.h);
  g.fillStyle = "rgba(0,0,0,.3)";
  g.fillRect(-1.1 * T_ + 2, -2.2 * T_ + 2, 2.2 * T_, 4.4 * T_);
  g.fillStyle = "#4d5b34";
  g.fillRect(-1.1 * T_, -2.2 * T_, 2.2 * T_, 4.4 * T_);
  g.fillStyle = "#39452a";
  g.fillRect(-1.1 * T_, -2.2 * T_, 2.2 * T_, 1.3 * T_);
  g.fillStyle = "#1c2214";
  g.fillRect(-0.95 * T_, -0.8 * T_, 1.9 * T_, 0.35 * T_);
  g.fillStyle = "#2b2b2b";
  for (const [sx, sy] of [
    [-1.2, -1.5],
    [1, -1.5],
    [-1.2, 1.2],
    [1, 1.2],
  ])
    g.fillRect(sx * T_, sy * T_, 0.2 * T_, 0.7 * T_);
  g.restore();
  bmSoldierSprite(J.S);
}
// smoke from a badly shot-up cab
function bmSmokeUpdate(dt) {
  const d = truck.damage || 0;
  if (d < 55) return;
  BM.smT = (BM.smT || 0) - dt;
  if (BM.smT > 0) return;
  BM.smT = d > 80 ? 0.06 : 0.14;
  const f = fwd(truck.h);
  bmFx("smoke", truck.x + f[0] * 2.4, truck.y + f[1] * 2.4, {
    vx: (Math.random() - 0.5) * 1.5 - f[0] * truck.v * 0.3,
    vy: (Math.random() - 0.5) * 1.5 - f[1] * truck.v * 0.3,
    life: 1.4 + Math.random(),
    dark: d > 80,
  });
}
function bmSmokeDraw() {
  const g = ctx,
    T_ = TILE / M_T;
  for (const q of BM.fx || []) {
    if (q.k !== "smoke") continue;
    const u = q.t / q.life;
    g.fillStyle = q.dark
      ? `rgba(30,30,30,${0.55 * (1 - u)})`
      : `rgba(150,150,150,${0.45 * (1 - u)})`;
    g.beginPath();
    g.arc(q.x * T_, q.y * T_, (0.8 + u * 2.6) * T_, 0, 6.283);
    g.fill();
  }
}
// stingers: a spike strip laid across half the road in front of each roadblock (swerve round it)
function bmStingerUpdate() {
  if (typeof RB === "undefined") return;
  for (const B of RB.list)
    if (!B.st) {
      const half = Math.random() < 0.5 ? 0 : 1,
        h = B.u[1] === 0,
        c = h ? B.y : B.x,
        span = 4.2;
      B.st = {
        x: B.x - B.u[0] * 22,
        y: B.y - B.u[1] * 22,
        h,
        c0: half ? c : c - span,
        c1: half ? c + span : c,
      };
    }
  const s = truck;
  if (BM.flatT && timeS > BM.flatT) BM.flatT = 0;
  for (const B of RB.list) {
    const S = B.st;
    if (!S || S.hit) continue;
    const along = S.h ? s.x - S.x : s.y - S.y,
      cr = S.h ? s.y : s.x;
    if (Math.abs(along) < 1.6 && cr > S.c0 - 1.2 && cr < S.c1 + 1.2) {
      S.hit = true;
      BM.flatT = timeS + 25;
      s.damage = Math.min(100, (s.damage || 0) + 4);
      flash("\u{1F4A5} STINGER! Tyres shredded \u2014 you're limping");
      if (typeof noiseBurst === "function" && audio.ctx) noiseBurst(0.6, 2500, 0.5, 0.4);
    }
  }
  if (BM.flatT) s.v = Math.max(-6, Math.min(s.v, 11)); // ~25 mph on shredded tyres
}
function bmStingerDraw() {
  if (typeof RB === "undefined") return;
  const g = ctx,
    T_ = TILE / M_T;
  for (const B of RB.list) {
    const S = B.st;
    if (!S) continue;
    g.fillStyle = S.hit ? "#555" : "#d8d8d8";
    for (let c = S.c0; c < S.c1; c += 0.5) {
      const x = S.h ? S.x : c,
        y = S.h ? c : S.y;
      g.fillRect(x * T_ - 3, y * T_ - 3, 6, 6);
      g.fillStyle = S.hit ? "#444" : "#222";
      g.fillRect(x * T_ - 1, y * T_ - 1, 2, 2);
      g.fillStyle = S.hit ? "#555" : "#d8d8d8";
    }
  }
}
// chase music: a pulsing bass + hats loop that gets louder in a pursuit
function bmMusicUpdate(a) {
  if (typeof audio === "undefined" || !audio.ctx || !audio.master) return;
  const on = a && a.step >= 1 && a.step <= a.m.loseStep;
  if (!on) {
    BM.mus = 0;
    return;
  }
  const ac = audio.ctx,
    lvl = POL.chase || BM.jeep || BM.alarm ? 1 : 0.55;
  if (!BM.mus || BM.mus < ac.currentTime) BM.mus = ac.currentTime + 0.05;
  const BEAT = 0.18;
  while (BM.mus < ac.currentTime + 0.3) {
    const t = BM.mus,
      n = (BM.musN = ((BM.musN || 0) + 1) % 16);
    const o = ac.createOscillator(),
      gn = ac.createGain();
    o.type = "sawtooth";
    o.frequency.value = [55, 55, 65.4, 55, 49, 55, 73.4, 65.4][(n >> 1) % 8];
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.09 * lvl, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.9);
    o.connect(gn).connect(audio.master);
    o.start(t);
    o.stop(t + BEAT);
    if (n % 2 && typeof noiseBurst === "function")
      setTimeout(
        () => noiseBurst(0.03, 7000, 1, 0.08 * lvl, "highpass"),
        (t - ac.currentTime) * 1000,
      );
    BM.mus += BEAT;
  }
}
// busted during a heist: arrested, cargo seized, fine taken, you keep your truck
const _bmFinePopup = polFinePopup;
polFinePopup = function () {
  const a = BM.act,
    c = POL.chase;
  if (a && c && !c.paying && a.step >= 1 && a.step <= a.m.loseStep && truck.trl === a.tr) {
    c.arrest = true;
    a.busted = true;
    c.offs.push({
      type: "heist",
      amount: BM_BUST_FINE,
      reason: "Caught with stolen " + (a.m.id === "tank" ? "army tank" : "trailer"),
    });
  }
  return _bmFinePopup();
};
const _bmPolPay = polPay;
polPay = function () {
  const a = BM.act;
  _bmPolPay();
  if (a && a.busted) {
    const tr = a.tr;
    if (tr && truck.trl === tr) {
      tr.coupled = false;
      truck.trl = null;
    }
    const i = tr ? world.trailers.indexOf(tr) : -1;
    if (i >= 0) world.trailers.splice(i, 1);
    a.tr = null;
    BM.jeep = null;
    bmEnd(
      false,
      "\u{1F6A8} BUSTED \u2014 cargo seized, fined " +
        money(BM_BUST_FINE) +
        ". You keep your truck.",
    );
    if (typeof saveGame === "function") saveGame();
  }
};
// save safety: a heist is never saved mid-way, so quitting abandons it (the stolen trailer isn't written out) and pay can't repeat
const _bmSaveGame = saveGame;
saveGame = function () {
  const a = BM.act,
    t = truck.trl;
  if (!a) return _bmSaveGame();
  const hide = t && t === a.tr;
  if (hide) truck.trl = null;
  try {
    localStorage.setItem("bigrig.bmAbandon", a.m.name);
    return _bmSaveGame();
  } finally {
    if (hide) truck.trl = t;
  }
};
function bmLoadCheck() {
  if (BM.loadChk || !world.ready) return;
  BM.loadChk = true;
  const n = localStorage.getItem("bigrig.bmAbandon");
  if (n && !BM.act) {
    localStorage.removeItem("bigrig.bmAbandon");
    flash(
      "\u2620 " +
        n +
        " was abandoned when you left \u2014 no pay. Take a new job at a Black Market yard.",
    );
  }
}
// per-frame hook for all of the above (called from bmUpdate)
function bmExtrasUpdate(a, dt) {
  bmLoadCheck();
  if (!a) {
    BM.jeep = null;
    BM.crumbs = null;
    BM.flatT = 0;
    localStorage.removeItem("bigrig.bmAbandon");
  } else {
    if (a.step === 1 && a.m.id === "tank" && !BM.alarm) bmStealthUpdate(a, dt);
    else if (a.step === 0) bmStealthUpdate(a, dt);
    if (a.step >= a.m.delStep) BM.jeep = null;
    // v49: record the tyre track from coupling/alarm, then launch the jeep BM_JEEP_DELAY s later
    else if (a.m.id === "tank" && a.jeepAt) {
      const C = (BM.crumbs = BM.crumbs || [[truck.x, truck.y]]),
        L = C[C.length - 1];
      if (!BM.jeep && Math.hypot(truck.x - L[0], truck.y - L[1]) > 2) C.push([truck.x, truck.y]);
      if (!a.jeepGo && timeS >= a.jeepAt) {
        a.jeepGo = 1;
        bmJeepStart();
      }
    }
  }
  bmJeepUpdate(dt);
  bmSmokeUpdate(dt);
  bmStingerUpdate();
  bmMusicUpdate(a);
}

/**
 * @file owndepot.js — player-owned haulage yards: purchase, tiers, yard trucks (ownership is local to this client save)
 * Exposes (globals): OWN_TIERS, OWN_MAX, OWN, ownCompany, ownSave, ownLoad, ownT, ownApplyTier,
 *   ownUpgrade, ownYards, ownedYard, ownTier, ydBrand, ownIn (+34 more)
 * Depends on: world.js, physics.js, traffic.js, sites.js, career.js, ui.js, gamepad.js,
 *   mobile.js, port.js, porttrucks.js, homes.js, rail.js, daynight.js, main.js
 * Load order: #29 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
// ===================== v33 player-owned haulage yards (tier 1). Per player: ownership lives in this client's save only, so in
// multiplayer other players keep seeing an empty FOR SALE yard and never get the owner's trucks (traffic is local per client).
const OWN_TIERS = {
  1: {
    price: 50000,
    trucks: 2,
    pay: 500,
    bays: 4,
    label: "Tier 1 haulage yard",
    adds: "Office, truck garage and warehouse \u2022 4 bays",
  },
  2: {
    price: 3000,
    trucks: 4,
    pay: 500,
    bays: 6,
    label: "Tier 2 depot",
    adds: "Second warehouse \u2022 6 bays \u2022 4 trucks",
  },
  3: {
    price: 5000,
    trucks: 6,
    pay: 500,
    bays: 8,
    label: "Tier 3 distribution hub",
    adds: "Distribution centre HQ \u2022 8 bays \u2022 more floodlights \u2022 6 trucks",
  },
}; // up: prices are test values - edit here
const OWN_MAX = 3;
const OWN = { yards: {}, slot: null, inc: 0, home: null }; // yards: id -> {tier,bought,delivered,earned}
function ownCompany() {
  const n = (localStorage.getItem("bigrig.name") || "").trim();
  return (n ? n : "Your") + " Haulage";
}
function ownSave() {
  return {
    yards: OWN.yards,
    home: OWN.home,
    homes: typeof homesSave === "function" ? homesSave() : undefined,
  };
}
function ownLoad(o) {
  OWN.yards = (o && o.yards) || {};
  OWN.home = (o && o.home) || null;
  OWN.applied = 0;
  if (typeof homesLoad === "function") homesLoad(o && o.homes);
}
function ownT(yd) {
  const o = OWN.yards[yd.id];
  return o ? o.tier || 1 : 0;
}
// make the yard match its tier: open the extra bays, make the new buildings solid
function ownApplyTier(yd) {
  const t = ownT(yd);
  for (const b of yd.bays) {
    const on = t >= (b.need || 1) || (!t && b.need === 1);
    if (b.need > 1) b.assigned = !on;
  }
  if (typeof DOCK_FENCE !== "undefined") {
    if (!DOCK_FENCE) DOCK_FENCE = new Uint8Array(MW * MH);
    for (const [R, need] of [
      [yd.wh2, 2],
      [yd.hq, 3],
    ])
      if (R)
        for (let j = R.y0; j < R.y0 + R.h; j++)
          for (let i = R.x0; i < R.x0 + R.w; i++) DOCK_FENCE[idx(i, j)] = t >= need ? 1 : 0;
    for (let j = yd.y0 + 19; j < yd.y0 + yd.h; j++)
      for (let i = yd.x0; i < yd.x0 + yd.w; i++) DOCK_FENCE[idx(i, j)] = 1;
  }
}
function ownUpgrade(yd) {
  const o = ownedYard(yd);
  if (!o) return false;
  const nt = (o.tier || 1) + 1;
  if (nt > OWN_MAX) {
    toast("Already at the top tier");
    return false;
  }
  const T = OWN_TIERS[nt];
  if (truck.money < T.price) {
    toast("Not enough money: " + money(T.price) + " needed");
    return false;
  }
  truck.money -= T.price;
  o.tier = nt;
  ownApplyTier(yd);
  toast(ydBrand(yd).name + " upgraded to " + T.label + " \u2022 " + T.trucks + " trucks");
  if (typeof saveGame === "function") saveGame();
  return true;
}
function ownYards() {
  return world.forSale || [];
}
function ownedYard(yd) {
  return OWN.yards[yd.id] || null;
}
function ownTier(yd) {
  return OWN_TIERS[(ownedYard(yd) || {}).tier || yd.tier || 1];
}
function ydBrand(yd) {
  return yd.brand || { name: yd.name, mono: "YD", col: "#2c3e50", acc: "#f5b82e", glyph: "chev" };
}
function ownIn(s) {
  const f = fwd(truck.h),
    cx = truck.x + f[0] * 1.9,
    cy = truck.y + f[1] * 1.9;
  return Math.abs(cx - s.x) < s.w / 2 && Math.abs(cy - s.y) < s.L / 2;
}
// ---- logo: round badge, brand colour, accent ring + glyph + monogram (vector, any size)
function ydLogo(g, x, y, r, B) {
  g.save();
  g.translate(x, y);
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath();
  g.arc(r * 0.06, r * 0.1, r, 0, 7);
  g.fill();
  g.fillStyle = B.col;
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  g.lineWidth = Math.max(1.5, r * 0.12);
  g.strokeStyle = B.acc;
  g.beginPath();
  g.arc(0, 0, r * 0.86, 0, 7);
  g.stroke();
  g.strokeStyle = B.acc;
  g.fillStyle = B.acc;
  g.lineWidth = Math.max(1.2, r * 0.1);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.globalAlpha = 0.55;
  if (B.glyph === "chev") {
    for (const k of [-0.32, 0]) {
      g.beginPath();
      g.moveTo(-r * 0.5, r * (0.42 + k));
      g.lineTo(0, r * (0.18 + k));
      g.lineTo(r * 0.5, r * (0.42 + k));
      g.stroke();
    }
  } else if (B.glyph === "wave") {
    for (const k of [0.28, 0.48]) {
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const t = i / 16,
          px = -r * 0.6 + t * r * 1.2,
          py = r * k + Math.sin(t * Math.PI * 3) * r * 0.07;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
  } else if (B.glyph === "bars") {
    for (let i = 0; i < 3; i++) g.fillRect(-r * 0.48 + i * r * 0.36, r * 0.22, r * 0.22, r * 0.3);
  } else {
    g.beginPath();
    g.moveTo(-r * 0.55, r * 0.5);
    g.lineTo(-r * 0.15, r * 0.12);
    g.lineTo(r * 0.05, r * 0.3);
    g.lineTo(r * 0.3, r * 0.05);
    g.lineTo(r * 0.55, r * 0.5);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = "#fff";
  g.font = "900 " + Math.round(r * 0.62) + "px Arial Black,Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(B.mono, 0, -r * 0.14);
  g.restore();
}
// ---- per frame: slots (buy / garage / office / free service), fleet upkeep
function updateOwnDepots(dt) {
  if (!world.ready || !world.forSale) return;
  if (!OWN.applied) {
    OWN.applied = 1;
    for (const yd of world.forSale) ownApplyTier(yd);
  }
  for (const yd of world.forSale) ownTrain(yd, dt);
  let hit = null;
  for (const yd of ownYards()) {
    const o = ownedYard(yd);
    if (!o && ownIn(yd.slot)) hit = [yd, "buy"];
    else if (o && yd.gslot && ownIn(yd.gslot)) hit = [yd, "garage"];
    else if (o && yd.oslot && ownIn(yd.oslot)) hit = [yd, "office"];
    else if (o && yd.sslot && ownIn(yd.sslot)) hit = [yd, "service"];
  }
  const fresh = trigFresh("own", hit ? hit[0].id + hit[1] : null); // v50: only after driving in (never on load/spawn)
  if (Math.abs(truck.v) >= 0.6) hit = null;
  const key = hit ? hit[0].id + hit[1] : null;
  if (key !== OWN.slot) {
    OWN.slot = key;
    if (hit && fresh && !career.uiOpen && !(typeof bigmap !== "undefined" && bigmap.open)) {
      trigUsed("own");
      const [yd, k] = hit;
      if (k === "buy") ownBuyCard(yd);
      else if (k === "garage") {
        if (typeof openDealer === "function") {
          dealerState.sel = career.cur;
          openDealer({ name: ydBrand(yd).name + " \u2022 Garage", entrance: yd.entrance });
        }
      } else if (k === "office") ownDash(yd);
      else if (k === "service") {
        const f = truck.tank || truck.fuel,
          d = truck.damage;
        truck.fuel = truck.tank || truck.fuel;
        truck.damage = 0;
        if (truck.trl && truck.trl.damage) truck.trl.damage = 0;
        toast(
          ydBrand(yd).name +
            " service bay: " +
            (d > 0.5 || truck.fuel > f ? "refuelled and repaired" : "all topped up") +
            " \u2022 free",
        );
      }
    }
  }
  if (typeof PTRUCK === "undefined") return;
  for (const yd of ownYards()) {
    const o = ownedYard(yd);
    if (!o) continue;
    const need = ownTier(yd).trucks,
      have = PTRUCK.list.filter((T) => T.home === yd).length;
    if (have < need && PTRUCK.t > (yd.spawnT || 0)) {
      yd.spawnT = PTRUCK.t + 6;
      const g = ptDepotGeo(yd);
      if (!g) continue;
      const P = portList()
        .filter((P) => P.ready && P.lpath)
        .sort(
          (a, b) =>
            Math.hypot(a.O[0] * M_T - yd.x, a.O[1] * M_T - yd.y) -
            Math.hypot(b.O[0] * M_T - yd.x, b.O[1] * M_T - yd.y),
        )[0];
      if (!P) continue;
      const T = { P, st: "new", box: null, t: 0, id: "own" + yd.id + have, home: yd };
      ownMission(T);
      for (const dir of [1, -1])
        if (
          ptToRoad(T, g.sg, dir, g.along + dir * 7, T.tgt === "port" ? ptGateGoal(T.P) : T.dest)
        ) {
          PTRUCK.list.push(T);
          break;
        }
    }
  }
}
// up: random mission for a company truck leaving its yard empty: a container terminal (docks) or another depot / container yard on the map
function ownMission(T) {
  const yd = T.home,
    e = yd.entrance;
  const L = world.depots
    .filter(
      (d) =>
        d.bays &&
        d.bays.length &&
        !portList().some((Q) => Q.depot === d) &&
        ptDepotGeo(d) &&
        d.bays.every((b) => !b.th),
    )
    .map((d) => [d, Math.hypot(d.entrance.x - e.x, d.entrance.y - e.y)])
    .filter((q) => q[1] > 400 && q[1] < 7000);
  if (L.length && Math.random() < 0.55) {
    T.dest = L[(Math.random() * L.length) | 0][0];
    T.pick = 1;
    T.tgt = "depot";
    T.mis = T.dest.name;
  } else {
    const P = portList().filter((P) => P.ready && P.lpath);
    T.P = P[(Math.random() * P.length) | 0] || T.P;
    T.dest = null;
    T.pick = 0;
    T.tgt = "port";
    T.mis = T.P && T.P.depot ? T.P.depot.name : "docks";
  }
}
function ownDelivered(T) {
  const yd = T.home,
    o = ownedYard(yd);
  if (!o) return;
  const pay = ownTier(yd).pay;
  truck.money += pay;
  o.delivered = (o.delivered || 0) + 1;
  o.earned = (o.earned || 0) + pay;
  OWN.inc += pay;
  o.stock = (o.stock || 0) + 1;
  T.earn = (T.earn || 0) + pay;
  const ix = PTRUCK.list.filter((q) => q.home === yd).indexOf(T) + 1;
  (OWN.log = OWN.log || []).push({
    y: ydBrand(yd).name,
    n: ix,
    from: T.mis || "docks",
    p: pay,
    c: T.box || ydBrand(yd).col,
  });
  if (OWN.log.length > 20) OWN.log.shift();
  toast(
    "+" +
      money(pay) +
      " \u2022 " +
      ydBrand(yd).name +
      " truck unloaded a container into the warehouse",
  );
  if (typeof saveGame === "function") saveGame();
}
function ownBuy(yd) {
  const t = OWN_TIERS[yd.tier || 1];
  if (ownedYard(yd)) return false;
  if (truck.money < t.price) {
    toast("Not enough money: " + money(t.price) + " needed");
    return false;
  }
  truck.money -= t.price;
  OWN.yards[yd.id] = { tier: yd.tier || 1, bought: Date.now(), delivered: 0, earned: 0 };
  if (!OWN.home) OWN.home = yd.id;
  ownApplyTier(yd);
  toast(ydBrand(yd).name + " is yours! " + t.trucks + " trucks start work at the docks.");
  if (typeof saveGame === "function") saveGame();
  return true;
}
// ---- purchase card
const OWN_CSS = `.ydc{display:flex;gap:18px;height:100%;padding:18px;box-sizing:border-box}.ydc .pv{flex:1.1;min-width:0;display:flex;flex-direction:column;gap:10px}.ydc .pv canvas{width:100%;height:auto;aspect-ratio:560/430;max-height:100%;border-radius:12px;background:#222}
.ydc .in{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}.ydc .hd{display:flex;align-items:center;gap:12px}.ydc h2{margin:0;font-size:24px;line-height:1.1}.ydc .chip{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:99px}
.ydc .price{font-size:34px;font-weight:900;color:#ffd866}.ydc .inc{font-size:15px;color:#7dff9a;font-weight:800}.ydc ul{margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#dfe7f1}.ydc .bt{display:flex;gap:12px;margin-top:auto}
.ydc .bt button{flex:1;min-height:70px;font-size:20px;font-weight:900;border-radius:14px;border:0;cursor:pointer}.ydc .buy{background:linear-gradient(180deg,#3ddc84,#1f9d57);color:#06210f}.ydc .buy[disabled]{filter:grayscale(1);opacity:.6}.ydc .cn{background:#3a4352;color:#fff}
.ydc .hint{font-size:12px;opacity:.65;text-align:center}.ydc .row{display:flex;justify-content:space-between;font-size:14px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}
@media (max-height:460px){.ydc{padding:12px;gap:12px}.ydc .in{overflow-y:auto;min-height:0;padding-bottom:6px}.ydc .bt .btn{min-height:46px}}
@media (max-width:700px),(orientation:portrait){.ydc .bt{position:sticky;bottom:0;z-index:3;background:linear-gradient(180deg,rgba(15,20,30,0),#0f141e 30%);padding-top:10px}.ydc .bt button{min-height:56px;font-size:17px}.odw .bt button{font-size:15px;padding:0 6px;white-space:normal}.ydc .pv canvas{max-height:22vh!important}.ydc{flex-direction:column;overflow:auto}.ydc .pv canvas{max-height:28vh;width:auto;align-self:center}}
.odw{display:flex;flex-direction:column;height:100%;min-height:0;gap:10px;padding:0 0 12px;box-sizing:border-box}
.odh{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px 14px 0 0;flex-wrap:wrap}.odh canvas{width:64px;height:64px;flex:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}
.odn{flex:1 1 0;min-width:0}.odn .chip{background:rgba(0,0,0,.35);color:#fff}.odn h2{margin:2px 0 0;font-size:clamp(18px,5vw,26px);line-height:1.1;text-shadow:0 2px 4px rgba(0,0,0,.4);overflow-wrap:anywhere}.odn small{opacity:.85;font-size:12px}
.odks{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:0 14px}.odk{display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.08)}.odk span{font-size:18px}.odk b{font-size:17px;font-weight:900}.odk small{font-size:10px;opacity:.7;text-align:center}
.odbody{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:1.3fr 1fr;gap:10px;padding:0 14px}.odc{display:flex;flex-direction:column;gap:8px;min-width:0}.odhd{font-size:11px;font-weight:900;letter-spacing:.14em;opacity:.6}
.ody{border-radius:12px;background:rgba(255,255,255,.04);padding:8px}.odyh{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}.dot{width:11px;height:11px;border-radius:50%;flex:none;outline:2px solid rgba(255,255,255,.4)}
.odt{display:flex;gap:10px;padding:8px;border-radius:10px;background:rgba(0,0,0,.25);margin-top:6px}.odi{width:44px;height:44px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;flex:none;line-height:1}.odi small{font-size:10px;font-weight:900}
.odb{flex:1;min-width:0}.odr{display:flex;align-items:center;gap:6px}.pill{font-size:10px;font-weight:900;padding:2px 7px;border-radius:99px;color:#fff;letter-spacing:.06em}.box{width:16px;height:9px;border-radius:2px;outline:1px solid rgba(0,0,0,.5)}.odm{color:#7dff9a;font-weight:800;font-size:13px}
.ods{font-size:12px;opacity:.85;margin:3px 0}.odp{height:6px;border-radius:4px;background:#222a36;overflow:hidden}.odp i{display:block;height:100%;transition:width .8s}.ode{font-size:10px;opacity:.65;margin-top:2px}
.odf{display:flex;align-items:center;gap:8px;font-size:12px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.04)}.odf span:nth-child(2){flex:1;min-width:0}.odf b{color:#7dff9a}
.odu{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:linear-gradient(120deg,rgba(245,184,46,.18),rgba(245,184,46,.04));border:1px solid rgba(245,184,46,.4);margin-top:4px}.odu>div:first-child{flex:1;display:flex;flex-direction:column;gap:2px}.odu small{font-size:10px;font-weight:900;letter-spacing:.12em;color:#f5b82e}.odu span{font-size:11px;opacity:.75}.odup{font-weight:900;font-size:16px;width:90px;text-align:right}.odup .odp{margin-top:4px}
.odw .bt,.odw .hint{padding:0 14px}.odw .bt{display:flex;gap:10px}.odw .bt button{flex:1;min-height:60px;font-size:18px;font-weight:900;border-radius:14px;border:0;cursor:pointer}.odw .buy{background:linear-gradient(180deg,#3ddc84,#1f9d57);color:#06210f}.odw #ownUpg{flex:1.4}.odw .cn{background:#3a4352;color:#fff}.odw .hint{font-size:11px;opacity:.65;text-align:center}
@media (max-width:700px),(orientation:portrait){.odks{grid-template-columns:repeat(3,minmax(0,1fr))}.odbody{grid-template-columns:1fr}}
@media (max-height:460px){.odh{padding:8px 12px}.odh canvas{width:44px;height:44px}.odks{grid-template-columns:repeat(5,minmax(0,1fr))}.odk{padding:4px}.odk span{display:none}.odw .bt button{min-height:48px;font-size:16px}.odw{gap:6px}.odw .hint{display:none}}`;
function ownCss() {
  if (document.getElementById("ydcss")) return;
  const s = document.createElement("style");
  s.id = "ydcss";
  s.textContent = OWN_CSS;
  document.head.appendChild(s);
}
function ydPreview(cv, yd, owned, tier) {
  tier = tier || 1;
  const g = cv.getContext("2d"),
    W = cv.width,
    H = cv.height,
    B = ydBrand(yd);
  g.fillStyle = "#5f8f3e";
  g.fillRect(0, 0, W, H);
  const s = Math.min(W / 24, H / 28),
    ox = (W - 22 * s) / 2,
    oy = (H - 26 * s) / 2 + 2.4 * s,
    X = (t) => ox + (t + 1) * s,
    Y = (t) => oy + t * s;
  g.fillStyle = "#2b2f34";
  g.fillRect(0, oy - 2.6 * s, W, 2.2 * s);
  g.strokeStyle = "#e8e8e8";
  g.setLineDash([s * 0.8, s * 0.6]);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, oy - 1.5 * s);
  g.lineTo(W, oy - 1.5 * s);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "#3d4249";
  g.fillRect(X(7), oy - 0.4 * s, 6 * s, 0.6 * s);
  g.fillRect(X(0), Y(0), 20 * s, 24 * s);
  g.strokeStyle = "#9aa3ad";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(X(7), Y(0));
  g.lineTo(X(0), Y(0));
  g.lineTo(X(0), Y(24));
  g.lineTo(X(20), Y(24));
  g.lineTo(X(20), Y(0));
  g.lineTo(X(13), Y(0));
  g.stroke();
  g.strokeStyle = "#fff";
  const nb = OWN_TIERS[tier].bays;
  for (let k = 0; k <= nb; k++) {
    g.beginPath();
    g.moveTo(X(7.5 + k * 1.25), Y(10.3));
    g.lineTo(X(7.5 + k * 1.25), Y(14.7));
    g.stroke();
  }
  g.fillStyle = "#f1c40f";
  g.fillRect(X(7.5), Y(14.6), nb * 1.25 * s, 0.15 * s);
  const pb = (x, y, w, h, c, rc) => {
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(X(x) + 4, Y(y) + 4, w * s, h * s);
    g.fillStyle = c;
    g.fillRect(X(x), Y(y), w * s, h * s);
    g.fillStyle = rc;
    for (let k = 0.4; k < w; k += 0.8) g.fillRect(X(x + k), Y(y), 0.12 * s, h * s);
  };
  pb(7, 15, 6, 4, "#8796a5", "#6f7d8b");
  if (tier >= 2) pb(13, 15, 6, 4, "#8a9a7a", "#717f63");
  else {
    g.strokeStyle = "#888";
    g.setLineDash([4, 4]);
    g.strokeRect(X(13), Y(15), 6 * s, 4 * s);
    g.setLineDash([]);
  }
  if (tier >= 3) {
    pb(1, 15, 5, 4, "#e6e9ee", "#ccd2d9");
    g.fillStyle = B.col;
    g.fillRect(X(1), Y(15), 5 * s, 0.5 * s);
  } else {
    g.strokeStyle = "#888";
    g.setLineDash([4, 4]);
    g.strokeRect(X(1), Y(15), 5 * s, 4 * s);
    g.setLineDash([]);
  }
  g.fillStyle = "#6d5a48";
  g.fillRect(X(0), Y(20.9), 20 * s, 1.2 * s);
  g.fillStyle = "#bfc5cb";
  g.fillRect(X(0), Y(21.1), 20 * s, 0.12 * s);
  g.fillRect(X(0), Y(21.8), 20 * s, 0.12 * s);
  g.fillStyle = "#f1c40f";
  g.fillRect(X(9.6), Y(19.3), 0.4 * s, 4.4 * s);
  g.fillRect(X(9.6), Y(19.3), 2.6 * s, 0.3 * s);
  g.fillRect(X(11.8), Y(19.3), 0.4 * s, 4.4 * s);
  g.fillStyle = "rgba(0,0,0,.35)";
  g.fillRect(X(1) + 5, Y(1) + 5, 5 * s, 4 * s);
  g.fillRect(X(14) + 5, Y(1) + 5, 5 * s, 3 * s);
  g.fillStyle = "#e9edf1";
  g.fillRect(X(1), Y(1), 5 * s, 4 * s);
  g.fillStyle = B.col;
  g.fillRect(X(1), Y(1), 5 * s, 0.7 * s);
  g.fillStyle = "#7fb2d8";
  for (let k = 0; k < 4; k++) g.fillRect(X(1.4 + k * 1.15), Y(4.3), 0.7 * s, 0.4 * s);
  g.fillStyle = "#6b737c";
  g.fillRect(X(14), Y(1), 5 * s, 3 * s);
  g.fillStyle = "#3a3f45";
  for (let k = 0; k < 5; k++) g.fillRect(X(14.6), Y(3.3) + k * 0.12 * s, 3.8 * s, 0.06 * s);
  ydLogo(g, X(3.5), Y(3), s * 1.15, B);
  for (const [bx, col] of [
    [8.1, B.col],
    [10.6, "#d63b2f"],
  ]) {
    g.fillStyle = "#333";
    g.fillRect(X(bx - 0.3), Y(10.6), 0.6 * s, 3.4 * s);
    g.fillStyle = col;
    g.fillRect(X(bx - 0.35), Y(9.4), 0.7 * s, 1.4 * s);
    g.fillStyle = YARD_COLS[((bx * 3) | 0) % 8];
    g.fillRect(X(bx - 0.3), Y(10.9), 0.6 * s, 3 * s);
  }
  if (!owned) {
    g.save();
    g.translate(X(10), Y(7.5));
    g.rotate(-0.12);
    g.fillStyle = "rgba(243,156,18,.92)";
    g.fillRect(-4.2 * s, -0.9 * s, 8.4 * s, 1.8 * s);
    g.fillStyle = "#fff";
    g.font = "900 " + Math.round(s * 1.1) + "px Arial Black,Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("FOR SALE", 0, 0.05 * s);
    g.restore();
  }
}
function ownBuyCard(yd) {
  ownCss();
  const t = OWN_TIERS[yd.tier || 1],
    B = ydBrand(yd),
    can = truck.money >= t.price;
  const b = openModal(
    "ownbuy",
    `<div class="ydc"><div class="pv"><canvas width="560" height="430"></canvas><div class="hint">${esc(yd.name)} \u2022 20 \u00d7 24 tile yard \u2022 4 reverse bays, office, garage, warehouse, rail siding</div></div>
   <div class="in"><div class="hd"><canvas class="lg" width="84" height="84" style="width:64px;height:64px"></canvas><div><span class="chip" style="background:${B.col};color:${B.acc}">${esc(t.label.toUpperCase())}</span><h2>${esc(B.name)}</h2></div><div style="flex:1"></div><div class="wallet" title="Your bank balance">\u{1F45B} Bank <b>${money(truck.money)}</b></div></div>
   <div><div class="price">${money(t.price)}</div><div class="inc">+${money(t.pay)} for every container your trucks deliver here</div></div>
   <ul><li>${t.trucks} AI trucks fetch containers from the docks and other yards</li><li>Warehouse + rail siding: a gantry loads your stock onto trains</li><li>Upgrade later: T2 ${money(OWN_TIERS[2].price)}, T3 ${money(OWN_TIERS[3].price)}</li><li>Truck garage: buy, swap and paint your trucks</li><li>Free fuel &amp; repair bay</li><li>Office with your company dashboard</li><li>Your home yard (one-tap travel)</li></ul>
   <div class="row"><span>Bank balance</span><b style="color:${can ? "#7dff9a" : "#ff7b72"}">${money(truck.money)}</b></div>
   <div class="bt"><button class="buy btn sel" id="ownBuy" ${can ? "" : "disabled"}>${can ? "BUY" : "NEED " + money(t.price - truck.money) + " MORE"}</button><button class="cn btn" id="ownNo">CANCEL</button></div>
   <div class="hint">Enter / \u24b6 buy \u2022 Esc / \u24b7 cancel</div></div></div>`,
    "ydm",
  );
  ydPreview(b.querySelector(".pv canvas"), yd, false);
  const lg = b.querySelector("canvas.lg");
  ydLogo(lg.getContext("2d"), 42, 42, 38, B);
  b.querySelector("#ownBuy").addEventListener("click", () => {
    closeUI();
    ownBuy(yd);
  });
  b.querySelector("#ownNo").addEventListener("click", closeUI);
  if (typeof padNav === "function") setTimeout(() => padNav(null), 40);
}
// ---- office: company dashboard
function ownTruckStatus(T) {
  const port =
    T.P && T.P.depot ? T.P.depot.name.replace(/ Container Terminal| Terminal/, "") : "docks";
  if (T.st === "gate") {
    return T.box
      ? "Loaded, leaving " + port
      : T.l && T.l.at
        ? "Waiting for a container at " + port
        : "Entering " + port;
  }
  if (T.st === "depot")
    return T.dest === T.home || !T.pick
      ? T.ph === "rev"
        ? "Reversing into a yard bay"
        : T.ph === "drop"
          ? "Unloading into the warehouse"
          : "Manoeuvring in the yard"
      : T.ph === "drop"
        ? "Loading a container at " + T.dest.name
        : "Manoeuvring at " + T.dest.name;
  if (T.st === "road")
    return T.box
      ? "Bringing a container back to the yard"
      : "Driving empty to " + (T.pick && T.dest ? T.dest.name : port);
  return "Starting up";
}
function ownTrkInfo(T) {
  const st = ownTruckStatus(T);
  let tgt = null,
    ph,
    col;
  if (T.st === "road") {
    tgt = T.box ? T.home : T.pick && T.dest ? T.dest : T.P && T.P.depot;
    ph = T.box ? "RETURNING" : "OUTBOUND";
    col = T.box ? "#3ddc84" : "#2f81f7";
  } else if (T.st === "gate") {
    ph = T.box ? "LOADED" : "AT DOCKS";
    col = "#f5b82e";
  } else if (T.st === "depot") {
    const hm = T.dest === T.home || !T.pick;
    ph = hm ? (T.ph === "drop" ? "UNLOADING" : "IN YARD") : "LOADING";
    col = hm ? "#a371f7" : "#f5b82e";
  } else {
    ph = "STARTING";
    col = "#8b949e";
  }
  let pr =
      T.st === "road"
        ? T.box
          ? 0.6
          : 0.1
        : T.st === "gate" || (T.st === "depot" && T.pick && T.dest !== T.home)
          ? 0.5
          : T.st === "depot"
            ? 0.95
            : 0,
    eta = "";
  const q = typeof ptPoses === "function" ? ptPoses().find((p) => p.T === T) : null;
  if (q && tgt && tgt.entrance) {
    const d = Math.hypot(tgt.entrance.x - q.x, tgt.entrance.y - q.y),
      key = (tgt.name || "") + (T.box ? 1 : 0);
    if (T.legK !== key) {
      T.legK = key;
      T.legD = Math.max(d, 1);
    }
    const f = Math.max(0, Math.min(1, 1 - d / T.legD));
    pr = T.box ? 0.55 + 0.4 * f : 0.05 + 0.4 * f;
    eta = (d / 1000).toFixed(1) + " km \u2022 ~" + Math.max(1, Math.round(d / 13 / 60)) + " min";
  }
  return { st, ph, col, pr, eta, to: (tgt && tgt.name) || "" };
}
function ownTrkHTML(y, B) {
  const tr = typeof PTRUCK !== "undefined" ? PTRUCK.list.filter((T) => T.home === y) : [];
  return (
    tr
      .map((T, i) => {
        const I = ownTrkInfo(T);
        return `<div class="odt"><div class="odi" style="background:${B.col};color:${B.acc}">\u{1F69A}<small>${i + 1}</small></div><div class="odb"><div class="odr"><b>Truck ${i + 1}</b><span class="pill" style="background:${I.col}">${I.ph}</span>${T.box ? `<span class="box" style="background:${T.box}" title="carrying a container"></span>` : ""}<span style="flex:1"></span><span class="odm">${money(T.earn || 0)}</span></div>
    <div class="ods">${esc(I.st)}</div><div class="odp"><i style="width:${Math.round(I.pr * 100)}%;background:${I.col}"></i></div>${I.eta ? `<div class="ode">${esc(I.eta)}</div>` : ""}</div></div>`;
      })
      .join("") || '<div class="ods" style="padding:14px">Trucks are starting up\u2026</div>'
  );
}
function ownDash(yd) {
  ownCss();
  const mine = ownYards().filter(ownedYard),
    B = ydBrand(yd),
    o = ownedYard(yd),
    tier = o.tier || 1,
    N = OWN_TIERS[tier + 1];
  let tot = 0,
    del = 0,
    stk = 0,
    act = 0;
  for (const y of mine) {
    const q = ownedYard(y);
    tot += q.earned || 0;
    del += q.delivered || 0;
    stk += q.stock || 0;
  }
  if (typeof PTRUCK !== "undefined")
    act = PTRUCK.list.filter((T) => T.home && ownedYard(T.home)).length;
  const tile = (ic, v, l, c) =>
    `<div class="odk"><span>${ic}</span><b style="color:${c || "#fff"}">${v}</b><small>${l}</small></div>`;
  const yards = mine
    .map((y) => {
      const q = ownedYard(y),
        Bb = ydBrand(y);
      return `<div class="ody"><div class="odyh"><span class="dot" style="background:${Bb.col};outline-color:${Bb.acc}"></span><b>${esc(Bb.name)}</b>${OWN.home === y.id ? '<span class="chip" style="background:#f5b82e;color:#000">HOME</span>' : ""}<span class="chip" style="background:rgba(255,255,255,.12);color:#fff">T${q.tier || 1}</span><span style="flex:1"></span><small>${q.delivered || 0} \u2022 <b style="color:#7dff9a">${money(q.earned || 0)}</b></small></div><div class="odtr" data-y="${y.id}">${ownTrkHTML(y, Bb)}</div></div>`;
    })
    .join("");
  const feed =
    (OWN.log || [])
      .slice(-6)
      .reverse()
      .map(
        (e) =>
          `<div class="odf"><span class="dot" style="background:${e.c}"></span><span>${esc(e.y)} truck ${e.n} \u2022 ${esc(e.from || "pickup")} \u2192 warehouse</span><b>+${money(e.p)}</b></div>`,
      )
      .join("") ||
    '<div class="odf" style="opacity:.6">No deliveries yet \u2014 your trucks are on their first runs.</div>';
  const teaser = N
    ? `<div class="odu"><div><small>NEXT UPGRADE</small><b>T${tier + 1} ${esc(N.label)}</b><span>${esc(N.adds)}</span></div><div class="odup">${money(N.price)}<div class="odp"><i style="width:${Math.min(100, Math.round((truck.money / N.price) * 100))}%;background:#3ddc84"></i></div></div></div>`
    : `<div class="odu"><div><small>FULLY UPGRADED</small><b>${esc(OWN_TIERS[tier].label)}</b></div></div>`;
  const b = openModal(
    "owndash",
    `<div class="odw"><div class="odh" style="background:linear-gradient(115deg,${B.col} 0%,${B.col} 46%,${B.acc} 46.4%,${B.acc} 49%,#141a26 49.4%)"><canvas class="lg" width="96" height="96"></canvas><div class="odn"><span class="chip">COMPANY DASHBOARD</span><h2>${esc(ownCompany())}</h2><small>${esc(B.name)} office</small></div><div class="wallet" title="Your bank balance">\u{1F45B} Bank <b>${money(truck.money)}</b></div></div>
   <div class="odks">${tile("\u{1F4B7}", money(tot), "earned", "#7dff9a")}${tile("\u{1F4E6}", del, "delivered")}${tile("\u{1F69A}", act, "trucks active", "#7ec8ff")}${tile("\u{1F3ED}", stk, "warehouse stock", "#ffd866")}${tile("\u2B50", "T" + tier, "yard tier", "#f5b82e")}</div>
   <div class="odbody"><div class="odc"><div class="odhd">FLEET</div>${yards}</div><div class="odc"><div class="odhd">RECENT DELIVERIES</div>${feed}${teaser}</div></div>
   <div class="bt"><button class="buy btn sel" id="ownUpg">UPGRADES</button><button class="buy btn" id="ownHome">${OWN.home === yd.id ? "HOME YARD \u2713" : "SET AS HOME"}</button><button class="cn btn" id="ownNo">CLOSE</button></div><div class="hint">Home yard: tap it on the map for fast travel \u2022 Esc / \u24b7 close</div></div>`,
    "ydm",
  );
  ydLogo(b.querySelector("canvas.lg").getContext("2d"), 48, 48, 44, B);
  b.querySelector("#ownHome").addEventListener("click", () => {
    OWN.home = yd.id;
    if (typeof saveGame === "function") saveGame();
    closeUI();
    toast(ydBrand(yd).name + " set as your home yard");
  });
  b.querySelector("#ownNo").addEventListener("click", closeUI);
  b.querySelector("#ownUpg").addEventListener("click", () => {
    closeUI();
    ownUpCard(yd);
  });
  const iv = setInterval(() => {
    if (career.uiOpen !== "owndash" || !b.isConnected) {
      clearInterval(iv);
      return;
    }
    b.querySelectorAll(".odtr").forEach((el) => {
      const y = mine.find((q) => q.id === el.dataset.y);
      if (y) el.innerHTML = ownTrkHTML(y, ydBrand(y));
    });
  }, 1000);
  if (typeof padNav === "function") setTimeout(() => padNav(null), 40);
}
// ---- upgrades card (office / dashboard). Tiers + prices live in OWN_TIERS.
function ownUpCard(yd) {
  ownCss();
  const o = ownedYard(yd);
  if (!o) return;
  const cur = o.tier || 1,
    nt = cur + 1,
    N = OWN_TIERS[nt],
    B = ydBrand(yd),
    can = N && truck.money >= N.price;
  const li = [1, 2, 3]
    .map((k) => {
      const T = OWN_TIERS[k];
      return `<div class="row" style="${k === cur ? "outline:2px solid #7dff9a;border-radius:8px;" : ""}"><span><b>T${k}</b> ${esc(T.label)}<br><small style="opacity:.75">${esc(T.adds)}</small></span><b>${k <= cur ? "\u2713 OWNED" : money(T.price)}</b></div>`;
    })
    .join("");
  const b = openModal(
    "ownup",
    `<div class="ydc"><div class="pv"><canvas width="560" height="430"></canvas><div class="hint">${N ? "After upgrade: " + esc(N.label) : "Fully upgraded"}</div></div>
   <div class="in"><div class="hd"><div><span class="chip" style="background:${B.col};color:${B.acc}">YARD UPGRADES</span><h2>${esc(B.name)}</h2></div><div style="flex:1"></div><div class="wallet" title="Your bank balance">\u{1F45B} Bank <b>${money(truck.money)}</b></div></div>
   <div>${li}</div><div class="inc">${money(500)} per container your trucks unload \u2022 ${OWN_TIERS[cur].trucks} trucks working</div>
   <div class="row"><span>Bank balance</span><b style="color:${!N || can ? "#7dff9a" : "#ff7b72"}">${money(truck.money)}</b></div>
   <div class="bt">${N ? `<button class="buy btn sel" id="ownUp" ${can ? "" : "disabled"}>${can ? "UPGRADE TO T" + nt + " \u2022 " + money(N.price) : "NEED " + money(N.price - truck.money) + " MORE"}</button>` : ""}<button class="cn btn${N ? "" : " sel"}" id="ownNo">BACK</button></div>
   <div class="hint">Enter / \u24b6 upgrade \u2022 Esc / \u24b7 back</div></div></div>`,
    "ydm",
  );
  ydPreview(b.querySelector(".pv canvas"), yd, true, N ? nt : cur);
  const u = b.querySelector("#ownUp");
  if (u)
    u.addEventListener("click", () => {
      if (ownUpgrade(yd)) {
        closeUI();
        ownUpCard(yd);
      }
    });
  b.querySelector("#ownNo").addEventListener("click", () => {
    closeUI();
    ownDash(yd);
  });
  if (typeof padNav === "function") setTimeout(() => padNav(null), 40);
}
addEventListener(
  "keydown",
  (e) => {
    const k = career.uiOpen;
    if (k !== "ownbuy" && k !== "owndash" && k !== "ownup") return;
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      const b =
        document.querySelector(".btn.sel") ||
        document.getElementById(k === "ownbuy" ? "ownBuy" : k === "ownup" ? "ownUp" : "ownUpg");
      if (b && !b.disabled) {
        e.preventDefault();
        e.stopPropagation();
        b.click();
      }
    } else if (e.code === "Escape") {
      e.preventDefault();
      closeUI();
    }
  },
  true,
);
// ---- in-game yard art
function ydText(t, x, y, px, col, font) {
  ctx.font = (font || "900 ") + px + "px Arial Black,Arial";
  ctx.fillStyle = col;
  ctx.fillText(t, x, y);
}
function drawOwnDepots(vx0, vy0, vx1, vy1) {
  if (!world.forSale) return;
  const S = PPM,
    Tt = TILE,
    dark = typeof DN !== "undefined" ? DN.dark : 0;
  rlDrawExt(vx0, vy0, vx1, vy1, dark);
  for (const yd of ownYards()) {
    const X0 = yd.x0 * Tt,
      Y0 = yd.y0 * Tt,
      W = yd.w * Tt,
      H = yd.h * Tt;
    if (X0 > vx1 + 120 || X0 + W < vx0 - 120 || Y0 > vy1 + 120 || Y0 + H < vy0 - 120) continue;
    const own = ownedYard(yd),
      B = ydBrand(yd),
      X = (t) => (yd.x0 + t) * Tt,
      Y = (t) => (yd.y0 + t) * Tt;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // tarmac with patching + kerb
    ctx.fillStyle = "#8d9196";
    ctx.fillRect(X0 - 4, Y0 - 4, W + 8, H + 8);
    ctx.fillStyle = "#34383d";
    ctx.fillRect(X0, Y0, W, H);
    ctx.fillStyle = "#34383d";
    ctx.fillRect(X(7), Y(-1.2), 6 * Tt, 1.2 * Tt + 2);
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let k = 0; k < 9; k++)
      ctx.fillRect(X(((k * 7.3) % 17) + 1), Y(((k * 5.1) % 12) + 1), 2.4 * Tt, 1.6 * Tt);
    // painted bays + lane arrows
    ctx.strokeStyle = own ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    const tr = ownT(yd) || 1,
      act = yd.bays.filter((b) => tr >= (b.need || 1));
    for (const b of act) {
      ctx.beginPath();
      ctx.moveTo(b.x0 * S, b.y0 * S);
      ctx.lineTo(b.x0 * S, b.y1 * S);
      ctx.moveTo(b.x1 * S, b.y0 * S);
      ctx.lineTo(b.x1 * S, b.y1 * S);
      ctx.stroke();
      ydText(String(b.id), b.cx * S, b.y0 * S - 10, Math.round(0.42 * Tt), ctx.strokeStyle);
    }
    ctx.fillStyle = "#f1c40f";
    ctx.fillRect(
      yd.bays[0].x0 * S,
      yd.bays[0].y1 * S - 5,
      (act[act.length - 1].x1 - yd.bays[0].x0) * S,
      6,
    );
    ownDrawBack(yd, X, Y, Tt, dark, own, B, tr);
    // service, office and garage pads
    const pad = (s, lbl, col) => {
      const sx = s.x * S,
        sy = s.y * S;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(sx - (s.w / 2) * S, sy - (s.L / 2) * S, s.w * S, s.L * S);
      ctx.setLineDash([]);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-Math.PI / 2);
      ydText(lbl, 0, 0, Math.round(0.36 * Tt), col);
      ctx.restore();
    };
    if (own) {
      pad(yd.sslot, "FUEL & REPAIR", "#7dff9a");
      pad(yd.oslot, "OFFICE", "#8fc8ff");
      pad(yd.gslot, "GARAGE", "#ffd866");
    } else {
      const s = yd.slot,
        here = ownIn(s);
      pad(s, "STOP TO BUY", here ? "#2ecc71" : "#ffd866");
      ctx.globalAlpha = 0.5;
      ydText("FOR SALE", X0 + W / 2 + 1.5 * Tt, Y0 + H * 0.6, Math.round(1.25 * Tt), "#f39c12");
      ctx.globalAlpha = 1;
    }
    // office (solid): shadow, walls, livery band, windows (lit at night), roof logo
    const of = yd.office,
      ox = X(of.x0 - yd.x0),
      oy = Y(of.y0 - yd.y0),
      ow = of.w * Tt,
      oh = of.h * Tt;
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(ox + 12, oy + 12, ow, oh);
    ctx.fillStyle = "#dfe4e9";
    ctx.fillRect(ox, oy, ow, oh);
    ctx.fillStyle = "#c9d0d7";
    ctx.fillRect(ox + 6, oy + 6, ow - 12, oh - 12);
    ctx.fillStyle = own ? B.col : "#7f8c8d";
    ctx.fillRect(ox, oy + oh - 0.55 * Tt, ow, 0.55 * Tt);
    ctx.fillStyle = dark > 0.05 ? "#ffd27a" : "#88b7da";
    for (let k = 0; k < 5; k++)
      ctx.fillRect(ox + 0.35 * Tt + k * 0.95 * Tt, oy + oh - 0.42 * Tt, 0.6 * Tt, 0.28 * Tt);
    if (own) ydLogo(ctx, ox + ow / 2, oy + oh / 2 - 0.25 * Tt, 0.95 * Tt, B);
    else {
      ctx.fillStyle = "#95a5a6";
      ctx.beginPath();
      ctx.arc(ox + ow / 2, oy + oh / 2 - 0.25 * Tt, 0.9 * Tt, 0, 7);
      ctx.fill();
      ydText("SALE", ox + ow / 2, oy + oh / 2 - 0.25 * Tt, Math.round(0.42 * Tt), "#fff");
    }
    // garage (solid): roof ribs + roller door, open when it's yours
    const ga = yd.garage,
      gx = X(ga.x0 - yd.x0),
      gy = Y(ga.y0 - yd.y0),
      gw = ga.w * Tt,
      gh = ga.h * Tt;
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(gx + 12, gy + 12, gw, gh);
    ctx.fillStyle = "#6f7882";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let k = 0; k < gw; k += 10) ctx.fillRect(gx + k, gy, 4, gh);
    ctx.fillStyle = own ? "#15181c" : "#9aa1a8";
    ctx.fillRect(gx + 0.6 * Tt, gy + gh - 0.35 * Tt, gw - 1.2 * Tt, 0.35 * Tt);
    if (own) {
      ctx.fillStyle = B.col;
      ctx.fillRect(gx, gy, gw, 0.4 * Tt);
      ydText("GARAGE", gx + gw / 2, gy + gh / 2, Math.round(0.45 * Tt), "#fff");
      if (dark > 0.05) dnLight(gx + gw / 2, gy + gh + 0.4 * Tt, 90, "rgba(255,230,180,0.9)", 0.7);
    }
    // fence (gate gap at the top middle) + posts
    ctx.strokeStyle = "#2a2d31";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(7), Y0 + 2);
    ctx.lineTo(X0 + 2, Y0 + 2);
    ctx.lineTo(X0 + 2, Y0 + H - 2);
    ctx.lineTo(X0 + W - 2, Y0 + H - 2);
    ctx.lineTo(X0 + W - 2, Y0 + 2);
    ctx.lineTo(X(13), Y0 + 2);
    ctx.stroke();
    ctx.fillStyle = "#1d1f22";
    for (let t = 0; t <= 20; t += 2) {
      if (t > 7 && t < 13) continue;
      ctx.fillRect(X(t) - 3, Y0 - 1, 6, 6);
      ctx.fillRect(X(t) - 3, Y0 + H - 5, 6, 6);
    }
    for (let t = 2; t < yd.h; t += 2) {
      ctx.fillRect(X0 - 1, Y(t) - 3, 6, 6);
      ctx.fillRect(X0 + W - 5, Y(t) - 3, 6, 6);
    }
    // entrance sign: livery board with logo + name
    {
      const sx = X(5.6),
        sy = Y(-0.9);
      ctx.fillStyle = "#444";
      ctx.fillRect(sx - 0.1 * Tt, sy, 0.2 * Tt, 0.8 * Tt);
      ctx.fillStyle = own || 1 ? B.col : "#7f8c8d";
      ctx.fillRect(sx - 2.6 * Tt, sy - 0.55 * Tt, 4.6 * Tt, 1.1 * Tt);
      ctx.strokeStyle = B.acc;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 2.6 * Tt, sy - 0.55 * Tt, 4.6 * Tt, 1.1 * Tt);
      ydLogo(ctx, sx - 2 * Tt, sy, 0.45 * Tt, B);
      ctx.textAlign = "left";
      ydText(B.name.toUpperCase(), sx - 1.45 * Tt, sy - 0.08 * Tt, Math.round(0.3 * Tt), "#fff");
      ydText(
        own
          ? ownCompany().toUpperCase()
          : "FOR SALE \u2022 " + money(OWN_TIERS[yd.tier || 1].price),
        sx - 1.45 * Tt,
        sy + 0.27 * Tt,
        Math.round(0.2 * Tt),
        B.acc,
        "bold ",
      );
      ctx.textAlign = "center";
      if (dark > 0.05) dnLight(sx, sy, 80, "rgba(255,255,255,0.9)", 0.6);
    }
    // floodlight masts
    for (const [fx, fy] of [
      [0.4, 0.4],
      [19.6, 0.4],
      [0.4, 23.6],
      [19.6, 23.6],
      [6.5, 9],
    ].concat(
      tr >= 3
        ? [
            [0.4, 8],
            [19.6, 8],
            [0.4, 14.6],
            [19.6, 14.6],
            [10, 19.1],
          ]
        : [],
    )) {
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.arc(X(fx), Y(fy), 5, 0, 7);
      ctx.fill();
      ctx.fillStyle = dark > 0.05 ? "#fff6d8" : "#bbb";
      ctx.fillRect(X(fx) - 6, Y(fy) - 2, 12, 4);
      if (dark > 0.05)
        dnLight(X(fx), Y(fy), own ? 300 : 150, "rgba(255,240,205,0.95)", own ? 0.85 : 0.45);
    }
    if (dark > 0.05) {
      dnLight(ox + ow / 2, oy + oh + 0.3 * Tt, 110, "rgba(255,214,140,0.9)", 0.7);
    }
    ctx.restore();
  }
}
function ownMapLabels(BX, BY, z, IR) {
  if (!world.forSale || z <= 1.2) return;
  for (const yd of ownYards()) {
    const own = ownedYard(yd);
    mapLabel(
      ydBrand(yd).name + (own ? " (yours)" : " \u2022 for sale"),
      BX(yd.entrance.x / M_T) + IR + 4,
      BY(yd.entrance.y / M_T),
      own ? "#9dffbf" : "#ffd08a",
      true,
    );
  }
}
// ---- warehouses / HQ / rail siding + gantry + train (all in yard tile units)
const RAIL_Y = 21.5,
  TR_STOP = 1.2,
  FLAT0 = 4.9,
  FLAT_L = 3.2;
function ownBld(R, yd, X, Y, Tt, dark, body, rib, label, col, doors) {
  const x = X(R.x0 - yd.x0),
    y = Y(R.y0 - yd.y0),
    w = R.w * Tt,
    h = R.h * Tt;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fillRect(x + 12, y + 12, w, h);
  ctx.fillStyle = body;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rib;
  for (let k = 8; k < w; k += 16) ctx.fillRect(x + k, y, 5, h);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, 0.45 * Tt);
  ydText(label, x + w / 2, y + h * 0.42, Math.round(0.42 * Tt), "#fff");
  for (let k = 0; k < doors; k++) {
    const dx = x + ((k + 0.5) * w) / doors;
    ctx.fillStyle = dark > 0.05 ? "#ffd27a" : "#2a2e33";
    ctx.fillRect(dx - 0.45 * Tt, y + 0.45 * Tt, 0.9 * Tt, 0.25 * Tt);
    ctx.fillRect(dx - 0.45 * Tt, y + h - 0.25 * Tt, 0.9 * Tt, 0.25 * Tt);
    if (dark > 0.05) {
      dnLight(dx, y - 0.2 * Tt, 70, "rgba(255,220,150,0.9)", 0.6);
      dnLight(dx, y + h + 0.3 * Tt, 70, "rgba(255,220,150,0.9)", 0.6);
    }
  }
}
function ownDrawBack(yd, X, Y, Tt, dark, own, B, tr) {
  ownBld(yd.wh, yd, X, Y, Tt, dark, "#8796a5", "#7a8896", "WAREHOUSE", own ? B.col : "#7f8c8d", 3);
  const plot = (R) => {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(X(R.x0 - yd.x0) + 3, Y(R.y0 - yd.y0) + 3, R.w * Tt - 6, R.h * Tt - 6);
    ctx.setLineDash([]);
    if (own)
      ydText(
        "UPGRADE PLOT",
        X(R.x0 - yd.x0) + (R.w * Tt) / 2,
        Y(R.y0 - yd.y0) + (R.h * Tt) / 2,
        Math.round(0.3 * Tt),
        "rgba(255,255,255,0.4)",
      );
  };
  if (tr >= 2 && own)
    ownBld(yd.wh2, yd, X, Y, Tt, dark, "#8a9a7a", "#7d8c6e", "MAINTENANCE & STORE", B.col, 3);
  else plot(yd.wh2);
  if (tr >= 3 && own) {
    ownBld(yd.hq, yd, X, Y, Tt, dark, "#e6e9ee", "#d5dae0", "DISTRIBUTION HQ", B.col, 2);
    ydLogo(ctx, X(3.5), Y(18.15), 0.45 * Tt, B);
  } else plot(yd.hq);
  // rail siding: ballast, sleepers, rails, buffer stop, tunnel portal on the east fence
  const ry = Y(RAIL_Y),
    S = PPM;
  // gantry crane rails: concrete runway beams with a steel rail + clips, either side of the track
  for (const cy of [19.4, 23.6]) {
    const yy = Y(cy);
    ctx.fillStyle = "#8b8f94";
    ctx.fillRect(X(0.2), yy - 0.55 * S, 19.6 * Tt, 1.1 * S);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(X(0.2), yy - 0.23 * S, 19.6 * Tt, 0.46 * S);
    ctx.fillStyle = "#8e959e";
    ctx.fillRect(X(0.2), yy - 0.15 * S, 19.6 * Tt, 0.3 * S);
    ctx.fillStyle = "#f6f9fc";
    ctx.fillRect(X(0.2), yy - 0.055 * S, 19.6 * Tt, 0.11 * S);
    ctx.fillStyle = "#3f4347";
    for (let t = 0.6; t < 19.8; t += 0.75) {
      ctx.fillRect(X(t) - 1.5, yy - 0.4 * S, 3, 0.8 * S);
    }
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(X(0.2), yy - 0.6 * S, 0.5 * S, 1.2 * S);
    ctx.fillRect(X(19.8) - 0.5 * S, yy - 0.6 * S, 0.5 * S, 1.2 * S);
  }
  railDrawPlain(ctx, ownSidingP(yd), yd.x0 * 7 + yd.y0, X(-2), Y(17), X(23), Y(26));
  // buffer stop (main-line style: red beam on a steel frame)
  ctx.fillStyle = "#2c3036";
  ctx.fillRect(X(0.25), ry - 1.1 * S, 0.5 * S, 2.2 * S);
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(X(0.45), ry - 1.0 * S, 0.45 * S, 2.0 * S);
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(X(0.45), ry - 0.15 * S, 0.45 * S, 0.3 * S);
  if (!yd.rc) {
    ctx.fillStyle = "#4b4f55";
    ctx.fillRect(X(19.2), ry - 1.4 * Tt, 1.6 * Tt, 2.8 * Tt);
    ctx.fillStyle = "#0b0c0e";
    ctx.fillRect(X(19.5), ry - 0.9 * Tt, 1.3 * Tt, 1.8 * Tt);
  }
  const R = yd.rt || {}; // train
  if (R.x != null) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0), ry - 2 * Tt, (yd.rc ? 20 : 19.5) * Tt, 4 * Tt);
    ctx.clip();
    const tx = (t) => X(R.x + t);
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.fillRect(tx(0) + 8, ry - 0.55 * Tt + 8, 3.4 * Tt, 1.1 * Tt);
    ctx.fillStyle = "#d35400";
    ctx.fillRect(tx(0), ry - 0.55 * Tt, 3.4 * Tt, 1.1 * Tt);
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(tx(0.3), ry - 0.4 * Tt, 0.8 * Tt, 0.8 * Tt);
    ctx.fillStyle = "#f1c40f";
    ctx.fillRect(tx(0), ry - 0.55 * Tt, 0.15 * Tt, 1.1 * Tt);
    if (dark > 0.05) {
      dnLight(tx(-0.3), ry, 120, "rgba(255,250,220,0.95)", 0.8);
    }
    for (let k = 0; k < 4; k++) {
      const fx = FLAT0 + k * FLAT_L;
      ctx.fillStyle = "#3d4249";
      ctx.fillRect(tx(fx - 1.2), ry - 0.4 * Tt, (FLAT_L - 0.2) * Tt, 0.8 * Tt);
      ctx.fillStyle = "#22262b";
      ctx.fillRect(tx(fx - 1.2), ry - 0.4 * Tt, (FLAT_L - 0.2) * Tt, 3);
      ctx.fillRect(tx(fx - 1.2), ry + 0.4 * Tt - 3, (FLAT_L - 0.2) * Tt, 3);
      if (R.box && R.box[k]) {
        ctx.fillStyle = R.box[k];
        ctx.fillRect(tx(fx - 1.1), ry - 0.48 * Tt, (FLAT_L - 0.4) * Tt, 0.96 * Tt);
        ctx.fillStyle = "rgba(0,0,0,.18)";
        for (let q = 0.3; q < FLAT_L - 0.5; q += 0.3)
          ctx.fillRect(tx(fx - 1.1 + q), ry - 0.48 * Tt, 2, 0.96 * Tt);
      }
    }
    ctx.restore();
  }
  // staged box at the warehouse door
  if (own && (ownedYard(yd).stock || 0) > 0 && !(R.cb && R.ph === "up")) {
    ctx.fillStyle = "#b9770e";
    ctx.fillRect(X(8.6), Y(19.55), 2.8 * Tt, 0.9 * Tt);
  }
  // rail-mounted gantry
  const gx = X(R.gx != null ? R.gx : 10),
    ty = Y(R.gy != null ? R.gy : RAIL_Y);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(gx - 1.3 * Tt + 14, Y(19.2) + 14, 2.6 * Tt, 4.6 * Tt);
  ctx.fillStyle = "#e1b12c";
  ctx.fillRect(gx - 1.4 * Tt, Y(19.1), 0.45 * Tt, 4.8 * Tt);
  ctx.fillRect(gx + 0.95 * Tt, Y(19.1), 0.45 * Tt, 4.8 * Tt);
  ctx.fillRect(gx - 1.4 * Tt, Y(19.1), 2.8 * Tt, 0.4 * Tt);
  ctx.fillRect(gx - 1.4 * Tt, Y(23.5), 2.8 * Tt, 0.4 * Tt);
  if (R.cb) {
    ctx.fillStyle = R.cb;
    ctx.fillRect(gx - 1.35 * Tt + 3, ty - 0.45 * Tt, 2.7 * Tt - 6, 0.9 * Tt);
  }
  ctx.fillStyle = "#2d3436";
  ctx.fillRect(gx - 0.95 * Tt, ty - 0.3 * Tt, 1.9 * Tt, 0.6 * Tt);
  ctx.fillStyle = "#e1b12c";
  ctx.fillRect(gx - 0.5 * Tt, ty - 0.2 * Tt, 1 * Tt, 0.4 * Tt);
  if (dark > 0.05) {
    dnLight(gx, Y(21.5), 180, "rgba(255,240,205,0.95)", own ? 0.8 : 0.4);
  }
}
function ownTrain(yd, dt) {
  const o = ownedYard(yd);
  let R = yd.rt;
  if (!R)
    R = yd.rt = {
      st: "away",
      t: 8 + Math.random() * 10,
      x: null,
      gx: 10,
      gy: RAIL_Y,
      box: [0, 0, 0, 0],
    };
  if (yd.rc === undefined) yd.rc = rlConnect(yd);
  if (!o) {
    return;
  }
  if (yd.rc && R.st === "away") {
    R.st = "in";
    R.x = TR_STOP + 3;
  } // connected yards keep their train at home between runs
  if (yd.rc && R.st === "out") {
    R.st = "ext";
    R.x = null;
    R.d = (TR_STOP + TR_LEN - 20) * M_T;
    R.v = 0;
    R.gy = RAIL_Y;
  }
  if (yd.rc && (R.st === "ext" || R.st === "hold" || R.st === "main" || R.st === "back")) {
    rlTrainStep(yd, R, dt);
    return;
  }
  const near = (a, b, v) => {
    const d = b - a;
    return Math.abs(d) <= v * dt ? b : a + Math.sign(d) * v * dt;
  };
  if (R.st === "away") {
    R.x = null;
    R.t -= dt;
    if (R.t <= 0) {
      R.st = "in";
      R.x = 21;
      R.box = [0, 0, 0, 0];
    }
  } else if (R.st === "in") {
    R.x = near(R.x, TR_STOP, Math.max(0.6, Math.min(4, (R.x - TR_STOP) * 0.6)));
    if (R.x === TR_STOP) {
      R.st = "load";
      R.k = 0;
      R.ph = "go";
      R.t = 6;
    }
  } else if (R.st === "load") {
    const fx = TR_STOP + FLAT0 + R.k * FLAT_L + 0.2;
    if (R.ph === "go") {
      R.gy = near(R.gy, 19.9, 1.5);
      R.gx = near(R.gx, 10, 2.5);
      if (R.gx === 10 && R.gy === 19.9) {
        if ((o.stock || 0) > 0) {
          o.stock--;
          R.cb = YARD_COLS[(Math.random() * 8) | 0];
          R.ph = "up";
        } else {
          R.t -= dt;
          if (R.t <= 0 || (R.k > 0 && R.t <= 3)) {
            R.st = "out";
          }
        }
      }
    } else if (R.ph === "up") {
      R.gx = near(R.gx, fx, 2.2);
      R.gy = near(R.gy, RAIL_Y, 1.2);
      if (R.gx === fx && R.gy === RAIL_Y) {
        R.box[R.k] = R.cb;
        R.cb = null;
        R.k++;
        R.t = 6;
        R.ph = R.k >= 4 ? "done" : "go";
        if (R.k >= 4) R.st = "out";
      }
    }
  } else if (R.st === "out") {
    R.gy = near(R.gy, RAIL_Y, 1.2);
    R.x += Math.min(5, 0.5 + (R.x - TR_STOP) * 0.4) * dt;
    if (R.x > 21) {
      R.st = "away";
      R.x = null;
      R.t = 70 + Math.random() * 40;
      if (R.k)
        toast(
          ydBrand(yd).name +
            ": freight train left with " +
            R.k +
            " container" +
            (R.k > 1 ? "s" : ""),
        );
    }
  }
}

// ---- rl: siding joins the main line (freight track) through a turnout; block reservation against the timetabled freight trains
const TR_LEN = 16.2,
  RL_V = 9,
  RL_HOLD = 125,
  RL_AHEAD = 500,
  RL_BEHIND = 1200;
function rlConnect(yd) {
  if (typeof RAIL === "undefined" || !RAIL.ready) return undefined;
  const sx = yd.x0 + 20,
    sy = yd.y0 + 21,
    E = [(yd.x0 + 20) * M_T, (yd.y0 + 21.5) * M_T];
  let bi = 0,
    bd = 1e18;
  for (let i = 0; i < RAIL.L; i += 2) {
    const d = Math.hypot(RAIL.X[i] - E[0], RAIL.Y[i] - E[1]);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  if (bd > 320 * M_T) {
    console.log("[rl] " + yd.name + ": main line " + Math.round(bd) + " m away - keeps its spur");
    return null;
  }
  const R = Math.round(bd / M_T) + 70,
    x0 = Math.max(1, sx - R),
    y0 = Math.max(1, sy - R),
    x1 = Math.min(MW - 2, sx + R),
    y1 = Math.min(MH - 2, sy + R),
    W = x1 - x0 + 1,
    H = y1 - y0 + 1,
    blk = new Uint8Array(W * H),
    goal = new Map();
  const at = (i, j) => (j - y0) * W + (i - x0),
    inR = (i, j) => i >= x0 && i <= x1 && j >= y0 && j <= y1;
  for (let s = 0; s < RAIL.L; s += 1.5) {
    const c = railPt(s, 0);
    const ti = c[0] / M_T,
      tj = c[1] / M_T;
    if (ti < x0 - 4 || ti > x1 + 4 || tj < y0 - 4 || tj > y1 + 4) continue;
    for (let a = -3; a <= 3; a++)
      for (let b = -3; b <= 3; b++) {
        const i = Math.floor(ti) + a,
          j = Math.floor(tj) + b;
        if (inR(i, j) && Math.hypot(i + 0.5 - ti, j + 0.5 - tj) < 3.2) blk[at(i, j)] = 1;
      }
    const f = railPt(s, RW_F - 3.4);
    const gi = Math.floor(f[0] / M_T),
      gj = Math.floor(f[1] / M_T);
    if (inR(gi, gj)) goal.set(at(gi, gj), s);
  }
  const bad = (i, j) => {
    const k = idx(i, j);
    return (
      isSolidTile(i, j) ||
      (world.water && world.water[k]) ||
      world.roadH[k] >= 0 ||
      world.roadV[k] >= 0 ||
      G[k] === T.ROAD ||
      G[k] === T.BRIDGE ||
      (world.reserved[k] && !(i >= yd.x0 && i < yd.x0 + yd.w && j >= yd.y0 && j < yd.y0 + yd.h))
    );
  };
  const prev = new Int32Array(W * H).fill(-2),
    q = [at(sx, sy)];
  if (!inR(sx, sy) || bad(sx, sy)) {
    console.log("[rl] " + yd.name + ": siding exit blocked");
    return null;
  }
  prev[q[0]] = -1;
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const c = q[h],
      i = (c % W) + x0,
      j = ((c / W) | 0) + y0;
    for (const [a, b] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const ni = i + a,
        nj = j + b;
      if (!inR(ni, nj)) continue;
      const n = at(ni, nj);
      if (prev[n] !== -2) continue;
      if (a && b && (bad(i + a, j) || bad(i, j + b))) continue;
      if (goal.has(n) && !bad(ni, nj)) {
        prev[n] = c;
        hit = n;
        break;
      }
      if (blk[n] || bad(ni, nj)) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  if (hit < 0) {
    console.log(
      "[rl] " +
        yd.name +
        ": no clear route to the main line (roads/buildings/water in the way) - keeps its spur",
    );
    return null;
  }
  const path = [];
  for (let c = hit; c >= 0; c = prev[c])
    path.push([((c % W) + x0 + 0.5) * M_T, (((c / W) | 0) + y0 + 0.5) * M_T]);
  path.reverse();
  if (path.length > 360) {
    console.log("[rl] " + yd.name + ": route too long");
    return null;
  }
  const sn = goal.get(hit),
    Q = [E];
  for (let k = 3; k < path.length - 1; k += 3) Q.push(path[k]);
  Q.push(path[path.length - 1]);
  // turnout: swing in along the freight track so the train joins tangentially, running with the freight direction (-s)
  const sj = sn - 70;
  Q.push(railPt(sn - 25, RW_F - 1.6));
  Q.push(railPt(sj, RW_F));
  // smooth (Chaikin x2) keeping the ends
  let P = Q;
  for (let it = 0; it < 2; it++) {
    const N = [P[0]];
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k],
        b = P[k + 1];
      if (k > 0) N.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      if (k < P.length - 2) N.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    N.push(P[P.length - 1]);
    P = N;
  }
  const cum = [0];
  for (let k = 1; k < P.length; k++)
    cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
  if (typeof DOCK_FENCE !== "undefined") {
    if (!DOCK_FENCE) DOCK_FENCE = new Uint8Array(MW * MH);
    for (const p of path) {
      const i = Math.floor(p[0] / M_T),
        j = Math.floor(p[1] / M_T);
      if (!blk[at(i, j)]) DOCK_FENCE[idx(i, j)] = 1;
    }
  }
  // nearest station = the terminal the train serves on its lap
  let st = null,
    sb = 1e18;
  for (const S of RAIL.stations || []) {
    const d = rlMod(sj - S.s, RAIL.L);
    if (d > 2000 && d < sb) {
      sb = d;
      st = S;
    }
  }
  console.log(
    "[rl] " +
      yd.name +
      ": connected, " +
      Math.round(cum[cum.length - 1]) +
      " m spur to arc " +
      Math.round(sj) +
      (st ? " via " + st.name : ""),
  );
  return { P, cum, Lq: cum[cum.length - 1], sj, dest: st ? st.name : "the main line", ds: sb };
}
function rlQ(rc, d) {
  const P = rc.P,
    c = rc.cum;
  d = Math.max(0, Math.min(rc.Lq, d));
  let k = 1;
  while (k < c.length - 1 && c[k] < d) k++;
  const f = (d - c[k - 1]) / (c[k] - c[k - 1] || 1);
  return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f];
}
function rlPos(yd, d) {
  const rc = yd.rc,
    Lq = rc.Lq,
    L = RAIL.L,
    ex = (yd.x0 + 20) * M_T,
    ey = (yd.y0 + 21.5) * M_T;
  if (d < 0) return [ex + d, ey];
  if (d <= Lq) return rlQ(rc, d);
  if (d <= Lq + L) return railPt(rc.sj - (d - Lq), RW_F);
  if (d <= 2 * Lq + L) return rlQ(rc, 2 * Lq + L - d);
  return [ex - (d - 2 * Lq - L), ey];
}
function rlCars(yd, R) {
  const out = [];
  const add = (k, off, len, box) => {
    const a = rlPos(yd, R.d - (off - len / 2) * M_T),
      b = rlPos(yd, R.d - (off + len / 2) * M_T);
    out.push({
      k,
      x: (a[0] + b[0]) / 2,
      y: (a[1] + b[1]) / 2,
      ang: Math.atan2(a[1] - b[1], a[0] - b[0]),
      L: len * M_T,
      box,
    });
  };
  add("loco", 1.7, 3.4);
  for (let k = 0; k < 4; k++) add("flat", 3.6 + k * 3.2 + 1.5, 3.0, R.box[k]);
  return out;
}
// arc span this train occupies on the main line (for crossings + reservation), or null
function rlSpan(yd, R) {
  const rc = yd.rc,
    Lq = rc.Lq,
    L = RAIL.L,
    h = R.d,
    t = R.d - TR_LEN * M_T;
  if (h < Lq || t > Lq + L) return null;
  const a = rc.sj - (Math.min(h, Lq + L) - Lq),
    b = rc.sj - (Math.max(t, Lq) - Lq);
  return [a, b];
}
function rlClear(rc, t) {
  for (const tr of RAIL.trains) {
    if (tr.pax) continue;
    const [a, b] = railSpan(tr, t, 0);
    if (rlOvl(a, b, rc.sj - RL_AHEAD, rc.sj + TR_LEN * M_T + RL_BEHIND)) return false;
  }
  return true;
}
function rlTrainStep(yd, R, dt) {
  const rc = yd.rc,
    Lq = rc.Lq,
    L = RAIL.L,
    acc = (vt, a) => {
      R.v = R.v < vt ? Math.min(vt, R.v + a * dt) : Math.max(vt, R.v - a * 1.5 * dt);
    };
  if (R.st === "ext") {
    const hp = Lq - RL_HOLD,
      rem = hp - R.d;
    acc(Math.min(RL_V, Math.max(1.2, Math.sqrt(2 * 0.8 * Math.max(0, rem)))), 0.8);
    R.d = Math.min(hp, R.d + R.v * dt);
    if (R.d >= hp - 0.01) {
      R.st = "hold";
      R.v = 0;
      R.wait = 0;
    }
  } else if (R.st === "hold") {
    R.wait += dt;
    if (rlClear(rc, railTime())) {
      R.st = "main";
      R.v = RL_V * 0.6;
    }
  } else if (R.st === "main") {
    const vt = R.d < Lq + L - 400 ? RAIL.vF : RL_V;
    acc(vt, R.d < Lq + 200 ? 1.1 : 0.9);
    R.d += R.v * dt;
    if (!R.unl && R.d > Lq + rc.ds) {
      R.unl = 1;
      const n = R.box.filter(Boolean).length;
      R.box = [0, 0, 0, 0];
      if (n)
        toast(
          ydBrand(yd).name +
            ": " +
            n +
            " container" +
            (n > 1 ? "s" : "") +
            " delivered by rail to " +
            rc.dest,
        );
    }
    if (R.d >= Lq + L) R.st = "back";
  } else if (R.st === "back") {
    const end = 2 * Lq + L + (20 - TR_STOP) * M_T,
      rem = end - R.d;
    acc(Math.min(RL_V, Math.max(0.8, Math.sqrt(2 * 0.7 * Math.max(0, rem)))), 0.9);
    R.d = Math.min(end, R.d + R.v * dt);
    if (R.d >= end - 0.01) {
      R.st = "load";
      R.x = TR_STOP;
      R.k = 0;
      R.ph = "go";
      R.t = 6;
      R.unl = 0;
      R.box = [0, 0, 0, 0];
    }
  }
}
function rlExtSpans() {
  const out = [];
  for (const yd of ownYards()) {
    const R = yd.rt;
    if (yd.rc && R && (R.st === "main" || R.st === "back" || R.st === "hold")) {
      const sp = rlSpan(yd, R);
      if (sp) out.push(sp);
    }
  }
  return out;
}
function ownSidingP(yd) {
  if (yd.sP) return yd.sP;
  const y = (yd.y0 + RAIL_Y) * M_T;
  return (yd.sP = railSample([
    [(yd.x0 + 0.3) * M_T, y],
    [(yd.x0 + (yd.rc ? 20 : 19.4)) * M_T, y],
  ]));
}
function ownSpurP(yd) {
  const rc = yd.rc;
  if (!rc) return null;
  if (yd.spP) return yd.spP;
  const P = railSample(rc.P, 200);
  // where the spur runs over the main line's own track bed only redraw the rails, so the main ballast/sleepers show through seamlessly
  const ref = [];
  for (let s = rc.sj - 20; s <= rc.sj + 160; s += 1) ref.push(railPt(s, RW_F));
  for (const p of P) {
    let d = 1e9;
    for (const q of ref) d = Math.min(d, Math.hypot(p.x - q[0], p.y - q[1]));
    if (d < 3.2) p.k = 5;
  }
  return (yd.spP = P);
}
function rlDrawExt(vx0, vy0, vx1, vy1, dark) {
  const S = PPM;
  for (const yd of ownYards()) {
    const rc = yd.rc;
    if (!rc) continue;
    // spur track: ballast, sleepers, rails, turnout
    ctx.save();
    railDrawPlain(ctx, ownSpurP(yd), yd.x0 * 7 + yd.y0 + 1, vx0, vy0, vx1, vy1);
    const j = railPt(rc.sj, RW_F),
      j2 = railPt(rc.sj - 12, RW_F),
      sg = rlPos(yd, rc.Lq - RL_HOLD + 6);
    // block signal at the hold point: green when the train holds a reservation / runs, red otherwise
    const R = yd.rt || {},
      go = R.st === "main" || R.st === "back";
    ctx.fillStyle = "#222";
    ctx.fillRect(sg[0] * S - 6, sg[1] * S - 14, 12, 24);
    ctx.fillStyle = go ? "#2ecc71" : "#e74c3c";
    ctx.beginPath();
    ctx.arc(sg[0] * S, sg[1] * S - 6, 4.5, 0, 7);
    ctx.fill();
    if (dark > 0.05)
      dnLight(
        sg[0] * S,
        sg[1] * S - 6,
        40,
        go ? "rgba(80,255,140,0.9)" : "rgba(255,80,60,0.9)",
        0.7,
      );
    if (dark > 0.05) {
      for (const d of [rc.Lq * 0.33, rc.Lq * 0.66, rc.Lq - 6]) {
        const p = rlPos(yd, d);
        dnLight(p[0] * S, p[1] * S, 120, "rgba(255,240,205,0.95)", 0.6);
        ctx.fillStyle = "#fff6d8";
        ctx.fillRect(p[0] * S - 4, p[1] * S - 2, 8, 4);
      }
    }
    ctx.restore();
    if (!(R.st === "ext" || R.st === "hold" || R.st === "main" || R.st === "back")) continue;
    for (const c of rlCars(yd, R)) {
      if (c.x * S < vx0 - 200 || c.x * S > vx1 + 200 || c.y * S < vy0 - 200 || c.y * S > vy1 + 200)
        continue;
      ctx.save();
      ctx.translate(c.x * S, c.y * S);
      ctx.rotate(c.ang);
      const l = c.L * S,
        w = 0.95 * M_T * S;
      ctx.fillStyle = "rgba(0,0,0,.3)";
      ctx.fillRect(-l / 2 + 6, -w / 2 + 6, l, w);
      if (c.k === "loco") {
        ctx.fillStyle = "#d35400";
        ctx.fillRect(-l / 2, -w / 2, l, w);
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(l / 2 - 0.9 * M_T * S, -w * 0.38, 0.7 * M_T * S, w * 0.76);
        ctx.fillStyle = "#f1c40f";
        ctx.fillRect(l / 2 - 4, -w / 2, 4, w);
        if (dark > 0.05) dnLight(l / 2 + 30, 0, 120, "rgba(255,250,220,0.95)", 0.8);
      } else {
        ctx.fillStyle = "#3d4249";
        ctx.fillRect(-l / 2, -w * 0.42, l, w * 0.84);
        if (c.box) {
          ctx.fillStyle = c.box;
          ctx.fillRect(-l / 2 + 3, -w / 2, l - 6, w);
          ctx.fillStyle = "rgba(0,0,0,.18)";
          for (let q = 6; q < l - 6; q += 8) ctx.fillRect(-l / 2 + q, -w / 2, 2, w);
        }
      }
      ctx.restore();
    }
  }
}
function ownMap(BX, BY, z) {
  if (!world.forSale) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const yd of ownYards()) {
    if (yd.rc) {
      // rl2: draw the spur in the same style as the main line (dark bed + white sleeper dashes) so it reads as real track joining the network
      const sp = () => {
        ctx.beginPath();
        yd.rc.P.forEach((p, k) =>
          k
            ? ctx.lineTo(BX(p[0] / M_T), BY(p[1] / M_T))
            : ctx.moveTo(BX(p[0] / M_T), BY(p[1] / M_T)),
        );
        ctx.stroke();
      };
      ctx.strokeStyle = "#1e1e1e";
      ctx.lineWidth = Math.max(3.5, 1.1 * z);
      sp();
      ctx.strokeStyle = "#e8e8e8";
      ctx.lineWidth = Math.max(1.2, 0.35 * z);
      ctx.setLineDash([Math.max(3, z), Math.max(3, z)]);
      sp();
      ctx.setLineDash([]);
      const J = yd.rc.P[yd.rc.P.length - 1];
      ctx.fillStyle = "#f5b82e";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(BX(J[0] / M_T), BY(J[1] / M_T), Math.max(3, 0.8 * z), 0, 7);
      ctx.fill();
      ctx.stroke();
      const R = yd.rt;
      if (R && (R.st === "ext" || R.st === "hold" || R.st === "main" || R.st === "back")) {
        const p = rlPos(yd, R.d);
        ctx.fillStyle = "#ff6a13";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(BX(p[0] / M_T), BY(p[1] / M_T), Math.max(4, 1.2 * z), 0, 7);
        ctx.fill();
        ctx.stroke();
      }
    }
    const y = BY(yd.y0 + RAIL_Y),
      x0 = BX(yd.x0),
      x1 = BX(yd.x0 + 20);
    ctx.strokeStyle = yd.rc ? "#1e1e1e" : "#5d4c3c";
    ctx.lineWidth = yd.rc ? Math.max(3.5, 1.1 * z) : Math.max(2, 0.9 * z);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.strokeStyle = "#d0d4d8";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.setLineDash([]);
    const R = yd.rt;
    if (R && R.x != null && R.x < 19.5) {
      ctx.fillStyle = "#d35400";
      ctx.fillRect(
        BX(yd.x0 + R.x),
        y - Math.max(2, 0.6 * z),
        Math.max(4, (Math.min(19.5, R.x + 17) - R.x) * z),
        Math.max(4, 1.2 * z),
      );
    }
  }
  ctx.restore();
}

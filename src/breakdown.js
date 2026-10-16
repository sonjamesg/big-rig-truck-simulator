/**
 * @file breakdown.js — BREAKDOWN at 100% damage
 * Exposes (globals): BD_IN, BREAKDOWN, bdNearestService, bdFailMission, bdStart, bdEnd, bdPanel,
 *   bdFocus, updateBreakdown, drawBreakdown
 * Depends on: world.js, physics.js, audio.js, depots.js, career.js, ui.js, satnav.js, gamepad.js,
 *   main.js
 * Load order: #23 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v12 BREAKDOWN at 100% damage =====================
// Data-driven: options are records {id,label,sub(),enabled(),run()}. A later "call roadside repair" option
// (orange recovery truck drives in, patches to roadworthy for a fee, mission continues) only needs
// BREAKDOWN.addOption({...}) — the panel, gamepad/touch focus and state machine pick it up automatically.
const BD_IN = {
  up: false,
  down: false,
  left: false,
  right: false,
  hand: true,
  horn: false,
  padSteer: 0,
};
const BREAKDOWN = {
  active: false,
  t: 0,
  at: null,
  smoke: null,
  options: [],
  fee: () => Math.min(Math.max(0, truck.money), 250),
  addOption(o) {
    this.options.push(o);
    this.options.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (this.active) bdPanel();
  },
  removeOption(id) {
    this.options = this.options.filter((o) => o.id !== id);
  },
};
function bdNearestService() {
  let best = null,
    bd = 1e18;
  const t = truck;
  for (const g of world.garages || []) {
    const d = (g.x - t.x) ** 2 + (g.y - t.y) ** 2;
    if (d < bd) {
      bd = d;
      best = { x: g.x, y: g.y, name: g.name };
    }
  }
  for (const dp of world.depots || []) {
    const e = dp.entrance;
    const d = (e.x - t.x) ** 2 + (e.y - t.y) ** 2;
    if (d < bd) {
      bd = d;
      best = { x: e.x, y: e.y, name: dp.name };
    }
  }
  return best;
}
function bdFailMission() {
  const a = career.active;
  if (!a) return null;
  const tr = a.trailer,
    name = a.job.cargo && a.job.cargo.name;
  if (truck.trl === tr) uncouple();
  const b = a.pickBay;
  if (b && !b.trailer) {
    tr.x = b.kx;
    tr.y = b.ky;
    tr.th = b.th;
    tr.bay = b;
    b.trailer = tr;
    tr.coupled = false;
  } // trailer returned to its depot
  else {
    const i = world.trailers.indexOf(tr);
    if (i >= 0) world.trailers.splice(i, 1);
  }
  abandonJob(true);
  BigRig.emit("missionFailed", { reason: "breakdown", cargo: name });
  return name;
}
BREAKDOWN.addOption({
  id: "respawn",
  order: 100,
  label: "RESPAWN",
  sub: () => {
    const s = bdNearestService();
    return (
      "Tow to " +
      (s ? s.name : "nearest garage") +
      " \u2022 \u00a3" +
      BREAKDOWN.fee() +
      " \u2022 damage reset" +
      (career.active ? " \u2022 mission FAILED" : "")
    );
  },
  enabled: () => true,
  run() {
    const s = bdNearestService(),
      fee = BREAKDOWN.fee();
    const lost = bdFailMission();
    if (truck.trl) uncouple();
    if (s) {
      const p = ftRoadSpot(s.x, s.y);
      if (p) rigPlace(p);
      else {
        truck.x = s.x;
        truck.y = s.y + 6;
      }
    }
    truck.v = 0;
    truck.damage = 0;
    truck.money -= fee;
    bdEnd();
    flash(
      "Recovered to " +
        (s ? s.name : "garage") +
        " \u2022 \u00a3" +
        fee +
        (lost ? " \u2022 job failed" : ""),
    );
    BigRig.emit("respawn", { at: s, fee });
    saveGame && saveGame();
  },
});
function bdStart() {
  if (BREAKDOWN.active) return;
  BREAKDOWN.active = true;
  BREAKDOWN.t = 0;
  BREAKDOWN.at = { x: truck.x, y: truck.y };
  BREAKDOWN.smoke = { x: 0, y: 0, s: 1.2, bd: 1 };
  world.smokers.push(BREAKDOWN.smoke);
  try {
    thump(1);
  } catch (e) {}
  BigRig.emit("breakdown", { x: truck.x, y: truck.y, mission: !!career.active });
  bdPanel();
}
function bdEnd() {
  BREAKDOWN.active = false;
  const i = world.smokers.indexOf(BREAKDOWN.smoke);
  if (i >= 0) world.smokers.splice(i, 1);
  BREAKDOWN.smoke = null;
  const p = document.getElementById("bdPanel");
  if (p) p.remove();
}
function bdPanel() {
  let p = document.getElementById("bdPanel");
  if (!p) {
    p = document.createElement("div");
    p.id = "bdPanel";
    document.getElementById("frame").appendChild(p);
  }
  p.style.cssText =
    "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;background:rgba(20,10,8,0.92);border:2px solid #ff5a36;border-radius:14px;padding:18px 22px;color:#fff;font-family:system-ui,sans-serif;text-align:center;min-width:300px;box-shadow:0 10px 40px rgba(0,0,0,0.6)";
  p.innerHTML =
    '<div style="font:900 26px system-ui;letter-spacing:3px;color:#ff6a3d">\u26a0 BROKEN DOWN</div><div style="opacity:.8;margin:6px 0 14px;font-size:13px">Engine failure \u2014 damage 100%</div>' +
    BREAKDOWN.options
      .filter((o) => o.enabled())
      .map(
        (o, i) =>
          '<button class="btn bdOpt" data-id="' +
          o.id +
          '" style="display:block;width:100%;margin:6px 0;padding:10px;font:800 16px system-ui;border-radius:10px;border:none;background:#f5b82e;color:#111;cursor:pointer">' +
          (typeof pad !== "undefined" && pad.active && i === 0 ? "\u24b6 " : "") +
          o.label +
          '<div style="font:600 11px system-ui;opacity:.75">' +
          o.sub() +
          "</div></button>",
      )
      .join("");
  bdFocus();
  if (!document.getElementById("pfcss")) {
    const st = document.createElement("style");
    st.id = "pfcss";
    st.textContent = ".bdOpt.padfocus{outline:3px solid #f5b82e;outline-offset:2px}";
    document.head.appendChild(st);
  }
  for (const b of p.querySelectorAll(".bdOpt"))
    b.onclick = () => {
      const o = BREAKDOWN.options.find((o) => o.id === b.dataset.id);
      if (o) o.run();
    };
}
// focus the first option so pad A / Enter / Space pick it straight away
function bdFocus() {
  setTimeout(() => {
    if (typeof padNav === "function") padNav(null);
  }, 0);
}
function updateBreakdown(dt) {
  if (!started) return;
  if (!BREAKDOWN.active && truck.damage >= 100) bdStart();
  if (!BREAKDOWN.active) return;
  BREAKDOWN.t += dt;
  const f = fwd(truck.h);
  BREAKDOWN.smoke.x = (truck.x + f[0] * 4.2) * PPM;
  BREAKDOWN.smoke.y = (truck.y + f[1] * 4.2) * PPM;
}
function drawBreakdown() {
  if (!BREAKDOWN.active || (timeS * 1.6) % 1 > 0.55) return;
  const f = fwd(truck.h),
    r = [-f[1], f[0]];
  ctx.save();
  const pts = [
    [5.2, 1.15],
    [5.2, -1.15],
    [-1.4, 1.2],
    [-1.4, -1.2],
  ];
  if (truck.trl) {
    const t = truck.trl,
      tf = fwd(t.th || 0),
      tr = [-tf[1], tf[0]];
    for (const s of [1, -1]) {
      const x = t.x - tf[0] * 11.8 + tr[0] * s * 1.25,
        y = t.y - tf[1] * 11.8 + tr[1] * s * 1.25;
      ctx.fillStyle = "rgba(255,170,0,0.35)";
      ctx.beginPath();
      ctx.arc(x * PPM, y * PPM, 9, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#ffb000";
      ctx.beginPath();
      ctx.arc(x * PPM, y * PPM, 3, 0, 7);
      ctx.fill();
    }
  }
  for (const [a, b] of pts) {
    const x = (truck.x + f[0] * a + r[0] * b) * PPM,
      y = (truck.y + f[1] * a + r[1] * b) * PPM;
    ctx.fillStyle = "rgba(255,170,0,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#ffb000";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}
BigRig.breakdown = BREAKDOWN;

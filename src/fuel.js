/**
 * @file fuel.js — FUEL, CASH, DAMAGE (stub)
 * Exposes (globals): DIESEL_RATE, refuel, fuelWhy, fuelStationAt, updateFuel, stopRefuel,
 *   toggleRefuel, drawFuelHUD, drawPOIs
 * Depends on: world.js, lorry.js, physics.js, depots.js, services.js, career.js, ui.js,
 *   owndepot.js, homes.js, nightmap.js, main.js
 * Load order: #12 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== FUEL, CASH, DAMAGE (stub) =====================
const DIESEL_RATE = 22; // litres per second at the pump
const refuel = { active: false, litres: 0, cost: 0, station: null };
// v7: lorries refuel only inside a marked HGV bay; a solo cab may also use a car pump
let fuelWhy = null;
function fuelStationAt() {
  const s = truck,
    f = fwd(s.h),
    cx = s.x + f[0] * 1.9,
    cy = s.y + f[1] * 1.9;
  fuelWhy = null;
  for (const st of world.fuel) {
    if (Math.abs(st.x - cx) > 90 || Math.abs(st.y - cy) > 90) continue;
    if (st.hgv) {
      for (const b of st.hgv) {
        const k = s.trl ? kingpin(s) : null;
        const inB = (px, py) => px >= b.x0 && px <= b.x1 && py >= b.y0 - 1 && py <= b.y1 + 1;
        if (inB(cx, cy) && (!k || inB(k[0], k[1]))) {
          st._bay = b;
          return st;
        }
      }
      for (const z of st.zones)
        if (cx >= z[0] && cx <= z[2] && cy >= z[1] && cy <= z[3]) {
          if (s.trl) {
            fuelWhy = "Car pumps: cab only \u2014 lorries with trailers use the HGV DIESEL lanes";
            return null;
          }
          st._bay = null;
          return st;
        }
      continue;
    }
    for (const z of st.zones) if (cx >= z[0] && cx <= z[2] && cy >= z[1] && cy <= z[3]) return st;
  }
  return null;
}
function updateFuel(dt) {
  const s = truck;
  if (!started) return;
  const lps =
    (0.004 + 0.11 * s.throttle * (s.rpm / 1800)) *
    Math.pow((s.mass || 22000) / 22000, 0.7) *
    (s.econ || 1);
  if (s.fuel > 0) {
    s.fuel = Math.max(0, s.fuel - lps * dt);
    if (s.fuel === 0) flash("OUT OF FUEL \u2014 call for help or coast to a pump");
  }
  s.fuelUsed = (s.fuelUsed || 0) + lps * dt;
  if (refuel.active) {
    const st = fuelStationAt();
    if (!st || Math.abs(s.v) > 0.3) {
      stopRefuel("Refuelling stopped");
      return;
    }
    const add = Math.min(DIESEL_RATE * dt, s.tank - s.fuel, s.money / st.price);
    if (add <= 0.0001) {
      stopRefuel(s.fuel >= s.tank - 0.01 ? "Tank full" : "Not enough cash");
      return;
    }
    s.fuel += add;
    s.money -= add * st.price;
    refuel.litres += add;
    refuel.cost += add * st.price;
  }
}
function stopRefuel(why) {
  if (!refuel.active) return;
  refuel.active = false;
  clunk(0.3);
  flash(`${why}: ${refuel.litres.toFixed(0)} L for \u00a3${refuel.cost.toFixed(2)}`);
  BigRig.emit("refuel", { litres: refuel.litres, cost: refuel.cost, station: refuel.station });
}
function toggleRefuel() {
  const s = truck;
  if (refuel.active) {
    stopRefuel("Refuelling stopped");
    return;
  }
  const st = fuelStationAt();
  if (!st) {
    flash(fuelWhy || "Stop inside a marked HGV DIESEL bay at a truck stop to refuel");
    return;
  }
  if (Math.abs(s.v) > 0.3) {
    flash("Stop at the pump first");
    return;
  }
  if (s.fuel >= s.tank - 0.5) {
    flash("Tank already full");
    return;
  }
  if (s.money < st.price) {
    flash("Not enough cash");
    return;
  }
  refuel.active = true;
  refuel.litres = 0;
  refuel.cost = 0;
  refuel.station = st;
  clunk(0.3);
}
function drawFuelHUD() {
  const s = truck,
    x = 14,
    y = 14,
    w = 190,
    h = 74;
  ctx.save();
  ctx.fillStyle = "rgba(8,12,20,0.72)";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.fillStyle = "#7dff9a";
  ctx.font = "bold 18px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(money(s.money), x + 10, y + 24);
  const fr = s.fuel / s.tank;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "bold 10px system-ui,sans-serif";
  ctx.fillText("FUEL", x + 10, y + 44);
  ctx.fillText("E", x + 48, y + 44);
  ctx.fillText("F", x + 174, y + 44);
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 58, y + 35, 112, 10);
  ctx.fillStyle =
    fr < 0.15 ? (timeS % 1 < 0.5 ? "#ff4d3a" : "#7a1a10") : fr < 0.3 ? "#ffb020" : "#5fd36d";
  ctx.fillRect(x + 58, y + 35, 112 * fr, 10);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(x + 58 + 28 * k, y + 35);
    ctx.lineTo(x + 58 + 28 * k, y + 45);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "11px system-ui,sans-serif";
  ctx.fillText(
    `${s.fuel.toFixed(0)} / ${s.tank} L  \u2022  damage ${s.damage.toFixed(0)}%`,
    x + 10,
    y + 62,
  );
  ctx.restore();
  const st = fuelStationAt();
  if (!st && fuelWhy && Math.abs(s.v) < 0.3) {
    ctx.save();
    ctx.font = "bold 15px system-ui,sans-serif";
    ctx.textAlign = "center";
    const tw = ctx.measureText(fuelWhy).width + 30;
    ctx.fillStyle = "rgba(8,12,20,0.75)";
    ctx.fillRect(VW / 2 - tw / 2, VH - 170, tw, 30);
    ctx.fillStyle = "#ffcf5a";
    ctx.fillText(fuelWhy, VW / 2, VH - 150);
    ctx.restore();
  }
  if (refuel.active || (st && Math.abs(s.v) < 0.3)) {
    const text = refuel.active
      ? `Refuelling\u2026 ${refuel.litres.toFixed(0)} L  \u00a3${refuel.cost.toFixed(2)}  (F to stop)`
      : `Press F to refuel \u2022 ${st._bay ? "HGV bay " + st._bay.id : "car pump"} \u2022 ${st.name} \u2022 diesel \u00a3${st.price.toFixed(2)}/L`;
    ctx.save();
    ctx.font = "bold 16px system-ui,sans-serif";
    ctx.textAlign = "center";
    const tw = ctx.measureText(text).width + 30;
    ctx.fillStyle = "rgba(8,12,20,0.75)";
    ctx.fillRect(VW / 2 - tw / 2, VH - 170, tw, 30);
    ctx.fillStyle = "#7dff9a";
    ctx.fillText(text, VW / 2, VH - 149);
    ctx.restore();
  }
}
// minimap / big-map icons for depots, petrol stations and repair garages
function drawPOIs(px, py, big, R) {
  const rr = R || (big ? 7 : 5.5);
  const icon = (X, Y, col, ch) => {
    if (typeof nmIconRing === "function") nmIconRing(X, Y, rr);
    ctx.fillStyle = col;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = R ? Math.max(1.5, rr * 0.18) : 1.5;
    ctx.beginPath();
    ctx.arc(X, Y, rr, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(rr * 1.25)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, X, Y + 0.5);
  };
  for (const d of world.depots) icon(px(d.entrance.x), py(d.entrance.y), "#2f7fe0", "D");
  for (const f of world.fuel) icon(px(f.x), py(f.y), "#25a244", "F");
  for (const g of world.garages) icon(px(g.x), py(g.y), "#e67e22", "G");
  for (const m of world.malls || [])
    icon(
      px(m.entrance.x),
      py(m.entrance.y),
      career.active && career.active.job.to === m ? "#ff3df0" : "#d6336c",
      "S",
    );
  for (const d of world.dealers || []) icon(px(d.entrance.x), py(d.entrance.y), "#8e44ad", "$");
  if (typeof svcMapIcons === "function") svcMapIcons(icon, px, py);
  if (typeof homeMapIcons === "function") homeMapIcons(icon, px, py);
  for (const y of world.forSale || [])
    icon(
      px(y.entrance.x),
      py(y.entrance.y),
      typeof ownedYard === "function" && ownedYard(y) ? ydBrand(y).col : "#f39c12",
      "Y",
    );
  ctx.textBaseline = "alphabetic";
}

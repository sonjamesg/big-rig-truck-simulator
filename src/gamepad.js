/**
 * @file gamepad.js — XBOX CONTROLLER (Gamepad API, standard mapping) — works alongside the keyboard
 * Exposes (globals): pad, GLYPH, padList, padSeen, padGone, dz, padUpdate, padFocusables,
 *   padFocusEl, padNav, padGlyphs, padInstall, padHud, drawPadMapCursor
 * Depends on: keyguard.js, world.js, physics.js, depots.js, fuel.js, career.js, ui.js, satnav.js,
 *   mp.js, breakdown.js, indicators.js, beams.js, tune.js, repair.js, main.js, wanted.js
 * Load order: #19 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v8 XBOX CONTROLLER (Gamepad API, standard mapping) — works alongside the keyboard =====================
// Buttons: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 10 LS, 11 RS, 12 Up, 13 Down, 14 Left, 15 Right. Axes: 0 LX, 1 LY.
const pad = {
  idx: -1,
  id: "",
  active: false,
  prev: [],
  steer: 0,
  lastUse: -99,
  navT: 0,
  focus: null,
  connected: {},
  hb: false,
};
const GLYPH = {
  A: "\u24B6",
  B: "\u24B7",
  X: "\u24CD",
  Y: "\u24CE",
  LB: "LB",
  RB: "RB",
  LT: "LT",
  RT: "RT",
  VIEW: "View",
  MENU: "Menu",
};
function padList() {
  try {
    return navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : [];
  } catch (e) {
    return [];
  }
}
addEventListener("gamepadconnected", (e) => padSeen(e.gamepad));
addEventListener("gamepaddisconnected", (e) => padGone(e.gamepad.index));
function padSeen(g) {
  if (!g || pad.connected[g.index]) return;
  pad.connected[g.index] = g.id;
  if (pad.idx < 0) {
    pad.idx = g.index;
    pad.id = g.id;
  }
  if (typeof toast === "function")
    toast(
      "\u{1F3AE} Controller connected" +
        (g.id
          ? " \u2014 " +
            g.id
              .replace(/\(.*?\)/g, "")
              .trim()
              .slice(0, 40)
          : ""),
    );
  BigRig.emit("padConnected", { index: g.index, id: g.id });
}
function padGone(i) {
  if (!pad.connected[i]) return;
  delete pad.connected[i];
  if (pad.idx === i) {
    pad.idx = -1;
    pad.active = false;
    input.padThr = input.padBrk = input.padSteer = 0;
    if (pad.hb) {
      input.hand = false;
      pad.hb = false;
    }
    input.horn = false;
  }
  if (typeof toast === "function") toast("\u{1F3AE} Controller disconnected");
  BigRig.emit("padDisconnected", { index: i });
}
const dz = (v, d) => (Math.abs(v) < d ? 0 : (Math.sign(v) * (Math.abs(v) - d)) / (1 - d));
function padUpdate(dt) {
  const list = padList();
  for (const g of list) if (g && g.connected !== false) padSeen(g);
  for (const k in pad.connected) {
    if (!list[k]) padGone(+k);
  }
  if (pad.idx < 0) {
    const g = list.find((g) => g);
    if (g) {
      pad.idx = g.index;
      pad.id = g.id;
    } else return;
  }
  const g = list[pad.idx];
  if (!g) return;
  const B = (i) => {
      const b = g.buttons[i];
      return b ? (typeof b === "object" ? b.value > 0.5 || b.pressed : b > 0.5) : false;
    },
    V = (i) => {
      const b = g.buttons[i];
      return b ? (typeof b === "object" ? b.value : b) : 0;
    };
  const now = g.buttons.map((_, i) => B(i)),
    prev = pad.prev,
    hit = (i) => now[i] && !prev[i];
  pad.prev = now;
  const lx = dz(g.axes[0] || 0, 0.15),
    ly = dz(g.axes[1] || 0, 0.15),
    rt = dz(V(7), 0.04),
    lt = dz(V(6), 0.04);
  if (now.some((x) => x) || Math.abs(lx) + Math.abs(ly) > 0.2 || rt > 0.05 || lt > 0.05) {
    if (!pad.active) {
      pad.active = true;
      padHud();
    }
    pad.lastUse = timeS;
  }
  // ---- menus (job board, dealership, results, tier unlock)
  if (
    career.uiOpen ||
    (typeof BREAKDOWN !== "undefined" && BREAKDOWN.active && document.getElementById("bdPanel"))
  ) {
    input.padThr = input.padBrk = input.padSteer = 0;
    if (pad.hb) {
      input.hand = false;
      pad.hb = false;
    }
    if (career.uiOpen === "tune" && typeof czPad === "function" && czPad(g, hit, now, dt)) return;
    pad.navT -= dt;
    let dir = null;
    if (hit(12)) dir = "u";
    else if (hit(13)) dir = "d";
    else if (hit(14)) dir = "l";
    else if (hit(15)) dir = "r";
    else if (pad.navT <= 0 && (Math.abs(lx) > 0.6 || Math.abs(ly) > 0.6)) {
      dir = Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? "r" : "l") : ly > 0 ? "d" : "u";
      pad.navT = 0.22;
    }
    if (dir) padNav(dir);
    if (hit(0)) {
      const el = padFocusEl();
      if (el) {
        el.click();
        setTimeout(() => padNav(null), 40);
      }
    }
    if (hit(1) && career.uiOpen) {
      if (career.uiOpen === "result") {
        const k = document.querySelector("#ui #keep");
        if (k) k.click();
      } else closeUI();
    }
    if (hit(9) && (career.uiOpen === "board" || career.uiOpen === "armyboard")) closeUI();
    if (hit(3) && career.uiOpen === "board") {
      boardState.sort = boardState.sort === "near" ? "pay" : "near";
      renderBoard();
    }
    if (hit(4) || hit(5)) {
      const g2 = document.querySelector("#ui .grid");
      if (g2) g2.scrollBy({ top: hit(5) ? 160 : -160, behavior: "smooth" });
    }
    return;
  }
  pad.focus = null;
  // ---- world map
  if (bigmap.open) {
    input.padThr = input.padBrk = input.padSteer = 0;
    if (Math.abs(lx) + Math.abs(ly) > 0) {
      bigmap.cx += (lx * dt * 420) / bigmap.z;
      bigmap.cy += (ly * dt * 420) / bigmap.z;
      if (typeof mapClamp === "function") mapClamp();
    }
    const zin = rt + (now[5] ? 0.8 : 0),
      zout = lt + (now[4] ? 0.8 : 0);
    if (zin > 0.05) mapZoomTo(bigmap.zt * Math.pow(2.4, zin * dt));
    if (zout > 0.05) mapZoomTo(bigmap.zt / Math.pow(2.4, zout * dt));
    if (NAV.sel && hit(0)) {
      const sel = NAV.sel;
      NAV.sel = null;
      fastTravel(sel.o, sel);
      return;
    }
    if (NAV.sel && hit(2)) {
      const sel = NAV.sel;
      NAV.sel = null;
      const r = setRoute(sel.o);
      if (r) flash("Sat nav to " + sel.name + ": " + fmtD(r.len));
      return;
    }
    if (hit(0)) {
      const cx = VW / 2,
        cy = VH / 2 + 10;
      const poi = navPOIAt(cx, cy, mBX, mBY);
      if (poi) {
        NAV.sel = poi;
        return;
      } else routeToMapPoint(cx, cy);
    }
    if (hit(3) && typeof mapCentreTruck === "function") mapCentreTruck();
    if (hit(1) || hit(8)) closeMap();
    if (hit(9)) {
      closeMap();
      openBoard();
    }
    return;
  }
  // ---- driving
  const k = 1 - Math.exp(-dt * 10);
  pad.steer += (lx * Math.abs(lx) * 0.35 + lx * 0.65 - pad.steer) * k; // mild expo + smoothing
  input.padSteer = Math.abs(pad.steer) < 0.01 ? 0 : Math.max(-1, Math.min(1, pad.steer));
  input.padThr = rt;
  input.padBrk = lt;
  if (now[1]) {
    input.hand = true;
    pad.hb = true;
  } else if (pad.hb) {
    input.hand = false;
    pad.hb = false;
  }
  if (now[4]) {
    input.horn = true;
    pad.horn = true;
  } else if (pad.horn) {
    input.horn = false;
    pad.horn = false;
  }
  if (!started) {
    if (hit(0) && !isTyping(document.activeElement)) startGame();
    return;
  } // lobby: no game actions, A = play solo
  if (!started) return;
  if (hit(12) && MP.on) mpToggleList();
  if (hit(0)) {
    const cc = !truck.trl && typeof coupleCandidate === "function" ? coupleCandidate() : null; // v31: a lined-up trailer always wins; repair/tune prompts never uncouple
    if (cc && cc.ok) toggleCouple();
    else if (document.getElementById("rpGo") && typeof rpDo === "function") rpDo();
    else if (document.getElementById("czGo") && typeof czEnter === "function") czEnter();
    else if (document.getElementById("dlGo") && typeof dlEnter === "function") dlEnter();
    else if (document.getElementById("eaGo") && typeof eaEnter === "function") eaEnter();
    else toggleCouple();
  }
  if (hit(2)) toggleRefuel();
  if (hit(3)) tryUnload();
  if (hit(13) && typeof hbToggle === "function") hbToggle();
  if (hit(14)) indToggle(1);
  if (hit(15)) indToggle(2);
  if ((hit(4) && now[5]) || (hit(5) && now[4])) {
    hazToggle();
    input.horn = false;
  }
  if (hit(8)) openMap();
  if (hit(9)) openBoard();
  if (hit(5)) pad.rbT = timeS;
  if (now[5] && !now[4] && pad.rbT != null && timeS - pad.rbT > 0.8) {
    pad.rbT = null;
    if (NAV.route) userCancelRoute();
  }
  if (!now[5] && prev[5] && pad.rbT != null && !now[4] && !prev[4] && timeS - pad.rbT <= 0.8) {
    if (typeof hbToggle === "function") hbToggle();
  }
  if (!now[5]) pad.rbT = null; // v31: RB tap = full beam (same as BEAM), hold = cancel route
}
// ---- spatial focus navigation for the DOM panels
function padFocusables() {
  const root =
    document.querySelector("#bdPanel") || document.querySelector("#ui .mback, #ui .celebrate");
  if (!root) return [];
  return Array.from(
    root.querySelectorAll(".card:not(.lock), .chip, .btn:not([disabled]), .x, .ti, .sw, .bdOpt"),
  ).filter((e) => e.offsetParent !== null);
}
function padFocusEl() {
  const f = padFocusables();
  if (pad.focus && f.includes(pad.focus)) return pad.focus;
  return null;
}
function padNav(dir) {
  const els = padFocusables();
  if (!els.length) return;
  let cur = padFocusEl();
  if (!cur) {
    cur =
      els.find((e) => e.id === "accept" || e.id === "buy" || e.id === "use" || e.id === "leave") &&
      dir === null
        ? null
        : null;
    cur =
      els.find((e) => e.classList.contains("sel")) ||
      els.find((e) => e.classList.contains("card")) ||
      els.find((e) => e.classList.contains("btn")) ||
      els[0];
  } else if (dir) {
    const r = cur.getBoundingClientRect(),
      cx = r.left + r.width / 2,
      cy = r.top + r.height / 2;
    let best = null,
      bs = 1e9;
    for (const e of els) {
      if (e === cur) continue;
      const q = e.getBoundingClientRect(),
        ex = q.left + q.width / 2,
        ey = q.top + q.height / 2,
        dx = ex - cx,
        dy = ey - cy;
      const along = dir === "r" ? dx : dir === "l" ? -dx : dir === "d" ? dy : -dy,
        side = dir === "r" || dir === "l" ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const sc = along + side * 2.2;
      if (sc < bs) {
        bs = sc;
        best = e;
      }
    }
    if (best) cur = best;
  }
  for (const e of document.querySelectorAll(".padfocus")) e.classList.remove("padfocus");
  pad.focus = cur;
  cur.classList.add("padfocus");
  if (dir && cur.classList.contains("ti")) cur.click();
  const gr = cur.closest(".grid,.tl,.czg,.cztabs");
  if (gr) {
    const q = cur.getBoundingClientRect(),
      r2 = gr.getBoundingClientRect();
    if (q.top < r2.top) gr.scrollTop -= r2.top - q.top + 8;
    else if (q.bottom > r2.bottom) gr.scrollTop += q.bottom - r2.bottom + 8;
  }
}
// ---- glyphs: when the pad is the active device, key hints in canvas prompts become controller buttons
function padGlyphs(t) {
  if (!pad.active || typeof t !== "string") return t;
  return t
    .replace(/Press F to/g, "Press " + GLYPH.X + " to")
    .replace(/\(F to stop\)/g, "(" + GLYPH.X + " to stop)")
    .replace(/Press T to/g, "Press " + GLYPH.A + " to")
    .replace(/\bT: (couple|uncouple)/g, GLYPH.A + ": $1")
    .replace(/press U to/g, "press " + GLYPH.Y + " to")
    .replace(/UNLOAD \(U\)/g, "UNLOAD " + GLYPH.Y)
    .replace(/\(P\) HANDBRAKE/g, "(" + GLYPH.B + ") HANDBRAKE")
    .replace(/\(T\)/g, "(" + GLYPH.A + ")")
    .replace(/MAP \(M\)/g, "MAP (" + GLYPH.VIEW + ")");
}
function padInstall() {
  const of = ctx.fillText.bind(ctx),
    om = ctx.measureText.bind(ctx);
  ctx.fillText = (t, x, y, m) =>
    m === undefined ? of(padGlyphs(t), x, y) : of(padGlyphs(t), x, y, m);
  ctx.measureText = (t) => om(padGlyphs(t));
}
function padHud() {
  const b = document.querySelector("#bJobs kbd");
  if (b) b.textContent = pad.active ? GLYPH.MENU : "J";
  document.body.classList.toggle("padmode", pad.active);
}
addEventListener("keydown", () => {
  if (pad.active && timeS - pad.lastUse > 0.5) {
    pad.active = false;
    padHud();
  }
});
function drawPadMapCursor() {
  if (!pad.active || !bigmap.open) return;
  const x = VW / 2,
    y = VH / 2 + 10;
  ctx.save();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 7);
  ctx.moveTo(x - 18, y);
  ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 18, y);
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x, y + 18);
  ctx.stroke();
  const poi = navPOIAt(x, y, mBX, mBY);
  ctx.fillStyle = "rgba(8,12,20,0.85)";
  const t =
    GLYPH.A +
    " " +
    (poi ? "Route to " + poi.name : "Route to this point") +
    "   LS pan \u2022 RT/LT zoom \u2022 " +
    GLYPH.Y +
    " centre \u2022 " +
    GLYPH.B +
    " close";
  ctx.font = "bold 12px system-ui,sans-serif";
  const w = ctx.measureText(t).width + 20;
  ctx.fillRect(x - w / 2, VH - 56, w, 24);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(t, x, VH - 39);
  ctx.restore();
}

// keyboard for every modal: arrows move focus, Enter/Space selects (job board, results, tier unlock, dealership, breakdown)
addEventListener(
  "keydown",
  (e) => {
    const bd =
      typeof BREAKDOWN !== "undefined" && BREAKDOWN.active && document.getElementById("bdPanel");
    if (!career.uiOpen && !bd) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.code === "KeyN" && career.uiOpen === "board") {
      boardState.sort = boardState.sort === "near" ? "pay" : "near";
      renderBoard();
      e.preventDefault();
      return;
    }
    const dir = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r" }[e.code];
    if (dir) {
      padNav(padFocusEl() ? dir : null);
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter") {
      let el = padFocusEl();
      if (!el) {
        padNav(null);
        el = padFocusEl();
      }
      if (el) {
        el.click();
        setTimeout(() => padNav(null), 40);
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  },
  true,
);

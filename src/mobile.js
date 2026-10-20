/**
 * @file mobile.js — MOBILE: landscape thumb layout (controls in side gutters, never over the HUD) + portrait handheld deck
 * Exposes (globals): MOB, MOBCSS, mobBtn, act, mobCSS, mobInit, mobSteer, place, mobLayout,
 *   mobView, mobFit, mobContext, MOB_DPID, mobDpadDir, mobDpadSet, mobDpad
 * Depends on: world.js, physics.js, audio.js, depots.js, fuel.js, sites.js, career.js, ui.js,
 *   gamepad.js, mp.js, haptics.js, indicators.js, beams.js, main.js
 * Load order: #21 of 55 in build.py; all files share one global scope (see AGENTS.md, SYMBOLS.md).
 */
"use strict";
// ===================== v11 MOBILE: landscape thumb layout (controls in side gutters, never over the HUD) + portrait handheld deck =====================
const MOB = { on: false, mode: "", steerId: null, ctx: {}, lastCtx: 0 };
const MOBCSS = `
body.touch{overflow:hidden;position:fixed;inset:0;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none}
body.touch #titlebar,body.touch #help,body.touch #credits,body.touch #touch,body.touch #fs{display:none!important}
body.touch #wrap{margin:0;width:auto} body.touch #scaler{transform:none!important;width:auto} body.touch #stage{width:auto;height:auto!important}
body.touch #frame{position:fixed;padding:0;border:none;background:#000;box-shadow:none;border-radius:6px;width:auto;z-index:1}
body.touch canvas{border-radius:6px}
body.touch #overlay,body.touch #ui{position:fixed;inset:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);border-radius:0;z-index:20}
body.touch #ui{pointer-events:none} body.touch #hudbtns{display:none}
body.touch #overlay{overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;justify-content:safe center;align-items:center;padding:16px 14px;box-sizing:border-box}
body.touch #overlay p:not(#loading){display:none} body.touch #overlay #logo{max-width:78vw!important;max-height:26vh!important} body.touch #overlay .go{max-width:92vw;font-size:18px;box-sizing:border-box}
body.touch #overlay button,body.touch #overlay input{max-width:100%;box-sizing:border-box} body.touch #lobby,body.touch #wbCard{width:min(92vw,420px)!important;box-sizing:border-box} body.touch #lobby{align-items:stretch} body.touch #lobby .row{flex-direction:column;align-items:stretch;align-self:stretch;gap:8px} body.touch:has(#overlay:not(.hidden)) #mob,body.touch:has(#overlay:not(.hidden)) #deck{display:none!important} body.touch #lobby .row>*{width:100%!important;margin:0!important}
body.touch #overlay h1{font-size:40px;margin-top:4px} body.touch #overlay h2{font-size:15px;letter-spacing:5px;margin:4px 0 12px} body.touch #overlay p{font-size:12px;margin-top:10px}
body.touch #lobby .row{flex-wrap:wrap;justify-content:center} body.touch #lobby input{font-size:16px}
#mob{display:none;position:fixed;inset:0;z-index:5;pointer-events:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
body.touch #mob{display:block}
#mob .b{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;font-weight:900;border-radius:16px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.32);box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .06s,background .06s,opacity .2s}
#mob .b small{font-size:11px;font-weight:800;letter-spacing:.5px;opacity:.95;margin-top:2px;white-space:nowrap;line-height:1.1;max-width:94%;overflow:hidden;text-align:center;display:block}
#mob .b{line-height:1;text-align:center}
body.touch #mob .gas,body.touch #mob .brk{border:none;border-radius:14px;box-shadow:0 4px 0 #1d2029,inset 0 1px 0 rgba(255,255,255,.2)} body.touch #mob .gas{background:linear-gradient(180deg,#3fbf74,#1f8a4d)} body.touch #mob .brk{background:linear-gradient(180deg,#d9446b,#9b1f45)}
body.touch #mob .steer{background:#2a2d33;border:none;box-shadow:inset 0 3px 6px rgba(0,0,0,.6),0 2px 0 rgba(255,255,255,.4)} body.touch #mob .knob{background:radial-gradient(circle at 35% 30%,#d9446b,#9b1f45);border:none;box-shadow:0 4px 0 #5c1028}
.dside{display:none;position:fixed;top:0;bottom:0;pointer-events:none;background:linear-gradient(180deg,#c9cdd6,#aeb3be 60%,#9aa0ac);box-shadow:inset 0 3px 0 rgba(255,255,255,.6),0 0 18px rgba(0,0,0,.45)} body.touch:not(.portrait) .dside{display:block} body.touch.ovl .dside,body.touch.mapo .dside,body.touch:has(#overlay:not(.hidden)) .dside{display:none!important}
#deckL{left:0;border-radius:0 26px 26px 0} #deckR{right:0;border-radius:26px 0 0 26px} .dside .brand{position:absolute;left:0;right:0;text-align:center;font:italic 900 13px system-ui;letter-spacing:2px;color:#3b3f86;white-space:nowrap} .dside .brand b{color:#b0282c}
#mob .b.on{transform:scale(.94);background:rgba(245,184,46,.55);border-color:#f5b82e}
#mob .b.hide{opacity:0;pointer-events:none} #mob .b.dim{opacity:.35}
#mob .gas{background:linear-gradient(180deg,rgba(61,220,132,.35),rgba(31,157,85,.3));border-color:rgba(61,220,132,.7);border-radius:18px}
#mob .brk{background:linear-gradient(180deg,rgba(255,107,91,.35),rgba(192,57,43,.3));border-color:rgba(255,120,100,.7);border-radius:18px}
#mob .pedal-ribs{width:60%;height:50%;background:repeating-linear-gradient(0deg,rgba(255,255,255,.35) 0 4px,transparent 4px 11px);border-radius:6px}
#mob .steer{border-radius:60px;background:rgba(255,255,255,.08)}
#mob .knob{position:absolute;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,#ffffff33 60%);border:3px solid rgba(255,255,255,.6);left:50%;pointer-events:none;display:flex;align-items:center;justify-content:center;font-size:20px}
#mob .ctx{background:rgba(245,184,46,.3);border-color:#f5b82e}
/* portrait handheld */
#deck{display:none;position:fixed;left:0;right:0;bottom:0;pointer-events:none;background:linear-gradient(180deg,#c9cdd6,#aeb3be 60%,#9aa0ac);border-radius:28px 28px 0 0;box-shadow:inset 0 3px 0 rgba(255,255,255,.6),inset 0 -2px 0 rgba(0,0,0,.2),0 -6px 24px rgba(0,0,0,.45)}
body.touch.portrait #deck{display:block}
#deck .brand{position:absolute;left:50%;transform:translateX(-50%);top:10px;font:italic 900 15px system-ui;letter-spacing:2px;color:#3b3f86;white-space:nowrap} #deck .brand b{color:#b0282c}
#deck .grille{position:absolute;right:16px;bottom:calc(10px + env(safe-area-inset-bottom));width:44px;height:30px;background:repeating-linear-gradient(180deg,rgba(60,60,70,.55) 0 5px,transparent 5px 12px);border-radius:4px}
body.touch #mob .dp{background:#2a2d33;border:none;border-radius:6px;box-shadow:0 3px 0 #111,inset 0 1px 0 rgba(255,255,255,.15);color:#aab}
body.touch #mob .dpc{background:#2a2d33;border:none;border-radius:0;box-shadow:none}
body.touch #mob .ab{border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9446b,#9b1f45);border:none;box-shadow:0 4px 0 #5c1028,inset 0 1px 0 rgba(255,255,255,.35);font-size:22px}
body.touch #mob .ab small{position:absolute;bottom:-19px;left:50%;transform:translateX(-50%);color:#3b3f86;font-size:12px;opacity:1;max-width:none}
body.portrait #mob .pill{border-radius:20px;background:#6b7080;border:none;box-shadow:0 2px 0 #3a3e48;font-size:14px;letter-spacing:1px;transform:none;flex-direction:row;gap:6px}
body.portrait #mob .pill small{color:#fff;font-size:11px;margin:0;max-width:none}
body.touch #mob .fn{border-radius:12px;background:#3d4252;border:none;box-shadow:0 3px 0 #1d2029;font-size:17px}
body.touch #mob .fn.on,body.touch #mob .ab.on,body.touch #mob .dp.on{transform:translateY(2px);filter:brightness(1.3)}
body.touch #mob .fn.ctxon{background:#c98a10;box-shadow:0 3px 0 #6d4a06}
#mob .b.beamon{background:#1f5fd6!important;border-color:#6fa8ff!important;box-shadow:0 0 10px rgba(80,150,255,.7),0 3px 0 #0d3277!important;color:#fff!important}
#mob .hbi{display:inline-block;width:1.1em;height:.7em;background:linear-gradient(90deg,currentColor 0 38%,transparent 38% 48%,currentColor 48% 100%);-webkit-mask:repeating-linear-gradient(180deg,#000 0 18%,transparent 18% 27%);mask:repeating-linear-gradient(180deg,#000 0 18%,transparent 18% 27%);border-radius:50% 0 0 50%/50% 0 0 50%}
body.touch.portrait .modal,body.touch .modal{width:min(916px,96vw)!important;height:min(552px,94vh)!important}
@media (max-width:760px){ #ui .grid{grid-template-columns:minmax(0,1fr)!important} #ui .bar{flex-wrap:wrap} #ui .mh .sub{display:none} #ui .detail{flex-wrap:wrap} #ui .btn.start{width:100%} #ui .show{flex-direction:column;overflow:auto} #ui .tl{width:auto;flex-direction:row;overflow-x:auto;border-right:none} #ui .ti{flex:none} .result{width:94vw!important} }
body.touch.ovl #mob,body.touch.ovl #deck{display:none!important} body.touch.ovl #frame{z-index:40}
body.touch.ovl #ui{inset:0!important;z-index:41}
body.touch #ui .mback{pointer-events:auto} #mapX{display:none} body.touch.mapo #mapX{display:flex!important;position:fixed;z-index:70;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));align-items:center;gap:8px;padding:12px 22px;border-radius:999px;border:2px solid rgba(255,255,255,.7);background:rgba(15,20,30,.88);color:#fff;font:900 15px system-ui;letter-spacing:1px;touch-action:manipulation} body.touch.mapo #mob,body.touch.mapo #deck,body.touch.mapo #ui,body.touch.mapo #hudbtns{display:none!important} body.touch.mapo #frame{left:0!important;top:0!important;width:100vw!important;height:100dvh!important;z-index:60!important;border-radius:0} body.touch.mapo #game{width:100vw!important;height:100dvh!important;border-radius:0;touch-action:none} body.touch.ovl,body.touch.ovl #frame,body.touch.ovl #ui{touch-action:auto} body.touch.ovl #ui .mback{overscroll-behavior:contain} body.touch #ui .grid,body.touch #ui .show,body.touch #ui .tl,body.touch #ui .side{overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain} body.touch #ui .tl{touch-action:pan-x pan-y} body.touch #ui .chip{white-space:nowrap} @media (max-width:760px),(max-height:460px){ #ui .mh{position:relative;padding-right:66px!important;flex-wrap:wrap} #ui .mh h2{white-space:normal!important;font-size:clamp(15px,4.4vw,18px);line-height:1.15;overflow-wrap:anywhere} #ui .mh>div:nth-child(2){flex:1 1 0;min-width:0}
 #ui .mh .x{position:absolute!important;top:8px;right:10px;width:48px!important;height:48px!important;font-size:22px} #ui .mh .wallet{order:5}
 #ui .st{font-size:13px} #ui .st .b{height:10px} #ui .stats{gap:10px 16px}
 #ui .cols{gap:14px;flex-wrap:wrap;justify-content:center} #ui .sw{width:42px;height:42px}
 #ui .buyrow{flex-wrap:wrap} #ui .buyrow .bigbuy,#ui .buyrow .need{flex:1 1 100%;width:100%}
 .ydc .hd{flex-wrap:wrap} .ydc h2{font-size:clamp(17px,5vw,24px)!important;overflow-wrap:anywhere} }
@media (max-height:460px){ #ui .mh .sub{display:none} #ui .bar{flex-wrap:wrap;gap:6px} }
@media (max-width:560px) and (orientation:portrait){ body.touch #ui .modal{width:100vw!important;height:100%!important;max-height:100dvh;border-radius:0;border:none;padding-top:env(safe-area-inset-top)}
 #ui .mh{flex-wrap:wrap;gap:6px 10px;padding:10px 12px 8px;position:relative} #ui .mh>div:first-child{font-size:22px!important} #ui .mh h2{font-size:18px;letter-spacing:1px;white-space:nowrap} #ui .mh .sp{display:none}
 #ui .mh>div[style*="text-align:right"]{order:5;flex-basis:100%;text-align:left!important;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px} #ui .mh>div[style*="text-align:right"] br{display:none} #ui .mh .xpb{width:90px}
 #ui .mh .x{position:absolute;top:8px;right:10px;width:44px;height:44px;font-size:20px}
 #ui .bar{gap:6px;padding:6px 12px} #ui .bar>div[style*="flex:1"]{flex-basis:100%;height:0} #ui .bar .chip{padding:5px 9px;font-size:12px} #ui .bar .lbl{font-size:10px}
 #ui .body{overflow:hidden} #ui .grid{padding:4px 10px 10px!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}
 #ui .card .ill{width:64px;height:64px} #ui .card .cn{font-size:14px;padding-right:74px}
 #ui .detail{position:sticky;bottom:0;padding:8px 12px calc(8px + env(safe-area-inset-bottom));min-height:0;gap:8px;z-index:2;background:#151c29} #ui .detail .btn.start{min-height:48px;font-size:16px}
 #ui .foot{flex-wrap:wrap;gap:4px 10px;padding:6px 12px;font-size:11px} }
@media (max-width:760px){ #ui .mh{position:static!important;flex:none;flex-wrap:nowrap!important;padding:8px 10px!important;gap:8px} #ui .mh .x{position:static!important;flex:none} #ui .mh .nfull{display:none} #ui .mh .nshort{display:inline} #ui .mh .sub2{display:block;font-size:12px;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #ui .mh h2{white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis} #ui .mh .mht{flex:1 1 0;min-width:0} #ui .mh .wallet{order:0;flex:none}
 #ui .modal{display:flex;flex-direction:column} #ui .show{flex:1 1 auto;min-height:0;overflow-y:auto!important;flex-direction:column} #ui .tlw{flex:none!important} #ui .tl{flex:none!important;min-height:104px} #ui .ti{min-height:90px;min-width:200px;box-sizing:border-box} #ui .stage{flex:none} #ui .stage .floor{height:clamp(96px,22vh,250px)!important}
 #ui .tlw{position:relative} #ui .tlh{display:block} #ui .tl{flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important;-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent);scroll-snap-type:x proximity;touch-action:pan-x} #ui .ti{scroll-snap-align:start} }
@media (min-width:761px) and (max-height:460px){ #ui .tlw{width:210px} #ui .tl{width:auto;-webkit-mask-image:linear-gradient(180deg,#000 85%,transparent);mask-image:linear-gradient(180deg,#000 85%,transparent);touch-action:pan-y} #ui .tlh{display:block} #ui .stage{overflow-y:auto;min-height:0;justify-content:flex-start} #ui .stage .floor{flex:none} }
@media (max-height:460px){ #ui .mh{padding:8px 12px} #ui .bar{padding:6px 12px} #ui .stage .floor{height:150px} }
`;
function mobBtn(id, html, cls, k) {
  const b = document.createElement("div");
  b.className = "b " + (cls || "");
  b.id = id;
  b.innerHTML = html;
  document.getElementById("mob").appendChild(b);
  const on = (e) => {
      if (e.pointerType !== "mouse" && typeof hapPress === "function") hapPress(id); // buzz first
      e.preventDefault();
      b.classList.add("on");
      if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
      if (typeof k === "string") {
        if (career.uiOpen && MOB.nav[k]) {
          MOB.nav[k]();
          return;
        }
        input[k] = true;
      } else if (k) k();
    },
    off = (e) => {
      e.preventDefault();
      b.classList.remove("on");
      if (typeof k === "string") input[k] = false;
    };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointercancel", off);
  b.addEventListener("pointerleave", off);
  return b;
}
MOB.nav = {
  left: () => padNav("l"),
  right: () => padNav("r"),
  up: () => padNav("u"),
  down: () => padNav("d"),
  okA: () => {
    const el = padFocusEl();
    if (el) {
      el.click();
      setTimeout(() => padNav(null), 40);
    } else padNav(null);
  },
  back: () => {
    if (career.uiOpen === "result") {
      const k = document.querySelector("#ui #keep");
      if (k) k.click();
    } else closeUI();
  },
};
const act = (f) => () => {
  if (!started) return;
  f();
};
// v55 (James 20 Oct): one invisible touch zone over the whole D-pad (plus a forgiving margin) owns every D-pad touch.
// Left half = left, right half = right (only the narrow up/down arm column above/below the centre is up/down), so a
// thumb never misses; it reacts on pointerdown (fires on touchstart) and follows pointermove, so the thumb can slide
// between left and right without lifting. The visible pads only show the pressed state.
const MOB_DPID = { l: "mLeft", r: "mRight", u: "mUp", d: "mDown" };
function mobDpadDir(x, y) {
  const P = MOB.dp;
  if (!P) return null;
  const dx = x - P.cx,
    dy = y - P.cy;
  if (Math.abs(dx) < P.k / 2 + P.dg / 2 && Math.abs(dy) > P.k / 2) return dy < 0 ? "u" : "d";
  return dx < 0 ? "l" : "r";
}
function mobDpadSet(pid, d) {
  const T = MOB.dpT,
    was = T[pid] || null;
  if (was === d) return;
  if (d) T[pid] = d;
  else delete T[pid];
  const held = new Set(Object.values(T));
  for (const k in MOB_DPID)
    document.getElementById(MOB_DPID[k]).classList.toggle("on", held.has(k));
  input.left = held.has("l") && !career.uiOpen;
  input.right = held.has("r") && !career.uiOpen;
  if (!d) return;
  if (typeof hapPress === "function") hapPress(MOB_DPID[d]);
  if (career.uiOpen) MOB.nav[{ l: "left", r: "right", u: "up", d: "down" }[d]]();
  else if (d === "u" && MP.on) mpToggleList();
}
function mobDpad() {
  const z = document.createElement("div");
  z.id = "mDZone";
  z.style.cssText =
    "position:absolute;pointer-events:auto;touch-action:none;z-index:2;display:none";
  document.getElementById("mob").appendChild(z);
  MOB.dpT = {};
  const at = (e) => mobDpadDir(e.clientX, e.clientY);
  z.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
    if (z.setPointerCapture) z.setPointerCapture(e.pointerId);
    mobDpadSet(e.pointerId, at(e));
  });
  z.addEventListener("pointermove", (e) => {
    if (!(e.pointerId in MOB.dpT)) return;
    e.preventDefault();
    mobDpadSet(e.pointerId, at(e));
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    z.addEventListener(ev, (e) => mobDpadSet(e.pointerId, null));
}
function mobCSS() {
  if (MOB.css) return;
  MOB.css = 1;
  const st = document.createElement("style");
  st.textContent = MOBCSS;
  document.head.appendChild(st);
}
if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
  document.body.classList.add("touch");
  mobCSS();
}
function mobInit() {
  if (!document.body.classList.contains("touch")) return;
  MOB.on = true;
  mobCSS();
  const vp = document.querySelector("meta[name=viewport]");
  if (vp)
    vp.content =
      "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover";
  const m = document.createElement("div");
  m.id = "mob";
  document.body.appendChild(m);
  const dk = document.createElement("div");
  dk.id = "deck";
  dk.innerHTML = '<div class="grille"></div>';
  document.body.insertBefore(dk, m);
  for (const [id, h] of [
    ["deckL", ""],
    ["deckR", ""],
  ]) {
    const d = document.createElement("div");
    d.id = id;
    d.className = "dside";
    d.innerHTML = '<div class="brand">' + h + "</div>";
    document.body.insertBefore(d, m);
  }
  // driving
  mobBtn("mGas", '<div class="pedal-ribs"></div><small>GAS</small>', "gas", "up");
  mobBtn("mBrk", '<div class="pedal-ribs"></div><small>BRAKE</small>', "brk", "down");
  const s = mobBtn("mSteer", '<div class="knob">\u25C0\u25B6</div>', "steer", null);
  mobSteer(s);
  mobBtn("mLeft", "\u25C0", "dp", "left");
  mobBtn("mRight", "\u25B6", "dp", "right");
  mobBtn("mUp", "\u25B2", "dp", () => {
    if (career.uiOpen) MOB.nav.up();
    else if (MP.on) mpToggleList();
  });
  mobBtn("mDown", "\u25BC", "dp", () => {
    if (career.uiOpen) MOB.nav.down();
  });
  mobBtn("mCen", "", "dp dpc", null);
  mobDpad();
  mobBtn("mA", "A<small>GAS</small>", "ab", () => {
    if (career.uiOpen) MOB.nav.okA();
    else {
      if (!started) return;
      input.up = true;
    }
  });
  mobBtn("mB", "B<small>BRAKE</small>", "ab", () => {
    if (career.uiOpen) MOB.nav.back();
    else input.down = true;
  });
  for (const id of ["mA", "mB"]) {
    const el = document.getElementById(id);
    const off = () => {
      input[id === "mA" ? "up" : "down"] = false;
    };
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("pointerleave", off);
  }
  mobBtn(
    "mIndL",
    "\u2B05<small>IND</small>",
    "fn",
    act(() => indToggle(1)),
  );
  mobBtn(
    "mIndR",
    "\u27A1<small>IND</small>",
    "fn",
    act(() => indToggle(2)),
  );
  mobBtn(
    "mHaz",
    "\u26A0<small>HAZ</small>",
    "fn",
    act(() => hazToggle()),
  );
  mobBtn(
    "mBeam",
    '<i class="hbi"></i><small>BEAM</small>',
    "fn",
    act(() => hbToggle()),
  );
  mobBtn("mHand", "P<small>H/BRAKE</small>", "fn", "hand");
  mobBtn("mHorn", "\u{1F4E3}<small>HORN</small>", "fn", "horn");
  mobBtn(
    "mCouple",
    "\u{1F517}<small>COUPLE</small>",
    "fn ctx",
    act(() => toggleCouple()),
  );
  mobBtn(
    "mFuel",
    "\u26FD<small>REFUEL</small>",
    "fn ctx",
    act(() => toggleRefuel()),
  );
  mobBtn(
    "mUnload",
    "\u{1F4E6}<small>UNLOAD</small>",
    "fn ctx",
    act(() => tryUnload()),
  );
  mobBtn(
    "mJobs",
    "\u{1F4CB}<small>JOBS</small>",
    "fn pill",
    act(() => {
      if (career.uiOpen) closeUI();
      else openBoard();
    }),
  );
  mobBtn(
    "mMap",
    "\u{1F5FA}<small>MAP</small>",
    "fn pill",
    act(() => {
      // v44: one toggle per tap (a duplicate pointerdown on some Android builds re-closed the map at once)
      const now = performance.now();
      if (now - (MOB.mapT || 0) < 450) return;
      MOB.mapT = now;
      bigmap.open ? closeMap() : openMap();
    }),
  );
  document.getElementById("frame").addEventListener(
    "touchmove",
    (e) => {
      if (e.target.closest && e.target.closest("#overlay,#ui .mback,#ui .celebrate,#bdPanel"))
        return;
      e.preventDefault();
    },
    { passive: false },
  );
  addEventListener("resize", mobLayout);
  addEventListener("orientationchange", () => setTimeout(mobLayout, 200));
  if (window.visualViewport) visualViewport.addEventListener("resize", mobLayout);
  document.addEventListener("fullscreenchange", () => setTimeout(mobLayout, 50));
  mobLayout();
  setInterval(mobContext, 250);
}
function mobSteer(el) {
  const knob = el.querySelector(".knob");
  const upd = (e) => {
    const r = el.getBoundingClientRect();
    const u = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 - 30)));
    input.padSteer = Math.abs(u) < 0.06 ? 0 : u;
    knob.style.left = 50 + u * (50 - (30 / r.width) * 100) + "%";
  };
  el.addEventListener("pointerdown", (e) => {
    if (career.uiOpen) return;
    MOB.steerId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    upd(e);
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId === MOB.steerId) upd(e);
  });
  const end = (e) => {
    if (e.pointerId !== MOB.steerId) return;
    MOB.steerId = null;
    input.padSteer = 0;
    knob.style.left = "50%";
    el.classList.remove("on");
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
function place(id, x, y, w, h, show = true) {
  const b = document.getElementById(id);
  if (!b) return;
  b.style.left = x + "px";
  b.style.top = y + "px";
  b.style.width = w + "px";
  b.style.height = h + "px";
  b.style.display = show ? "flex" : "none";
}
function mobLayout() {
  if (!MOB.on) return;
  const W = innerWidth,
    H = innerHeight,
    por = H > W;
  document.body.classList.toggle("portrait", por);
  MOB.mode = por ? "portrait" : "landscape";
  const cv = document.getElementById("game"),
    fr = document.getElementById("frame");
  const sa = (n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
  let cw, ch, cx, cy;
  if (!por) {
    // landscape: canvas centred, controls live in the side gutters
    const G = Math.max(150, Math.min(230, W * 0.19));
    cw = W - 2 * G;
    ch = H - 8;
    cx = G;
    cy = 4; // fill the whole box between the panels; backing store follows its aspect (mobView) so nothing stretches
    const g = (W - cw) / 2,
      pad = 8,
      iw = g - 2 * pad,
      sat = sa("--sat");
    for (const id of ["deckL", "deckR"]) {
      const d = document.getElementById(id);
      if (d) {
        d.style.width = g - 2 + "px";
        d.querySelector(".brand").style.top = 6 + sat + "px";
      }
    }
    const top = 26 + sat,
      stH = Math.min(120, H * 0.3),
      sb = Math.max(40, Math.min(58, (iw - pad) / 2, (H - top - stH - 5 * pad) / 2.6)),
      sw = (iw - pad) / 2,
      iy = top + 2 * (sb + pad);
    place("mHand", pad, top, sw, sb);
    place("mHorn", pad + sw + pad, top, sw, sb);
    place("mJobs", pad, top + sb + pad, sw, sb);
    place("mMap", pad + sw + pad, top + sb + pad, sw, sb);
    const tw = (iw - 2 * 6) / 3;
    ["mIndL", "mHaz", "mIndR"].forEach((id, k) => place(id, pad + k * (tw + 6), iy, tw, sb * 0.6));
    {
      const by = iy + sb * 0.6 + pad,
        bh = sb * 0.6,
        stTop = H - stH - pad;
      if (by + bh <= stTop - 4) place("mBeam", pad, by, iw, bh);
      else {
        const t4 = (iw - 3 * 6) / 4;
        ["mIndL", "mHaz", "mBeam", "mIndR"].forEach((id, k) =>
          place(id, pad + k * (t4 + 6), iy, t4, sb * 0.6),
        );
      }
    }
    place("mSteer", pad, H - stH - pad, iw, stH);
    const R = W - g + pad;
    place("mCouple", R, top, sw, sb);
    place("mFuel", R + sw + pad, top, sw, sb);
    place("mUnload", R, top + sb + pad, iw, sb);
    const py = top + 2 * (sb + pad),
      ph = Math.max(70, H - py - pad);
    place("mBrk", R, py + ph * 0.22, sw, ph * 0.78);
    place("mGas", R + sw + pad, py, sw, ph);
    for (const id of ["mLeft", "mRight", "mUp", "mDown", "mCen", "mDZone", "mA", "mB"])
      place(id, 0, 0, 0, 0, false);
  } else {
    // portrait: handheld — screen on top, deck below
    const top = sa("--sat");
    cw = Math.min(W - 12, H * 0.56);
    ch = cw;
    cx = (W - cw) / 2;
    cy = 6 + Math.max(0, top);
    const deckTop = cy + ch + 6;
    const dk = document.getElementById("deck");
    dk.style.top = deckTop + "px";
    const DH = H - deckTop,
      u = Math.min(W / 412, DH / 330);
    const S = (v) => v * u;
    const dcx = S(100),
      dcy = deckTop + S(98),
      k = S(40),
      kw = S(64); // v55: wide left/right pads
    const dg = S(5); // v44: visible gap between the D-pad arms
    place("mUp", dcx - k / 2, dcy - k * 1.5 - dg, k, k);
    place("mDown", dcx - k / 2, dcy + k / 2 + dg, k, k);
    place("mLeft", dcx - k / 2 - dg - kw, dcy - k / 2, kw, k);
    place("mRight", dcx + k / 2 + dg, dcy - k / 2, kw, k);
    place("mCen", dcx - k / 2, dcy - k / 2, k, k);
    {
      // touch zone: the D-pad box plus a forgiving margin, stopping short of B and the function row
      const m = S(14),
        x0 = Math.max(0, dcx - k / 2 - dg - kw - m),
        x1 = Math.min(W - S(150) - S(6), dcx + k / 2 + dg + kw + m),
        y0 = dcy - k * 1.5 - dg - S(8),
        y1 = Math.min(deckTop + S(178) - S(6), dcy + k * 1.5 + dg + S(8));
      place("mDZone", x0, y0, x1 - x0, y1 - y0);
      MOB.dp = { cx: dcx, cy: dcy, k, dg };
    }
    const ab = S(58);
    place("mB", W - S(150), dcy - ab * 0.2, ab, ab);
    place("mA", W - S(78), dcy - ab * 0.85, ab, ab);
    const fy = deckTop + S(178),
      fw = Math.min(S(60), (W - 24) / 5 - 14), // v44: narrower keys -> wider gaps
      gap = (W - 5 * fw) / 6;
    ["mCouple", "mFuel", "mUnload", "mHand", "mHorn"].forEach((id, i) =>
      place(id, gap + i * (fw + gap), fy, fw, fw * 0.78),
    );
    {
      const g4 = gap,
        w4 = (W - 5 * g4) / 4;
      ["mIndL", "mHaz", "mBeam", "mIndR"].forEach((id, i) =>
        place(id, g4 + i * (w4 + g4), fy + fw * 1.2, w4, fw * 0.5),
      );
    }
    const py = fy + fw * 1.98;
    const pw = S(84),
      ph2 = S(26);
    place("mMap", W / 2 - pw - S(8), py, pw, ph2);
    place("mJobs", W / 2 + S(8), py, pw, ph2);
    const gr = document.querySelector("#deck .grille");
    if (gr) {
      gr.style.top = py - deckTop + ph2 / 2 - S(9) + "px";
      gr.style.bottom = "auto";
      gr.style.height = S(18) + "px";
      gr.style.width = S(40) + "px";
    }
    for (const id of ["mSteer", "mGas", "mBrk"]) place(id, 0, 0, 0, 0, false);
  }
  if (!document.body.classList.contains("mapo")) mobView(cw, ch, por);
  cv.style.width = cw + "px";
  cv.style.height = ch + "px";
  fr.style.left = cx + "px";
  fr.style.top = cy + "px";
  fr.style.width = cw + "px";
  fr.style.height = ch + "px";
  MOB.fitOk = 0;
  mobFit();
  // overlays (#ui / lobby) cover the whole screen in portrait, the canvas area in landscape is too small for modals so they also go full-screen
}
// keep the canvas backing store at exactly the CSS box aspect (1:1 world pixels). Landscape keeps ~600 logical px tall and shows more world sideways; portrait stays square 640.
function mobView(cw, ch, por) {
  const c = document.getElementById("game");
  let w, h;
  if (por) {
    w = h = 640;
  } else {
    h = 600;
    w = Math.round((h * cw) / ch);
  }
  if (VW !== w || VH !== h || c.width !== w || c.height !== h) {
    VW = w;
    VH = h;
    c.width = w;
    c.height = h;
  }
}
function mobFit() {
  for (const sm of document.querySelectorAll("#mob .b small")) {
    if (sm.closest(".ab") || sm.closest(".pill")) continue;
    sm.style.fontSize = "";
    let f = parseFloat(getComputedStyle(sm).fontSize);
    while (f > 9 && sm.scrollWidth > sm.clientWidth + 1) {
      f -= 0.5;
      sm.style.fontSize = f + "px";
    }
  }
}
function mobContext() {
  if (!MOB.on) return;
  if (
    document.querySelector("#mob .b") &&
    document.getElementById("mHand").clientWidth &&
    !MOB.fitOk
  ) {
    mobFit();
    MOB.fitOk = 1;
  }
  const a = career.active;
  const s = truck;
  const fuel = !!(started && fuelStationAt && fuelStationAt()) || refuel.active;
  let cpl = false;
  if (started) {
    if (s.trl) cpl = Math.abs(s.v) < 1;
    else {
      const c = coupleCandidate();
      cpl = !!(c && c.d < 8);
    }
  }
  let unl = false;
  if (a && (a.phase === "deliver" || a.phase === "unloading")) {
    const al = bayAlign(a.bay);
    unl = !!(al && al.dist < 30);
  }
  const por = MOB.mode === "portrait";
  const set = (id, on) => {
    const b = document.getElementById(id);
    if (!b) return;
    if (true) {
      b.classList.remove("hide");
      b.classList.toggle("ctxon", on);
      b.classList.toggle("dim", !on);
    } else {
      b.classList.toggle("hide", !on);
    }
  };
  {
    const bm = document.getElementById("mBeam");
    if (bm) bm.classList.toggle("beamon", !!(typeof HB !== "undefined" && HB.on));
  }
  set("mCouple", cpl);
  set("mFuel", fuel);
  set("mUnload", unl);
  const c = document.getElementById("mChat");
  if (c) c.style.display = MP.on ? "flex" : "none";
  const cb = document.getElementById("mCouple");
  if (cb) {
    const sm = cb.querySelector("small"),
      t = s.trl ? "UNCOUPLE" : "COUPLE";
    if (sm.textContent !== t) {
      sm.textContent = t;
      mobFit();
    }
  }
}

(function ovlWatch() {
  const f = () => {
    const ov = document.getElementById("overlay");
    const on =
      !!(typeof career !== "undefined" && career.uiOpen) ||
      !!document.getElementById("bdPanel") ||
      !!document.querySelector("#ui .celebrate") ||
      !!(ov && !ov.classList.contains("hidden") && ov.offsetParent !== null);
    document.body.classList.toggle("ovl", on);
  };
  setInterval(f, 150);
})();
// v33: a real DOM close button for the phone full-screen map (the deck + MAP pill are hidden while it's open)
addEventListener("load", () => {
  const b = document.createElement("button");
  b.id = "mapX";
  b.style.display = "none";
  b.innerHTML = "\u2715 CLOSE MAP";
  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // v44: the MAP pill opens the map on pointerdown; Android then fires the tap's click on whatever sits under the finger,
    // which can be this button (it appears where the deck was) -> the map closed instantly. Ignore taps in the first 600 ms.
    if (typeof bigmap !== "undefined" && performance.now() - (bigmap.openedAt || 0) < 600) return;
    if (typeof closeMap === "function") closeMap();
  };
  b.addEventListener("pointerdown", go);
  b.addEventListener("click", go);
  document.body.appendChild(b);
});

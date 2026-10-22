/**
 * @file pause.js — v69 PAUSE MENU (Esc / Xbox Start / phone MENU): job-board styled tabs
 * Jobs | Map | Truck | Properties | Stats | Players | Controls | Settings. LB/RB or Q/E switch tabs, D-pad/arrows move,
 * A/Enter press, B/Esc close. Single player: the sim pauses (uiBlocking). Online: own rig freezes and is sent with pose flag
 * 128 (others draw it see-through with a pause tag, no player-player push). Settings: game volume, graphics High/Low (GFX),
 * minimap on/off (SETTINGS.mm); saved with the game.
 */
const PM_TABS = [
  ["jobs", "\u{1F4CB}", "Jobs"],
  ["map", "\u{1F5FA}", "Map"],
  ["truck", "\u{1F69A}", "Truck"],
  ["props", "\u{1F3E1}", "Properties"],
  ["stats", "\u{1F4CA}", "Stats"],
  ["players", "\u{1F465}", "Players"],
  ["controls", "\u{1F3AE}", "Controls"],
  ["settings", "\u2699", "Settings"],
];
const PM = { on: false, tab: "jobs", sw: false };
const PM_CSS = `.pmtabs{flex-wrap:nowrap!important;overflow-x:auto;gap:6px!important;align-items:center;scrollbar-width:none}
.pmtabs::-webkit-scrollbar{display:none}
.pmtabs .chip{white-space:nowrap;font-size:12.5px;flex:none}
.pmtabs .kh{background:#0b0f16;border:1px solid rgba(255,255,255,.25);border-radius:6px;padding:3px 7px;font-size:11px;font-weight:900;color:#ffd866;flex:none}
.pmb{display:flex;flex-direction:column;gap:8px;padding:4px 2px;width:100%;box-sizing:border-box;overflow:auto}
.pmb .row{display:grid;grid-template-columns:200px 1fr auto;align-items:center;gap:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px}
.pmb .lab{font-weight:800;font-size:14px}.pmb .val{text-align:right;font-weight:900;color:#ffd866;min-width:48px}
.pmb .sl{position:relative;height:8px;border-radius:5px;background:rgba(255,255,255,.12)}
.pmb .sl i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:linear-gradient(90deg,#3ddc84,#f5b82e)}
.pmb .sl b{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.pmb .seg{display:flex;gap:6px}
.pmb .grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.pmb .st{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px}
.pmb .st small{display:block;opacity:.65;font-size:11px;letter-spacing:1px;font-weight:800}.pmb .st b{font-size:20px;color:#fff}
.pmb .note{opacity:.7;font-size:12.5px;padding:2px 4px}
.pmb table{border-collapse:collapse;width:100%;font-size:12.5px}.pmb td{padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.06)}.pmb td:first-child{color:#ffd866;font-weight:800;white-space:nowrap;width:40%}
.pmb .cols{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
#pmMapBar{position:absolute;left:50%;top:6px;transform:translateX(-50%);z-index:6;display:flex;gap:5px;align-items:center;background:rgba(10,14,22,.92);border:1px solid rgba(245,184,46,.45);border-radius:12px;padding:5px 8px;max-width:96%;overflow-x:auto}
#pmMapBar .chip{white-space:nowrap}
@media (max-height:480px){.pmb .row{padding:4px 10px;grid-template-columns:140px 1fr auto;border-radius:9px}.pmb .lab{font-size:12px}.pmb .chip{padding:3px 10px!important;min-height:0!important;font-size:11px!important}
.pmtabs .chip{font-size:10.5px!important;padding:4px 7px!important;min-height:0!important}.pmtabs .kh{font-size:9.5px;padding:2px 5px}.pmtabs{gap:3px!important}.pmb .cols{grid-template-columns:1fr}.pmb .st b{font-size:15px}}`;
function pmCss() {
  if (document.getElementById("pmcss")) return;
  const s = document.createElement("style");
  s.id = "pmcss";
  s.textContent = PM_CSS;
  document.head.appendChild(s);
}
const pmEsc = (t) => (typeof esc === "function" ? esc(String(t)) : String(t));
function pmTabsHTML(cls) {
  return (
    `<div class="${cls}"><span class="kh">LB</span><span class="kh">Q</span>` +
    PM_TABS.map(
      ([k, ic, n]) => `<span class="chip pmt${k === PM.tab ? " on" : ""}" data-pmt="${k}">${ic} ${n}</span>`,
    ).join("") +
    `<span class="kh">E</span><span class="kh">RB</span></div>`
  );
}
function pmWireTabs(root) {
  for (const c of root.querySelectorAll("[data-pmt]"))
    c.addEventListener("click", (e) => {
      e.stopPropagation();
      pmShow(c.dataset.pmt);
    });
}
function pmCan() {
  if (typeof started !== "undefined" && !started) return false;
  if (typeof FLY !== "undefined" && FLY.on) return false;
  if (typeof LTG !== "undefined" && LTG.run) return false;
  const sm = document.getElementById("smBack");
  if (sm && sm.style.display !== "none") return false;
  return true;
}
function openPause(tab) {
  if (!pmCan()) return false;
  pmCss();
  PM.on = true;
  pmShow(tab || PM.tab || "jobs");
  if (typeof BigRig !== "undefined" && BigRig.emit) BigRig.emit("pause", { on: true });
  return true;
}
function pmClose() {
  PM.on = false;
  pmMapBar(false);
  if (career.uiOpen) closeUI();
  if (typeof bigmap !== "undefined" && bigmap.open) closeMap();
  if (typeof BigRig !== "undefined" && BigRig.emit) BigRig.emit("pause", { on: false });
}
function pmStep(d) {
  const i = PM_TABS.findIndex((t) => t[0] === PM.tab);
  pmShow(PM_TABS[(i + d + PM_TABS.length) % PM_TABS.length][0]);
}
function pmShow(tab) {
  PM.sw = true;
  PM.tab = tab;
  try {
    pmMapBar(false);
    if (tab === "map") {
      if (career.uiOpen) closeUI();
      openMap();
      if (!bigmap.open) {
        // map can't open now (e.g. unloading): fall back to Jobs
        PM.tab = "jobs";
        return pmShow("jobs");
      }
      pmMapBar(true);
      return;
    }
    if (typeof bigmap !== "undefined" && bigmap.open) closeMap();
    if (tab === "jobs") {
      if (career.uiOpen) closeUI();
      openBoard();
      if (!career.uiOpen) {
        pmModal("jobs", '<div class="note">No jobs available right now.</div>');
        return;
      }
      const m = uiRoot.querySelector(".mback .modal"),
        mh = m && m.querySelector(".mh");
      if (mh) {
        mh.insertAdjacentHTML("afterend", pmTabsHTML("bar pmtabs"));
        pmWireTabs(m);
      }
      return;
    }
    pmModal(tab, pmBody(tab));
  } finally {
    PM.sw = false;
    if (typeof padNav === "function") setTimeout(() => padNav(null), 30);
  }
}
function pmModal(tab, body) {
  const T_ = typeof tierInfo === "function" ? tierInfo(career.tier) : { color: "#2fb84f", name: "" },
    lv = typeof levelOf === "function" ? levelOf(career.xp) : 1;
  const b = openModal(
    "pause",
    `<div class="mh"><div style="font-size:28px">\u23F8\uFE0F</div><div><h2>PAUSED</h2><div class="sub">${typeof MP !== "undefined" && MP.on ? "Online: your rig is frozen and see-through to other players" : "Game paused"}</div></div><div class="sp"></div>
    <div style="text-align:right;font-size:12px"><span class="tb" style="background:${T_.color}">TIER ${career.tier}</span> <b>${pmEsc(T_.name)}</b> \u2022 Lv ${lv}<br><span style="opacity:.7">${money(truck.money)}</span></div><button class="x">\u2715</button></div>
    ${pmTabsHTML("bar pmtabs")}
    <div class="body"><div class="pmb" id="pmBody">${body}</div></div>
    <div class="foot"><span>\u24B6 / Enter select \u2022 \u24B7 / Esc resume \u2022 LB RB / Q E tabs</span><span class="sp"></span><button class="chip" id="pmResume">\u25B6 Resume</button>${tab === "settings" ? '<button class="chip" id="pmExit" style="background:#7f1d1d;color:#fff;border-color:#ef4444">\u23FB Exit game</button>' : ""}</div>`,
    "pm",
  );
  pmWireTabs(b);
  b.querySelector("#pmResume").addEventListener("click", pmClose);
  const ex = b.querySelector("#pmExit");
  if (ex)
    ex.addEventListener("click", () => {
      if (!ex.dataset.arm) {
        ex.dataset.arm = 1;
        ex.textContent = "Press again to exit to title";
        setTimeout(() => {
          delete ex.dataset.arm;
          ex.textContent = "\u23FB Exit game";
        }, 3000);
        return;
      }
      pmExit();
    });
  pmWireBody(b, tab);
  return b;
}
function pmExit() {
  try {
    if (!career.noSave) saveGame();
  } catch (e) {}
  try {
    if (typeof MP !== "undefined" && MP.on && typeof mpLeave === "function") mpLeave();
  } catch (e) {}
  location.reload(); // back to the title screen (save kept)
}
// ---------- stats (persisted in the save as career.stats)
function pmStats() {
  career.stats = career.stats || {};
  return career.stats;
}
const PM_TRACK = { x: null, y: null };
setInterval(() => {
  if (typeof world === "undefined" || !world.ready || typeof started === "undefined" || !started) return;
  const S = pmStats();
  if (PM_TRACK.x !== null && !uiBlocking()) {
    const d = Math.hypot(truck.x - PM_TRACK.x, truck.y - PM_TRACK.y);
    if (d < 60) S.dist = (S.dist || 0) + d; // jumps (fast travel / respawn) don't count
  }
  PM_TRACK.x = truck.x;
  PM_TRACK.y = truck.y;
  if (typeof CRASH !== "undefined" && CRASH.stats) {
    const h = CRASH.stats.hits + CRASH.stats.wrecks * 0;
    if (PM_TRACK.h !== undefined && h > PM_TRACK.h) S.crashes = (S.crashes || 0) + (h - PM_TRACK.h);
    PM_TRACK.h = h;
  }
}, 500);
function pmCountFine(amt) {
  const S = pmStats();
  S.fines = (S.fines || 0) + 1;
  S.fined = (S.fined || 0) + (amt || 0);
}
function pmBody(tab) {
  const S = pmStats();
  if (tab === "stats") {
    const lv = levelOf(career.xp);
    const it = [
      ["MONEY", money(truck.money)],
      ["LEVEL", "Lv " + lv + " \u2022 Tier " + career.tier],
      ["XP", career.xp.toLocaleString("en-GB") + " XP"],
      ["DISTANCE DRIVEN", ((S.dist || 0) / 1609.34).toFixed(1) + " miles"],
      ["DELIVERIES", String(career.done || 0)],
      ["EARNED FROM JOBS", money(career.earned || 0)],
      ["POLICE FINES", (S.fines || 0) + " \u2022 " + money(S.fined || 0)],
      ["CRASHES", String(S.crashes || 0)],
    ];
    return (
      `<div class="grid2">${it.map(([k, v]) => `<div class="st"><small>${k}</small><b>${pmEsc(v)}</b></div>`).join("")}</div>` +
      '<div class="note">Distance, fines and crashes are counted from this version onwards.</div>'
    );
  }
  if (tab === "truck") {
    const m = typeof modelById === "function" ? modelById(career.cur) : { name: career.cur },
      tr = truck.trl;
    const rows = [
      ["Truck", m.name],
      ["Damage", Math.round(truck.damage || 0) + "%"],
      ["Fuel", Math.round(truck.fuel) + " / " + Math.round(truck.tank || 400) + " L"],
      ["Trailer", tr ? (tr.typeName || tr.type) + (tr.cargo ? " \u2022 " + tr.cargo : "") : "None"],
      ["Trucks owned", String((career.owned || []).length)],
    ];
    const here = [];
    if (document.getElementById("czGo")) here.push('<span class="chip" data-pa="cz">\u{1F3A8} Customise &amp; horns</span>');
    if (document.getElementById("rpGo")) here.push('<span class="chip" data-pa="rp">\u{1F527} Repair</span>');
    return (
      `<div class="grid2">${rows.map(([k, v]) => `<div class="st"><small>${k.toUpperCase()}</small><b>${pmEsc(v)}</b></div>`).join("")}</div>` +
      (here.length
        ? `<div class="row"><div class="lab">At this garage</div><div class="seg">${here.join("")}</div><div></div></div>`
        : '<div class="note">Customise paint, parts and horns, or repair, by driving into a garage (orange G on the map). Buy trucks at a dealer ($).</div>')
    );
  }
  if (tab === "props") {
    const L = [];
    if (typeof HOMES !== "undefined")
      for (const h of HOMES.list) if (homeOwned(h)) L.push({ n: h.name, k: "Home", o: h.ft, id: "h:" + h.id });
    for (const y of world.forSale || [])
      if (typeof ownedYard === "function" && ownedYard(y))
        L.push({ n: typeof ydBrand === "function" ? ydBrand(y).name : y.name, k: "Haulage yard", o: y, id: "y:" + y.id });
    PM.props = L;
    if (!L.length) return '<div class="note">You don\u2019t own any property yet. Visit an estate agent, or drive onto a home\u2019s driveway or into a yard that\u2019s for sale.</div>';
    return L.map((p, i) => {
      const ok = typeof fogKnownObj !== "function" || fogKnownObj(p.o);
      return `<div class="row"><div class="lab">${p.k === "Home" ? "\u{1F3E0}" : "\u{1F3ED}"} ${pmEsc(p.n)}</div><div class="note">${p.k}</div><span class="chip${ok ? "" : " off"}" data-pf="${i}">${ok ? "FAST TRAVEL \u203a" : "Visit in person first"}</span></div>`;
    }).join("");
  }
  if (tab === "players") {
    if (typeof MP === "undefined" || !MP.on)
      return '<div class="note">You\u2019re playing solo. Host or join an online game from the title screen (Exit game in Settings), or open an invite link from a friend.</div>';
    const ps = typeof mpRoster === "function" ? mpRoster() : [];
    return (
      (MP.code ? `<div class="row"><div class="lab">Invite code</div><div style="font-size:20px;font-weight:900;letter-spacing:2px;color:#ffd866">${pmEsc(MP.code)}</div><span class="chip" data-pa="copy">\u{1F4CB} Copy link</span></div>` : "") +
      ps.map((p) => `<div class="row"><div class="lab">${p.id === MP.myId ? "\u2B50" : "\u{1F69A}"} ${pmEsc(p.n || "Driver")}</div><div class="note">${p.id === MP.myId ? "You" : MP.players[p.id] && MP.players[p.id].cur && MP.players[p.id].cur.fl & 128 ? "\u23F8 Paused" : "Driving"}</div><div></div></div>`).join("")
    );
  }
  if (tab === "controls") {
    const t = (rows) => `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`;
    return `<div class="cols"><div class="st"><small>KEYBOARD</small>${t([
      ["W / \u2191", "Accelerate"], ["S / \u2193", "Brake, reverse"], ["A D / \u2190 \u2192", "Steer"], ["Space", "Handbrake"], ["H", "Horn"], ["L", "Full beam"], ["T / C", "Couple / uncouple"], ["F", "Refuel"], ["U", "Unload"], ["M", "World map"], ["J", "Job board"], ["X", "Cancel route"], ["Esc", "Pause menu"], ["Q / E", "Menu tabs"],
    ])}</div><div class="st"><small>XBOX CONTROLLER</small>${t([
      ["RT / LT", "Accelerate / brake"], ["Left stick", "Steer"], ["A", "Couple / interact"], ["B", "Handbrake \u2022 back"], ["X", "Refuel"], ["Y", "Unload"], ["LB", "Horn"], ["RB", "Full beam (hold: cancel route)"], ["LB + RB", "Hazards"], ["View", "World map"], ["Start", "Pause menu"], ["D-pad \u2190 \u2192", "Indicators"], ["LB / RB in menu", "Tabs"],
    ])}</div><div class="st"><small>PHONE</small>${t([
      ["Right pedals", "Accelerate / brake"], ["Wheel / tilt", "Steer"], ["COUPLE", "Couple / uncouple"], ["FUEL", "Refuel"], ["UNLOAD", "Unload"], ["MAP", "World map"], ["MENU", "Pause menu"], ["Tap tabs", "Switch menu tabs"],
    ])}</div></div>`;
  }
  if (tab === "settings") {
    const v = Math.round((SETTINGS.vol ?? 0.7) * 100),
      hi = typeof GFX === "undefined" || GFX.lvl === "high",
      mm = SETTINGS.mm !== false;
    return `<div class="row"><div class="lab">\u{1F50A} Game volume</div><div class="sl" id="pmVol"><i style="width:${v}%"></i><b style="left:${v}%"></b></div><div class="seg"><span class="chip" data-pv="-">\u2212</span><span class="val" id="pmVolV">${v}%</span><span class="chip" data-pv="+">+</span></div></div>
<div class="row"><div class="lab">\u2728 Graphics</div><div class="seg"><span class="chip${hi ? " on" : ""}" data-pg="high">High</span><span class="chip${hi ? "" : " on"}" data-pg="low">Low</span></div><div></div></div>
<div class="row"><div class="lab">\u{1F4CF} Units</div><div class="seg"><span class="chip on">mph</span></div><div></div></div>
<div class="row"><div class="lab">\u{1F9ED} Minimap</div><div class="seg"><span class="chip${mm ? " on" : ""}" data-pm="1">On</span><span class="chip${mm ? "" : " on"}" data-pm="0">Off</span></div><div></div></div>`;
  }
  return "";
}
function pmSave() {
  try {
    if (!career.noSave) saveGame();
  } catch (e) {}
}
function pmWireBody(b, tab) {
  const on = (sel, f) => {
    for (const el of b.querySelectorAll(sel))
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        f(el);
      });
  };
  const refresh = () => {
    const bd = b.querySelector("#pmBody"),
      f = pad && pad.focus && pad.focus.outerHTML;
    bd.innerHTML = pmBody(tab);
    pmWireBody(b, tab);
    if (f && typeof padNav === "function") {
      const same = [...bd.querySelectorAll(".chip")].find((x) => x.outerHTML.replace(/ (on|padfocus)/g, "") === f.replace(/ (on|padfocus)/g, ""));
      if (same) {
        pad.focus = same;
        same.classList.add("padfocus");
      }
    }
  };
  on("[data-pv]", (el) => {
    setVolume((SETTINGS.vol ?? 0.7) + (el.dataset.pv === "+" ? 0.1 : -0.1));
    pmSave();
    refresh();
  });
  const sl = b.querySelector("#pmVol");
  if (sl)
    sl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const r = sl.getBoundingClientRect();
      setVolume(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      pmSave();
      refresh();
    });
  on("[data-pg]", (el) => {
    if (typeof gfxSet === "function") gfxSet(el.dataset.pg);
    pmSave();
    refresh();
  });
  on("[data-pm]", (el) => {
    SETTINGS.mm = el.dataset.pm === "1";
    pmSave();
    refresh();
  });
  on("[data-pf]", (el) => {
    const p = PM.props && PM.props[+el.dataset.pf];
    if (!p) return;
    if (typeof fogKnownObj === "function" && !fogKnownObj(p.o)) {
      flash("Visit this property in person first to unlock fast travel");
      return;
    }
    const why = typeof ftBlock === "function" && ftBlock(p.o, true);
    if (why) {
      flash(why);
      return;
    }
    pmClose();
    setTimeout(() => fastTravel(p.o), 60);
  });
  on("[data-pa]", (el) => {
    const a = el.dataset.pa;
    if (a === "cz") {
      pmClose();
      setTimeout(() => czOpen(), 60);
    } else if (a === "rp") {
      pmClose();
      setTimeout(() => rpDo(), 60);
    } else if (a === "copy") {
      const t = typeof smLink === "function" ? smLink() : MP.code;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
        () => flash("Invite link copied"),
        () => flash("Invite code: " + MP.code),
      );
    }
  });
}
// ---------- map tab: DOM tab strip over the canvas map
function pmMapBar(show) {
  let el = document.getElementById("pmMapBar");
  if (!show) {
    if (el) el.remove();
    return;
  }
  if (typeof uiInit === "function") uiInit();
  if (!el) {
    el = document.createElement("div");
    el.id = "pmMapBar";
    for (const ev of ["pointerdown", "pointerup", "click"]) el.addEventListener(ev, (e) => e.stopPropagation());
    uiRoot.appendChild(el);
  }
  el.innerHTML = pmTabsHTML("bar pmtabs") + '<span class="chip" id="pmMapX">\u25B6 Resume</span>';
  el.querySelector("#pmMapX").addEventListener("click", (e) => {
    e.stopPropagation();
    pmClose();
  });
  pmWireTabs(el);
}
// watcher: anything that closed the menu's panel (B, \u2715, backdrop, fast travel) ends the pause
setInterval(() => {
  if (!PM.on || PM.sw) return;
  const mapOpen = typeof bigmap !== "undefined" && bigmap.open;
  if (PM.tab === "map" ? !mapOpen : !career.uiOpen) {
    PM.on = false;
    pmMapBar(false);
    if (typeof BigRig !== "undefined" && BigRig.emit) BigRig.emit("pause", { on: false });
  }
}, 100);
// ---------- input hooks (called from main.js keydown capture and gamepad.js padUpdate)
function pmKey(e) {
  if (!world.ready || e.repeat) return false;
  const tgt = e.target && e.target.closest && e.target.closest("input,textarea,select");
  if (tgt) return false;
  if (!PM.on) {
    if (e.code === "Escape" && !career.uiOpen && !(typeof bigmap !== "undefined" && bigmap.open) && pmCan()) {
      openPause();
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
    return false;
  }
  const c = e.code;
  if (c === "KeyQ" || c === "KeyE" || c === "PageUp" || c === "PageDown") {
    pmStep(c === "KeyE" || c === "PageDown" ? 1 : -1);
  } else if (c === "Escape") pmClose();
  else if (PM.tab !== "map" && /^Arrow/.test(c) && typeof padNav === "function") {
    padNav({ ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r" }[c]);
  } else if (PM.tab !== "map" && (c === "Enter" || c === "Space") && typeof padFocusEl === "function" && padFocusEl()) {
    padFocusEl().click();
    setTimeout(() => padNav(null), 40);
  } else return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  return true;
}
function pmPad(hit) {
  if (!PM.on) return false;
  if (hit(4) || hit(5)) {
    pmStep(hit(5) ? 1 : -1);
    return true;
  }
  if (hit(9) || (PM.tab === "map" && hit(1) && !(typeof NAV !== "undefined" && NAV.sel))) {
    pmClose();
    return true;
  }
  return false;
}
BigRig.pause = { open: openPause, close: pmClose, state: PM };
